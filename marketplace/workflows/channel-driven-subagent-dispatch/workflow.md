# Channel-Driven Sub-Agent Dispatch Workflow

User-facing text and instruction files follow `.omtre/spec/agents/voice.md` (STC 中文 / ASD-STE100 English).

---

## Core Principles

1. **Plan before code** — define the task, planning artifacts, and acceptance criteria before implementation.
2. **The main session coordinates** — the main session clarifies requirements, plans the task, dispatches workers, updates specs, commits, and finishes the work.
3. **Implementation and checking run in channel workers** — use `omtre channel spawn` for implement/check workers by default instead of host-native sub-agents.
4. **Pass context explicitly** — worker context order is `jsonl entries -> prd.md -> design.md -> implement.md`.
5. **Keep results auditable** — use `omtre channel messages --raw` for worker events; pretty output is an operator dashboard and may truncate progress.
6. **Persist decisions** — requirements, research, plans, and review conclusions belong in task files.

---

## omtre System

### Developer Identity

Initialize your identity on first use:

```bash
python3 ./.omtre/scripts/init_developer.py <your-name>
```

### Spec System

`.omtre/spec/` stores project engineering guidelines. Before writing code, load the package/layer specs relevant to the task:

```bash
python3 ./.omtre/scripts/get_context.py --mode packages
```

### Task System

Each task has its own directory under `.omtre/tasks/{MM-DD-name}/` with `task.json`, `prd.md`, optional `design.md`, optional `implement.md`, optional `research/`, and `implement.jsonl` / `check.jsonl`.

Common commands:

```bash
python3 ./.omtre/scripts/task.py create "<title>" [--slug <name>] [--parent <dir>]
python3 ./.omtre/scripts/task.py start <name>
python3 ./.omtre/scripts/task.py current --source
python3 ./.omtre/scripts/task.py finish
python3 ./.omtre/scripts/task.py archive <name>
python3 ./.omtre/scripts/task.py validate <name>
```

### Channel System

Channels are the worker collaboration and event-audit layer. Use `--ephemeral` for temporary implementation/check channels. Use `--type forum` for durable discussion boards; a `thread` is an item inside a forum.

Stable worker handles:

- `implement` — implementation worker
- `check` — default check worker
- `check-cc` — Claude check worker
- `check-cx` — Codex check worker

---

<!--
  WORKFLOW-STATE BREADCRUMB CONTRACT

  [workflow-state:STATUS] blocks are the single source for per-turn prompt injection.
  Do not delete tags or change tag syntax. The body can change; parsers should not.
-->

## Phase Index

```
Phase 1: Plan    -> classify, get task-creation consent, then write planning artifacts
Phase 2: Execute -> implement/check through omtre channel workers
Phase 3: Finish  -> verify, update spec, commit, and wrap up
```

### Request Triage

- Simple conversation or small task: ask only whether this turn should create a omtre task. If the user says no, skip omtre for this session.
- Complex task: ask whether you may create a omtre task and enter planning. If the user says no, do not do broad inline implementation.
- User approval to create a task is not approval to start implementation. Implementation waits until artifacts are reviewed and `task.py start` has run.

### Planning Artifacts

- `prd.md` — requirements, constraints, and acceptance criteria.
- `design.md` — technical design for complex tasks.
- `implement.md` — execution plan, validation commands, review gates, and rollback points for complex tasks.
- `implement.jsonl` / `check.jsonl` — worker context manifests. Put spec and research files here, not code files.

Lightweight tasks may be PRD-only. Complex tasks must have `prd.md`, `design.md`, and `implement.md` before `task.py start`.

### Parent / Child Task Trees

Use a parent task when one request contains several independently verifiable deliverables. Child tasks own deliverables that can be planned, implemented, checked, and archived independently. Parent/child structure is not a dependency system; dependencies must be written in the child `prd.md` / `implement.md`.

[workflow-state:no_task]
No active task. First classify the current turn and ask for task-creation consent before creating any omtre task.
Simple conversation / small task: ask only whether this turn should create a omtre task. If the user says no, skip omtre for this session.
Complex task: ask the user if you can create a omtre task and enter the planning phase. If the user says no, explain, clarify scope, or suggest a smaller split.
[/workflow-state:no_task]

