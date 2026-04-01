import { describe, expect, it, vi } from "vitest";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: (p: string) => p.endsWith("registry.json"),
    readFileSync: () => {
      throw 404;
    },
  };
});

describe("validateRegistry / JSON read throws non-Error", () => {
  it("uses String() in invalid-json detail", async () => {
    const { validateRegistry } = await import("./index.js");
    const v = validateRegistry("/root");
    expect(v.some((x) => x.rule === "invalid-json" && x.detail.includes("404"))).toBe(true);
  });
});
