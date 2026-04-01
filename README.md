<pre align="center">
  ▗▄▄▖▗▖ ▗▖▗▄▄▄▖▗▖   ▗▖
  ▐▌   ▐▌▗▞▘  █  ▐▌   ▐▌
  ▝▀▚▖ ▐▛▚▖   █  ▐▌   ▐▌
  ▗▄▄▞▘▐▌ ▐▌▗▄█▄▖▐▙▄▄▖▐▙▄▄▖
  ▗▄▄▄▖▗▄▄▖▗▄▄▖▗▖ ▗▖▗▄▄▄▖
    █  ▐▌   ▐▌   ▐▌ ▐▌▐▌
    █   ▝▀▚▖ ▝▀▚▖▐▌ ▐▌▐▛▀▀▘
  ▗▄█▄▖▗▄▄▞▘▗▄▄▞▘▝▚▄▞▘▐▙▄▄▖
</pre>

<h3 align="center">
  A package manager for AI agent skills.<br>
  <sub>Install. Sync. Ship. No skill issues here.</sub>
</h3>

<p align="center">
  <a href="https://www.npmjs.com/package/skissue"><img src="https://img.shields.io/npm/v/skissue?style=flat-square&logo=npm&color=CB3837" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/skissue"><img src="https://img.shields.io/npm/dm/skissue?style=flat-square&logo=npm&color=CB3837" alt="npm downloads"></a>
  <a href="https://github.com/midyan/skissue/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License MIT"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D24-brightgreen?style=flat-square&logo=nodedotjs" alt="Node 24+">
  <img src="https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript" alt="TypeScript">
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#commands">Commands</a> ·
  <a href="#create-your-own-registry">Create a Registry</a> ·
  <a href="#ci--automation">CI & Automation</a> ·
  <a href="#contributing">Contributing</a>
</p>

---

## What is this?

**skissue** is a CLI that installs and syncs **agent skills** from a Git-based registry into your project. Think of it as npm, but for AI agent capabilities — soft docs (`SKILL.md`) and optional hard checks (`hard/index.ts`) that your coding agents can discover and use automatically.

```
your-project/
├── .agents/skills/          ← skills land here
│   ├── validate-commits/
│   │   ├── SKILL.md         ← agent reads this
│   │   └── hard/
│   │       └── index.ts     ← CI runs this
│   ├── code-review/
│   │   └── SKILL.md
│   └── ...
├── .skill-issue/
│   ├── config.yaml          ← registry pointer
│   └── lock.json            ← pinned versions
└── your code...
```

Your agents get superpowers. Your CI gets guardrails. You get coffee.

---

## Quick Start

### 1. Install

```bash
# Just run it — no global install needed
npx skissue

# ...or install globally if you're the committed type
npm install -g skissue
```

### 2. Initialize

Run `skissue` with no arguments. If no config exists, it walks you through setup interactively:

```bash
cd your-project
npx skissue
```

```
  ▗▄▄▖▗▖ ▗▖▗▄▄▄▖▗▖   ▗▖
  ▐▌   ▐▌▗▞▘  █  ▐▌   ▐▌
  ▝▀▚▖ ▐▛▚▖   █  ▐▌   ▐▌
  ▗▄▄▞▘▐▌ ▐▌▗▄█▄▖▐▙▄▄▖▐▙▄▄▖
  ▗▄▄▄▖▗▄▄▖▗▄▄▖▗▖ ▗▖▗▄▄▄▖
    █  ▐▌   ▐▌   ▐▌ ▐▌▐▌
    █   ▝▀▚▖ ▝▀▚▖▐▌ ▐▌▐▛▀▀▘
  ▗▄█▄▖▗▄▄▞▘▗▄▄▞▘▝▚▄▞▘▐▙▄▄▖

◆  Where does the skill registry live?
│  ● GitHub — clone registry from owner/repo
│  ○ Local directory
└
```

Pick GitHub or local, point it at your registry, and you're done. Config lands in `.skill-issue/config.yaml`.

### 3. Install skills

```bash
# Interactive — browse, toggle, install
npx skissue manage

# Direct — you know what you want
npx skissue install validate-commits
npx skissue install code-review
```

### 4. There is no step 4

Skills are in `.agents/skills/`. Your agents can find them. Commit the folder. Ship it.

---

## Commands

