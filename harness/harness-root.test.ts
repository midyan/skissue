import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { harnessRepoRoot } from "./harness-root.js";

describe("harnessRepoRoot", () => {
  const prevEnv = process.env.SKISSUE_HARNESS_ROOT;

  afterEach(() => {
    if (prevEnv === undefined) {
      delete process.env.SKISSUE_HARNESS_ROOT;
    } else {
      process.env.SKISSUE_HARNESS_ROOT = prevEnv;
    }
  });

  it("resolves three levels up from a */hard directory when env is unset", () => {
    const hard = join(tmpdir(), "nest", "some-skill", "hard");
    expect(harnessRepoRoot(hard)).toBe(resolve(hard, "../../.."));
  });

  it("uses SKISSUE_HARNESS_ROOT when set to an absolute path", () => {
    const t = mkdtempSync(join(tmpdir(), "hr-root-"));
    try {
      process.env.SKISSUE_HARNESS_ROOT = t;
      expect(harnessRepoRoot("/nope/not/used")).toBe(resolve(t));
    } finally {
      rmSync(t, { recursive: true, force: true });
    }
  });

  it("ignores whitespace-only SKISSUE_HARNESS_ROOT", () => {
    delete process.env.SKISSUE_HARNESS_ROOT;
    const hard = join(tmpdir(), "x", "y", "hard");
    process.env.SKISSUE_HARNESS_ROOT = "   \t  ";
    expect(harnessRepoRoot(hard)).toBe(resolve(hard, "../../.."));
  });
});
