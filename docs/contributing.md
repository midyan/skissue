# Contributing

1. **Verify** — Run `npm run verify` before opening a PR (TypeScript, ESLint, Prettier, tests with coverage thresholds, harness `check:all`, harness score, build).
2. **Navigation** — Follow [index-format.md](index-format.md) when adding directories; update the nearest `INDEX.md`.
3. **Imports** — Respect layer boundaries documented in [ARCHITECTURE.md](ARCHITECTURE.md); `validate-deps` enforces them in CI.

For harness behavior and check inventory, see [HARNESS.md](HARNESS.md).
