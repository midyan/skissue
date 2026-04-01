import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const RegistryJsonSchema = z
  .object({
    skills: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

export type ResolveResult = { skillPath: string; source: "registry.json" | "convention" };

/**
 * Resolve skill id to path inside the registry repo checkout.
 * - If registry.json exists and lists the id, use that path (relative to repo root).
 * - Else use convention `registry/<id>` (trailing slash normalized away).
 */
export async function resolveSkillPath(
  registryRepoRoot: string,
  skillId: string,
): Promise<ResolveResult> {
  const registryFile = join(registryRepoRoot, "registry.json");
  let raw: string;
  try {
    raw = await readFile(registryFile, "utf8");
  } catch {
    return { skillPath: join("registry", skillId).replace(/\\/g, "/"), source: "convention" };
  }

  const parsed = JSON.parse(raw) as unknown;
  const reg = RegistryJsonSchema.safeParse(parsed);
  if (!reg.success || !reg.data.skills) {
    return { skillPath: join("registry", skillId).replace(/\\/g, "/"), source: "convention" };
  }

  const mapped = reg.data.skills[skillId];
  if (mapped !== undefined && mapped.length > 0) {
    return { skillPath: normalizeRelPath(mapped), source: "registry.json" };
  }

  return { skillPath: join("registry", skillId).replace(/\\/g, "/"), source: "convention" };
}

function normalizeRelPath(p: string): string {
  return p
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/\/+$/, "");
}
