import { access, cp, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

export async function assertSkillMdPresent(skillSourceDir: string): Promise<void> {
  const p = join(skillSourceDir, "SKILL.md");
  try {
    await access(p, constants.R_OK);
  } catch {
    throw new Error(`Expected SKILL.md in skill path: ${skillSourceDir}`);
  }
}

export async function copySkillTree(fromDir: string, toDir: string): Promise<void> {
  await rm(toDir, { recursive: true, force: true }).catch(() => undefined);
  await cp(fromDir, toDir, { recursive: true, force: true });
}
