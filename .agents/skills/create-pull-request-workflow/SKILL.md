---
name: create-pull-request-workflow
description: Push the current branch, validate the PR title, and create a draft GitHub PR or update an existing PR body using gh CLI. Use after commits are done when the user wants a draft PR with the correct title and template-filled description.
---

# Create Pull Request workflow

Use this after [commit-workflow](../commit-workflow/SKILL.md) when work is committed locally and you need a **draft** GitHub PR (or to refresh the description on an existing PR). Titles must pass CI and match project conventions; validate with **`npm run check:pr-title`** ([validate-pr-title](../validate-pr-title/hard/README.md)) before any push that will open a PR.

Align **ticket / issue linkage**, **default base branch**, and **post-merge notifications** with your team’s conventions (issue tracker, Slack, etc.).

## Prerequisites

- **GitHub CLI** installed and on `PATH` ([https://cli.github.com/](https://cli.github.com/); macOS: `brew install gh`).
- **Authenticated** with GitHub: `gh auth status` succeeds (otherwise `gh auth login`).
- **Remote** `origin` points at the GitHub repository for this project.

## Step 1 — Preflight: `gh`

Run:

```bash
command -v gh >/dev/null 2>&1 && gh --version
```

If `gh` is missing, stop and tell the user to install the GitHub CLI (link above).

Then:

```bash
gh auth status
```

If this fails, stop and instruct `gh auth login` (or token-based auth for automation environments).

## Step 2 — Repository context

```bash
git rev-parse --show-toplevel
git branch --show-current
git remote get-url origin
```

Confirm `origin` is a `github.com` URL (or GitHub Enterprise hostname your team uses). If there is no `origin`, stop.

## Step 3 — Target base branch

| Branch name prefix / pattern              | Base branch for PR |
| ----------------------------------------- | ------------------ |
| `hotfix/…`                                | `main`             |
| Everything else (`feat/…`, `fix/…`, etc.) | `development`      |

Adjust the table to match **your** repo’s branching model (document it in `CONTRIBUTING.md` if needed).

## Step 4 — MODE (`[SHIP]` \| `[SHOW]` \| `[ASK]`)

Choose one workflow tag for the PR title (see your repo’s `CONTRIBUTING.md`):

| Mode     | Use when                                    |
| -------- | ------------------------------------------- |
| `[SHIP]` | Trivial / low-risk; merge and deploy        |
| `[SHOW]` | Confident; want visibility / demo           |
| `[ASK]`  | Default for most feature work; needs review |

If the user does not specify, prefer **`[ASK]`**.

## Step 5 — Build and validate the PR title

Format:

```text
type: [MODE] TICKET-ID Short description
```

- **`type`**: same as commits / conventional PR types (must match `.github/workflows/pr-title-check.yml` in the target repo).
- **`TICKET-ID`**: from the branch if your team uses `type/TICKET-ID` branches (e.g. `feat/PROJ-1410` → `PROJ-1410`).
- **Short description**: concise, human-readable summary.

Validate **before** pushing:

```bash
npm run check:pr-title -- --title "feat: [ASK] PROJ-1410 Add dark mode toggle" --branch "$(git branch --show-current)"
```

Exit non-zero → fix the title; do not push for PR creation until this passes.

If `--branch` is omitted, only CI rules apply; **prefer always passing `--branch`** when your workflow ties the title to the branch ticket.

## Step 6 — PR body from the template

1. Read `.github/PULL_REQUEST_TEMPLATE.md` in the repo root.
2. Fill **Description**, **Pre-Merge Tasks**, **Post-Merge Tasks** as appropriate.
3. Under **Related Issues**, link the issue or ticket URL from your tracker (e.g. Linear, Jira, GitHub Issues).
4. Under **Type of Change**, put `x` in the checkbox that matches the PR `type` (`feat`, `fix`, etc.).
5. Write the result to a **temporary file** (e.g. `/tmp/pr-body.md`) and use **`--body-file`** with `gh` to avoid shell escaping issues.

## Step 7 — Push

```bash
git push -u origin HEAD
```

Resolve push failures (auth, missing upstream, rejected non-fast-forward) before continuing.

## Step 8 — Create draft PR or update existing

**Detect an existing PR for this head branch:**

```bash
gh pr list --head "$(git branch --show-current)" --json number,url --limit 1
```

- If the list is **empty** — create a **draft** PR:

```bash
gh pr create --draft --base <development|main> --title "<validated title>" --body-file /path/to/body.md
```

- If a PR **exists** — update the description (prefer not to change title unless the user asks, to reduce churn):

```bash
gh pr edit <number> --body-file /path/to/body.md
```

`gh` uses the repository associated with `origin` in the current directory.

## Step 9 — After the PR exists (optional)

Notify teammates per **your** team process (Slack, email, issue tracker). Do not post until the user confirms or asks for notification.

## Related

- **Hard skill:** [validate-pr-title](../validate-pr-title/hard/README.md) — `npm run check:pr-title`
- **Commits:** [commit-workflow](../commit-workflow/SKILL.md)
