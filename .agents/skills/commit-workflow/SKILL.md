---
name: commit-workflow
description: Build well-structured git commits by analyzing changed files and splitting work into logical chunks. Use when the user asks to commit, create commits, stage changes, review diffs for committing, or organize uncommitted work into commits.
---

# Commit Workflow

When you run this skill you **must**:

1. **Create commits semantically** — Each commit must represent one logical unit of work (one concern, one feature, one fix, or one doc change). Group changes by purpose, not by file type.
2. **Apply the proper rules for commit messages** — Every message must follow Conventional Commits v1.0.0 and this project's rules (type, **no parenthetical scope**, imperative description, no forbidden trailers). Validate with `npm run check:commit-msg` before committing.
3. **Commit one by one** — Stage and commit each logical chunk separately. Do not batch all changes into a single commit. After each commit, run `git status` and proceed to the next chunk until the working tree is clean or only unrelated files remain.

---

How to analyze uncommitted changes, split them into logical chunks, and create clean git commits following [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).

## Step 1: Assess the working tree

Run these in parallel:

```bash
git status
git diff                 # unstaged changes
git diff --cached        # staged changes
git log --oneline -5     # recent style reference
```

Read the output carefully. Identify every changed, added, and deleted file.

## Step 2: Categorize changes into logical chunks

Group files by **purpose**, not by file type or directory. Each commit should represent one cohesive unit of work. Common grouping strategies:

| Signal                                          | Example chunk                                     |
| ----------------------------------------------- | ------------------------------------------------- |
| Schema change + migration + seed update         | `feat: add CreditProduct model`                   |
| New API route + its tests                       | `feat: implement GET /api/credits/balance`        |
| Component + hook + translations it needs        | `feat: add credit purchase modal`                 |
| Multiple files all fixing the same bug          | `fix: prevent double-charge on PIX webhook retry` |
| Docs-only changes (AGENTS.md, READMEs, /docs)   | `docs: document credit purchase flow`             |
| Config/CI/tooling (tsconfig, eslint, workflows) | `build: add typecheck step to CI`                 |
| Pure refactor with no behavior change           | `refactor: extract auth helpers from middleware`  |
| Test-only additions or fixes                    | `test: add unit tests for credit balance API`     |

**Splitting rules:**

- If a file serves two purposes (e.g., a util used by both a new feature and a bug fix), attribute it to the primary chunk; mention the secondary benefit in the commit body.
- Prefer smaller, focused commits over large ones. A commit touching 15+ files across unrelated concerns should almost always be split.
- Migrations and schema changes go in their own commit, before the code that uses them.
- Translation file changes (`messages/*.json`) go with the feature that introduced the new keys.
- Test files go with the code they test, unless the commit is test-only.

## Step 3: Stage and commit each chunk

For each chunk, stage only the relevant files:

```bash
git add path/to/file1 path/to/file2
```

Then commit. Always use a HEREDOC for the message to preserve formatting:

```bash
git commit -m "$(cat <<'EOF'
type: short description

Optional body explaining WHY, not what. Include context that isn't
obvious from the diff: trade-offs, constraints, related issues.

Optional-footer: value
EOF
)"
```

After each commit, run `git status` to confirm the remaining working tree is as expected before proceeding to the next chunk.

## Commit message format (Conventional Commits v1.0.0)

