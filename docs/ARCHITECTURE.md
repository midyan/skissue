# Architecture — skissue

This repository ships two related things:

1. **CLI** (`src/`) — installs skills from a Git (or local) registry into a consumer project under `.agents/skills/<id>/` (default).
2. **Hosted registry** — in the **skill-registry** repository: `registry.json` + `registry/<skill-id>/` is the payload fetched by the CLI; each skill has soft docs (`SKILL.md`) and optional hard checks (`hard/index.ts`).

## CLI layout (`src/`)

| Layer        | Role                                                                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **core**     | Root modules: `config`, `paths`, `lockfile`, `io`, `entry` — configuration, paths, lockfile I/O, filesystem copy helpers, CLI bootstrap. |
| **commands** | Commander subcommands (`init`, `install`, `list`, …). Orchestrates user-facing flows.                                                    |
| **git**      | Git invocation (`exec.ts`) and registry checkout / diff (`registry-repo.ts`).                                                            |
| **registry** | Resolve and list skills from a registry checkout (`catalog.ts`, `resolve.ts`).                                                           |

**Import rule:** `commands` may depend on `core`, `git`, and `registry`. `git` may depend on `core` only. `registry` has no upward imports to other layers. `core` does not import from `commands`, `git`, or `registry` via `../` (see `validate-deps` in `npm run check:all`).

## Registry layout (skill-registry)

In the **skill-registry** repo, see `registry/SKILL.md` (there). Skills are folders with `SKILL.md`; optional `hard/` provides CI checks for that repo.

## This repo’s harness

In **skissue** (this repository), `harness/runner.ts` runs every `harness/<id>/hard/index.ts` that is not marked with `hard/.no-auto-run`.
These checks validate the CLI source, docs, and indexes in **this** repository.

## Consumer vs maintainer paths

- **This repo** uses the harness under `AGENTS.md`, `docs/HARNESS.md`, and `harness/`.
- **Downstream projects** use `.skill-issue/config.yaml` and the published `skissue` CLI; that config is unrelated to the in-repo harness.
