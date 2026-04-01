import { describe, expect, it } from "vitest";
import { validateDeps } from "./index.js";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "validate-deps-test-"));
}

describe("validate-deps (skill-issue layout)", () => {
  it("passes when commands, git, and registry use allowed imports", () => {
    const tmp = makeTempDir();
    mkdirSync(join(tmp, "src/commands"), { recursive: true });
    mkdirSync(join(tmp, "src/git"), { recursive: true });
    mkdirSync(join(tmp, "src/registry"), { recursive: true });
    writeFileSync(join(tmp, "src/config.ts"), "export const x = 1;");
    writeFileSync(join(tmp, "src/git/exec.ts"), "export const x = 1;");
    writeFileSync(join(tmp, "src/registry/resolve.ts"), "export const x = 1;");
    writeFileSync(
      join(tmp, "src/commands/install.ts"),
      'import { x } from "../config.js";\nimport { y } from "../git/exec.js";\nimport { z } from "../registry/resolve.js";\n',
    );
    writeFileSync(join(tmp, "src/git/registry-repo.ts"), 'import { x } from "../config.js";\n');
    const violations = validateDeps(tmp);
    expect(violations).toHaveLength(0);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("detects git importing registry", () => {
    const tmp = makeTempDir();
    mkdirSync(join(tmp, "src/git"), { recursive: true });
    mkdirSync(join(tmp, "src/registry"), { recursive: true });
    writeFileSync(join(tmp, "src/registry/resolve.ts"), "export const x = 1;");
    writeFileSync(join(tmp, "src/git/bad.ts"), 'import { x } from "../registry/resolve.js";\n');
    const violations = validateDeps(tmp);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.layer).toBe("git");
    expect(violations[0]!.importedLayer).toBe("registry");
    rmSync(tmp, { recursive: true, force: true });
  });

  it("detects core importing git", () => {
    const tmp = makeTempDir();
    mkdirSync(join(tmp, "src/git"), { recursive: true });
    writeFileSync(join(tmp, "src/git/exec.ts"), "export const x = 1;");
    writeFileSync(join(tmp, "src/config.ts"), 'import { x } from "../git/exec.js";\n');
    const violations = validateDeps(tmp);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.layer).toBe("core");
    expect(violations[0]!.importedLayer).toBe("git");
    rmSync(tmp, { recursive: true, force: true });
  });

  it("allows utils to be imported from any layer", () => {
    const tmp = makeTempDir();
    mkdirSync(join(tmp, "src/commands"), { recursive: true });
    mkdirSync(join(tmp, "src/utils"), { recursive: true });
    writeFileSync(join(tmp, "src/utils/ids.ts"), "export const x = 1;");
    writeFileSync(join(tmp, "src/commands/install.ts"), 'import { x } from "../utils/ids.js";\n');
    const violations = validateDeps(tmp);
    expect(violations).toHaveLength(0);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("detects registry importing commands", () => {
    const tmp = makeTempDir();
    mkdirSync(join(tmp, "src/commands"), { recursive: true });
    mkdirSync(join(tmp, "src/registry"), { recursive: true });
    writeFileSync(join(tmp, "src/commands/list.ts"), "export const x = 1;");
    writeFileSync(join(tmp, "src/registry/bad.ts"), 'import { x } from "../commands/list.js";\n');
    const violations = validateDeps(tmp);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.layer).toBe("registry");
    expect(violations[0]!.importedLayer).toBe("commands");
    rmSync(tmp, { recursive: true, force: true });
  });
});
