# validate-agents-entry

Requires **`AGENTS.md`** at the repository root with a **bounded line count** so the file stays an entry _map_, not a manual.

## Invocation

```sh
npx tsx harness/validate-agents-entry/hard/index.ts
npm run check:agents-entry
```

## Exit codes

| Code | Meaning                                           |
| ---- | ------------------------------------------------- |
| 0    | `AGENTS.md` exists, non-empty, within line budget |
| 1    | Missing, empty, or too long                       |

## What it checks

| Rule              | Description                           |
| ----------------- | ------------------------------------- |
| `missing-agents`  | No `AGENTS.md` at repo root           |
| `empty-agents`    | File is whitespace-only               |
| `unreadable`      | Cannot read the file                  |
| `agents-too-long` | More lines than allowed (default 200) |

## Configuration

- **`AGENTS_MAX_LINES`** — override the default maximum line count (positive integer).

## When to run

Included in **`npm run check:all`**. Use in any repo that follows harness engineering with a root agent entry file.
