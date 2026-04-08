import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveSkillPath } from "./resolve.js";

describe("resolveSkillPath", () => {
  it("uses registry.json mapping when present", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-"));
    try {
      await writeFile(
        join(dir, "registry.json"),
        JSON.stringify({ skills: { myskill: "custom/path/to/myskill" } }),
        "utf8",
      );
      const r = await resolveSkillPath(dir, "myskill");
      expect(r.source).toBe("registry.json");
      expect(r.skillPath).toBe("custom/path/to/myskill");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("falls back to skills/<id> when registry.json missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-"));
    try {
      const r = await resolveSkillPath(dir, "foo");
      expect(r.source).toBe("convention");
      expect(r.skillPath).toBe("registry/foo");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("uses convention when mapped path is empty", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-"));
    try {
      await writeFile(
        join(dir, "registry.json"),
        JSON.stringify({ skills: { emptyid: "" } }),
        "utf8",
      );
      const r = await resolveSkillPath(dir, "emptyid");
      expect(r.source).toBe("convention");
      expect(r.skillPath).toBe("registry/emptyid");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("uses convention when registry.json has no skills map", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-"));
    try {
      await writeFile(join(dir, "registry.json"), "{}\n", "utf8");
      const r = await resolveSkillPath(dir, "orphan");
      expect(r.source).toBe("convention");
      expect(r.skillPath).toBe("registry/orphan");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("uses convention when registry.json fails schema (invalid skills shape)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-"));
    try {
      await writeFile(
        join(dir, "registry.json"),
        JSON.stringify({ skills: "not-a-record" }),
        "utf8",
      );
      const r = await resolveSkillPath(dir, "bad");
      expect(r.source).toBe("convention");
      expect(r.skillPath).toBe("registry/bad");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
