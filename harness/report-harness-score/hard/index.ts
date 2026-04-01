#!/usr/bin/env tsx

/**
 * Harness quality score — grades the repository's agent-readiness on 0–100.
 *
 * Six dimensions are measured, each weighted differently.  The script reads
 * the filesystem (read-only), never writes, and prints a breakdown + final
 * score to stdout.
 *
 * Exit code 0 = report printed, 1 = unexpected error.
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { harnessRepoRoot } from "../../harness-root.js";

/** Repo root — overridden by `SKISSUE_HARNESS_ROOT` in tests. */
const ROOT = harnessRepoRoot(import.meta.dirname!);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DimensionResult {
  name: string;
  score: number;
  weight: number;
  details: string[];
}

export interface HarnessReport {
  dimensions: DimensionResult[];
  total: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EXCLUDED_DIRS = new Set(["node_modules", ".git", "coverage", "dist", ".cursor", "_"]);

function walkDirs(dir: string): string[] {
  const dirs: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return dirs;
  }
  for (const name of entries) {
    if (EXCLUDED_DIRS.has(name)) continue;
    const full = join(dir, name);
    try {
      if (statSync(full).isDirectory()) {
        dirs.push(full);
        dirs.push(...walkDirs(full));
      }
    } catch {
      // skip broken symlinks etc.
    }
  }
  return dirs;
}

function fileExists(path: string): boolean {
  return existsSync(path);
}

function readText(path: string): string {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return "";
  }
}

function countChildren(dir: string): number {
  try {
    return readdirSync(dir).filter((n) => !EXCLUDED_DIRS.has(n) && n !== "INDEX.md").length;
  } catch {
    return 0;
  }
}

function relPath(abs: string): string {
  return abs.replace(ROOT + "/", "");
}

