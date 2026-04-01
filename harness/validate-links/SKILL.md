---
name: validate-links
description: Scan markdown for broken relative links across the repo. Run via npm run check:links or the harness hard skill.
---

# validate-links (soft)

Use before large doc moves or when CI reports broken links. The **hard** implementation walks `*.md` files and checks `[text](relative)` targets resolve.

See **[hard/README.md](hard/README.md)** for flags, exit codes, and exclusions.
