import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CANCEL = Symbol("manage-cancel");

const hoisted = vi.hoisted(() => ({
  ensureRegistryCheckout: vi.fn(),
  isSkillPathStaleAtHead: vi.fn(),
  readLockOrEmpty: vi.fn(),
  listRegistrySkillIds: vi.fn(),
  runInstallMany: vi.fn(),
  runUninstall: vi.fn(),
  printSkillIssueBanner: vi.fn(),
}));

vi.mock("./banner.js", () => ({ printSkillIssueBanner: hoisted.printSkillIssueBanner }));
vi.mock("../registry/catalog.js", () => ({ listRegistrySkillIds: hoisted.listRegistrySkillIds }));
vi.mock("./install.js", () => ({ runInstallMany: hoisted.runInstallMany }));
vi.mock("./uninstall.js", () => ({ runUninstall: hoisted.runUninstall }));

vi.mock("../git/registry-repo.js", () => ({
  ensureRegistryCheckout: hoisted.ensureRegistryCheckout,
  isSkillPathStaleAtHead: hoisted.isSkillPathStaleAtHead,
}));
vi.mock("../lockfile.js", () => ({
  readLockOrEmpty: hoisted.readLockOrEmpty,
  writeLock: vi.fn(),
  upsertSkillLock: vi.fn(),
}));

vi.mock("node:readline", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:readline")>();
  return {
    ...actual,
    emitKeypressEvents: vi.fn(),
  };
});

vi.mock("@clack/prompts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clack/prompts")>();
  return {
    ...actual,
    intro: vi.fn(),
    outro: vi.fn(),
    cancel: vi.fn(),
    log: { info: vi.fn(), message: vi.fn(), warn: vi.fn(), error: vi.fn() },
    spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
    select: vi.fn(),
    multiselect: vi.fn(),
    confirm: vi.fn(),
    isCancel: (v: unknown) => actual.isCancel(v) || v === CANCEL,
  };
});

class ProcessExit extends Error {
  readonly code: number;
  constructor(code: number) {
    super(`process.exit(${code})`);
    this.name = "ProcessExit";
    this.code = code;
  }
}

