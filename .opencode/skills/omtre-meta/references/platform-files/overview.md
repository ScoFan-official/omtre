# Platform Files Overview

OMTRE connects the same local architecture to different AI tools. `.omtre/` stores the shared runtime; platform directories store adapter files that define how each AI tool enters OMTRE.

When a local AI modifies OMTRE, it should distinguish two file categories first:

- **Shared files**: `.omtre/workflow.md`, `.omtre/tasks/`, `.omtre/spec/`, `.omtre/scripts/`.
- **Platform files**: `.claude/`, `.snow/`, `.codex/`, `.cursor/`, `.opencode/`, `.kiro/`, `.gemini/`, `.qoder/`, `.codebuddy/`, `.github/`, `.factory/`, `.pi/`, `.trae/`, `.kilocode/`, `.agent/`, `.devin/`, `.reasonix/`, `.zcode/`, `.kimi-code/`, and similar directories.

Platform files do not store business state. They let the corresponding AI tool read OMTRE state, call OMTRE scripts, and load OMTRE skills/agents/hooks.

## Platform File Categories

| Category | Common paths | Purpose |
| --- | --- | --- |
| settings/config | `.claude/settings.json`, `.codex/hooks.json`, `.qoder/settings.json`, `.trae/hooks.json` | Register hooks, plugins, extensions, or platform behavior. |
| hooks/plugins/extensions | `.claude/hooks/`, `.opencode/plugins/`, `.pi/extensions/` | Inject context at session start, user input, agent startup, shell execution, and similar events. |
| agents | `.claude/agents/`, `.codex/agents/`, `.kiro/agents/`, `.zcode/agents/` | Define `omtre-research`, `omtre-implement`, and `omtre-check`. |
| skills | `.claude/skills/`, `.agents/skills/`, `.qoder/skills/`, `.zcode/skills/` | Capability descriptions that auto-trigger or can be read on demand. |
| commands/prompts/workflows | `.cursor/commands/`, `.github/prompts/`, `.devin/workflows/`, `.zcode/commands/` | Entry points explicitly invoked by the user. |

## Three Platform Integration Modes

### 1. Hook / Extension Driven

These platforms can trigger scripts or plugins on specific events and actively inject OMTRE context into AI.

Common capabilities:

- session-start injection of a `.omtre/` overview.
- workflow-state hints for each user turn.
- PRD/spec/research injection when sub-agents start.
- Shell commands inheriting session identity.

To change "when the AI knows what," inspect hooks/plugins/extensions and settings first.

### 2. Agent Prelude / Pull-Based

Some platforms cannot reliably let hooks rewrite sub-agent prompts, so the agent file itself instructs the agent to read the active task, PRD, and JSONL context after startup.

To change how sub-agents load context, inspect the agent files themselves.

### 3. Main-Session Workflow

Some platforms do not have OMTRE sub-agent or hook capabilities. They rely on workflows/skills/commands to guide the main-session AI to read files, run scripts, and move tasks forward.

To change behavior, inspect platform workflows/skills/commands and `.omtre/workflow.md`.

## Local Modification Order

When the user asks to customize behavior for a platform, the AI should inspect files in this order:

1. Read `.omtre/workflow.md` to confirm the shared flow.
2. Read the target platform's settings/config to see which hooks/agents/skills/commands are registered.
3. Read the target platform's agents/skills/commands/hooks.
4. Modify the local file closest to the user's need.
5. If the change affects the shared flow, synchronize `.omtre/workflow.md` or `.omtre/spec/`.

Do not modify only platform files and forget the shared workflow. Do not modify only `.omtre/workflow.md` and forget that platform entry points may still contain old descriptions.
