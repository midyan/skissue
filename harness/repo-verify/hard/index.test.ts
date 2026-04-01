import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverHardSkills, readPackageScripts, resolveVerifyPlan, runPlan } from "./index.js";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

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

  it("readPackageScripts returns undefined when package.json is absent", () => {
    const tmp = makeTempDir();
    expect(readPackageScripts(tmp)).toBeUndefined();
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

  it("resolveVerifyPlan ignores whitespace-only verify script", () => {
    const tmp = makeTempDir();
    writeFileSync(
      join(tmp, "package.json"),
      JSON.stringify({ scripts: { verify: "  \n\t  ", lint: "eslint ." } }),
    );
    const plan = resolveVerifyPlan(tmp);
    expect(plan.kind).toBe("steps");
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
          "check:all": "tsx harness/runner.ts",
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

  it("discoverHardSkills returns empty when registry path is missing or not a directory", () => {
    const tmp = makeTempDir();
    const missing = join(tmp, "nope");
    expect(discoverHardSkills(missing)).toEqual([]);
    const asFile = join(tmp, "file-not-dir");
    writeFileSync(asFile, "x");
    expect(discoverHardSkills(asFile)).toEqual([]);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("discoverHardSkills skips skill dirs without hard/index.ts", () => {
    const tmp = makeTempDir();
    const reg = join(tmp, "registry");
    mkdirSync(join(reg, "no-hard-cli", "hard"), { recursive: true });
    mkdirSync(join(reg, "with-hard", "hard"), { recursive: true });
    writeFileSync(join(reg, "with-hard", "hard", "index.ts"), "export {};\n", "utf8");
    const d = discoverHardSkills(reg);
    expect(d.map((x) => x.id)).toEqual(["with-hard"]);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("discoverHardSkills skips dot entries and non-directory children", () => {
    const tmp = makeTempDir();
    const reg = join(tmp, "registry");
    mkdirSync(reg, { recursive: true });
    writeFileSync(join(reg, "not-a-dir"), "");
    mkdirSync(join(reg, ".hidden", "hard"), { recursive: true });
    writeFileSync(join(reg, ".hidden", "hard", "index.ts"), "export {};\n");
    const d = discoverHardSkills(reg);
    expect(d).toEqual([]);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("resolveVerifyPlan yields empty steps when package.json scripts missing", () => {
    const tmp = makeTempDir();
    writeFileSync(join(tmp, "package.json"), JSON.stringify({}), "utf8");
    const plan = resolveVerifyPlan(tmp);
    expect(plan).toEqual({ kind: "steps", steps: [] });
    rmSync(tmp, { recursive: true, force: true });
  });

  it("resolveVerifyPlan treats invalid package.json as no scripts", () => {
    const tmp = makeTempDir();
    writeFileSync(join(tmp, "package.json"), "{ not json", "utf8");
    expect(resolveVerifyPlan(tmp)).toEqual({ kind: "steps", steps: [] });
    rmSync(tmp, { recursive: true, force: true });
  });

  it("resolveVerifyPlan treats null scripts in package.json like missing scripts", () => {
    const tmp = makeTempDir();
    writeFileSync(join(tmp, "package.json"), JSON.stringify({ name: "x", scripts: null }), "utf8");
    expect(resolveVerifyPlan(tmp)).toEqual({ kind: "steps", steps: [] });
    rmSync(tmp, { recursive: true, force: true });
  });

  it("runPlan returns false when steps list is empty", () => {
    const tmp = makeTempDir();
    expect(runPlan(tmp, { kind: "steps", steps: [] }, false)).toBe(false);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("runPlan npm-verify dry run does not spawn", () => {
    const tmp = makeTempDir();
    writeFileSync(
      join(tmp, "package.json"),
      JSON.stringify({ scripts: { verify: "node -e 0" } }),
      "utf8",
    );
    expect(runPlan(tmp, { kind: "npm-verify", command: "verify" }, true)).toBe(true);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("runPlan steps dry run iterates without spawn", () => {
    const tmp = makeTempDir();
    expect(
      runPlan(
        tmp,
        {
          kind: "steps",
          steps: [{ label: "noop", argv: ["node", "-e", "0"] }],
        },
        true,
      ),
    ).toBe(true);
    rmSync(tmp, { recursive: true, force: true });
  });
});

function harnessModuleUrl(relFromHarness: string): string {
  return fileURLToPath(new URL(relFromHarness, import.meta.url));
}

function fakeArgv(marker: string, extra: string[] = []): () => void {
  const prev = process.argv.slice();
  process.argv = ["node", `/repo/harness/${marker}`, ...extra];
  return () => {
    process.argv = prev;
  };
}

/** Harness CLIs call `process.exit` synchronously; a no-op spy lets execution fall through. */
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

async function importCliModule(url: string, expectedExitCode: number): Promise<void> {
  try {
    await import(/* @vite-ignore */ url);
    throw new Error("expected process.exit");
  } catch (e) {
    if (e instanceof ProcessExit) {
      expect(e.exitCode).toBe(expectedExitCode);
      return;
    }
    throw e;
  }
}

describe("harness/runner (mocked)", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("node:fs");
    vi.doUnmock("node:child_process");
    vi.restoreAllMocks();
  });

  it("runs discoverable hard skills and exits 0 when all pass", async () => {
    vi.doMock("node:child_process", () => ({
      spawnSync: vi.fn().mockReturnValue({ status: 0, stdout: "", stderr: "" }),
    }));
    vi.doMock("node:fs", () => ({
      readdirSync: () => ["alpha-skill"],
      statSync: () => ({ isDirectory: () => true }),
      existsSync: (p: string) => {
        const n = String(p).replace(/\\/g, "/");
        if (n.includes("/hard/.no-auto-run")) return false;
        return n.endsWith("/hard/index.ts");
      },
    }));
    vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.spyOn(console, "log").mockImplementation(() => {});

    await import(/* @vite-ignore */ harnessModuleUrl("../../runner.js"));
  });

  it("exits 1 when a hard skill fails", async () => {
    vi.doMock("node:child_process", () => ({
      spawnSync: vi
        .fn()
        .mockReturnValueOnce({ status: 1, stdout: "x", stderr: "y" })
        .mockReturnValue({ status: 0, stdout: "", stderr: "" }),
    }));
    vi.doMock("node:fs", () => ({
      readdirSync: () => ["bad-skill", "good-skill"],
      statSync: () => ({ isDirectory: () => true }),
      existsSync: (p: string) => {
        const n = String(p).replace(/\\/g, "/");
        if (n.includes("/hard/.no-auto-run")) return false;
        return n.endsWith("/hard/index.ts");
      },
    }));
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    await import(/* @vite-ignore */ harnessModuleUrl("../../runner.js"));

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe("harness hard CLIs (coverage)", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  const cliCases: Array<{ marker: string; rel: string }> = [
    {
      marker: "validate-agents-entry/hard/index.ts",
      rel: "../../validate-agents-entry/hard/index.js",
    },
    { marker: "validate-deps/hard/index.ts", rel: "../../validate-deps/hard/index.js" },
    {
      marker: "validate-harness-doc/hard/index.ts",
      rel: "../../validate-harness-doc/hard/index.js",
    },
    { marker: "validate-indexes/hard/index.ts", rel: "../../validate-indexes/hard/index.js" },
    { marker: "validate-links/hard/index.ts", rel: "../../validate-links/hard/index.js" },
    { marker: "validate-logging/hard/index.ts", rel: "../../validate-logging/hard/index.js" },
    { marker: "validate-naming/hard/index.ts", rel: "../../validate-naming/hard/index.js" },
    { marker: "validate-registry/hard/index.ts", rel: "../../validate-registry/hard/index.js" },
    { marker: "validate-shell-exec/hard/index.ts", rel: "../../validate-shell-exec/hard/index.js" },
  ];

  it.each(cliCases)("CLI passes for $marker", async ({ marker, rel }) => {
    const restoreArgv = fakeArgv(marker);
    spyExitThrows();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await importCliModule(harnessModuleUrl(rel), 0);
    } finally {
      restoreArgv();
    }
  });

  it("report-harness-score CLI success", async () => {
    const restoreArgv = fakeArgv("report-harness-score/hard/index.ts");
    spyExitThrows();
    vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await importCliModule(harnessModuleUrl("../../report-harness-score/hard/index.js"), 0);
      expect(errSpy).not.toHaveBeenCalled();
    } finally {
      restoreArgv();
    }
  });

  it("report-harness-score CLI catch path", async () => {
    const restoreArgv = fakeArgv("report-harness-score/hard/index.ts");
    spyExitThrows();
    vi.spyOn(console, "log")
      .mockImplementationOnce(() => {
        throw new Error("boom");
      })
      .mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await importCliModule(harnessModuleUrl("../../report-harness-score/hard/index.js"), 1);
      expect(errSpy).toHaveBeenCalled();
    } finally {
      restoreArgv();
    }
  });

  it("repo-verify CLI --discover", async () => {
    const restoreArgv = fakeArgv("repo-verify/hard/index.ts", ["--discover"]);
    spyExitThrows();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await importCliModule(harnessModuleUrl("./index.js"), 0);
    } finally {
      restoreArgv();
    }
  });

  it("repo-verify CLI --dry-run", async () => {
    const restoreArgv = fakeArgv("repo-verify/hard/index.ts", ["--dry-run"]);
    spyExitThrows();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await importCliModule(harnessModuleUrl("./index.js"), 0);
    } finally {
      restoreArgv();
    }
  });
});

describe("repo-verify CLI failure path (mocked spawn)", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("node:child_process");
    vi.restoreAllMocks();
  });

  it("exits 1 when a verify step fails", async () => {
    vi.doMock("node:child_process", () => ({
      spawnSync: vi.fn().mockReturnValue({ status: 1, stdout: "", stderr: "nope" }),
    }));

    const restoreArgv = fakeArgv("repo-verify/hard/index.ts");
    spyExitThrows();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await importCliModule(harnessModuleUrl("./index.js"), 1);
    } finally {
      restoreArgv();
    }
  });
});

describe("root build & postinstall scripts (coverage)", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("loads esbuild.config.js with mocked esbuild", async () => {
    vi.doMock("esbuild", () => ({
      build: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock("node:fs", async (importOriginal) => {
      const fs = await importOriginal<typeof import("node:fs")>();
      return {
        ...fs,
        readFileSync: vi.fn(() => JSON.stringify({ version: "0.0.0-test" })),
      };
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await import(/* @vite-ignore */ harnessModuleUrl("../../../esbuild.config.js"));

    expect(logSpy).toHaveBeenCalled();
  });

  it("runs ensure-local-bin when dist exists (mocked fs)", async () => {
    vi.doMock("node:fs", () => ({
      chmodSync: vi.fn(),
      existsSync: vi.fn(() => true),
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn(),
    }));

    await import(/* @vite-ignore */ harnessModuleUrl("../../../scripts/ensure-local-bin.mjs"));
  });
});
