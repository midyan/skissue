---
name: repo-verify
description: Discover every registry hard skill (and which run in check:all), then run the full repo verification pipeline — preferring package.json verify, else TypeScript, lint, format check, test:coverage (or test), check:all, build. Uses hard/.no-auto-run; invoke via npm run repo-verify, not as part of check:all.
---

# repo-verify

**Meta verification** for repositories that use this registry pattern:

1. **Discover** — scan `registry/*/hard/index.ts` and report which skills are included in **`npm run check:all`** (via `registry/runner.ts`) vs excluded by **`hard/.no-auto-run`**.
2. **Plan** — if **`package.json`** defines **`scripts.verify`**, use that as the single source of truth for static checks, tests with coverage, harness, and build. Otherwise run a **fallback chain**: `tsc --noEmit` (when `tsconfig.json` exists), then `lint`, `format:check`, **`test:coverage`** if defined else **`test`**, `check:all`, `build` — only for scripts that exist.
3. **Execute** — run the plan (unless `--plan` / `--dry-run`).

This skill does **not** replace individual validators; it **orchestrates** them so agents and humans have one entry point that matches CI when `verify` is defined.

## CI and local gate

Run the full pipeline before sharing commits: **`npm run verify`**, or **`npm run repo-verify`** when you want the **discovery table** plus the same run (this registry defines both).

## Git hooks: run verification on `pre-push`

**Agents should configure Husky `pre-push`** so the repo-verify / verify pipeline runs automatically before **`git push`**, not only when invoked manually or from **`pre-commit`**.

| Hook           | Typical use                                                                               |
| -------------- | ----------------------------------------------------------------------------------------- |
| **pre-commit** | Fast, commit-local steps (formatters, **`update-skill-checksums`**, lint-staged)          |
| **pre-push**   | Full gate: **`npm run repo-verify`** (or **`npm run verify`** if `repo-verify` is absent) |

**Setup (Husky already installed with a `prepare` script):**

1. Add an executable **`.husky/pre-push`** at the repo root.
2. Run **`npm run repo-verify`** when **`package.json`** defines **`scripts.repo-verify`**; otherwise run **`npm run verify`** (or the closest aggregate your project uses).

Example **`.husky/pre-push`**:

```sh
#!/usr/bin/env sh
set -eu
npm run repo-verify
```

If the project has no **`repo-verify`** script, use:

```sh
#!/usr/bin/env sh
set -eu
npm run verify
```

**Why `pre-push`:** **`repo-verify`** can be slower than a minimal **`pre-commit`** (discovery + tests + coverage + **`check:all`**). Blocking **push** catches CI failures before the remote updates while keeping commits lightweight.

**If adding this hook in a repo that lacks it:** create the file, **`chmod +x .husky/pre-push`**, and confirm **`git push`** triggers the script (a failing step must exit non-zero so the push aborts).

## When to use

- Before a PR or release when you want **everything** (not only `check:all`).
- When onboarding: see which hard skills exist and which are in the default harness runner.
- After adding a new **`registry/<id>/hard/`** skill — confirm it appears in discovery output.

## Invocation

```bash
npm run repo-verify
npx tsx registry/repo-verify/hard/index.ts
```

| Flag                          | Meaning                                      |
| ----------------------------- | -------------------------------------------- |
| `--plan`, `-n`, `--dry-run`   | Print what would run; do not execute         |
| `--discover`, `--list-skills` | Only print the skill discovery table; exit 0 |

## Why `hard/.no-auto-run`?

If this script were auto-run by **`check:all`**, it would typically invoke **`npm run verify`**, which already runs **`check:all`** — recursion. Keeping **`repo-verify`** out of the runner avoids that. **`npm run verify`** remains the CI/local aggregate; **`repo-verify`** adds discovery + the same run with explicit reporting.

## See also

- [docs/HARNESS.md](../../../docs/HARNESS.md) — harness commands and invariants for this repo
- [hard/README.md](hard/README.md) — executable contract
- [hard-skills](../hard-skills/SKILL.md) — authoring `hard/` checks
- [implement-ai-harness](../implement-ai-harness/SKILL.md) — harness rollout
