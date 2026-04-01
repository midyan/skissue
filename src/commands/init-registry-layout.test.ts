import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fsStub = vi.hoisted(() => ({ root: "", statRegistryThrows: false }));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  const { join: j } = await import("node:path");
  return {
    ...actual,
    existsSync: (p: string) => {
      const json = fsStub.root ? j(fsStub.root, "registry.json") : "";
      const reg = fsStub.root ? j(fsStub.root, "registry") : "";
      if (json && p === json) return false;
      if (reg && p === reg) return true;
      return actual.existsSync(p);
    },
    statSync: (p: string, opts?: Parameters<typeof actual.statSync>[1]) => {
      const reg = fsStub.root ? j(fsStub.root, "registry") : "";
      if (fsStub.statRegistryThrows && reg && p === reg) {
        throw new Error("EACCES simulated");
      }
      return actual.statSync(p, opts);
    },
  };
});

describe("registryLayoutExists", () => {
  beforeEach(() => {
    fsStub.root = mkdtempSync(join(tmpdir(), "skissue-reglay-"));
    fsStub.statRegistryThrows = true;
    vi.resetModules();
  });

  afterEach(() => {
    if (fsStub.root) {
      try {
        rmSync(fsStub.root, { recursive: true, force: true });
      } catch {
        /* temp may be partially created */
      }
    }
    fsStub.root = "";
    fsStub.statRegistryThrows = false;
  });

  it("returns false when registry path exists but statSync throws", async () => {
    const { registryLayoutExists } = await import("./init-registry.js");
    expect(registryLayoutExists(fsStub.root)).toBe(false);
  });
});
