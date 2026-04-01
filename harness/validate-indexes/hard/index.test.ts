import { describe, expect, it } from "vitest";
import { parseIndexLinks } from "./index.js";

describe("validate-indexes / parseIndexLinks", () => {
  it("extracts links from a typical INDEX.md table", () => {
    const content = [
      "# my-dir/",
      "",
      "| Entry | Description |",
      "| ----- | ----------- |",
      "| [foo.ts](foo.ts) | Does foo |",
      "| [bar/](bar/) | Bar module |",
    ].join("\n");

    const links = parseIndexLinks(content);
    expect(links).toEqual(new Set(["foo.ts", "bar"]));
  });

  it("normalizes trailing slashes", () => {
    const content = "| [src/](src/) | Source |";
    const links = parseIndexLinks(content);
    expect(links.has("src")).toBe(true);
    expect(links.has("src/")).toBe(false);
  });

  it("returns empty set for content without table links", () => {
    const content = "# Empty\n\nNo table here.\n";
    expect(parseIndexLinks(content)).toEqual(new Set());
  });
});
