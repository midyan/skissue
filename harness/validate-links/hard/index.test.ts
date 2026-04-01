import { describe, expect, it } from "vitest";
import { extractLinks } from "./index.js";

describe("validate-links / extractLinks", () => {
  describe("basic extraction", () => {
    it("extracts a simple relative link", () => {
      const links = extractLinks("[readme](README.md)");
      expect(links).toEqual([{ line: 1, target: "README.md" }]);
    });

    it("extracts multiple links from one line", () => {
      const links = extractLinks("[a](a.md) and [b](b.md)");
      expect(links).toEqual([
        { line: 1, target: "a.md" },
        { line: 1, target: "b.md" },
      ]);
    });

    it("extracts links across multiple lines", () => {
      const content = "[first](first.md)\n\n[second](second.md)";
      const links = extractLinks(content);
      expect(links).toEqual([
        { line: 1, target: "first.md" },
        { line: 3, target: "second.md" },
      ]);
    });

    it("extracts directory links with trailing slash", () => {
      const links = extractLinks("[src](src/)");
      expect(links).toEqual([{ line: 1, target: "src/" }]);
    });
  });

  describe("filtered targets", () => {
    it("skips links with an empty target path", () => {
      expect(extractLinks("x [t]()\n")).toEqual([]);
    });

    it("skips http links", () => {
      expect(extractLinks("[site](http://example.com)")).toEqual([]);
    });

    it("skips https links", () => {
      expect(extractLinks("[site](https://example.com)")).toEqual([]);
    });

    it("skips fragment-only links", () => {
      expect(extractLinks("[section](#heading)")).toEqual([]);
    });

    it("strips fragment from relative links", () => {
      const links = extractLinks("[ref](docs/guide.md#section)");
      expect(links).toEqual([{ line: 1, target: "docs/guide.md" }]);
    });
  });

  describe("code block filtering", () => {
    it("skips links inside fenced code blocks", () => {
      const content = ["```markdown", "[example](fake-link.md)", "```"].join("\n");
      expect(extractLinks(content)).toEqual([]);
    });

    it("skips links inside indented code fences", () => {
      const content = ["  ```", "  [example](fake-link.md)", "  ```"].join("\n");
      expect(extractLinks(content)).toEqual([]);
    });

    it("extracts links outside code blocks but not inside", () => {
      const content = [
        "[real](real.md)",
        "```",
        "[fake](fake.md)",
        "```",
        "[also-real](also-real.md)",
      ].join("\n");
      const links = extractLinks(content);
      expect(links).toEqual([
        { line: 1, target: "real.md" },
        { line: 5, target: "also-real.md" },
      ]);
    });
  });

  describe("inline code filtering", () => {
    it("skips links inside inline code", () => {
      const content = "Use `[text](path.md)` for markdown links";
      expect(extractLinks(content)).toEqual([]);
    });

    it("extracts real links but skips inline code links", () => {
      const content = "[real](real.md) and `[example](example.md)` syntax";
      const links = extractLinks(content);
      expect(links).toEqual([{ line: 1, target: "real.md" }]);
    });
  });

  describe("table links", () => {
    it("extracts links from markdown table cells", () => {
      const content = [
        "| Name | Path |",
        "| ---- | ---- |",
        "| [docs](docs/) | Documentation |",
      ].join("\n");
      const links = extractLinks(content);
      expect(links).toEqual([{ line: 3, target: "docs/" }]);
    });
  });
});
