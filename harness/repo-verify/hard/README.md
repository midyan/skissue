# repo-verify (`hard/`)

Orchestrates full repository verification: lists all harness hard skills and whether they participate in **`check:all`**, then runs **`npm run verify`** when defined, or a script chain derived from **`package.json`**.

## Invocation

```sh
npm run repo-verify
npx tsx harness/repo-verify/hard/index.ts
npx tsx harness/repo-verify/hard/index.ts --plan
npx tsx harness/repo-verify/hard/index.ts --discover
```

## Exit codes

| Code | Meaning                              |
| ---- | ------------------------------------ |
| 0    | Success (or dry-run / discover-only) |
| 1    | A step failed, or no steps available |

## What it checks

| Phase     | Description                                               |
| --------- | --------------------------------------------------------- |
| discovery | Enumerates `harness/*/hard/index.ts` and runner inclusion |
| verify    | Runs `verify` script or fallback pipeline                 |

## Pre-commit

**`.husky/pre-commit`** runs **`npm run verify`** (installed by **`npm install`** / Husky **`prepare`**). Same steps as CI; **`repo-verify`** documents this pipeline alongside discovery.

## `.no-auto-run`

This skill **must** stay excluded from **`harness/runner.ts`** so it is not invoked inside **`npm run check:all`** (avoids recursion with **`npm run verify`**).
