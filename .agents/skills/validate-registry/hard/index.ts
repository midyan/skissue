#!/usr/bin/env tsx

/**
 * Validates root registry.json: JSON shape, each skill path exists, each has SKILL.md at skill root.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";

const ROOT = resolve(import.meta.dirname ?? ".", "../../..");

const RegistrySchema = z.object({
  skills: z.record(z.string(), z.string()),
});

export interface Violation {
  rule: string;
  detail: string;
}

export function validateRegistry(root: string): Violation[] {
  const violations: Violation[] = [];
  const path = join(root, "registry.json");
  if (!existsSync(path)) {
    violations.push({ rule: "missing-registry", detail: "registry.json not found at repo root" });
    return violations;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    violations.push({
      rule: "invalid-json",
      detail: `registry.json is not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
    });
    return violations;
  }

  const reg = RegistrySchema.safeParse(parsed);
  if (!reg.success) {
    violations.push({
      rule: "invalid-shape",
      detail: reg.error.message,
    });
    return violations;
  }

  for (const [id, rel] of Object.entries(reg.data.skills)) {
    const skillDir = join(root, rel);
    if (!existsSync(skillDir)) {
      violations.push({
        rule: "missing-path",
        detail: `Skill "${id}" path does not exist: ${rel}`,
      });
      continue;
    }
    const skillMd = join(skillDir, "SKILL.md");
    if (!existsSync(skillMd)) {
      violations.push({
        rule: "missing-skill-md",
        detail: `Skill "${id}" must contain SKILL.md at skill root: ${rel}`,
      });
    }
  }

  return violations;
}

const isCLI = process.argv[1]?.includes("validate-registry/hard/index.ts") ?? false;

if (isCLI) {
  const violations = validateRegistry(ROOT);
  if (violations.length === 0) {
    console.log("check:registry — registry.json is valid.");
    process.exit(0);
  }
  console.error(`check:registry — ${violations.length} issue(s):\n`);
  for (const v of violations) {
    console.error(`  [${v.rule}] ${v.detail}`);
  }
  process.exit(1);
}
