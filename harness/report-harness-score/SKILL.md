---
name: report-harness-score
description: Produce a 0–100 agent-harness quality score from read-only repo inspection (docs, navigation, harness checks, tests). Informational; uses hard/.no-auto-run.
---

# report-harness-score

Use to **audit** how agent-friendly this repo is: indexes, `AGENTS.md`, automation, tests. Scoring is **advisory** — tune dimensions in `hard/index.ts` for your standards.

The hard script has **`hard/.no-auto-run`** so it does not run in `check:all`; run **`npm run check:harness-score`** or **`npx tsx harness/report-harness-score/hard/index.ts`** manually.

See **[hard/README.md](hard/README.md)** for invocation and dimensions.
