import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../config.js";
import { parseConfigYaml } from "../config.js";
import {
  isPathStale,
  registryCacheDir,
  registryGitUrl,
  resolveRegistryTransport,
} from "./registry-repo.js";

describe("registryGitUrl", () => {
  const saved = { g: process.env.GITHUB_TOKEN, h: process.env.GH_TOKEN };

  afterEach(() => {
    if (saved.g === undefined) {
      delete process.env.GITHUB_TOKEN;
    } else {
      process.env.GITHUB_TOKEN = saved.g;
    }
    if (saved.h === undefined) {
      delete process.env.GH_TOKEN;
    } else {
      process.env.GH_TOKEN = saved.h;
    }
  });

  it("uses git@github.com when useSsh is true", () => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    const cfg = parseConfigYaml(`
registry:
  owner: acme
  repo: skills
  branch: main
  useSsh: true
skillsRoot: .agents/skills
`);
    expect(registryGitUrl(cfg)).toBe("git@github.com:acme/skills.git");
  });

  it("uses HTTPS when useSsh is false", () => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    const cfg = parseConfigYaml(`
registry:
  owner: acme
  repo: skills
  branch: main
  useSsh: false
skillsRoot: .agents/skills
`);
    expect(registryGitUrl(cfg)).toBe("https://github.com/acme/skills.git");
  });

  it("auto: SSH when useSsh omitted and no token in env", () => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    const cfg = parseConfigYaml(`
registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`);
    expect(registryGitUrl(cfg)).toBe("git@github.com:acme/skills.git");
  });

  it("auto: HTTPS with token when useSsh omitted and GITHUB_TOKEN set", () => {
    process.env.GITHUB_TOKEN = "ghp_testtoken";
    delete process.env.GH_TOKEN;
    const cfg = parseConfigYaml(`
registry:
  owner: acme
  repo: skills
  branch: main
skillsRoot: .agents/skills
`);
    expect(registryGitUrl(cfg)).toBe(
      "https://x-access-token:ghp_testtoken@github.com/acme/skills.git",
    );
  });
});

describe("isPathStale", () => {
  it("treats empty diff as up to date", () => {
    expect(isPathStale("")).toBe(false);
    expect(isPathStale("  \n")).toBe(false);
  });

  it("treats non-empty diff as stale", () => {
    expect(isPathStale("diff --git a/foo b/foo")).toBe(true);
  });
});

describe("resolveRegistryTransport / registryCacheDir", () => {
  it("local registry resolves to https", () => {
    const cfg = parseConfigYaml(`
registry:
  path: ../r
  branch: main
skillsRoot: .agents/skills
`);
    expect(resolveRegistryTransport(cfg)).toBe("https");
  });

  it("honors useSsh true/false for remote", () => {
    const ssh = parseConfigYaml(`
registry:
  owner: a
  repo: b
  branch: main
  useSsh: true
skillsRoot: .agents/skills
`);
    expect(resolveRegistryTransport(ssh)).toBe("ssh");
    const https = parseConfigYaml(`
registry:
  owner: a
  repo: b
  branch: main
  useSsh: false
skillsRoot: .agents/skills
`);
    expect(resolveRegistryTransport(https)).toBe("https");
  });

  it("registryCacheDir is stable for same owner/repo/transport", () => {
    const cfg = parseConfigYaml(`
registry:
  owner: acme
  repo: skills
  branch: main
  useSsh: true
skillsRoot: .agents/skills
`);
    expect(registryCacheDir(cfg)).toBe(registryCacheDir(cfg));
  });

  it("registryCacheDir hashes when owner/repo are undefined", () => {
    const cfg = {
      registry: { branch: "main" },
      skillsRoot: ".agents/skills",
    } as Config;
    expect(registryCacheDir(cfg)).toMatch(/registries[/\\][a-f0-9]{16}$/);
  });
});

