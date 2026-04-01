---
name: validate-shell-exec
description: Restrict child_process.spawn/exec to approved modules (e.g. shell/tmux helpers) so subprocess usage stays centralized.
---

# validate-shell-exec (soft)

Run when adding or reviewing code that spawns processes — keeps security and review surface small.

See **[hard/README.md](hard/README.md)** for allowed paths.
