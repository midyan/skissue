---
name: validate-deps
description: Enforce allowed import directions between top-level src/ layers (default skissue CLI graph). Edit ALLOWED_IMPORTS in hard/index.ts for your repo.
---

# validate-deps (soft)

Prevents accidental **wrong-direction** imports between architecture layers. The bundled rules match the **skissue** `src/` layout (`core`, `commands`, `git`, `registry`); edit **`hard/index.ts`** for other projects.

See **[hard/README.md](hard/README.md)** for the contract and how to customize layers.
