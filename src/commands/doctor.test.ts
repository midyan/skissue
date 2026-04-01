import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  ensureRegistryCheckout: vi.fn(),
}));

vi.mock("../git/registry-repo.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../git/registry-repo.js")>();
  return { ...actual, ensureRegistryCheckout: hoisted.ensureRegistryCheckout };
});

describe("runDoctor", () => {
  let nodeVerDesc: PropertyDescriptor | undefined;

  beforeEach(() => {
    process.exitCode = 0;
    hoisted.ensureRegistryCheckout.mockReset();
    hoisted.ensureRegistryCheckout.mockResolvedValue({
      path: "/registry/cache",
      head: "aaaabbbbccccddddeeeeffffaaaabbbbccccdddd",
    });
  });

  afterEach(() => {
    if (nodeVerDesc) {
      Object.defineProperty(process.versions, "node", nodeVerDesc);
    } else {
      Reflect.deleteProperty(process.versions, "node");
    }
    vi.restoreAllMocks();
  });

  async function writeRemoteConfig(cwd: string, extra: string): Promise<void> {
    await mkdir(join(cwd, ".skill-issue"), { recursive: true });
    await writeFile(
      join(cwd, ".skill-issue", "config.yaml"),
      `registry:
  owner: acme
  repo: skills
  branch: main
${extra}skillsRoot: .agents/skills
`,
      "utf8",
    );
  }

  it("flags Node when major version is below 24", async () => {
    nodeVerDesc = Object.getOwnPropertyDescriptor(process.versions, "node");
    Object.defineProperty(process.versions, "node", {
      configurable: true,
      writable: true,
      value: "20.10.0",
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { runDoctor } = await import("./doctor.js");
    await runDoctor(process.cwd());
    expect(logSpy.mock.calls.some((c) => String(c[0]).includes("✗"))).toBe(true);
  });

  it("stringifies non-Error config load failures", async () => {
    vi.doMock("../config.js", async (importOriginal) => {
      const o = await importOriginal<typeof import("../config.js")>();
      return { ...o, loadConfig: vi.fn().mockRejectedValue("not-an-error") };
    });
    vi.resetModules();
    const cwd = await mkdtemp(join(tmpdir(), "skissue-doc-"));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const { runDoctor } = await import("./doctor.js");
      await runDoctor(cwd);
      expect(process.exitCode).toBe(1);
      expect(logSpy.mock.calls.some((c) => String(c[0]).includes("not-an-error"))).toBe(true);
    } finally {
      vi.doUnmock("../config.js");
      vi.resetModules();
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("reports invalid config and sets exitCode", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "skissue-doc-"));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await mkdir(join(cwd, ".skill-issue"), { recursive: true });
      await writeFile(join(cwd, ".skill-issue", "config.yaml"), "not: yaml: [[\n", "utf8");
      const { runDoctor } = await import("./doctor.js");
      await runDoctor(cwd);
      expect(process.exitCode).toBe(1);
      expect(logSpy.mock.calls.some((c) => String(c[0]).includes("config"))).toBe(true);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("reports registry sync failure", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "skissue-doc-"));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await writeRemoteConfig(cwd, "  useSsh: true\n");
      hoisted.ensureRegistryCheckout.mockRejectedValueOnce(new Error("no net"));
      const { runDoctor } = await import("./doctor.js");
      await runDoctor(cwd);
      expect(process.exitCode).toBe(1);
      expect(logSpy.mock.calls.some((c) => String(c[0]).includes("Registry"))).toBe(true);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("stringifies non-Error registry checkout failures", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "skissue-doc-"));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await writeRemoteConfig(cwd, "  useSsh: true\n");
      hoisted.ensureRegistryCheckout.mockRejectedValueOnce("offline-string");
      const { runDoctor } = await import("./doctor.js");
      await runDoctor(cwd);
      expect(process.exitCode).toBe(1);
      expect(logSpy.mock.calls.some((c) => String(c[0]).includes("offline-string"))).toBe(true);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("prints SSH auth hint for remote registry", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "skissue-doc-"));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await writeRemoteConfig(cwd, "  useSsh: true\n");
      nodeVerDesc = Object.getOwnPropertyDescriptor(process.versions, "node");
      Object.defineProperty(process.versions, "node", {
        configurable: true,
        writable: true,
        value: "24.0.0",
      });
      const { runDoctor } = await import("./doctor.js");
      await runDoctor(cwd);
      const joined = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(joined).toMatch(/ssh/i);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("prints HTTPS token hint when GITHUB_TOKEN is set", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "skissue-doc-"));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const prev = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "tok";
    try {
      await writeRemoteConfig(cwd, "  useSsh: false\n");
      nodeVerDesc = Object.getOwnPropertyDescriptor(process.versions, "node");
      Object.defineProperty(process.versions, "node", {
        configurable: true,
        writable: true,
        value: "24.0.0",
      });
      const { runDoctor } = await import("./doctor.js");
      await runDoctor(cwd);
      const joined = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(joined).toMatch(/GITHUB_TOKEN/);
    } finally {
      if (prev === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = prev;
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("prints public HTTPS hint when no token and useSsh false", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "skissue-doc-"));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const prevG = process.env.GITHUB_TOKEN;
    const prevH = process.env.GH_TOKEN;
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    try {
      await writeRemoteConfig(cwd, "  useSsh: false\n");
      nodeVerDesc = Object.getOwnPropertyDescriptor(process.versions, "node");
      Object.defineProperty(process.versions, "node", {
        configurable: true,
        writable: true,
        value: "24.0.0",
      });
      const { runDoctor } = await import("./doctor.js");
      await runDoctor(cwd);
      const joined = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(joined).toMatch(/Public repos only|HTTPS without a token/);
    } finally {
      if (prevG === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = prevG;
      if (prevH === undefined) delete process.env.GH_TOKEN;
      else process.env.GH_TOKEN = prevH;
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("skips auth hint line for local registry", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "skissue-doc-"));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
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
      nodeVerDesc = Object.getOwnPropertyDescriptor(process.versions, "node");
      Object.defineProperty(process.versions, "node", {
        configurable: true,
        writable: true,
        value: "24.0.0",
      });
      const { runDoctor } = await import("./doctor.js");
      await runDoctor(cwd);
      const dimLines = logSpy.mock.calls.filter((c) => String(c[0]).includes("•"));
      expect(dimLines.length).toBe(0);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
