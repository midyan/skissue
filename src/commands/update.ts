import chalk from "chalk";
import { runInstall, runInstallMany } from "./install.js";
import { loadConfig } from "../config.js";
import { readLockOrEmpty } from "../lockfile.js";

export async function runUpdate(cwd: string, skillId?: string): Promise<void> {
  await loadConfig(cwd);
  const lock = await readLockOrEmpty(cwd);

  if (skillId) {
    if (!lock.skills[skillId]) {
      console.error(chalk.red(`Unknown skill in lock: ${skillId}`));
      process.exitCode = 1;
      return;
    }
    try {
      await runInstall(cwd, skillId);
    } catch {
      process.exitCode = 1;
    }
    return;
  }

  const ids = Object.keys(lock.skills).sort();
  if (ids.length === 0) {
    console.log(chalk.dim("Nothing to update (lock empty)."));
    return;
  }

  try {
    await runInstallMany(cwd, ids);
  } catch {
    process.exitCode = 1;
  }
}
