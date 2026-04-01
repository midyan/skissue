#!/usr/bin/env tsx

/**
 * Discovers registry hard skills and runs the repo's full verification pipeline.
 * Uses `npm run verify` when package.json defines it; otherwise runs a sensible
 * fallback chain from available scripts. Never part of check:all (see .no-auto-run).
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { harnessRepoRoot } from "../../harness-root.js";

const ROOT = harnessRepoRoot(import.meta.dirname!);

export interface HardSkillDiscovery {
  id: string;
  /** True when harness/runner.ts will execute this skill's hard/index.ts */
  runsInCheckAll: boolean;
  /** Present when runsInCheckAll is false */
  excludeReason?: "no-auto-run";
}

/**
 * Lists every `harness/<id>/hard/index.ts` and whether it participates in check:all.
 */
export function discoverHardSkills(registryDir: string): HardSkillDiscovery[] {
  const out: HardSkillDiscovery[] = [];
  if (!statSync(registryDir, { throwIfNoEntry: false })?.isDirectory()) {
    return out;
  }

  for (const name of readdirSync(registryDir)) {
    if (name.startsWith(".")) continue;
    const full = join(registryDir, name);
    if (!statSync(full).isDirectory()) continue;
    const hardIndex = join(full, "hard", "index.ts");
    if (!existsSync(hardIndex)) continue;

    const noAuto = existsSync(join(full, "hard", ".no-auto-run"));
    out.push({
      id: name,
      runsInCheckAll: !noAuto,
      excludeReason: noAuto ? "no-auto-run" : undefined,
    });
  }

  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export type VerifyPlan =
  | { kind: "npm-verify"; command: string }
  | { kind: "steps"; steps: Array<{ label: string; argv: string[] }> };

export function readPackageScripts(root: string): Record<string, string> | undefined {
  const p = join(root, "package.json");
  if (!existsSync(p)) return undefined;
  try {
    const pkg = JSON.parse(readFileSync(p, "utf8")) as { scripts?: Record<string, string> };
    return pkg.scripts;
  } catch {
    return undefined;
  }
}

/**
 * Prefer a single `verify` npm script; else build a fallback from typical scripts + tsc.
 */
export function resolveVerifyPlan(root: string): VerifyPlan {
  const scripts = readPackageScripts(root);
  if (scripts?.verify?.trim()) {
    return { kind: "npm-verify", command: "verify" };
  }

  const steps: Array<{ label: string; argv: string[] }> = [];
  if (existsSync(join(root, "tsconfig.json"))) {
    steps.push({ label: "tsc --noEmit", argv: ["npx", "tsc", "--noEmit"] });
  }

  const afterTsc = [
    "lint",
    "format:check",
    "test",
    "check:all",
    "check:harness-score",
    "build",
  ] as const;
  for (const name of afterTsc) {
    if (scripts?.[name]?.trim()) {
      steps.push({ label: `npm run ${name}`, argv: ["npm", "run", name] });
    }
  }

  return { kind: "steps", steps };
}

function printDiscovery(registryDir: string): void {
  const skills = discoverHardSkills(registryDir);
  const inRunner = skills.filter((s) => s.runsInCheckAll);
  const skipped = skills.filter((s) => !s.runsInCheckAll);

  console.log(
    `repo-verify — ${skills.length} skill(s) with hard/index.ts; ${inRunner.length} in check:all, ${skipped.length} excluded (.no-auto-run).`,
  );
  if (inRunner.length > 0) {
    console.log(`  check:all: ${inRunner.map((s) => s.id).join(", ")}`);
  }
  if (skipped.length > 0) {
    console.log(`  excluded: ${skipped.map((s) => s.id).join(", ")}`);
  }
  console.log("");
}

export function runPlan(root: string, plan: VerifyPlan, dryRun: boolean): boolean {
  if (plan.kind === "npm-verify") {
    console.log(dryRun ? `[plan] npm run ${plan.command}` : `Running: npm run ${plan.command}\n`);
    if (dryRun) return true;
    const r = spawnSync("npm", ["run", plan.command], {
      cwd: root,
      stdio: "inherit",
      shell: false,
    });
    return r.status === 0;
  }

  if (plan.steps.length === 0) {
    console.error(
      "repo-verify — no verification steps found (add a `verify` script or lint/test/check:all in package.json).",
    );
    return false;
  }

  for (const step of plan.steps) {
    console.log(dryRun ? `[plan] ${step.label}` : `\n→ ${step.label}\n`);
    if (dryRun) continue;
    const r = spawnSync(step.argv[0]!, step.argv.slice(1), {
      cwd: root,
      stdio: "inherit",
      shell: false,
    });
    if (r.status !== 0) return false;
  }
  return true;
}

function parseArgs(argv: string[]): { dryRun: boolean; discoverOnly: boolean } {
  let dryRun = false;
  let discoverOnly = false;
  for (const a of argv) {
    if (a === "--plan" || a === "-n" || a === "--dry-run") dryRun = true;
    if (a === "--discover" || a === "--list-skills") discoverOnly = true;
  }
  return { dryRun, discoverOnly };
}

const isCLI = Boolean(process.argv[1]?.includes("repo-verify/hard/index.ts"));

if (isCLI) {
  const { dryRun, discoverOnly } = parseArgs(process.argv.slice(2));
  const harnessDir = join(ROOT, "harness");

  printDiscovery(harnessDir);

  if (discoverOnly) {
    console.log("repo-verify — --discover only; no commands run.");
    process.exit(0);
  }

  const plan = resolveVerifyPlan(ROOT);
  const ok = runPlan(ROOT, plan, dryRun);

  if (dryRun) {
    console.log("\nrepo-verify — dry run finished (no commands executed).");
    process.exit(0);
  }

  if (ok) {
    console.log("\nrepo-verify — all steps passed.");
    process.exit(0);
  }
  console.error("\nrepo-verify — one or more steps failed.");
  process.exit(1);
}
