import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  ensureRegistryCheckout: vi.fn(),
  resolveSkillPath: vi.fn(),
  upsertSkillLock: vi.fn((_lock: unknown, id: string, entry: unknown) => ({
    skills: { [id]: entry },
  })),
  listRegistrySkillIds: vi.fn(),
  uninstallSkillQuiet: vi.fn(),
  readLockOrEmpty: vi.fn().mockResolvedValue({ version: 1 as const, skills: {} }),
}));

vi.mock("../git/registry-repo.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../git/registry-repo.js")>();
  return { ...actual, ensureRegistryCheckout: hoisted.ensureRegistryCheckout };
});

vi.mock("../registry/resolve.js", () => ({
  resolveSkillPath: (registryRepoRoot: string, skillId: string) =>
    hoisted.resolveSkillPath(registryRepoRoot, skillId),
}));

vi.mock("../registry/catalog.js", () => ({
  listRegistrySkillIds: hoisted.listRegistrySkillIds,
}));

vi.mock("./uninstall.js", () => ({
  uninstallSkillQuiet: hoisted.uninstallSkillQuiet,
}));

vi.mock("../io.js", () => ({
  assertSkillMdPresent: vi.fn().mockResolvedValue(undefined),
  copySkillTree: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lockfile.js", () => ({
  readLockOrEmpty: hoisted.readLockOrEmpty,
  writeLock: vi.fn().mockResolvedValue(undefined),
  upsertSkillLock: hoisted.upsertSkillLock,
}));

const oraChains: Array<{
  start: ReturnType<typeof vi.fn>;
  succeed: ReturnType<typeof vi.fn>;
  fail: ReturnType<typeof vi.fn>;
}> = [];

vi.mock("ora", () => ({
  default: vi.fn(() => {
    const chain = {
      start: vi.fn().mockReturnThis(),
      succeed: vi.fn(),
      fail: vi.fn(),
    };
    oraChains.push(chain);
    return chain;
  }),
}));

