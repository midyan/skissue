# harness/

Mechanical checks for this repo. **`runner.ts`** executes each **`*/hard/index.ts`** that does not have **`hard/.no-auto-run`**.

## Contents

| Name                                                         | Description                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------- |
| [runner.ts](runner.ts)                                       | Runs all auto-run hard checks                                 |
| [runner.test.ts](runner.test.ts)                             | Vitest — runner discovery and spawn behavior                  |
| [harness-cli-coverage.test.ts](harness-cli-coverage.test.ts) | Vitest — harness CLIs under `SKISSUE_HARNESS_ROOT`            |
| [harness-root.test.ts](harness-root.test.ts)                 | Vitest — `harnessRepoRoot`                                    |
| [harness-root.ts](harness-root.ts)                           | Shared repo root resolver for harness CLIs                    |
| [SKILL.md](SKILL.md)                                         | What this directory is (vs skill-registry)                    |
| [repo-verify/](repo-verify/)                                 | Discover checks + run full `verify` pipeline (`.no-auto-run`) |
| [report-harness-score/](report-harness-score/)               | Informational 0–100 harness score (`.no-auto-run`)            |
| [validate-agents-entry/](validate-agents-entry/)             | Root `AGENTS.md` line budget                                  |
| [validate-deps/](validate-deps/)                             | Import direction under `src/`                                 |
| [validate-harness-doc/](validate-harness-doc/)               | `docs/HARNESS.md` substance                                   |
| [validate-indexes/](validate-indexes/)                       | `INDEX.md` / `AGENTS.md` vs filesystem                        |
| [validate-links/](validate-links/)                           | Broken relative links in Markdown                             |
| [validate-logging/](validate-logging/)                       | Structured logging vs raw `console.*`                         |
| [validate-naming/](validate-naming/)                         | Filename and type naming under `src/`                         |
| [validate-registry/](validate-registry/)                     | `registry.json` shape when present                            |
| [validate-shell-exec/](validate-shell-exec/)                 | Centralize `child_process` usage                              |
