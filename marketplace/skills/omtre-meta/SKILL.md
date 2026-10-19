---
name: omtre-meta
description: "Meta-skill for understanding and customizing omtre — the all-in-one AI workflow system for 11 AI coding platforms (Claude Code, Cursor, OpenCode, iFlow, Codex, Kilo, Kiro, Gemini CLI, Antigravity, Qoder, CodeBuddy). Documents the original omtre system design including architecture, commands, hooks, multi-agent pipelines, monorepo support, and task lifecycle hooks. Use when understanding omtre architecture, customizing workflows, adding commands or agents, troubleshooting issues, or adapting omtre to specific projects. Modifications should be recorded in a project-local omtre-local skill, not here."
---

# omtre Meta-Skill

## Version Compatibility

| Item                        | Value            |
| --------------------------- | ---------------- |
| **omtre CLI Version**       | 0.4.0-beta.8     |
| **Skill Last Updated**      | 2026-03-24       |
| **Min Claude Code Version** | 1.0.0+           |
| **Min Node.js Version**     | >=18.17.0        |

> ⚠️ **Version Mismatch Warning**: If your omtre CLI version differs from above, some features may not work as documented. Run `omtre --version` to check.

---

## Platform Compatibility

### Feature Support Matrix

| Feature                     | Claude Code | iFlow   | Cursor     | OpenCode   | Codex         | Kilo       | Kiro       | Gemini CLI | Antigravity  | Qoder      | CodeBuddy  |
| --------------------------- | ----------- | ------- | ---------- | ---------- | ------------- | ---------- | ---------- | ---------- | ------------ | ---------- | ---------- |
| **Core Systems**            |             |         |            |            |               |            |            |            |              |            |            |
| Workspace system            | ✅ Full     | ✅ Full | ✅ Full    | ✅ Full    | ✅ Full       | ✅ Full    | ✅ Full    | ✅ Full    | ✅ Full      | ✅ Full    | ✅ Full    |
| Task system                 | ✅ Full     | ✅ Full | ✅ Full    | ✅ Full    | ✅ Full       | ✅ Full    | ✅ Full    | ✅ Full    | ✅ Full      | ✅ Full    | ✅ Full    |
| Spec system                 | ✅ Full     | ✅ Full | ✅ Full    | ✅ Full    | ✅ Full       | ✅ Full    | ✅ Full    | ✅ Full    | ✅ Full      | ✅ Full    | ✅ Full    |
| Commands/Skills             | ✅ Full     | ✅ Full | ✅ Full    | ✅ Full    | ✅ Skills     | ✅ Full    | ✅ Skills  | ✅ TOML    | ✅ Workflows | ✅ Skills  | ✅ Full    |
| Agent definitions           | ✅ Full     | ✅ Full | ⚠️ Manual  | ✅ Full    | ✅ TOML       | ⚠️ Manual  | ⚠️ Manual  | ⚠️ Manual  | ⚠️ Manual    | ⚠️ Manual  | ⚠️ Manual  |
| Shared agent skills         | —           | —       | —          | —          | ✅ Full       | —          | —          | —          | —            | —          | —          |
| **Hook-Dependent Features** |             |         |            |            |               |            |            |            |              |            |            |
| SessionStart hook           | ✅ Full     | ✅ Full | ❌ None    | ❌ None    | ⚠️ Optional   | ❌ None    | ❌ None    | ❌ None    | ❌ None      | ❌ None    | ❌ None    |
| PreToolUse hook             | ✅ Full     | ✅ Full | ❌ None    | ❌ None    | ❌ None       | ❌ None    | ❌ None    | ❌ None    | ❌ None      | ❌ None    | ❌ None    |
| SubagentStop hook           | ✅ Full     | ✅ Full | ❌ None    | ❌ None    | ❌ None       | ❌ None    | ❌ None    | ❌ None    | ❌ None      | ❌ None    | ❌ None    |
| Auto context injection      | ✅ Full     | ✅ Full | ❌ Manual  | ❌ Manual  | ❌ Manual     | ❌ Manual  | ❌ Manual  | ❌ Manual  | ❌ Manual    | ❌ Manual  | ❌ Manual  |
| Ralph Loop                  | ✅ Full     | ✅ Full | ❌ None    | ❌ None    | ❌ None       | ❌ None    | ❌ None    | ❌ None    | ❌ None      | ❌ None    | ❌ None    |
| **Multi-Agent/Session**     |             |         |            |            |               |            |            |            |              |            |            |
| Multi-Agent (current dir)   | ✅ Full     | ✅ Full | ⚠️ Limited | ⚠️ Limited | ⚠️ Limited    | ⚠️ Limited | ⚠️ Limited | ⚠️ Limited | ⚠️ Limited   | ⚠️ Limited | ⚠️ Limited |
| Multi-Session (worktrees)   | ✅ Full     | ✅ Full | ❌ None    | ❌ None    | ❌ None       | ❌ None    | ❌ None    | ❌ None    | ❌ None      | ❌ None    | ❌ None    |

