import chalk from "chalk";
import ora from "ora";
import { loadConfig } from "../config.js";
import { readLockOrEmpty } from "../lockfile.js";
import { ensureRegistryCheckout, isSkillPathStaleAtHead } from "../git/registry-repo.js";

export async function runOutdated(cwd: string): Promise<void> {
  const config = await loadConfig(cwd);
  const lock = await readLockOrEmpty(cwd);
  const ids = Object.keys(lock.skills).sort();
  if (ids.length === 0) {
    console.log(chalk.dim("Nothing installed."));
    return;
  }

  const spin = ora("Fetching registry and comparing paths").start();
  try {
    const { path: repoPath, head } = await ensureRegistryCheckout(cwd, config);
    spin.stop();

    for (const id of ids) {
      const e = lock.skills[id];
      const stale = await isSkillPathStaleAtHead(repoPath, head, e);
      if (stale) {
        console.log(
          chalk.bold.yellowBright("OUTDATED") +
            " " +
            chalk.yellow(id) +
            chalk.dim(` — path changed ${e.registryCommit.slice(0, 7)} → ${head.slice(0, 7)}`),
        );
      } else {
        console.log(chalk.green(`${id}`) + chalk.dim(` up to date @ ${head.slice(0, 7)}`));
      }
    }
  } catch (err) {
    spin.fail(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exitCode = 1;
  }
}
