---
name: hard-skills
description: How to create, test, and integrate executable hard skills — TypeScript scripts that validate, report on, or transform repository state. Use when asked to add a new hard skill, validation check, pre-commit hook, or automated linter.
---

# Hard Skills

How to build executable TypeScript validation scripts that live under
`registry/<skill-id>/hard/` in this registry repo and run via `registry/runner.ts` and `npm run check:all`.

## What is a hard skill?

A hard skill is a **stateless, side-effect-free TypeScript script** that inspects
repository state and reports violations. It exits `0` for pass, `1` for failure,
and writes human-readable output to stdout/stderr. The same script is called by
Husky hooks, the `runner.ts` orchestrator, npm scripts, and agents.

Contrast with **soft skills** (like this file), which are markdown instructions
that teach agents _how_ to do something. Hard skills _do_ the thing.

## Directory layout

Each skill with a **hard** component uses:

```
registry/
├── <skill-id>/
│   ├── SKILL.md          # soft — when/why to use this skill
│   └── hard/
│       ├── index.ts      # script entrypoint
│       ├── index.test.ts # vitest unit tests
│       ├── SKILL.md      # hard — contract, invocation
│       └── .no-auto-run  # (optional) exclude from runner
├── runner.ts             # runs each */hard/index.ts
└── SKILL.md              # registry layout overview
```

Naming: use lowercase kebab-case verbs — `validate-links`, `check-imports`,
`report-coverage`. Prefix with `validate-` for pass/fail checks and `report-`
for informational output.

## Step 1: Create the directory and README

```bash
mkdir -p registry/<skill-id>/hard
```

Write the `README.md` first. It must contain:

1. **Title** — the skill name as an `# h1`
2. **One-liner** — what it checks or does
3. **Invocation** — `npx tsx` command and the npm script alias
4. **Exit codes** — table with `0` and `1` meanings
5. **What it checks** — table of rule names and descriptions
6. **When to run** — which workflows trigger it

Use the existing READMEs in `validate-links/`, `validate-indexes/`, or
`validate-commit-msg/` as templates.

## Step 2: Write index.ts

### Contract

Every `index.ts` must follow this contract:

| Concern         | Rule                                                                    |
| --------------- | ----------------------------------------------------------------------- |
| Shebang         | First line: `#!/usr/bin/env tsx`                                        |
| Exit codes      | `0` = pass, `1` = violations found                                      |
| Output          | stdout for success messages, stderr for violations                      |
| Side effects    | **None** — read-only access to the filesystem                           |
| Dependencies    | Node.js built-ins only (`node:fs`, `node:path`, etc.) — no npm packages |
| Root resolution | `const ROOT = resolve(import.meta.dirname ?? ".", "../../../..");`      |
| Exports         | Export the core validation function and types for testing               |
| CLI guard       | Wrap `process.exit()` calls behind an `isCLI` check                     |

### Anatomy

```typescript
#!/usr/bin/env tsx

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname ?? ".", "../../../..");

// --- Exported types for tests ---

export interface Violation {
  rule: string;
  detail: string;
}

// --- Exported pure validation function ---

export function validate(input: string): Violation[] {
  const violations: Violation[] = [];
  // ... stateless validation logic ...
  return violations;
}

// --- CLI entrypoint (guarded) ---

const isCLI = process.argv[1]?.includes("<skill-id>/hard/index.ts") ?? false;

if (isCLI) {
  // read input from file, args, or filesystem
  const violations = validate(/* ... */);

  if (violations.length === 0) {
    console.log("check:<skill-name> — all good.");
    process.exit(0);
  } else {
    console.error(`check:<skill-name> — found ${violations.length} violation(s):\n`);
    for (const v of violations) {
      console.error(`  [${v.rule}] ${v.detail}`);
    }
    console.error();
    process.exit(1);
  }
}
```

### Path resolution

The `ROOT` constant must resolve to the repository root. From
`registry/<skill-id>/hard/index.ts`, that is **3 levels up**:

