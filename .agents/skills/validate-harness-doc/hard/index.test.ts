import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateHarnessDoc } from "./index.js";

describe("validateHarnessDoc", () => {
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
});
