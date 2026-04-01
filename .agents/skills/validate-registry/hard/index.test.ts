import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateRegistry } from "./index.js";

describe("validateRegistry", () => {
  it("passes when registry and skills are valid", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reg-"));
    try {
      await writeFile(
        join(dir, "registry.json"),
        JSON.stringify({ skills: { a: "registry/a" } }),
        "utf8",
      );
      await mkdir(join(dir, "registry/a"), { recursive: true });
      await writeFile(join(dir, "registry/a/SKILL.md"), "---\nname: a\n---\n", "utf8");
      expect(validateRegistry(dir)).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reports missing SKILL.md", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reg-"));
    try {
      await writeFile(
        join(dir, "registry.json"),
        JSON.stringify({ skills: { a: "registry/a" } }),
        "utf8",
      );
      await mkdir(join(dir, "registry/a"), { recursive: true });
      await writeFile(join(dir, "registry/a/.keep"), "", "utf8");
      const v = validateRegistry(dir);
      expect(v.some((x) => x.rule === "missing-skill-md")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
