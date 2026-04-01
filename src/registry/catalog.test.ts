import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listRegistrySkillIds } from "./catalog.js";

async function writeSkill(registryRoot: string, id: string): Promise<void> {
  const dir = join(registryRoot, "registry", id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "SKILL.md"), "# x\n", "utf8");
}

describe("listRegistrySkillIds", () => {
  it("collects keys from registry.json", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-cat-"));
    try {
      await writeFile(
        join(dir, "registry.json"),
        JSON.stringify({ skills: { alpha: "registry/alpha", beta: "registry/beta" } }),
        "utf8",
      );
      const ids = await listRegistrySkillIds(dir);
      expect(ids).toEqual(["alpha", "beta"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("collects registry/ subdirs with SKILL.md", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-cat-"));
    try {
      await writeSkill(dir, "from-dir");
      const ids = await listRegistrySkillIds(dir);
      expect(ids).toEqual(["from-dir"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("merges and dedupes json keys with directory skills", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-cat-"));
    try {
      await writeFile(
        join(dir, "registry.json"),
        JSON.stringify({ skills: { shared: "registry/shared" } }),
        "utf8",
      );
      await writeSkill(dir, "shared");
      await writeSkill(dir, "extra");
      const ids = await listRegistrySkillIds(dir);
      expect(ids).toEqual(["extra", "shared"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("ignores registry subdirs without SKILL.md", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-cat-"));
    try {
      await mkdir(join(dir, "registry", "empty"), { recursive: true });
      await writeFile(join(dir, "registry", "empty", "README.md"), "x", "utf8");
      const ids = await listRegistrySkillIds(dir);
      expect(ids).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns empty array when no registry data", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-cat-"));
    try {
      const ids = await listRegistrySkillIds(dir);
      expect(ids).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("ignores plain files under registry/", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-cat-"));
    try {
      await mkdir(join(dir, "registry"), { recursive: true });
      await writeFile(join(dir, "registry", "not-a-dir"), "x", "utf8");
      await writeSkill(dir, "only-skill");
      const ids = await listRegistrySkillIds(dir);
      expect(ids).toEqual(["only-skill"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("skips registry subdirs whose name is only whitespace", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-cat-"));
    try {
      const ws = "  \t  ";
      await mkdir(join(dir, "registry", ws), { recursive: true });
      await writeFile(join(dir, "registry", ws, "SKILL.md"), "#\n", "utf8");
      await writeSkill(dir, "real");
      const ids = await listRegistrySkillIds(dir);
      expect(ids).toEqual(["real"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("skips blank registry.json skill ids", async () => {
    const dir = await mkdtemp(join(tmpdir(), "skill-issue-cat-"));
    try {
      await writeFile(
        join(dir, "registry.json"),
        JSON.stringify({ skills: { "  \t  ": "registry/x", ok: "registry/ok" } }),
        "utf8",
      );
      await writeSkill(dir, "ok");
      const ids = await listRegistrySkillIds(dir);
      expect(ids).toEqual(["ok"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
