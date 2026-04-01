#!/usr/bin/env tsx

/**
 * Validates dependency direction between top-level `src/` layers.
 * Scans `../` imports — edit ALLOWED_IMPORTS and layer detection for your repo.
 * Exit 0 = all good, 1 = violations found.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname ?? ".", "../../..");

/** Root modules under `src/*.ts` treated as the `core` layer (config, IO, entry). */
const CORE_MODULE_NAMES = new Set(["config", "paths", "lockfile", "io", "entry"]);

const CORE_ROOT_FILES = new Set([...CORE_MODULE_NAMES].map((n) => `${n}.ts`));

// skill-issue CLI layout — commands → core | git | registry; git → core; registry → (none).
const ALLOWED_IMPORTS: Record<string, string[]> = {
  core: [],
  commands: ["core", "git", "registry"],
  git: ["core"],
  registry: [],
};

export interface DepViolation {
  file: string;
  layer: string;
  importedLayer: string;
  line: number;
  importPath: string;
}

function getLayer(filePath: string, srcDir: string): string | undefined {
  const srcPath = join(srcDir, "src");
  const prefix = srcPath.endsWith("/") ? srcPath : srcPath + "/";
  const rel = filePath.startsWith(prefix) ? filePath.slice(prefix.length) : filePath;
  const firstSeg = rel.split("/")[0];
  if (!firstSeg) return undefined;
  if (CORE_ROOT_FILES.has(firstSeg)) return "core";
  if (firstSeg in ALLOWED_IMPORTS) return firstSeg;
  return undefined;
}

function normalizeImportedLayer(firstPathSegment: string): string | undefined {
  const noExt = firstPathSegment.replace(/\.(js|ts|mjs|mts|cjs)$/, "");
  if (CORE_MODULE_NAMES.has(noExt)) return "core";
  if (noExt in ALLOWED_IMPORTS) return noExt;
  return undefined;
}

function extractImports(content: string): Array<{ line: number; path: string }> {
  const imports: Array<{ line: number; path: string }> = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // Match: import ... from "../<layer>/..." or import ... from "./<layer>/..."
    const match = line.match(/(?:import|from)\s+['"]\.\.\/([^'"/]+)/);
    if (match) {
      imports.push({ line: i + 1, path: match[1]! });
    }
  }
  return imports;
}

export function validateDeps(srcDir: string): DepViolation[] {
  const violations: DepViolation[] = [];

  function scanDir(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        scanDir(full);
        continue;
      }
      if (!full.endsWith(".ts") || full.endsWith(".test.ts") || full.endsWith(".d.ts")) continue;

      const layer = getLayer(full, srcDir);
      if (!layer) continue;

      const content = readFileSync(full, "utf-8");
      const imports = extractImports(content);

      for (const imp of imports) {
        if (imp.path === "utils" || imp.path.startsWith("utils/")) continue;

        const importedLayer = normalizeImportedLayer(imp.path);
        if (!importedLayer) continue;
        if (importedLayer === layer) continue; // same-layer import is fine

        const allowed = ALLOWED_IMPORTS[layer];
        if (allowed && !allowed.includes(importedLayer) && importedLayer in ALLOWED_IMPORTS) {
          violations.push({
            file: full.replace(join(srcDir, "").replace(/\/?$/, "/"), ""),
            layer,
            importedLayer,
            line: imp.line,
            importPath: imp.path,
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

const isCLI = process.argv[1]?.includes("validate-deps/hard/index.ts") ?? false;

if (isCLI) {
  const violations = validateDeps(ROOT);
  if (violations.length === 0) {
    console.log("check:deps — all layer dependencies are valid.");
    process.exit(0);
  } else {
    console.error(`check:deps — found ${violations.length} violation(s):\n`);
    for (const v of violations) {
      console.error(`  [dep-violation] ${v.file}:${v.line}`);
      console.error(`    ${v.layer}/ must not import from ${v.importedLayer}/\n`);
    }
    process.exit(1);
  }
}