### Legend

- ✅ **Full**: Feature works as documented
- ⚠️ **Limited/Manual**: Works but requires manual steps
- ❌ **None/Manual**: Not supported or requires manual workaround

### Platform Categories

#### Full Hook Support (Claude Code, iFlow)

All features work as documented. Hooks provide automatic context injection and quality enforcement. iFlow shares the same Python hook system as Claude Code.

#### Partial Hook Support (Codex)

- **Works**: Workspace, tasks, specs, skills (`.codex/skills/` + `.agents/skills/` shared layer), TOML agent definitions (`.codex/agents/`), optional SessionStart hook
- **Doesn't work**: PreToolUse, SubagentStop, Ralph Loop, Multi-Session
- **Note**: SessionStart hook requires `codex_hooks = true` in `~/.codex/config.toml`

#### Commands Only (Cursor, OpenCode, Kilo, Kiro, Gemini CLI, Antigravity, Qoder, CodeBuddy)

- **Works**: Workspace, tasks, specs, commands/skills (platform-specific format)
- **Doesn't work**: Hooks, auto-injection, Ralph Loop, Multi-Session
- **Workaround**: Manually read spec files at session start; no automatic quality gates
- **Note**: Each platform uses its own command format (Kiro/Qoder use Skills, Gemini uses TOML, Antigravity uses Workflows, CodeBuddy uses nested Markdown commands)

### Designing for Portability

When customizing omtre, consider platform compatibility:

```
┌─────────────────────────────────────────────────────────────┐
│                 PORTABLE (All 11 Platforms)                  │
│  - .omtre/workspace/      - .omtre/tasks/                   │
│  - .omtre/spec/           - Platform commands/skills        │
│  - File-based configs     - JSONL context files             │
│  - config.yaml            - Monorepo packages support       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│         SHARED AGENT SKILLS (agentskills.io standard)       │
│  - .agents/skills/          (Codex + universal agent CLIs)  │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│              HOOK-CAPABLE (Claude Code + iFlow)              │
│  - .claude/hooks/ or .iflow/hooks/                          │
│  - settings.json hook configuration                         │
│  - Auto context injection   - SubagentStop control          │
│  - Ralph Loop               - Multi-Session worktrees       │
│  - Task lifecycle hooks     - Dynamic spec discovery        │
└─────────────────────────────────────────────────────────────┘
```

---

## Purpose

This is the **meta-skill** for omtre - it documents the original, unmodified omtre system. When customizing omtre for a specific project, record changes in a **project-local skill** (`omtre-local`), keeping this meta-skill as the authoritative reference for vanilla omtre.

## Skill Hierarchy

```
~/.claude/skills/
└── omtre-meta/                # THIS SKILL - Original omtre documentation
                               # ⚠️ DO NOT MODIFY for project-specific changes

project/.claude/skills/
└── omtre-local/               # Project-specific customizations
                               # ✅ Record all modifications here
```

