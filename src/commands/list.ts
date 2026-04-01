import chalk from "chalk";
import { loadConfig } from "../config.js";
import { readLockOrEmpty } from "../lockfile.js";
import { skillInstallPath } from "../paths.js";

export async function runList(cwd: string): Promise<void> {
  const config = await loadConfig(cwd);
  const lock = await readLockOrEmpty(cwd);
  const ids = Object.keys(lock.skills).sort();
  if (ids.length === 0) {
    console.log(chalk.dim("No skills installed (lock empty)."));
    return;
  }

  for (const id of ids) {
    const e = lock.skills[id];
    const dest = skillInstallPath(cwd, config.skillsRoot, id);
    console.log(
      [
        chalk.bold(id),
        chalk.dim("→"),
        dest,
        chalk.dim(`commit=${e.registryCommit.slice(0, 7)} path=${e.skillPath}`),
      ].join(" "),
    );
  }
}