```
index.ts → hard/ → <skill-id>/ → registry/ → ROOT
```

So: `resolve(import.meta.dirname ?? ".", "../../..")`.

### The isCLI guard

The guard prevents `process.exit()` from killing the test runner when the
module is imported. Pattern:

```typescript
const isCLI = process.argv[1]?.includes("<skill-id>/hard/index.ts") ?? false;

if (isCLI) {
  // all process.exit(), console.log/error, and arg parsing goes here
}
```

The exported functions remain importable from tests without triggering exits.

### The .no-auto-run marker

If your skill **requires arguments** (like `validate-commit-msg` needs a file
path), create a `.no-auto-run` file in **`registry/<skill-id>/hard/`**:

```
This skill requires arguments (<explain why>) and cannot be run by the
hard skills runner. It is invoked by <explain how>.
```

The runner skips any skill directory containing this file. Skills without
`.no-auto-run` are auto-discovered and run by `npm run check:all`.

## Step 3: Write unit tests

Create `index.test.ts` alongside `index.ts`. Tests import the exported pure
functions directly — no subprocess spawning, no filesystem fixtures needed for
the core logic.

```typescript
import { describe, expect, it } from "vitest";
import { validate } from "./index.js";

describe("<skill-name>", () => {
  it("passes on valid input", () => {
    expect(validate("good input")).toEqual([]);
  });

  it("catches <specific violation>", () => {
    const v = validate("bad input");
    expect(v.some((x) => x.rule === "<rule-name>")).toBe(true);
  });
});
```

Test files are picked up automatically — `vitest.config.ts` includes
`registry/**/*.test.ts`.

Run tests with:

```bash
npm test                  # all tests (no coverage report)
npm run test:coverage     # same tests + coverage on registry/**/hard/index.ts
npx vitest run <path>     # single file
npm run test:watch        # watch mode
```

## Step 4: Register the skill

### 4a. Add an npm script

In `package.json`, add a `check:<name>` script:

```json
"check:<name>": "tsx registry/<skill-id>/hard/index.ts"
```

### 4b. Hook it up

**If the skill needs no arguments** (auto-runnable): it is automatically
discovered by `runner.ts` and runs via `npm run check:all` and the
`pre-commit` Husky hook. No changes needed.

**If the skill needs arguments** (e.g., a file path):

1. Create the `.no-auto-run` marker file (see above).
2. Add a Husky hook that passes the right argument. Create or edit the hook
   file at `.husky/<hook-name>`:

```bash
npx tsx registry/<skill-id>/hard/index.ts "$1"
```

Available git hooks: `pre-commit`, `commit-msg`, `pre-push`, `post-checkout`,
`prepare-commit-msg`.

### 4c. Update INDEX.md

Add the new skill to `registry/INDEX.md`:

```markdown
| [<skill-name>/](<skill-name>/) | <one-line description> |
```

Keep entries sorted alphabetically. Also update `docs/contributing.md` if the
skill adds a new hook or npm script.

## Step 5: Verify

In **this** repository, **`npm run verify`** runs TypeScript, ESLint, Prettier check, **`npm run test:coverage`**, **`npm run check:all`**, and build — use it before a PR. When iterating on a single skill only:

```bash
npm test                  # all unit tests pass
npm run check:all         # runner discovers and passes the new skill
npm run check:<name>      # standalone invocation works
```

## Reference: existing hard skills

| Skill                 | Hook                    | Auto-run            | Tests           |
| --------------------- | ----------------------- | ------------------- | --------------- |
| `validate-indexes`    | pre-commit (via runner) | yes                 | `index.test.ts` |
| `validate-links`      | pre-commit (via runner) | yes                 | `index.test.ts` |
| `validate-commit-msg` | commit-msg (dedicated)  | no (`.no-auto-run`) | `index.test.ts` |

Read their `README.md` and `index.ts` for concrete examples of the patterns
described above.
