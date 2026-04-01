#!/usr/bin/env tsx

/**
 * Checks all markdown files in the repository for broken relative links.
 *
 * Scans every .md file (excluding node_modules, .git, dist, coverage, .cursor),
 * extracts [text](target) links, and verifies each relative target resolves to
 * an existing file or directory.
 *
 * Exit code 0 = all links valid, 1 = broken links found.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";

const ROOT = resolve(import.meta.dirname ?? ".", "../../..");

const EXCLUDED = new Set([
  "node_modules",
  ".git",
  "coverage",
  "dist",
  ".cursor",
  // skill-issue install mirror — not canonical; links are relative to registry/ copies
  ".agents",
]);

export interface BrokenLink {
  file: string;
  line: number;
  target: string;
}

export interface ExtractedLink {
  line: number;
  target: string;
}

const broken: BrokenLink[] = [];

function relPath(abs: string): string {
  return abs.replace(ROOT + "/", "");
}

export function extractLinks(content: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const lines = content.split("\n");
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (line.trimStart().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const strippedLine = line.replace(/`[^`]+`/g, "");

    let match;
    while ((match = linkRegex.exec(strippedLine)) !== null) {
      const target = match[2]!;

      if (target.startsWith("http://") || target.startsWith("https://") || target.startsWith("#")) {
        continue;
      }

      const cleanTarget = target.split("#")[0]!;
      if (cleanTarget === "") continue;

      links.push({ line: i + 1, target: cleanTarget });
    }
  }
  return links;
}

function findMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findMarkdownFiles(fullPath));
    } else if (entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
}

function checkFile(filePath: string): void {
  const content = readFileSync(filePath, "utf-8");
  const links = extractLinks(content);

  for (const link of links) {
    const resolved = resolve(dirname(filePath), link.target);
    if (!existsSync(resolved)) {
      broken.push({
        file: relPath(filePath),
        line: link.line,
        target: link.target,
      });
    }
  }
}

const isCLI = process.argv[1]?.includes("validate-links/hard/index.ts") ?? false;

if (isCLI) {
  const mdFiles = findMarkdownFiles(ROOT);
  for (const file of mdFiles) {
    checkFile(file);
  }

  if (broken.length === 0) {
    console.log("check:links — all markdown links are valid.");
    process.exit(0);
  } else {
    console.error(`check:links — found ${broken.length} broken link(s):\n`);
    for (const b of broken) {
      console.error(`  ${b.file}:${b.line} → ${b.target}`);
    }
    console.error();
    process.exit(1);
  }
}
