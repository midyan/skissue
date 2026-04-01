---
name: report-harness-score
description: Produce a 0–100 agent-harness quality score from read-only repo inspection (docs, navigation, registry checks, tests). Informational; uses hard/.no-auto-run by default.
---

# report-harness-score (soft)

Use to **audit** how agent-friendly a repo is: indexes, AGENTS.md, automation, tests. Scoring is **advisory** — tune dimensions in the hard script for your standards.

The hard script is marked **`.no-auto-run`** so it does not block `check:all`; run **`npx tsx registry/report-harness-score/hard/index.ts`** manually.

See **[hard/README.md](hard/README.md)** for invocation and dimensions.
