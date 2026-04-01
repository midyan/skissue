import * as p from "@clack/prompts";
import chalk from "chalk";
import { existsSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execGit } from "../git/exec.js";
import { requiredTrimmed } from "./prompt-validators.js";

/**
 * Default single-skill id for init-registry — soft skill from this repo’s agent skills, useful in any project with Markdown.
 */
export const DEFAULT_REGISTRY_SKILL_ID = "validate-links";

/** Returns an error message if invalid; otherwise undefined. */
export function validateSkillId(raw: string): string | undefined {
  const id = raw.trim();
  if (!id) return "Skill id is required";
  if (id.includes("/") || id.includes("\\")) return "Use a single segment (no path separators)";
  if (id === "." || id === ".." || id.includes("..")) return "Invalid skill id";
  return undefined;
}

/** Clack `text` wrapper — keeps the prompt validator covered in tests. */
export function validateSkillIdPrompt(v: unknown): string | undefined {
  return validateSkillId(String(v ?? ""));
}

/** True if `registry/` exists and is a directory at root (skills live under it). */
export function registryDirectoryExists(root: string): boolean {
  const regDir = join(root, "registry");
  if (!existsSync(regDir)) return false;
  try {
    return statSync(regDir).isDirectory();
  } catch {
    return false;
  }
}

/** True if `registry.json` exists or a `registry/` directory already exists at root. */
export function registryLayoutExists(root: string): boolean {
  const jsonPath = join(root, "registry.json");
  const regDir = join(root, "registry");
  if (existsSync(jsonPath)) return true;
  if (!existsSync(regDir)) return false;
  try {
    return statSync(regDir).isDirectory();
  } catch {
    return false;
  }
}

function skillMarkdown(skillId: string): string {
  if (skillId === DEFAULT_REGISTRY_SKILL_ID) {
    return `---
name: validate-links
description: Scan markdown for broken relative links across the repo.
---

# validate-links (soft)

Use before large doc moves or when CI reports broken links. A **hard** implementation walks \`*.md\` files and checks that \`[text](relative)\` targets resolve.

Add a \`hard/\` directory when you want automated checks (for example a small script or \`npm run check:links\` wired to the same rules).
`;
  }

  const title = skillId
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return `---
name: ${skillId}
description: Starter skill scaffolded by skissue init-registry. Replace this description.
---

# ${title}

A minimal starter skill for your registry.

## When to use

Describe when an agent should apply this skill (customize this section).

## Instructions

1. Edit this file to describe what the agent should do.
2. Optionally add \`hard/\` with executable checks.
`;
}

export type ScaffoldMinimalRegistryResult = {
  root: string;
  skillId: string;
  gitInitRan: boolean;
  committed: boolean;
};

/**
 * Stage scaffolded files and create a commit when needed so `git rev-parse HEAD` works
 * (required by local `ensureRegistryCheckout`).
 */
export async function commitScaffoldedRegistry(
  root: string,
  skillId: string,
): Promise<{
  committed: boolean;
}> {
  const gitDir = join(root, ".git");
  if (!existsSync(gitDir)) {
    return { committed: false };
  }

  const regSkillPath = `registry/${skillId}`;
  const addJson = await execGit(["add", "registry.json"], { cwd: root });
  if (addJson.code !== 0) {
    throw new Error(
      `git add registry.json failed: ${addJson.stderr || addJson.stdout || `exit ${addJson.code}`}`,
    );
  }
  const addSkill = await execGit(["add", regSkillPath], { cwd: root });
  if (addSkill.code !== 0) {
    throw new Error(
      `git add ${regSkillPath} failed: ${addSkill.stderr || addSkill.stdout || `exit ${addSkill.code}`}`,
    );
  }

  const diff = await execGit(["diff", "--cached", "--quiet"], { cwd: root });
  const hasStaged = diff.code === 1;

  if (hasStaged) {
    const commit = await execGit(["commit", "-m", "chore: scaffold skill registry"], { cwd: root });
    if (commit.code !== 0) {
      throw new Error(
        `git commit failed. Configure git user.name and user.email in this repo or globally. ${(commit.stderr || commit.stdout || "").trim()}`,
      );
    }
    return { committed: true };
  }

  const head = await execGit(["rev-parse", "HEAD"], { cwd: root });
  if (head.code !== 0) {
    throw new Error(
      "Local registry must have at least one git commit so installs can resolve HEAD. Stage and commit the scaffolded files, or run git commit.",
    );
  }

  return { committed: false };
}

