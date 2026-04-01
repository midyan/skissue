# validate-commit-msg

Validates that commit messages follow
[Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
and the project's conventions defined in
[commit-workflow/SKILL.md](../../commit-workflow/SKILL.md).

## Invocation

As a git hook (receives the commit message file path from git):

```bash
npx tsx registry/validate-commit-msg/hard/index.ts .git/COMMIT_EDITMSG
```

By agents (inline message validation):

```bash
npx tsx registry/validate-commit-msg/hard/index.ts --message "feat: add thing"
```

Or via npm script (requires a file path argument):

```bash
npm run check:commit-msg -- .git/COMMIT_EDITMSG
```

## Exit codes

| Code | Meaning                      |
| ---- | ---------------------------- |
| `0`  | Commit message is valid      |
| `1`  | One or more violations found |

## What it checks

| Rule              | Description                                                                        |
| ----------------- | ---------------------------------------------------------------------------------- |
| `format`          | Subject matches `type[!]: description` (no `(scope)` in this repository)           |
| `type`            | Type is one of: feat, fix, refactor, perf, test, docs, build, chore, style, revert |
| `length`          | Subject line is at most 72 characters                                              |
| `lowercase`       | Description starts with a lowercase letter                                         |
| `trailing-period` | Description does not end with a period                                             |
| `body-separator`  | Body is separated from subject by a blank line                                     |
| `forbidden`       | No AI-attribution trailers (Made-with, Generated-by, Co-authored-by AI)            |
| `scope`           | No parenthetical scope after the type — use `type: …` and details in the body      |
| `empty`           | Message is not empty                                                               |

## When to run

- Automatically on every commit via the `commit-msg` Husky hook.
- Agents should use the `--message` flag to validate a draft message before
  committing.
