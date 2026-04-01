import { describe, expect, it } from "vitest";
import {
  scoreNavigation,
  scoreDocumentation,
  scoreArchitecture,
  scoreTestCoverage,
  scoreKnowledgeStructure,
  computeReport,
  formatReport,
} from "./index.js";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

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
