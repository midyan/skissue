import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultConfigTemplate,
  isLocalRegistry,
  loadConfig,
  needsSetup,
  parseConfigYaml,
  writeConfig,
} from "./config.js";
import { assertSkillMdPresent, copySkillTree } from "./io.js";
import {
  configPath,
  defaultSkillsRoot,
  lockPath,
  skillInstallPath,
  skillIssueDir,
} from "./paths.js";

describe("parseConfigYaml", () => {
  it("rejects registry config that sets both path and owner/repo", () => {
    expect(() =>
      parseConfigYaml(`
registry:
  path: ../local
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`),
    ).toThrow();
  });

  it("rejects registry config with neither path nor owner/repo", () => {
    expect(() =>
      parseConfigYaml(`
registry:
  branch: main
skillsRoot: .agents/skills
`),
    ).toThrow();
  });

  it("parses remote (GitHub) registry config", () => {
    const cfg = parseConfigYaml(`
registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`);
    expect(cfg.registry.owner).toBe("acme");
    expect(cfg.registry.path).toBeUndefined();
    expect(cfg.registry.useSsh).toBeUndefined();
    expect(cfg.skillsRoot).toBe(".agents/skills");
  });

  it("parses remote registry with SSH", () => {
    const cfg = parseConfigYaml(`
registry:
  owner: acme
  repo: skills
  branch: main
  useSsh: true
skillsRoot: .agents/skills
`);
    expect(cfg.registry.useSsh).toBe(true);
  });

  it("parses local registry config", () => {
    const cfg = parseConfigYaml(`
registry:
  path: ../skill-issue
  branch: main
skillsRoot: .agents/skills
`);
    expect(cfg.registry.path).toBe("../skill-issue");
    expect(cfg.registry.owner).toBeUndefined();
    expect(cfg.skillsRoot).toBe(".agents/skills");
  });
});

