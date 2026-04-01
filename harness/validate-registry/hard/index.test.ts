import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateRegistry } from "./index.js";

describe("validateRegistry", () => {
  it("returns no violations when registry.json is absent", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reg-"));
    try {
      expect(validateRegistry(dir)).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

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

  it("reports invalid JSON", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reg-"));
    try {
      await writeFile(join(dir, "registry.json"), "{ not json", "utf8");
      const v = validateRegistry(dir);
      expect(v.some((x) => x.rule === "invalid-json")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reports invalid shape", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reg-"));
    try {
      await writeFile(join(dir, "registry.json"), JSON.stringify({ foo: 1 }), "utf8");
      const v = validateRegistry(dir);
      expect(v.some((x) => x.rule === "invalid-shape")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reports missing skill path on disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "reg-"));
    try {
      await writeFile(
        join(dir, "registry.json"),
        JSON.stringify({ skills: { ghost: "registry/nope" } }),
        "utf8",
      );
      const v = validateRegistry(dir);
      expect(v.some((x) => x.rule === "missing-path")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
