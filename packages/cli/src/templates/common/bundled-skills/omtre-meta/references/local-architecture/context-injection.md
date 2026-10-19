# Local Context Injection System

OMTRE context injection aims to make AI read the right files at the right time instead of relying on model memory. In a user project, injection is implemented by `.omtre/` scripts together with platform hooks, agents, and skills.

## Injected Context Types

| Type | Source | Purpose |
| --- | --- | --- |
| session context | `.omtre/scripts/get_context.py` | Current developer, git status, active task, active tasks, journal, packages. |
| workflow context | `.omtre/workflow.md` | Current OMTRE flow and next action. |
| spec context | `.omtre/spec/` + task JSONL | Specs that must be followed during implementation/checking. |
| task context | `.omtre/tasks/<task>/prd.md`, `design.md`, `implement.md`, `research/` | Current task requirements, design, execution plan, and research. |
| platform context | Platform hooks/settings/agents | Lets different AI tools read the files above through their own mechanisms. |

## session-start

Platforms with session-start support inject a OMTRE overview when a session starts, clears, compacts, or receives a similar event. Injected content usually includes:

- workflow summary.
- current task status.
- active tasks.
- spec index paths.
- developer identity and git status.

If the user feels the AI does not know the current task in a new session, first check whether the platform's session-start hook or equivalent mechanism is installed and running.

## workflow-state

workflow-state is a lightweight hint injected around each user turn. Based on current task status, it selects a block from `.omtre/workflow.md`, such as `no_task`, `planning`, `in_progress`, or `completed`.

If the user wants to change "what the AI should do next in a given state," edit the corresponding state block in `.omtre/workflow.md` first.

## sub-agent context

Implement and check agents need task context. OMTRE has two loading modes:

1. **hook push**: a platform hook injects jsonl-referenced files plus `prd.md`, `design.md` if present, and `implement.md` if present before the agent starts.
2. **agent pull**: the agent definition instructs the agent to read the active task, jsonl context, and task artifacts after startup.

In both modes, JSONL files in the task directory are the manifest for spec/research context. Task artifacts are read separately in this order: `prd.md` -> `design.md if present` -> `implement.md if present`.

## JSONL Reading Rules

`implement.jsonl` and `check.jsonl` contain one JSON object per line:

```jsonl
{"file": ".omtre/spec/backend/index.md", "reason": "Backend rules"}
```

Readers should skip rows without a `file` field (e.g. legacy `_example` placeholders). When configuring JSONL, the AI should include only spec/research files, not pre-register code files that will be modified.

## Active Task And Context Key

Active task state lives in `.omtre/.runtime/sessions/` and is isolated per session. Hooks try to resolve the context key from platform events, environment variables, transcript paths, or `OMTRE_CONTEXT_ID`.

If shell commands cannot see the same context key, `task.py current --source` may report no active task. In that case, check whether the platform passes session identity into the shell instead of hand-writing a global current-task file.

## Local Customization Points

| Need | Edit location |
| --- | --- |
| Change session-start injected content | The platform's `session-start` hook or plugin file. |
| Change per-turn workflow-state rules | `[workflow-state:STATUS]` block in `.omtre/workflow.md`. The platform workflow-state hook parses these blocks verbatim and embeds no fallback text. |
| Change how sub-agents read context | Platform agent definitions, the `inject-subagent-context` hook, or agent preludes. |
| Change JSONL validation/display | `.omtre/scripts/common/task_context.py`. |
| Change active task resolution | `.omtre/scripts/common/active_task.py`. |

When modifying context injection, verify two things: new sessions can see the correct task, and sub-agents can see the correct task artifacts/spec/research.
