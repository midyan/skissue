# report-harness-score

Quantifies the overall quality of the agent harness on a 0–100 scale (navigation, docs, automation, tests, knowledge). In **skissue** (this repo), the implementation lives here and scores **`harness/`** the same way **`registry/`** is scored in **skill-registry**.

## Invocation

```bash
npm run check:harness-score
```

```bash
npx tsx harness/report-harness-score/hard/index.ts
```

## Exit codes

| Code | Meaning                              |
| ---- | ------------------------------------ |
| `0`  | Score computed and printed to stdout |
| `1`  | Unexpected error                     |

## Dimensions

See the table in the registry copy of this README (`registry/report-harness-score/hard/README.md`) for the six weighted dimensions. This repo’s script treats **`harness/runner.ts`** and **`harness/*/hard/`** like **`registry/`** in a registry repository.
