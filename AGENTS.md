# skissue — Agent guide

Entry point for agents working in this repository. Navigate via INDEX files and `AGENTS.md`; do not rely on scanning the whole tree.

## What this repo is

- **CLI** (`src/`) — `skissue` installs skills from a Git registry into a **consumer** project (default install path **`.agents/skills/<id>/`** on the consumer).
- **Skills registry (payload)** — root **`registry.json`** + **`registry/<skill-id>/`** trees live in the separate **skill-registry** repository; the CLI fetches and copies that tree. **`.agents/`** here is only for **repo rules** (INDEX maintenance), not for hosting the full registry.

Each skill in **skill-registry** couples **soft** (root `SKILL.md`) and optional **hard** (`hard/SKILL.md` + `hard/index.ts`). This repo’s **`harness/`** tree runs only the checks needed for the CLI and docs.

## Quick navigation

| What                                | Where                                                                                                                                                                                                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLI source                          | [src/INDEX.md](src/INDEX.md)                                                                                                                                                                                                                                    |
| **Skills-registry** (hosted skills) | Separate repository: `registry.json` + `registry/<id>/` skill trees                                                                                                                                                                                             |
| Harness (this repo’s checks)        | [harness/INDEX.md](harness/INDEX.md)                                                                                                                                                                                                                            |
| Agent rules (not the registry)      | [.agents/rules/](.agents/rules/)                                                                                                                                                                                                                                |
| Harness docs (constraints, checks)  | [docs/HARNESS.md](docs/HARNESS.md)                                                                                                                                                                                                                              |
| Architecture (CLI, registry)        | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)                                                                                                                                                                                                                    |
| INDEX format spec                   | [docs/index-format.md](docs/index-format.md)                                                                                                                                                                                                                    |
| License                             | [LICENSE](LICENSE)                                                                                                                                                                                                                                              |
| GitHub Actions                      | [.github/workflows/ci.yml](.github/workflows/ci.yml) (verify), [.github/workflows/version-and-release.yml](.github/workflows/version-and-release.yml) (bump + tag on green `main`), [.github/workflows/publish.yml](.github/workflows/publish.yml) (npm on tag) |
| Install & script helpers            | [scripts/INDEX.md](scripts/INDEX.md)                                                                                                                                                                                                                            |
| npm scope template (no secrets)     | [.npmrc.example](.npmrc.example)                                                                                                                                                                                                                                |
| README (human)                      | [README.md](README.md)                                                                                                                                                                                                                                          |

## Engineering expectations

1. Follow [docs/index-format.md](docs/index-format.md) and [.agents/rules/index-maintenance.md](.agents/rules/index-maintenance.md) when adding or moving files.
2. Before committing, run **`npm run verify`** (TypeScript, ESLint, Prettier, tests, harness `check:all`, harness score report, build). Use **`npm run repo-verify`** to list which hard skills participate in `check:all` and run the same pipeline with explicit output. Use **`npm run check:all`** only when you need the harness runner alone.
3. Node **24+** (see `.nvmrc`).
