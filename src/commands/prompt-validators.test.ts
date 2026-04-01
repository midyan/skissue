import { describe, expect, it } from "vitest";
import { requiredTrimmed } from "./prompt-validators.js";

describe("requiredTrimmed", () => {
  it("allows non-empty strings", () => {
    expect(requiredTrimmed("x")).toBeUndefined();
    expect(requiredTrimmed("  x  ")).toBeUndefined();
  });

  it("rejects empty and whitespace-only", () => {
    expect(requiredTrimmed("")).toBe("Required");
    expect(requiredTrimmed("   ")).toBe("Required");
    expect(requiredTrimmed(null)).toBe("Required");
    expect(requiredTrimmed(undefined)).toBe("Required");
  });
});
