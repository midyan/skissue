# Index Maintenance Rule

This rule applies to every agent working in this repository, regardless of
tooling (Cursor, Codex, Claude Code, or any other agent).

## The INDEX.md system

Every directory with **2 or more children** must have an `INDEX.md` that lists
all immediate children with one-line descriptions. This enables progressive
disclosure: agents start at the root `AGENTS.md` and navigate downward through
INDEX files rather than scanning the full tree.

Format specification: [docs/index-format.md](../../docs/index-format.md)

## Rules

### 1. Update on every structural change

Any change that **adds, removes, or renames** a file or directory must update
the `INDEX.md` of every affected parent directory **in the same commit**.

### 2. Create when threshold is reached

When a directory reaches **2 or more children** and does not yet have an
`INDEX.md`, create one following the format spec before completing the task.

### 3. Every child must be listed

Every immediate child (file or directory) in a directory must appear in its
`INDEX.md`. Every entry in the `INDEX.md` must resolve to a real path. No
orphans, no ghosts.

### 4. Excluded directories

The following are excluded from the index system:

`node_modules`, `.git`, `coverage`, `dist`, `.cursor`

### 5. Verify before committing

Run `npm run check:all` before committing when you touched structure or the skill registry.

## Why this matters

Stale or missing indexes mislead agents that rely on progressive disclosure.
