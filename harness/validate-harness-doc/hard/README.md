# validate-harness-doc

Requires **`docs/HARNESS.md`** with a minimum number of **non-empty lines** so harness rules (constraints, validation, philosophy) live in versioned docs—not only in chat.

## Invocation

```sh
npx tsx harness/validate-harness-doc/hard/index.ts
npm run check:harness-doc
```

## Exit codes

| Code | Meaning                                 |
| ---- | --------------------------------------- |
| 0    | File exists and meets minimum substance |
| 1    | Missing, unreadable, or too thin        |

## What it checks

| Rule                  | Description                                                 |
| --------------------- | ----------------------------------------------------------- |
| `missing-harness-doc` | No `docs/HARNESS.md`                                        |
| `unreadable`          | Cannot read the file                                        |
| `harness-too-thin`    | Fewer non-empty lines than `HARNESS_MIN_LINES` (default 12) |

## Configuration

- **`HARNESS_MIN_LINES`** — minimum non-empty lines (positive integer).

## When to run

Included in **`npm run check:all`**. Use in repos that adopt **harness engineering** with a dedicated `docs/HARNESS.md` contract.
