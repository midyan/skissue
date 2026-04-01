import { resolve } from "node:path";

/**
 * Repo root for harness CLIs. When `SKISSUE_HARNESS_ROOT` is set (e.g. tests), that path is used
 * instead of walking up from `import.meta.dirname` of each skill's `hard/index.ts`.
 */
export function harnessRepoRoot(fromDir: string): string {
  const trimmed = process.env.SKISSUE_HARNESS_ROOT?.trim();
  if (trimmed) {
    return resolve(trimmed);
  }
  return resolve(fromDir, "../../..");
}
