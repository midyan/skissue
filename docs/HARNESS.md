# Harness — skissue

This repository is optimized for **agent-assisted development** of the CLI. The **hosted skill catalog** lives in the separate **skill-registry** repository. The harness **inside this repo** is the combination of:

- **Navigation** — `AGENTS.md` at the root, `INDEX.md` tables in directories with
  multiple children, and `docs/index-format.md` as the spec.
- **Mechanical checks** — `npm run check:all` runs every `harness/<id>/hard/index.ts`
  that does not have `hard/.no-auto-run`. Violations must be actionable (fix the
  file or the index).
- **Human rules** — `.agents/rules/` for maintenance (e.g. INDEX updates) — not
  installable skills.

For system shape and import boundaries, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Principles

1. **Humans steer; agents execute.** Intent lives in issues and short docs; agents
   follow `AGENTS.md` and the relevant `INDEX.md` / `SKILL.md`.
2. **If it is not in the repo, it does not exist.** Prefer versioned markdown over
   chat-only decisions.
3. **Enforce invariants** — dependency direction, links, indexes, optional
   `registry.json` when present — via scripts so every PR gets the same bar.
4. **When the agent fails** — add a missing doc, test, or linter rule; do not rely
   on “try harder” prompts alone.

## Context budget

Keep `AGENTS.md` short (on the order of a few dozen lines). Put details in `docs/`,
`harness/SKILL.md`, or per-directory `INDEX.md`. Prefer one task → one navigation
path (AGENTS → INDEX → file) over loading every doc.

## Layer and import rules

The CLI follows a small **directed dependency graph** (see [ARCHITECTURE.md](ARCHITECTURE.md)).
**`validate-deps`** enforces `../` imports between layers under `src/`. Edit
`harness/validate-deps/hard/index.ts` if you introduce new top-level folders.

**Violation example:** a file under `src/git/` imports `../registry/foo.js` (git may
not depend on registry’s sibling modules incorrectly).

**Remediation:** move shared types/helpers to `core`, or invert the dependency by
calling from `commands/` instead.

## Linter catalog (`check:all`)

Each check runs via `harness/runner.ts` unless the skill has `hard/.no-auto-run`.

| Check                | Skill id                | What it enforces                                                        | Example fix                                        |
| -------------------- | ----------------------- | ----------------------------------------------------------------------- | -------------------------------------------------- |
| `check:agents-entry` | `validate-agents-entry` | Root `AGENTS.md` exists and stays within the line budget (default 200). | Shorten AGENTS; move prose to `docs/`.             |
| `check:harness-doc`  | `validate-harness-doc`  | `docs/HARNESS.md` exists with enough non-empty lines (default 12).      | Expand HARNESS with rules and commands.            |
| `check:indexes`      | `validate-indexes`      | `INDEX.md` lists every immediate child in indexed directories.          | Add missing rows to the relevant `INDEX.md`.       |
| `check:registry`     | `validate-registry`     | When `registry.json` exists: shape and on-disk skills with `SKILL.md`.  | Fix JSON or add missing `SKILL.md`.                |
| `check:links`        | `validate-links`        | No broken relative links in tracked markdown.                           | Correct paths or add targets.                      |
| `check:deps`         | `validate-deps`         | Allowed import directions under `src/` (see above).                     | Refactor imports per layer table.                  |
| `check:logging`      | `validate-logging`      | No raw `console.*` outside CLI surfaces (`commands/`, `entry.ts`).      | Use structured logging or keep output in commands. |
| `check:naming`       | `validate-naming`       | Kebab-case filenames and PascalCase types under `src/`.                 | Rename to match conventions.                       |
| `check:shell-exec`   | `validate-shell-exec`   | `child_process` only in approved modules (e.g. `src/git/exec.ts`).      | Route through `src/git/exec.ts`.                   |

**Not in `check:all` by default** (see each skill’s `hard/.no-auto-run`):

- `repo-verify` — meta orchestrator; use `npm run repo-verify`.
- `validate-commit-msg` — needs a commit message file path; use from git hooks or run manually.
- `validate-pr-title` — needs `--title`; for CI with semantic PR titles.
- `report-harness-score` — informational audit; run **`npm run check:harness-score`** (see [harness/report-harness-score/SKILL.md](../harness/report-harness-score/SKILL.md)).

## Taste invariants

- **Types at boundaries** — validate external data (config YAML, lock JSON) with the same schemas the CLI uses.
- **No silent failures** — registry or git errors should surface to the user or exit non-zero in scripts.
- **Idempotent installs** — reinstalling a skill should be safe; document destructive cases in the skill’s `SKILL.md`.

## Tests and CI

**One-shot local verification:** **`npm run verify`** runs, in order: `tsc --noEmit`, `npm run lint`, `npm run format:check`, `npm test`, **`npm run check:all`**, **`npm run check:harness-score`**, and **`npm run build`**. The **`repo-verify`** harness skill discovers every `harness/*/hard/` skill (and which are in **`check:all`**), then runs **`npm run verify`** when present, or the same steps as a fallback — use **`npm run repo-verify`** for that orchestration (see [harness/repo-verify/SKILL.md](../harness/repo-verify/SKILL.md)).

| Command                  | Purpose                                                           |
| ------------------------ | ----------------------------------------------------------------- |
| `npm run verify`         | Full static + test + harness + harness score + build (before PRs) |
| `npm run repo-verify`    | Discovery + same pipeline as `verify` (meta orchestrator)         |
| `npm run check:all`      | Harness only (hard skills runner)                                 |
| `npm run check:registry` | `registry.json` vs on-disk skills (when file exists)              |
| `npm run check:indexes`  | INDEX.md vs filesystem                                            |
| `npm test`               | Vitest (including `harness/**/hard/*.test.ts`)                    |

CI (`.github/workflows/ci.yml`) runs **`npm run verify`** on every push and PR.

## When the agent struggles

1. **Missing capability** — is the behavior documented in `SKILL.md` or `AGENTS.md`?
2. **Ambiguous abstraction** — add a short doc in `docs/` or a diagram in `ARCHITECTURE.md`.
3. **Repeated mistakes** — add or tighten a hard check; prefer mechanical enforcement over reminders.
4. **Flaky or missing tests** — add a unit test under `src/` or `harness/**/hard/*.test.ts`.

## Phases

- **Phase 1 (current)** — humans run the CLI and review PRs; agents follow the harness and `check:all`.
- **Phase 2** — optional: more automation (scheduled `report-harness-score`, stricter hooks). Encode new behavior in-repo rather than one-off prompts.

## Consumer projects

Projects that **install** skills from **skill-registry** use the `skissue` CLI and
keep a `.skill-issue/` config; that is separate from the harness **inside** this
repo.

## Further reading

- [harness/SKILL.md](../harness/SKILL.md) — harness vs skill-registry.
- [docs/index-format.md](index-format.md) — INDEX tables.
