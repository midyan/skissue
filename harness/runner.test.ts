import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fileURLToPath } from "node:url";

const hoisted = vi.hoisted(() => ({
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  existsSync: vi.fn(),
  spawnSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  readdirSync: (...args: unknown[]) => hoisted.readdirSync(...args),
  statSync: (...args: unknown[]) => hoisted.statSync(...args),
  existsSync: (...args: unknown[]) => hoisted.existsSync(...args),
}));

vi.mock("node:child_process", () => ({
  spawnSync: (...args: unknown[]) =>
    hoisted.spawnSync(...args) as ReturnType<typeof hoisted.spawnSync>,
}));

function hasHardIndex(p: string): boolean {
  const n = p.replace(/\\/g, "/");
  return n.endsWith("hard/index.ts");
}

function hasNoAutoRun(p: string): boolean {
  const n = p.replace(/\\/g, "/");
  return n.endsWith("hard/.no-auto-run");
}

describe("harness/runner", () => {
  beforeEach(() => {
    vi.resetModules();
    hoisted.readdirSync.mockReset();
    hoisted.statSync.mockReset();
    hoisted.existsSync.mockReset();
    hoisted.spawnSync.mockReset();
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function loadRunner(): Promise<void> {
    const url = fileURLToPath(new URL("./runner.ts", import.meta.url));
    await import(/* @vite-ignore */ url);
  }

  it("discovers skills, runs them, and does not exit when all pass", async () => {
    hoisted.readdirSync.mockReturnValue([
      ".hidden",
      "node_modules",
      "notdir",
      "skill-a",
      "skill-b",
    ]);
    hoisted.statSync.mockImplementation((full: string) => ({
      isDirectory: () => {
        const n = full.replace(/\\/g, "/");
        return /\/skill-a$/.test(n) || /\/skill-b$/.test(n);
      },
    }));
    hoisted.existsSync.mockImplementation((p: string) => {
      if (hasNoAutoRun(p)) return false;
      if (hasHardIndex(p)) return true;
      return false;
    });
    hoisted.spawnSync.mockReturnValue({ status: 0, stdout: "", stderr: "" });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    await loadRunner();
    expect(hoisted.spawnSync.mock.calls.length).toBe(2);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("skips harness subdirs that have no hard/index.ts", async () => {
    hoisted.readdirSync.mockReturnValue(["orphan-dir"]);
    hoisted.statSync.mockReturnValue({ isDirectory: () => true });
    hoisted.existsSync.mockImplementation(() => false);
    hoisted.spawnSync.mockReturnValue({ status: 0, stdout: "", stderr: "" });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    await loadRunner();
    expect(hoisted.spawnSync).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("skips skills with .no-auto-run", async () => {
    hoisted.readdirSync.mockReturnValue(["skipme"]);
    hoisted.statSync.mockReturnValue({ isDirectory: () => true });
    hoisted.existsSync.mockImplementation((p: string) => {
      if (hasNoAutoRun(p)) return true;
      if (hasHardIndex(p)) return true;
      return false;
    });
    hoisted.spawnSync.mockReturnValue({ status: 0, stdout: "", stderr: "" });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    await loadRunner();
    expect(hoisted.spawnSync).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("exits 1 when a skill process fails", async () => {
    hoisted.readdirSync.mockReturnValue(["bad"]);
    hoisted.statSync.mockReturnValue({ isDirectory: () => true });
    hoisted.existsSync.mockImplementation((p: string) => hasHardIndex(p));
    hoisted.spawnSync.mockReturnValue({ status: 1, stdout: "x", stderr: "" });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    await loadRunner();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("writes child stdout and stderr when present", async () => {
    hoisted.readdirSync.mockReturnValue(["one"]);
    hoisted.statSync.mockReturnValue({ isDirectory: () => true });
    hoisted.existsSync.mockImplementation((p: string) => hasHardIndex(p));
    hoisted.spawnSync.mockReturnValue({
      status: 0,
      stdout: "hello",
      stderr: "warn",
    });
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    await loadRunner();
    expect(process.stdout.write).toHaveBeenCalled();
    expect(process.stderr.write).toHaveBeenCalled();
  });
});
