import { describe, expect, it } from "vitest";
import { validateNaming } from "./index.js";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "validate-naming-test-"));
}

describe("validate-naming", () => {
  it("passes for kebab-case files with PascalCase types", () => {
    const tmp = makeTempDir();
    mkdirSync(join(tmp, "src/types"), { recursive: true });
    writeFileSync(join(tmp, "src/types/index.ts"), "export interface MyType { x: number; }");
    const violations = validateNaming(tmp);
    expect(violations).toHaveLength(0);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("detects non-PascalCase type names", () => {
    const tmp = makeTempDir();
    mkdirSync(join(tmp, "src/types"), { recursive: true });
    writeFileSync(join(tmp, "src/types/index.ts"), "export type myBadType = string;");
    const violations = validateNaming(tmp);
    expect(violations.some((v) => v.kind === "type-name")).toBe(true);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("detects non-kebab-case file names", () => {
    const tmp = makeTempDir();
    mkdirSync(join(tmp, "src/utils"), { recursive: true });
    writeFileSync(join(tmp, "src/utils/myFile.ts"), "export const x = 1;");
    const violations = validateNaming(tmp);
    expect(violations.some((v) => v.kind === "file-name")).toBe(true);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("allows kebab-case .tsx files", () => {
    const tmp = makeTempDir();
    mkdirSync(join(tmp, "src/cli"), { recursive: true });
    writeFileSync(join(tmp, "src/cli/my-panel.tsx"), "export function X() { return null; }");
    const violations = validateNaming(tmp);
    expect(violations.filter((v) => v.kind === "file-name")).toHaveLength(0);
    rmSync(tmp, { recursive: true, force: true });
  });
});
