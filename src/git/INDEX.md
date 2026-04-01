# git/

Git subprocess helpers and registry clone/cache/diff for install and outdated.

## Contents

| Name                                           | Description                                                |
| ---------------------------------------------- | ---------------------------------------------------------- |
| [exec.test.ts](exec.test.ts)                   | Vitest — `execGit` timeout / spawn error paths             |
| [exec.ts](exec.ts)                             | Spawn `git` and capture stdout/stderr                      |
| [registry-repo.test.ts](registry-repo.test.ts) | Vitest — `isPathStale`                                     |
| [registry-repo.ts](registry-repo.ts)           | Shallow clone/fetch cache, `diff` for path, `ensureCommit` |