export type MinimalRegistryScaffoldPrompts = {
  skillId: string;
  runGitInit: boolean;
  hadGit: boolean;
};

/**
 * Overwrite check, skill id, and optional `git init` prompt. Returns `null` if the user cancels.
 */
export async function promptMinimalRegistryScaffold(
  root: string,
): Promise<MinimalRegistryScaffoldPrompts | null> {
  const exists = registryLayoutExists(root);
  if (exists) {
    const ok = await p.confirm({
      message: `${chalk.yellow("registry.json and/or registry/ already exist here.")} Replace with a minimal single-skill layout?`,
      initialValue: false,
    });
    if (p.isCancel(ok) || !ok) {
      return null;
    }
  }

  const idRaw = await p.text({
    message: "Skill id (folder name under registry/)",
    initialValue: DEFAULT_REGISTRY_SKILL_ID,
    validate: validateSkillIdPrompt,
  });
  if (p.isCancel(idRaw)) {
    return null;
  }
  const skillId = String(idRaw).trim();

  const gitDir = join(root, ".git");
  const hadGit = existsSync(gitDir);
  let runGitInit = false;
  if (!hadGit) {
    const initGit = await p.confirm({
      message:
        "No git repository here yet. Run `git init`? (recommended — skissue local registry mode needs a git repo)",
      initialValue: true,
    });
    if (p.isCancel(initGit)) {
      return null;
    }
    runGitInit = Boolean(initGit);
  }

  return { skillId, runGitInit, hadGit };
}

/**
 * Writes `registry.json` and `registry/<skillId>/SKILL.md`. Optionally runs `git init` in `root`.
 * Does not prompt; callers handle overwrite policy. Creates a git commit when `.git` exists so HEAD resolves.
 */
export async function scaffoldMinimalRegistry(params: {
  root: string;
  skillId: string;
  runGitInit: boolean;
}): Promise<ScaffoldMinimalRegistryResult> {
  const { root, skillId, runGitInit } = params;
  const regPath = `registry/${skillId}`;
  const manifest = { skills: { [skillId]: regPath } };
  await mkdir(join(root, regPath), { recursive: true });
  await writeFile(join(root, "registry.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(join(root, regPath, "SKILL.md"), skillMarkdown(skillId), "utf8");

  let gitInitRan = false;
  if (runGitInit) {
    const r = await execGit(["init"], { cwd: root });
    if (r.code === 0) {
      gitInitRan = true;
    } else {
      throw new Error(`git init failed: ${r.stderr || r.stdout || `exit ${r.code}`}`);
    }
  }

  const { committed } = await commitScaffoldedRegistry(root, skillId);

  return { root, skillId, gitInitRan, committed };
}

export async function runInitRegistry(cwd: string): Promise<void> {
  p.intro(chalk.bold("skissue init-registry"));

  const where = await p.select({
    message: "Where should the skill registry live?",
    options: [
      { value: "here" as const, label: "Current directory — create registry files here" },
      { value: "other" as const, label: "Another directory — I will enter the path" },
    ],
    initialValue: "here",
  });
  if (p.isCancel(where)) {
    p.cancel("Aborted.");
    process.exit(0);
    return;
  }

  let root: string;
  if (where === "here") {
    root = resolve(cwd);
  } else {
    const raw = await p.text({
      message: "Path to registry root (absolute or relative to current directory)",
      placeholder: "../my-skill-registry",
      validate: requiredTrimmed,
    });
    if (p.isCancel(raw)) {
      p.cancel("Aborted.");
      process.exit(0);
      return;
    }
    root = resolve(cwd, String(raw).trim());
  }

  const prompted = await promptMinimalRegistryScaffold(root);
  if (!prompted) {
    p.cancel("Aborted. No files were changed.");
    process.exit(0);
    return;
  }
  const { skillId, runGitInit, hadGit } = prompted;

  try {
    const result = await scaffoldMinimalRegistry({ root, skillId, runGitInit });
    if (!hadGit && !result.gitInitRan) {
      p.note(
        "This folder is not a git repository. Run `git init` before using it as a local skissue registry.",
        chalk.yellow("Heads up"),
      );
    }
    p.outro(
      chalk.green(
        `Wrote ${chalk.cyan("registry.json")} and ${chalk.cyan(`registry/${skillId}/SKILL.md`)} under ${chalk.cyan(result.root)}`,
      ),
    );
  } catch (e) {
    p.cancel(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  }
}
