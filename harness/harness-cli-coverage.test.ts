import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV_ROOT = "SKISSUE_HARNESS_ROOT";

class ProcessExit extends Error {
  readonly exitCode: number;
  constructor(code: number) {
    super(`process.exit(${code})`);
    this.name = "ProcessExit";
    this.exitCode = code;
  }
}

function spyExitThrows() {
  return vi.spyOn(process, "exit").mockImplementation((code?: string | number | null) => {
    const n = code == null || code === "" ? 0 : typeof code === "number" ? code : Number(code);
    throw new ProcessExit(Number.isFinite(n) ? n : 0);
  });
}

async function importCli(url: string, expected: number): Promise<void> {
  try {
    await import(/* @vite-ignore */ url);
    throw new Error("expected process.exit");
  } catch (e) {
    if (e instanceof ProcessExit) {
      expect(e.exitCode).toBe(expected);
      return;
    }
    throw e;
  }
}

function cliModule(skill: string): string {
  return fileURLToPath(new URL(`./${skill}/hard/index.js`, import.meta.url));
}

function fakeArgv(marker: string, extra: string[] = []): void {
  process.argv = ["node", `/repo/harness/${marker}`, ...extra];
}

describe("harness CLIs with SKISSUE_HARNESS_ROOT", () => {
  let tmp: string;
  const prevRoot = process.env[ENV_ROOT];
  const prevScoreThrow = process.env.SKISSUE_HARNESS_SCORE_THROW;
  const argv0 = process.argv.slice();

  beforeEach(() => {
    vi.resetModules();
    tmp = mkdtempSync(join(tmpdir(), "hcli-"));
    process.env[ENV_ROOT] = tmp;
    delete process.env.SKISSUE_HARNESS_SCORE_THROW;
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    vi.restoreAllMocks();
    process.argv = argv0;
    if (prevRoot === undefined) delete process.env[ENV_ROOT];
    else process.env[ENV_ROOT] = prevRoot;
    if (prevScoreThrow === undefined) delete process.env.SKISSUE_HARNESS_SCORE_THROW;
    else process.env.SKISSUE_HARNESS_SCORE_THROW = prevScoreThrow;
  });

  it("validate-agents-entry CLI exits 1 then 0", async () => {
    fakeArgv("validate-agents-entry/hard/index.ts");
    const ex = spyExitThrows();
    try {
      await importCli(cliModule("validate-agents-entry"), 1);
    } finally {
      ex.mockRestore();
    }
    writeFileSync(join(tmp, "AGENTS.md"), "# Title\n\nBody.\n", "utf8");
    vi.resetModules();
    process.env[ENV_ROOT] = tmp;
    fakeArgv("validate-agents-entry/hard/index.ts");
    const ex2 = spyExitThrows();
    try {
      await importCli(cliModule("validate-agents-entry"), 0);
    } finally {
      ex2.mockRestore();
    }
  });

  it("validate-harness-doc CLI exits 1 then 0", async () => {
    mkdirSync(join(tmp, "docs"), { recursive: true });
    writeFileSync(join(tmp, "docs", "HARNESS.md"), "one line\n", "utf8");
    fakeArgv("validate-harness-doc/hard/index.ts");
    const ex = spyExitThrows();
    try {
      await importCli(cliModule("validate-harness-doc"), 1);
    } finally {
      ex.mockRestore();
    }
    writeFileSync(
      join(tmp, "docs", "HARNESS.md"),
      Array.from({ length: 20 }, (_, i) => `Line ${i} content here`).join("\n"),
      "utf8",
    );
    vi.resetModules();
    process.env[ENV_ROOT] = tmp;
    fakeArgv("validate-harness-doc/hard/index.ts");
    const ex2 = spyExitThrows();
    try {
      await importCli(cliModule("validate-harness-doc"), 0);
    } finally {
      ex2.mockRestore();
    }
  });

  it("validate-registry CLI skip and failure", async () => {
    fakeArgv("validate-registry/hard/index.ts");
    const ex = spyExitThrows();
    try {
      await importCli(cliModule("validate-registry"), 0);
    } finally {
      ex.mockRestore();
    }
    writeFileSync(join(tmp, "registry.json"), "{ not json", "utf8");
    vi.resetModules();
    process.env[ENV_ROOT] = tmp;
    fakeArgv("validate-registry/hard/index.ts");
    const ex2 = spyExitThrows();
    try {
      await importCli(cliModule("validate-registry"), 1);
    } finally {
      ex2.mockRestore();
    }
  });

  it("validate-registry CLI exits 0 when registry.json is valid", async () => {
    mkdirSync(join(tmp, "registry", "my-skill"), { recursive: true });
    writeFileSync(join(tmp, "registry", "my-skill", "SKILL.md"), "# Skill\n", "utf8");
    writeFileSync(
      join(tmp, "registry.json"),
      JSON.stringify({ skills: { "my-skill": "registry/my-skill" } }),
      "utf8",
    );
    vi.resetModules();
    process.env[ENV_ROOT] = tmp;
    fakeArgv("validate-registry/hard/index.ts");
    const ex = spyExitThrows();
    try {
      await importCli(cliModule("validate-registry"), 0);
    } finally {
      ex.mockRestore();
    }
  });

  it("validate-links CLI exits 1 then 0", async () => {
    writeFileSync(join(tmp, "a.md"), "[x](./missing.md)\n", "utf8");
    fakeArgv("validate-links/hard/index.ts");
    const ex = spyExitThrows();
    try {
      await importCli(cliModule("validate-links"), 1);
    } finally {
      ex.mockRestore();
    }
    writeFileSync(join(tmp, "b.md"), "ok\n", "utf8");
    writeFileSync(join(tmp, "a.md"), "[x](./b.md)\n", "utf8");
    vi.resetModules();
    process.env[ENV_ROOT] = tmp;
    fakeArgv("validate-links/hard/index.ts");
    const ex2 = spyExitThrows();
    try {
      await importCli(cliModule("validate-links"), 0);
    } finally {
      ex2.mockRestore();
    }
  });

  it("validate-logging CLI exits 1 then 0", async () => {
    mkdirSync(join(tmp, "src", "mod"), { recursive: true });
    writeFileSync(join(tmp, "src", "mod", "x.ts"), "console.log(1);\n", "utf8");
    fakeArgv("validate-logging/hard/index.ts");
    const ex = spyExitThrows();
    try {
      await importCli(cliModule("validate-logging"), 1);
    } finally {
      ex.mockRestore();
    }
    writeFileSync(join(tmp, "src", "mod", "x.ts"), "export const x = 1;\n", "utf8");
    vi.resetModules();
    process.env[ENV_ROOT] = tmp;
    fakeArgv("validate-logging/hard/index.ts");
    const ex2 = spyExitThrows();
    try {
      await importCli(cliModule("validate-logging"), 0);
    } finally {
      ex2.mockRestore();
    }
  });

  it("validate-naming CLI exits 1 then 0", async () => {
    mkdirSync(join(tmp, "src"), { recursive: true });
    writeFileSync(join(tmp, "src", "BadName.ts"), "export {}\n", "utf8");
    fakeArgv("validate-naming/hard/index.ts");
    const ex = spyExitThrows();
    try {
      await importCli(cliModule("validate-naming"), 1);
    } finally {
      ex.mockRestore();
    }
    rmSync(join(tmp, "src", "BadName.ts"));
    writeFileSync(join(tmp, "src", "good-name.ts"), "export {}\n", "utf8");
    vi.resetModules();
    process.env[ENV_ROOT] = tmp;
    fakeArgv("validate-naming/hard/index.ts");
    const ex2 = spyExitThrows();
    try {
      await importCli(cliModule("validate-naming"), 0);
    } finally {
      ex2.mockRestore();
    }
  });

  it("validate-shell-exec CLI exits 1 then 0", async () => {
    mkdirSync(join(tmp, "src"), { recursive: true });
    writeFileSync(join(tmp, "src", "naughty.ts"), 'import x from "node:child_process";\n', "utf8");
    fakeArgv("validate-shell-exec/hard/index.ts");
    const ex = spyExitThrows();
    try {
      await importCli(cliModule("validate-shell-exec"), 1);
    } finally {
      ex.mockRestore();
    }
    rmSync(join(tmp, "src", "naughty.ts"));
    writeFileSync(join(tmp, "src", "clean.ts"), "export {}\n", "utf8");
    vi.resetModules();
    process.env[ENV_ROOT] = tmp;
    fakeArgv("validate-shell-exec/hard/index.ts");
    const ex2 = spyExitThrows();
    try {
      await importCli(cliModule("validate-shell-exec"), 0);
    } finally {
      ex2.mockRestore();
    }
  });

  it("validate-indexes CLI exits 1 then 0", async () => {
    writeFileSync(join(tmp, "one.txt"), "", "utf8");
    writeFileSync(join(tmp, "two.txt"), "", "utf8");
    fakeArgv("validate-indexes/hard/index.ts");
    const ex = spyExitThrows();
    try {
      await importCli(cliModule("validate-indexes"), 1);
    } finally {
      ex.mockRestore();
    }
    writeFileSync(
      join(tmp, "INDEX.md"),
      [
        "# Root",
        "",
        "## Contents",
        "",
        "| Name | Description |",
        "| ---- | ----------- |",
        "| [one.txt](one.txt) | a |",
        "| [two.txt](two.txt) | b |",
        "",
      ].join("\n"),
      "utf8",
    );
    vi.resetModules();
    process.env[ENV_ROOT] = tmp;
    fakeArgv("validate-indexes/hard/index.ts");
    const ex2 = spyExitThrows();
    try {
      await importCli(cliModule("validate-indexes"), 0);
    } finally {
      ex2.mockRestore();
    }
  });

  it("validate-deps CLI exits 1 then 0", async () => {
    mkdirSync(join(tmp, "src", "git"), { recursive: true });
    writeFileSync(
      join(tmp, "src", "git", "bad.ts"),
      'import type { x } from "../commands/install.js";\nexport {}\n',
      "utf8",
    );
    fakeArgv("validate-deps/hard/index.ts");
    const ex = spyExitThrows();
    try {
      await importCli(cliModule("validate-deps"), 1);
    } finally {
      ex.mockRestore();
    }
    rmSync(join(tmp, "src", "git"), { recursive: true });
    mkdirSync(join(tmp, "src", "commands"), { recursive: true });
    writeFileSync(join(tmp, "src", "config.ts"), "export const c = 1;\n", "utf8");
    writeFileSync(
      join(tmp, "src", "commands", "x.ts"),
      'import { c } from "../config.js";\nexport const u = c;\n',
      "utf8",
    );
    vi.resetModules();
    process.env[ENV_ROOT] = tmp;
    fakeArgv("validate-deps/hard/index.ts");
    const ex2 = spyExitThrows();
    try {
      await importCli(cliModule("validate-deps"), 0);
    } finally {
      ex2.mockRestore();
    }
  });

  it("repo-verify CLI discover, dry-run, failure, success", async () => {
    mkdirSync(join(tmp, "harness"), { recursive: true });
    writeFileSync(join(tmp, "package.json"), "{}", "utf8");
    fakeArgv("repo-verify/hard/index.ts", ["--discover"]);
    const ex = spyExitThrows();
    try {
      await importCli(cliModule("repo-verify"), 0);
    } finally {
      ex.mockRestore();
    }
    vi.resetModules();
    process.env[ENV_ROOT] = tmp;
    fakeArgv("repo-verify/hard/index.ts", ["--plan"]);
    const ex2 = spyExitThrows();
    try {
      await importCli(cliModule("repo-verify"), 0);
    } finally {
      ex2.mockRestore();
    }
    vi.resetModules();
    process.env[ENV_ROOT] = tmp;
    fakeArgv("repo-verify/hard/index.ts");
    const ex3 = spyExitThrows();
    try {
      await importCli(cliModule("repo-verify"), 1);
    } finally {
      ex3.mockRestore();
    }
    writeFileSync(
      join(tmp, "package.json"),
      JSON.stringify({ scripts: { verify: 'node -e "process.exit(0)"' } }),
      "utf8",
    );
    vi.resetModules();
    process.env[ENV_ROOT] = tmp;
    fakeArgv("repo-verify/hard/index.ts");
    const ex4 = spyExitThrows();
    try {
      await importCli(cliModule("repo-verify"), 0);
    } finally {
      ex4.mockRestore();
    }
  });

  it("report-harness-score CLI success and forced error path", async () => {
    mkdirSync(join(tmp, "docs"), { recursive: true });
    for (const [name, body] of [
      ["ARCHITECTURE.md", "# A\n\nLayers describe the stack.\n"],
      ["HARNESS.md", "# H\n\nRules\n\n| Constraint | Enforcement |\n| --- | --- |\n"],
      ["DECISIONS.md", "# D\n"],
      ["PROGRESS.md", "# P\n"],
      ["contributing.md", "# C\n"],
      ["index-format.md", "# F\n"],
    ] as const) {
      writeFileSync(join(tmp, "docs", name), body, "utf8");
    }
    writeFileSync(join(tmp, "AGENTS.md"), "# A\n\nMap entry.\n\n" + "[l](x)\n".repeat(6), "utf8");
    writeFileSync(join(tmp, "README.md"), "# R\n", "utf8");
    writeFileSync(
      join(tmp, "package.json"),
      JSON.stringify({
        scripts: {
          lint: "eslint .",
          typecheck: "tsc --noEmit",
          test: "vitest run",
          "test:coverage": "vitest run --coverage",
        },
      }),
      "utf8",
    );
    mkdirSync(join(tmp, ".husky"), { recursive: true });
    writeFileSync(join(tmp, ".husky", "pre-commit"), "#!/bin/sh\n", "utf8");
    writeFileSync(join(tmp, ".husky", "commit-msg"), "#!/bin/sh\n", "utf8");
    mkdirSync(join(tmp, "harness"), { recursive: true });
    writeFileSync(join(tmp, "harness", "runner.ts"), "// r\n", "utf8");
    for (const id of ["s1", "s2"]) {
      mkdirSync(join(tmp, "harness", id, "hard"), { recursive: true });
      writeFileSync(join(tmp, "harness", id, "hard", "index.ts"), "export {}\n", "utf8");
      writeFileSync(join(tmp, "harness", id, "hard", "index.test.ts"), "export {}\n", "utf8");
    }
    mkdirSync(join(tmp, "src", "m"), { recursive: true });
    writeFileSync(join(tmp, "src", "m", "index.ts"), "export {}\n", "utf8");
    writeFileSync(join(tmp, "src", "m", "index.test.ts"), "export {}\n", "utf8");
    fakeArgv("report-harness-score/hard/index.ts");
    const ex = spyExitThrows();
    try {
      await importCli(cliModule("report-harness-score"), 0);
    } finally {
      ex.mockRestore();
    }
    process.env.SKISSUE_HARNESS_SCORE_THROW = "1";
    vi.resetModules();
    process.env[ENV_ROOT] = tmp;
    fakeArgv("report-harness-score/hard/index.ts");
    const ex2 = spyExitThrows();
    try {
      await importCli(cliModule("report-harness-score"), 1);
    } finally {
      ex2.mockRestore();
    }
  });
});
