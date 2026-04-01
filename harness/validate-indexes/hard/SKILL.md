---
name: validate-indexes-hard
description: Executable validation for INDEX.md / AGENTS.md — implementation contract and invocation.
---

# validate-indexes — hard component

TypeScript entrypoint **`index.ts`** walks the repo from **`ROOT`** (repo root) and reports:

- Directories with **2+ children** (excluding `INDEX.md` from the count) that lack **`INDEX.md`** (or **`AGENTS.md`** at repo root).
- **Unlisted** filesystem children not present in the index table.
- **Orphaned** table links pointing at missing paths.

Excluded directories: `node_modules`, `.git`, `coverage`, `dist`, `.cursor`.

## Invocation

```bash
npx tsx harness/validate-indexes/hard/index.ts
```

```bash
npm run check:indexes
```

## Exit codes

| Code | Meaning                                         |
| ---- | ----------------------------------------------- |
| `0`  | All indexes complete and accurate               |
| `1`  | Missing index, unlisted child, or orphaned link |

Format rules: [docs/index-format.md](../../../docs/index-format.md).
