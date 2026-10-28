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

## Documentation

User-facing documentation lives in `docs-site/`. Before editing prose, read `.omtre/spec/docs-site/docs/style-guide.md`. Verify copy changes with `pnpm docs:verify` and run `CI=1 pnpm docs:e2e` before publishing.

<!-- gitnexus:start -->
# Code intelligence

GitNexus is optional for this checkout. If `gitnexus list` shows this repository, use its MCP tools and the skill files under `.claude/skills/gitnexus/` for impact analysis. If it does not, use code search, diff review, and the repository's tests; do not claim that an impact-analysis gate ran.
<!-- gitnexus:end -->