| Command                  | What it does                                                 |
| ------------------------ | ------------------------------------------------------------ |
| `skissue`                | Smart default — runs `init` if needed, then opens `manage`   |
| `skissue init`           | Interactive config setup (`.skill-issue/config.yaml`)        |
| `skissue init-registry`  | Scaffold a minimal registry (`registry.json` + sample skill) |
| `skissue manage`         | TUI to browse, install, and uninstall skills                 |
| `skissue install <id>`   | Install a specific skill from the registry                   |
| `skissue uninstall <id>` | Remove a skill and its lock entry                            |
| `skissue list`           | Show installed skills with lock metadata                     |
| `skissue outdated`       | Check which installed skills have newer versions             |
| `skissue update [id]`    | Re-fetch skill(s) from the registry                          |
| `skissue doctor`         | Health check — Node version, config, registry connectivity   |

> `manage` is also aliased as `skissue browse`.

---

## Create Your Own Registry

A skill registry is just a Git repo with a specific layout. Here's how to build one from scratch.

**Shortcut:** run `npx skissue init-registry` to create `registry.json`, `registry/<skill-id>/SKILL.md` (default skill id `validate-links`), and optionally `git init` in the current directory or a path you choose.

### Registry structure

```
your-skill-registry/
├── registry.json              ← manifest of all skills
└── registry/
    ├── my-first-skill/
    │   ├── SKILL.md           ← required: what the skill does
    │   └── hard/              ← optional: executable checks
    │       ├── SKILL.md
    │       └── index.ts
    ├── another-skill/
    │   └── SKILL.md
    └── ...
```

### Step 1: Create the repo

```bash
mkdir my-skill-registry && cd my-skill-registry
git init
mkdir -p registry
```

### Step 2: Write `registry.json`

This is the manifest. It maps skill IDs to their paths:

```json
{
  "skills": {
    "my-first-skill": "registry/my-first-skill",
    "another-skill": "registry/another-skill"
  }
}
```

> If `registry.json` is missing or doesn't list a skill, the convention `registry/<id>/` is used as a fallback.

### Step 3: Create a skill

Every skill needs at minimum a `SKILL.md` at its root:

```bash
mkdir -p registry/my-first-skill
```

```markdown
<!-- registry/my-first-skill/SKILL.md -->

# My First Skill

Teaches the agent how to do something awesome.

## When to use

Use this skill when the user asks to do the awesome thing.

## Instructions

1. Do the awesome thing
2. Do it well
3. Profit
```

### Step 4: (Optional) Add a hard check

Hard skills are executable TypeScript that can validate, lint, or enforce rules:

```bash
mkdir -p registry/my-first-skill/hard
```

```typescript
// registry/my-first-skill/hard/index.ts
const errors: string[] = [];

// Your validation logic here
if (!someCondition) {
  errors.push("Something is wrong");
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("All good!");
```

### Step 5: Push and connect

```bash
git add -A && git commit -m "feat: initial skill registry"
git remote add origin git@github.com:you/my-skill-registry.git
git push -u origin main
```

Now in any consumer project:

```bash
npx skissue init        # choose GitHub, enter you/my-skill-registry
npx skissue manage      # browse and install your skills
```

That's it. You're running a skill registry.

---

## Local Registry (monorepo friendly)

If your registry lives on disk (monorepo, or a local clone), skip GitHub entirely:

```bash
npx skissue init
# → choose "Local directory"
# → path: ../my-skill-registry   (relative to your project)
```

The local registry must be a **git repository** (so `HEAD` can be stored in the lockfile). No network auth needed.

---

## How It Works

```
┌──────────────────────────────────────────────────────┐
│                    your project                       │
│                                                       │
│  .skill-issue/config.yaml  ──→  points to registry   │
│  .skill-issue/lock.json    ──→  pinned commits       │
│                                                       │
│  .agents/skills/<id>/      ←──  installed skills      │
│      ├── SKILL.md               (agents read these)   │
│      └── hard/index.ts          (CI runs these)       │
└───────────────────────┬──────────────────────────────┘
                        │
                        │  git clone / local path
                        │
┌───────────────────────▼──────────────────────────────┐
│                skill registry repo                    │
│                                                       │
│  registry.json         maps skill-id → path           │
│  registry/<id>/SKILL.md                               │
│  registry/<id>/hard/   (optional executable checks)   │
└──────────────────────────────────────────────────────┘
```

