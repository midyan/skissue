import * as p from "@clack/prompts";
import chalk from "chalk";
import { existsSync, statSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import {
  ConfigSchema,
  type Config,
  writeConfig,
  defaultConfigTemplate,
  loadConfig,
} from "../config.js";
import { execGit } from "../git/exec.js";
import { resolveRegistryTransport } from "../git/registry-repo.js";
import { configPath, skillIssueDir } from "../paths.js";
import {
  promptMinimalRegistryScaffold,
  registryDirectoryExists,
  registryLayoutExists,
  scaffoldMinimalRegistry,
} from "./init-registry.js";
import { requiredTrimmed } from "./prompt-validators.js";

async function gitBranchShowCurrent(root: string): Promise<string | undefined> {
  const r = await execGit(["branch", "--show-current"], { cwd: root });
  if (r.code !== 0) return undefined;
  const b = r.stdout.trim();
  return b.length > 0 ? b : undefined;
}

/** Relative path from consumer cwd to registry root for config.yaml (`.` when same directory). */
export function localRegistryPathForConfig(cwd: string, resolvedRoot: string): string {
  const rel = relative(cwd, resolvedRoot);
  if (!rel || rel === "") return ".";
  return rel;
}

export function summarizeConfig(cfg: Config): string {
  const r = cfg.registry;
  if (r.path?.trim()) {
    return `Local registry: ${r.path}\nBranch label: ${r.branch}\nskillsRoot: ${cfg.skillsRoot}`;
  }
  const t = resolveRegistryTransport(cfg);
  const mode =
    r.useSsh === undefined
      ? `${t.toUpperCase()} (auto)`
      : `${t.toUpperCase()} (registry.useSsh: ${r.useSsh})`;
  return `Remote registry: ${r.owner}/${r.repo}\nTransport: ${mode}\nBranch: ${r.branch}\nskillsRoot: ${cfg.skillsRoot}`;
}

type LocalBootstrapOutcome =
  | { ok: true; cfg: Config; bootstrappedSkillId?: string }
  | { ok: false; exitCode?: number };

async function runLocalBootstrapFlow(
  cwd: string,
  resolvedRoot: string,
): Promise<LocalBootstrapOutcome> {
  const atConsumerRoot = resolvedRoot === resolve(cwd);
  if (atConsumerRoot && !registryLayoutExists(resolvedRoot)) {
    const okRoot = await p.confirm({
      message: "This adds registry.json and registry/ at your project root. Continue?",
      initialValue: true,
    });
    if (p.isCancel(okRoot) || !okRoot) {
      p.cancel("Aborted.");
      return { ok: false, exitCode: 0 };
    }
  }

  const prompted = await promptMinimalRegistryScaffold(resolvedRoot);
  if (!prompted) {
    p.cancel("Aborted. No files were changed.");
    return { ok: false, exitCode: 0 };
  }

  let result: Awaited<ReturnType<typeof scaffoldMinimalRegistry>>;
  try {
    result = await scaffoldMinimalRegistry({
      root: resolvedRoot,
      skillId: prompted.skillId,
      runGitInit: prompted.runGitInit,
    });
  } catch (e) {
    p.cancel(e instanceof Error ? e.message : String(e));
    return { ok: false, exitCode: 1 };
  }

  if (!prompted.hadGit && !result.gitInitRan) {
    p.note(
      "This folder is not a git repository. Run `git init` before using it as a local skissue registry.",
      chalk.yellow("Heads up"),
    );
  }

  const branchDefault = (await gitBranchShowCurrent(resolvedRoot)) ?? "main";
  const branch = await p.text({
    message: "Branch label (stored in config; installs use git HEAD from that directory)",
    initialValue: branchDefault,
    validate: requiredTrimmed,
  });
  if (p.isCancel(branch)) {
    p.cancel("Aborted.");
    return { ok: false, exitCode: 0 };
  }

  const cfg = ConfigSchema.parse({
    registry: {
      path: localRegistryPathForConfig(cwd, resolvedRoot),
      branch: String(branch).trim(),
    },
    skillsRoot: ".agents/skills",
  });

  return { ok: true, cfg, bootstrappedSkillId: result.skillId };
}

export async function runInit(cwd: string): Promise<void> {
  p.intro(chalk.bold("skissue init"));

  const existingPath = configPath(cwd);
  let hasExistingConfig = false;
  if (existsSync(existingPath)) {
    hasExistingConfig = true;
    try {
      const existing = await loadConfig(cwd);
      p.note(summarizeConfig(existing), "Current config");
    } catch (err) {
      p.note(err instanceof Error ? err.message : String(err), "Existing config (could not parse)");
    }
    const overwrite = await p.confirm({
      message: "Overwrite existing .skill-issue/config.yaml?",
      initialValue: false,
    });
    if (p.isCancel(overwrite) || !overwrite) {
      p.cancel("Aborted. Existing config unchanged.");
      process.exit(0);
    }
  }

  const source = await p.select({
    message: "Where does the skill registry live?",
    options: [
      {
        value: "local" as const,
        label: "Local directory — skill-registry repo root (registry.json + registry/)",
      },
      {
        value: "remote" as const,
        label: "GitHub — clone registry from owner/repo",
      },
    ],
    initialValue: "local",
  });
  if (p.isCancel(source)) {
    p.cancel("Aborted.");
    process.exit(0);
  }

  let cfg: Config;
  let bootstrappedSkillId: string | undefined;

  if (source === "local") {
    const localMode = await p.select({
      message: "Local registry setup",
      options: [
        {
          value: "existing" as const,
          label: "Use an existing registry folder (registry.json + registry/)",
        },
        {
          value: "bootstrap" as const,
          label: "Bootstrap a minimal sample registry",
        },
      ],
      initialValue: "existing",
    });
    if (p.isCancel(localMode)) {
      p.cancel("Aborted.");
      process.exit(0);
    }

    if (localMode === "existing") {
      const regPath = await p.text({
        message:
          "Path to registry repo root (relative to this project or absolute). Must contain registry/ and be a git repository.",
        placeholder: ".",
        initialValue: ".",
        validate: requiredTrimmed,
      });
      if (p.isCancel(regPath)) {
        p.cancel("Aborted.");
        process.exit(0);
      }

      const resolvedExisting = resolve(cwd, String(regPath).trim());
      if (!existsSync(resolvedExisting) || !statSync(resolvedExisting).isDirectory()) {
        p.cancel(`Path does not exist or is not a directory: ${resolvedExisting}`);
        process.exitCode = 1;
        return;
      }

      if (!registryDirectoryExists(resolvedExisting)) {
        const pathLabel = String(regPath).trim() || ".";
        const bootstrapHere = await p.confirm({
          message: `${chalk.yellow("No registry/ directory")} at ${chalk.cyan(pathLabel)}. Bootstrap a minimal sample registry (registry.json + registry/<skill>) here?`,
          initialValue: true,
        });
        if (p.isCancel(bootstrapHere)) {
          p.cancel("Aborted.");
          process.exit(0);
        }
        if (!bootstrapHere) {
          p.cancel(
            "Aborted. Create a registry/ folder in that directory, or run skissue init and choose Bootstrap a minimal sample registry.",
          );
          process.exit(0);
        }

        const outcome = await runLocalBootstrapFlow(cwd, resolvedExisting);
        if (!outcome.ok) {
          if (outcome.exitCode === 1) {
            process.exitCode = 1;
          } else {
            process.exit(0);
          }
          return;
        }
        cfg = outcome.cfg;
        bootstrappedSkillId = outcome.bootstrappedSkillId;
      } else {
        const branchDefault = (await gitBranchShowCurrent(resolvedExisting)) ?? "main";
        const branch = await p.text({
          message: "Branch label (stored in config; installs use git HEAD from that directory)",
          initialValue: branchDefault,
          validate: requiredTrimmed,
        });
        if (p.isCancel(branch)) {
          p.cancel("Aborted.");
          process.exit(0);
        }

        cfg = ConfigSchema.parse({
          registry: {
            path: String(regPath).trim(),
            branch: String(branch).trim(),
          },
          skillsRoot: ".agents/skills",
        });
      }
    } else {
      const pathRaw = await p.text({
        message: "Path for the new registry root (relative to this project or absolute)",
        placeholder: "./skill-registry",
        initialValue: "./skill-registry",
        validate: requiredTrimmed,
      });
      if (p.isCancel(pathRaw)) {
        p.cancel("Aborted.");
        process.exit(0);
      }

      const resolvedRoot = resolve(cwd, String(pathRaw).trim());
      const outcome = await runLocalBootstrapFlow(cwd, resolvedRoot);
      if (!outcome.ok) {
        if (outcome.exitCode === 1) {
          process.exitCode = 1;
        } else {
          process.exit(0);
        }
        return;
      }
      cfg = outcome.cfg;
      bootstrappedSkillId = outcome.bootstrappedSkillId;
    }
  } else {
    const owner = await p.text({
      message: "GitHub registry owner (org or user)",
      placeholder: "acme",
      validate: requiredTrimmed,
    });
    if (p.isCancel(owner)) {
      p.cancel("Aborted.");
      process.exit(0);
    }

    const repo = await p.text({
      message: "Registry repository name",
      placeholder: "skill-registry",
      validate: requiredTrimmed,
    });
    if (p.isCancel(repo)) {
      p.cancel("Aborted.");
      process.exit(0);
    }

    const branch = await p.text({
      message: "Branch to track",
      initialValue: "main",
      validate: requiredTrimmed,
    });
    if (p.isCancel(branch)) {
      p.cancel("Aborted.");
      process.exit(0);
    }

    cfg = ConfigSchema.parse({
      registry: {
        owner: String(owner).trim(),
        repo: String(repo).trim(),
        branch: String(branch).trim(),
      },
      skillsRoot: ".agents/skills",
    });
  }

  const skillsRoot = await p.text({
    message: "Install skills under (relative to project root)",
    initialValue: cfg.skillsRoot,
    validate: requiredTrimmed,
  });
  if (p.isCancel(skillsRoot)) {
    p.cancel("Aborted.");
    process.exit(0);
  }
  cfg = ConfigSchema.parse({ ...cfg, skillsRoot: String(skillsRoot).trim() });

  const confirm = await p.confirm({
    message: hasExistingConfig
      ? `Overwrite ${chalk.cyan(".skill-issue/config.yaml")} and use ${chalk.cyan(cfg.skillsRoot)} for installs?`
      : `Create ${chalk.cyan(".skill-issue/config.yaml")} and use ${chalk.cyan(cfg.skillsRoot)} for installs?`,
    initialValue: true,
  });
  if (p.isCancel(confirm) || !confirm) {
    p.cancel("Aborted.");
    process.exit(0);
  }

  const dir = skillIssueDir(cwd);
  await mkdir(dir, { recursive: true });
  await writeConfig(cwd, cfg);

  p.note(defaultConfigTemplate().trim(), "Template reference");
  const outroLines = bootstrappedSkillId
    ? [
        "Wrote .skill-issue/config.yaml.",
        `Try ${chalk.cyan(`skissue install ${bootstrappedSkillId}`)}, or run skissue for the manage menu.`,
      ]
    : ["Wrote .skill-issue/config.yaml. Run skissue install <id>, or skissue for the manage menu."];
  p.outro(chalk.green(outroLines.join(" ")));
}