Structure (per the [spec](https://www.conventionalcommits.org/en/v1.0.0/)):

```
<type>[!]: <description>

[optional body]

[optional footer(s)]
```

In this repository, omit `(scope)` after the type — **validate-commit-msg** rejects it.

### Type (required)

Commits MUST be prefixed with a type noun:

| Type       | When to use                                                        |
| ---------- | ------------------------------------------------------------------ |
| `feat`     | New feature (correlates with MINOR in SemVer)                      |
| `fix`      | Bug fix (correlates with PATCH in SemVer)                          |
| `refactor` | Code change that neither fixes a bug nor adds a feature            |
| `perf`     | Performance improvement                                            |
| `test`     | Adding or fixing tests                                             |
| `docs`     | Documentation only                                                 |
| `build`    | Build system, CI, dependencies                                     |
| `chore`    | Maintenance (cleanup, formatting, tooling config)                  |
| `style`    | Code style/formatting (no logic change)                            |
| `revert`   | Reverts a previous commit (reference the reverted SHA in a footer) |

Only `feat` and `fix` are mandated by the spec; the others follow the [@commitlint/config-conventional](https://github.com/conventional-changelog/commitlint) extension.

### Scope

Conventional Commits allow an optional `(scope)` after the type. **In this repository, do not use it** — put the area (`cli`, `registry`, `api`, etc.) in the description or body instead. Examples: `feat: add validate-foo skill`, `fix: correct validate-deps layer graph`. The **validate-commit-msg** hard check rejects any `type(scope):` subject.

### Description (required)

- MUST immediately follow the colon and space after the type (and optional `!` for breaking changes)
- Imperative mood: "add", "fix", "remove" — not "added", "fixes", "removing"
- Lowercase after the colon
- No trailing period
- Maximum 72 characters for the entire subject line

### Breaking changes

A commit that introduces a breaking API change:

- Append `!` after the type: `feat!: remove legacy endpoint`
- And/or add a `BREAKING CHANGE:` footer (MUST be uppercase)

A BREAKING CHANGE can be part of any type. It correlates with MAJOR in SemVer.

### Body (optional)

Include a body when:

- The change is non-trivial (more than a one-liner fix)
- The "why" isn't obvious from the diff
- There are trade-offs, constraints, or deliberate decisions
- Multiple files are touched

Body rules:

- MUST begin one blank line after the description
- Free-form; MAY consist of any number of newline-separated paragraphs
- Wrap at 72 characters
- Explain **why**, not what (the diff shows what)
- Use bullet points for multiple items

### Footers (optional)

- One blank line after the body
- Each footer: a word token, then `:<space>` or `<space>#` separator, then a string value
- Use `-` in place of spaces in tokens (e.g., `Reviewed-by`, `Refs`)
- Exception: `BREAKING CHANGE` MAY be used as a token (with a space)

### Examples

**Minimal:**

```
fix: correct date format in reading session list
```

**With area in the description (no parentheses):**

```
feat: implement GET /api/sessions/:id endpoint
```

**With body:**

```
perf: add Cache-Control headers to API routes

- reading-types, products: public, s-maxage=3600, stale-while-revalidate=86400
- credits/balance, sessions/pending-count: private, max-age=10, stale-while-revalidate=30
```

**Breaking change with `!` and footer:**

```
feat!: replace session creation payload format

The `readingType` field is now `readingTypeId` (UUID). Old clients
sending the string slug will receive a 400 error.

BREAKING CHANGE: session creation payload uses readingTypeId instead of readingType
```

**Revert:**

```
revert: let us never again speak of the noodle incident

Refs: 676104e, a215868
```

**Multi-paragraph body with footers:**

```
fix: prevent racing of requests

Introduce a request id and a reference to latest request. Dismiss
incoming responses other than from latest request.

Remove timeouts which were used to mitigate the racing issue but are
obsolete now.

Reviewed-by: Z
Refs: #123
```

## Forbidden patterns

**Never include AI-attribution trailers or metadata:**

- `Made-with: Cursor`
- `Made with Cursor`
- `Generated by Claude`
- `Co-authored-by: Cursor` / `Co-authored-by: Claude` / any AI co-author
- `Made-with: <any AI tool>`
- Any similar "made with", "generated by", "assisted by" attribution to an AI tool

These add no value to the git history and leak tooling details into the permanent record.

**Other anti-patterns to avoid:**

- Vague messages: "fix: stuff", "chore: updates", "feat: changes"
- Kitchen-sink commits: "feat: too many changes to keep track"
- WIP commits: "wip: working on it" (if work is incomplete, describe what was done)
- Profanity or jokes in commit messages
- Repeating the file list in the body (the diff already shows this)
- Adding `Signed-off-by` unless the project requires DCO

## Workflow summary

```
1. git status + git diff          → see all changes
2. Group files by purpose         → plan N commits
3. For each chunk:
   a. git add <files>             → stage the chunk
   b. git commit (HEREDOC)        → write a good message
   c. git status                  → verify remaining state
4. Done when working tree is clean (or only unrelated files remain)
```

## Alternate: ticket-prefixed subjects

Some teams require **`type: TICKET SUMMARY`** (ticket id after the type) instead of Conventional Commits with optional scope — e.g. `feat: PROJ-1222 add credit modal`. Use this when the project’s `AGENTS.md` or CI says so.

- Subject: `type: TICKET_NUMBER imperative summary` (no parentheses scope).
- Still split work into one commit per logical chunk; validate with the repo’s commit-msg hook if present.
- Do **not** mix this format with parenthetical `type(scope):` subjects in the same repo unless maintainers explicitly allow both.
