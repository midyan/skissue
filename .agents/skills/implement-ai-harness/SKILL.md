---
name: implement-ai-harness
description: Design and roll out an agent-first AI harness—navigation, docs, mechanical enforcement, observability, and garbage collection. Use when adopting harness engineering, structuring AGENTS.md/docs/HARNESS.md, or wiring hard-skill checks.
---

# Implement an AI harness

**Harness engineering** is the practice of designing the **environment** agents run in: constraints, feedback loops, docs, tooling, and lifecycle—not just prompts. The bottleneck in agent performance is usually **environment design**, not model capability (see OpenAI’s harness engineering framing, Feb 2026).

This skill tells you **what to build**, **in what order**, and **how to verify** it. It generalizes patterns from mature reference repos (e.g. **Aja** / similar projects with `docs/HARNESS.md`, `docs/references/harness-engineering.md`, and harness detection in code) so you can adapt them to **any** codebase.

---

## 1. What “harness” means here

| Layer                  | Role                                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Steering**           | Humans set intent, boundaries, and review; agents execute inside the harness.                                                |
| **Map**                | Short entry (`AGENTS.md`) + **progressive disclosure** (`INDEX.md`, `docs/`)—not one giant instruction file.                 |
| **Knowledge**          | Versioned `docs/` (architecture, decisions, progress, quality). If it isn’t in the repo, it doesn’t exist for the agent.     |
| **Enforcement**        | **Mechanical** checks in CI: custom linters, structural tests, commit hooks—errors include **how to fix**, not only “wrong.” |
| **Feedback**           | Tests, E2E (e.g. Playwright CLI with structured reporters), logs/metrics/traces where applicable.                            |
| **Garbage collection** | Ongoing cleanup of drift, duplication, and “AI slop”; quality grades or recurring tasks.                                     |

**Soft vs hard:** _Soft_ = markdown skills/rules that teach. _Hard_ = executable checks (scripts) that **enforce**. Both matter; soft-only conventions rot.

---

## 2. The three pillars (minimum viable harness)

Use these as a checklist. Implement **pillar 2 early**—mechanical enforcement compounds.

### Pillar 1 — Context engineering

- Keep **`AGENTS.md` small** (order-of-magnitude ~100–150 lines). If it grows, **extract** to `docs/` and link.
- Use **`INDEX.md`** (or your format spec) in directories with multiple children so agents **navigate** instead of scanning trees.
- Session flow: **AGENTS → relevant doc section → task**, not “load everything.”
- Optional: `docs/PROGRESS.md`, `docs/DECISIONS.md`, `docs/QUALITY.md` (or equivalents) so state and rationale live in git.

### Pillar 2 — Architectural constraints

- Define **allowed dependency directions** (layer graph). Enforce with a script in CI; violations must print **remediation** (“`X` may only import from `Y`; fix by …”).
- Add **structural rules** that match your stack: e.g. no raw `child_process` outside approved modules, structured logging only, no vendor SDKs outside an integration layer, JSDoc/module headers where useful.
- Run these on **every PR**; same rules for humans and agents.

### Pillar 3 — Garbage collection

- Encode **invariants** you care about (no magic strings outside `types/`, no empty `catch`, etc.) as **scans or tests**.
- **Review quality** periodically: a `QUALITY.md` table or harness score (see **`report-harness-score`** in this registry) is enough to start.
- Treat recurring bad patterns as **missing harness**: add a check or doc, then retry—don’t rely on “try harder.”

---

## 3. Suggested repository layout (adapt names)

```
<repo>/
├── AGENTS.md                 # Entry map: links only; keep short
├── README.md                 # Humans
├── docs/
│   ├── INDEX.md
│   ├── ARCHITECTURE.md       # System shape, boundaries, flows
│   ├── HARNESS.md            # Engineering rules, constraints, validation, observability (see §5)
│   ├── DECISIONS.md          # Dated decisions (optional)
│   ├── PROGRESS.md           # What works / next (optional)
│   └── references/           # External articles, internal deep dives
├── .agents/
│   ├── INDEX.md
│   ├── rules/                # Persistent rules (naming, INDEX maintenance, etc.)
│   └── skills/               # Installed or vendored skills (commit workflow, validators, …)
└── src/ …                    # Application code with explicit layers
```

**`docs/HARNESS.md`** is the right place for **everything the agent must respect**: philosophy, layer rules, linter contracts, Playwright/Observability expectations, phases of rollout. Point **`AGENTS.md`** at it with one line, not a full paste.

---

## 4. Implementation phases (roll out in order)

**Phase A — Foundation**

1. `AGENTS.md` + `docs/ARCHITECTURE.md` (or equivalent) + `docs/HARNESS.md` skeleton.
2. INDEX strategy + format spec under `docs/` (agents must know how to maintain indexes).
3. One **dependency-direction** or **boundary** check + CI.
4. Unit test / build pipeline green.

**Phase B — Enforcement**

1. Add **2–3** high-value linters (logging, shell routing, imports—whatever your codebase needs).
2. Git hooks optional (Husky): at least **`commit-msg`** if you use Conventional Commits.
3. Aggregate **`npm run check:all`** (or equivalent) mirroring this repo’s **`registry/runner.ts`** pattern: one command runs all hard checks.

