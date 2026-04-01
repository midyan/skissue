# report-harness-score

Quantifies the overall quality of the agent harness on a 0–100 scale (navigation, docs, automation, tests, knowledge). The score reflects how well the repository enables agents to do reliable, autonomous work.

## Invocation

```bash
npx tsx registry/report-harness-score/hard/index.ts
```

Or via npm script:

```bash
npm run check:harness-score
```

## Exit codes

| Code | Meaning                                     |
| ---- | ------------------------------------------- |
| `0`  | Score computed and printed to stdout        |
| `1`  | Score computation failed (unexpected error) |

This is a **reporting** skill, not a validation skill — it always exits `0`
unless an unexpected error occurs. It does not block commits.

## What it measures

The score is composed of six weighted dimensions, each graded 0–100:

| Dimension           | Weight | What it checks                                                                         |
| ------------------- | ------ | -------------------------------------------------------------------------------------- |
| Navigation          | 20%    | INDEX.md coverage (every dir with 2+ children has one)                                 |
| Documentation       | 20%    | Key docs exist: AGENTS.md, architecture, layers, contributing, index-format            |
| Architecture        | 15%    | Layer boundary documentation completeness and structural rules                         |
| Automated checks    | 20%    | Runner, hard skills, hooks (optional), lint/typecheck/test, **`test:coverage`** script |
| Test coverage       | 15%    | **`src/`** modules or **`registry/*/hard/`** skills have co-located **`*.test.ts`**    |
| Knowledge structure | 10%    | AGENTS.md is a map (< 150 lines), progressive disclosure via links                     |

**Final score** = weighted sum, rounded to the nearest integer.

## When to run

- Periodically to track harness quality over time.
- After adding new documentation, hard skills, or structural changes.
- As part of harness health dashboards or quality reviews.