**Why this separation?**

- User may have multiple projects with different omtre customizations
- Each project's `omtre-local` skill tracks ITS OWN modifications
- The meta-skill remains clean as the reference for original omtre
- Enables easy upgrades: compare meta-skill with new omtre version

---

## Self-Iteration Protocol

When modifying omtre for a project, follow this protocol:

### 1. Check for Existing Project Skill

```bash
# Look for project-local skill
ls -la .claude/skills/omtre-local/
```

### 2. Create Project Skill if Missing

If no `omtre-local` exists, create it:

```bash
mkdir -p .claude/skills/omtre-local
```

Then create `.claude/skills/omtre-local/SKILL.md`:

```markdown
---
name: omtre-local
description: |
  Project-specific omtre customizations for [PROJECT_NAME].
  This skill documents modifications made to the vanilla omtre system
  in this project. Inherits from omtre-meta for base documentation.
---

# omtre Local - [PROJECT_NAME]

## Base Version

omtre version: X.X.X (from package.json or omtre --version)
Date initialized: YYYY-MM-DD

## Customizations

### Commands Added

(none yet)

### Agents Modified

(none yet)

### Hooks Changed

(none yet)

### Specs Customized

(none yet)

### Workflow Changes

(none yet)

---

## Changelog

### YYYY-MM-DD

- Initial setup
```

### 3. Record Every Modification

When making ANY change to omtre, update `omtre-local/SKILL.md`:

#### Example: Adding a new command

```markdown
### Commands Added

#### /omt:my-command

- **File**: `.claude/commands/omt/my-command.md`
- **Purpose**: [what it does]
- **Added**: 2026-01-31
- **Why**: [reason for adding]
```

#### Example: Modifying a hook

```markdown
### Hooks Changed

#### inject-subagent-context.py

- **Change**: Added support for `my-agent` type
- **Lines modified**: 45-67
- **Date**: 2026-01-31
- **Why**: [reason]
```

### 4. Never Modify Meta-Skill for Project Changes

The `omtre-meta` skill should ONLY be updated when:

- omtre releases a new version
- Fixing documentation errors in the original
- Adding missing documentation for original features

---

## Architecture Overview

omtre transforms AI assistants into structured development partners through **enforced context injection**.

### System Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER INTERACTION                              │
│  /omt:start  /omt:brainstorm  /omt:parallel                         │
│  /omt:finish-work  /omt:before-dev  /omt:check                      │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────┐
│                         SKILLS LAYER                                 │
│  .claude/commands/omt/*.md       (17 slash commands)                │
│  .claude/agents/*.md             (6 sub-agent definitions)          │
│  .agents/skills/*/SKILL.md       (shared agent skills layer)        │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────┐
│                          HOOKS LAYER                                 │
│  SessionStart      → session-start.py (workflow + context + status) │
│  PreToolUse:Agent  → inject-subagent-context.py (spec injection)    │
│  SubagentStop      → ralph-loop.py (quality enforcement)            │
│  Task Lifecycle    → config.yaml hooks (after_create/start/finish/  │
│                      archive → e.g. Linear sync)                    │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────┐
│                       PERSISTENCE LAYER                              │
│  .omtre/workspace/    (journals, session history)                   │
│  .omtre/tasks/        (task tracking, context files, subtasks)      │
│  .omtre/spec/         (coding guidelines, monorepo per-package)     │
│  .omtre/config.yaml   (packages, hooks, update.skip, spec_scope)   │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

| Principle                          | Description                                         |
| ---------------------------------- | --------------------------------------------------- |
| **Specs Injected, Not Remembered** | Hooks enforce specs - agents always receive context |
| **Read Before Write**              | Understand guidelines before writing code           |
| **Layered Context**                | Only relevant specs load (via JSONL files)          |
| **Human Commits**                  | AI never commits - human validates first            |
| **Pure Dispatcher**                | Dispatch agent only orchestrates                    |

