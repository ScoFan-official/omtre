# Add Project-Local Conventions

Often the user does not need to change OMTRE mechanics; they need local AI to understand their team's conventions. In that case, prefer `.omtre/spec/` or a project-local skill instead of editing `omtre-meta`.

## Where To Put Things

| Content type | Location |
| --- | --- |
| Rules code must follow | `.omtre/spec/<layer>/` |
| Cross-layer thinking methods | `.omtre/spec/guides/` |
| AI capability for a project-specific flow | Platform-local skill |
| One-off task material | `.omtre/tasks/<task>/` |
| Session summary | `.omtre/workspace/<developer>/journal-N.md` |

## Create A Project-Local Skill

If the user wants AI to know "how this project customizes OMTRE," create a local skill:

```text
.claude/skills/omtre-local/
└── SKILL.md
```

Example:

```md
---
name: omtre-local
description: "Project-local OMTRE customizations for this repository. Use when changing this project's OMTRE workflow, hooks, local agents, or team-specific conventions."
---

# OMTRE Local

## Local Scope

This skill documents this repository's OMTRE customizations only.

## Custom Workflow Rules

- ...

## Local Hook Changes

- ...

## Local Agent Changes

- ...
```

For multi-platform projects, place equivalent versions in other platform skill directories, or use `.agents/skills/` for platforms that support the shared layer.

## Write To `.omtre/spec/`

If the content is a coding convention, write it to spec. Examples:

```text
.omtre/spec/backend/error-handling.md
.omtre/spec/frontend/components.md
.omtre/spec/guides/cross-platform-thinking-guide.md
```

After writing it, update the corresponding `index.md` so AI can find the new rule from the entry point.

## Make The Current Task Use New Conventions

After writing a spec, add it to the current task context:

```bash
python ./.omtre/scripts/task.py add-context <task> implement ".omtre/spec/backend/error-handling.md" "Error handling conventions"
python ./.omtre/scripts/task.py add-context <task> check ".omtre/spec/backend/error-handling.md" "Review error handling"
```

## Do Not Store Project-Private Rules In `omtre-meta`

`omtre-meta` is a public skill for understanding OMTRE architecture and local customization entry points. Put project-private content in:

- `.omtre/spec/`
- a project-local skill
- the current task
- workspace journal

This prevents future updates to OMTRE's built-in `omtre-meta` from overwriting the team's own conventions.