describe("install", () => {
  beforeEach(() => {
    hoisted.ensureRegistryCheckout.mockReset();
    hoisted.resolveSkillPath.mockReset();
    hoisted.upsertSkillLock.mockReset();
    hoisted.listRegistrySkillIds.mockReset();
    hoisted.uninstallSkillQuiet.mockReset();
    hoisted.readLockOrEmpty.mockReset();
    hoisted.upsertSkillLock.mockImplementation((_lock: unknown, id: string, entry: unknown) => ({
      skills: { [id]: entry },
    }));
    hoisted.readLockOrEmpty.mockResolvedValue({ version: 1, skills: {} });
    hoisted.listRegistrySkillIds.mockResolvedValue(["alpha", "z", "a", "x"]);
    hoisted.uninstallSkillQuiet.mockResolvedValue(undefined);
    oraChains.length = 0;
    hoisted.ensureRegistryCheckout.mockResolvedValue({
      path: "/reg",
      head: "a".repeat(40),
    });
    hoisted.resolveSkillPath.mockResolvedValue({
      skillPath: "registry/x",
      source: "convention" as const,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function writeLocalConfig(cwd: string): Promise<void> {
    const reg = join(cwd, "reg");
    await mkdir(join(reg, ".git"), { recursive: true });
    await writeFile(join(reg, "registry.json"), "{}\n", "utf8");
    await mkdir(join(cwd, ".skill-issue"), { recursive: true });
    await writeFile(
      join(cwd, ".skill-issue", "config.yaml"),
      `registry:
  path: ${JSON.stringify(reg)}
  branch: main
skillsRoot: .agents/skills
`,
      "utf8",
    );
  }

  async function writeRemoteConfig(cwd: string): Promise<void> {
    await mkdir(join(cwd, ".skill-issue"), { recursive: true });
    await writeFile(
      join(cwd, ".skill-issue", "config.yaml"),
      `registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`,
      "utf8",
    );
  }

  it("runInstall stringifies non-Error checkout failures", async () => {
    hoisted.ensureRegistryCheckout.mockRejectedValueOnce("offline");
    const cwd = await mkdtemp(join(tmpdir(), "skissue-ins-"));
    try {
      await writeLocalConfig(cwd);
      const { runInstall } = await import("./install.js");
      await expect(runInstall(cwd, "alpha")).rejects.toBe("offline");
      const failFn = oraChains[0]?.fail;
      expect(failFn).toHaveBeenCalled();
      expect(String(failFn?.mock.calls[0]?.[0])).toContain("offline");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("runInstall fails spinner when ensureRegistryCheckout throws", async () => {
    hoisted.ensureRegistryCheckout.mockRejectedValueOnce(new Error("checkout failed"));
    const cwd = await mkdtemp(join(tmpdir(), "skissue-ins-"));
    try {
      await writeLocalConfig(cwd);
      const { runInstall } = await import("./install.js");
      await expect(runInstall(cwd, "alpha")).rejects.toThrow(/checkout failed/);
      const prep = oraChains[0];
      expect(prep?.fail).toHaveBeenCalled();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("runInstallMany stringifies non-Error when preparing registry", async () => {
    hoisted.ensureRegistryCheckout.mockRejectedValueOnce("prep-plain");
    const cwd = await mkdtemp(join(tmpdir(), "skissue-ins-"));
    try {
      await writeLocalConfig(cwd);
      const { runInstallMany } = await import("./install.js");
      await expect(runInstallMany(cwd, ["a"])).rejects.toBe("prep-plain");
      const prep = oraChains.find((c) => c.fail.mock.calls.length > 0);
      expect(String(prep?.fail.mock.calls[0]?.[0] ?? "")).toContain("prep-plain");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("runInstallMany fails preparing registry when checkout option omitted and clone fails", async () => {
    hoisted.ensureRegistryCheckout.mockRejectedValueOnce(new Error("no clone"));
    const cwd = await mkdtemp(join(tmpdir(), "skissue-ins-"));
    try {
      await writeLocalConfig(cwd);
      const { runInstallMany } = await import("./install.js");
      await expect(runInstallMany(cwd, ["a"])).rejects.toThrow(/no clone/);
      const prep = oraChains.find((c) => c.fail.mock.calls.length > 0);
      expect(prep).toBeDefined();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("runInstallMany fails per-skill spinner when copy path throws", async () => {
    const { copySkillTree } = await import("../io.js");
    vi.mocked(copySkillTree).mockRejectedValueOnce(new Error("copy err"));
    const cwd = await mkdtemp(join(tmpdir(), "skissue-ins-"));
    try {
      await writeLocalConfig(cwd);
      const { runInstallMany } = await import("./install.js");
      await expect(runInstallMany(cwd, ["z"])).rejects.toThrow(/copy err/);
      const failed = oraChains.filter((c) => c.fail.mock.calls.length > 0);
      expect(failed.length).toBeGreaterThan(0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("uses refs/heads/branch lock ref for remote registries", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "skissue-ins-"));
    try {
      await writeRemoteConfig(cwd);
      const { runInstall } = await import("./install.js");
      await runInstall(cwd, "alpha");
      expect(hoisted.upsertSkillLock).toHaveBeenCalledWith(
        expect.anything(),
        "alpha",
        expect.objectContaining({ ref: "refs/heads/main" }),
      );
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("runInstallMany stringifies non-Error copy failures", async () => {
    const { copySkillTree } = await import("../io.js");
    vi.mocked(copySkillTree).mockRejectedValueOnce("plain-copy");
    const cwd = await mkdtemp(join(tmpdir(), "skissue-ins-"));
    try {
      await writeLocalConfig(cwd);
      const { runInstallMany } = await import("./install.js");
      await expect(runInstallMany(cwd, ["z"])).rejects.toBe("plain-copy");
      const failMsg = String(
        oraChains.find((c) => c.fail.mock.calls.length > 0)?.fail.mock.calls[0]?.[0] ?? "",
      );
      expect(failMsg).toContain("plain-copy");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("runInstall removes local install when skill is no longer in the registry", async () => {
    hoisted.listRegistrySkillIds.mockResolvedValue(["other"]);
    hoisted.readLockOrEmpty.mockResolvedValue({
      version: 1,
      skills: {
        gone: {
          registryCommit: "b".repeat(40),
          skillPath: "registry/gone",
          ref: "refs/heads/main",
        },
      },
    });
    const cwd = await mkdtemp(join(tmpdir(), "skissue-ins-"));
    try {
      await writeLocalConfig(cwd);
      const { runInstall } = await import("./install.js");
      await runInstall(cwd, "gone");
      expect(hoisted.uninstallSkillQuiet).toHaveBeenCalledWith(cwd, "gone");
      expect(hoisted.upsertSkillLock).not.toHaveBeenCalled();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("runInstall throws when skill is not in the registry and not installed locally", async () => {
    hoisted.listRegistrySkillIds.mockResolvedValue([]);
    const cwd = await mkdtemp(join(tmpdir(), "skissue-ins-"));
    try {
      await writeLocalConfig(cwd);
      const { runInstall } = await import("./install.js");
      await expect(runInstall(cwd, "missing")).rejects.toThrow(/not in the registry/);
      expect(hoisted.uninstallSkillQuiet).not.toHaveBeenCalled();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("runInstallMany removes local install when skill is no longer in the registry", async () => {
    hoisted.listRegistrySkillIds.mockResolvedValue([]);
    hoisted.readLockOrEmpty.mockResolvedValue({
      version: 1,
      skills: {
        orphan: {
          registryCommit: "c".repeat(40),
          skillPath: "registry/orphan",
          ref: "refs/heads/main",
        },
      },
    });
    const cwd = await mkdtemp(join(tmpdir(), "skissue-ins-"));
    try {
      await writeLocalConfig(cwd);
      const { runInstallMany } = await import("./install.js");
      await runInstallMany(cwd, ["orphan"]);
      expect(hoisted.uninstallSkillQuiet).toHaveBeenCalledWith(cwd, "orphan");
      expect(hoisted.upsertSkillLock).not.toHaveBeenCalled();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