### Phase 1: Plan

- 1.0 Create task `[required · once]`
- 1.1 Requirement exploration `[required · repeatable]`
- 1.2 Research `[optional · repeatable]`
- 1.3 Configure context `[required · once]`  (sub-agent-dispatch platforms only)
- 1.4 Activate task `[required · once]`
- 1.5 Completion criteria

[workflow-state:planning]
Load `omtre-brainstorm`; stay in planning.
Lightweight: `prd.md` can be enough. Complex: finish `prd.md`, `design.md`, and `implement.md`; ask for review before `task.py start`.
Multi-deliverable scope: consider a parent task plus independently verifiable child tasks; dependencies must be written in child artifacts, not implied by tree position.
Channel-worker mode: curate `implement.jsonl` and `check.jsonl` as spec/research manifests before start.
[/workflow-state:planning]

[workflow-state:planning-inline]
Load `omtre-brainstorm`; stay in planning.
Lightweight: `prd.md` can be enough. Complex: finish `prd.md`, `design.md`, and `implement.md`; ask for review before `task.py start`.
Multi-deliverable scope: consider a parent task plus independently verifiable child tasks; dependencies must be written in child artifacts, not implied by tree position.
Inline mode: skip jsonl curation; Phase 2 reads artifacts/specs via `omtre-before-dev`.
[/workflow-state:planning-inline]

### Phase 2: Execute

- 2.1 Implement `[required · repeatable]`
- 2.2 Quality check `[required · repeatable]`
- 2.3 Rollback `[on demand]`

Channel-driven sub-agent dispatch is the default execution model for this workflow. The main session uses `omtre channel create`, `omtre channel spawn`, `omtre channel send`, and `omtre channel wait` to coordinate workers. Fall back to native host sub-agents only when the user explicitly asks for native dispatch or a host-only capability is required.

[workflow-state:in_progress]
Flow: channel-driven `implement` worker -> channel-driven `check` worker -> `omtre-update-spec` -> commit (Phase 3.4) -> `/omt:finish-work`.
Main-session default: use `omtre channel spawn` with `.omtre/agents/implement.md` and `.omtre/agents/check.md`; do not use native Claude Task / Codex sub_agent unless explicitly requested or host-only tools require it.
Worker context order: jsonl entries -> `prd.md` -> `design.md if present` -> `implement.md if present`. Use stable worker handles such as `implement`, `check`, `check-cx`, `check-cc`; read results with `omtre channel messages --raw` when precision matters.
[/workflow-state:in_progress]

[workflow-state:in_progress-inline]
Flow: `omtre-before-dev` -> edit -> channel-driven `check` worker -> validation -> `omtre-update-spec` -> commit (Phase 3.4) -> `/omt:finish-work`.
Inline implementation is allowed only when the user asked for it or the change is too small to justify a worker. After editing, prefer `omtre channel spawn --agent check` for independent review.
Read context before editing: `prd.md` -> `design.md if present` -> `implement.md if present`, plus relevant spec/research loaded by skills.
[/workflow-state:in_progress-inline]

### Phase 3: Finish

- 3.2 Debug retrospective `[on demand]`
- 3.3 Spec update `[required · once]`
- 3.4 Commit changes `[required · once]`
- 3.5 Wrap-up reminder

> Note: step 3.1 was folded into 2.2 (last-iteration full-scope check) and 3.4 (commit preamble). Numbering kept stable to avoid breaking external references.

[workflow-state:completed]
Code committed. Run `/omt:finish-work`; if dirty, return to Phase 3.4 first.
[/workflow-state:completed]

---

## Rules

1. Identify the current Phase, then continue from the next step in that Phase.
2. Run steps in order inside each Phase; `[required]` steps cannot be skipped.
3. Phase 2 uses channel workers by default. Do not implement large changes directly in the main session unless the user asked for inline work or the task is small enough.
4. Worker briefs must state the active task, goal, editable scope, validation commands, and forbidden actions.
5. `omtre channel messages --raw` is the precise audit path; pretty output is only for quick status checks.
6. After a worker completes, the main session integrates the result and runs check workers when needed. Final judgment stays with the main session.

