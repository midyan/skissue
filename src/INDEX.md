# src/

TypeScript source for the skissue CLI — Commander entrypoint, commands, config, lockfile, git/registry fetch.

## Contents

| Name                                                     | Description                                                |
| -------------------------------------------------------- | ---------------------------------------------------------- |
| [commands/](commands/)                                   | One module per subcommand (`init`, `install`, `manage`, …) |
| [git/](git/)                                             | Git helpers and registry checkout / diff                   |
| [registry/](registry/)                                   | Resolve skill id from `registry.json` or convention        |
| [config.test.ts](config.test.ts)                         | Vitest — config YAML parsing                               |
| [config.ts](config.ts)                                   | Load and validate `.skill-issue/config.yaml`               |
| [entry.ts](entry.ts)                                     | CLI bootstrap (`commander`)                                |
| [io.ts](io.ts)                                           | Copy skill tree; assert `SKILL.md` exists                  |
| [lockfile.test.ts](lockfile.test.ts)                     | Vitest — lock JSON                                         |
| [lockfile.ts](lockfile.ts)                               | Read/write `.skill-issue/lock.json`                        |
| [paths.ts](paths.ts)                                     | Project path helpers                                       |
| [postinstall-script.test.ts](postinstall-script.test.ts) | Vitest — `scripts/ensure-local-bin.mjs` behavior           |
