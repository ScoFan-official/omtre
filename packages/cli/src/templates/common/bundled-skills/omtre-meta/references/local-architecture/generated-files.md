# Local Files Generated After Init

`omtre init` writes the OMTRE runtime into the user project. Later, `omtre update` tries to update OMTRE-managed template files, but it uses `.omtre/.template-hashes.json` to determine which files have already been modified by the user.

This page only describes files that are visible and editable inside the user project.

## `.omtre/`

```text
.omtre/
├── workflow.md
├── config.yaml
├── .developer
├── .version
├── .template-hashes.json
├── .runtime/
├── scripts/
├── spec/
├── tasks/
└── workspace/
```

| Path | Usually editable? | Notes |
| --- | --- | --- |
| `.omtre/workflow.md` | Yes | Local workflow documentation and AI routing rules. |
| `.omtre/config.yaml` | Yes | Project configuration, hooks, packages, journal line limits, and related settings. |
| `.omtre/spec/` | Yes | Project specs, intended to be updated regularly by users and AI. |
| `.omtre/tasks/` | Yes | Task material and research artifacts, maintained by the task workflow. |
| `.omtre/workspace/` | Yes | Session records, usually written by `add_session.py`. |
| `.omtre/scripts/` | Carefully | Local runtime. It can be customized, but only after understanding the call chain. |
| `.omtre/.runtime/` | No | Runtime state, usually written automatically by hooks/scripts. |
| `.omtre/.developer` | Carefully | Current developer identity. |
| `.omtre/.version` | No | OMTRE version record used by update/migration logic. |
| `.omtre/.template-hashes.json` | No | Template hash record. Do not hand-write business rules here. |

## Platform Directories

Different platforms generate different directories. Common categories:

| Category | Example paths | Purpose |
| --- | --- | --- |
| hooks | `.claude/hooks/`, `.codex/hooks/`, `.cursor/hooks/` | Inject session context, workflow-state, and sub-agent context. |
| settings | `.claude/settings.json`, `.codex/hooks.json`, `.qoder/settings.json`, `.trae/hooks.json` | Tell the platform when to run hooks or plugins. |
| agents | `.claude/agents/`, `.codex/agents/`, `.kiro/agents/`, `.zcode/agents/` | Define agents such as `omtre-research`, `omtre-implement`, and `omtre-check`. |
| skills | `.claude/skills/`, `.agents/skills/`, `.qoder/skills/`, `.zcode/skills/` | Skills that auto-trigger or can be read by AI. |
| commands/prompts/workflows | `.cursor/commands/`, `.github/prompts/`, `.devin/workflows/`, `.zcode/commands/` | Explicit user-invoked command or workflow entry points. |

When modifying a platform directory, also confirm whether `.omtre/workflow.md` still describes the same flow.

## Meaning Of Template Hashes

`.omtre/.template-hashes.json` records the content hash from the last time OMTRE wrote a template file. `omtre update` uses it to distinguish three cases:

| Case | Update behavior |
| --- | --- |
| File was not modified by the user | It can be updated automatically. |
| File was modified by the user | Prompt the user to overwrite, keep, or generate `.new`. |
| File is no longer a current template | It may be deleted, renamed, or preserved according to migration rules. |

When an AI customizes local OMTRE files, it does not need to maintain hashes manually. It is normal for OMTRE update to recognize the result as "modified by the user."

## Local Customization Boundaries

Editable by default:

- `.omtre/workflow.md`
- `.omtre/config.yaml`
- `.omtre/spec/**`
- `.omtre/scripts/**`
- Platform hooks, settings, agents, skills, commands, prompts, and workflows

Do not edit by default:

- Global npm install directory
- `node_modules/omtre`
- OMTRE GitHub repository source code
- Concrete state files under `.omtre/.runtime/**`
- Hash contents inside `.omtre/.template-hashes.json`

Switch to the OMTRE CLI source-code perspective only when the user explicitly wants to contribute upstream.
