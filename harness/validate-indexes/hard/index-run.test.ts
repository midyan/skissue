import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV = "SKISSUE_HARNESS_ROOT";

function rootIndexListingSubdir(): string {
  return [
    "# Root",
    "",
    "| Name | Description |",
    "| ---- | ----------- |",
    "| [sub](sub/) | nested |",
    "| [x.txt](x.txt) | file |",
    "| [y.txt](y.txt) | file |",
    "",
  ].join("\n");
}

describe("validate-indexes / runValidateIndexes (SKISSUE_HARNESS_ROOT)", () => {
  let tmp: string;
  const prev = process.env[ENV];

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "vix-run-"));
    process.env[ENV] = tmp;
    vi.resetModules();
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    if (prev === undefined) delete process.env[ENV];
    else process.env[ENV] = prev;
    vi.resetModules();
  });

  it("ignores root .tgz files when collecting children", async () => {
    writeFileSync(join(tmp, "a.ts"), "", "utf8");
    writeFileSync(join(tmp, "b.ts"), "", "utf8");
    writeFileSync(join(tmp, "release.tgz"), "", "utf8");
    const { runValidateIndexes } = await import("./index.js");
    const v = runValidateIndexes();
    expect(v.some((x) => x.kind === "missing-index")).toBe(true);
  });

  it("flags a child directory entry not listed in INDEX.md", async () => {
    mkdirSync(join(tmp, "sub"), { recursive: true });
    writeFileSync(join(tmp, "x.txt"), "", "utf8");
    writeFileSync(join(tmp, "y.txt"), "", "utf8");
    writeFileSync(join(tmp, "INDEX.md"), rootIndexListingSubdir(), "utf8");
    writeFileSync(join(tmp, "sub", "one.txt"), "", "utf8");
    writeFileSync(join(tmp, "sub", "two.txt"), "", "utf8");
    writeFileSync(
      join(tmp, "sub", "INDEX.md"),
      ["# sub", "", "| E | D |", "| --- | --- |", "| [one.txt](one.txt) | a |", ""].join("\n"),
      "utf8",
    );
    const { runValidateIndexes } = await import("./index.js");
    const v = runValidateIndexes();
    expect(v.some((x) => x.kind === "unlisted-child" && x.detail.includes("two.txt"))).toBe(true);
  });

  it("flags an INDEX.md link target that does not exist on disk", async () => {
    mkdirSync(join(tmp, "sub"), { recursive: true });
    writeFileSync(join(tmp, "x.txt"), "", "utf8");
    writeFileSync(join(tmp, "y.txt"), "", "utf8");
    writeFileSync(join(tmp, "INDEX.md"), rootIndexListingSubdir(), "utf8");
    writeFileSync(join(tmp, "sub", "real.txt"), "", "utf8");
    writeFileSync(join(tmp, "sub", "other.txt"), "", "utf8");
    writeFileSync(
      join(tmp, "sub", "INDEX.md"),
      [
        "# sub",
        "",
        "| E | D |",
        "| --- | --- |",
        "| [real.txt](real.txt) | a |",
        "| [other.txt](other.txt) | b |",
        "| [ghost.txt](ghost.txt) | c |",
        "",
      ].join("\n"),
      "utf8",
    );
    const { runValidateIndexes } = await import("./index.js");
    const v = runValidateIndexes();
    expect(v.some((x) => x.kind === "orphaned-entry" && x.detail.includes("ghost.txt"))).toBe(true);
  });
});
