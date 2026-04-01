import { describe, expect, it } from "vitest";
import { validateShellExec } from "./index.js";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "validate-shell-test-"));
}

describe("validate-shell-exec", () => {
  it("passes when child_process only in allowed files", () => {
    const tmp = makeTempDir();
    mkdirSync(join(tmp, "src/utils"), { recursive: true });
    mkdirSync(join(tmp, "src/tmux"), { recursive: true });
    writeFileSync(
      join(tmp, "src/utils/shell.ts"),
      'import { execFile } from "node:child_process";',
    );
    writeFileSync(join(tmp, "src/tmux/session.ts"), 'import { exec } from "../utils/shell.js";');
    const violations = validateShellExec(tmp);
    expect(violations).toHaveLength(0);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("detects child_process in disallowed files", () => {
    const tmp = makeTempDir();
    mkdirSync(join(tmp, "src/agents"), { recursive: true });
    writeFileSync(join(tmp, "src/agents/bad.ts"), 'import { execSync } from "node:child_process";');
    const violations = validateShellExec(tmp);
    expect(violations).toHaveLength(1);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("skips test files", () => {
    const tmp = makeTempDir();
    mkdirSync(join(tmp, "src/agents"), { recursive: true });
    writeFileSync(
      join(tmp, "src/agents/thing.test.ts"),
      'import { exec } from "node:child_process";',
    );
    const violations = validateShellExec(tmp);
    expect(violations).toHaveLength(0);
    rmSync(tmp, { recursive: true, force: true });
  });
});
