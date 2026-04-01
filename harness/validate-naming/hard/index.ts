#!/usr/bin/env tsx

/**
 * Validates naming conventions in the codebase.
 * - Files: kebab-case (e.g. my-module.ts)
 * - Types/interfaces: PascalCase
 * Exit 0 = all good, 1 = violations found.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { harnessRepoRoot } from "../../harness-root.js";

const ROOT = harnessRepoRoot(import.meta.dirname!);

export interface NamingViolation {
  file: string;
  kind: "file-name" | "type-name";
  name: string;
  expected: string;
}

const KEBAB_CASE =
  /^[a-z][a-z0-9]*(-[a-z0-9]+)*(\.(ts|tsx|test\.ts|test\.tsx|d\.ts|template\.toml|toml|md))?$/;
const PASCAL_CASE = /^[A-Z][a-zA-Z0-9]*$/;
const ALLOWED_FILE_NAMES = new Set(["INDEX.md", "SKILL.md"]);

export function validateNaming(srcDir: string): NamingViolation[] {
  const violations: NamingViolation[] = [];

  function checkFileNames(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        checkFileNames(full);
        continue;
      }
      if (ALLOWED_FILE_NAMES.has(entry)) continue;
      const name = basename(entry);
      if (!KEBAB_CASE.test(name)) {
        violations.push({
          file: full.replace(ROOT + "/", ""),
          kind: "file-name",
          name: entry,
          expected: "kebab-case (e.g. my-module.ts)",
        });
      }
    }
  }

  function checkTypeNames(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        checkTypeNames(full);
        continue;
      }
      if (!full.endsWith(".ts") || full.endsWith(".test.ts") || full.endsWith(".d.ts")) continue;

      const content = readFileSync(full, "utf-8");
      const lines = content.split("\n");
      let inBlockComment = false;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("/*")) inBlockComment = true;
        if (inBlockComment) {
          if (trimmed.includes("*/")) inBlockComment = false;
          continue;
        }
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

        const typePattern = /\b(?:export\s+)?(?:type|interface|enum)\s+([A-Za-z_]\w*)/g;
        let match;
        while ((match = typePattern.exec(line)) !== null) {
          const name = match[1]!;
          if (!PASCAL_CASE.test(name)) {
            violations.push({
              file: full.replace(ROOT + "/", ""),
              kind: "type-name",
              name,
              expected: "PascalCase",
            });
          }
        }
      }
    }
  }

  const srcPath = join(srcDir, "src");
  if (statSync(srcPath, { throwIfNoEntry: false })?.isDirectory()) {
    checkFileNames(srcPath);
    checkTypeNames(srcPath);
  }

  return violations;
}

const isCLI = Boolean(process.argv[1]?.includes("validate-naming/hard/index.ts"));

if (isCLI) {
  const violations = validateNaming(ROOT);
  if (violations.length === 0) {
    console.log("check:naming — all naming conventions are followed.");
    process.exit(0);
  } else {
    console.error(`check:naming — found ${violations.length} violation(s):\n`);
    for (const v of violations) {
      console.error(`  [${v.kind}] ${v.file}`);
      console.error(`    "${v.name}" should be ${v.expected}\n`);
    }
    process.exit(1);
  }
}
