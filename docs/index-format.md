# INDEX.md Format Specification

Every directory in the repo with **2 or more children** (files or subdirectories)
must contain an `INDEX.md`. This file serves as the directory's table of contents,
enabling agents to navigate the codebase via progressive disclosure rather than
scanning entire trees.

Directories with only 1 child do **not** get their own INDEX.md — they are
described inline in the parent directory's INDEX.md instead.

## Excluded directories

The following directories are excluded from the index system entirely:

`node_modules`, `.git`, `coverage`, `dist`, `.cursor`

## Structure

Every INDEX.md follows the same skeleton regardless of variant:

```markdown
# <directory-name>/

<One-sentence purpose of this directory.>

## Contents

| Name                     | Description          |
| ------------------------ | -------------------- |
| [child-name](child-name) | One-line description |
| ...                      | ...                  |
```

Rules:

- The `# title` uses the directory basename followed by `/`.
- The purpose sentence is a single line — no paragraphs.
- The Contents table lists **every** immediate child (file or directory).
- Directories are listed with a trailing `/` in the Name column.
- Entries are sorted: directories first (alphabetical), then files (alphabetical).
- Links are relative to the INDEX.md file.

## Source directory variant

For directories under `src/`, add a **Layer** field to the purpose line when the
directory represents an architecture layer:

```markdown
# agents/

Agent loop, reasoning, tool dispatch, and session state. **Layer: Service.**

## Contents

| Name                           | Description                                        |
| ------------------------------ | -------------------------------------------------- |
| [index.ts](index.ts)           | Public API — session creation and message handling |
| [index.test.ts](index.test.ts) | Unit tests for the agent module                    |
```

When the directory contains subdirectories that are too small for their own
INDEX.md (single child), describe them inline:

```markdown
| [runtime/](runtime/) | Process lifecycle and signal handling (contains `index.ts`) |
```

## Documentation directory variant

For directories under `docs/`, the format is the same skeleton. The description
column focuses on topic and audience rather than code purpose:

```markdown
# docs/

Project documentation — architecture, workflows, and reference material.

## Contents

| Name                               | Description                         |
| ---------------------------------- | ----------------------------------- |
| [references/](references/)         | External articles and inspirations  |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Entities, agents, data flow, schema |
| [contributing.md](contributing.md) | Development setup and workflow      |
```

## Keeping indexes fresh

See [../.agents/rules/index-maintenance.md](../.agents/rules/index-maintenance.md)
for the enforcement rule. In short:

1. Any change that adds, removes, or renames a file must update the parent INDEX.md.
2. When a directory reaches 2+ children, create an INDEX.md for it.
3. Run `npm run check:all` to verify compliance (includes harness and index checks where configured).