### Active Task Routing

[Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi]

- Planning or unclear requirements -> `omtre-brainstorm`.
- `in_progress` implementation -> `omtre channel spawn --agent implement`.
- `in_progress` quality check -> `omtre channel spawn --agent check`.
- Repeated debugging -> `omtre-break-loop`; spec updates -> `omtre-update-spec`.

[/Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi]

[codex-inline, Kilo, Antigravity, Devin]

- Planning or unclear requirements -> `omtre-brainstorm`.
- Before editing -> `omtre-before-dev`; after editing -> prefer a channel-driven `check` worker.
- Repeated debugging -> `omtre-break-loop`; spec updates -> `omtre-update-spec`.

[/codex-inline, Kilo, Antigravity, Devin]

---

## Phase 1: Plan

Goal: clarify requirements, get task-creation consent, and produce planning artifacts that must be reviewed before implementation.

#### 1.0 Create task `[required · once]`

Create the task directory only after task-creation consent:

```bash
python3 ./.omtre/scripts/task.py create "<task title>" --slug <name>
```

Run only `create` here. Do not also run `start`. `start` switches status to `in_progress`, which moves the breadcrumb into execution.

#### 1.1 Requirement exploration `[required · repeatable]`

Load `omtre-brainstorm` and write user requirements into `prd.md`. Complex tasks also need `design.md` and `implement.md`.

Requirements:

- Ask one question at a time.
- Prefer researching over asking for information that can be discovered.
- Update task artifacts immediately when requirements change.
- Split broad work into parent task + child tasks.
- Keep `prd.md` focused on requirements and acceptance criteria, not implementation checklists.

#### 1.2 Research `[optional · repeatable]`

When research is needed, write results to `{TASK_DIR}/research/`. Research files must be usable by later workers.

#### 1.3 Configure context `[required · once]`

Curate worker context manifests:

- `implement.jsonl` — specs and research needed by the implementation worker.
- `check.jsonl` — quality specs, test specs, and research needed by the check worker.

Do not put code files in jsonl. Workers read code during execution.

#### 1.4 Activate task `[required · once]`

After artifact review, start the task:

```bash
python3 ./.omtre/scripts/task.py start <task-dir>
```

#### 1.5 Completion criteria

| Condition | Required |
| --- | :---: |
| `prd.md` exists | yes |
| user confirms task should enter implementation | yes |
| `task.py start` has run | yes |
| `design.md` exists for complex tasks | yes |
| `implement.md` exists for complex tasks | yes |
| `implement.jsonl` and `check.jsonl` each contain at least one real curated entry (seed row does not count) | yes |

Runtime consumers tolerate missing or seed-only manifests for compatibility, but that tolerance is not a planning-ready state.

---

## Phase 2: Execute

Goal: the main session turns reviewed planning artifacts into checked code through channel workers.

#### 2.1 Implement `[required · repeatable]`

[Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi]

Use channel-driven implement dispatch:

```bash
TASK=.omtre/tasks/<active-task>
omtre channel create impl-<topic> --task "$TASK" --by main --ephemeral
omtre channel spawn impl-<topic> \
  --agent implement \
  --as implement \
  --jsonl "$TASK/implement.jsonl" \
  --file "$TASK/prd.md" \
  --file "$TASK/design.md" \
  --file "$TASK/implement.md" \
  --cwd "$PWD" \
  --timeout 60m
omtre channel send impl-<topic> --as main --to implement --text-file /tmp/implement-brief.md
omtre channel wait impl-<topic> --as main --kind done --from implement --timeout 60m
omtre channel messages impl-<topic> --raw --from implement --last 20
```

Omit the `design.md` or `implement.md` `--file` when the file does not exist. The brief must state the worker goal, forbidden actions, validation commands, and expected completion summary.