function findFiles(dir: string, ext: string): string[] {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const name of entries) {
    if (EXCLUDED_DIRS.has(name)) continue;
    const full = join(dir, name);
    try {
      const st = statSync(full);
      if (st.isDirectory()) {
        results.push(...findFiles(full, ext));
      } else if (name.endsWith(ext)) {
        results.push(full);
      }
    } catch {
      // skip
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Dimension 1: Navigation (INDEX.md coverage)  — weight 20
// ---------------------------------------------------------------------------

export function scoreNavigation(root: string): DimensionResult {
  const details: string[] = [];
  const allDirs = walkDirs(root);
  const needsIndex = allDirs.filter((d) => countChildren(d) >= 2);
  const rootNeedsIndex = countChildren(root) >= 2;
  if (rootNeedsIndex) needsIndex.unshift(root);

  if (needsIndex.length === 0) {
    return {
      name: "Navigation",
      score: 100,
      weight: 20,
      details: ["No directories require INDEX.md"],
    };
  }

  let hasIndex = 0;
  for (const dir of needsIndex) {
    const indexPath = join(dir, "INDEX.md");
    const agentsPath = join(dir, "AGENTS.md");
    if (fileExists(indexPath) || (dir === root && fileExists(agentsPath))) {
      hasIndex++;
    } else {
      details.push(`missing INDEX.md: ${relPath(dir)}/`);
    }
  }

  const ratio = hasIndex / needsIndex.length;
  const score = Math.round(ratio * 100);
  details.unshift(`${hasIndex}/${needsIndex.length} directories covered`);
  return { name: "Navigation", score, weight: 20, details };
}

// ---------------------------------------------------------------------------
// Dimension 2: Documentation completeness  — weight 20
// ---------------------------------------------------------------------------

const REQUIRED_DOCS: Array<{ path: string; label: string }> = [
  { path: "AGENTS.md", label: "AGENTS.md (agent entry point)" },
  { path: "docs/ARCHITECTURE.md", label: "Architecture documentation" },
  { path: "docs/HARNESS.md", label: "Harness engineering rules" },
  { path: "docs/DECISIONS.md", label: "Architectural decisions log" },
  { path: "docs/PROGRESS.md", label: "Build progress tracker" },
  { path: "docs/contributing.md", label: "Contributing guide" },
  { path: "docs/index-format.md", label: "INDEX.md format spec" },
  { path: "README.md", label: "Project README" },
];

export function scoreDocumentation(root: string): DimensionResult {
  const details: string[] = [];
  let found = 0;

  for (const doc of REQUIRED_DOCS) {
    if (fileExists(join(root, doc.path))) {
      found++;
    } else {
      details.push(`missing: ${doc.label} (${doc.path})`);
    }
  }

  const ratio = found / REQUIRED_DOCS.length;
  const score = Math.round(ratio * 100);
  details.unshift(`${found}/${REQUIRED_DOCS.length} required documents present`);
  return { name: "Documentation", score, weight: 20, details };
}

// ---------------------------------------------------------------------------
// Dimension 3: Architecture enforcement  — weight 15
// ---------------------------------------------------------------------------

export function scoreArchitecture(root: string): DimensionResult {
  const details: string[] = [];
  let points = 0;
  const maxPoints = 5;

  const archPath = join(root, "docs/ARCHITECTURE.md");
  if (fileExists(archPath)) {
    points++;
    const content = readText(archPath);

    if (/layer/i.test(content)) {
      points++;
    } else {
      details.push("ARCHITECTURE.md does not mention layers");
    }

    if (/→|->|depend/i.test(content)) {
      points++;
    } else {
      details.push("ARCHITECTURE.md does not document dependency direction");
    }
  } else {
    details.push("missing docs/ARCHITECTURE.md");
  }

  const layersPath = join(root, "docs/HARNESS.md");
  if (fileExists(layersPath)) {
    points++;
    const content = readText(layersPath);
    if (/import/i.test(content) && /\|/.test(content)) {
      points++;
    } else {
      details.push("HARNESS.md lacks constraint enforcement table");
    }
  } else {
    details.push("missing docs/HARNESS.md");
  }

  const score = Math.round((points / maxPoints) * 100);
  details.unshift(`${points}/${maxPoints} architecture criteria met`);
  return { name: "Architecture", score, weight: 15, details };
}

// ---------------------------------------------------------------------------
// Dimension 4: Automated checks  — weight 20
// ---------------------------------------------------------------------------

interface AutomationCriteria {
  label: string;
  check: (root: string) => boolean;
}

/** `harness/` (skissue repo) or `registry/` (skill-registry) — wherever `runner.ts` lives. */
function skillsTreeRoot(root: string): string | null {
  const harness = join(root, "harness");
  const registry = join(root, "registry");
  if (fileExists(join(harness, "runner.ts"))) return harness;
  if (fileExists(join(registry, "runner.ts"))) return registry;
  return null;
}

function skillsTreeAutoHardSkillCount(root: string): number {
  const skillsDir = skillsTreeRoot(root);
  if (!skillsDir) return 0;
  try {
    return readdirSync(skillsDir).filter((name) => {
      const full = join(skillsDir, name);
      if (!statSync(full).isDirectory()) return false;
      if (!fileExists(join(full, "hard", "index.ts"))) return false;
      if (fileExists(join(full, "hard", ".no-auto-run"))) return false;
      return true;
    }).length;
  } catch {
    return 0;
  }
}

function skillsTreeHardSkillsHaveTests(root: string): boolean {
  const skillsDir = skillsTreeRoot(root);
  if (!skillsDir) return false;
  try {
    const dirs = readdirSync(skillsDir).filter((name) => {
      const full = join(skillsDir, name);
      return statSync(full).isDirectory() && fileExists(join(full, "hard", "index.ts"));
    });
    if (dirs.length === 0) return false;
    return dirs.every((d) => fileExists(join(skillsDir, d, "hard", "index.test.ts")));
  } catch {
    return false;
  }
}

const AUTOMATION_CRITERIA: AutomationCriteria[] = [
  {
    label: "Harness or registry runner (runner.ts)",
    check: (r) =>
      fileExists(join(r, "harness", "runner.ts")) || fileExists(join(r, "registry", "runner.ts")),
  },
  {
    label: "At least 2 auto-run hard skill components",
    check: (r) => skillsTreeAutoHardSkillCount(r) >= 2,
  },
  {
    label: "Pre-commit hook exists",
    check: (r) => fileExists(join(r, ".husky/pre-commit")),
  },
  {
    label: "Commit-msg hook exists",
    check: (r) => fileExists(join(r, ".husky/commit-msg")),
  },
  {
    label: "Lint script in package.json",
    check: (r) => {
      const pkg = readText(join(r, "package.json"));
      return /"lint"/.test(pkg);
    },
  },
  {
    label: "Typecheck script in package.json",
    check: (r) => {
      const pkg = readText(join(r, "package.json"));
      return /"typecheck"/.test(pkg);
    },
  },
  {
    label: "Test script in package.json",
    check: (r) => {
      const pkg = readText(join(r, "package.json"));
      return /"test"/.test(pkg);
    },
  },
  {
    label: "`test:coverage` script (Vitest coverage in the default gate)",
    check: (r) => {
      const pkg = readText(join(r, "package.json"));
      return /"test:coverage"/.test(pkg) && /--coverage/.test(pkg);
    },
  },
  {
    label: "Harness/registry hard skills have unit tests",
    check: (r) => skillsTreeHardSkillsHaveTests(r),
  },
];

export function scoreAutomation(root: string): DimensionResult {
  const details: string[] = [];
  let passed = 0;

  for (const criterion of AUTOMATION_CRITERIA) {
    if (criterion.check(root)) {
      passed++;
    } else {
      details.push(`missing: ${criterion.label}`);
    }
  }

  const score = Math.round((passed / AUTOMATION_CRITERIA.length) * 100);
  details.unshift(`${passed}/${AUTOMATION_CRITERIA.length} automation criteria met`);
  return { name: "Automated checks", score, weight: 20, details };
}

// ---------------------------------------------------------------------------
// Dimension 5: Test coverage (co-located tests)  — weight 15
// ---------------------------------------------------------------------------

function scoreTestCoverageFromSrc(_root: string, srcDir: string): DimensionResult {
  const details: string[] = [];

  const tsFiles = findFiles(srcDir, ".ts").filter(
    (f) => !f.endsWith(".test.ts") && !f.endsWith(".d.ts"),
  );

  const entryFiles = tsFiles.filter(
    (f) => !f.endsWith("index.ts") || statSync(join(f, "..")).isDirectory(),
  );

  const testableModules: string[] = [];
  const moduleDirs = new Set<string>();
  for (const f of entryFiles) {
    const dir = resolve(f, "..");
    if (!moduleDirs.has(dir)) {
      moduleDirs.add(dir);
      testableModules.push(dir);
    }
  }

  if (testableModules.length === 0) {
    return {
      name: "Test coverage",
      score: 100,
      weight: 15,
      details: ["No testable modules under src/"],
    };
  }

  let withTests = 0;
  for (const dir of testableModules) {
    const testFiles = findFiles(dir, ".test.ts");
    if (testFiles.length > 0) {
      withTests++;
    } else {
      details.push(`no tests: ${relPath(dir)}/`);
    }
  }

  const ratio = withTests / testableModules.length;
  const score = Math.round(ratio * 100);
  details.unshift(`${withTests}/${testableModules.length} source modules have tests`);
  return { name: "Test coverage", score, weight: 15, details };
}

function scoreTestCoverageFromRegistry(_root: string, regDir: string): DimensionResult {
  const details: string[] = [];
  const skillDirs: string[] = [];

  let entries: string[];
  try {
    entries = readdirSync(regDir);
  } catch {
    return { name: "Test coverage", score: 0, weight: 15, details: ["Cannot read registry/"] };
  }

  for (const name of entries) {
    if (name.startsWith(".")) continue;
    const full = join(regDir, name);
    try {
      if (!statSync(full).isDirectory()) continue;
    } catch {
      continue;
    }
    const hardIndex = join(full, "hard", "index.ts");
    if (!fileExists(hardIndex)) continue;
    skillDirs.push(full);
  }

  if (skillDirs.length === 0) {
    return {
      name: "Test coverage",
      score: 100,
      weight: 15,
      details: ["No registry hard/ modules to score"],
    };
  }

  let withTests = 0;
  for (const dir of skillDirs) {
    if (fileExists(join(dir, "hard", "index.test.ts"))) {
      withTests++;
    } else {
      details.push(`no tests: ${relPath(dir)}/hard/`);
    }
  }

  const ratio = withTests / skillDirs.length;
  const score = Math.round(ratio * 100);
  details.unshift(`${withTests}/${skillDirs.length} registry hard skills have index.test.ts`);
  return { name: "Test coverage", score, weight: 15, details };
}

export function scoreTestCoverage(root: string): DimensionResult {
  const srcDir = join(root, "src");
  if (fileExists(srcDir)) {
    return scoreTestCoverageFromSrc(root, srcDir);
  }

  const regDir = join(root, "registry");
  if (fileExists(regDir)) {
    return scoreTestCoverageFromRegistry(root, regDir);
  }

  return {
    name: "Test coverage",
    score: 0,
    weight: 15,
    details: ["No src/ or registry/ directory found"],
  };
}

// ---------------------------------------------------------------------------
// Dimension 6: Knowledge structure  — weight 10
// ---------------------------------------------------------------------------

export function scoreKnowledgeStructure(root: string): DimensionResult {
  const details: string[] = [];
  let points = 0;
  const maxPoints = 5;

  const agentsPath = join(root, "AGENTS.md");
  if (fileExists(agentsPath)) {
    const content = readText(agentsPath);
    const lineCount = content.split("\n").length;

    if (lineCount <= 150) {
      points++;
    } else {
      details.push(`AGENTS.md is ${lineCount} lines (should be ≤ 150 for progressive disclosure)`);
    }

    const linkCount = (content.match(/\[.*?\]\(.*?\)/g) ?? []).length;
    if (linkCount >= 5) {
      points++;
    } else {
      details.push(`AGENTS.md has only ${linkCount} links (need ≥ 5 for map-style navigation)`);
    }

    if (/table of contents|map|entry.?point|quick reference/i.test(content)) {
      points++;
    } else {
      details.push("AGENTS.md doesn't identify itself as a map/entry-point");
    }
  } else {
    details.push("missing AGENTS.md");
  }

  if (fileExists(join(root, "docs"))) {
    points++;
  } else {
    details.push("missing docs/ directory for structured knowledge");
  }

  const softSkillsExist =
    fileExists(join(root, "harness", "SKILL.md")) ||
    fileExists(join(root, "registry", "SKILL.md")) ||
    fileExists(join(root, "registry", "commit-workflow", "SKILL.md"));
  if (softSkillsExist) {
    points++;
  } else {
    details.push("no soft skills or agent workflows found");
  }

  const score = Math.round((points / maxPoints) * 100);
  details.unshift(`${points}/${maxPoints} knowledge structure criteria met`);
  return { name: "Knowledge structure", score, weight: 10, details };
}

// ---------------------------------------------------------------------------
// Report builder
// ---------------------------------------------------------------------------

export function computeReport(root: string): HarnessReport {
  const dimensions: DimensionResult[] = [
    scoreNavigation(root),
    scoreDocumentation(root),
    scoreArchitecture(root),
    scoreAutomation(root),
    scoreTestCoverage(root),
    scoreKnowledgeStructure(root),
  ];

  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  const weighted = dimensions.reduce((sum, d) => sum + (d.score * d.weight) / totalWeight, 0);
  const total = Math.round(weighted);

  return { dimensions, total };
}

export function formatReport(report: HarnessReport): string {
  const lines: string[] = [];
  lines.push("╔══════════════════════════════════════════════════╗");
  lines.push("║          HARNESS QUALITY SCORE                  ║");
  lines.push("╠══════════════════════════════════════════════════╣");
  lines.push("");

  for (const dim of report.dimensions) {
    const bar = renderBar(dim.score);
    const weighted = Math.round((dim.score * dim.weight) / 100);
    lines.push(
      `  ${dim.name.padEnd(22)} ${bar}  ${String(dim.score).padStart(3)}/100  (weight: ${dim.weight}, contribution: ${weighted})`,
    );
    for (const detail of dim.details) {
      lines.push(`    · ${detail}`);
    }
    lines.push("");
  }

  lines.push("╠══════════════════════════════════════════════════╣");
  lines.push(`║  TOTAL SCORE:  ${String(report.total).padStart(3)} / 100${" ".repeat(27)}║`);
  lines.push("╚══════════════════════════════════════════════════╝");

  return lines.join("\n");
}

function renderBar(score: number): string {
  const width = 20;
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

const isCLI = Boolean(process.argv[1]?.includes("report-harness-score/hard/index.ts"));

if (isCLI) {
  try {
    if (process.env.SKISSUE_HARNESS_SCORE_THROW === "1") {
      throw new Error("SKISSUE_HARNESS_SCORE_THROW");
    }
    const report = computeReport(ROOT);
    console.log(formatReport(report));
    console.log(`\ncheck:harness-score — score: ${report.total}/100`);
  } catch (err) {
    console.error("check:harness-score — unexpected error:", err);
    process.exit(1);
  }
  process.exit(0);
}
