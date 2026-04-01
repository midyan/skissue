---
name: validate-indexes
description: Keep INDEX.md and AGENTS.md navigation accurate so agents can use progressive disclosure instead of scanning the tree.
---

# validate-indexes (soft)

Use this skill when **adding, renaming, or removing** files or directories anywhere in the repo.

## Why

Stale indexes mislead agents. The **hard** component under **`hard/`** mechanically verifies that directories with 2+ children have an index and that tables match the filesystem.

## When to run

- After structural changes, before committing.
- As part of **`npm run check:all`**.

See **`hard/SKILL.md`** for how the check works and how to extend it.