describe("runManage", () => {
  let stdinIsTtyDesc: PropertyDescriptor | undefined;

  beforeEach(async () => {
    stdinIsTtyDesc = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
    Object.defineProperty(process.stdin, "isTTY", {
      configurable: true,
      enumerable: stdinIsTtyDesc?.enumerable ?? true,
      writable: true,
      value: false,
    });
    hoisted.ensureRegistryCheckout.mockResolvedValue({
      path: "/registry",
      head: "a".repeat(40),
    });
    hoisted.readLockOrEmpty.mockResolvedValue({ skills: {} });
    hoisted.isSkillPathStaleAtHead.mockResolvedValue(false);
    hoisted.runInstallMany.mockResolvedValue(undefined);
    hoisted.runUninstall.mockResolvedValue(undefined);
    hoisted.listRegistrySkillIds.mockResolvedValue([]);

    const p = await import("@clack/prompts");
    vi.mocked(p.intro).mockReset();
    vi.mocked(p.outro).mockReset();
    vi.mocked(p.cancel).mockReset();
    vi.mocked(p.select).mockReset();
    vi.mocked(p.multiselect).mockReset();
    vi.mocked(p.confirm).mockReset();
    vi.mocked(p.spinner).mockReset();
    vi.mocked(p.spinner).mockImplementation(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      message: vi.fn(),
    }));
    vi.mocked(p.log.info).mockReset();
    vi.mocked(p.log.message).mockReset();
    vi.mocked(p.log.warn).mockReset();
    vi.mocked(p.log.error).mockReset();
  });

  afterEach(() => {
    if (stdinIsTtyDesc) {
      Object.defineProperty(process.stdin, "isTTY", stdinIsTtyDesc);
    } else {
      Reflect.deleteProperty(process.stdin, "isTTY");
    }
    vi.clearAllMocks();
  });

  async function writeLocalConfig(cwd: string): Promise<void> {
    await mkdir(join(cwd, ".skill-issue"), { recursive: true });
    await writeFile(
      join(cwd, ".skill-issue", "config.yaml"),
      `registry:
  path: reg
  branch: main
skillsRoot: .agents/skills
`,
      "utf8",
    );
    await mkdir(join(cwd, "reg"), { recursive: true });
    await writeFile(join(cwd, "reg", "registry.json"), "{}\n", "utf8");
  }

  it("exits on double cancel within the escape window", async () => {
    const p = await import("@clack/prompts");
    vi.mocked(p.select).mockResolvedValue(CANCEL);

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new ProcessExit(code ?? 0);
    }) as never);
    const t0 = 60_000_000;
    const now = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(t0)
      .mockReturnValueOnce(t0 + 500);

    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      hoisted.listRegistrySkillIds.mockResolvedValue(["a"]);

      const { runManage } = await import("./manage.js");
      await expect(runManage(cwd)).rejects.toMatchObject({ name: "ProcessExit", code: 0 });
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      now.mockRestore();
      exitSpy.mockRestore();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("finishes when user chooses Exit", async () => {
    const p = await import("@clack/prompts");
    vi.mocked(p.select).mockResolvedValue("done");

    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      hoisted.listRegistrySkillIds.mockResolvedValue(["x"]);

      const { runManage } = await import("./manage.js");
      await runManage(cwd);

      expect(p.outro).toHaveBeenCalled();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("installs selected skills", async () => {
    const p = await import("@clack/prompts");
    vi.mocked(p.select).mockResolvedValueOnce("install").mockResolvedValueOnce("done");
    vi.mocked(p.multiselect).mockResolvedValue(["a"]);
    vi.mocked(p.confirm).mockResolvedValue(true);

    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      hoisted.listRegistrySkillIds.mockResolvedValue(["a"]);
      hoisted.readLockOrEmpty
        .mockResolvedValueOnce({ skills: {} })
        .mockResolvedValue({ skills: { a: {} as never } });

      const { runManage } = await import("./manage.js");
      await runManage(cwd);

      expect(hoisted.runInstallMany).toHaveBeenCalledWith(cwd, ["a"], {
        checkout: { path: "/registry", head: "a".repeat(40) },
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("uninstalls selected skills", async () => {
    const p = await import("@clack/prompts");
    vi.mocked(p.select).mockResolvedValueOnce("uninstall").mockResolvedValueOnce("done");
    vi.mocked(p.multiselect).mockResolvedValue(["z"]);
    vi.mocked(p.confirm).mockResolvedValue(true);

    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      hoisted.readLockOrEmpty.mockResolvedValue({
        skills: {
          z: {
            registryCommit: "a".repeat(40),
            skillPath: "registry/z",
            ref: "refs/heads/main",
          },
        },
      });
      hoisted.listRegistrySkillIds.mockResolvedValue(["z"]);

      const { runManage } = await import("./manage.js");
      await runManage(cwd);

      expect(hoisted.runUninstall).toHaveBeenCalledWith(cwd, "z");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("update all succeeds when batch install completes", async () => {
    const p = await import("@clack/prompts");
    vi.mocked(p.select)
      .mockResolvedValueOnce("update")
      .mockResolvedValueOnce("all")
      .mockResolvedValueOnce("done");
    vi.mocked(p.confirm).mockResolvedValueOnce(true);

    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      hoisted.readLockOrEmpty.mockResolvedValue({
        skills: {
          u: {
            registryCommit: "b".repeat(40),
            skillPath: "registry/u",
            ref: "refs/heads/main",
          },
        },
      });
      hoisted.listRegistrySkillIds.mockResolvedValue(["u"]);

      const { runManage } = await import("./manage.js");
      await runManage(cwd);

      expect(hoisted.runInstallMany).toHaveBeenCalledWith(cwd, ["u"], {
        checkout: { path: "/registry", head: "a".repeat(40) },
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("update all catches runInstallMany failure", async () => {
    const p = await import("@clack/prompts");
    vi.mocked(p.select)
      .mockResolvedValueOnce("update")
      .mockResolvedValueOnce("all")
      .mockResolvedValueOnce("done");
    vi.mocked(p.confirm).mockResolvedValue(true);
    hoisted.runInstallMany.mockRejectedValueOnce(new Error("nope"));

    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      hoisted.readLockOrEmpty.mockResolvedValue({
        skills: {
          u: {
            registryCommit: "b".repeat(40),
            skillPath: "registry/u",
            ref: "refs/heads/main",
          },
        },
      });
      hoisted.listRegistrySkillIds.mockResolvedValue(["u"]);

      const { runManage } = await import("./manage.js");
      await runManage(cwd);

      expect(p.log.error).toHaveBeenCalled();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("propagates ensureRegistryCheckout failure after spinner stop", async () => {
    hoisted.ensureRegistryCheckout.mockRejectedValueOnce(new Error("no registry"));

    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);

      const { runManage } = await import("./manage.js");
      await expect(runManage(cwd)).rejects.toThrow(/no registry/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("shows double-Esc hint on first menu cancel then exits on second choice", async () => {
    const p = await import("@clack/prompts");
    vi.mocked(p.select).mockResolvedValueOnce(CANCEL).mockResolvedValueOnce("done");

    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      hoisted.listRegistrySkillIds.mockResolvedValue(["a"]);

      const { runManage } = await import("./manage.js");
      await runManage(cwd);

      expect(p.log.message).toHaveBeenCalled();
      expect(p.outro).toHaveBeenCalled();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("exits on Ctrl+C when TTY keypress handler runs (synchronous key event)", async () => {
    const p = await import("@clack/prompts");
    vi.mocked(p.select).mockResolvedValue("done");

    Object.defineProperty(process.stdin, "isTTY", {
      configurable: true,
      writable: true,
      value: true,
    });
    const prependSpy = vi.spyOn(process.stdin, "prependListener").mockImplementation((ev, fn) => {
      if (String(ev) === "keypress") {
        (fn as (s: string | undefined, k: { ctrl?: boolean; name?: string }) => void)(undefined, {
          ctrl: true,
          name: "c",
        });
      }
      return process.stdin;
    });

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new ProcessExit(code ?? 0);
    }) as never);

    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      hoisted.listRegistrySkillIds.mockResolvedValue(["a"]);

      const { runManage } = await import("./manage.js");
      await expect(runManage(cwd)).rejects.toMatchObject({ name: "ProcessExit", code: 0 });
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      prependSpy.mockRestore();
      exitSpy.mockRestore();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("warns when update chosen but nothing is installed", async () => {
    const p = await import("@clack/prompts");
    vi.mocked(p.select).mockResolvedValueOnce("update").mockResolvedValueOnce("done");

    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      hoisted.listRegistrySkillIds.mockResolvedValue(["a"]);
      hoisted.readLockOrEmpty.mockResolvedValue({ skills: {} });

      const { runManage } = await import("./manage.js");
      await runManage(cwd);

      expect(p.log.warn).toHaveBeenCalled();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("handles stale check failure on update", async () => {
    const p = await import("@clack/prompts");
    vi.mocked(p.select).mockResolvedValueOnce("update").mockResolvedValueOnce("done");
    hoisted.isSkillPathStaleAtHead.mockRejectedValueOnce(new Error("diff boom"));

    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      hoisted.readLockOrEmpty.mockResolvedValue({
        skills: {
          u: {
            registryCommit: "b".repeat(40),
            skillPath: "registry/u",
            ref: "refs/heads/main",
          },
        },
      });
      hoisted.listRegistrySkillIds.mockResolvedValue(["u"]);

      const { runManage } = await import("./manage.js");
      await runManage(cwd);

      expect(p.log.error).toHaveBeenCalled();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("returns to menu when update sub-flow is cancelled or declined", async () => {
    const p = await import("@clack/prompts");
    vi.mocked(p.select)
      .mockResolvedValueOnce("update")
      .mockResolvedValueOnce("pick")
      .mockResolvedValueOnce("done");
    vi.mocked(p.multiselect).mockResolvedValueOnce(CANCEL);

    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      hoisted.readLockOrEmpty.mockResolvedValue({
        skills: {
          u: {
            registryCommit: "b".repeat(40),
            skillPath: "registry/u",
            ref: "refs/heads/main",
          },
        },
      });
      hoisted.listRegistrySkillIds.mockResolvedValue(["u"]);

      const { runManage } = await import("./manage.js");
      await runManage(cwd);

      expect(p.log.message).toHaveBeenCalled();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("update all returns to menu when confirm is cancelled", async () => {
    const p = await import("@clack/prompts");
    vi.mocked(p.select)
      .mockResolvedValueOnce("update")
      .mockResolvedValueOnce("all")
      .mockResolvedValueOnce("done");
    vi.mocked(p.confirm).mockResolvedValueOnce(CANCEL);

    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      hoisted.readLockOrEmpty.mockResolvedValue({
        skills: {
          u: {
            registryCommit: "b".repeat(40),
            skillPath: "registry/u",
            ref: "refs/heads/main",
          },
        },
      });
      hoisted.listRegistrySkillIds.mockResolvedValue(["u"]);

      const { runManage } = await import("./manage.js");
      await runManage(cwd);

      expect(p.log.message).toHaveBeenCalled();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("update pick: empty multiselect, declined confirm, and pick success", async () => {
    const p = await import("@clack/prompts");
    vi.mocked(p.select)
      .mockResolvedValueOnce("update")
      .mockResolvedValueOnce("pick")
      .mockResolvedValueOnce("update")
      .mockResolvedValueOnce("pick")
      .mockResolvedValueOnce("update")
      .mockResolvedValueOnce("pick")
      .mockResolvedValueOnce("done");
    vi.mocked(p.multiselect)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(["u"])
      .mockResolvedValueOnce(["u"]);
    vi.mocked(p.confirm).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      hoisted.readLockOrEmpty.mockResolvedValue({
        skills: {
          u: {
            registryCommit: "b".repeat(40),
            skillPath: "registry/u",
            ref: "refs/heads/main",
          },
        },
      });
      hoisted.listRegistrySkillIds.mockResolvedValue(["u"]);

      const { runManage } = await import("./manage.js");
      await runManage(cwd);

      expect(hoisted.runInstallMany).toHaveBeenCalledWith(cwd, ["u"], {
        checkout: { path: "/registry", head: "a".repeat(40) },
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("update pick shows stale hint when skill is outdated", async () => {
    const p = await import("@clack/prompts");
    hoisted.isSkillPathStaleAtHead.mockResolvedValue(true);
    vi.mocked(p.select)
      .mockResolvedValueOnce("update")
      .mockResolvedValueOnce("pick")
      .mockResolvedValueOnce("done");
    vi.mocked(p.multiselect).mockResolvedValueOnce(CANCEL);

    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      hoisted.readLockOrEmpty.mockResolvedValue({
        skills: {
          u: {
            registryCommit: "b".repeat(40),
            skillPath: "registry/u",
            ref: "refs/heads/main",
          },
        },
      });
      hoisted.listRegistrySkillIds.mockResolvedValue(["u"]);

      const { runManage } = await import("./manage.js");
      await runManage(cwd);

      const selectOpts = vi
        .mocked(p.select)
        .mock.calls.find(
          (c) =>
            typeof c[0] === "object" &&
            (c[0] as { message?: string }).message?.includes("Update skills"),
        )?.[0] as { options?: Array<{ hint?: unknown }> };
      expect(String(selectOpts?.options?.[0]?.hint ?? "")).toContain("OUTDATED");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("install warns when everything in the registry is already installed", async () => {
    const p = await import("@clack/prompts");
    vi.mocked(p.select).mockResolvedValueOnce("install").mockResolvedValueOnce("done");

    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      hoisted.listRegistrySkillIds.mockResolvedValue(["a"]);
      hoisted.readLockOrEmpty.mockResolvedValue({ skills: { a: {} as never } });

      const { runManage } = await import("./manage.js");
      await runManage(cwd);

      expect(p.log.warn).toHaveBeenCalled();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("install: multiselect cancel, empty selection, confirm cancel/false", async () => {
    const p = await import("@clack/prompts");
    vi.mocked(p.select)
      .mockResolvedValueOnce("install")
      .mockResolvedValueOnce("install")
      .mockResolvedValueOnce("install")
      .mockResolvedValueOnce("install")
      .mockResolvedValueOnce("done");
    vi.mocked(p.multiselect)
      .mockResolvedValueOnce(CANCEL)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(["a"])
      .mockResolvedValueOnce(["a"]);
    vi.mocked(p.confirm).mockResolvedValueOnce(CANCEL).mockResolvedValueOnce(false);

    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      hoisted.listRegistrySkillIds.mockResolvedValue(["a", "b"]);
      hoisted.readLockOrEmpty.mockResolvedValue({ skills: { b: {} as never } });

      const { runManage } = await import("./manage.js");
      await runManage(cwd);

      expect(hoisted.runInstallMany).not.toHaveBeenCalled();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("uninstall: nothing installed, then cancel paths", async () => {
    const p = await import("@clack/prompts");
    vi.mocked(p.select)
      .mockResolvedValueOnce("uninstall")
      .mockResolvedValueOnce("uninstall")
      .mockResolvedValueOnce("uninstall")
      .mockResolvedValueOnce("uninstall")
      .mockResolvedValueOnce("uninstall")
      .mockResolvedValueOnce("done");
    vi.mocked(p.multiselect)
      .mockResolvedValueOnce(CANCEL)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(["z", "y"]);
    vi.mocked(p.confirm).mockResolvedValueOnce(CANCEL).mockResolvedValueOnce(false);

    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      hoisted.readLockOrEmpty.mockResolvedValueOnce({ skills: {} }).mockResolvedValue({
        skills: {
          y: {
            registryCommit: "a".repeat(40),
            skillPath: "registry/y",
            ref: "refs/heads/main",
          },
          z: {
            registryCommit: "a".repeat(40),
            skillPath: "registry/z",
            ref: "refs/heads/main",
          },
        },
      });
      hoisted.listRegistrySkillIds.mockResolvedValue(["y", "z"]);

      const { runManage } = await import("./manage.js");
      await runManage(cwd);

      expect(hoisted.runUninstall).not.toHaveBeenCalled();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("uninstall: removes multiple skills in sorted order", async () => {
    const p = await import("@clack/prompts");
    vi.mocked(p.select).mockResolvedValueOnce("uninstall").mockResolvedValueOnce("done");
    vi.mocked(p.multiselect).mockResolvedValue(["z", "y"]);
    vi.mocked(p.confirm).mockResolvedValue(true);

    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      hoisted.readLockOrEmpty.mockResolvedValue({
        skills: {
          y: {
            registryCommit: "a".repeat(40),
            skillPath: "registry/y",
            ref: "refs/heads/main",
          },
          z: {
            registryCommit: "a".repeat(40),
            skillPath: "registry/z",
            ref: "refs/heads/main",
          },
        },
      });
      hoisted.listRegistrySkillIds.mockResolvedValue(["y", "z"]);

      const { runManage } = await import("./manage.js");
      await runManage(cwd);

      expect(hoisted.runUninstall.mock.calls.map((c) => c[1])).toEqual(["y", "z"]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("update pick: confirm cancelled after multiselect", async () => {
    const p = await import("@clack/prompts");
    vi.mocked(p.select)
      .mockResolvedValueOnce("update")
      .mockResolvedValueOnce("pick")
      .mockResolvedValueOnce("done");
    vi.mocked(p.multiselect).mockResolvedValueOnce(["u"]);
    vi.mocked(p.confirm).mockResolvedValueOnce(CANCEL);

    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      hoisted.readLockOrEmpty.mockResolvedValue({
        skills: {
          u: {
            registryCommit: "b".repeat(40),
            skillPath: "registry/u",
            ref: "refs/heads/main",
          },
        },
      });
      hoisted.listRegistrySkillIds.mockResolvedValue(["u"]);

      const { runManage } = await import("./manage.js");
      await runManage(cwd);

      expect(hoisted.runInstallMany).not.toHaveBeenCalled();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("update pick: runInstallMany failure on selected skills", async () => {
    const p = await import("@clack/prompts");
    vi.mocked(p.select)
      .mockResolvedValueOnce("update")
      .mockResolvedValueOnce("pick")
      .mockResolvedValueOnce("done");
    vi.mocked(p.multiselect).mockResolvedValueOnce(["u"]);
    vi.mocked(p.confirm).mockResolvedValue(true);
    hoisted.runInstallMany.mockRejectedValueOnce(new Error("pick fail"));

    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      hoisted.readLockOrEmpty.mockResolvedValue({
        skills: {
          u: {
            registryCommit: "b".repeat(40),
            skillPath: "registry/u",
            ref: "refs/heads/main",
          },
        },
      });
      hoisted.listRegistrySkillIds.mockResolvedValue(["u"]);

      const { runManage } = await import("./manage.js");
      await runManage(cwd);

      expect(p.log.error).toHaveBeenCalled();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("removes keypress listener after TTY main menu completes", async () => {
    const readline = await import("node:readline");
    const p = await import("@clack/prompts");
    Object.defineProperty(process.stdin, "isTTY", {
      configurable: true,
      writable: true,
      value: true,
    });
    vi.mocked(p.select).mockResolvedValue("done");
    const removeSpy = vi.spyOn(process.stdin, "removeListener");

    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      hoisted.listRegistrySkillIds.mockResolvedValue(["a"]);

      const { runManage } = await import("./manage.js");
      await runManage(cwd);

      expect(vi.mocked(readline.emitKeypressEvents)).toHaveBeenCalledWith(process.stdin);
      expect(removeSpy).toHaveBeenCalledWith("keypress", expect.any(Function));
    } finally {
      removeSpy.mockRestore();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("uninstall: multiselect cancel, empty selection, confirm cancel", async () => {
    const p = await import("@clack/prompts");
    vi.mocked(p.select)
      .mockResolvedValueOnce("uninstall")
      .mockResolvedValueOnce("uninstall")
      .mockResolvedValueOnce("uninstall")
      .mockResolvedValueOnce("done");
    vi.mocked(p.multiselect)
      .mockResolvedValueOnce(CANCEL)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(["z"]);
    vi.mocked(p.confirm).mockResolvedValueOnce(CANCEL);

    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      hoisted.readLockOrEmpty.mockResolvedValue({
        skills: {
          z: {
            registryCommit: "a".repeat(40),
            skillPath: "registry/z",
            ref: "refs/heads/main",
          },
        },
      });
      hoisted.listRegistrySkillIds.mockResolvedValue(["z"]);

      const { runManage } = await import("./manage.js");
      await runManage(cwd);

      expect(hoisted.runUninstall).not.toHaveBeenCalled();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("update mode select cancelled goes back to menu", async () => {
    const p = await import("@clack/prompts");
    vi.mocked(p.select)
      .mockResolvedValueOnce("update")
      .mockResolvedValueOnce(CANCEL)
      .mockResolvedValueOnce("done");

    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      hoisted.readLockOrEmpty.mockResolvedValue({
        skills: {
          u: {
            registryCommit: "b".repeat(40),
            skillPath: "registry/u",
            ref: "refs/heads/main",
          },
        },
      });
      hoisted.listRegistrySkillIds.mockResolvedValue(["u"]);

      const { runManage } = await import("./manage.js");
      await runManage(cwd);

      expect(p.log.message).toHaveBeenCalled();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("surfaces non-Error prepare-registry failures", async () => {
    hoisted.ensureRegistryCheckout.mockRejectedValueOnce("reg-string");
    const p = await import("@clack/prompts");
    vi.mocked(p.select).mockResolvedValueOnce("done");
    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      const { runManage } = await import("./manage.js");
      await expect(runManage(cwd)).rejects.toBe("reg-string");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("update flow stringifies non-Error stale comparison failures", async () => {
    const p = await import("@clack/prompts");
    vi.mocked(p.select).mockResolvedValueOnce("update").mockResolvedValueOnce("done");
    hoisted.isSkillPathStaleAtHead.mockRejectedValueOnce("stale-err");
    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      hoisted.readLockOrEmpty.mockResolvedValue({
        skills: {
          u: {
            registryCommit: "b".repeat(40),
            skillPath: "registry/u",
            ref: "refs/heads/main",
          },
        },
      });
      hoisted.listRegistrySkillIds.mockResolvedValue(["u"]);
      const { runManage } = await import("./manage.js");
      await runManage(cwd);
      expect(p.log.error).toHaveBeenCalled();
      expect(
        String(
          vi
            .mocked(p.log.error)
            .mock.calls.map((c) => String(c[0]))
            .join(" "),
        ),
      ).toContain("stale-err");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("update all skips install when user declines confirm", async () => {
    const p = await import("@clack/prompts");
    vi.mocked(p.select)
      .mockResolvedValueOnce("update")
      .mockResolvedValueOnce("all")
      .mockResolvedValueOnce("done");
    vi.mocked(p.confirm).mockResolvedValueOnce(false);
    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      hoisted.readLockOrEmpty.mockResolvedValue({
        skills: {
          u: {
            registryCommit: "b".repeat(40),
            skillPath: "registry/u",
            ref: "refs/heads/main",
          },
        },
      });
      hoisted.listRegistrySkillIds.mockResolvedValue(["u"]);
      const { runManage } = await import("./manage.js");
      await runManage(cwd);
      expect(hoisted.runInstallMany).not.toHaveBeenCalled();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("update all logs failure when runInstallMany throws", async () => {
    const p = await import("@clack/prompts");
    vi.mocked(p.select)
      .mockResolvedValueOnce("update")
      .mockResolvedValueOnce("all")
      .mockResolvedValueOnce("done");
    vi.mocked(p.confirm).mockResolvedValue(true);
    hoisted.runInstallMany.mockRejectedValueOnce(new Error("batch"));
    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      hoisted.readLockOrEmpty.mockResolvedValue({
        skills: {
          u: {
            registryCommit: "b".repeat(40),
            skillPath: "registry/u",
            ref: "refs/heads/main",
          },
        },
      });
      hoisted.listRegistrySkillIds.mockResolvedValue(["u"]);
      const { runManage } = await import("./manage.js");
      await runManage(cwd);
      expect(p.log.error).toHaveBeenCalled();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("uninstall returns to menu when user declines confirm", async () => {
    const p = await import("@clack/prompts");
    vi.mocked(p.select).mockResolvedValueOnce("uninstall").mockResolvedValueOnce("done");
    vi.mocked(p.multiselect).mockResolvedValueOnce(["z"]);
    vi.mocked(p.confirm).mockResolvedValueOnce(false);
    const cwd = await mkdtemp(join(tmpdir(), "skissue-manage-"));
    try {
      await writeLocalConfig(cwd);
      hoisted.readLockOrEmpty.mockResolvedValue({
        skills: {
          z: {
            registryCommit: "a".repeat(40),
            skillPath: "registry/z",
            ref: "refs/heads/main",
          },
        },
      });
      hoisted.listRegistrySkillIds.mockResolvedValue(["z"]);
      const { runManage } = await import("./manage.js");
      await runManage(cwd);
      expect(hoisted.runUninstall).not.toHaveBeenCalled();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
