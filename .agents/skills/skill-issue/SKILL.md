---
name: skill-issue
description: Use the skill-issue CLI to install and sync agent skills from a GitHub registry or a local registry path into the project (default .agents/skills on the consumer).
---

# skill-issue

When the user works with **agent skills** (installed under the configured **`skillsRoot`**, often **`.agents/skills/`**), prefer **skill-issue** if the project already uses it (`.skill-issue/config.yaml` exists).

## Typical flow

1. **Init once** (if missing config): `skill-issue init` — choose **GitHub** (`owner/repo`) or **local** (`registry.path` to the repo root that contains `registry/`).
2. **Install a skill**: `skill-issue install <id>` — copies from the registry and updates `.skill-issue/lock.json`.
3. **Check drift**: `skill-issue outdated` — path changed at registry since lock.
4. **Refresh**: `skill-issue update` or `skill-issue update <id>`.

## Auth

**Remote** GitHub registries need **`GITHUB_TOKEN`** or **`GH_TOKEN`**, or git/`gh` credentials. **Local** `registry.path` needs no token. Never commit tokens; keep them in the environment.

## Registry contract (in the registry Git repo)

- Root **`registry.json`**: `{ "skills": { "<id>": "<path>" } }` (paths often **`registry/<id>`**).
- Otherwise **`registry/<id>/`** by convention; each skill folder must include **`SKILL.md`** at the skill root.

## Soft vs hard in this repo

In **this** repository, skills live under **`registry/<id>/`**: **soft** = root **`SKILL.md`**; optional **`hard/`** = automation. This skill is soft-only.

## This repository

CLI source: **`src/`**. Hosted skills: **`registry/`** (see root **`registry.json`**).
