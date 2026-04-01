#!/usr/bin/env tsx

/**
 * Validates that child_process imports only appear in allowed locations.
 * Exit 0 = all good, 1 = violations found.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { harnessRepoRoot } from "../../harness-root.js";

const ROOT = harnessRepoRoot(import.meta.dirname!);

const ALLOWED_FILES = new Set(["src/git/exec.ts", "src/tmux/session.ts", "src/utils/shell.ts"]);

export interface ShellViolation {
  file: string;
  line: number;
  text: string;
}

const CHILD_PROCESS_PATTERN =
  /(?:from\s+['"]node:child_process['"]|require\s*\(\s*['"](?:node:)?child_process['"]\s*\))/;

export function validateShellExec(srcDir: string): ShellViolation[] {
  const violations: ShellViolation[] = [];

  function scanDir(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        scanDir(full);
        continue;
      }
      if (!full.endsWith(".ts") || full.endsWith(".test.ts") || full.endsWith(".d.ts")) continue;

      const rel = full.replace(srcDir + "/", "");
      if (ALLOWED_FILES.has(rel)) continue;

      const content = readFileSync(full, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (CHILD_PROCESS_PATTERN.test(lines[i]!)) {
          violations.push({
            file: full.replace(ROOT + "/", ""),
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

const isCLI = Boolean(process.argv[1]?.includes("validate-shell-exec/hard/index.ts"));

if (isCLI) {
  const violations = validateShellExec(ROOT);
  if (violations.length === 0) {
    console.log("check:shell-exec — all child_process usage is properly routed.");
    process.exit(0);
  } else {
    console.error(`check:shell-exec — found ${violations.length} violation(s):\n`);
    for (const v of violations) {
      console.error(`  [inline-shell] ${v.file}:${v.line}`);
      console.error(`    Use src/utils/shell.ts or src/tmux/session.ts instead\n`);
    }
    process.exit(1);
  }
}
