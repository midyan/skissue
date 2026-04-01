import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { lockPath } from "./paths.js";

export const LockSkillEntrySchema = z.object({
  registryCommit: z.string().min(1),
  skillPath: z.string().min(1),
  ref: z.string().min(1),
});

export const LockSchema = z.object({
  version: z.literal(1),
  skills: z.record(z.string(), LockSkillEntrySchema),
});

export type LockSkillEntry = z.infer<typeof LockSkillEntrySchema>;
export type Lockfile = z.infer<typeof LockSchema>;

export function emptyLock(): Lockfile {
  return { version: 1, skills: {} };
}

export async function readLock(cwd: string): Promise<Lockfile> {
  const path = lockPath(cwd);
  const raw = await readFile(path, "utf8");
  const data = JSON.parse(raw) as unknown;
  return LockSchema.parse(data);
}

export async function writeLock(cwd: string, lock: Lockfile): Promise<void> {
  const path = lockPath(cwd);
  await mkdir(dirname(path), { recursive: true });
  const parsed = LockSchema.parse(lock);
  await writeFile(path, JSON.stringify(parsed, null, 2) + "\n", "utf8");
}

export async function readLockOrEmpty(cwd: string): Promise<Lockfile> {
  try {
    return await readLock(cwd);
  } catch {
    return emptyLock();
  }
}

export function upsertSkillLock(lock: Lockfile, skillId: string, entry: LockSkillEntry): Lockfile {
  return {
    ...lock,
    skills: { ...lock.skills, [skillId]: entry },
  };
}

export function removeSkillLock(lock: Lockfile, skillId: string): Lockfile {
  const skills = { ...lock.skills };
  delete skills[skillId];
  return { ...lock, skills };
}
