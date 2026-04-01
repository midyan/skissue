# validate-deps

Validates dependency direction between top-level **`src/`** layers. The default graph in **`index.ts`** matches the **skissue** CLI (`core` root modules, `commands`, `git`, `registry`). Edit **`ALLOWED_IMPORTS`** and layer detection for other repositories.

## Invocation

```sh
npx tsx harness/validate-deps/hard/index.ts
npm run check:deps
```

## Exit codes

| Code | Meaning                                           |
| ---- | ------------------------------------------------- |
| 0    | All layer dependencies are valid                  |
| 1    | One or more dependency direction violations found |

## What it checks

| Rule          | Description                                                     |
| ------------- | --------------------------------------------------------------- |
| dep-violation | A module imports from a layer that is not allowed for its layer |

## Default layer graph (skissue)

`core` (root `src/*.ts` modules: config, paths, lockfile, io, entry) → no upward `../` imports to `commands`, `git`, or `registry`.

`commands` → may import `core`, `git`, `registry`.

`git` → may import `core` only.

`registry` → no imports from other layers via `../` (sibling `registry/` imports are same-layer).

Imports from `../utils/...` are treated as cross-cutting and allowed from any layer.
