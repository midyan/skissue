#!/usr/bin/env tsx

/**
 * Validates that structured logging is used instead of console.*
 * in src/ (outside src/cli/, src/commands/, and src/entry.ts).
 * Exit 0 = all good, 1 = violations found.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname ?? ".", "../../..");

export interface LogViolation {
  file: string;
  line: number;
  text: string;
}

const CONSOLE_PATTERN = /\bconsole\.(log|error|warn|info|debug)\b/;

export function validateLogging(srcDir: string): LogViolation[] {
  const violations: LogViolation[] = [];
  const repoRoot = resolve(srcDir);

  function scanDir(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        // Skip cli/ and commands/ — CLI output is allowed there
        if (entry === "cli" || entry === "commands") continue;
        scanDir(full);
        continue;
      }
      if (!full.endsWith(".ts") || full.endsWith(".test.ts") || full.endsWith(".d.ts")) continue;

      const relFromRoot = full.replace(repoRoot + "/", "");
      if (relFromRoot === "src/entry.ts") continue;

      const content = readFileSync(full, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (CONSOLE_PATTERN.test(lines[i]!)) {
          violations.push({
            file: relFromRoot,
            line: i + 1,
            text: lines[i]!.trim(),
          });
        }
      }
    }
  }

  const srcPath = join(srcDir, "src");
  if (statSync(srcPath, { throwIfNoEntry: false })?.isDirectory()) {
    scanDir(srcPath);
  }

  return violations;
}

const isCLI = process.argv[1]?.includes("validate-logging/hard/index.ts") ?? false;

if (isCLI) {
  const violations = validateLogging(ROOT);
  if (violations.length === 0) {
    console.log("check:logging — all logging uses structured logger.");
    process.exit(0);
  } else {
    console.error(`check:logging — found ${violations.length} violation(s):\n`);
    for (const v of violations) {
      console.error(`  [console-usage] ${v.file}:${v.line}`);
      console.error(`    Use logger.info/warn/error from src/utils/logger.ts instead\n`);
    }
    process.exit(1);
  }
}