1. **`skissue init`** writes `.skill-issue/config.yaml` — either a GitHub `owner/repo` or a local path.
2. **`skissue install <id>`** clones (or reads) the registry, resolves the skill path from `registry.json`, copies the skill tree into `.agents/skills/<id>/`, and writes a lockfile entry with the commit hash.
3. **`skissue outdated`** compares locked commit hashes against the current registry HEAD.
4. **`skissue update`** re-fetches and overwrites.

---

## Auth & Transport

| Scenario                            | What happens                                |
| ----------------------------------- | ------------------------------------------- |
| `GITHUB_TOKEN` or `GH_TOKEN` is set | HTTPS with token (typical CI)               |
| No token in env                     | SSH via `git@github.com:…` (typical laptop) |
| `registry.useSsh: true`             | Force SSH                                   |
| `registry.useSsh: false`            | Force HTTPS                                 |
| Local registry                      | No auth needed                              |

> Never put tokens in `config.yaml`. Use environment variables or a credential helper.

---

## CI & Automation

Skills with `hard/index.ts` can be wired into your CI pipeline. The harness runner executes every hard skill that isn't marked with `hard/.no-auto-run`:

```bash
# In your CI workflow
npx tsx .agents/skills/*/hard/index.ts
```

Or use the built-in harness runner if you've adopted the full skissue harness pattern:

```bash
npm run check:all
```

### Automated publishing (this repo)

This repo uses a three-workflow CI/CD pipeline:

1. **PR & push** — [`ci.yml`](.github/workflows/ci.yml) runs `npm run verify` (TypeScript, ESLint, Prettier, tests, harness, harness score, build)
2. **Green main** — [`version-and-release.yml`](.github/workflows/version-and-release.yml) bumps the patch version, tags, and creates a GitHub Release
3. **Tag push** — [`publish.yml`](.github/workflows/publish.yml) runs `npm publish --access public`

---

## Config Reference

`.skill-issue/config.yaml`:

```yaml
# GitHub registry
registry:
  owner: midyan
  repo: skill-registry
  branch: main
  # useSsh: true | false | omit for auto-detection
skillsRoot: .agents/skills

# — OR —

# Local registry
registry:
  path: ../skill-registry   # relative to project root
  branch: main
skillsRoot: .agents/skills
```

`.skill-issue/lock.json` is managed by the CLI. Commit it — it pins your skill versions.

---

## Requirements

- **Node** 24+ (see `.nvmrc`)
- **git** on your `PATH`
- For **remote** registries: `GITHUB_TOKEN` / `GH_TOKEN`, or SSH keys / `gh auth`
- For **local** registries: just a git checkout on disk

---

## Development

```bash
git clone https://github.com/midyan/skissue.git
cd skissue
npm install          # also enables Husky git hooks via prepare
npm run verify       # typecheck + lint + format + test + harness + harness score + build
```

| Script                  | What it does                                                                  |
| ----------------------- | ----------------------------------------------------------------------------- |
| `npm run dev -- <args>` | Run CLI from source via tsx                                                   |
| `npm run verify`        | Full pipeline: tsc, eslint, prettier, vitest, check:all, harness score, build |
| `npm run build`         | Production build via esbuild                                                  |
| `npm test`              | Run vitest                                                                    |
| `npm run check:all`     | Harness runner (hard skill checks)                                            |
| `npm run repo-verify`   | Same as verify, with explicit skill discovery output                          |

### Project structure

```
src/
├── entry.ts            ← CLI bootstrap (commander)
├── config.ts           ← config loading & validation
├── lockfile.ts         ← lock.json I/O
├── paths.ts            ← path resolution
├── io.ts               ← filesystem copy helpers
├── commands/           ← subcommands (init, install, manage, ...)
│   └── banner.ts       ← the beautiful TUI banner
├── git/                ← git invocation & registry checkout
└── registry/           ← skill resolution from checkout
```

---

## Contributing

1. Fork it
2. Create your branch (`git checkout -b feat/amazing-thing`)
3. Make your changes
4. Run `npm run verify` — everything must pass
5. Commit with [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, ...)
6. Open a PR

---

## License

[MIT](LICENSE) — go wild.

---

<p align="center">
  <sub>Built with obsessive attention to developer experience.</sub><br>
  <sub>If your agents have a skill issue, now there's a fix for that.</sub>
</p>

<div align="center">
<pre>
╭────────────────────────────────╮
│                                │
│  no more skill issues. ever.   │
│                                │
╰────────────────────────────────╯
</pre>
</div>
