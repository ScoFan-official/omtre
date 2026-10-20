# Agents

OMTRE agent files define specialized roles. Common OMTRE agents in a user project are:

- `omtre-research`
- `omtre-implement`
- `omtre-check`

File locations and formats differ by platform, but responsibility boundaries should stay consistent.

## Agent Responsibilities

| Agent | Responsibility |
| --- | --- |
| `omtre-research` | Investigate the question and write findings into the current task's `research/`. |
| `omtre-implement` | Implement against `prd.md`, optional `design.md` / `implement.md`, `implement.jsonl`, and related spec/research. |
| `omtre-check` | Review changes, fix discovered issues, and run necessary checks. |

Agent files should not become generic chat prompts. They should define input sources, write boundaries, whether code may be changed, and how results are reported.

## Common Paths

| Platform | Agent path |
| --- | --- |
| Claude Code | `.claude/agents/omtre-*.md` |
| Cursor | `.cursor/agents/omtre-*.md` |
| OpenCode | `.opencode/agents/omtre-*.md` |
| Codex | `.codex/agents/omtre-*.toml` |
| Kiro | `.kiro/agents/omtre-*.json` |
| Gemini CLI | `.gemini/agents/omtre-*.md` |
| Qoder | `.qoder/agents/omtre-*.md` |
| CodeBuddy | `.codebuddy/agents/omtre-*.md` |
| Factory Droid | `.factory/droids/omtre-*.md` |
| Pi Agent | `.pi/agents/omtre-*.md` |
| Reasonix | `.reasonix/skills/omtre-*/SKILL.md` (subagent frontmatter) |
| ZCode | `.zcode/agents/omtre-*.md` |
| Kimi Code | `.kimi-code/agents/omtre-*.md` (custom sub-agents; the same prompts also ship as `.kimi-code/skills/omtre-*/SKILL.md`) |

GitHub Copilot agent/prompt support is provided by a combination of directories such as `.github/agents/`, `.github/prompts/`, and `.github/skills/`; inspect the files actually generated in the user project.

Main-session workflow platforms such as Kilo, Antigravity, and Devin may not have OMTRE sub-agent files. They usually rely on workflows/skills to guide the main session.

## Two Context Loading Modes

### hook push

The platform hook injects task context before the agent starts. The agent file itself can focus more on responsibilities and boundaries.

Common on platforms that support agent hooks.

### agent pull

The agent file instructs the agent to read after startup:

- `python ./.omtre/scripts/task.py current --source`
- `implement.jsonl` or `check.jsonl`
- spec/research files referenced by JSONL
- current task `prd.md`
- `design.md` if present
- `implement.md` if present

This mode fits platforms whose hooks cannot reliably rewrite sub-agent prompts.

## Local Change Scenarios

| User need | Edit location |
| --- | --- |
| Implement agent must follow extra restrictions | The platform's `omtre-implement` agent file. |
| Check agent must run project-specific commands | `omtre-check` agent file, and `.omtre/spec/` if needed. |
| Research agent must output a fixed format | `omtre-research` agent file. |
| Agent cannot read task context | Agent prelude or `inject-subagent-context` hook. |
| Add a project-specific agent | Platform agent directory + related workflow/command/skill entry point. |

## Modification Principles

1. **Keep responsibilities single-purpose**. Do not mix research, implement, and check responsibilities into one agent.
2. **Specify the read order**. Agents must know to start from the active task, read jsonl/spec context, then read `prd.md`, `design.md` if present, and `implement.md` if present.
3. **Specify write boundaries**. Research usually only writes `research/`; implement can write code; check can fix issues.
4. **Keep semantics synchronized in multi-platform projects**. If the user configured Claude, Codex, and Cursor together, decide whether changes to one platform's agent also need to be applied to others.

## Do Not Default To Editing Upstream Templates

Local AI should default to modifying platform agent files inside the user project. Discuss upstream template source only when the user explicitly wants to contribute the change back to OMTRE.
