#!/usr/bin/env tsx

/**
 * Ensures a short root AGENTS.md exists — the harness entry map for agents.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname ?? ".", "../../..");

export interface Violation {
  rule: string;
  detail: string;
}

export interface ValidateAgentsOptions {
  /** Maximum total lines (including blank). Default 200 or AGENTS_MAX_LINES env. */
  maxLines?: number;
}

function parseMaxLines(): number {
  const raw = process.env.AGENTS_MAX_LINES;
  if (raw !== undefined && raw.trim() !== "") {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 200;
}

export function validateAgentsEntry(root: string, opts?: ValidateAgentsOptions): Violation[] {
  const violations: Violation[] = [];
  const maxLines = opts?.maxLines ?? parseMaxLines();
  const path = join(root, "AGENTS.md");

  if (!existsSync(path)) {
    violations.push({
      rule: "missing-agents",
      detail:
        "AGENTS.md not found at repo root. Add AGENTS.md as the agent entry map (links to docs/, INDEX navigation).",
    });
    return violations;
  }

  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    violations.push({
      rule: "unreadable",
      detail: `Cannot read AGENTS.md: ${e instanceof Error ? e.message : String(e)}`,
    });
    return violations;
  }

  if (text.trim().length === 0) {
    violations.push({
      rule: "empty-agents",
      detail:
        "AGENTS.md is empty. Add a short map: purpose, navigation links, and pointers to docs/.",
    });
    return violations;
  }

  const lineCount = text.split(/\r?\n/).length;
  if (lineCount > maxLines) {
    violations.push({
      rule: "agents-too-long",
      detail: `AGENTS.md has ${lineCount} lines (max ${maxLines}). Extract content to docs/ and keep AGENTS.md as a small map. Set AGENTS_MAX_LINES to override.`,
    });
  }

  return violations;
}

const isCLI = process.argv[1]?.includes("validate-agents-entry/hard/index.ts") ?? false;

if (isCLI) {
  const violations = validateAgentsEntry(ROOT);
  if (violations.length === 0) {
    console.log("check:agents-entry — AGENTS.md looks good.");
    process.exit(0);
  }
  console.error(`check:agents-entry — ${violations.length} issue(s):\n`);
  for (const v of violations) {
    console.error(`  [${v.rule}] ${v.detail}\n`);
  }
  process.exit(1);
}
