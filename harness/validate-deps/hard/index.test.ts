import { describe, expect, it, vi } from "vitest";
import { getLayer, validateDeps } from "./index.js";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "validate-deps-test-"));
}

describe("validate-deps (skissue layout)", () => {
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

  it("ignores ../ imports that do not resolve to a known layer", () => {
    const tmp = makeTempDir();
    mkdirSync(join(tmp, "src/commands"), { recursive: true });
    writeFileSync(
      join(tmp, "src/commands", "x.ts"),
      'import { n } from "../not-a-layer/foo.js";\nexport const u = n;\n',
    );
    expect(validateDeps(tmp)).toHaveLength(0);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("getLayer returns undefined when file path is the src root", () => {
    const tmp = makeTempDir();
    mkdirSync(join(tmp, "src"), { recursive: true });
    expect(getLayer(join(tmp, "src"), tmp)).toBeUndefined();
    rmSync(tmp, { recursive: true, force: true });
  });

  it("getLayer returns undefined when relative path has no non-empty segment", async () => {
    vi.doMock("node:path", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:path")>();
      return { ...actual, relative: () => "//" };
    });
    vi.resetModules();
    try {
      const { getLayer: gl } = await import("./index.js");
      expect(gl("/proj/src/x.ts", "/proj")).toBeUndefined();
    } finally {
      vi.doUnmock("node:path");
      vi.resetModules();
    }
  });

  it("getLayer returns undefined for files outside the src tree", () => {
    const tmp = makeTempDir();
    mkdirSync(join(tmp, "src", "commands"), { recursive: true });
    mkdirSync(join(tmp, "outside"), { recursive: true });
    writeFileSync(join(tmp, "outside", "x.ts"), "export const x = 1;\n");
    expect(getLayer(join(tmp, "outside", "x.ts"), tmp)).toBeUndefined();
    rmSync(tmp, { recursive: true, force: true });
  });

  it("allows same-layer imports under commands", () => {
    const tmp = makeTempDir();
    mkdirSync(join(tmp, "src/commands"), { recursive: true });
    writeFileSync(join(tmp, "src/commands", "a.ts"), "export const a = 1;\n");
    writeFileSync(
      join(tmp, "src/commands", "b.ts"),
      'import { a } from "../commands/a.js";\nexport const u = a;\n',
    );
    expect(validateDeps(tmp)).toHaveLength(0);
    rmSync(tmp, { recursive: true, force: true });
  });
});
