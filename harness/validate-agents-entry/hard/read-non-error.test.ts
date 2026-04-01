import { describe, expect, it, vi } from "vitest";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: (p: string) => p.endsWith("AGENTS.md"),
    readFileSync: () => {
      throw 42;
    },
  };
});

describe("validateAgentsEntry / readFileSync throws non-Error", () => {
  it("uses String() in the unreadable detail", async () => {
    const { validateAgentsEntry } = await import("./index.js");
    const v = validateAgentsEntry("/any/root", { maxLines: 200 });
    expect(v.some((x) => x.rule === "unreadable" && x.detail.includes("42"))).toBe(true);
  });
});
