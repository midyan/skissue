---
name: validate-harness-doc
description: Require docs/HARNESS.md with minimum substance so harness rules live in versioned docs. Runs in check:all.
---

# validate-harness-doc (soft)

Complements **`validate-agents-entry`**: the **deep** harness contract lives in **`docs/HARNESS.md`** (principles, layers, CI commands, observability). This check ensures the file **exists** and is not a stub—**non-empty line count** (default minimum 12) is configurable via **`HARNESS_MIN_LINES`**.

See **[hard/README.md](hard/README.md)**.
