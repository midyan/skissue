import { chmodSync } from "node:fs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateAgentsEntry } from "./index.js";

describe("validateAgentsEntry", () => {
  const prevMax = process.env.AGENTS_MAX_LINES;

  afterEach(() => {
    if (prevMax === undefined) delete process.env.AGENTS_MAX_LINES;
    else process.env.AGENTS_MAX_LINES = prevMax;
  });

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

  it("honors AGENTS_MAX_LINES when opts.maxLines is omitted", async () => {
    process.env.AGENTS_MAX_LINES = "5";
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-vae-"));
    try {
      await writeFile(
        join(dir, "AGENTS.md"),
        Array.from({ length: 8 }, () => "x").join("\n"),
        "utf8",
      );
      const v = validateAgentsEntry(dir);
      expect(v.some((x) => x.rule === "agents-too-long")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("flags unreadable AGENTS.md", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-vae-"));
    try {
      await writeFile(join(dir, "AGENTS.md"), "ok\n", "utf8");
      chmodSync(join(dir, "AGENTS.md"), 0o000);
      const v = validateAgentsEntry(dir, { maxLines: 200 });
      expect(v.some((x) => x.rule === "unreadable")).toBe(true);
    } finally {
      try {
        chmodSync(join(dir, "AGENTS.md"), 0o644);
      } catch {
        /* dir may be gone */
      }
      await rm(dir, { recursive: true, force: true });
    }
  });
});