---

## Core Components

### 1. Workspace System

Track development progress across sessions with per-developer isolation.

```
.omtre/workspace/
├── index.md                    # Global overview
└── {developer}/                # Per-developer
    ├── index.md                # Personal index (@@@auto markers)
    └── journal-N.md            # Session journals (max 2000 lines)
```

**Key files**: `.omtre/.developer` (identity), journals (session history)

### 2. Task System

Track work items with phase-based execution, parent-child subtasks, and lifecycle hooks.

```
.omtre/tasks/{MM-DD-slug}/
├── task.json           # Metadata, phases, branch, subtasks
├── prd.md              # Requirements
├── info.md             # Technical design (optional)
├── implement.jsonl     # Context for implement agent
├── check.jsonl         # Context for check agent
├── debug.jsonl         # Context for debug agent
├── research.jsonl      # Context for research agent (optional)
└── cr.jsonl            # Context for code review (optional)
```

### 3. Spec System

Maintain coding standards that get injected to agents. Supports both single-repo and monorepo layouts.

```
# Single repo
.omtre/spec/
├── frontend/           # Frontend guidelines
├── backend/            # Backend guidelines
└── guides/             # Thinking guides

# Monorepo (per-package)
.omtre/spec/
├── <package-name>/     # Per-package specs
│   ├── backend/
│   ├── frontend/
│   └── unit-test/
└── guides/             # Shared thinking guides
```

### 4. Hooks System

Automatically inject context and enforce quality.

**Claude Code / iFlow Hooks** (settings.json):

| Hook                  | When                           | Purpose                                    |
| --------------------- | ------------------------------ | ------------------------------------------ |
| `SessionStart`        | startup, clear, compact events | Inject workflow, guidelines, task status    |
| `PreToolUse:Agent`    | Before sub-agent launch        | Inject specs via JSONL                     |
| `PreToolUse:Task`     | Before Task tool (legacy)      | Same as Agent (CC renamed Task→Agent)      |
| `SubagentStop:check`  | Check agent stops              | Enforce verification (Ralph Loop)          |

**Task Lifecycle Hooks** (config.yaml):

| Event            | When                | Purpose                         |
| ---------------- | ------------------- | ------------------------------- |
| `after_create`   | Task created        | e.g. create Linear issue        |
| `after_start`    | Task started        | e.g. update Linear status       |
| `after_finish`   | Task finished       | e.g. mark Linear complete       |
| `after_archive`  | Task archived       | e.g. close Linear issue         |

### 5. Agent System

Specialized agents for different phases.

| Agent       | Purpose               | Restriction             |
| ----------- | --------------------- | ----------------------- |
| `dispatch`  | Orchestrate pipeline  | Pure dispatcher         |
| `plan`      | Evaluate requirements | Can reject unclear reqs |
| `research`  | Find code patterns    | Read-only               |
| `implement` | Write code            | No git commit           |
| `check`     | Review and self-fix   | Ralph Loop controlled   |
| `debug`     | Fix issues            | Precise fixes only      |

### 6. Multi-Agent Pipeline

Run parallel isolated sessions via Git worktrees.

```
plan.py → start.py → Dispatch → implement → check → create-pr
```

---

## Customization Guide

### Adding a Command

1. Create `.claude/commands/omt/my-command.md`
2. Update `omtre-local` skill with the change

### Adding an Agent

1. Create `.claude/agents/my-agent.md` with YAML frontmatter
2. Update `inject-subagent-context.py` to handle new agent type
3. Create `my-agent.jsonl` in task directories
4. Update `omtre-local` skill

### Modifying Hooks

1. Edit the hook script in `.claude/hooks/`
2. Document the change in `omtre-local` skill
3. Note which lines were modified and why

### Extending Specs

1. Create new category in `.omtre/spec/my-category/`
2. Add `index.md` and guideline files
3. Reference in JSONL context files
4. Update `omtre-local` skill

