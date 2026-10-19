---
description: "Omtre Copilot prompt: Start Session"
---

# Start Session

Initialize a Omtre-managed development session. This platform has no session-start hook, so manually load the equivalent context by following these steps (each one mirrors a section the hook would otherwise inject).

---

## Step 1: Current state
Identity, git status, current task, active tasks, journal location.

```bash
{{PYTHON_CMD}} ./.omtre/scripts/get_context.py
```

If this output includes a line beginning `Omtre update available:`, copy the full line verbatim when summarizing session context. Do not shorten operational command hints.

## Step 2: Workflow overview
Phase Index + skill routing table + DO-NOT-skip rules.

```bash
{{PYTHON_CMD}} ./.omtre/scripts/get_context.py --mode phase
```

Full guide in `.omtre/workflow.md` (read on demand).

## Step 3: Guideline indexes
Discover packages + spec layers, then read each relevant index file.

```bash
{{PYTHON_CMD}} ./.omtre/scripts/get_context.py --mode packages
cat .omtre/spec/guides/index.md
cat .omtre/spec/<package>/<layer>/index.md   # for each relevant layer
```

Index files list the specific guideline docs to read when you actually start coding.

## Step 4: Decide next action
From Step 1 you know the current task and status. Check the task directory:

- **Active task status `planning` + no `prd.md`** → Phase 1.1. Load the `omtre-brainstorm` skill.
- **Active task status `planning` + `prd.md` exists** → stay in Phase 1. Lightweight tasks can be PRD-only; complex tasks need `design.md` + `implement.md`. Load the relevant Phase 1 step detail before `task.py start`.
- **Active task status `in_progress`** → Phase 2 step 2.1. Load the step detail:
  ```bash
  {{PYTHON_CMD}} ./.omtre/scripts/get_context.py --mode phase --step 2.1 --platform {{CLI_FLAG}}
  ```
- **No active task** → classify first, then follow the repo's autonomy mode (`.omtre/config.yaml` `autonomy`): under `gated`, ask whether this turn may create a Omtre task (complex work: also planning); under `hands-off`, create the task without asking when one is warranted. If the user says no, skip Omtre for this session.

---

## Skill routing (quick reference)

| User intent | Skill |
|---|---|
| New feature / unclear requirements | `omtre-brainstorm` |
| About to write code | `omtre-before-dev` |
| Done coding / quality check | `omtre-check` |
| Stuck / fixed same bug multiple times | `omtre-break-loop` |
| Learned something worth capturing | `omtre-update-spec` |

Full rules + anti-rationalization table in `.omtre/workflow.md`.
