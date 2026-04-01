import { chmodSync, mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  scoreAutomation,
  scoreNavigation,
  scoreDocumentation,
  scoreArchitecture,
  scoreTestCoverage,
  scoreKnowledgeStructure,
  computeReport,
  formatReport,
} from "./index.js";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "harness-test-"));
}

function cleanup(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

describe("report-harness-score", () => {
  describe("scoreNavigation", () => {
    it("returns 100 when all dirs with 2+ children have INDEX.md", () => {
      const tmp = makeTempDir();
      mkdirSync(join(tmp, "a"));
      mkdirSync(join(tmp, "b"));
      writeFileSync(join(tmp, "INDEX.md"), "# root");
      writeFileSync(join(tmp, "a", "file1.ts"), "");
      writeFileSync(join(tmp, "b", "file1.ts"), "");

      const result = scoreNavigation(tmp);
      expect(result.score).toBe(100);
      expect(result.weight).toBe(20);
      cleanup(tmp);
    });

    it("penalizes directories missing INDEX.md", () => {
      const tmp = makeTempDir();
      mkdirSync(join(tmp, "a"));
      mkdirSync(join(tmp, "b"));
      // root has 2 children but no INDEX.md
      writeFileSync(join(tmp, "a", "file1.ts"), "");
      writeFileSync(join(tmp, "b", "file1.ts"), "");

      const result = scoreNavigation(tmp);
      expect(result.score).toBeLessThan(100);
      expect(result.details.some((d) => d.includes("missing INDEX.md"))).toBe(true);
      cleanup(tmp);
    });

    it("skips unreadable directories when walking and counting children", () => {
      const tmp = makeTempDir();
      mkdirSync(join(tmp, "locked"));
      chmodSync(join(tmp, "locked"), 0o000);
      writeFileSync(join(tmp, "INDEX.md"), "# root");
      try {
        const result = scoreNavigation(tmp);
        expect(result.details).toContain("No directories require INDEX.md");
      } finally {
        chmodSync(join(tmp, "locked"), 0o755);
        cleanup(tmp);
      }
    });

    it("ignores broken symlinks while walking directories", () => {
      const tmp = makeTempDir();
      symlinkSync(join(tmp, "nope-not-here-xyz"), join(tmp, "broken"));
      writeFileSync(join(tmp, "INDEX.md"), "# r");
      expect(() => scoreNavigation(tmp)).not.toThrow();
      cleanup(tmp);
    });

    it("does not descend into excluded directory names", () => {
      const tmp = makeTempDir();
      mkdirSync(join(tmp, "node_modules", "pkg"), { recursive: true });
      mkdirSync(join(tmp, "a"));
      mkdirSync(join(tmp, "b"));
      writeFileSync(join(tmp, "INDEX.md"), "# r");
      writeFileSync(join(tmp, "a", "x.ts"), "");
      writeFileSync(join(tmp, "b", "y.ts"), "");
      expect(scoreNavigation(tmp).score).toBe(100);
      cleanup(tmp);
    });
  });

  describe("scoreDocumentation", () => {
    it("returns 100 when all required docs exist", () => {
      const tmp = makeTempDir();
      mkdirSync(join(tmp, "docs"));
      writeFileSync(join(tmp, "AGENTS.md"), "# Agents");
      writeFileSync(join(tmp, "README.md"), "# Readme");
      writeFileSync(join(tmp, "docs/ARCHITECTURE.md"), "# Arch");
      writeFileSync(join(tmp, "docs/HARNESS.md"), "# Harness");
      writeFileSync(join(tmp, "docs/DECISIONS.md"), "# Decisions");
      writeFileSync(join(tmp, "docs/PROGRESS.md"), "# Progress");
      writeFileSync(join(tmp, "docs/contributing.md"), "# Contributing");
      writeFileSync(join(tmp, "docs/index-format.md"), "# Format");

      const result = scoreDocumentation(tmp);
      expect(result.score).toBe(100);
      cleanup(tmp);
    });

    it("returns 0 when no docs exist", () => {
      const tmp = makeTempDir();
      const result = scoreDocumentation(tmp);
      expect(result.score).toBe(0);
      cleanup(tmp);
    });
  });

  describe("scoreArchitecture", () => {
    it("gives full marks for well-documented architecture", () => {
      const tmp = makeTempDir();
      mkdirSync(join(tmp, "docs"));
      writeFileSync(
        join(tmp, "docs/ARCHITECTURE.md"),
        "# Architecture\n\nLayers: Types → Config.\nDependency flows downward.",
      );
      writeFileSync(
        join(tmp, "docs/HARNESS.md"),
        "# Harness\n\nNo file may import from a layer above.\n\n| Constraint | Enforcement |\n| --- | --- |",
      );

      const result = scoreArchitecture(tmp);
      expect(result.score).toBe(100);
      cleanup(tmp);
    });

    it("returns 0 when no architecture docs exist", () => {
      const tmp = makeTempDir();
      const result = scoreArchitecture(tmp);
      expect(result.score).toBe(0);
      cleanup(tmp);
    });

    it("notes missing layer discussion when ARCHITECTURE avoids the word layer", () => {
      const tmp = makeTempDir();
      mkdirSync(join(tmp, "docs"));
      writeFileSync(
        join(tmp, "docs/ARCHITECTURE.md"),
        "# Arch\n\nStrata split the codebase. Dependencies flow → downward.\n",
      );
      writeFileSync(
        join(tmp, "docs/HARNESS.md"),
        "# Harness\n\nImports must follow rules.\n\n| Constraint | Enforcement |\n| --- | --- |",
      );
      const result = scoreArchitecture(tmp);
      expect(result.details.some((d) => d.includes("does not mention layers"))).toBe(true);
      cleanup(tmp);
    });

    it("notes missing dependency direction when ARCHITECTURE omits flow cues", () => {
      const tmp = makeTempDir();
      mkdirSync(join(tmp, "docs"));
      writeFileSync(
        join(tmp, "docs/ARCHITECTURE.md"),
        "# Arch\n\nLayers are documented as vertical slices without arrows.\n",
      );
      writeFileSync(
        join(tmp, "docs/HARNESS.md"),
        "# Harness\n\nimport rules here\n\n| Constraint | Enforcement |\n| --- | --- |",
      );
      const result = scoreArchitecture(tmp);
      expect(result.details.some((d) => d.includes("dependency direction"))).toBe(true);
      cleanup(tmp);
    });

    it("notes missing harness constraint table when pipes are absent", () => {
      const tmp = makeTempDir();
      mkdirSync(join(tmp, "docs"));
      writeFileSync(
        join(tmp, "docs/ARCHITECTURE.md"),
        "# Arch\n\nLayers: A → B.\nDependency rules apply.\n",
      );
      writeFileSync(join(tmp, "docs/HARNESS.md"), "# Harness\n\nImports must stay layered.\n");
      const result = scoreArchitecture(tmp);
      expect(result.details.some((d) => d.includes("constraint enforcement table"))).toBe(true);
      cleanup(tmp);
    });
  });

  describe("scoreTestCoverage", () => {
    it("returns 100 when all source dirs have tests", () => {
      const tmp = makeTempDir();
      mkdirSync(join(tmp, "src"), { recursive: true });
      mkdirSync(join(tmp, "src", "mod"));
      writeFileSync(join(tmp, "src", "mod", "index.ts"), "export {}");
      writeFileSync(join(tmp, "src", "mod", "index.test.ts"), 'import { describe } from "vitest"');

      const result = scoreTestCoverage(tmp);
      expect(result.score).toBe(100);
      cleanup(tmp);
    });

    it("penalizes modules without tests", () => {
      const tmp = makeTempDir();
      mkdirSync(join(tmp, "src", "a"), { recursive: true });
      mkdirSync(join(tmp, "src", "b"), { recursive: true });
      writeFileSync(join(tmp, "src", "a", "index.ts"), "export {}");
      writeFileSync(join(tmp, "src", "b", "index.ts"), "export {}");
      writeFileSync(join(tmp, "src", "a", "index.test.ts"), 'import { describe } from "vitest"');

      const result = scoreTestCoverage(tmp);
      expect(result.score).toBeLessThan(100);
      expect(result.details.some((d) => d.includes("no tests"))).toBe(true);
      cleanup(tmp);
    });

    it("scores registry hard skills when no src/ (registry-only repo)", () => {
      const tmp = makeTempDir();
      mkdirSync(join(tmp, "registry", "a", "hard"), { recursive: true });
      mkdirSync(join(tmp, "registry", "b", "hard"), { recursive: true });
      writeFileSync(join(tmp, "registry", "a", "hard", "index.ts"), "export {}");
      writeFileSync(join(tmp, "registry", "a", "hard", "index.test.ts"), 'import "vitest"');
      writeFileSync(join(tmp, "registry", "b", "hard", "index.ts"), "export {}");

      const result = scoreTestCoverage(tmp);
      expect(result.score).toBeLessThan(100);
      expect(result.details.some((d) => d.includes("no tests"))).toBe(true);
      cleanup(tmp);
    });

    it("returns 0 when neither src/ nor registry/ exists", () => {
      const tmp = makeTempDir();
      const result = scoreTestCoverage(tmp);
      expect(result.score).toBe(0);
      cleanup(tmp);
    });

    it("returns 100 when src/ exists but has no TypeScript modules", () => {
      const tmp = makeTempDir();
      mkdirSync(join(tmp, "src"), { recursive: true });
      try {
        chmodSync(join(tmp, "src"), 0o000);
        const result = scoreTestCoverage(tmp);
        expect(result.score).toBe(100);
        expect(result.details.some((d) => d.includes("No testable modules"))).toBe(true);
      } finally {
        chmodSync(join(tmp, "src"), 0o755);
        cleanup(tmp);
      }
    });

    it("returns 0 when registry/ cannot be read", () => {
      const tmp = makeTempDir();
      mkdirSync(join(tmp, "registry"), { recursive: true });
      try {
        chmodSync(join(tmp, "registry"), 0o000);
        const result = scoreTestCoverage(tmp);
        expect(result.score).toBe(0);
        expect(result.details.some((d) => d.includes("Cannot read registry"))).toBe(true);
      } finally {
        chmodSync(join(tmp, "registry"), 0o755);
        cleanup(tmp);
      }
    });

    it("returns 100 when registry has no hard/ skills to score", () => {
      const tmp = makeTempDir();
      mkdirSync(join(tmp, "registry", "soft-only"), { recursive: true });
      writeFileSync(join(tmp, "registry", "soft-only", "SKILL.md"), "# S\n");
      const result = scoreTestCoverage(tmp);
      expect(result.score).toBe(100);
      expect(result.details.some((d) => d.includes("No registry hard"))).toBe(true);
      cleanup(tmp);
    });

    it("skips broken symlinks under registry/ when scoring hard tests", () => {
      const tmp = makeTempDir();
      mkdirSync(join(tmp, "registry", "ok", "hard"), { recursive: true });
      writeFileSync(join(tmp, "registry", "ok", "hard", "index.ts"), "export {}\n");
      writeFileSync(join(tmp, "registry", "ok", "hard", "index.test.ts"), "export {}\n");
      symlinkSync(join(tmp, "missing-skill-target"), join(tmp, "registry", "bad"));
      const result = scoreTestCoverage(tmp);
      expect(result.score).toBe(100);
      cleanup(tmp);
    });

    it("ignores dot-prefixed names and plain files under registry/", () => {
      const tmp = makeTempDir();
      mkdirSync(join(tmp, "registry", "ok", "hard"), { recursive: true });
      writeFileSync(join(tmp, "registry", "ok", "hard", "index.ts"), "export {}\n");
      writeFileSync(join(tmp, "registry", "ok", "hard", "index.test.ts"), "export {}\n");
      writeFileSync(join(tmp, "registry", "blob.txt"), "x\n");
      mkdirSync(join(tmp, "registry", ".stash"), { recursive: true });
      const result = scoreTestCoverage(tmp);
      expect(result.score).toBe(100);
      cleanup(tmp);
    });

    it("skips node_modules while walking src/ for test coverage scoring", () => {
      const tmp = makeTempDir();
      mkdirSync(join(tmp, "src", "node_modules", "pkg"), { recursive: true });
      mkdirSync(join(tmp, "src", "lib"), { recursive: true });
      writeFileSync(join(tmp, "src", "lib", "x.ts"), "export {}\n");
      writeFileSync(join(tmp, "src", "lib", "x.test.ts"), "export {}\n");
      const result = scoreTestCoverage(tmp);
      expect(result.score).toBe(100);
      cleanup(tmp);
    });

    it("skips unreadable subdirs and broken symlinks under src/ while finding tests", () => {
      const tmp = makeTempDir();
      mkdirSync(join(tmp, "src", "good"), { recursive: true });
      mkdirSync(join(tmp, "src", "hidden"), { recursive: true });
      writeFileSync(join(tmp, "src", "good", "x.ts"), "export {}\n");
      writeFileSync(join(tmp, "src", "good", "x.test.ts"), "export {}\n");
      symlinkSync(join(tmp, "missing-ts-target"), join(tmp, "src", "good", "oops"));
      chmodSync(join(tmp, "src", "hidden"), 0o000);
      try {
        const result = scoreTestCoverage(tmp);
        expect(result.score).toBe(100);
      } finally {
        chmodSync(join(tmp, "src", "hidden"), 0o755);
        cleanup(tmp);
      }
    });
  });

  describe("scoreKnowledgeStructure", () => {
    it("gives full marks for a well-structured knowledge base", () => {
      const tmp = makeTempDir();
      mkdirSync(join(tmp, "docs"));
      mkdirSync(join(tmp, ".agents"));
      mkdirSync(join(tmp, ".agents/skills"));
      writeFileSync(
        join(tmp, "AGENTS.md"),
        [
          "# Project — entry point",
          "",
          "## Quick reference",
          "",
          "| What | Where |",
          "| [Docs](docs/) | Documentation |",
          "| [Src](src/) | Source code |",
          "| [Config](config/) | Configuration |",
          "| [Tests](tests/) | Test suites |",
          "| [Build](build/) | Build scripts |",
        ].join("\n"),
      );
      mkdirSync(join(tmp, "registry"), { recursive: true });
      writeFileSync(join(tmp, "registry", "SKILL.md"), "# Soft skills\n");

      const result = scoreKnowledgeStructure(tmp);
      expect(result.score).toBe(100);
      cleanup(tmp);
    });

    it("penalizes long AGENTS.md", () => {
      const tmp = makeTempDir();
      mkdirSync(join(tmp, "docs"));
      mkdirSync(join(tmp, ".agents/skills"), { recursive: true });
      const longContent =
        "# Agent\n" +
        Array.from({ length: 200 }, (_, i) => `line ${i}`).join("\n") +
        "\n[a](a) [b](b) [c](c) [d](d) [e](e)";
      writeFileSync(join(tmp, "AGENTS.md"), longContent);

      const result = scoreKnowledgeStructure(tmp);
      expect(result.score).toBeLessThan(100);
      expect(result.details.some((d) => d.includes("lines"))).toBe(true);
      cleanup(tmp);
    });

    it("penalizes too few navigation links in AGENTS.md", () => {
      const tmp = makeTempDir();
      mkdirSync(join(tmp, "docs"));
      mkdirSync(join(tmp, "registry"), { recursive: true });
      writeFileSync(join(tmp, "registry", "SKILL.md"), "# S\n");
      writeFileSync(join(tmp, "AGENTS.md"), "# Project — map entry point\n\n[a](a) [b](b)\n");
      const result = scoreKnowledgeStructure(tmp);
      expect(result.details.some((d) => d.includes("only 2 links"))).toBe(true);
      cleanup(tmp);
    });

    it("treats AGENTS.md without markdown links as having zero links", () => {
      const tmp = makeTempDir();
      mkdirSync(join(tmp, "docs"));
      mkdirSync(join(tmp, "registry"), { recursive: true });
      writeFileSync(join(tmp, "registry", "SKILL.md"), "# S\n");
      writeFileSync(join(tmp, "AGENTS.md"), "# Title\n\nPlain text only.\n");
      const result = scoreKnowledgeStructure(tmp);
      expect(result.details.some((d) => d.includes("only 0 links"))).toBe(true);
      cleanup(tmp);
    });
  });

  describe("scoreAutomation branch coverage", () => {
    it("excludes .no-auto-run skills from the auto-run count", () => {
      const tmp = makeTempDir();
      mkdirSync(join(tmp, "harness"), { recursive: true });
      writeFileSync(join(tmp, "harness", "runner.ts"), "r\n");
      mkdirSync(join(tmp, "harness", "u", "hard"), { recursive: true });
      writeFileSync(join(tmp, "harness", "u", "hard", "index.ts"), "e\n");
      writeFileSync(join(tmp, "harness", "u", "hard", "index.test.ts"), "t\n");
      mkdirSync(join(tmp, "harness", "z", "hard"), { recursive: true });
      writeFileSync(join(tmp, "harness", "z", "hard", "index.ts"), "e\n");
      writeFileSync(join(tmp, "harness", "z", "hard", ".no-auto-run"), "");
      const result = scoreAutomation(tmp);
      expect(result.details.some((d) => d.includes("At least 2 auto-run"))).toBe(true);
      cleanup(tmp);
    });

    it("flags missing hard-skill tests when no skill has hard/index.ts", () => {
      const tmp = makeTempDir();
      mkdirSync(join(tmp, "harness"), { recursive: true });
      writeFileSync(join(tmp, "harness", "runner.ts"), "r\n");
      mkdirSync(join(tmp, "harness", "notes"), { recursive: true });
      writeFileSync(join(tmp, "harness", "notes", "readme.txt"), "x\n");
      const result = scoreAutomation(tmp);
      expect(result.details.some((d) => d.includes("unit tests"))).toBe(true);
      cleanup(tmp);
    });
  });

  describe("computeReport", () => {
    it("returns a total between 0 and 100", () => {
      const tmp = makeTempDir();
      const report = computeReport(tmp);
      expect(report.total).toBeGreaterThanOrEqual(0);
      expect(report.total).toBeLessThanOrEqual(100);
      expect(report.dimensions).toHaveLength(6);
      cleanup(tmp);
    });

    it("scores higher for well-equipped repos", () => {
      const tmp = makeTempDir();

      mkdirSync(join(tmp, "docs"));
      writeFileSync(
        join(tmp, "AGENTS.md"),
        "# Project — Quick reference entry point\n\n| [a](a) | [b](b) | [c](c) | [d](d) | [e](e) |",
      );
      writeFileSync(join(tmp, "README.md"), "# Project");
      writeFileSync(
        join(tmp, "docs/ARCHITECTURE.md"),
        "# Arch\n\nLayers flow → dependency direction.",
      );
      writeFileSync(join(tmp, "docs/HARNESS.md"), "| Constraint | Enforcement |\n| a | b |");
      writeFileSync(join(tmp, "docs/DECISIONS.md"), "# Decisions");
      writeFileSync(join(tmp, "docs/PROGRESS.md"), "# Progress");
      writeFileSync(join(tmp, "docs/contributing.md"), "# Contributing");
      writeFileSync(join(tmp, "docs/index-format.md"), "# Format");

      mkdirSync(join(tmp, "src", "mod"), { recursive: true });
      writeFileSync(join(tmp, "src", "mod", "index.ts"), "export {}");
      writeFileSync(join(tmp, "src", "mod", "index.test.ts"), "test");

      mkdirSync(join(tmp, "registry"), { recursive: true });
      writeFileSync(join(tmp, "registry", "runner.ts"), "// runner");
      writeFileSync(join(tmp, "registry", "SKILL.md"), "# Soft\n");
      mkdirSync(join(tmp, "registry", "skill-a", "hard"), { recursive: true });
      writeFileSync(join(tmp, "registry", "skill-a", "hard", "index.ts"), "// skill");
      writeFileSync(join(tmp, "registry", "skill-a", "hard", "index.test.ts"), "// test");
      mkdirSync(join(tmp, "registry", "skill-b", "hard"), { recursive: true });
      writeFileSync(join(tmp, "registry", "skill-b", "hard", "index.ts"), "// skill");
      writeFileSync(join(tmp, "registry", "skill-b", "hard", "index.test.ts"), "// test");

      mkdirSync(join(tmp, ".husky"));
      writeFileSync(join(tmp, ".husky/pre-commit"), "npm run check:all");
      writeFileSync(join(tmp, ".husky/commit-msg"), "validate");

      writeFileSync(
        join(tmp, "package.json"),
        JSON.stringify({
          scripts: {
            lint: "oxlint",
            typecheck: "tsc --noEmit",
            test: "vitest run",
            "test:coverage": "vitest run --coverage",
          },
        }),
      );

      const equipped = computeReport(tmp);
      const empty = computeReport(makeTempDir());

      expect(equipped.total).toBeGreaterThan(70);
      expect(equipped.total).toBeGreaterThan(empty.total);
      cleanup(tmp);
    });
  });

  describe("formatReport", () => {
    it("produces a non-empty string with the total", () => {
      const report: ReturnType<typeof computeReport> = {
        dimensions: [
          { name: "Navigation", score: 80, weight: 20, details: ["4/5 covered"] },
          { name: "Documentation", score: 100, weight: 20, details: ["6/6"] },
          { name: "Architecture", score: 60, weight: 15, details: ["3/5"] },
          { name: "Automated checks", score: 75, weight: 20, details: ["6/9"] },
          { name: "Test coverage", score: 50, weight: 15, details: ["1/2"] },
          { name: "Knowledge structure", score: 100, weight: 10, details: ["5/5"] },
        ],
        total: 79,
      };

      const output = formatReport(report);
      expect(output).toContain("79");
      expect(output).toContain("HARNESS QUALITY SCORE");
      expect(output).toContain("Navigation");
    });
  });
});
