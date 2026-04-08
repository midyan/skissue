import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseConfigYaml } from "../config.js";
import { configPath } from "../paths.js";

const CANCEL = Symbol("test-cancel");
function mockClack(
  overrides: Partial<{
    select: ReturnType<typeof vi.fn>;
    confirm: ReturnType<typeof vi.fn>;
    text: ReturnType<typeof vi.fn>;
  }> = {},
) {
  return {
    intro: vi.fn(),
    outro: vi.fn(),
    note: vi.fn(),
    cancel: vi.fn(),
    confirm: overrides.confirm ?? vi.fn().mockResolvedValue(true),
    select: overrides.select ?? vi.fn(),
    text: overrides.text ?? vi.fn(),
    isCancel: (v: unknown) => v === CANCEL,
  };
}

describe("runInit", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@clack/prompts");
    vi.doUnmock("../config.js");
    vi.doUnmock("../git/exec.js");
    vi.doUnmock("./init-registry.js");
    vi.resetModules();
    vi.restoreAllMocks();
  });

  async function minimalRegistryTree(regRoot: string): Promise<void> {
    await writeFile(join(regRoot, "registry.json"), "{}\n", "utf8");
    await mkdir(join(regRoot, "registry"), { recursive: true });
    await mkdir(join(regRoot, ".git"), { recursive: true });
  }

  it("writes config for local existing registry (no prior config)", async () => {
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("local").mockResolvedValueOnce("existing"),
      text: vi
        .fn()
        .mockResolvedValueOnce(".")
        .mockResolvedValueOnce("main")
        .mockResolvedValueOnce(".agents/skills"),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      await minimalRegistryTree(cwd);
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      const raw = await readFile(configPath(cwd), "utf8");
      expect(raw).toContain("path: .");
      expect(raw).toContain("branch: main");
      expect(clack.outro).toHaveBeenCalled();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("aborts when user declines overwriting existing config", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const clack = mockClack({
      confirm: vi.fn().mockResolvedValueOnce(false),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      await mkdir(join(cwd, ".skill-issue"), { recursive: true });
      await writeFile(
        join(cwd, ".skill-issue", "config.yaml"),
        `registry:
  path: .
  branch: main
skillsRoot: .agents/skills
`,
        "utf8",
      );
      await minimalRegistryTree(cwd);
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(clack.cancel).toHaveBeenCalled();
    } finally {
      exitSpy.mockRestore();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("shows non-Error parse failures as string notes", async () => {
    const clack = mockClack({
      confirm: vi.fn().mockResolvedValueOnce(false),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../config.js", async (importOriginal) => {
      const orig = await importOriginal<typeof import("../config.js")>();
      return {
        ...orig,
        loadConfig: vi.fn().mockRejectedValue("not-an-error-object"),
      };
    });
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      await mkdir(join(cwd, ".skill-issue"), { recursive: true });
      await writeFile(join(cwd, ".skill-issue", "config.yaml"), "x: y\n", "utf8");
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(clack.note).toHaveBeenCalledWith(
        "not-an-error-object",
        "Existing config (could not parse)",
      );
    } finally {
      exitSpy.mockRestore();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("shows parse error for broken existing config then continues after overwrite", async () => {
    const clack = mockClack({
      confirm: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(true),
      select: vi.fn().mockResolvedValueOnce("local").mockResolvedValueOnce("existing"),
      text: vi
        .fn()
        .mockResolvedValueOnce(".")
        .mockResolvedValueOnce("main")
        .mockResolvedValueOnce(".agents/skills"),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      await mkdir(join(cwd, ".skill-issue"), { recursive: true });
      await writeFile(join(cwd, ".skill-issue", "config.yaml"), "not: yaml: [[", "utf8");
      await minimalRegistryTree(cwd);
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(clack.note).toHaveBeenCalled();
      const raw = await readFile(configPath(cwd), "utf8");
      expect(raw).toContain("path: .");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("exits when source select is cancelled", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce(CANCEL),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      exitSpy.mockRestore();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("remote GitHub flow writes owner/repo config", async () => {
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("remote"),
      text: vi
        .fn()
        .mockResolvedValueOnce("acme")
        .mockResolvedValueOnce("skills")
        .mockResolvedValueOnce("main")
        .mockResolvedValueOnce(".agents/skills"),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      const raw = await readFile(configPath(cwd), "utf8");
      expect(raw).toContain("owner: acme");
      expect(raw).toContain("repo: skills");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("bootstrap flow sets exitCode when scaffold throws", async () => {
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("local").mockResolvedValueOnce("bootstrap"),
      text: vi
        .fn()
        .mockResolvedValueOnce("./skill-registry")
        .mockResolvedValueOnce("main")
        .mockResolvedValueOnce(".agents/skills"),
      confirm: vi.fn().mockResolvedValue(true),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));
    vi.doMock("./init-registry.js", async (importOriginal) => {
      const orig = await importOriginal<typeof import("./init-registry.js")>();
      return {
        ...orig,
        promptMinimalRegistryScaffold: vi.fn().mockResolvedValue({
          skillId: "sample",
          runGitInit: false,
          hadGit: true,
        }),
        scaffoldMinimalRegistry: vi.fn().mockRejectedValue(new Error("scaffold boom")),
        registryLayoutExists: vi.fn().mockReturnValue(false),
      };
    });

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(clack.cancel).toHaveBeenCalledWith("scaffold boom");
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = 0;
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("bootstrap scaffold surfaces non-Error rejections", async () => {
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("local").mockResolvedValueOnce("bootstrap"),
      text: vi
        .fn()
        .mockResolvedValueOnce("./skill-registry")
        .mockResolvedValueOnce("main")
        .mockResolvedValueOnce(".agents/skills"),
      confirm: vi.fn().mockResolvedValue(true),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));
    vi.doMock("./init-registry.js", async (importOriginal) => {
      const orig = await importOriginal<typeof import("./init-registry.js")>();
      return {
        ...orig,
        promptMinimalRegistryScaffold: vi.fn().mockResolvedValue({
          skillId: "sample",
          runGitInit: false,
          hadGit: true,
        }),
        scaffoldMinimalRegistry: vi.fn().mockRejectedValue("plain-string-failure"),
        registryLayoutExists: vi.fn().mockReturnValue(false),
      };
    });

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(clack.cancel).toHaveBeenCalledWith("plain-string-failure");
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = 0;
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("bootstrap at consumer root asks confirmation when layout missing", async () => {
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("local").mockResolvedValueOnce("bootstrap"),
      text: vi
        .fn()
        .mockResolvedValueOnce(".")
        .mockResolvedValueOnce("main")
        .mockResolvedValueOnce(".agents/skills"),
      confirm: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(true),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));
    vi.doMock("./init-registry.js", async (importOriginal) => {
      const orig = await importOriginal<typeof import("./init-registry.js")>();
      return {
        ...orig,
        promptMinimalRegistryScaffold: vi.fn().mockResolvedValue({
          skillId: "boot",
          runGitInit: false,
          hadGit: true,
        }),
        scaffoldMinimalRegistry: vi.fn().mockResolvedValue({
          root: "r",
          skillId: "boot",
          gitInitRan: false,
          committed: true,
        }),
        registryLayoutExists: vi.fn().mockReturnValue(false),
      };
    });

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(clack.confirm).toHaveBeenCalled();
      expect(clack.outro).toHaveBeenCalled();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("aborts bootstrap when promptMinimalRegistryScaffold returns null", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("local").mockResolvedValueOnce("bootstrap"),
      text: vi
        .fn()
        .mockResolvedValueOnce("./reg")
        .mockResolvedValueOnce("main")
        .mockResolvedValueOnce(".agents/skills"),
      confirm: vi.fn().mockResolvedValue(true),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));
    vi.doMock("./init-registry.js", async (importOriginal) => {
      const orig = await importOriginal<typeof import("./init-registry.js")>();
      return {
        ...orig,
        promptMinimalRegistryScaffold: vi.fn().mockResolvedValue(null),
        registryLayoutExists: vi.fn().mockReturnValue(false),
      };
    });

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      exitSpy.mockRestore();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("uses main when git branch cannot be resolved for existing registry", async () => {
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("local").mockResolvedValueOnce("existing"),
      text: vi
        .fn()
        .mockResolvedValueOnce(".")
        .mockResolvedValueOnce("main")
        .mockResolvedValueOnce(".agents/skills"),
    });
    vi.doMock("@clack/prompts", () => clack);
    const execGit = vi
      .fn()
      .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "err" })
      .mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" });
    vi.doMock("../git/exec.js", () => ({ execGit }));

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      await minimalRegistryTree(cwd);
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      const raw = await readFile(configPath(cwd), "utf8");
      expect(raw).toContain("branch: main");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("uses main when git reports an empty branch name", async () => {
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("local").mockResolvedValueOnce("existing"),
      text: vi
        .fn()
        .mockResolvedValueOnce(".")
        .mockResolvedValueOnce("tracked")
        .mockResolvedValueOnce(".agents/skills"),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "   \n", stderr: "" }),
    }));

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      await minimalRegistryTree(cwd);
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      const raw = await readFile(configPath(cwd), "utf8");
      expect(raw).toContain("branch: tracked");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("bootstrap flow defaults branch label to main when git branch is unknown", async () => {
    const regRel = "./boot-reg";
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("local").mockResolvedValueOnce("bootstrap"),
      text: vi.fn().mockResolvedValueOnce(regRel).mockResolvedValueOnce("use-main"),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValueOnce({ code: 1, stdout: "", stderr: "no branch" }),
    }));
    vi.doMock("./init-registry.js", async (importOriginal) => {
      const o = await importOriginal<typeof import("./init-registry.js")>();
      return {
        ...o,
        promptMinimalRegistryScaffold: vi.fn().mockResolvedValue({
          skillId: "s",
          runGitInit: false,
          hadGit: true,
        }),
        scaffoldMinimalRegistry: vi.fn().mockImplementation(async ({ root }: { root: string }) => ({
          root,
          skillId: "s",
          gitInitRan: false,
          committed: true,
        })),
        registryLayoutExists: vi.fn().mockReturnValue(false),
      };
    });

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(clack.text).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ initialValue: "main" }),
      );
      const raw = await readFile(configPath(cwd), "utf8");
      expect(raw).toContain("branch: use-main");
    } finally {
      vi.doUnmock("./init-registry.js");
      vi.resetModules();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("aborts when local mode select is cancelled", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("local").mockResolvedValueOnce(CANCEL),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      exitSpy.mockRestore();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("aborts when existing registry path prompt is cancelled", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("local").mockResolvedValueOnce("existing"),
      text: vi.fn().mockResolvedValueOnce(CANCEL),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      exitSpy.mockRestore();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("aborts when existing registry branch prompt is cancelled", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("local").mockResolvedValueOnce("existing"),
      text: vi.fn().mockResolvedValueOnce(".").mockResolvedValueOnce(CANCEL),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      await minimalRegistryTree(cwd);
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      exitSpy.mockRestore();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("uses '.' in bootstrap prompt when existing registry path is whitespace-only", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("local").mockResolvedValueOnce("existing"),
      text: vi
        .fn()
        .mockResolvedValueOnce("   ")
        .mockResolvedValueOnce("main")
        .mockResolvedValueOnce(".agents/skills"),
      confirm: vi.fn().mockResolvedValueOnce(false),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      await writeFile(join(cwd, "registry.json"), "{}\n", "utf8");
      await mkdir(join(cwd, ".git"), { recursive: true });
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      const firstBootstrapMsg = String(clack.confirm.mock.calls[0][0].message);
      expect(firstBootstrapMsg).toContain("No registry/ directory");
      // pathLabel is "." when the path is whitespace-only; template adds "." after cyan(pathLabel) → "at .."
      expect(firstBootstrapMsg).toContain("at ..");
    } finally {
      exitSpy.mockRestore();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("offers bootstrap when existing path has no registry/ directory", async () => {
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("local").mockResolvedValueOnce("existing"),
      text: vi
        .fn()
        .mockResolvedValueOnce(".")
        .mockResolvedValueOnce("main")
        .mockResolvedValueOnce(".agents/skills"),
      confirm: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(true),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));
    vi.doMock("./init-registry.js", async (importOriginal) => {
      const orig = await importOriginal<typeof import("./init-registry.js")>();
      return {
        ...orig,
        promptMinimalRegistryScaffold: vi.fn().mockResolvedValue({
          skillId: "from-existing",
          runGitInit: false,
          hadGit: true,
        }),
        scaffoldMinimalRegistry: vi.fn().mockResolvedValue({
          root: "r",
          skillId: "from-existing",
          gitInitRan: false,
          committed: true,
        }),
      };
    });

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      await writeFile(join(cwd, "registry.json"), "{}\n", "utf8");
      await mkdir(join(cwd, ".git"), { recursive: true });
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(clack.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("No registry/ directory"),
        }),
      );
      const raw = await readFile(configPath(cwd), "utf8");
      expect(raw).toContain("path: .");
      expect(raw).toContain("branch: main");
      expect(clack.outro).toHaveBeenCalled();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("aborts when user declines bootstrap for existing path without registry/", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("local").mockResolvedValueOnce("existing"),
      text: vi.fn().mockResolvedValueOnce("."),
      confirm: vi.fn().mockResolvedValueOnce(false),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      await writeFile(join(cwd, "registry.json"), "{}\n", "utf8");
      await mkdir(join(cwd, ".git"), { recursive: true });
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(clack.cancel).toHaveBeenCalled();
    } finally {
      exitSpy.mockRestore();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("aborts when bootstrap prompt for existing path without registry/ is cancelled", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("local").mockResolvedValueOnce("existing"),
      text: vi.fn().mockResolvedValueOnce("."),
      confirm: vi.fn().mockResolvedValueOnce(CANCEL),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      await writeFile(join(cwd, "registry.json"), "{}\n", "utf8");
      await mkdir(join(cwd, ".git"), { recursive: true });
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(clack.cancel).toHaveBeenCalled();
    } finally {
      exitSpy.mockRestore();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("sets exitCode 1 when scaffold fails during existing-path bootstrap", async () => {
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("local").mockResolvedValueOnce("existing"),
      text: vi.fn().mockResolvedValueOnce("."),
      confirm: vi.fn().mockResolvedValueOnce(true),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));
    vi.doMock("./init-registry.js", async (importOriginal) => {
      const orig = await importOriginal<typeof import("./init-registry.js")>();
      return {
        ...orig,
        promptMinimalRegistryScaffold: vi.fn().mockResolvedValue({
          skillId: "fail-skill",
          runGitInit: false,
          hadGit: true,
        }),
        scaffoldMinimalRegistry: vi.fn().mockRejectedValue(new Error("scaffold failed")),
      };
    });

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      await writeFile(join(cwd, "registry.json"), "{}\n", "utf8");
      await mkdir(join(cwd, ".git"), { recursive: true });
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = 0;
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("exits with code 1 when existing registry path is not a directory", async () => {
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("local").mockResolvedValueOnce("existing"),
      text: vi.fn().mockResolvedValueOnce("./missing-registry-dir"),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = 0;
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("aborts when bootstrap registry path prompt is cancelled", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("local").mockResolvedValueOnce("bootstrap"),
      text: vi.fn().mockResolvedValueOnce(CANCEL),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));
    vi.doMock("./init-registry.js", async (importOriginal) => {
      const orig = await importOriginal<typeof import("./init-registry.js")>();
      return { ...orig, registryLayoutExists: vi.fn().mockReturnValue(false) };
    });

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      exitSpy.mockRestore();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("aborts when user declines adding registry at project root", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("local").mockResolvedValueOnce("bootstrap"),
      text: vi.fn().mockResolvedValueOnce("."),
      confirm: vi.fn().mockResolvedValueOnce(false),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));
    vi.doMock("./init-registry.js", async (importOriginal) => {
      const orig = await importOriginal<typeof import("./init-registry.js")>();
      return { ...orig, registryLayoutExists: vi.fn().mockReturnValue(false) };
    });

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      exitSpy.mockRestore();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("shows heads-up when bootstrap leaves directory without git", async () => {
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("local").mockResolvedValueOnce("bootstrap"),
      text: vi
        .fn()
        .mockResolvedValueOnce("./skill-registry")
        .mockResolvedValueOnce("main")
        .mockResolvedValueOnce(".agents/skills"),
      confirm: vi.fn().mockResolvedValue(true),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));
    vi.doMock("./init-registry.js", async (importOriginal) => {
      const orig = await importOriginal<typeof import("./init-registry.js")>();
      return {
        ...orig,
        promptMinimalRegistryScaffold: vi.fn().mockResolvedValue({
          skillId: "solo",
          runGitInit: false,
          hadGit: false,
        }),
        scaffoldMinimalRegistry: vi.fn().mockResolvedValue({
          root: "r",
          skillId: "solo",
          gitInitRan: false,
          committed: false,
        }),
        registryLayoutExists: vi.fn().mockReturnValue(false),
      };
    });

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(clack.note).toHaveBeenCalled();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("writes relative registry path for nested bootstrap directory", async () => {
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("local").mockResolvedValueOnce("bootstrap"),
      text: vi
        .fn()
        .mockResolvedValueOnce("./nested-reg")
        .mockResolvedValueOnce("main")
        .mockResolvedValueOnce(".agents/skills"),
      confirm: vi.fn().mockResolvedValue(true),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));
    vi.doMock("./init-registry.js", async (importOriginal) => {
      const orig = await importOriginal<typeof import("./init-registry.js")>();
      return {
        ...orig,
        promptMinimalRegistryScaffold: vi.fn().mockResolvedValue({
          skillId: "x",
          runGitInit: false,
          hadGit: true,
        }),
        scaffoldMinimalRegistry: vi.fn().mockResolvedValue({
          root: "r",
          skillId: "x",
          gitInitRan: false,
          committed: true,
        }),
        registryLayoutExists: vi.fn().mockReturnValue(false),
      };
    });

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      await mkdir(join(cwd, "nested-reg"), { recursive: true });
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      const raw = await readFile(configPath(cwd), "utf8");
      expect(raw).toMatch(/path:\s+nested-reg/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("aborts remote flow when owner prompt is cancelled", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("remote"),
      text: vi.fn().mockResolvedValueOnce(CANCEL),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      exitSpy.mockRestore();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("aborts remote flow when repo prompt is cancelled", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("remote"),
      text: vi.fn().mockResolvedValueOnce("acme").mockResolvedValueOnce(CANCEL),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      exitSpy.mockRestore();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("aborts remote flow when branch prompt is cancelled", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("remote"),
      text: vi
        .fn()
        .mockResolvedValueOnce("acme")
        .mockResolvedValueOnce("r")
        .mockResolvedValueOnce(CANCEL),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      exitSpy.mockRestore();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("aborts when skillsRoot prompt is cancelled", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("remote"),
      text: vi
        .fn()
        .mockResolvedValueOnce("acme")
        .mockResolvedValueOnce("repo")
        .mockResolvedValueOnce("main")
        .mockResolvedValueOnce(CANCEL),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      exitSpy.mockRestore();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("aborts when final confirm is declined or cancelled", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("remote"),
      text: vi
        .fn()
        .mockResolvedValueOnce("acme")
        .mockResolvedValueOnce("repo")
        .mockResolvedValueOnce("main")
        .mockResolvedValueOnce(".agents/skills"),
      confirm: vi.fn().mockResolvedValueOnce(false),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      exitSpy.mockRestore();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("aborts when final confirm is cancelled via symbol", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("remote"),
      text: vi
        .fn()
        .mockResolvedValueOnce("acme")
        .mockResolvedValueOnce("repo")
        .mockResolvedValueOnce("main")
        .mockResolvedValueOnce(".agents/skills"),
      confirm: vi.fn().mockResolvedValueOnce(CANCEL),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      exitSpy.mockRestore();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("notes remote summary when overwriting a valid existing remote config", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const clack = mockClack({
      confirm: vi.fn().mockResolvedValueOnce(false),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      await mkdir(join(cwd, ".skill-issue"), { recursive: true });
      await writeFile(
        join(cwd, ".skill-issue", "config.yaml"),
        `registry:
  owner: acme
  repo: skills
  branch: main
  useSsh: true
skillsRoot: .agents/skills
`,
        "utf8",
      );
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(clack.note).toHaveBeenCalled();
      const noteBody = String(vi.mocked(clack.note).mock.calls[0]?.[0] ?? "");
      expect(noteBody).toContain("Remote registry: acme/skills");
      expect(noteBody).toContain("SSH");
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      exitSpy.mockRestore();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("aborts bootstrap when branch prompt is cancelled after scaffold", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const clack = mockClack({
      select: vi.fn().mockResolvedValueOnce("local").mockResolvedValueOnce("bootstrap"),
      text: vi.fn().mockResolvedValueOnce("./sr").mockResolvedValueOnce(CANCEL),
      confirm: vi.fn().mockResolvedValue(true),
    });
    vi.doMock("@clack/prompts", () => clack);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 0, stdout: "main\n", stderr: "" }),
    }));
    vi.doMock("./init-registry.js", async (importOriginal) => {
      const orig = await importOriginal<typeof import("./init-registry.js")>();
      return {
        ...orig,
        promptMinimalRegistryScaffold: vi.fn().mockResolvedValue({
          skillId: "z",
          runGitInit: false,
          hadGit: true,
        }),
        scaffoldMinimalRegistry: vi.fn().mockResolvedValue({
          root: "r",
          skillId: "z",
          gitInitRan: false,
          committed: true,
        }),
        registryLayoutExists: vi.fn().mockReturnValue(false),
      };
    });

    const cwd = await mkdtemp(join(tmpdir(), "skissue-init-"));
    try {
      const { runInit } = await import("./init.js");
      await runInit(cwd);
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      exitSpy.mockRestore();
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

describe("summarizeConfig / localRegistryPathForConfig", () => {
  it("summarizes local path registry", async () => {
    vi.resetModules();
    const { summarizeConfig } = await import("./init.js");
    const cfg = parseConfigYaml(`registry:
  path: ./r
  branch: dev
skillsRoot: .agents/skills
`);
    const s = summarizeConfig(cfg);
    expect(s).toContain("Local registry: ./r");
    expect(s).toContain("dev");
  });

  it("summarizes remote registry with explicit useSsh", async () => {
    vi.resetModules();
    const { summarizeConfig } = await import("./init.js");
    const cfg = parseConfigYaml(`registry:
  owner: o
  repo: r
  branch: b
  useSsh: false
skillsRoot: .agents/skills
`);
    expect(summarizeConfig(cfg)).toContain("HTTPS (registry.useSsh: false)");
  });

  it("summarizes remote registry in auto transport mode", async () => {
    vi.resetModules();
    const { summarizeConfig } = await import("./init.js");
    const prev = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    try {
      const cfg = parseConfigYaml(`registry:
  owner: o
  repo: r
  branch: b
skillsRoot: .agents/skills
`);
      expect(summarizeConfig(cfg)).toContain("(auto)");
    } finally {
      if (prev === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = prev;
    }
  });

  it("resolves relative registry path for config", async () => {
    vi.resetModules();
    const { localRegistryPathForConfig } = await import("./init.js");
    expect(localRegistryPathForConfig("/proj", "/proj")).toBe(".");
    expect(localRegistryPathForConfig("/proj", join("/proj", "nested", "reg"))).toMatch(/nested/);
  });
});
