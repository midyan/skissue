import { chmodSync } from "node:fs";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateHarnessDoc } from "./index.js";

describe("validateHarnessDoc", () => {
  const prevMin = process.env.HARNESS_MIN_LINES;

  afterEach(() => {
    if (prevMin === undefined) delete process.env.HARNESS_MIN_LINES;
    else process.env.HARNESS_MIN_LINES = prevMin;
  });

  it("flags missing docs/HARNESS.md", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-vhd-"));
    try {
      await mkdir(join(dir, "docs"), { recursive: true });
      const v = validateHarnessDoc(dir, { minNonEmptyLines: 12 });
      expect(v.some((x) => x.rule === "missing-harness-doc")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("flags thin HARNESS.md", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-vhd-"));
    try {
      await mkdir(join(dir, "docs"), { recursive: true });
      await writeFile(join(dir, "docs", "HARNESS.md"), "# x\n\n", "utf8");
      const v = validateHarnessDoc(dir, { minNonEmptyLines: 12 });
      expect(v.some((x) => x.rule === "harness-too-thin")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("passes when enough non-empty lines", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-vhd-"));
    try {
      await mkdir(join(dir, "docs"), { recursive: true });
      const lines = Array.from({ length: 15 }, (_, i) => `Line ${i}`).join("\n");
      await writeFile(join(dir, "docs", "HARNESS.md"), `# Harness\n\n${lines}\n`, "utf8");
      expect(validateHarnessDoc(dir, { minNonEmptyLines: 12 })).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("honors HARNESS_MIN_LINES when opts.minNonEmptyLines is omitted", async () => {
    process.env.HARNESS_MIN_LINES = "20";
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-vhd-"));
    try {
      await mkdir(join(dir, "docs"), { recursive: true });
      await writeFile(join(dir, "docs", "HARNESS.md"), "# H\n\na\nb\n", "utf8");
      const v = validateHarnessDoc(dir);
      expect(v.some((x) => x.rule === "harness-too-thin")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("flags unreadable docs/HARNESS.md", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-vhd-"));
    try {
      await mkdir(join(dir, "docs"), { recursive: true });
      await writeFile(join(dir, "docs", "HARNESS.md"), "content\n", "utf8");
      chmodSync(join(dir, "docs", "HARNESS.md"), 0o000);
      const v = validateHarnessDoc(dir, { minNonEmptyLines: 12 });
      expect(v.some((x) => x.rule === "unreadable")).toBe(true);
    } finally {
      try {
        chmodSync(join(dir, "docs", "HARNESS.md"), 0o644);
      } catch {
        /* gone */
      }
      await rm(dir, { recursive: true, force: true });
    }
  });
});
