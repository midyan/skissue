import chalk from "chalk";
import ora from "ora";
import { rm } from "node:fs/promises";
import { loadConfig } from "../config.js";
import { readLockOrEmpty, writeLock, removeSkillLock } from "../lockfile.js";
import { skillInstallPath } from "../paths.js";

/** Remove installed skill tree and lock entry when present; no spinner. */
export async function uninstallSkillQuiet(cwd: string, skillId: string): Promise<void> {
  const config = await loadConfig(cwd);
  const dest = skillInstallPath(cwd, config.skillsRoot, skillId);
  await rm(dest, { recursive: true, force: true });

  const lock = await readLockOrEmpty(cwd);
  if (lock.skills[skillId]) {
    await writeLock(cwd, removeSkillLock(lock, skillId));
  }
}

export async function runUninstall(cwd: string, skillId: string): Promise<void> {
  const spin = ora(`Removing ${skillId}`).start();
  try {
    const lockBefore = await readLockOrEmpty(cwd);
    await uninstallSkillQuiet(cwd, skillId);
    if (!lockBefore.skills[skillId]) {
      spin.stopAndPersist({
        symbol: chalk.yellow("⚠"),
        text: chalk.yellow(`No lock entry for ${skillId}; removed directory if present.`),
      });
    } else {
      spin.succeed(chalk.green(`Uninstalled ${skillId}`));
    }
  } catch (err) {
    spin.fail(chalk.red(err instanceof Error ? err.message : String(err)));
    throw err;
  }
}
