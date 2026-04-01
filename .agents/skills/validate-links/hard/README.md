# validate-links

Checks all markdown files in the repository for broken relative links.

## Invocation

```bash
npx tsx registry/validate-links/hard/index.ts
```

Or via npm script:

```bash
npm run check:links
```

## Exit codes

| Code | Meaning                                      |
| ---- | -------------------------------------------- |
| `0`  | All relative links resolve to existing files |
| `1`  | One or more broken links found               |

## What it checks

- Scans every `.md` file in the repo (excluding `node_modules`, `.git`, `dist`,
  `coverage`, `.cursor`).
- For each `[text](target)` link that is not `http://`, `https://`, or `#`:
  - Strips any `#fragment` suffix.
  - Resolves the path relative to the file's directory.
  - Verifies the resolved path exists on disk.

HTTP links are **not** validated (too slow for pre-commit; save for CI).

## When to run

- Before any commit that adds, removes, or renames markdown files.
- Automatically via the pre-commit hook (`npm run check:all`).
- After reorganizing documentation or changing directory structure.
