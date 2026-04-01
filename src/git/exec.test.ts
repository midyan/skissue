import { EventEmitter } from "node:events";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

function fakeChild(): ChildProcessWithoutNullStreams {
  const child = new EventEmitter() as ChildProcessWithoutNullStreams;
  child.stdout = new EventEmitter() as Readable;
  child.stderr = new EventEmitter() as Readable;
  return child;
}

describe("execGit", () => {
  beforeEach(() => {
    vi.resetModules();
    spawnMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns code 124 when the child is killed after timeout (SIGTERM)", async () => {
    spawnMock.mockImplementation(() => {
      const child = fakeChild();
      child.kill = vi.fn(() => {
        queueMicrotask(() => child.emit("close", null, "SIGTERM"));
        return true;
      });
      return child;
    });

    const { execGit } = await import("./exec.js");
    await expect(execGit(["status"], { timeoutMs: 5 })).resolves.toMatchObject({
      code: 124,
      stderr: expect.stringMatching(/timed out/),
    });
  });

  it("resolves with code 1 when spawn emits error", async () => {
    spawnMock.mockImplementation(() => {
      const child = fakeChild();
      queueMicrotask(() => child.emit("error", new Error("ENOENT git")));
      return child;
    });

    const { execGit } = await import("./exec.js");
    await expect(execGit(["x"])).resolves.toMatchObject({
      code: 1,
      stderr: expect.stringMatching(/ENOENT git/),
    });
  });

  it("clears timeout when spawn errors after a timeout was scheduled", async () => {
    spawnMock.mockImplementation(() => {
      const child = fakeChild();
      queueMicrotask(() => child.emit("error", new Error("spawn boom")));
      return child;
    });

    const { execGit } = await import("./exec.js");
    await expect(execGit(["x"], { timeoutMs: 60_000 })).resolves.toMatchObject({
      code: 1,
      stderr: expect.stringMatching(/spawn boom/),
    });
  });

  it("uses code 1 when close receives a null exit code without SIGTERM", async () => {
    spawnMock.mockImplementation(() => {
      const child = fakeChild();
      queueMicrotask(() => child.emit("close", null, undefined));
      return child;
    });

    const { execGit } = await import("./exec.js");
    await expect(execGit(["version"])).resolves.toMatchObject({ code: 1, stdout: "", stderr: "" });
  });

  it("does not override GIT_TERMINAL_PROMPT when already set in process.env", async () => {
    const prev = process.env.GIT_TERMINAL_PROMPT;
    process.env.GIT_TERMINAL_PROMPT = "1";
    spawnMock.mockImplementation((_cmd, _args, opts) => {
      const env = (opts as { env?: NodeJS.ProcessEnv }).env;
      expect(env?.GIT_TERMINAL_PROMPT).toBe("1");
      const child = fakeChild();
      queueMicrotask(() => child.emit("close", 0, undefined));
      return child;
    });

    try {
      const { execGit } = await import("./exec.js");
      await execGit(["status"]);
    } finally {
      if (prev === undefined) delete process.env.GIT_TERMINAL_PROMPT;
      else process.env.GIT_TERMINAL_PROMPT = prev;
    }
  });
});
