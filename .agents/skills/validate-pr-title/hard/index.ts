#!/usr/bin/env tsx

/**
 * PR title validation aligned with CI:
 * `.github/workflows/pr-title-check.yml` (amannn/action-semantic-pull-request).
 * Keep `PR_TYPES` and `SUBJECT_PATTERN` in sync with that workflow.
 */

export interface Violation {
  rule: string;
  detail: string;
}

/** Must match `types:` in `pr-title-check.yml`. */
export const PR_TYPES = new Set([
  "feat",
  "fix",
  "chore",
  "docs",
  "hotfix",
  "refactor",
  "test",
  "ci",
  "perf",
  "style",
  "build",
  "revert",
]);

/**
 * Must match `subjectPattern` in `pr-title-check.yml` exactly.
 * If you change the YAML, update this regex.
 */
export const SUBJECT_PATTERN = /^(?:\[SHIP\]|\[SHOW\]|\[ASK\])\s.+$/;

/** Branch shape `type/TICKET-ID` (same prefixes as conventional PR types). */
const BRANCH_TICKET =
  /^(feat|fix|chore|docs|hotfix|refactor|test|build|perf|style|ci|revert)\/([A-Za-z][A-Za-z0-9]*-\d+)$/;

export interface ValidatePrTitleOptions {
  /** When set, subject must contain the same ticket id as the branch (e.g. feat/HUB-123 → HUB-123). */
  branch?: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Parse `feat/HUB-123` → `HUB-123`, or null if the branch does not match the ticket-branch pattern. */
export function parseTicketFromBranch(branch: string): string | null {
  const m = branch.trim().match(BRANCH_TICKET);
  if (!m) {
    return null;
  }
  const raw = m[2];
  const norm = raw.match(/^([A-Za-z][A-Za-z0-9]*)-(\d+)$/);
  if (!norm) {
    return null;
  }
  return `${norm[1].toUpperCase()}-${norm[2]}`;
}

export function validate(title: string, options: ValidatePrTitleOptions = {}): Violation[] {
  const violations: Violation[] = [];
  const trimmed = title.trim();
  if (!trimmed) {
    violations.push({ rule: "empty", detail: "PR title is empty." });
    return violations;
  }

  const firstLine = trimmed.split(/\r?\n/)[0] ?? "";
  const typeMatch = firstLine.match(/^(\w+):\s*(.+)$/);
  if (!typeMatch) {
    violations.push({
      rule: "format",
      detail: 'Title must be "type: subject" (e.g. feat: [ASK] HUB-1 summary).',
    });
    return violations;
  }

  const [, type, subject] = typeMatch;
  if (!PR_TYPES.has(type)) {
    violations.push({
      rule: "type",
      detail: `Unknown type "${type}". Allowed: ${[...PR_TYPES].sort().join(", ")}.`,
    });
  }

  if (!SUBJECT_PATTERN.test(subject.trim())) {
    violations.push({
      rule: "subject-pattern",
      detail:
        "Subject after the colon must start with [SHIP], [SHOW], or [ASK], then a space and the rest (see pr-title-check.yml subjectPattern).",
    });
  }

  const branch = options.branch?.trim();
  if (branch) {
    const ticket = parseTicketFromBranch(branch);
    if (!ticket) {
      violations.push({
        rule: "branch",
        detail: `Branch "${branch}" does not match type/TICKET-ID (e.g. feat/HUB-123).`,
      });
    } else {
      const re = new RegExp(`\\b${escapeRegExp(ticket)}\\b`, "i");
      if (!re.test(subject)) {
        violations.push({
          rule: "ticket-match",
          detail: `Subject must include ticket "${ticket}" from branch "${branch}".`,
        });
      }
    }
  }

  return violations;
}

function parseCliArgs(argv: string[]): { title?: string; branch?: string } {
  const out: { title?: string; branch?: string } = {};
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--title" && args[i + 1]) {
      out.title = args[++i];
      continue;
    }
    if (a === "--branch" && args[i + 1]) {
      out.branch = args[++i];
      continue;
    }
  }
  return out;
}

const isCLI = process.argv.some((arg) => arg?.includes("validate-pr-title/hard/index.ts")) ?? false;

if (isCLI) {
  const { title, branch } = parseCliArgs(process.argv);
  if (!title) {
    console.error(
      'Usage: npm run check:pr-title -- --title "feat: [ASK] HUB-1 summary" [--branch feat/HUB-1]',
    );
    process.exit(1);
  }
  const violations = validate(title, { branch });
  if (violations.length === 0) {
    console.log("check:pr-title — OK.");
    process.exit(0);
  } else {
    console.error(`check:pr-title — ${violations.length} violation(s):\n`);
    for (const v of violations) {
      console.error(`  [${v.rule}] ${v.detail}`);
    }
    console.error("");
    process.exit(1);
  }
}
