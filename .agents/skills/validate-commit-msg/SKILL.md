---
name: validate-commit-msg
description: Validate commit messages against Conventional Commits v1.0.0; used from commit-msg hooks or CLI. Requires a path or stdin — see hard/.
---

# validate-commit-msg (soft)

Run **before** committing when the repo enforces message format. This skill is **hook-oriented**: the hard script often needs a **message file path**, so it ships with **`hard/.no-auto-run`** and is not run by `registry/runner.ts` by default.

**skill-issue convention:** do **not** use a parenthetical scope after the type (`feat(cli): …` is invalid). Use `feat: …` / `fix: …` and put areas, paths, or components in the body. The hard check enforces this.

See **[hard/README.md](hard/README.md)** for invocation.
