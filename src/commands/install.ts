import chalk from "chalk";
import ora from "ora";
import { join } from "node:path";
import type { Config } from "../config.js";
import { isLocalRegistry, loadConfig } from "../config.js";
import { readLockOrEmpty, writeLock, upsertSkillLock } from "../lockfile.js";
import { skillInstallPath } from "../paths.js";
import { listRegistrySkillIds } from "../registry/catalog.js";
import { resolveSkillPath } from "../registry/resolve.js";
import { ensureRegistryCheckout } from "../git/registry-repo.js";
import { assertSkillMdPresent, copySkillTree } from "../io.js";
import { uninstallSkillQuiet } from "./uninstall.js";

/** Result of `ensureRegistryCheckout` — pass into `runInstallMany` to skip a second sync. */
export type RegistryCheckout = { path: string; head: string };

type InstallFromCheckoutResult =
  | { outcome: "installed"; dest: string }
  | { outcome: "removed"; skillId: string };

async function installSkillFromCheckout(
  cwd: string,
  config: Config,
  repoPath: string,
  head: string,
  skillId: string,
  catalogIds: Set<string>,
): Promise<InstallFromCheckoutResult> {
  if (!catalogIds.has(skillId)) {
    const lock = await readLockOrEmpty(cwd);
    if (lock.skills[skillId]) {
      await uninstallSkillQuiet(cwd, skillId);
      return { outcome: "removed", skillId };
    }
    throw new Error(`Skill "${skillId}" is not in the registry.`);
  }

  const { skillPath } = await resolveSkillPath(repoPath, skillId);
  const src = join(repoPath, skillPath);
  await assertSkillMdPresent(src);

  const dest = skillInstallPath(cwd, config.skillsRoot, skillId);
  await copySkillTree(src, dest);

  const lock = await readLockOrEmpty(cwd);
  const ref = isLocalRegistry(config) ? "local" : `refs/heads/${config.registry.branch}`;
  const next = upsertSkillLock(lock, skillId, {
    registryCommit: head,
    skillPath,
    ref,
  });
  await writeLock(cwd, next);
  return { outcome: "installed", dest };
}

export async function runInstall(cwd: string, skillId: string): Promise<void> {
  const config = await loadConfig(cwd);
  const spin = ora(`Resolving registry and installing ${skillId}`).start();
  try {
    const { path: repoPath, head } = await ensureRegistryCheckout(cwd, config);
    const catalogIds = new Set(await listRegistrySkillIds(repoPath));
    const result = await installSkillFromCheckout(cwd, config, repoPath, head, skillId, catalogIds);
    if (result.outcome === "removed") {
      spin.succeed(
        chalk.yellow(
          `Removed ${skillId} — no longer in the registry (was still installed locally).`,
        ),
      );
    } else {
      spin.succeed(chalk.green(`Installed ${skillId} → ${result.dest}`));
    }
  } catch (err) {
    spin.fail(chalk.red(err instanceof Error ? err.message : String(err)));
    throw err;
  }
}

/**
 * One `ensureRegistryCheckout` (unless `checkout` is passed), then copy each skill.
 * Use `checkout` from an earlier `ensureRegistryCheckout` in the same process (e.g. manage).
 */
export async function runInstallMany(
  cwd: string,
  skillIds: string[],
  options?: { checkout?: RegistryCheckout },
): Promise<void> {
  const config = await loadConfig(cwd);
  let repoPath: string;
  let head: string;

  if (options?.checkout) {
    ({ path: repoPath, head } = options.checkout);
  } else {
    const prep = ora("Preparing registry…").start();
    try {
      const c = await ensureRegistryCheckout(cwd, config);
      repoPath = c.path;
      head = c.head;
      prep.succeed(chalk.green("Registry ready."));
    } catch (err) {
      prep.fail(chalk.red(err instanceof Error ? err.message : String(err)));
      throw err;
    }
  }

  const catalogIds = new Set(await listRegistrySkillIds(repoPath));

  for (const skillId of skillIds) {
    const spin = ora(`Installing ${skillId}…`).start();
    try {
      const result = await installSkillFromCheckout(
        cwd,
        config,
        repoPath,
        head,
        skillId,
        catalogIds,
      );
      if (result.outcome === "removed") {
        spin.succeed(
          chalk.yellow(
            `Removed ${skillId} — no longer in the registry (was still installed locally).`,
          ),
        );
      } else {
        spin.succeed(chalk.green(`Installed ${skillId} → ${result.dest}`));
      }
    } catch (err) {
      spin.fail(chalk.red(err instanceof Error ? err.message : String(err)));
      throw err;
    }
  }
}
