# repo-verify (`hard/`)

Orchestrates full repository verification: lists all registry hard skills and whether they participate in **`check:all`**, then runs **`npm run verify`** when defined, or a script chain derived from **`package.json`**.

## Invocation

```sh
npm run repo-verify
npx tsx registry/repo-verify/hard/index.ts
npx tsx registry/repo-verify/hard/index.ts --plan
npx tsx registry/repo-verify/hard/index.ts --discover
```

## Exit codes

| Code | Meaning                              |
| ---- | ------------------------------------ |
| 0    | Success (or dry-run / discover-only) |
| 1    | A step failed, or no steps available |

## What it checks

| Phase     | Description                                                |
| --------- | ---------------------------------------------------------- |
| discovery | Enumerates `registry/*/hard/index.ts` and runner inclusion |
| verify    | Runs `verify` script or fallback pipeline                  |

## Coverage

Consumer **`verify`** scripts should run **`test:coverage`** (Vitest **`--coverage`**) when available so the harness gate includes **statement coverage** on hard-skill entrypoints, not only **`check:all`**. **`resolveVerifyPlan`** prefers **`test:coverage`** over **`test`** in the fallback chain.

## `.no-auto-run`

This skill **must** stay excluded from **`registry/runner.ts`** so it is not invoked inside **`npm run check:all`** (avoids recursion with **`npm run verify`**).

## Git `pre-push`

Configure **`.husky/pre-push`** to run **`npm run repo-verify`** (or **`npm run verify`** when `repo-verify` is not defined) so the full verification pipeline runs before **`git push`**. See [SKILL.md](../SKILL.md) for the hook template and rationale vs **`pre-commit`**.
