import * as p from "@clack/prompts";
import chalk from "chalk";
import { emitKeypressEvents, type Key } from "node:readline";
import { printSkillIssueBanner } from "./banner.js";
import { loadConfig } from "../config.js";
import { ensureRegistryCheckout } from "../git/registry-repo.js";
import { readLockOrEmpty } from "../lockfile.js";
import { listRegistrySkillIds } from "../registry/catalog.js";
import { isSkillPathStaleAtHead } from "../git/registry-repo.js";
import { runInstallMany } from "./install.js";
import { runUninstall } from "./uninstall.js";

/**
 * On the home menu, @clack maps both Esc and Ctrl+C to the same cancel symbol. We prepend a stdin
 * keypress listener so Ctrl+C exits immediately; Esc alone keeps double-press-to-exit.
 */
const MAIN_MENU_DOUBLE_ESCAPE_MS = 1200;

type MainMenuValue = "install" | "uninstall" | "update" | "done";

async function promptMainMenuSelect(
  availableCount: number,
  installedCount: number,
): Promise<MainMenuValue | symbol> {
  const onCtrlC = (_s: string | undefined, key: Key) => {
    if (key?.ctrl && key?.name === "c") {
      p.cancel("Aborted.");
      process.exit(0);
    }
  };
  const { stdin } = process;
  if (stdin.isTTY) {
    emitKeypressEvents(stdin);
    stdin.prependListener("keypress", onCtrlC);
  }
  try {
    return await p.select({
      message: chalk.bold("Next step"),
      initialValue: "install" as const,
      options: [
        {
          value: "install" as const,
          label: "Install",
          hint: chalk.dim(`${availableCount} available`),
        },
        {
          value: "uninstall" as const,
          label: "Uninstall",
          hint: chalk.dim(`${installedCount} installed`),
        },
        {
          value: "update" as const,
          label: "Update",
          hint: chalk.dim("refresh from registry checkout"),
        },
        { value: "done" as const, label: "Exit", hint: chalk.dim("back to shell") },
      ],
    });
  } finally {
    if (stdin.isTTY) {
      stdin.removeListener("keypress", onCtrlC);
    }
  }
}

function printRegistryStats(catalogLen: number, installed: number, canInstall: number): void {
  const sep = chalk.dim(" · ");
  const line = [
    chalk.dim("Registry"),
    chalk.cyan(catalogLen),
    chalk.dim("skills"),
    sep,
    chalk.dim("installed"),
    chalk.cyan(installed),
    sep,
    chalk.dim("not installed"),
    chalk.cyan(canInstall),
  ].join(" ");
  p.log.info(line);
}

