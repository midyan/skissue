---
name: repo-verify-hard
description: Executable — discover registry hard skills; run verify or fallback static/test/harness/build chain.
---

# repo-verify (`hard/`)

## Contract

- **Exit 0** — discovery printed; all executed steps succeeded (or dry-run / discover-only).
- **Exit 1** — a subprocess failed, or no verification steps could be resolved.

## Implementation notes

- Discovery reads **`registry/<id>/hard/index.ts`** presence and **`hard/.no-auto-run`** (same semantics as `registry/runner.ts`).
- **`resolveVerifyPlan`** returns **`npm run verify`** when `package.json` has **`scripts.verify`**.
- **Pre-commit:** **`.husky/pre-commit`** invokes **`npm run verify`** (Husky); document in soft **SKILL.md** so consumers wire the same gate locally.