**Phase C — Validation & feedback**

1. **E2E** with **structured output** (e.g. Playwright `--reporter=json`) so agents can parse results without a human.
2. If you have services: **observability** story (logs/metrics/traces) with query examples in `HARNESS.md` so agents can **verify** behavior, not only read code.

**Phase D — Scale & GC**

1. Background or scheduled tasks for cleanup, quality table updates, harness score.
2. **Phase 2** mindset: the repo **uses its own harness** to improve itself (dogfood).

---

## 5. What to put in `docs/HARNESS.md`

A strong `HARNESS.md` usually includes:

1. **Core principles** (bullets)—steering vs executing, repo as source of truth, constraints as multipliers.
2. **Context budget**—max fraction of context for docs; when to split tasks.
3. **Layer / import rules**—table or diagram; link to the actual linter.
4. **Linter catalog**—each rule: purpose, **example violation**, **remediation**, how to run locally.
5. **Taste invariants**—types first, validate boundaries, no silent failures, idempotency where needed.
6. **Observability & UI validation** (when relevant)—how agents query logs; Playwright CLI vs MCP (scriptable vs exploratory).
7. **When the agent struggles**—checklist: missing capability? ambiguous abstraction? missing test? **Encode** the fix in-repo.
8. **Phases**—Phase 1 “human as runner” vs Phase 2 autonomous agents, if applicable.

Reference material can live in **`docs/references/`** (e.g. distilled notes from OpenAI-style harness articles).

---

## 6. Detection and tooling (optional but high leverage)

In reference projects, small utilities answer: “Is this repo harness-aware?” Examples: presence of `docs/HARNESS.md`, `.agents/skills/hard-skills/`, a **runner** script, config path. Expose that to CLIs or dashboards so **Mayor/planning** flows can inject the right docs.

You don’t need feature parity—**one function** that returns booleans/paths is enough to keep behavior consistent.

---

## 7. Using this registry (`skill-issue`) as building blocks

On the consumer, **`skill-issue install`** can add:

| Skill                                                                           | Use                                                                                            |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **`validate-agents-entry`**                                                     | Root **`AGENTS.md`** exists and is under a line budget (default 200).                          |
| **`validate-harness-doc`**                                                      | **`docs/HARNESS.md`** exists with enough non-empty lines (min 12 by default).                  |
| **`report-harness-score`**                                                      | Quantitative harness audit (tune dimensions in hard script).                                   |
| **`repo-verify`**                                                               | List hard skills + run **`verify`** (prefers **`test:coverage`** over **`test`** in fallback). |
| **`validate-indexes`**                                                          | INDEX.md vs filesystem.                                                                        |
| **`validate-links`**                                                            | Broken markdown links.                                                                         |
| **`validate-deps`**                                                             | Import layers.                                                                                 |
| **`validate-logging`**, **`validate-shell-exec`**, **`validate-commit-msg`**, … | Stack-specific; pick what matches `HARNESS.md`.                                                |
| **`hard-skills`**                                                               | How to author new **hard/** checks.                                                            |

Wire **`npm run check:all`** to your runner so one command equals **full harness verification** for hard skills. The **aggregate gate** (`verify` in **`package.json`**) should also run **unit tests with coverage** (e.g. **`npm run test:coverage`** with Vitest) so executable checks stay exercised in CI—not only **`check:all`**.

---

## 8. Verification checklist

Before calling the harness “done” for v1:

- [ ] `AGENTS.md` is short and points to `docs/HARNESS.md` + architecture.
- [ ] `docs/HARNESS.md` lists enforceable rules and how to run checks locally + CI.
- [ ] At least one **mechanical** boundary check runs on CI with remediation text.
- [ ] INDEX / navigation spec exists and is validated if you use INDEX files.
- [ ] **Unit tests with coverage** are part of **`verify`** / CI (e.g. Vitest **`--coverage`** on hard-skill entrypoints), not only **`check:all`**.
- [ ] **E2E or integration** path exists for critical flows, with **machine-readable** output where possible.
- [ ] “When stuck” process = **change the repo** (doc, test, linter), not only the prompt.

---

## 9. Anti-patterns

- **Monolithic `AGENTS.md`**—becomes stale and crowds out code context.
- **Rules without CI**—agents pattern-match; enforcement must be mechanical.
- **Vague errors**—always pair violations with **how to fix**.
- **Skipping progressive disclosure**—agents load 5k lines of docs once and ignore them.
- **No garbage collection**—duplication and drift explode at agent throughput.

---

## 10. Summary

**Implement the harness by:**

1. Writing a **small map** (`AGENTS.md`) and a **deep contract** (`docs/HARNESS.md`).
2. Enforcing **architecture and style** with **scripts + CI**, not prose alone.
3. Adding **tests and structured E2E** so agents close the loop.
4. **Iterating** when agents fail: encode the missing capability, then rerun.

That is how you get an **extremely effective** AI harness: durable, legible, and compounding—aligned with production-grade reference implementations and with the **`skill-issue`** hard-skill ecosystem.
