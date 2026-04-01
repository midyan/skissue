---
name: organize-and-commit-changes
description: Organize code changes into logical commits and run a confirmation flow. Use when the user wants to commit changes in chunks, review each commit before applying, or follow a structured commit workflow with approval.
---

# Organize and Commit Changes

Guides the agent to group changed files into logical commits, propose one commit at a time, and only create the commit after the user says "Commit approved. Next".

## When to Use

- User asks to "go through the commits", "commit in logical chunks", or "commit one by one after confirmation".
- User wants to review staged changes before each commit is created.
- A batch of changes (e.g. after a feature) should be split into multiple conventional commits.

## Workflow

### 1. List and group changes

- Run `git status --short` (and `git status -u` if needed) to see all modified and untracked files.
- **Categorize by logical chunk**: group files that belong to the same concept (e.g. "database schema + migration", "new service + module registration", "API + DTOs").
- Order chunks so dependencies come first (e.g. schema before code that uses it).

### 2. For each commit (one at a time)

1. **Choose the chunk**: Pick the next logical group of files for one commit.
2. **Propose message**: Create a commit message that follows the project style (see below). Include a first line (≤ 72 chars) and a body with bullet points describing what the chunk does. Validate with:
   ```bash
   node bin/check-commit-message-length.js "feat: HUB-1590 Your first line" "- change one" "- change two"
   ```
   Shorten the first line until the script exits 0.
3. **Stage only that chunk**: `git add <file1> <file2> ...` for the files in this chunk.
4. **Present to user**: Show the commit message and list of staged files. Say you are waiting for their confirmation.
5. **Wait for user reply** — do not run `git commit` yet.

### 3. On user approval

- When the user says **"Commit approved. Next"** (or equivalent approval):
  1. **Commit** the currently staged changes with the proposed message:  
     `git commit -m "first line" -m "- change one\n- change two"` (body as a single string with `\n` between bullets, or multiple `-m "body part"`).
  2. **Proceed to the next chunk**: stage the next group of files, propose the next message (validating length), and again wait for confirmation.
- If the user says **no** or requests changes: unstage if needed (`git restore --staged .` or selective `git restore --staged <file>`), adjust the message or chunk, re-stage, and present again. Do not commit.

### 4. Finish

- When all chunks have been committed, say so and list the commits made (e.g. `git log -oneline -n <count>`).

## Commit Message Style

- **Format**:

  ```
  feat|chore|fix: HUB-XXX #Message   ← first line, max 72 chars

  - #CHANGE_1
  - #CHANGE_2
  - #CHANGE_3
  ```

  - **First line**: Prefix (`feat`|`chore`|`fix`), ticket (`HUB-<number>`), short summary. Must be **≤ 72 characters**.
  - **Body**: Bullet list describing what the commit does. Each line must start with `- ` (dash space).

- **Validation**: Run `node bin/check-commit-message-length.js "<first line>" "- bullet 1" "- bullet 2"` (or pipe full message). Script checks first-line length and that body lines are bullets.
- **Git**: Use `git commit -m "first line" -m "- bullet one\n- bullet two"` so the body appears as separate paragraphs/lines.
- **Tool-agnostic**: Do not add tool-specific text or trailers. Commit messages describe the change only.

## Logical Chunking Guidelines

- **One concept per commit**: e.g. "schema + migration", "config keys", "new provider + service", "wire in module", "API surface (DTOs + controller)".
- **Dependency order**: schema/config/deps first, then core logic, then callers (API, listeners, jobs).
- **Tests**: Can be same commit as the code they test, or a dedicated "tests for X" commit.
- **Docs/READMEs**: Can be one commit at the end or with the module they document.

## Summary

| Step | Agent action                                                                                             |
| ---- | -------------------------------------------------------------------------------------------------------- |
| 1    | Group all changed files into logical chunks in order.                                                    |
| 2    | For current chunk: propose message, validate first line length, stage files, show message + files, wait. |
| 3    | On "Commit approved. Next": commit staged changes, then stage next chunk and repeat from step 2.         |
| 4    | On "no": unstage/adjust message or chunk, re-stage, present again; do not commit.                        |
| 5    | When no chunks left: confirm done and show recent commits.                                               |

## Reference

- Commit message validation: `bin/check-commit-message-length.js` (first line ≤72 chars; body lines must be bullets `- ...`).
- Do not commit until the user explicitly approves (e.g. "Commit approved. Next").
- Keep commits tool-agnostic: no `--trailer` or body text that names an IDE or editor.
- **If the IDE adds a trailer anyway**: Cursor can inject `--trailer "Made-with: Cursor"` automatically. The user should disable this in **Cursor Settings → Agents → Attribution** (toggle off). The agent must not add trailers; if they still appear, it is the IDE, not the agent.