describe("needsSetup", () => {
  it("returns true when config file is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-"));
    try {
      await expect(needsSetup(dir)).resolves.toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns false when config file is valid", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-"));
    try {
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(
        configPath(dir),
        `registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`,
        "utf8",
      );
      await expect(needsSetup(dir)).resolves.toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns true when config file is invalid YAML or schema", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-"));
    try {
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(configPath(dir), "not: yaml: [", "utf8");
      await expect(needsSetup(dir)).resolves.toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("loadConfig / writeConfig / defaultConfigTemplate / isLocalRegistry", () => {
  it("roundtrips config via writeConfig and loadConfig", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-"));
    try {
      const cfg = parseConfigYaml(`
registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`);
      await writeConfig(dir, cfg);
      const loaded = await loadConfig(dir);
      expect(loaded.registry.owner).toBe("acme");
      expect(loaded.registry.repo).toBe("skills");
      expect(loaded.skillsRoot).toBe(".agents/skills");
      expect(isLocalRegistry(loaded)).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("defaultConfigTemplate mentions skillsRoot and registry examples", () => {
    const t = defaultConfigTemplate();
    expect(t).toContain("skillsRoot:");
    expect(t).toContain(".agents/skills");
    expect(t).toContain("registry:");
  });

  it("isLocalRegistry is true when registry.path is set", () => {
    const cfg = parseConfigYaml(`
registry:
  path: ../reg
  branch: main
skillsRoot: .agents/skills
`);
    expect(isLocalRegistry(cfg)).toBe(true);
  });
});

describe("paths helpers", () => {
  it("skillIssueDir, configPath, lockPath nest under .skill-issue", () => {
    const cwd = "/tmp/proj";
    expect(skillIssueDir(cwd)).toBe(join(cwd, ".skill-issue"));
    expect(configPath(cwd)).toBe(join(cwd, ".skill-issue", "config.yaml"));
    expect(lockPath(cwd)).toBe(join(cwd, ".skill-issue", "lock.json"));
  });

  it("defaultSkillsRoot joins .agents/skills", () => {
    expect(defaultSkillsRoot("/app")).toBe(join("/app", ".agents", "skills"));
  });

  it("skillInstallPath uses cwd-relative skillsRoot unless absolute", () => {
    const cwd = "/proj";
    expect(skillInstallPath(cwd, ".agents/skills", "foo")).toBe(
      join(cwd, ".agents", "skills", "foo"),
    );
    expect(skillInstallPath(cwd, "/var/skills", "bar")).toBe(join("/var/skills", "bar"));
  });
});

describe("io", () => {
  it("assertSkillMdPresent throws when SKILL.md is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skissue-io-"));
    try {
      await expect(assertSkillMdPresent(dir)).rejects.toThrow(/SKILL\.md/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("assertSkillMdPresent and copySkillTree copy a skill tree", async () => {
    const from = await mkdtemp(join(tmpdir(), "skissue-from-"));
    const to = await mkdtemp(join(tmpdir(), "skissue-to-"));
    try {
      await mkdir(join(from, "nested"), { recursive: true });
      await writeFile(join(from, "SKILL.md"), "# x", "utf8");
      await writeFile(join(from, "nested", "a.txt"), "a", "utf8");
      await assertSkillMdPresent(from);
      await copySkillTree(from, to);
      expect(await readFile(join(to, "SKILL.md"), "utf8")).toBe("# x");
      expect(await readFile(join(to, "nested", "a.txt"), "utf8")).toBe("a");
    } finally {
      await rm(from, { recursive: true, force: true });
      await rm(to, { recursive: true, force: true });
    }
  });
});

describe("commands: list / doctor / default / uninstall / outdated / update / install", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock("./git/registry-repo.js");
    vi.doUnmock("./config.js");
    vi.doUnmock("./commands/init.js");
    vi.doUnmock("./commands/manage.js");
    vi.doUnmock("./commands/install.js");
    vi.doUnmock("./registry/catalog.js");
    vi.doUnmock("@clack/prompts");
    vi.doUnmock("node:fs/promises");
    vi.doUnmock("ora");
  });

  it("runList prints dim message when lock is empty", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skissue-cmd-"));
    try {
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(
        configPath(dir),
        `registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`,
        "utf8",
      );
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { runList } = await import("./commands/list.js");
      await runList(dir);
      expect(logSpy).toHaveBeenCalled();
      expect(String(logSpy.mock.calls[0]?.[0])).toMatch(/No skills installed/i);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runList prints installed rows", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skissue-cmd-"));
    try {
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(
        configPath(dir),
        `registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`,
        "utf8",
      );
      await writeFile(
        lockPath(dir),
        JSON.stringify(
          {
            version: 1,
            skills: {
              alpha: {
                registryCommit: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
                skillPath: "registry/alpha",
                ref: "refs/heads/main",
              },
            },
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { runList } = await import("./commands/list.js");
      await runList(dir);
      const joined = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(joined).toContain("alpha");
      expect(joined).toContain("deadbee");
      expect(joined).toContain("registry/alpha");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runDoctor flags old Node versions", async () => {
    const origNode = process.versions.node;
    Object.defineProperty(process.versions, "node", { value: "20.0.0", configurable: true });
    const dir = await mkdtemp(join(tmpdir(), "skissue-cmd-"));
    try {
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(
        configPath(dir),
        `registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`,
        "utf8",
      );
      vi.doMock("./git/registry-repo.js", () => ({
        ensureRegistryCheckout: vi.fn().mockResolvedValue({
          path: "/r",
          head: "a".repeat(40),
        }),
        resolveRegistryTransport: vi.fn().mockReturnValue("https"),
      }));
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { runDoctor } = await import("./commands/doctor.js");
      await runDoctor(dir);
      const line = String(logSpy.mock.calls[0]?.[0] ?? "");
      expect(line).toMatch(/✗/);
      expect(line).toMatch(/24/);
    } finally {
      Object.defineProperty(process.versions, "node", { value: origNode, configurable: true });
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runDoctor succeeds with mocked registry checkout", async () => {
    vi.doMock("./git/registry-repo.js", () => ({
      ensureRegistryCheckout: vi.fn().mockResolvedValue({
        path: "/tmp/registry",
        head: "abcd1234abcd1234abcd1234abcd1234abcd1234",
      }),
      resolveRegistryTransport: vi.fn().mockReturnValue("ssh"),
    }));
    const dir = await mkdtemp(join(tmpdir(), "skissue-cmd-"));
    try {
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(
        configPath(dir),
        `registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`,
        "utf8",
      );
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { runDoctor } = await import("./commands/doctor.js");
      await runDoctor(dir);
      const text = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(text).toMatch(/config\.yaml valid/);
      expect(text).toMatch(/Registry cache/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runDoctor sets exitCode when config is invalid", async () => {
    const prev = process.exitCode;
    const dir = await mkdtemp(join(tmpdir(), "skissue-cmd-"));
    try {
      process.exitCode = 0;
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(configPath(dir), "registry: {}\n", "utf8");
      vi.spyOn(console, "log").mockImplementation(() => {});
      const { runDoctor } = await import("./commands/doctor.js");
      await runDoctor(dir);
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = prev;
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runDoctor sets exitCode when ensureRegistryCheckout throws", async () => {
    vi.doMock("./git/registry-repo.js", () => ({
      ensureRegistryCheckout: vi.fn().mockRejectedValue(new Error("no registry")),
      resolveRegistryTransport: vi.fn().mockReturnValue("https"),
    }));
    const prev = process.exitCode;
    const dir = await mkdtemp(join(tmpdir(), "skissue-cmd-"));
    try {
      process.exitCode = 0;
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(
        configPath(dir),
        `registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`,
        "utf8",
      );
      vi.spyOn(console, "log").mockImplementation(() => {});
      const { runDoctor } = await import("./commands/doctor.js");
      await runDoctor(dir);
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = prev;
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runDefault calls runInit then runManage when needsSetup", async () => {
    const runInit = vi.fn().mockResolvedValue(undefined);
    const runManage = vi.fn().mockResolvedValue(undefined);
    vi.doMock("./config.js", async (importOriginal) => {
      const mod = await importOriginal<typeof import("./config.js")>();
      return { ...mod, needsSetup: vi.fn().mockResolvedValue(true) };
    });
    vi.doMock("./commands/init.js", () => ({ runInit }));
    vi.doMock("./commands/manage.js", () => ({ runManage }));
    const dir = await mkdtemp(join(tmpdir(), "skissue-cmd-"));
    try {
      const { runDefault } = await import("./commands/default.js");
      await runDefault(dir);
      expect(runInit).toHaveBeenCalledWith(dir);
      expect(runManage).toHaveBeenCalledWith(dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runDefault calls only runManage when configured", async () => {
    const runInit = vi.fn().mockResolvedValue(undefined);
    const runManage = vi.fn().mockResolvedValue(undefined);
    vi.doMock("./config.js", async (importOriginal) => {
      const mod = await importOriginal<typeof import("./config.js")>();
      return { ...mod, needsSetup: vi.fn().mockResolvedValue(false) };
    });
    vi.doMock("./commands/init.js", () => ({ runInit }));
    vi.doMock("./commands/manage.js", () => ({ runManage }));
    const dir = await mkdtemp(join(tmpdir(), "skissue-cmd-"));
    try {
      const { runDefault } = await import("./commands/default.js");
      await runDefault(dir);
      expect(runInit).not.toHaveBeenCalled();
      expect(runManage).toHaveBeenCalledWith(dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runUninstall removes skill dir and updates lock", async () => {
    vi.doMock("ora", () => ({
      default: () => ({
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail: vi.fn(),
        stopAndPersist: vi.fn(),
      }),
    }));
    const dir = await mkdtemp(join(tmpdir(), "skissue-cmd-"));
    try {
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(
        configPath(dir),
        `registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`,
        "utf8",
      );
      const dest = skillInstallPath(dir, ".agents/skills", "alpha");
      await mkdir(join(dest, "x"), { recursive: true });
      await writeFile(
        lockPath(dir),
        JSON.stringify(
          {
            version: 1,
            skills: {
              alpha: {
                registryCommit: "a",
                skillPath: "registry/alpha",
                ref: "refs/heads/main",
              },
            },
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );
      const { runUninstall } = await import("./commands/uninstall.js");
      await runUninstall(dir, "alpha");
      const lockRaw = await readFile(lockPath(dir), "utf8");
      expect(JSON.parse(lockRaw).skills.alpha).toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runUninstall fails when rm throws", async () => {
    vi.doMock("ora", () => ({
      default: () => ({
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail: vi.fn(),
        stopAndPersist: vi.fn(),
      }),
    }));
    vi.doMock("node:fs/promises", async (importOriginal) => {
      const orig = await importOriginal<typeof import("node:fs/promises")>();
      return {
        ...orig,
        rm: vi.fn().mockRejectedValue(new Error("cannot remove")),
      };
    });
    const dir = await mkdtemp(join(tmpdir(), "skissue-cmd-"));
    try {
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(
        configPath(dir),
        `registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`,
        "utf8",
      );
      await writeFile(
        lockPath(dir),
        JSON.stringify(
          {
            version: 1,
            skills: {
              alpha: {
                registryCommit: "a",
                skillPath: "registry/alpha",
                ref: "refs/heads/main",
              },
            },
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );
      const { runUninstall } = await import("./commands/uninstall.js");
      await expect(runUninstall(dir, "alpha")).rejects.toThrow(/cannot remove/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runUninstall stringifies non-Error rm failures", async () => {
    const fail = vi.fn();
    vi.doMock("ora", () => ({
      default: () => ({
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail,
        stopAndPersist: vi.fn(),
      }),
    }));
    vi.doMock("node:fs/promises", async (importOriginal) => {
      const orig = await importOriginal<typeof import("node:fs/promises")>();
      return {
        ...orig,
        rm: vi.fn().mockRejectedValue("not-error"),
      };
    });
    const dir = await mkdtemp(join(tmpdir(), "skissue-cmd-"));
    try {
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(
        configPath(dir),
        `registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`,
        "utf8",
      );
      await writeFile(
        lockPath(dir),
        JSON.stringify(
          {
            version: 1,
            skills: {
              alpha: {
                registryCommit: "a",
                skillPath: "registry/alpha",
                ref: "refs/heads/main",
              },
            },
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );
      const { runUninstall } = await import("./commands/uninstall.js");
      await expect(runUninstall(dir, "alpha")).rejects.toBe("not-error");
      expect(fail).toHaveBeenCalled();
      expect(String(fail.mock.calls[0]?.[0])).toContain("not-error");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runUninstall warns when lock entry missing", async () => {
    const persist = vi.fn();
    vi.doMock("ora", () => ({
      default: () => ({
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail: vi.fn(),
        stopAndPersist: persist,
      }),
    }));
    const dir = await mkdtemp(join(tmpdir(), "skissue-cmd-"));
    try {
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(
        configPath(dir),
        `registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`,
        "utf8",
      );
      await writeFile(
        lockPath(dir),
        JSON.stringify({ version: 1, skills: {} }, null, 2) + "\n",
        "utf8",
      );
      const { runUninstall } = await import("./commands/uninstall.js");
      await runUninstall(dir, "ghost");
      expect(persist).toHaveBeenCalled();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runOutdated prints nothing installed when lock empty", async () => {
    vi.doMock("ora", () => ({
      default: () => ({
        start: vi.fn().mockReturnThis(),
        stop: vi.fn(),
        fail: vi.fn(),
      }),
    }));
    const dir = await mkdtemp(join(tmpdir(), "skissue-cmd-"));
    try {
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(
        configPath(dir),
        `registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`,
        "utf8",
      );
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { runOutdated } = await import("./commands/outdated.js");
      await runOutdated(dir);
      expect(String(logSpy.mock.calls[0]?.[0])).toMatch(/Nothing installed/i);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runOutdated compares skills with mocked checkout", async () => {
    vi.doMock("ora", () => ({
      default: () => ({
        start: vi.fn().mockReturnThis(),
        stop: vi.fn(),
        fail: vi.fn(),
      }),
    }));
    vi.doMock("./git/registry-repo.js", () => ({
      ensureRegistryCheckout: vi
        .fn()
        .mockResolvedValue({ path: "/r", head: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }),
      isSkillPathStaleAtHead: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false),
    }));
    const dir = await mkdtemp(join(tmpdir(), "skissue-cmd-"));
    try {
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(
        configPath(dir),
        `registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`,
        "utf8",
      );
      await writeFile(
        lockPath(dir),
        JSON.stringify(
          {
            version: 1,
            skills: {
              stale: {
                registryCommit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                skillPath: "registry/stale",
                ref: "refs/heads/main",
              },
              fresh: {
                registryCommit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                skillPath: "registry/fresh",
                ref: "refs/heads/main",
              },
            },
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { runOutdated } = await import("./commands/outdated.js");
      await runOutdated(dir);
      const text = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(text).toMatch(/OUTDATED/);
      expect(text).toMatch(/fresh/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runOutdated sets exitCode on checkout failure", async () => {
    vi.doMock("ora", () => ({
      default: () => ({
        start: vi.fn().mockReturnThis(),
        stop: vi.fn(),
        fail: vi.fn(),
      }),
    }));
    vi.doMock("./git/registry-repo.js", () => ({
      ensureRegistryCheckout: vi.fn().mockRejectedValue(new Error("fetch failed")),
      isSkillPathStaleAtHead: vi.fn(),
    }));
    const prev = process.exitCode;
    const dir = await mkdtemp(join(tmpdir(), "skissue-cmd-"));
    try {
      process.exitCode = 0;
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(
        configPath(dir),
        `registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`,
        "utf8",
      );
      await writeFile(
        lockPath(dir),
        JSON.stringify(
          {
            version: 1,
            skills: {
              a: {
                registryCommit: "a",
                skillPath: "registry/a",
                ref: "refs/heads/main",
              },
            },
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );
      const { runOutdated } = await import("./commands/outdated.js");
      await runOutdated(dir);
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = prev;
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runOutdated stringifies non-Error checkout failures", async () => {
    vi.doMock("ora", () => ({
      default: () => ({
        start: vi.fn().mockReturnThis(),
        stop: vi.fn(),
        fail: vi.fn(),
      }),
    }));
    vi.doMock("./git/registry-repo.js", () => ({
      ensureRegistryCheckout: vi.fn().mockRejectedValue("net-down"),
      isSkillPathStaleAtHead: vi.fn(),
    }));
    const prev = process.exitCode;
    const dir = await mkdtemp(join(tmpdir(), "skissue-cmd-"));
    try {
      process.exitCode = 0;
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(
        configPath(dir),
        `registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`,
        "utf8",
      );
      await writeFile(
        lockPath(dir),
        JSON.stringify(
          {
            version: 1,
            skills: {
              a: {
                registryCommit: "a",
                skillPath: "registry/a",
                ref: "refs/heads/main",
              },
            },
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );
      const { runOutdated } = await import("./commands/outdated.js");
      await runOutdated(dir);
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = prev;
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runUpdate handles empty lock and unknown skill", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skissue-cmd-"));
    try {
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(
        configPath(dir),
        `registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`,
        "utf8",
      );
      await writeFile(
        lockPath(dir),
        JSON.stringify({ version: 1, skills: {} }, null, 2) + "\n",
        "utf8",
      );
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const prev = process.exitCode;
      process.exitCode = 0;
      const { runUpdate } = await import("./commands/update.js");
      await runUpdate(dir);
      expect(String(logSpy.mock.calls[0]?.[0])).toMatch(/Nothing to update/i);

      await runUpdate(dir, "nope");
      expect(errSpy).toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
      process.exitCode = prev;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runUpdate calls runInstallMany for all ids", async () => {
    const runInstallMany = vi.fn().mockResolvedValue(undefined);
    vi.doMock("./commands/install.js", () => ({
      runInstall: vi.fn(),
      runInstallMany,
    }));
    const dir = await mkdtemp(join(tmpdir(), "skissue-cmd-"));
    try {
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(
        configPath(dir),
        `registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`,
        "utf8",
      );
      await writeFile(
        lockPath(dir),
        JSON.stringify(
          {
            version: 1,
            skills: {
              a: { registryCommit: "x", skillPath: "registry/a", ref: "refs/heads/main" },
              b: { registryCommit: "y", skillPath: "registry/b", ref: "refs/heads/main" },
            },
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );
      const { runUpdate } = await import("./commands/update.js");
      await runUpdate(dir);
      expect(runInstallMany).toHaveBeenCalledWith(dir, ["a", "b"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runUpdate sets exitCode when runInstall throws", async () => {
    vi.doMock("./commands/install.js", () => ({
      runInstall: vi.fn().mockRejectedValue(new Error("install failed")),
      runInstallMany: vi.fn(),
    }));
    const prev = process.exitCode;
    const dir = await mkdtemp(join(tmpdir(), "skissue-cmd-"));
    try {
      process.exitCode = 0;
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(
        configPath(dir),
        `registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`,
        "utf8",
      );
      await writeFile(
        lockPath(dir),
        JSON.stringify(
          {
            version: 1,
            skills: {
              z: { registryCommit: "z", skillPath: "registry/z", ref: "refs/heads/main" },
            },
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );
      const { runUpdate } = await import("./commands/update.js");
      await runUpdate(dir, "z");
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = prev;
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runUpdate leaves exit clean when runInstall succeeds for one skill", async () => {
    vi.doMock("./commands/install.js", () => ({
      runInstall: vi.fn().mockResolvedValue(undefined),
      runInstallMany: vi.fn(),
    }));
    const prev = process.exitCode;
    const dir = await mkdtemp(join(tmpdir(), "skissue-cmd-"));
    try {
      process.exitCode = 0;
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(
        configPath(dir),
        `registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`,
        "utf8",
      );
      await writeFile(
        lockPath(dir),
        JSON.stringify(
          {
            version: 1,
            skills: {
              z: { registryCommit: "z", skillPath: "registry/z", ref: "refs/heads/main" },
            },
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );
      vi.resetModules();
      const { runUpdate } = await import("./commands/update.js");
      await runUpdate(dir, "z");
      expect(process.exitCode).toBe(0);
    } finally {
      vi.doUnmock("./commands/install.js");
      vi.resetModules();
      process.exitCode = prev;
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runUpdate sets exitCode when runInstall rejects with a non-Error", async () => {
    vi.doMock("./commands/install.js", () => ({
      runInstall: vi.fn().mockRejectedValue("single-fail"),
      runInstallMany: vi.fn(),
    }));
    const prev = process.exitCode;
    const dir = await mkdtemp(join(tmpdir(), "skissue-cmd-"));
    try {
      process.exitCode = 0;
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(
        configPath(dir),
        `registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`,
        "utf8",
      );
      await writeFile(
        lockPath(dir),
        JSON.stringify(
          {
            version: 1,
            skills: {
              z: { registryCommit: "z", skillPath: "registry/z", ref: "refs/heads/main" },
            },
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );
      const { runUpdate } = await import("./commands/update.js");
      await runUpdate(dir, "z");
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = prev;
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runUpdate sets exitCode when runInstallMany throws", async () => {
    vi.doMock("./commands/install.js", () => ({
      runInstall: vi.fn(),
      runInstallMany: vi.fn().mockRejectedValue(new Error("batch failed")),
    }));
    const prev = process.exitCode;
    const dir = await mkdtemp(join(tmpdir(), "skissue-cmd-"));
    try {
      process.exitCode = 0;
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(
        configPath(dir),
        `registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`,
        "utf8",
      );
      await writeFile(
        lockPath(dir),
        JSON.stringify(
          {
            version: 1,
            skills: {
              q: { registryCommit: "q", skillPath: "registry/q", ref: "refs/heads/main" },
            },
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );
      const { runUpdate } = await import("./commands/update.js");
      await runUpdate(dir);
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = prev;
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runInstallMany prep fails when ensureRegistryCheckout rejects", async () => {
    vi.doMock("ora", () => ({
      default: () => ({
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail: vi.fn(),
      }),
    }));
    vi.doMock("./git/registry-repo.js", () => ({
      ensureRegistryCheckout: vi.fn().mockRejectedValue(new Error("offline")),
    }));
    const dir = await mkdtemp(join(tmpdir(), "skissue-cmd-"));
    try {
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(
        configPath(dir),
        `registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`,
        "utf8",
      );
      const { runInstallMany } = await import("./commands/install.js");
      await expect(runInstallMany(dir, ["a"])).rejects.toThrow(/offline/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runInstall fails when skill path has no SKILL.md", async () => {
    const fail = vi.fn();
    vi.doMock("ora", () => ({
      default: () => ({
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail,
      }),
    }));
    const regRoot = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    const dir = await mkdtemp(join(tmpdir(), "skissue-cons-"));
    try {
      await writeFile(join(regRoot, "registry.json"), "{}\n", "utf8");
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(
        configPath(dir),
        `registry:
  path: ${JSON.stringify(regRoot)}
  branch: main
skillsRoot: .agents/skills
`,
        "utf8",
      );
      vi.doMock("./git/registry-repo.js", () => ({
        ensureRegistryCheckout: vi.fn().mockResolvedValue({
          path: regRoot,
          head: "0".repeat(40),
        }),
      }));
      const { runInstall } = await import("./commands/install.js");
      await expect(runInstall(dir, "missing-skill")).rejects.toThrow();
      expect(fail).toHaveBeenCalled();
    } finally {
      await rm(regRoot, { recursive: true, force: true });
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runInstall copies skill and writes lock (mocked registry checkout + ora)", async () => {
    vi.doMock("ora", () => ({
      default: () => ({
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail: vi.fn(),
      }),
    }));
    const regRoot = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    const dir = await mkdtemp(join(tmpdir(), "skissue-cons-"));
    try {
      await writeFile(
        join(regRoot, "registry.json"),
        JSON.stringify({ skills: { cool: "registry/cool" } }, null, 2) + "\n",
        "utf8",
      );
      await mkdir(join(regRoot, "registry", "cool"), { recursive: true });
      await writeFile(
        join(regRoot, "registry", "cool", "SKILL.md"),
        "---\nname: cool\n---\n",
        "utf8",
      );
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(
        configPath(dir),
        `registry:
  path: ${JSON.stringify(regRoot)}
  branch: main
skillsRoot: .agents/skills
`,
        "utf8",
      );
      vi.doMock("./git/registry-repo.js", () => ({
        ensureRegistryCheckout: vi.fn().mockResolvedValue({
          path: regRoot,
          head: "0123456789abcdef0123456789abcdef01234567",
        }),
      }));
      const { runInstall } = await import("./commands/install.js");
      await runInstall(dir, "cool");
      const lockRaw = await readFile(lockPath(dir), "utf8");
      const lock = JSON.parse(lockRaw) as { skills: { cool: { skillPath: string; ref: string } } };
      expect(lock.skills.cool.skillPath).toBe("registry/cool");
      expect(lock.skills.cool.ref).toBe("local");
      expect(await readFile(join(dir, ".agents", "skills", "cool", "SKILL.md"), "utf8")).toContain(
        "name: cool",
      );
    } finally {
      await rm(regRoot, { recursive: true, force: true });
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runManage warns when update chosen with nothing installed", async () => {
    const warn = vi.fn();
    vi.doMock("@clack/prompts", () => ({
      intro: vi.fn(),
      outro: vi.fn(),
      log: { info: vi.fn(), message: vi.fn(), warn, error: vi.fn() },
      spinner: () => ({ start: vi.fn(), stop: vi.fn() }),
      select: vi.fn().mockResolvedValueOnce("update").mockResolvedValueOnce("done"),
      isCancel: () => false,
    }));
    vi.doMock("./git/registry-repo.js", () => ({
      ensureRegistryCheckout: vi.fn().mockResolvedValue({
        path: "/tmp/registry",
        head: "0123456789abcdef0123456789abcdef01234567",
      }),
    }));
    vi.doMock("./registry/catalog.js", () => ({
      listRegistrySkillIds: vi.fn().mockResolvedValue(["only-catalog"]),
    }));
    const dir = await mkdtemp(join(tmpdir(), "skissue-cmd-"));
    try {
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(
        configPath(dir),
        `registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`,
        "utf8",
      );
      await writeFile(
        lockPath(dir),
        JSON.stringify({ version: 1, skills: {} }, null, 2) + "\n",
        "utf8",
      );
      vi.spyOn(console, "log").mockImplementation(() => {});
      const { runManage } = await import("./commands/manage.js");
      await runManage(dir);
      expect(warn).toHaveBeenCalled();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runManage finishes when user selects done (mocked clack)", async () => {
    const checkout = {
      path: "/tmp/registry",
      head: "0123456789abcdef0123456789abcdef01234567",
    };
    vi.doMock("@clack/prompts", () => ({
      intro: vi.fn(),
      outro: vi.fn(),
      log: { info: vi.fn(), message: vi.fn(), warn: vi.fn(), error: vi.fn() },
      spinner: () => ({ start: vi.fn(), stop: vi.fn() }),
      select: vi.fn().mockResolvedValue("done"),
      isCancel: () => false,
    }));
    vi.doMock("./git/registry-repo.js", () => ({
      ensureRegistryCheckout: vi.fn().mockResolvedValue(checkout),
    }));
    vi.doMock("./registry/catalog.js", () => ({
      listRegistrySkillIds: vi.fn().mockResolvedValue(["alpha", "beta"]),
    }));
    const dir = await mkdtemp(join(tmpdir(), "skissue-cmd-"));
    try {
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(
        configPath(dir),
        `registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`,
        "utf8",
      );
      vi.spyOn(console, "log").mockImplementation(() => {});
      const { runManage } = await import("./commands/manage.js");
      await runManage(dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runInstallMany uses checkout option without second ensureRegistryCheckout", async () => {
    const ensureRegistryCheckout = vi.fn();
    vi.doMock("ora", () => ({
      default: () => ({
        start: vi.fn().mockReturnThis(),
        succeed: vi.fn(),
        fail: vi.fn(),
      }),
    }));
    vi.doMock("./git/registry-repo.js", () => ({ ensureRegistryCheckout }));
    const regRoot = await mkdtemp(join(tmpdir(), "skissue-reg-"));
    const dir = await mkdtemp(join(tmpdir(), "skissue-cons-"));
    try {
      await writeFile(
        join(regRoot, "registry.json"),
        JSON.stringify({ skills: { s1: "registry/s1" } }, null, 2) + "\n",
        "utf8",
      );
      await mkdir(join(regRoot, "registry", "s1"), { recursive: true });
      await writeFile(join(regRoot, "registry", "s1", "SKILL.md"), "---\nname: s1\n---\n", "utf8");
      await mkdir(skillIssueDir(dir), { recursive: true });
      await writeFile(
        configPath(dir),
        `registry:
  path: ${JSON.stringify(regRoot)}
  branch: main
skillsRoot: .agents/skills
`,
        "utf8",
      );
      const { runInstallMany } = await import("./commands/install.js");
      await runInstallMany(dir, ["s1"], {
        checkout: { path: regRoot, head: "1111111111111111111111111111111111111111" },
      });
      expect(ensureRegistryCheckout).not.toHaveBeenCalled();
    } finally {
      await rm(regRoot, { recursive: true, force: true });
      await rm(dir, { recursive: true, force: true });
    }
  });
});
