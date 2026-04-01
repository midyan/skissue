---
name: validate-pr-title
description: Align PR titles with semantic PR / CI rules (types, scopes). Pairs with GitHub workflows like amannn/action-semantic-pull-request.
---

# validate-pr-title (soft)

Run before **`gh pr create`** or when CI fails PR title checks. Keep **`PR_TYPES`** / patterns in sync with **`.github/workflows/*`** in the repo you apply this to.

See **[hard/README.md](hard/README.md)** for patterns.
