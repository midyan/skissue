#!/usr/bin/env tsx

/**
 * Verifies that every directory with 2+ children has an INDEX.md (or AGENTS.md at root),
 * and that every index accurately reflects its directory contents.
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { harnessRepoRoot } from "../../harness-root.js";

/** Resolve each time so tests can change `SKISSUE_HARNESS_ROOT` without a stale module snapshot. */
function repoRoot(): string {
  return harnessRepoRoot(import.meta.dirname!);
}

const EXCLUDED = new Set(["node_modules", ".git", "coverage", "dist", ".cursor"]);

const ROOT_IGNORED = new Set([
  ".gitignore",
  ".nvmrc",
  ".husky",
  ".skill-issue",
  "README.md",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "eslint.config.js",
  "esbuild.config.js",
  "vitest.config.ts",
  ".prettierrc.json",
  ".prettierignore",
  "registry.json",
  "AGENTS.md",
]);

export interface Violation {
  directory: string;
  kind: "missing-index" | "unlisted-child" | "orphaned-entry";
  detail: string;
}

const violations: Violation[] = [];

function relPath(abs: string, root: string): string {
  return abs.replace(root + "/", "");
}

function getChildren(dir: string, root: string): string[] {
  return readdirSync(dir).filter((name) => {
    if (EXCLUDED.has(name)) return false;
    if (name === "INDEX.md") return false;
    if (dir === root && ROOT_IGNORED.has(name)) {
      return false;
    }
    if (dir === root && name.endsWith(".tgz")) {
      return false;
    }
    return true;
  });
}

/**
 * Parse the Contents table from an INDEX.md and extract linked names.
 * Matches markdown links: `[name](target)` after a pipe (table rows).
 */
export function parseIndexLinks(content: string): Set<string> {
  const links = new Set<string>();
  const linkPattern = /\|\s*\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = linkPattern.exec(content)) !== null) {
    const target = match[2]!;
    const normalized = target.replace(/\/$/, "");
    links.add(normalized);
  }
  return links;
}

function resolveIndexPath(dir: string, root: string): string | undefined {
  const indexMd = join(dir, "INDEX.md");
  if (existsSync(indexMd)) return indexMd;

  if (dir === root) {
    const agentsMd = join(dir, "AGENTS.md");
    if (existsSync(agentsMd)) return agentsMd;
  }
  return undefined;
}

function checkDirectory(dir: string, root: string): void {
  const children = getChildren(dir, root);

  if (children.length < 2) return;

  const indexPath = resolveIndexPath(dir, root);
  const rel = relPath(dir, root);

  if (indexPath === undefined) {
    violations.push({
      directory: rel,
      kind: "missing-index",
      detail: `Directory has ${children.length} children but no INDEX.md`,
    });
    return;
  }

  const indexContent = readFileSync(indexPath, "utf-8");
  const rawLinks = parseIndexLinks(indexContent);

  const linkedNames = dir === root ? new Set([...rawLinks].map((l) => l.split("/")[0]!)) : rawLinks;

  for (const child of children) {
    if (!linkedNames.has(child)) {
      violations.push({
        directory: rel,
        kind: "unlisted-child",
        detail: `"${child}" exists in directory but is not listed in INDEX.md`,
      });
    }
  }

  const childSet = new Set(children);
  for (const linked of rawLinks) {
    const target = dir === root ? linked.split("/")[0]! : linked;
    if (!childSet.has(target)) {
      const fullPath = join(dir, linked);
      if (!existsSync(fullPath)) {
        violations.push({
          directory: rel,
          kind: "orphaned-entry",
          detail: `INDEX.md links to "${linked}" but it does not exist`,
        });
      }
    }
  }

  for (const child of children) {
    const childPath = join(dir, child);
    if (statSync(childPath).isDirectory()) {
      checkDirectory(childPath, root);
    }
  }
}

/** Runs the full index check (honors `SKISSUE_HARNESS_ROOT` each call). For tests. */
export function runValidateIndexes(): Violation[] {
  violations.length = 0;
  const root = repoRoot();
  checkDirectory(root, root);
  return violations.slice();
}

const isCLI = Boolean(process.argv[1]?.includes("validate-indexes/hard/index.ts"));

if (isCLI) {
  violations.length = 0;
  const root = repoRoot();
  checkDirectory(root, root);

  if (violations.length === 0) {
    console.log("check:indexes — all INDEX.md files are up to date.");
    process.exit(0);
  } else {
    console.error(`check:indexes — found ${violations.length} violation(s):\n`);
    for (const v of violations) {
      console.error(`  [${v.kind}] ${v.directory}/`);
      console.error(`    ${v.detail}\n`);
    }
    process.exit(1);
  }
}
