---
name: validate-registry-hard
description: Validates registry.json shape and that each skill path contains SKILL.md at the skill root.
---

# validate-registry — hard component

**`index.ts`** reads **`registry.json`** at repo root and checks:

- Valid JSON and **`{ "skills": { "<id>": "<path>" } }`** shape (via zod).
- Each path exists and contains **`SKILL.md`** at the skill folder root (soft component).

## Invocation

```bash
npx tsx registry/validate-registry/hard/index.ts
```

```bash
npm run check:registry
```

## Exit codes

| Code | Meaning                                                     |
| ---- | ----------------------------------------------------------- |
| `0`  | Registry file and paths are valid                           |
| `1`  | Missing file, bad JSON, or missing `SKILL.md` at skill root |