### Changing Task Workflow

1. Modify `next_action` array in `task.json`
2. Update dispatch or hook scripts as needed
3. Document in `omtre-local` skill

---

## Resources

Reference documents are organized by platform compatibility:

```
references/
├── core/              # All Platforms (Claude Code, Cursor, etc.)
├── claude-code/       # Claude Code Only
├── how-to-modify/     # Modification Guides
└── meta/              # Documentation & Templates
```

### `core/` - All Platforms

| Document       | Content                                        |
| -------------- | ---------------------------------------------- |
| `overview.md`  | Core systems introduction                      |
| `files.md`     | All `.omtre/` files with purposes              |
| `workspace.md` | Workspace system, journals, developer identity |
| `tasks.md`     | Task system, subtasks, lifecycle hooks, JSONL   |
| `specs.md`     | Spec system, monorepo layout, guidelines       |
| `scripts.md`   | Platform-independent scripts                   |
| `config.md`    | config.yaml full reference                     |

### `claude-code/` - Claude Code Only

| Document             | Content                            |
| -------------------- | ---------------------------------- |
| `overview.md`        | Claude Code features introduction  |
| `hooks.md`           | Hook system, context injection     |
| `agents.md`          | Agent types, invocation, Task tool |
| `ralph-loop.md`      | Quality enforcement mechanism      |
| `multi-session.md`   | Parallel worktree sessions         |
| `worktree-config.md` | worktree.yaml configuration        |
| `scripts.md`         | Claude Code only scripts           |

### `how-to-modify/` - Modification Guides

| Document           | Scenario                              |
| ------------------ | ------------------------------------- |
| `overview.md`      | Quick reference for all modifications |
| `add-command.md`   | Adding slash commands                 |
| `add-agent.md`     | Adding new agent types                |
| `add-spec.md`      | Adding spec categories                |
| `add-phase.md`     | Adding workflow phases                |
| `modify-hook.md`   | Modifying hook behavior               |
| `change-verify.md` | Changing verify commands              |

### `meta/` - Documentation

| Document                    | Content                          |
| --------------------------- | -------------------------------- |
| `platform-compatibility.md` | Detailed platform support matrix |
| `self-iteration-guide.md`   | How to document customizations   |
| `omtre-local-template.md`   | Template for project-local skill |

---

## Quick Reference

### Key Scripts

| Script                   | Purpose                              |
| ------------------------ | ------------------------------------ |
| `get_context.py`         | Get session context (text/JSON)      |
| `task.py`                | Task management (16 subcommands)     |
| `add_session.py`         | Record session                       |
| `create_bootstrap.py`    | First-time spec bootstrap            |
| `multi_agent/start.py`   | Start parallel agent                 |
| `multi_agent/status.py`  | Monitor agent status                 |
| `multi_agent/create_pr.py` | Create PR from worktree           |

### Key Paths

| Path                     | Purpose                            |
| ------------------------ | ---------------------------------- |
| `.omtre/.developer`      | Developer identity                 |
| `.omtre/.current-task`   | Active task pointer                |
| `.omtre/workflow.md`     | Main workflow docs                 |
| `.omtre/config.yaml`     | Project config (packages, hooks)   |
| `.omtre/worktree.yaml`   | Multi-session config               |
| `.claude/settings.json`  | Hook configuration                 |
| `.agents/skills/`        | Shared agent skills (agentskills.io) |

---

## Upgrade Protocol

When upgrading omtre to a new version:

1. **Compare** new meta-skill with current
2. **Review** changes in new version
3. **Check** `omtre-local` for conflicts
4. **Merge** carefully, preserving customizations
5. **Update** `omtre-local` with migration notes

```markdown
## Changelog

### 2026-02-01 - Upgraded to omtre X.Y.Z

- Merged new hook behavior from meta-skill
- Kept custom agent `my-agent`
- Updated check.jsonl template
```
