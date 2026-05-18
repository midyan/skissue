# About skissue

**skissue** is a command-line tool that installs and synchronizes **AI agent skills** from a Git-based registry into a project—similar in spirit to a package manager, but oriented around agent-facing documentation and optional automated checks rather than libraries alone.

---

## What this project is

The published **npm package** `skissue` is a CLI (Node.js, TypeScript) that:

- Points at a **skill registry**: either a GitHub repository or a **local Git checkout** (useful for monorepos).
- Copies selected skills into a configurable directory (by default `.agents/skills/<skill-id>/`).
- Persists **configuration** under `.skill-issue/config.yaml` and **pinned versions** in `.skill-issue/lock.json`.

Each skill in a registry is a small tree: at minimum a `SKILL.md` that teaches agents _when and how_ to behave, and optionally a **`hard/`** subtree—executable checks (typically TypeScript) that CI or harness runners can invoke for guardrails.

The registry **payload** itself (`registry.json` plus `registry/<id>/` folders) normally lives in a separate repository referenced by consumers; this repository ships the CLI and dogfoods its own **harness** to keep the codebase, docs, and navigation consistent.

---

## What problem it solves

Teams using coding agents accumulate **ad-hoc rules, prompts, and scripts** scattered across repos, gists, or chat. That makes it hard to:

- **Share** the same agent behavior across projects and teammates.
- **Version** skills so installs are reproducible and upgrades are deliberate.
- **Pair guidance with enforcement**: soft instructions for agents and, when useful, hard checks in CI without maintaining two unrelated systems.

skissue addresses that gap by treating skills as **versionable artifacts** in a simple, Git-friendly layout, with explicit install paths and a lockfile so “what’s on disk” matches an intended registry commit—whether pulled from GitHub or from a path on disk.

---

## How it was developed

The CLI is implemented as a **layered TypeScript** codebase: core concerns (config, paths, lockfile, filesystem I/O, entry/bootstrap) stay separate from **commands**, **Git** integration (clone, checkout, diff against registry state), and **registry** resolution (`registry.json` and path conventions). Import direction is constrained (enforced in part by the in-repo `validate-deps` harness) so the dependency graph stays predictable.

**Quality and automation** are first-class: Vitest with coverage thresholds, ESLint, Prettier, TypeScript strict checking, a **harness** that runs executable “hard” checks under `harness/`, and a full `npm run verify` pipeline used in CI. Releases are automated via GitHub Actions (verify on changes, version bump and tagging on green `main`, publish to npm on tag). Local development uses `tsx` for running from source and **esbuild** for production builds; Husky hooks keep commits aligned with project conventions.

For a hands-on tour of commands and registry layout, see [README.md](README.md). For how the CLI modules relate to the registry and harness, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). For how to work in this repository as an agent or contributor, see [AGENTS.md](AGENTS.md).
