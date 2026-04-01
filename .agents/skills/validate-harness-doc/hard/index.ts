#!/usr/bin/env tsx

/**
 * Ensures docs/HARNESS.md exists with enough substance to capture engineering rules.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname ?? ".", "../../..");

export interface Violation {
  rule: string;
  detail: string;
}

export interface ValidateHarnessDocOptions {
  /** Minimum non-empty lines (after trim). Default 12 or HARNESS_MIN_LINES env. */
  minNonEmptyLines?: number;
}

function parseMinLines(): number {
  const raw = process.env.HARNESS_MIN_LINES;
  if (raw !== undefined && raw.trim() !== "") {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 12;
}

export function validateHarnessDoc(root: string, opts?: ValidateHarnessDocOptions): Violation[] {
  const violations: Violation[] = [];
  const minNonEmpty = opts?.minNonEmptyLines ?? parseMinLines();
  const path = join(root, "docs", "HARNESS.md");

  if (!existsSync(path)) {
    violations.push({
      rule: "missing-harness-doc",
      detail:
        "docs/HARNESS.md not found. Add docs/HARNESS.md for engineering rules, constraints, validation commands, and harness philosophy (see implement-ai-harness skill).",
    });
    return violations;
  }

  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    violations.push({
      rule: "unreadable",
      detail: `Cannot read docs/HARNESS.md: ${e instanceof Error ? e.message : String(e)}`,
    });
    return violations;
  }

  const nonEmptyLines = text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;

  if (nonEmptyLines < minNonEmpty) {
    violations.push({
      rule: "harness-too-thin",
      detail: `docs/HARNESS.md has only ${nonEmptyLines} non-empty lines (min ${minNonEmpty}). Expand with principles, validation commands, and constraints. Set HARNESS_MIN_LINES to override.`,
    });
  }

  return violations;
}

const isCLI = process.argv[1]?.includes("validate-harness-doc/hard/index.ts") ?? false;

if (isCLI) {
  const violations = validateHarnessDoc(ROOT);
  if (violations.length === 0) {
    console.log("check:harness-doc — docs/HARNESS.md looks good.");
    process.exit(0);
  }
  console.error(`check:harness-doc — ${violations.length} issue(s):\n`);
  for (const v of violations) {
    console.error(`  [${v.rule}] ${v.detail}\n`);
  }
  process.exit(1);
}
