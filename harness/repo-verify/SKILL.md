---
name: repo-verify
description: Discover every harness hard skill (and which run in check:all), then run the full repo verification pipeline — preferring package.json verify, else TypeScript, lint, format check, tests, check:all, check:harness-score, build. Uses hard/.no-auto-run; invoke via npm run repo-verify, not as part of check:all.
---

# repo-verify

**Meta verification** for repositories that use this harness pattern:

1. **Discover** — scan `harness/*/hard/index.ts` and report which skills are included in **`npm run check:all`** (via `harness/runner.ts`) vs excluded by **`hard/.no-auto-run`**.
2. **Plan** — if **`package.json`** defines **`scripts.verify`**, use that as the single source of truth for static checks, tests, harness, harness score, and build. Otherwise run a **fallback chain**: `tsc --noEmit` (when `tsconfig.json` exists), then `lint`, `format:check`, `test`, `check:all`, `check:harness-score`, `build` — only for scripts that exist.
3. **Execute** — run the plan (unless `--plan` / `--dry-run`).

This skill does **not** replace individual validators; it **orchestrates** them so agents and humans have one entry point that matches CI when `verify` is defined.

## Pre-commit (same as `verify`)

The repo installs **[Husky](https://typicode.github.io/husky/)** via **`npm install`** (`prepare` script). **`.husky/pre-commit`** runs **`npm run verify`** — TypeScript, ESLint, Prettier check, tests, **`check:all`**, **`check:harness-score`**, and **`build`** — so local commits match the static gate used in CI. To skip hooks for a one-off commit (use sparingly): **`git commit --no-verify`**.

## When to use

- Before a PR or release when you want **everything** (not only `check:all`).
- When onboarding: see which hard skills exist and which are in the default harness runner.
- After adding a new **`harness/<id>/hard/`** skill — confirm it appears in discovery output.

## Invocation

```bash
npm run repo-verify
npx tsx harness/repo-verify/hard/index.ts
```

| Flag                          | Meaning                                      |
| ----------------------------- | -------------------------------------------- |
| `--plan`, `-n`, `--dry-run`   | Print what would run; do not execute         |
| `--discover`, `--list-skills` | Only print the skill discovery table; exit 0 |

## Why `hard/.no-auto-run`?

If this script were auto-run by **`check:all`**, it would typically invoke **`npm run verify`**, which already runs **`check:all`** — recursion. Keeping **`repo-verify`** out of the runner avoids that. **`npm run verify`** remains the CI/local aggregate; **`repo-verify`** adds discovery + the same run with explicit reporting.

## See also

- [`.husky/pre-commit`](../../.husky/pre-commit) — runs `npm run verify` before each commit
- [hard/README.md](hard/README.md) — executable contract
- [docs/index-format.md](../../docs/index-format.md) — INDEX table format
