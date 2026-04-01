import { describe, expect, it } from "vitest";
import { validateLogging } from "./index.js";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "validate-logging-test-"));
}

describe("validate-logging", () => {
  it("passes when no console usage in src", () => {
    const tmp = makeTempDir();
    mkdirSync(join(tmp, "src/utils"), { recursive: true });
    writeFileSync(join(tmp, "src/utils/logger.ts"), "export const logger = { info() {} };");
    const violations = validateLogging(tmp);
    expect(violations).toHaveLength(0);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("detects console.log in non-cli src files", () => {
    const tmp = makeTempDir();
    mkdirSync(join(tmp, "src/agents"), { recursive: true });
    writeFileSync(join(tmp, "src/agents/bad.ts"), 'console.log("hello");');
    const violations = validateLogging(tmp);
    expect(violations).toHaveLength(1);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("allows console usage in cli/", () => {
    const tmp = makeTempDir();
    mkdirSync(join(tmp, "src/cli"), { recursive: true });
    writeFileSync(join(tmp, "src/cli/index.ts"), 'console.log("ok");');
    const violations = validateLogging(tmp);
    expect(violations).toHaveLength(0);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("allows console usage in commands/", () => {
    const tmp = makeTempDir();
    mkdirSync(join(tmp, "src/commands"), { recursive: true });
    writeFileSync(join(tmp, "src/commands/x.ts"), 'console.log("ok");');
    const violations = validateLogging(tmp);
    expect(violations).toHaveLength(0);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("allows console in src/entry.ts", () => {
    const tmp = makeTempDir();
    mkdirSync(join(tmp, "src"), { recursive: true });
    writeFileSync(join(tmp, "src/entry.ts"), 'console.log("ok");');
    const violations = validateLogging(tmp);
    expect(violations).toHaveLength(0);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("skips test files", () => {
    const tmp = makeTempDir();
    mkdirSync(join(tmp, "src/agents"), { recursive: true });
    writeFileSync(join(tmp, "src/agents/planner.test.ts"), 'console.log("test");');
    const violations = validateLogging(tmp);
    expect(violations).toHaveLength(0);
    rmSync(tmp, { recursive: true, force: true });
  });
});
