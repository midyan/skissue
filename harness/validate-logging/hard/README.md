# validate-logging

Validates that structured logging is used in `src/` instead of raw `console.*` calls.

## Invocation

```sh
npx tsx harness/validate-logging/hard/index.ts
npm run check:logging
```

## Exit codes

| Code | Meaning                                     |
| ---- | ------------------------------------------- |
| 0    | All logging uses structured logger          |
| 1    | Raw console.\* usage found outside src/cli/ |

## What it checks

| Rule          | Description                                          |
| ------------- | ---------------------------------------------------- |
| console-usage | console.log/error/warn/info/debug found outside cli/ |
