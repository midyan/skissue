import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { execGit } from "../git/exec.js";

describe("validateSkillId", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("accepts kebab-case ids", async () => {
    const { validateSkillId } = await import("./init-registry.js");
    expect(validateSkillId("validate-links")).toBeUndefined();
    expect(validateSkillId("  validate-links  ")).toBeUndefined();
  });

  it("rejects empty and path-like ids", async () => {
    const { validateSkillId } = await import("./init-registry.js");
    expect(validateSkillId("")).toBeTruthy();
    expect(validateSkillId("   ")).toBeTruthy();
    expect(validateSkillId("a/b")).toBeTruthy();
    expect(validateSkillId(String.raw`a\b`)).toBeTruthy();
    expect(validateSkillId("..")).toBeTruthy();
    expect(validateSkillId("foo..bar")).toBeTruthy();
  });
});

describe("validateSkillIdPrompt", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("delegates to validateSkillId", async () => {
    const { validateSkillIdPrompt } = await import("./init-registry.js");
    expect(validateSkillIdPrompt("ok")).toBeUndefined();
    expect(validateSkillIdPrompt("")).toBeTruthy();
    expect(validateSkillIdPrompt(undefined)).toBeTruthy();
  });
});

describe("registryLayoutExists", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("is false for empty temp dir", async () => {
    const { registryLayoutExists } = await import("./init-registry.js");
    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      expect(registryLayoutExists(dir)).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("is true when registry.json exists", async () => {
    const { registryLayoutExists } = await import("./init-registry.js");
    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      await writeFile(join(dir, "registry.json"), "{}", "utf8");
      expect(registryLayoutExists(dir)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("is true when registry/ directory exists", async () => {
    const { registryLayoutExists } = await import("./init-registry.js");
    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      await mkdir(join(dir, "registry"), { recursive: true });
      expect(registryLayoutExists(dir)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("registryDirectoryExists", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("is false when registry/ is absent", async () => {
    const { registryDirectoryExists } = await import("./init-registry.js");
    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      await writeFile(join(dir, "registry.json"), "{}", "utf8");
      expect(registryDirectoryExists(dir)).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("is true when registry/ is a directory", async () => {
    const { registryDirectoryExists } = await import("./init-registry.js");
    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      await mkdir(join(dir, "registry"), { recursive: true });
      expect(registryDirectoryExists(dir)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("commitScaffoldedRegistry (mocked execGit)", () => {
  const execGitMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.doMock("../git/exec.js", () => ({ execGit: execGitMock }));
    execGitMock.mockReset();
  });

  afterEach(() => {
    vi.doUnmock("../git/exec.js");
    vi.resetModules();
    execGitMock.mockReset();
  });

  it("throws when git add registry.json fails with no stderr or stdout", async () => {
    execGitMock.mockResolvedValueOnce({ code: 2, stdout: "", stderr: "" });
    const { commitScaffoldedRegistry: commit } = await import("./init-registry.js");
    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      await mkdir(join(dir, ".git"), { recursive: true });
      await expect(commit(dir, "x")).rejects.toThrow(/exit 2/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("throws when git add registry.json fails", async () => {
    execGitMock.mockResolvedValueOnce({ code: 1, stdout: "", stderr: "add failed" });
    const { commitScaffoldedRegistry: commit } = await import("./init-registry.js");
    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      await mkdir(join(dir, ".git"), { recursive: true });
      await expect(commit(dir, "x")).rejects.toThrow(/git add registry\.json/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns committed false when no .git", async () => {
    const { commitScaffoldedRegistry: commit } = await import("./init-registry.js");
    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      await expect(commit(dir, "x")).resolves.toEqual({ committed: false });
      expect(execGitMock).not.toHaveBeenCalled();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("throws when git add skill path fails", async () => {
    const { commitScaffoldedRegistry: commit } = await import("./init-registry.js");
    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      await mkdir(join(dir, ".git"), { recursive: true });
      execGitMock.mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" });
      execGitMock.mockResolvedValueOnce({ code: 1, stdout: "", stderr: "no" });
      await expect(commit(dir, "my-skill")).rejects.toThrow(/git add registry\/my-skill/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("throws when git add skill path fails with empty output", async () => {
    const { commitScaffoldedRegistry: commit } = await import("./init-registry.js");
    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      await mkdir(join(dir, ".git"), { recursive: true });
      execGitMock.mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" });
      execGitMock.mockResolvedValueOnce({ code: 3, stdout: "", stderr: "" });
      await expect(commit(dir, "my-skill")).rejects.toThrow(/exit 3/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns committed true when staged diff exists and commit succeeds", async () => {
    const { commitScaffoldedRegistry: commit } = await import("./init-registry.js");
    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      await mkdir(join(dir, ".git"), { recursive: true });
      execGitMock
        .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" });
      await expect(commit(dir, "s")).resolves.toEqual({ committed: true });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns committed false when index is clean and HEAD resolves", async () => {
    const { commitScaffoldedRegistry: commit } = await import("./init-registry.js");
    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      await mkdir(join(dir, ".git"), { recursive: true });
      execGitMock
        .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ code: 0, stdout: "abc\n", stderr: "" });
      await expect(commit(dir, "s")).resolves.toEqual({ committed: false });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("throws when commit fails after staging", async () => {
    const { commitScaffoldedRegistry: commit } = await import("./init-registry.js");
    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      await mkdir(join(dir, ".git"), { recursive: true });
      execGitMock
        .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "bad commit" });
      await expect(commit(dir, "s")).rejects.toThrow(/git commit failed/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("throws when commit fails with empty stderr and stdout", async () => {
    const { commitScaffoldedRegistry: commit } = await import("./init-registry.js");
    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      await mkdir(join(dir, ".git"), { recursive: true });
      execGitMock
        .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ code: 9, stdout: "", stderr: "" });
      await expect(commit(dir, "s")).rejects.toThrow(/git commit failed/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("throws when HEAD cannot be resolved with a clean index", async () => {
    const { commitScaffoldedRegistry: commit } = await import("./init-registry.js");
    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      await mkdir(join(dir, ".git"), { recursive: true });
      execGitMock
        .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "no head" });
      await expect(commit(dir, "s")).rejects.toThrow(/at least one git commit/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("promptMinimalRegistryScaffold / runInitRegistry (mocked clack)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("../git/exec.js");
  });

  afterEach(() => {
    vi.doUnmock("@clack/prompts");
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("returns null when user declines overwrite", async () => {
    const p = {
      confirm: vi.fn().mockResolvedValue(false),
      text: vi.fn(),
      isCancel: () => false,
    };
    vi.doMock("@clack/prompts", () => p);
    const { promptMinimalRegistryScaffold: prompt } = await import("./init-registry.js");
    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      await writeFile(join(dir, "registry.json"), "{}", "utf8");
      await expect(prompt(dir)).resolves.toBeNull();
      expect(p.confirm).toHaveBeenCalled();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns null when overwrite confirm is cancelled", async () => {
    const token = Symbol("c");
    const p = {
      confirm: vi.fn().mockResolvedValue(token),
      text: vi.fn(),
      isCancel: (v: unknown) => v === token,
    };
    vi.doMock("@clack/prompts", () => p);
    const { promptMinimalRegistryScaffold: prompt } = await import("./init-registry.js");
    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      await writeFile(join(dir, "registry.json"), "{}", "utf8");
      await expect(prompt(dir)).resolves.toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns null when skill id prompt is cancelled", async () => {
    const token = Symbol("c");
    const p = {
      confirm: vi.fn(),
      text: vi.fn().mockResolvedValue(token),
      isCancel: (v: unknown) => v === token,
    };
    vi.doMock("@clack/prompts", () => p);
    const { promptMinimalRegistryScaffold: prompt } = await import("./init-registry.js");
    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      await expect(prompt(dir)).resolves.toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns null when git init prompt is cancelled", async () => {
    const token = Symbol("c");
    const p = {
      confirm: vi.fn().mockResolvedValue(token),
      text: vi.fn().mockResolvedValue("my-id"),
      isCancel: (v: unknown) => v === token,
    };
    vi.doMock("@clack/prompts", () => p);
    const { promptMinimalRegistryScaffold: prompt } = await import("./init-registry.js");
    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      await expect(prompt(dir)).resolves.toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runInitRegistry exits 0 when first select is cancelled (mocked)", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const cancelled = {};
    const p = {
      intro: vi.fn(),
      outro: vi.fn(),
      cancel: vi.fn(),
      select: vi.fn().mockResolvedValue(cancelled),
      text: vi.fn(),
      confirm: vi.fn(),
      isCancel: (v: unknown) => v === cancelled,
    };
    vi.doMock("@clack/prompts", () => p);
    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      const { runInitRegistry: run } = await import("./init-registry.js");
      await run(dir);
      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(p.cancel).toHaveBeenCalled();
    } finally {
      exitSpy.mockRestore();
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("scaffoldMinimalRegistry", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("../git/exec.js");
  });

  it("writes registry.json and SKILL.md", async () => {
    const { scaffoldMinimalRegistry } = await import("./init-registry.js");
    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      const r = await scaffoldMinimalRegistry({
        root: dir,
        skillId: "hello-world",
        runGitInit: false,
      });
      expect(r.skillId).toBe("hello-world");
      expect(r.gitInitRan).toBe(false);
      expect(r.committed).toBe(false);

      const json = JSON.parse(await readFile(join(dir, "registry.json"), "utf8")) as {
        skills: Record<string, string>;
      };
      expect(json.skills["hello-world"]).toBe("registry/hello-world");

      const md = await readFile(join(dir, "registry/hello-world/SKILL.md"), "utf8");
      expect(md).toContain("name: hello-world");
      expect(md).toContain("# Hello World");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runs git init when requested", async () => {
    const { scaffoldMinimalRegistry } = await import("./init-registry.js");
    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    vi.stubEnv("GIT_AUTHOR_NAME", "skissue-test");
    vi.stubEnv("GIT_AUTHOR_EMAIL", "skissue-test@local.test");
    vi.stubEnv("GIT_COMMITTER_NAME", "skissue-test");
    vi.stubEnv("GIT_COMMITTER_EMAIL", "skissue-test@local.test");
    try {
      const r = await scaffoldMinimalRegistry({
        root: dir,
        skillId: "x",
        runGitInit: true,
      });
      expect(r.gitInitRan).toBe(true);
      expect(r.committed).toBe(true);
      const head = await readFile(join(dir, ".git/HEAD"), "utf8");
      expect(head).toBeTruthy();
      const rev = await execGit(["rev-parse", "HEAD"], { cwd: dir });
      expect(rev.code).toBe(0);
      expect(rev.stdout.trim()).toMatch(/^[a-f0-9]{40}$/);
    } finally {
      vi.unstubAllEnvs();
      await rm(dir, { recursive: true, force: true });
    }
  }, 20_000);

  it("commits when .git already exists and runGitInit is false", async () => {
    const { scaffoldMinimalRegistry } = await import("./init-registry.js");
    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    vi.stubEnv("GIT_AUTHOR_NAME", "skissue-test");
    vi.stubEnv("GIT_AUTHOR_EMAIL", "skissue-test@local.test");
    vi.stubEnv("GIT_COMMITTER_NAME", "skissue-test");
    vi.stubEnv("GIT_COMMITTER_EMAIL", "skissue-test@local.test");
    try {
      const init = await execGit(["init"], { cwd: dir });
      expect(init.code).toBe(0);
      const r = await scaffoldMinimalRegistry({
        root: dir,
        skillId: "preinit",
        runGitInit: false,
      });
      expect(r.gitInitRan).toBe(false);
      expect(r.committed).toBe(true);
      const rev = await execGit(["rev-parse", "HEAD"], { cwd: dir });
      expect(rev.code).toBe(0);
    } finally {
      vi.unstubAllEnvs();
      await rm(dir, { recursive: true, force: true });
    }
  }, 20_000);

  it("formats underscore skill ids in generated SKILL.md", async () => {
    const { scaffoldMinimalRegistry } = await import("./init-registry.js");
    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      await scaffoldMinimalRegistry({ root: dir, skillId: "foo_bar", runGitInit: false });
      const md = await readFile(join(dir, "registry", "foo_bar", "SKILL.md"), "utf8");
      expect(md).toContain("# Foo Bar");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("uses validate-links template for default registry skill id", async () => {
    const { DEFAULT_REGISTRY_SKILL_ID, scaffoldMinimalRegistry } =
      await import("./init-registry.js");
    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      await scaffoldMinimalRegistry({
        root: dir,
        skillId: DEFAULT_REGISTRY_SKILL_ID,
        runGitInit: false,
      });
      const md = await readFile(
        join(dir, "registry", DEFAULT_REGISTRY_SKILL_ID, "SKILL.md"),
        "utf8",
      );
      expect(md).toContain("name: validate-links");
      expect(md).toContain("broken relative links");
      expect(md).toContain("# validate-links (soft)");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("scaffoldMinimalRegistry git init failure (mocked execGit)", () => {
  const execGitMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.doMock("../git/exec.js", () => ({ execGit: execGitMock }));
    execGitMock.mockReset();
  });

  afterEach(() => {
    vi.doUnmock("../git/exec.js");
    vi.resetModules();
  });

  it("throws when git init returns non-zero", async () => {
    execGitMock.mockResolvedValue({ code: 1, stdout: "", stderr: "init nope" });
    const { scaffoldMinimalRegistry } = await import("./init-registry.js");
    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      await expect(
        scaffoldMinimalRegistry({ root: dir, skillId: "x", runGitInit: true }),
      ).rejects.toThrow(/git init failed/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("throws when git init fails with empty stderr and stdout", async () => {
    execGitMock.mockResolvedValue({ code: 1, stdout: "", stderr: "" });
    const { scaffoldMinimalRegistry } = await import("./init-registry.js");
    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      await expect(
        scaffoldMinimalRegistry({ root: dir, skillId: "x", runGitInit: true }),
      ).rejects.toThrow(/exit 1/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("runInitRegistry (mocked clack, real scaffold)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("../git/exec.js");
  });

  afterEach(() => {
    vi.doUnmock("@clack/prompts");
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("writes registry files when user picks current directory", async () => {
    vi.stubEnv("GIT_AUTHOR_NAME", "skissue-test");
    vi.stubEnv("GIT_AUTHOR_EMAIL", "skissue-test@local.test");
    vi.stubEnv("GIT_COMMITTER_NAME", "skissue-test");
    vi.stubEnv("GIT_COMMITTER_EMAIL", "skissue-test@local.test");
    const p = {
      intro: vi.fn(),
      outro: vi.fn(),
      cancel: vi.fn(),
      note: vi.fn(),
      select: vi.fn().mockResolvedValue("here"),
      text: vi.fn().mockResolvedValue("cli-skill"),
      confirm: vi.fn(),
      isCancel: () => false,
    };
    vi.doMock("@clack/prompts", () => p);

    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      const init = await execGit(["init"], { cwd: dir });
      expect(init.code).toBe(0);
      const { runInitRegistry } = await import("./init-registry.js");
      await runInitRegistry(dir);
      expect(p.outro).toHaveBeenCalled();
      const raw = await readFile(join(dir, "registry.json"), "utf8");
      expect(raw).toContain("cli-skill");
    } finally {
      vi.unstubAllEnvs();
      await rm(dir, { recursive: true, force: true });
    }
  }, 20_000);

  it("uses explicit path when user picks another directory", async () => {
    vi.stubEnv("GIT_AUTHOR_NAME", "skissue-test");
    vi.stubEnv("GIT_AUTHOR_EMAIL", "skissue-test@local.test");
    vi.stubEnv("GIT_COMMITTER_NAME", "skissue-test");
    vi.stubEnv("GIT_COMMITTER_EMAIL", "skissue-test@local.test");
    const sub = "nested-reg";
    const p = {
      intro: vi.fn(),
      outro: vi.fn(),
      cancel: vi.fn(),
      note: vi.fn(),
      select: vi.fn().mockResolvedValue("other"),
      text: vi.fn().mockResolvedValueOnce(sub).mockResolvedValue("path-skill"),
      confirm: vi.fn(),
      isCancel: () => false,
    };
    vi.doMock("@clack/prompts", () => p);

    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      const init = await execGit(["init"], { cwd: dir });
      expect(init.code).toBe(0);
      const { runInitRegistry } = await import("./init-registry.js");
      await runInitRegistry(dir);
      const regRoot = join(dir, sub);
      const raw = await readFile(join(regRoot, "registry.json"), "utf8");
      expect(raw).toContain("path-skill");
    } finally {
      vi.unstubAllEnvs();
      await rm(dir, { recursive: true, force: true });
    }
  }, 20_000);

  it("sets exitCode when scaffold fails", async () => {
    const p = {
      intro: vi.fn(),
      outro: vi.fn(),
      cancel: vi.fn(),
      note: vi.fn(),
      select: vi.fn().mockResolvedValue("here"),
      text: vi.fn().mockResolvedValue("bad"),
      confirm: vi.fn(),
      isCancel: () => false,
    };
    vi.doMock("@clack/prompts", () => p);
    vi.doMock("../git/exec.js", () => ({
      execGit: vi.fn().mockResolvedValue({ code: 1, stdout: "", stderr: "fail" }),
    }));

    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      await mkdir(join(dir, ".git"), { recursive: true });
      const { runInitRegistry } = await import("./init-registry.js");
      await runInitRegistry(dir);
      expect(p.cancel).toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = 0;
      vi.doUnmock("../git/exec.js");
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("exits when scaffold prompts decline replacing an existing layout", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const p = {
      intro: vi.fn(),
      outro: vi.fn(),
      cancel: vi.fn(),
      note: vi.fn(),
      select: vi.fn().mockResolvedValue("here"),
      text: vi.fn(),
      confirm: vi.fn().mockResolvedValue(false),
      isCancel: () => false,
    };
    vi.doMock("@clack/prompts", () => p);

    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      await mkdir(join(dir, ".git"), { recursive: true });
      await writeFile(join(dir, "registry.json"), "{}", "utf8");
      const { runInitRegistry } = await import("./init-registry.js");
      await runInitRegistry(dir);
      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(p.cancel).toHaveBeenCalled();
    } finally {
      exitSpy.mockRestore();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("aborts when path prompt is cancelled", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const cancelled = Symbol("c");
    const p = {
      intro: vi.fn(),
      outro: vi.fn(),
      cancel: vi.fn(),
      note: vi.fn(),
      select: vi.fn().mockResolvedValue("other"),
      text: vi.fn().mockResolvedValue(cancelled),
      confirm: vi.fn(),
      isCancel: (v: unknown) => v === cancelled,
    };
    vi.doMock("@clack/prompts", () => p);

    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      const { runInitRegistry } = await import("./init-registry.js");
      await runInitRegistry(dir);
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      exitSpy.mockRestore();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("surfaces non-Error scaffold failures in runInitRegistry", async () => {
    vi.doMock("node:fs/promises", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs/promises")>();
      return {
        ...actual,
        writeFile: vi.fn().mockRejectedValue("scaffold-boom"),
      };
    });
    const p = {
      intro: vi.fn(),
      outro: vi.fn(),
      cancel: vi.fn(),
      note: vi.fn(),
      select: vi.fn().mockResolvedValue("here"),
      text: vi.fn().mockResolvedValue("s"),
      confirm: vi.fn().mockResolvedValue(true),
      isCancel: () => false,
    };
    vi.doMock("@clack/prompts", () => p);

    const dir = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    try {
      vi.resetModules();
      const { runInitRegistry } = await import("./init-registry.js");
      await runInitRegistry(dir);
      expect(p.cancel).toHaveBeenCalledWith("scaffold-boom");
      expect(process.exitCode).toBe(1);
    } finally {
      vi.doUnmock("node:fs/promises");
      vi.resetModules();
      process.exitCode = 0;
      await rm(dir, { recursive: true, force: true });
    }
  });
});
