import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateAgentsEntry } from "./index.js";

describe("validateAgentsEntry", () => {
  it("flags missing AGENTS.md", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-vae-"));
    try {
      const v = validateAgentsEntry(dir, { maxLines: 200 });
      expect(v.some((x) => x.rule === "missing-agents")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("flags empty AGENTS.md", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-vae-"));
    try {
      await writeFile(join(dir, "AGENTS.md"), "   \n", "utf8");
      const v = validateAgentsEntry(dir, { maxLines: 200 });
      expect(v.some((x) => x.rule === "empty-agents")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("flags when over max lines", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-vae-"));
    try {
      const body = Array.from({ length: 5 }, () => "x").join("\n");
      await writeFile(join(dir, "AGENTS.md"), body, "utf8");
      const v = validateAgentsEntry(dir, { maxLines: 3 });
      expect(v.some((x) => x.rule === "agents-too-long")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("passes for short AGENTS.md", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-vae-"));
    try {
      await writeFile(join(dir, "AGENTS.md"), "# Title\n\nMap to docs.\n", "utf8");
      expect(validateAgentsEntry(dir, { maxLines: 200 })).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
