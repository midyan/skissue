import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  spawnSync: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  spawnSync: (...args: unknown[]) => hoisted.spawnSync(...args),
}));

describe("repo-verify runPlan (spawn mocked)", () => {
  beforeEach(() => {
    vi.resetModules();
    hoisted.spawnSync.mockReset();
  });

  it("runs each step and returns true when all subprocesses succeed", async () => {
    hoisted.spawnSync.mockReturnValue({ status: 0, stdout: "", stderr: "" });
    const { runPlan } = await import("./index.js");
    const tmp = mkdtempSync(join(tmpdir(), "rp-plan-"));
    try {
      const ok = runPlan(
        tmp,
        {
          kind: "steps",
          steps: [
            { label: "a", argv: ["node", "-e", "0"] },
            { label: "b", argv: ["node", "-e", "0"] },
          ],
        },
        false,
      );
      expect(ok).toBe(true);
      expect(hoisted.spawnSync.mock.calls.length).toBe(2);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns false when a step exits non-zero", async () => {
    hoisted.spawnSync.mockReturnValueOnce({ status: 1, stdout: "", stderr: "bad" });
    const { runPlan } = await import("./index.js");
    const tmp = mkdtempSync(join(tmpdir(), "rp-plan-"));
    try {
      const ok = runPlan(
        tmp,
        { kind: "steps", steps: [{ label: "x", argv: ["node", "-e", "1"] }] },
        false,
      );
      expect(ok).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
