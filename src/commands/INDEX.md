# commands/

CLI subcommand implementations invoked from `entry.ts`.

## Contents

| Name                                                         | Description                                                                  |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| [banner.ts](banner.ts)                                       | ASCII banner for interactive flows                                           |
| [commands.test.ts](commands.test.ts)                         | Unit tests for this layer                                                    |
| [default.ts](default.ts)                                     | Bare `skissue` — setup gate then `manage`                                    |
| [doctor.ts](doctor.ts)                                       | `doctor` — Node, config, sync registry checkout                              |
| [doctor.test.ts](doctor.test.ts)                             | Vitest — doctor command                                                      |
| [init-registry.ts](init-registry.ts)                         | `init-registry` — scaffold minimal registry (default skill `validate-links`) |
| [init-registry-layout.test.ts](init-registry-layout.test.ts) | Vitest — `registryLayoutExists` fs edge cases                                |
| [init-registry.test.ts](init-registry.test.ts)               | Vitest — init-registry helpers                                               |
| [init.ts](init.ts)                                           | `init` — interactive config                                                  |
| [init.test.ts](init.test.ts)                                 | Vitest — init command                                                        |
| [install.ts](install.ts)                                     | `install <id>`                                                               |
| [install.test.ts](install.test.ts)                           | Vitest — install / runInstallMany                                            |
| [list.ts](list.ts)                                           | `list`                                                                       |
| [manage.ts](manage.ts)                                       | `manage` / `browse` — interactive install / uninstall                        |
| [manage.test.ts](manage.test.ts)                             | Vitest — manage command                                                      |
| [prompt-validators.test.ts](prompt-validators.test.ts)       | Vitest — shared Clack text validators                                        |
| [prompt-validators.ts](prompt-validators.ts)                 | `requiredTrimmed` and other prompt helpers                                   |
| [outdated.ts](outdated.ts)                                   | `outdated`                                                                   |
| [uninstall.ts](uninstall.ts)                                 | `uninstall <id>`                                                             |
| [update.ts](update.ts)                                       | `update [id]`                                                                |
