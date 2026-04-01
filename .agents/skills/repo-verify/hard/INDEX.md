# repo-verify/hard/

Executable orchestrator — not run by `registry/runner.ts` (see [.no-auto-run](.no-auto-run)).

## Contents

| Name                           | Description                                                |
| ------------------------------ | ---------------------------------------------------------- |
| [index.ts](index.ts)           | Discovery + verify plan + CLI                              |
| [index.test.ts](index.test.ts) | Vitest                                                     |
| [README.md](README.md)         | Invocation and exit codes                                  |
| [SKILL.md](SKILL.md)           | Hard-component contract                                    |
| [.no-auto-run](.no-auto-run)   | Excludes from `check:all` (avoids recursion with `verify`) |
