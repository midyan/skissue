# repo-verify/hard/

Executable orchestrator — not run by `harness/runner.ts` (see [.no-auto-run](.no-auto-run)).

## Contents

| Name                                 | Description                                                |
| ------------------------------------ | ---------------------------------------------------------- |
| [index.ts](index.ts)                 | Discovery + verify plan + CLI                              |
| [index.test.ts](index.test.ts)       | Vitest — discovery, resolveVerifyPlan, CLI                 |
| [run-plan.test.ts](run-plan.test.ts) | Vitest — `runPlan` with mocked `spawnSync`                 |
| [README.md](README.md)               | Invocation and exit codes                                  |
| [SKILL.md](SKILL.md)                 | Hard-component contract                                    |
| [.no-auto-run](.no-auto-run)         | Excludes from `check:all` (avoids recursion with `verify`) |
