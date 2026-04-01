# hard/

Executable **validate-indexes** check — filesystem walk and table parsing.

## Contents

| Name                                   | Description                                       |
| -------------------------------------- | ------------------------------------------------- |
| [index-run.test.ts](index-run.test.ts) | Vitest — `runValidateIndexes` + harness root env  |
| [index.test.ts](index.test.ts)         | Vitest — `parseIndexLinks`                        |
| [index.ts](index.ts)                   | CLI entry — walk tree and report violations       |
| [SKILL.md](SKILL.md)                   | Hard component — invocation, exit codes, contract |
