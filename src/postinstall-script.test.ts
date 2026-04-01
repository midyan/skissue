import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type EnsureMod = { runEnsureLocalBin: (scriptPath: string) => void };

async function loadEnsure(): Promise<EnsureMod> {
  const href = new URL("../scripts/ensure-local-bin.mjs", import.meta.url).href;
  return (await import(/* @vite-ignore */ href)) as EnsureMod;
}

describe("scripts/ensure-local-bin.mjs", () => {
  it("runEnsureLocalBin skips when script path is under node_modules", async () => {
    const { runEnsureLocalBin } = await loadEnsure();
    const dir = join(tmpdir(), "nm", "node_modules", "x", "scripts");
    mkdirSync(dir, { recursive: true });
    const p = join(dir, "s.mjs");
    writeFileSync(p, "", "utf8");
    runEnsureLocalBin(p);
  });

  it("runEnsureLocalBin skips when dist/entry.js is missing", async () => {
    const { runEnsureLocalBin } = await loadEnsure();
    const root = join(tmpdir(), "pkg");
    const scriptsDir = join(root, "scripts");
    mkdirSync(scriptsDir, { recursive: true });
    const scriptPath = join(scriptsDir, "ensure-local-bin.mjs");
    writeFileSync(scriptPath, "", "utf8");
    runEnsureLocalBin(scriptPath);
  });

  it("runEnsureLocalBin writes node_modules/.bin/skissue when dist exists", async () => {
    const { runEnsureLocalBin } = await loadEnsure();
    const root = join(tmpdir(), "pkg2");
    const scriptsDir = join(root, "scripts");
    mkdirSync(scriptsDir, { recursive: true });
    mkdirSync(join(root, "dist"), { recursive: true });
    writeFileSync(join(root, "dist", "entry.js"), "//\n", "utf8");
    const scriptPath = join(scriptsDir, "ensure-local-bin.mjs");
    writeFileSync(scriptPath, "", "utf8");
    runEnsureLocalBin(scriptPath);
    const bin = join(root, "node_modules", ".bin", "skissue");
    const body = readFileSync(bin, "utf8");
    expect(body).toContain("entry.js");
    expect(body).toContain("exec node");
    rmSync(root, { recursive: true, force: true });
  });
});
