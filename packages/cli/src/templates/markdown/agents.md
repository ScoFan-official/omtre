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
