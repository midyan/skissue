---
name: validate-registry
description: Keep root registry.json consistent with on-disk skill folders so installs and docs do not drift.
---

# validate-registry (soft)

Use when **editing `registry.json`** or **adding/removing skills** under **`registry/`**.

## Why

Consumers and **`skill-issue install`** rely on paths in **`registry.json`**. The **hard** component verifies JSON shape and that each path exists with a root **`SKILL.md`** (soft component for that skill).

See **`hard/SKILL.md`** for the executable contract.
