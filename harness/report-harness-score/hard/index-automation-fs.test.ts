import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import type { PathLike } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readdirStub = vi.hoisted(() => ({ harnessThrows: false }));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    readdirSync: (path: PathLike, options?: BufferEncoding | { withFileTypes?: boolean }) => {
      const s = String(path).replace(/\\/g, "/");
      if (readdirStub.harnessThrows && /[/]harness$/.test(s)) {
        throw new Error("EACCES simulated");
      }
      return actual.readdirSync(path, options as never);
    },
  };
});

describe("report-harness-score / scoreAutomation (harness readdir throws)", () => {
  beforeEach(() => {
    readdirStub.harnessThrows = true;
    vi.resetModules();
  });

  afterEach(() => {
    readdirStub.harnessThrows = false;
    vi.resetModules();
  });

  it("covers readdir failure when counting auto-run hard skills", async () => {
    const { scoreAutomation } = await import("./index.js");
    const tmp = mkdtempSync(join(tmpdir(), "rhs-autofs-"));
    try {
      mkdirSync(join(tmp, "harness"), { recursive: true });
      writeFileSync(join(tmp, "harness", "runner.ts"), "// r\n");
      mkdirSync(join(tmp, "harness", "s1", "hard"), { recursive: true });
      writeFileSync(join(tmp, "harness", "s1", "hard", "index.ts"), "export {}\n");
      const result = scoreAutomation(tmp);
      expect(result.details.some((d) => d.includes("At least 2 auto-run"))).toBe(true);
      expect(result.details.some((d) => d.includes("unit tests"))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
