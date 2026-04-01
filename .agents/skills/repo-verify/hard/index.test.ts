import { describe, expect, it } from "vitest";
import { discoverHardSkills, resolveVerifyPlan } from "./index.js";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "repo-verify-test-"));
}

describe("repo-verify", () => {
  it("discovers hard skills and no-auto-run", () => {
    const tmp = makeTempDir();
    const reg = join(tmp, "registry");
    mkdirSync(join(reg, "skill-a", "hard"), { recursive: true });
    mkdirSync(join(reg, "skill-b", "hard"), { recursive: true });
    writeFileSync(join(reg, "skill-a", "hard", "index.ts"), "export {};\n");
    writeFileSync(join(reg, "skill-b", "hard", "index.ts"), "export {};\n");
    writeFileSync(join(reg, "skill-b", "hard", ".no-auto-run"), "");

    const d = discoverHardSkills(reg);
    expect(d.find((x) => x.id === "skill-a")!.runsInCheckAll).toBe(true);
    expect(d.find((x) => x.id === "skill-b")!.runsInCheckAll).toBe(false);
    expect(d.find((x) => x.id === "skill-b")!.excludeReason).toBe("no-auto-run");
    rmSync(tmp, { recursive: true, force: true });
  });

  it("resolveVerifyPlan prefers npm verify script", () => {
    const tmp = makeTempDir();
    writeFileSync(
      join(tmp, "package.json"),
      JSON.stringify({ scripts: { verify: "echo ok", lint: "eslint ." } }),
    );
    const plan = resolveVerifyPlan(tmp);
    expect(plan).toEqual({ kind: "npm-verify", command: "verify" });
    rmSync(tmp, { recursive: true, force: true });
  });

  it("resolveVerifyPlan falls back to ordered steps when no verify", () => {
    const tmp = makeTempDir();
    writeFileSync(join(tmp, "tsconfig.json"), "{}");
    writeFileSync(
      join(tmp, "package.json"),
      JSON.stringify({
        scripts: {
          lint: "eslint .",
          test: "vitest run",
          "check:all": "tsx registry/runner.ts",
        },
      }),
    );
    const plan = resolveVerifyPlan(tmp);
    expect(plan.kind).toBe("steps");
    if (plan.kind === "steps") {
      expect(plan.steps[0]!.label).toBe("tsc --noEmit");
      expect(plan.steps.map((s) => s.label)).toContain("npm run lint");
      expect(plan.steps.map((s) => s.label)).toContain("npm run test");
    }
    rmSync(tmp, { recursive: true, force: true });
  });

  it("resolveVerifyPlan prefers test:coverage over test when both exist", () => {
    const tmp = makeTempDir();
    writeFileSync(join(tmp, "tsconfig.json"), "{}");
    writeFileSync(
      join(tmp, "package.json"),
      JSON.stringify({
        scripts: {
          lint: "eslint .",
          test: "vitest run",
          "test:coverage": "vitest run --coverage",
          "check:all": "tsx registry/runner.ts",
        },
      }),
    );
    const plan = resolveVerifyPlan(tmp);
    expect(plan.kind).toBe("steps");
    if (plan.kind === "steps") {
      expect(plan.steps.map((s) => s.label)).toContain("npm run test:coverage");
      expect(plan.steps.map((s) => s.label)).not.toContain("npm run test");
    }
    rmSync(tmp, { recursive: true, force: true });
  });
});
