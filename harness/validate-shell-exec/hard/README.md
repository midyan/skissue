# validate-shell-exec

Validates that child_process is only imported in approved locations.

## Invocation

```sh
npx tsx harness/validate-shell-exec/hard/index.ts
npm run check:shell-exec
```

## Exit codes

| Code | Meaning                                          |
| ---- | ------------------------------------------------ |
| 0    | All child_process usage is properly routed       |
| 1    | child_process import found outside allowed files |

## Allowed files

- `src/utils/shell.ts`
- `src/tmux/session.ts`
