<!-- OMTRE:START -->
# Omtre Instructions

These instructions are for AI assistants working in this project.

This project is managed by Omtre. The working knowledge you need lives under `.omtre/`:

- `.omtre/workflow.md` — development phases, when to create tasks, skill routing
- `.omtre/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.omtre/workspace/` — per-developer journals and session traces
- `.omtre/tasks/` — active and archived tasks (PRDs, research, jsonl context)
- `.omtre/domains/` — domain layer: routing rules in `DISCIPLINE.md`, board index in `REGISTRY.md`

If an Omtre command is available on your platform (e.g. `/omt:finish-work`, `/omt:continue`), prefer it over manual steps. Not every platform exposes every command.

If you're using Codex or another agent-capable tool, additional project-scoped helpers may live in:
- `.agents/skills/` — reusable Omtre skills
- `.codex/agents/` — optional custom subagents

Managed by Omtre. Edits outside this block are preserved; edits inside may be overwritten by a future `omtre update`.

<!-- OMTRE:END -->

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **omtre** (14336 symbols, 20870 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/omtre/context` | Codebase overview, check index freshness |
| `gitnexus://repo/omtre/clusters` | All functional areas |
| `gitnexus://repo/omtre/processes` | All execution flows |
| `gitnexus://repo/omtre/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

> GitNexus index absent on this machine (`gitnexus list` returns nothing, no `.gitnexus/`)? The `impact` / `detect_changes` gates above degrade to per-file diff review plus spec-boundary checks — record the degraded check in the worklog rather than claiming a gate that did not run.