Native sub-agent fallback is allowed only when the user explicitly asks for it or a host-only capability is required.

[/Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi]

[codex-inline, Kilo, Antigravity, Devin]

1. Load `omtre-before-dev`.
2. Read `prd.md`, then `design.md` if present, then `implement.md` if present.
3. Read relevant research.
4. Small changes may be implemented inline; larger changes should still use a channel worker.
5. After implementation, enter channel-driven check.

[/codex-inline, Kilo, Antigravity, Devin]

#### 2.2 Quality check `[required · repeatable]`

[Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi]

Use channel-driven check dispatch:

```bash
TASK=.omtre/tasks/<active-task>
omtre channel create cr-<topic> --task "$TASK" --by main --ephemeral
omtre channel spawn cr-<topic> \
  --agent check \
  --as check \
  --jsonl "$TASK/check.jsonl" \
  --file "$TASK/prd.md" \
  --file "$TASK/design.md" \
  --file "$TASK/implement.md" \
  --cwd "$PWD" \
  --timeout 30m
omtre channel send cr-<topic> --as main --to check --text-file /tmp/check-brief.md
omtre channel wait cr-<topic> --as main --kind done --from check --timeout 30m
omtre channel messages cr-<topic> --raw --from check --last 40
```

For independent cross-provider review, spawn `check-cc` and `check-cx` in the same channel:

```bash
omtre channel spawn cr-<topic> --agent check --provider claude --as check-cc --cwd "$PWD" --timeout 30m
omtre channel spawn cr-<topic> --agent check --provider codex --as check-cx --cwd "$PWD" --timeout 30m
omtre channel send cr-<topic> --as main --to check-cc --text-file /tmp/check-brief.md
omtre channel send cr-<topic> --as main --to check-cx --text-file /tmp/check-brief.md
omtre channel wait cr-<topic> --as main --kind done --from check-cc,check-cx --all --timeout 30m
```

Check workers should directly fix clear issues. The main session reads raw events and makes the final judgment.

[/Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi]

[codex-inline, Kilo, Antigravity, Devin]

Load `omtre-check` or use a channel-driven check worker. If issues are found, fix and re-check until green.

[/codex-inline, Kilo, Antigravity, Devin]

#### 2.3 Rollback `[on demand]`

- If check finds a PRD defect -> return to Phase 1, fix artifacts, then execute again.
- If an implement worker goes off-track -> narrow the brief, redispatch, or revert that work.
- If more research is needed -> write to `{TASK_DIR}/research/`, then redispatch.

---

## Phase 3: Finish

Goal: verify quality, capture lessons, and commit the work.

#### 3.2 Debug retrospective `[on demand]`

If the same class of issue recurred, load `omtre-break-loop` and record root cause plus prevention.

#### 3.3 Spec update `[required · once]`

Load `omtre-update-spec` and decide whether new patterns, pitfalls, or technical decisions should be written back to `.omtre/spec/`.

#### 3.4 Commit changes `[required · once]`

**Spec-sync preamble**: before drafting commits, ask: did this task fix a bug or surface non-obvious knowledge that should land in `.omtre/spec/` so future-you (or future-AI) doesn't repeat the mistake? If yes, return to Phase 3.3 first — spec writes belong in the same task's commit batch, not as a forgotten follow-up.

The main session commits work changes. Before committing, separate AI-edited files from unknown dirty files.

```bash
git status --porcelain
git log --oneline -5
```

Do not amend. Do not push.

#### 3.5 Wrap-up reminder

After committing, remind the user to run `/omt:finish-work` to archive the task and record the session.

---

## Customizing omtre

This workflow is customized through `.omtre/workflow.md`. Scripts parse tags and headings; they do not store fallback prose.

### Change a step

Edit the corresponding Phase 1 / 2 / 3 step body.

### Change per-turn prompt text

Edit the body of the matching `[workflow-state:STATUS]` block. Do not change tag names or syntax.

### Add a custom status

Add:

```text
[workflow-state:my-status]
...
[/workflow-state:my-status]
```

A lifecycle hook or script must write `task.json.status` to that value, otherwise the block is never read.
