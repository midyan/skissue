# validate-naming

Validates naming conventions across the codebase.

## Invocation

```sh
npx tsx registry/validate-naming/hard/index.ts
npm run check:naming
```

## Exit codes

| Code | Meaning                             |
| ---- | ----------------------------------- |
| 0    | All naming conventions are followed |
| 1    | Naming violations found             |

## What it checks

| Convention | Applied to                                                                    |
| ---------- | ----------------------------------------------------------------------------- |
| kebab-case | File names in src/ (extensions: `.ts`, `.tsx`, `.test.ts`, `.test.tsx`, etc.) |
| PascalCase | Types, interfaces, enums                                                      |
