import { describe, expect, it, vi } from "vitest";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: (p: string) => p.replace(/\\/g, "/").includes("/docs/HARNESS.md"),
    readFileSync: () => {
      throw "boom";
    },
  };
});

describe("validateHarnessDoc / readFileSync throws non-Error", () => {
  it("uses String() in the unreadable detail", async () => {
    const { validateHarnessDoc } = await import("./index.js");
    const v = validateHarnessDoc("/x", { minNonEmptyLines: 1 });
    expect(v.some((x) => x.rule === "unreadable" && x.detail.includes("boom"))).toBe(true);
  });
});
