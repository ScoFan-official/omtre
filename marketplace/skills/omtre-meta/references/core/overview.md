# Core Systems Overview

These systems work on **all 11 platforms** (Claude Code, Cursor, OpenCode, iFlow, Codex, Kilo, Kiro, Gemini CLI, Antigravity, Qoder, CodeBuddy).

---

## What's in Core?

| System    | Purpose                         | Files                             |
| --------- | ------------------------------- | --------------------------------- |
| Workspace | Session tracking, journals      | `.omtre/workspace/`             |
| Tasks     | Work items, subtasks, hooks     | `.omtre/tasks/`                 |
| Specs     | Coding guidelines (per-package) | `.omtre/spec/`                  |
| Config    | Packages, hooks, skip rules     | `.omtre/config.yaml`            |
| Commands  | Slash command prompts           | `.claude/commands/`               |
| Scripts   | Automation utilities            | `.omtre/scripts/` (core subset) |

---

## Why These Are Portable

All core systems are **file-based**:

- No special runtime required
- Read/write with any tool
- Works in any AI coding environment

```
┌─────────────────────────────────────────────────────────────┐
│                    CORE SYSTEMS (File-Based)                 │
│                                                              │
│  .omtre/                                                   │
│  ├── workspace/     → Journals, session history              │
│  ├── tasks/         → Task directories, PRDs, subtasks       │
│  ├── spec/          → Coding guidelines (monorepo support)   │
│  ├── config.yaml    → Packages, hooks, update.skip           │
│  └── scripts/       → Python utilities (core subset)         │
│                                                              │
│  .claude/                                                    │
│  └── commands/      → Slash command prompts                  │
│                                                              │
│  .agents/                                                    │
│  └── skills/        → Shared agent skills (agentskills.io)   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Platform Usage

### Claude Code

All core systems work automatically with hook integration.

### iFlow

All core systems work automatically with hook integration (same as Claude Code).

### Codex

Core systems work with optional SessionStart hook and TOML agents. See `meta/platform-compatibility.md`.

### Cursor, OpenCode, Kilo, Kiro, Gemini CLI, Antigravity, Qoder, CodeBuddy

Read files manually at session start:

1. Read `.omtre/workflow.md`
2. Read relevant specs from `.omtre/spec/`
3. Check `.omtre/.current-task` for active work
4. Read JSONL files for context

---

## Documents in This Directory

| Document       | Content                                        |
| -------------- | ---------------------------------------------- |
| `files.md`     | All files in `.omtre/` with purposes         |
| `workspace.md` | Workspace system, journals, developer identity |
| `tasks.md`     | Task system, subtasks, lifecycle hooks, JSONL   |
| `specs.md`     | Spec system, monorepo layout, guidelines       |
| `scripts.md`   | Core scripts (platform-independent)            |
| `config.md`    | config.yaml full schema reference              |
