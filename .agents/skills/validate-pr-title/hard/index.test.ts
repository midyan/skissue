import { describe, expect, it } from "vitest";
import { parseTicketFromBranch, validate, type Violation } from "./index.js";

describe("parseTicketFromBranch", () => {
  it("parses feat/HUB-123", () => {
    expect(parseTicketFromBranch("feat/HUB-123")).toBe("HUB-123");
  });

  it("normalizes case", () => {
    expect(parseTicketFromBranch("fix/hub-99")).toBe("HUB-99");
  });

  it("returns null for invalid branch", () => {
    expect(parseTicketFromBranch("main")).toBeNull();
    expect(parseTicketFromBranch("feat/foo")).toBeNull();
  });
});

describe("validate", () => {
  it("accepts a CI-valid title", () => {
    expect(validate("feat: [SHIP] add user authentication endpoint")).toHaveLength(0);
  });

  it("rejects unknown type", () => {
    const v = validate("foo: [SHIP] bar");
    expect(v.some((x: Violation) => x.rule === "type")).toBe(true);
  });

  it("rejects missing workflow tag", () => {
    const v = validate("feat: HUB-1 add thing");
    expect(v.some((x: Violation) => x.rule === "subject-pattern")).toBe(true);
  });

  it("rejects empty title", () => {
    const v = validate("   ");
    expect(v.some((x: Violation) => x.rule === "empty")).toBe(true);
  });

  it("when branch matches, requires ticket in subject", () => {
    expect(
      validate("feat: [ASK] HUB-10 Short description", { branch: "feat/HUB-10" }),
    ).toHaveLength(0);
    const v = validate("feat: [ASK] HUB-11 Short description", { branch: "feat/HUB-10" });
    expect(v.some((x: Violation) => x.rule === "ticket-match")).toBe(true);
  });

  it("flags bad branch pattern when branch is passed", () => {
    const v = validate("feat: [ASK] HUB-1 ok", { branch: "not-a-branch" });
    expect(v.some((x: Violation) => x.rule === "branch")).toBe(true);
  });

  it("does not require ticket when branch is omitted", () => {
    expect(validate("feat: [SHIP] add user authentication endpoint")).toHaveLength(0);
  });
});
