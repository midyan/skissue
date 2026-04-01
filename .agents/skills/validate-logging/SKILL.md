---
name: validate-logging
description: Prefer structured logging over raw console.* outside approved CLI entrypoints; keeps observability consistent.
---

# validate-logging (soft)

Use when touching logging or adding `console` calls — aligns with a **structured logger** outside interactive CLI code.

See **[hard/README.md](hard/README.md)** for scope (typically `src/`).
