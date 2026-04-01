import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const RegistryJsonSchema = z
  .object({
    skills: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

/**
 * Lists skill ids advertised by the registry checkout: keys from `registry.json`
 * plus subdirectories of `registry/` that contain `SKILL.md` at the skill root.
 */
export async function listRegistrySkillIds(registryRepoRoot: string): Promise<string[]> {
  const ids = new Set<string>();

  const registryFile = join(registryRepoRoot, "registry.json");
  try {
    const raw = await readFile(registryFile, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    const reg = RegistryJsonSchema.safeParse(parsed);
    if (reg.success && reg.data.skills) {
      for (const id of Object.keys(reg.data.skills)) {
        if (id.trim()) ids.add(id);
      }
    }
  } catch {
    // missing or unreadable registry.json — rely on directory scan
  }

  const registryDir = join(registryRepoRoot, "registry");
  try {
    const entries = await readdir(registryDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const id = e.name;
      if (!id.trim()) continue;
      const skillRoot = join(registryDir, id);
      try {
        await access(join(skillRoot, "SKILL.md"), constants.R_OK);
        ids.add(id);
      } catch {
        // not a skill root
      }
    }
  } catch {
    // missing registry/
  }

  return [...ids].sort((a, b) => a.localeCompare(b));
}
