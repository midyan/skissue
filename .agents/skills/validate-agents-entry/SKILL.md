---
name: validate-agents-entry
description: Require root AGENTS.md with a bounded line count so the agent entry stays a small map. Runs in check:all.
---

# validate-agents-entry (soft)

Enforces **harness navigation**: a non-empty **`AGENTS.md`** at the repo root and a **maximum line count** (default 200) so content stays a **map** (links to `docs/`, `INDEX.md`), not an encyclopedia.

See **[hard/README.md](hard/README.md)** for rules and **`AGENTS_MAX_LINES`**.