describe("ensureRegistryCheckout (mocked execGit)", () => {
  const execGit = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.doMock("./exec.js", () => ({ execGit }));
  });

  afterEach(() => {
    vi.doUnmock("./exec.js");
    vi.resetModules();
    execGit.mockReset();
  });

  it("throws when local path is missing", async () => {
    const { ensureRegistryCheckout: checkout } = await import("./registry-repo.js");
    const cwd = await mkdtemp(join(tmpdir(), "skissue-erc-"));
    const missing = join(cwd, "nope");
    const cfg = parseConfigYaml(`
registry:
  path: ${JSON.stringify(missing)}
  branch: main
skillsRoot: .agents/skills
`);
    try {
      await expect(checkout(cwd, cfg)).rejects.toThrow(/does not exist/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("throws when local path has no registry layout", async () => {
    const { ensureRegistryCheckout: checkout } = await import("./registry-repo.js");
    const root = await mkdtemp(join(tmpdir(), "skissue-erc-"));
    const cfg = parseConfigYaml(`
registry:
  path: ${JSON.stringify(root)}
  branch: main
skillsRoot: .agents/skills
`);
    try {
      await expect(checkout(root, cfg)).rejects.toThrow(/registry\.json/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("syncs local registry and warns when pull fails with empty stderr and stdout", async () => {
    const { ensureRegistryCheckout: checkout } = await import("./registry-repo.js");
    const root = await mkdtemp(join(tmpdir(), "skissue-erc-"));
    const cwd = await mkdtemp(join(tmpdir(), "skissue-erc-cwd-"));
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      await writeFile(join(root, "registry.json"), "{}\n", "utf8");
      execGit.mockImplementation((args: string[]) => {
        if (args[0] === "rev-parse" && args[1] === "HEAD") {
          return Promise.resolve({ code: 0, stdout: "aaa\n", stderr: "" });
        }
        if (args[0] === "pull") {
          return Promise.resolve({ code: 2, stderr: "", stdout: "" });
        }
        return Promise.resolve({ code: 1, stdout: "", stderr: "?" });
      });
      const r = await checkout(
        cwd,
        parseConfigYaml(`
registry:
  path: ${JSON.stringify(root)}
  branch: main
skillsRoot: .agents/skills
`),
      );
      expect(r.head).toBe("aaa");
      expect(stderrSpy).toHaveBeenCalled();
    } finally {
      stderrSpy.mockRestore();
      await rm(root, { recursive: true, force: true });
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("syncs local registry and warns when pull fails", async () => {
    const { ensureRegistryCheckout: checkout } = await import("./registry-repo.js");
    const root = await mkdtemp(join(tmpdir(), "skissue-erc-"));
    const cwd = await mkdtemp(join(tmpdir(), "skissue-erc-cwd-"));
    try {
      await writeFile(join(root, "registry.json"), "{}\n", "utf8");
      execGit.mockImplementation((args: string[]) => {
        if (args[0] === "rev-parse" && args[1] === "HEAD") {
          return Promise.resolve({
            code: 0,
            stdout: "aaaabbbbccccddddeeeeffffaaaabbbbccccdddd\n",
            stderr: "",
          });
        }
        if (args[0] === "pull") {
          return Promise.resolve({ code: 1, stderr: "cannot pull", stdout: "" });
        }
        return Promise.resolve({ code: 1, stdout: "", stderr: "unexpected" });
      });
      const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const cfg = parseConfigYaml(`
registry:
  path: ${JSON.stringify(root)}
  branch: main
skillsRoot: .agents/skills
`);
      const r = await checkout(cwd, cfg);
      expect(r.path).toBe(root);
      expect(r.head).toBe("aaaabbbbccccddddeeeeffffaaaabbbbccccdddd");
      expect(stderrSpy).toHaveBeenCalled();
      stderrSpy.mockRestore();
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("throws when local rev-parse fails", async () => {
    const { ensureRegistryCheckout: checkout } = await import("./registry-repo.js");
    const root = await mkdtemp(join(tmpdir(), "skissue-erc-"));
    const cwd = await mkdtemp(join(tmpdir(), "skissue-erc-cwd-"));
    try {
      await writeFile(join(root, "registry.json"), "{}\n", "utf8");
      execGit.mockResolvedValue({ code: 1, stdout: "", stderr: "bad" });
      const cfg = parseConfigYaml(`
registry:
  path: ${JSON.stringify(root)}
  branch: main
skillsRoot: .agents/skills
`);
      await expect(checkout(cwd, cfg)).rejects.toThrow(/git repository root/);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("clones remote when cache has no .git", async () => {
    const { ensureRegistryCheckout: checkout } = await import("./registry-repo.js");
    const cwd = await mkdtemp(join(tmpdir(), "skissue-erc-"));
    try {
      const cfg = parseConfigYaml(`
registry:
  owner: acme
  repo: skills
  branch: main
  useSsh: true
skillsRoot: .agents/skills
`);
      execGit.mockImplementation((args: string[]) => {
        if (args[0] === "clone") {
          return Promise.resolve({ code: 0, stdout: "", stderr: "" });
        }
        if (args[0] === "rev-parse") {
          return Promise.resolve({
            code: 0,
            stdout: "feedfacefeedfacefeedfacefeedfacefeedface\n",
            stderr: "",
          });
        }
        return Promise.resolve({ code: 0, stdout: "", stderr: "" });
      });
      const r = await checkout(cwd, cfg);
      expect(r.head).toContain("feedface");
      expect(execGit.mock.calls.some((c) => c[0]?.[0] === "clone")).toBe(true);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("fetch/reset path when cache already exists", async () => {
    const { ensureRegistryCheckout: checkout } = await import("./registry-repo.js");
    const cwd = await mkdtemp(join(tmpdir(), "skissue-erc-"));
    try {
      const cfg = parseConfigYaml(`
registry:
  owner: acme
  repo: skills
  branch: main
  useSsh: true
skillsRoot: .agents/skills
`);
      let call = 0;
      execGit.mockImplementation((args: string[]) => {
        if (args[0] === "fetch") {
          call += 1;
          return Promise.resolve({ code: 0, stdout: "", stderr: "" });
        }
        if (args[0] === "reset") {
          return Promise.resolve({ code: 0, stdout: "", stderr: "" });
        }
        if (args[0] === "rev-parse") {
          return Promise.resolve({
            code: 0,
            stdout: "1111111111111111111111111111111111111111\n",
            stderr: "",
          });
        }
        return Promise.resolve({ code: 1, stdout: "", stderr: "?" });
      });
      const cache = registryCacheDir(cfg);
      await mkdir(join(cache, ".git"), { recursive: true });
      const r = await checkout(cwd, cfg);
      expect(r.head).toMatch(/1111111/);
      expect(call).toBeGreaterThan(0);
      await rm(cache, { recursive: true, force: true });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("throws when git reset fails with message only on stdout", async () => {
    const { ensureRegistryCheckout: checkout } = await import("./registry-repo.js");
    const cwd = await mkdtemp(join(tmpdir(), "skissue-erc-"));
    try {
      const cfg = parseConfigYaml(`
registry:
  owner: acme
  repo: skills
  branch: main
  useSsh: true
skillsRoot: .agents/skills
`);
      execGit.mockImplementation((args: string[]) => {
        if (args[0] === "fetch") {
          return Promise.resolve({ code: 0, stdout: "", stderr: "" });
        }
        if (args[0] === "reset") {
          return Promise.resolve({ code: 1, stdout: "reset-out", stderr: "" });
        }
        if (args[0] === "rev-parse") {
          return Promise.resolve({ code: 0, stdout: "deadbeef\n", stderr: "" });
        }
        return Promise.resolve({ code: 0, stdout: "", stderr: "" });
      });
      const cache = registryCacheDir(cfg);
      await mkdir(join(cache, ".git"), { recursive: true });
      await expect(checkout(cwd, cfg)).rejects.toThrow(/reset-out/);
      await rm(cache, { recursive: true, force: true });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("throws when git reset fails after fetch", async () => {
    const { ensureRegistryCheckout: checkout } = await import("./registry-repo.js");
    const cwd = await mkdtemp(join(tmpdir(), "skissue-erc-"));
    try {
      const cfg = parseConfigYaml(`
registry:
  owner: acme
  repo: skills
  branch: main
  useSsh: true
skillsRoot: .agents/skills
`);
      execGit.mockImplementation((args: string[]) => {
        if (args[0] === "fetch") {
          return Promise.resolve({ code: 0, stdout: "", stderr: "" });
        }
        if (args[0] === "reset") {
          return Promise.resolve({ code: 1, stdout: "", stderr: "conflict" });
        }
        if (args[0] === "rev-parse") {
          return Promise.resolve({ code: 0, stdout: "x\n", stderr: "" });
        }
        return Promise.resolve({ code: 1, stdout: "", stderr: "?" });
      });
      const cache = registryCacheDir(cfg);
      await mkdir(join(cache, ".git"), { recursive: true });
      await expect(checkout(cwd, cfg)).rejects.toThrow(/git reset failed/);
      await rm(cache, { recursive: true, force: true });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("throws with hint when clone fails with timeout code", async () => {
    const { ensureRegistryCheckout: checkout } = await import("./registry-repo.js");
    const cwd = await mkdtemp(join(tmpdir(), "skissue-erc-"));
    try {
      const cfg = parseConfigYaml(`
registry:
  owner: acme
  repo: skills
  branch: main
  useSsh: true
skillsRoot: .agents/skills
`);
      execGit.mockImplementation((args: string[]) => {
        if (args[0] === "clone") {
          return Promise.resolve({ code: 124, stdout: "", stderr: "timeout" });
        }
        return Promise.resolve({ code: 0, stdout: "", stderr: "" });
      });
      await expect(checkout(cwd, cfg)).rejects.toThrow(/Timed out/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("throws when git fetch fails with message only on stdout", async () => {
    const { ensureRegistryCheckout: checkout } = await import("./registry-repo.js");
    const cwd = await mkdtemp(join(tmpdir(), "skissue-erc-"));
    try {
      const cfg = parseConfigYaml(`
registry:
  owner: acme
  repo: skills
  branch: main
  useSsh: true
skillsRoot: .agents/skills
`);
      execGit.mockImplementation((args: string[]) => {
        if (args[0] === "fetch") {
          return Promise.resolve({ code: 1, stdout: "fetch-msg", stderr: "" });
        }
        if (args[0] === "rev-parse") {
          return Promise.resolve({ code: 0, stdout: "deadbeef\n", stderr: "" });
        }
        return Promise.resolve({ code: 0, stdout: "", stderr: "" });
      });
      const cache = registryCacheDir(cfg);
      await mkdir(join(cache, ".git"), { recursive: true });
      await expect(checkout(cwd, cfg)).rejects.toThrow(/fetch-msg/);
      await rm(cache, { recursive: true, force: true });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("throws when git fetch fails on existing cache", async () => {
    const { ensureRegistryCheckout: checkout } = await import("./registry-repo.js");
    const cwd = await mkdtemp(join(tmpdir(), "skissue-erc-"));
    try {
      const cfg = parseConfigYaml(`
registry:
  owner: acme
  repo: skills
  branch: main
  useSsh: true
skillsRoot: .agents/skills
`);
      execGit.mockImplementation((args: string[]) => {
        if (args[0] === "fetch") {
          return Promise.resolve({ code: 1, stdout: "", stderr: "network down" });
        }
        if (args[0] === "rev-parse") {
          return Promise.resolve({ code: 0, stdout: "deadbeef\n", stderr: "" });
        }
        return Promise.resolve({ code: 0, stdout: "", stderr: "" });
      });
      const cache = registryCacheDir(cfg);
      await mkdir(join(cache, ".git"), { recursive: true });
      await expect(checkout(cwd, cfg)).rejects.toThrow(/git fetch failed/);
      await rm(cache, { recursive: true, force: true });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("throws when rev-parse fails after clone", async () => {
    const { ensureRegistryCheckout: checkout } = await import("./registry-repo.js");
    const cwd = await mkdtemp(join(tmpdir(), "skissue-erc-"));
    try {
      const cfg = parseConfigYaml(`
registry:
  owner: acme
  repo: skills
  branch: main
  useSsh: true
skillsRoot: .agents/skills
`);
      execGit.mockImplementation((args: string[]) => {
        if (args[0] === "clone") {
          return Promise.resolve({ code: 0, stdout: "", stderr: "" });
        }
        if (args[0] === "rev-parse") {
          return Promise.resolve({ code: 1, stdout: "", stderr: "no HEAD" });
        }
        return Promise.resolve({ code: 0, stdout: "", stderr: "" });
      });
      await expect(checkout(cwd, cfg)).rejects.toThrow(/git rev-parse failed/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("throws with SSH hint when clone fails with non-timeout code", async () => {
    const { ensureRegistryCheckout: checkout } = await import("./registry-repo.js");
    const cwd = await mkdtemp(join(tmpdir(), "skissue-erc-"));
    try {
      const cfg = parseConfigYaml(`
registry:
  owner: acme
  repo: skills
  branch: main
  useSsh: true
skillsRoot: .agents/skills
`);
      execGit.mockImplementation((args: string[]) => {
        if (args[0] === "clone") {
          return Promise.resolve({ code: 1, stdout: "", stderr: "not found" });
        }
        return Promise.resolve({ code: 0, stdout: "", stderr: "" });
      });
      await expect(checkout(cwd, cfg)).rejects.toThrow(/Used SSH/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("throws when clone fails with empty stderr and stdout", async () => {
    const { ensureRegistryCheckout: checkout } = await import("./registry-repo.js");
    const cwd = await mkdtemp(join(tmpdir(), "skissue-erc-"));
    try {
      const cfg = parseConfigYaml(`
registry:
  owner: acme
  repo: skills
  branch: main
  useSsh: true
skillsRoot: .agents/skills
`);
      execGit.mockImplementation((args: string[]) => {
        if (args[0] === "clone") {
          return Promise.resolve({ code: 1, stdout: "", stderr: "" });
        }
        return Promise.resolve({ code: 0, stdout: "", stderr: "" });
      });
      await expect(checkout(cwd, cfg)).rejects.toThrow(/git clone failed \(1\):/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("throws with HTTPS hint when clone fails with useSsh false", async () => {
    const { ensureRegistryCheckout: checkout } = await import("./registry-repo.js");
    const cwd = await mkdtemp(join(tmpdir(), "skissue-erc-"));
    try {
      const cfg = parseConfigYaml(`
registry:
  owner: acme
  repo: skills
  branch: main
  useSsh: false
skillsRoot: .agents/skills
`);
      execGit.mockImplementation((args: string[]) => {
        if (args[0] === "clone") {
          return Promise.resolve({ code: 1, stdout: "", stderr: "denied" });
        }
        return Promise.resolve({ code: 0, stdout: "", stderr: "" });
      });
      await expect(checkout(cwd, cfg)).rejects.toThrow(/Used HTTPS/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("throws when local registry rev-parse fails after pull", async () => {
    const { ensureRegistryCheckout: checkout } = await import("./registry-repo.js");
    const root = await mkdtemp(join(tmpdir(), "skissue-erc-"));
    const cwd = await mkdtemp(join(tmpdir(), "skissue-erc-cwd-"));
    try {
      await mkdir(join(root, ".git"), { recursive: true });
      await writeFile(join(root, "registry.json"), "{}\n", "utf8");
      let rev = 0;
      execGit.mockImplementation((args: string[]) => {
        if (args[0] === "rev-parse" && args[1] === "HEAD") {
          rev += 1;
          if (rev === 1) {
            return Promise.resolve({ code: 0, stdout: "aaa\n", stderr: "" });
          }
          return Promise.resolve({ code: 1, stdout: "", stderr: "broken" });
        }
        if (args[0] === "pull") {
          return Promise.resolve({ code: 0, stdout: "", stderr: "" });
        }
        return Promise.resolve({ code: 1, stdout: "", stderr: "?" });
      });
      const cfg = parseConfigYaml(`
registry:
  path: ${JSON.stringify(root)}
  branch: main
skillsRoot: .agents/skills
`);
      await expect(checkout(cwd, cfg)).rejects.toThrow(/rev-parse failed/);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

describe("ensureCommit / diffPath / isSkillPathStaleAtHead (mocked execGit)", () => {
  const execGit = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.doMock("./exec.js", () => ({ execGit }));
  });

  afterEach(() => {
    vi.doUnmock("./exec.js");
    vi.resetModules();
    execGit.mockReset();
  });

  it("ensureCommit returns early when cat-file succeeds", async () => {
    const { ensureCommit: ec } = await import("./registry-repo.js");
    execGit.mockResolvedValue({ code: 0, stdout: "", stderr: "" });
    await ec("/repo", "abc");
    expect(execGit).toHaveBeenCalledWith(["cat-file", "-e", "abc^{commit}"], expect.any(Object));
    expect(execGit).toHaveBeenCalledTimes(1);
  });

  it("ensureCommit fetches when object missing", async () => {
    const { ensureCommit: ec } = await import("./registry-repo.js");
    execGit
      .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "missing" })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" });
    await ec("/repo", "deadbeef");
    expect(execGit.mock.calls.some((c) => c[0]?.[0] === "fetch")).toBe(true);
  });

  it("ensureCommit uses alternate fetch when the first form fails", async () => {
    const { ensureCommit: ec } = await import("./registry-repo.js");
    execGit
      .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "no" })
      .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "first fetch bad" })
      .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" });
    await ec("/repo", "abc");
    const fetches = execGit.mock.calls.filter((c) => c[0]?.[0] === "fetch");
    expect(fetches).toHaveLength(2);
  });

  it("ensureCommit throws when fetch variants fail", async () => {
    const { ensureCommit: ec } = await import("./registry-repo.js");
    execGit
      .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "missing" })
      .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "a" })
      .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "b" });
    await expect(ec("/repo", "badsha")).rejects.toThrow(/Could not fetch commit/);
  });

  it("ensureCommit error prefers first fetch stdout when stderr is empty", async () => {
    const { ensureCommit: ec } = await import("./registry-repo.js");
    execGit
      .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "" })
      .mockResolvedValueOnce({ code: 1, stdout: "why", stderr: "" })
      .mockResolvedValueOnce({ code: 1, stdout: "nope", stderr: "" });
    await expect(ec("/repo", "abc")).rejects.toThrow(/why/);
  });

  it("diffPath returns stdout and throws on diff failure", async () => {
    const { diffPath: dp } = await import("./registry-repo.js");
    execGit.mockImplementation((args: string[]) => {
      if (args[0] === "cat-file") return Promise.resolve({ code: 0, stdout: "", stderr: "" });
      if (args[0] === "diff") {
        return Promise.resolve({ code: 0, stdout: "patch\n", stderr: "" });
      }
      return Promise.resolve({ code: 0, stdout: "", stderr: "" });
    });
    const out = await dp("/r", "a", "b", "registry/x");
    expect(out).toBe("patch\n");
    execGit.mockImplementation((args: string[]) => {
      if (args[0] === "cat-file") return Promise.resolve({ code: 0, stdout: "", stderr: "" });
      if (args[0] === "diff") return Promise.resolve({ code: 1, stdout: "", stderr: "no" });
      return Promise.resolve({ code: 0, stdout: "", stderr: "" });
    });
    await expect(dp("/r", "a", "b", "registry/x")).rejects.toThrow(/git diff failed/);
  });

  it("isSkillPathStaleAtHead delegates to diffPath", async () => {
    const { isSkillPathStaleAtHead: stale } = await import("./registry-repo.js");
    execGit.mockImplementation((args: string[]) => {
      if (args[0] === "cat-file") return Promise.resolve({ code: 0, stdout: "", stderr: "" });
      if (args[0] === "diff") return Promise.resolve({ code: 0, stdout: "x\n", stderr: "" });
      return Promise.resolve({ code: 0, stdout: "", stderr: "" });
    });
    const entry = {
      registryCommit: "a",
      skillPath: "registry/foo",
      ref: "refs/heads/main",
    };
    await expect(stale("/r", "head", entry)).resolves.toBe(true);
  });
});

describe("execGit (mocked spawn)", () => {
  const spawnMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.doMock("node:child_process", () => ({ spawn: spawnMock }));
  });

  afterEach(() => {
    vi.doUnmock("node:child_process");
    vi.resetModules();
    spawnMock.mockReset();
  });

  it("captures stdout/stderr and exit code", async () => {
    const { execGit } = await import("./exec.js");
    spawnMock.mockImplementationOnce(() => {
      const stdout = new EventEmitter();
      const stderr = new EventEmitter();
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      child.stdout = stdout;
      child.stderr = stderr;
      queueMicrotask(() => {
        stdout.emit("data", Buffer.from("hello"));
        stderr.emit("data", Buffer.from("warn"));
        child.emit("close", 0, null);
      });
      return child;
    });
    const r = await execGit(["status"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("hello");
    expect(r.stderr).toBe("warn");
    expect(spawnMock.mock.calls[0]?.[2]?.env?.GIT_TERMINAL_PROMPT).toBe("0");
  });

  it("maps SIGTERM timeout to code 124", async () => {
    const { execGit } = await import("./exec.js");
    spawnMock.mockImplementationOnce(() => {
      const stdout = new EventEmitter();
      const stderr = new EventEmitter();
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
        kill: (s: NodeJS.Signals) => void;
      };
      child.stdout = stdout;
      child.stderr = stderr;
      child.kill = vi.fn((sig: NodeJS.Signals) => {
        child.emit("close", null, sig);
      });
      return child;
    });
    const r = await execGit(["fetch"], { timeoutMs: 5 });
    expect(r.code).toBe(124);
    expect(r.stderr).toMatch(/timed out/);
  });

  it("resolves on spawn error", async () => {
    const { execGit } = await import("./exec.js");
    spawnMock.mockImplementationOnce(() => {
      const stdout = new EventEmitter();
      const stderr = new EventEmitter();
      const child = new EventEmitter() as EventEmitter & {
        stdout: EventEmitter;
        stderr: EventEmitter;
      };
      child.stdout = stdout;
      child.stderr = stderr;
      queueMicrotask(() => {
        child.emit("error", new Error("ENOENT git"));
      });
      return child;
    });
    const r = await execGit(["clone"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/ENOENT/);
  });
});
