import { Command } from "commander";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };
import { runInit } from "./commands/init.js";
import { runInstall } from "./commands/install.js";
import { runUninstall } from "./commands/uninstall.js";
import { runList } from "./commands/list.js";
import { runOutdated } from "./commands/outdated.js";
import { runUpdate } from "./commands/update.js";
import { runDefault } from "./commands/default.js";
import { runDoctor } from "./commands/doctor.js";
import { runManage } from "./commands/manage.js";
import { runInitRegistry } from "./commands/init-registry.js";

const program = new Command();

program
  .name("skissue")
  .description("Install and sync agent skills from a GitHub registry or a local registry path")
  .version(pkg.version);

program
  .command("init-registry")
  .description("Scaffold a minimal git-backed skill registry (registry.json + sample skill)")
  .action(async () => {
    const cwd = process.cwd();
    try {
      await runInitRegistry(cwd);
    } catch (e) {
      console.error(e);
      process.exitCode = 1;
    }
  });

program
  .command("init")
  .description("Create .skill-issue/config and confirm skills install path")
  .action(async () => {
    const cwd = process.cwd();
    try {
      await runInit(cwd);
    } catch (e) {
      console.error(e);
      process.exitCode = 1;
    }
  });

program
  .command("install")
  .description("Install a skill by id from the registry")
  .argument("<id>", "Skill id")
  .action(async (id: string) => {
    const cwd = process.cwd();
    try {
      await runInstall(cwd, id);
    } catch {
      process.exitCode = 1;
    }
  });

program
  .command("uninstall")
  .description("Remove an installed skill and lock entry")
  .argument("<id>", "Skill id")
  .action(async (id: string) => {
    const cwd = process.cwd();
    try {
      await runUninstall(cwd, id);
    } catch {
      process.exitCode = 1;
    }
  });

program
  .command("list")
  .description("List installed skills and lock info")
  .action(async () => {
    const cwd = process.cwd();
    try {
      await runList(cwd);
    } catch {
      process.exitCode = 1;
    }
  });

program
  .command("manage")
  .alias("browse")
  .description("Interactive menu: install or uninstall skills from the registry")
  .action(async () => {
    const cwd = process.cwd();
    try {
      await runManage(cwd);
    } catch {
      process.exitCode = 1;
    }
  });

program
  .command("outdated")
  .description("Show skills whose registry path changed since lock")
  .action(async () => {
    const cwd = process.cwd();
    try {
      await runOutdated(cwd);
    } catch {
      process.exitCode = 1;
    }
  });

program
  .command("update")
  .description("Re-fetch and overwrite installed skill(s); refresh lock")
  .argument("[id]", "Optional skill id (default: all locked skills)")
  .action(async (id?: string) => {
    const cwd = process.cwd();
    try {
      await runUpdate(cwd, id);
    } catch {
      process.exitCode = 1;
    }
  });

program
  .command("doctor")
  .description("Check Node, config, and sync registry checkout")
  .option("-C, --cwd <path>", "Project root")
  .action(async (opts: { cwd?: string }) => {
    const cwd = resolve(opts.cwd ?? process.cwd());
    try {
      await runDoctor(cwd);
    } catch {
      process.exitCode = 1;
    }
  });

program.action(async () => {
  const cwd = process.cwd();
  try {
    await runDefault(cwd);
  } catch {
    process.exitCode = 1;
  }
});

program.parseAsync(process.argv).catch((e) => {
  console.error(e);
  process.exit(1);
});