export async function runManage(cwd: string): Promise<void> {
  printSkillIssueBanner();
  p.intro(chalk.dim("manage"));
  const config = await loadConfig(cwd);
  const spin = p.spinner();
  spin.start("Preparing registry…");
  let checkout: { path: string; head: string };
  try {
    checkout = await ensureRegistryCheckout(cwd, config);
    spin.stop(chalk.green("Registry ready."));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    spin.stop(chalk.red(msg));
    throw err;
  }

  const catalog = await listRegistrySkillIds(checkout.path);
  let lock = await readLockOrEmpty(cwd);
  let lastMainMenuEscapeAt = 0;

  while (true) {
    const installedIds = Object.keys(lock.skills).sort();
    const available = catalog.filter((id) => !lock.skills[id]);

    printRegistryStats(catalog.length, installedIds.length, available.length);

    const action = await promptMainMenuSelect(available.length, installedIds.length);
    if (p.isCancel(action)) {
      const now = Date.now();
      if (now - lastMainMenuEscapeAt < MAIN_MENU_DOUBLE_ESCAPE_MS) {
        p.cancel("Aborted.");
        process.exit(0);
      }
      lastMainMenuEscapeAt = now;
      p.log.message(
        chalk.dim(
          `Press Esc twice within ${MAIN_MENU_DOUBLE_ESCAPE_MS / 1000}s to exit, or choose a step.`,
        ),
      );
      continue;
    }

    lastMainMenuEscapeAt = 0;

    if (action === "done") {
      p.outro(chalk.green("Finished."));
      return;
    }

    if (action === "update") {
      if (installedIds.length === 0) {
        p.log.warn(chalk.dim("Nothing installed yet."));
        continue;
      }

      const checkSpin = p.spinner();
      checkSpin.start("Checking installed skills against registry…");
      let staleById: Record<string, boolean>;
      try {
        staleById = {};
        for (const id of installedIds) {
          staleById[id] = await isSkillPathStaleAtHead(
            checkout.path,
            checkout.head,
            lock.skills[id]!,
          );
        }
        checkSpin.stop(chalk.green("Ready."));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        checkSpin.stop(chalk.red(msg));
        p.log.error(chalk.red(`Could not compare skills: ${msg}`));
        continue;
      }

      const staleIds = installedIds.filter((id) => staleById[id]);
      const updateMode = await p.select({
        message: chalk.bold("Update skills"),
        initialValue: "pick" as const,
        options: [
          {
            value: "pick" as const,
            label: "Choose which to update",
            hint:
              staleIds.length > 0
                ? chalk.bold.yellowBright(
                    `${staleIds.length} OUTDATED — differs from registry head`,
                  )
                : chalk.dim("all match registry"),
          },
          {
            value: "all" as const,
            label: "Update all",
            hint: chalk.dim(`${installedIds.length} installed`),
          },
        ],
      });
      if (p.isCancel(updateMode)) {
        p.log.message(chalk.dim("Back to the menu."));
        continue;
      }

      if (updateMode === "all") {
        const ok = await p.confirm({
          message: `Update all ${chalk.cyan(String(installedIds.length))} installed skills?`,
          initialValue: true,
        });
        if (p.isCancel(ok)) {
          p.log.message(chalk.dim("Back to the menu."));
          continue;
        }
        if (!ok) continue;
        try {
          await runInstallMany(cwd, installedIds, { checkout });
        } catch {
          p.log.error(chalk.red("Update failed."));
        }
        lock = await readLockOrEmpty(cwd);
        continue;
      }

      p.log.message(chalk.dim("Space toggle · Enter confirm · Esc back"));
      const selected = await p.multiselect({
        message: "Skills to update",
        options: installedIds.map((id) => ({
          value: id,
          label: id,
          hint: staleById[id]
            ? chalk.bold.yellowBright("OUTDATED") + chalk.dim(" · update to sync")
            : chalk.dim("up to date"),
        })),
        initialValues: staleIds,
        required: false,
      });
      if (p.isCancel(selected)) {
        p.log.message(chalk.dim("Back to the menu."));
        continue;
      }
      if (selected.length === 0) {
        p.log.warn(chalk.dim("No selection — back to the menu."));
        continue;
      }
      const ok = await p.confirm({
        message: `Update ${chalk.cyan(selected.join(", "))}?`,
        initialValue: true,
      });
      if (p.isCancel(ok)) {
        p.log.message(chalk.dim("Back to the menu."));
        continue;
      }
      if (!ok) continue;

      try {
        await runInstallMany(cwd, selected, { checkout });
      } catch {
        p.log.error(chalk.red("Update failed."));
      }
      lock = await readLockOrEmpty(cwd);
      continue;
    }

    if (action === "install") {
      if (available.length === 0) {
        p.log.warn(
          chalk.dim("Nothing left to install — everything in the registry is already installed."),
        );
        continue;
      }
      p.log.message(chalk.dim("Space toggle · Enter confirm · Esc back"));
      const selected = await p.multiselect({
        message: "Skills to install",
        options: available.map((id) => ({ value: id, label: id })),
        required: false,
      });
      if (p.isCancel(selected)) {
        p.log.message(chalk.dim("Back to the menu."));
        continue;
      }
      if (selected.length === 0) {
        p.log.warn(chalk.dim("No selection — back to the menu."));
        continue;
      }
      const ok = await p.confirm({
        message: `Install ${chalk.cyan(selected.join(", "))}?`,
        initialValue: true,
      });
      if (p.isCancel(ok)) {
        p.log.message(chalk.dim("Back to the menu."));
        continue;
      }
      if (!ok) continue;

      await runInstallMany(cwd, selected, { checkout });
      lock = await readLockOrEmpty(cwd);
      continue;
    }

    if (action === "uninstall") {
      if (installedIds.length === 0) {
        p.log.warn(chalk.dim("Nothing installed yet."));
        continue;
      }
      p.log.message(chalk.dim("Space toggle · Enter confirm · Esc back"));
      const selected = await p.multiselect({
        message: "Skills to remove",
        options: installedIds.map((id) => ({ value: id, label: id })),
        required: false,
      });
      if (p.isCancel(selected)) {
        p.log.message(chalk.dim("Back to the menu."));
        continue;
      }
      if (selected.length === 0) {
        p.log.warn(chalk.dim("No selection — back to the menu."));
        continue;
      }
      const ok = await p.confirm({
        message: `Remove ${chalk.cyan(selected.join(", "))}?`,
        initialValue: false,
      });
      if (p.isCancel(ok)) {
        p.log.message(chalk.dim("Back to the menu."));
        continue;
      }
      if (!ok) continue;

      const toRemove = [...selected].sort((a, b) => a.localeCompare(b));
      for (const id of toRemove) {
        await runUninstall(cwd, id);
      }
      lock = await readLockOrEmpty(cwd);
    }
  }
}
