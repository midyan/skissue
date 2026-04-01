#!/usr/bin/env tsx

/**
 * Runs every skill's hard component: `harness/<skill-id>/hard/index.ts`.
 */

import { readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const SKILLS_ROOT = resolve(import.meta.dirname);
const ROOT = resolve(SKILLS_ROOT, "..");
const TSX = join(ROOT, "node_modules", ".bin", "tsx");

interface SkillResult {
  id: string;
  passed: boolean;
}

const results: SkillResult[] = [];

const entries = readdirSync(SKILLS_ROOT).filter((name) => {
  if (name.startsWith(".")) return false;
  if (name === "node_modules") return false;
  const full = join(SKILLS_ROOT, name);
  if (!statSync(full).isDirectory()) return false;
  const hardIndex = join(full, "hard", "index.ts");
  if (!existsSync(hardIndex)) return false;
  if (existsSync(join(full, "hard", ".no-auto-run"))) return false;
  return true;
});

for (const id of entries.sort()) {
  const skillPath = join(SKILLS_ROOT, id, "hard", "index.ts");
  const child = spawnSync(TSX, [skillPath], {
    cwd: ROOT,
    encoding: "utf-8",
  });
  if (child.stdout) process.stdout.write(child.stdout);
  if (child.stderr) process.stderr.write(child.stderr);
  results.push({ id, passed: child.status === 0 });
}

const passed = results.filter((r) => r.passed).length;
const total = results.length;

console.log(`\ncheck:all — ${passed}/${total} hard skill component(s) passed.`);

if (passed < total) {
  const failed = results.filter((r) => !r.passed).map((r) => r.id);
  console.error(`Failed: ${failed.join(", ")}`);
  process.exit(1);
}
