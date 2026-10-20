# Development Workflow

---

## Core Principles

1. **Plan before code** — figure out what to do before you start
2. **Specs injected, not remembered** — guidelines are injected via hook/skill, not recalled from memory
3. **Persist everything** — research, decisions, and lessons all go to files; conversations get compacted, files don't
4. **Incremental development** — one task at a time
5. **Capture learnings** — after each task, review and write new knowledge back to spec

---

## Omtre System

### Developer Identity

On first use, initialize your identity:

```bash
python ./.omtre/scripts/init_developer.py <your-name>
```

Creates `.omtre/.developer` (gitignored) + `.omtre/workspace/<your-name>/`.

### Spec System

`.omtre/spec/` holds coding guidelines organized by package and layer.

- `.omtre/spec/<package>/<layer>/index.md` — entry point with **Pre-Development Checklist** + **Quality Check**. Actual guidelines live in the `.md` files it points to.
- `.omtre/spec/guides/index.md` — cross-package thinking guides.

```bash
python ./.omtre/scripts/get_context.py --mode packages   # list packages / layers
```

**When to update spec**: new pattern/convention found · bug-fix prevention to codify · new technical decision.

### Task System

Every task has its own directory under `.omtre/tasks/{MM-DD-name}/` holding `task.json`, `prd.md`, optional `design.md`, optional `implement.md`, optional `research/`, and context manifests (`implement.jsonl`, `check.jsonl`) for sub-agent-capable platforms.

```bash
# Task lifecycle
python ./.omtre/scripts/task.py create "<title>" [--slug <name>] [--parent <dir>]
python ./.omtre/scripts/task.py start <name>          # set active task (session-scoped when available)
python ./.omtre/scripts/task.py current --source      # show active task and source
python ./.omtre/scripts/task.py finish                # clear active task (triggers after_finish hooks)
python ./.omtre/scripts/task.py archive <name>        # move to archive/{year-month}/
python ./.omtre/scripts/task.py list [--mine] [--status <s>]
python ./.omtre/scripts/task.py list-archive

# Code-spec context (injected into implement/check agents via JSONL).
# `implement.jsonl` / `check.jsonl` are seeded (empty) on `task create` for sub-agent-capable
# platforms; the AI curates real spec + research entries during planning. `validate` fails
# and `start` refuses while a seeded manifest is still empty — sub-agents would run with
# zero spec context. Pass `start --allow-empty-context` when that is intentional.
python ./.omtre/scripts/task.py add-context <name> <action> <file> <reason>
python ./.omtre/scripts/task.py list-context <name> [action]
python ./.omtre/scripts/task.py validate <name>

# Task metadata
python ./.omtre/scripts/task.py set-branch <name> <branch>
python ./.omtre/scripts/task.py set-base-branch <name> <branch>    # PR target
python ./.omtre/scripts/task.py set-scope <name> <scope>

# Hierarchy (parent/child)
python ./.omtre/scripts/task.py add-subtask <parent> <child>
python ./.omtre/scripts/task.py remove-subtask <parent> <child>

# PR creation
python ./.omtre/scripts/task.py create-pr [name] [--dry-run]
```

> Run `python ./.omtre/scripts/task.py --help` to see the authoritative, up-to-date list.

**Current-task mechanism**: `task.py create` creates the task directory and (when session identity is available) auto-sets the per-session active-task pointer so the planning breadcrumb fires immediately. `task.py start` writes the same pointer (idempotent if already set) and flips `task.json.status` from `planning` to `in_progress`. State is stored under `.omtre/.runtime/sessions/`. If no context key is available from hook input, `OMTRE_CONTEXT_ID`, or a platform-native session environment variable, there is no active task and `task.py start` fails with a session identity hint. `task.py finish` deletes the current session file (status unchanged). `task.py archive <task>` writes `status=completed`, moves the directory to `archive/`, and deletes any runtime session files that still point at the archived task.

### Workspace System

Records every AI session for cross-session tracking under `.omtre/workspace/<developer>/`.

- `journal-N.md` — session log. **Max 2000 lines per file**; a new `journal-(N+1).md` is auto-created when exceeded.
- `index.md` — personal index (total sessions, last active).

```bash
python ./.omtre/scripts/add_session.py --title "Title" --commit "hash" --summary "Summary"
```

### Context Script

```bash
python ./.omtre/scripts/get_context.py                            # full session runtime
python ./.omtre/scripts/get_context.py --mode packages            # available packages + spec layers
python ./.omtre/scripts/get_context.py --mode phase --step <X.Y>  # detailed guide for a workflow step
```

---

<!--
  WORKFLOW-STATE BREADCRUMB CONTRACT (read this before editing the tag blocks below)

  The [workflow-state:STATUS] blocks embedded in the ## Phase Index section
  below are the SINGLE source of truth for the per-turn `<workflow-state>`
  breadcrumb that every supported AI platform's UserPromptSubmit hook
  reads. inject-workflow-state.py (Python platforms) and
  inject-workflow-state.js (OpenCode plugin) only parse them — there is no
  fallback dict baked into the scripts after v0.5.0-rc.0.

  STATUS charset: [A-Za-z0-9_-]+. When the hook can't find a tag, it
  degrades to a generic "Refer to workflow.md for current step." line —
  intentionally visible so users notice and fix a broken workflow.md.

  INVARIANT (test/regression.test.ts):
    Every workflow-walkthrough step marked `[required · once]` must have a
    matching enforcement line in its phase's [workflow-state:*] block. The
    breadcrumb is the only per-turn channel; if a mandatory step isn't
    mentioned there, the AI silently skips it (Phase 1 planning gate
    skip and Phase 3.4 commit skip both manifested via this gap).

  TAG ↔ PHASE scoping:
    [workflow-state:no_task]      → no active task; before Phase 1
    [workflow-state:task_error]   → active task record is unreadable; repair it before continuing
    [workflow-state:planning]     → all of Phase 1 (status='planning')
    [workflow-state:planning-inline] → Codex inline variant of Phase 1
    [workflow-state:in_progress]  → Phase 2 + Phase 3.2-3.4
                                    (status stays 'in_progress' from
                                    task.py start until task.py archive)
    [workflow-state:in_progress-inline] → Codex inline variant of Phase 2/3
    Completion has no dedicated tag: cmd_archive clears the active-task
    pointer in the same call that flips status, so the turn after
    finish-work resolves to [workflow-state:no_task] — whose breadcrumb
    carries a computed `next: <frontier head>` line (the first startable
    ticket; full ready/blocked view via `task.py frontier`).

  Editing checklist:
    - When you change a [workflow-state:STATUS] block, also check the
      matching phase's `[required · once]` walkthrough steps for sync
    - Run `omtre update` after editing to push the new bodies to
      downstream user projects (workflow.md is replaced as one managed
      file when unmodified; a locally modified copy prompts instead)
    - These blocks are parsed by inject-workflow-state.py (Python
      platforms, installed under the platform hooks dir — e.g.
      .claude/hooks/, .codex/hooks/) and inject-workflow-state.js
      (OpenCode, .opencode/plugins/); the scripts hold no fallback bodies
-->

## Phase Index

```
Phase 1: Plan    → classify + route to a domain, then write planning artifacts (consent gates per autonomy mode)
Phase 2: Execute → implement only after task status is in_progress
Phase 3: Finish  → verify, update spec, commit, and wrap up
```

### Request Triage

Autonomy mode comes from `.omtre/config.yaml` `autonomy: gated | hands-off | supervised-delivery` (default `hands-off`; an unrecognized value is `hands-off` and is never treated as the push tier): `[B档]` lines apply under `gated` (ask the user at each gate); `[C档]` lines apply under `hands-off` and also under `supervised-delivery` (auto-pass the same gates — the user can veto afterwards). `supervised-delivery` adds one thing and one only: `omtre run` may push the ticket branch when `task.py delivery-gate` allows it, and open a PR that is already ready for review. It never merges, and pushing the default branch or a tag is refused by the gate, not by etiquette. The always-stop list in Guardrails applies to every tier.

- Simple conversation or small task:
  - `[B档]` ask only whether this turn should create a Omtre task. If the user says no, skip Omtre for this session.
  - `[C档]` create the task without asking when one is warranted — the task itself is the record.
- Complex task:
  - `[B档]` ask whether you may create a Omtre task and enter planning. If the user says no, do not do broad inline implementation; explain, clarify scope, or suggest a smaller split.
  - `[C档]` create the task and enter planning directly; still explain scope and split oversized work.
- Creating a task also routes it to a domain — scan `.omtre/domains/REGISTRY.md` first (full rule in step 1.0).
- Consent to create a task is not approval to start implementation. Planning still happens first.

### Planning Artifacts

- `prd.md` — requirements, constraints, and acceptance criteria. Do not put technical design or execution checklists here.
- `design.md` — technical design for complex tasks: boundaries, contracts, data flow, tradeoffs, compatibility, rollout / rollback shape.
- `implement.md` — execution plan for complex tasks: ordered checklist, validation commands, review gates, and rollback points.
- `implement.jsonl` / `check.jsonl` — spec and research manifests for sub-agent context. They do not replace `implement.md`.
- Lightweight tasks may be PRD-only. Complex tasks must have `prd.md`, `design.md`, and `implement.md` before `task.py start`.

### Parent / Child Task Trees

Use a parent task when one user request contains several independently verifiable deliverables. The parent task owns the source requirement set, the task map, cross-child acceptance criteria, and final integration review; it normally should not be the implementation target unless it also has direct work.

Use child tasks for deliverables that can be planned, implemented, checked, and archived independently. Parent/child is containment, not ordering: when one child must wait for another, record it as a dependency with `task.py set-meta <child> blocked_by "<dir-or-slug> ..."`, and `task.py frontier` keeps that child out of the ready set until every blocker is done or archived. Sequencing that is not a hard blocker still belongs in the child `prd.md` / `implement.md`, and each child's acceptance criteria stays testable.

Create new children with `task.py create "<title>" --slug <name> --parent <parent-dir>`. Link existing tasks with `task.py add-subtask <parent> <child>`, and unlink mistakes with `task.py remove-subtask <parent> <child>`.

<!-- Per-turn breadcrumb: shown when there is no active task (before Phase 1) -->

[workflow-state:no_task]
No active task. First classify the current turn; a new task is also routed to a domain in the same step — scan `.omtre/domains/REGISTRY.md` before `task.py create` (match → `meta.domain`; no match → scaffold the domain + REGISTRY line in the same commit; truly domain-less → `Domain: none（reason）` in prd.md). Ownership unclear → stop and ask the user — this applies in BOTH modes.
[B档] Ask for task-creation consent before creating any Omtre task — simple/small: ask only whether this turn should create one; complex: ask to create a task and enter planning. If the user says no, skip Omtre or clarify/split scope.
[C档] Create the task and route it without asking — the task itself is the record; the user can veto afterwards. The classification and routing judgments still apply.
When a `next:` line appears below this block, it is the dependency frontier's head — the first startable ticket (blocked tickets excluded) — computed from task data by the hook, not editable here; run `task.py frontier` for the full ready/blocked view.
[/workflow-state:no_task]

<!-- Per-turn breadcrumb: shown when the active task record cannot be read. -->

[workflow-state:task_error]
The active task record could not be read. Do not create or activate another task.
Inspect the task directory named above and repair its task.json. It must be a valid JSON object with a non-empty status.
Preserve existing task fields and artifacts. If the correct status cannot be determined safely, ask the user before reconstructing the record.
[/workflow-state:task_error]

### Phase 1: Plan
- 1.0 Create task `[required · once]` (only after task-creation consent)
- 1.1 Requirement exploration `[required · repeatable]` (`prd.md`; complex tasks also need `design.md` + `implement.md`)
- 1.2 Research `[optional · repeatable]`
- 1.3 Configure context `[required · once]` — Claude Code, Cursor, OpenCode, Codex, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi, Oh My Pi, ZCode, Snow, Reasonix, Grok, Kimi Code (sub-agent-dispatch platforms only; inline platforms skip)
- 1.4 Activate task `[required · once]` (review gate, then `task.py start`; status → in_progress)
- 1.5 Completion criteria

<!-- Per-turn breadcrumb: shown throughout Phase 1 (status='planning') -->

[workflow-state:planning]
Load `omtre-brainstorm`; stay in planning.
Lightweight: `prd.md` can be enough. Complex: finish `prd.md`, `design.md`, and `implement.md`.
[B档] Ask for artifact review before `task.py start`.
[C档] Run `task.py start` once artifacts are complete — review becomes after-the-fact veto; the user can still halt mid-work.
Multi-deliverable scope: consider a parent task plus independently verifiable child tasks; dependencies must be written in child artifacts, not implied by tree position.
Sub-agent mode: curate `implement.jsonl` and `check.jsonl` as spec/research manifests before start.
[/workflow-state:planning]

<!-- Per-turn breadcrumb: shown throughout Phase 1 when codex.dispatch_mode=inline.
     Codex-only opt-in alternate to [workflow-state:planning]. The main agent
     edits code directly in Phase 2, so jsonl curation is skipped —
     the inline workflow loads `omtre-before-dev` instead of injecting JSONL
     into a sub-agent. -->

[workflow-state:planning-inline]
Load `omtre-brainstorm`; stay in planning.
Lightweight: `prd.md` can be enough. Complex: finish `prd.md`, `design.md`, and `implement.md`.
[B档] Ask for artifact review before `task.py start`.
[C档] Run `task.py start` once artifacts are complete — review becomes after-the-fact veto; the user can still halt mid-work.
Multi-deliverable scope: consider a parent task plus independently verifiable child tasks; dependencies must be written in child artifacts, not implied by tree position.
Inline mode: skip jsonl curation; Phase 2 reads artifacts/specs via `omtre-before-dev`.
[/workflow-state:planning-inline]

### Phase 2: Execute
- 2.1 Implement `[required · repeatable]`
- 2.2 Quality check `[required · repeatable]`
- 2.3 Rollback `[on demand]`

<!-- Per-turn breadcrumb: shown while status='in_progress'.
     Scope: all of Phase 2 + Phase 3.2-3.4 (status stays 'in_progress' from
     task.py start until task.py archive; only archive flips it). The body
     therefore must cover every required step from implementation through
     commit, including Phase 3.3 spec update and Phase 3.4 commit. -->

Sub-agent dispatch protocol applies to all platforms and all sub-agents, including native Codex `SubagentStart` context injection with child-side pull fallback, class-2 Gemini/Qoder/Copilot/Reasonix/Trae/Grok/Kimi Code, hook-backed ZCode/Snow, and `omtre-research`: every dispatch prompt starts with `Active task: <task path from task.py current>`, then a line requiring the agent to restate its task understanding in one line (task / domain / flag status / next step) after reading the task files and before making any change, then role-specific instructions. On Grok Build, use `spawn_subagent` with `subagent_type` set to the Omtre agent name (e.g. `omtre-implement`). On Kimi Code, dispatch the built-in `coder` / `explore` sub-agent with the matching `.kimi-code/skills/omtre-<role>/SKILL.md` instructions.

[workflow-state:in_progress]
Tools: `omtre-implement` / `omtre-research` are sub-agent types only (Task/Agent tool, NOT Skill; there is no skill by these names). `omtre-update-spec` is a skill. `omtre-check` exists as both; prefer the Agent form when verifying after code changes.
Flow: `omtre-implement` -> `omtre-check` -> `omtre-update-spec` -> commit (Phase 3.4) -> `/omt:finish-work`.
Main-session default: dispatch implement/check sub-agents. Sub-agent self-exemption: if already running as `omtre-implement`, do NOT spawn another `omtre-implement` or `omtre-check`; if already running as `omtre-check`, do NOT spawn another `omtre-check` or `omtre-implement`. Dispatch is main session only.
Dispatch prompt starts with `Active task: <task path from task.py current>` + a restate-first line (the agent restates task / domain / flag status / next step in one line after reading, before changing anything). Read context: jsonl entries -> `prd.md` -> `design.md if present` -> `implement.md if present`.
[B档] Phase 3.4 commit: present the batched plan and wait for one-shot confirmation; `/omt:finish-work` stays user-invoked.
[C档] Phase 3.4 commit: execute the plan directly and list it in the report for after-the-fact veto; run `/omt:finish-work` yourself and report.
Both modes: files you did not edit this session NEVER enter a commit — list them separately instead.
[/workflow-state:in_progress]

<!-- Per-turn breadcrumb: shown while status='in_progress' when
     codex.dispatch_mode=inline. Codex-only opt-in alternate to
     [workflow-state:in_progress]. The main session edits code directly
     instead of dispatching sub-agents. -->

[workflow-state:in_progress-inline]
Flow: `omtre-before-dev` -> edit -> `omtre-check` -> validation -> `omtre-update-spec` -> commit (Phase 3.4) -> `/omt:finish-work`.
Do not dispatch implement/check sub-agents in inline mode.
Read context: `prd.md` -> `design.md if present` -> `implement.md if present`, plus relevant spec/research loaded by skills.
[B档] Phase 3.4 commit: present the batched plan and wait for one-shot confirmation; `/omt:finish-work` stays user-invoked.
[C档] Phase 3.4 commit: execute the plan directly and list it in the report for after-the-fact veto; run `/omt:finish-work` yourself and report.
Both modes: files you did not edit this session NEVER enter a commit — list them separately instead.
[/workflow-state:in_progress-inline]

### Phase 3: Finish
- 3.2 Debug retrospective `[on demand]`
- 3.3 Spec update `[required · once]`
- 3.4 Commit changes `[required · once]`
- 3.5 Wrap-up reminder

> Note: step 3.1 was folded into 2.2 (last-iteration full-scope check) and 3.4 (commit preamble). Numbering kept stable to avoid breaking external references.

<!-- Completion has no breadcrumb block: cmd_archive flips status and moves
     the task dir in the same call, so the active-task pointer clears and the
     turn after finish-work resolves to [workflow-state:no_task], whose body
     carries the computed `next:` frontier pointer. -->

### Rules

1. Identify which Phase you're in, then continue from the next step there
2. Run steps in order inside each Phase; `[required]` steps can't be skipped
3. Phases can roll back (e.g., Execute reveals a prd defect → return to Plan to fix, then re-enter Execute)
4. Steps tagged `[once]` are skipped if the output already exists; don't re-run
5. Artifact presence informs the next step; missing `design.md` / `implement.md` is valid for lightweight tasks and incomplete planning for complex tasks.

### Active Task Routing

When a user request matches one of these intents inside an active task, route first, then load the detailed phase step if needed.

[Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi, Oh My Pi, ZCode, Snow, Reasonix, Trae, Grok, Kimi Code]

- Planning or unclear requirements -> `omtre-brainstorm`.
- `in_progress` implementation/check -> dispatch `omtre-implement` / `omtre-check`.
- Repeated debugging -> `omtre-break-loop`; spec updates -> `omtre-update-spec`.

[/Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi, Oh My Pi, ZCode, Snow, Reasonix, Trae, Grok, Kimi Code]

[Devin]

- Planning or unclear requirements -> `omtre-brainstorm` (main session, interactive).
- `in_progress` implementation/check -> dispatch sub-agents via `run_subagent` (profile `subagent_general`; check runs as two parallel axis workers — see step 2.2); role cards are `.omtre/agents/implement.md` and `.omtre/agents/check.md`. The main session orchestrates and relays reports — it does not edit product code or review inline.
- Repeated debugging -> `omtre-break-loop`; spec updates -> `omtre-update-spec` (main session).

[/Devin]

[codex-inline, Kilo, Antigravity, DeepSeek Harness]

- Planning or unclear requirements -> `omtre-brainstorm`.
- Before editing -> `omtre-before-dev`; after editing -> `omtre-check`.
- Repeated debugging -> `omtre-break-loop`; spec updates -> `omtre-update-spec`.

[/codex-inline, Kilo, Antigravity, DeepSeek Harness]

### Guardrails

- Task creation approval is not implementation approval; implementation waits for `task.py start` after artifact review (`[C档]` auto-passes the review gate — see Request Triage).
- PRD-only is valid for lightweight tasks; complex tasks need `design.md` + `implement.md`.
- Planning must be persisted to task artifacts; checks must run before reporting completion.
- Always stop and ask the user in EVERY autonomy tier: destructive/irreversible operations; secrets, credentials, or real external side-effects (the routine finish-work `git push` to an existing remote excepted); an active (non-stale) construction flag conflict on a domain; unclear ownership — when you cannot name the domain.
- An explicit user instruction to stop automation always overrides the autonomy mode — the verbal emergency stop wins over `autonomy: hands-off`.

### Loading Step Detail

At each step, run this to fetch detailed guidance:

```bash
python ./.omtre/scripts/get_context.py --mode phase --step <step>
# e.g. python ./.omtre/scripts/get_context.py --mode phase --step 1.1
```

---

## Phase 1: Plan

Goal: classify the request, route a new task to its domain, get task-creation consent when the mode requires it, and produce the planning artifacts required before implementation.

#### 1.0 Create task + route to a domain `[required · once]`

Classify and route in one step, then create the task directory (consent per autonomy mode: `[B档]` ask first; `[C档]` create — the user vetoes afterwards).

**Domain routing (before `create`)** — scan `.omtre/domains/REGISTRY.md`, one line per domain:

- A domain matches → pass `--meta domain=<slug>` to `task.py create` and write `Domain: .omtre/domains/<slug>/` at the top of `prd.md`.
- No domain fits → scaffold one first: copy `.omtre/domains/_scaffold/` to `.omtre/domains/<slug>/` and append a `<slug>/ — <≤100-char purpose>` line to `REGISTRY.md`; the skeleton and the REGISTRY line land in the SAME commit. Then create the task. Slug is lowercase letters/digits/hyphens and must not semantically overlap an existing domain.
- Genuinely domain-less (docs/worklog-only change, same-day throwaway probe, Omtre infra/meta work) → leave `meta.domain` empty and write `Domain: none（<one-line reason>）` at the top of `prd.md`.
- **Ownership unclear → stop and ask the user** — a safety net, not a per-task gate; every autonomy tier stops here.

The command sets status to `planning`, writes `task.json`, creates a default `prd.md`, and auto-targets the new task when session identity is available:

```bash
python ./.omtre/scripts/task.py create "<task title>" --slug <name> --meta domain=<slug>
```

`--slug` is the human-readable name only. Do **not** include the `MM-DD-` date prefix; `task.py create` adds that prefix automatically.

For task trees, create the parent task first and then create each child with `--parent <parent-dir>`. Do not start the parent just because children exist; start the child that owns the next independently verifiable deliverable.

After this command succeeds, the per-turn breadcrumb auto-switches to `[workflow-state:planning]`, telling the AI to stay in planning.

Run only `create` here — do not also run `start`. `start` flips status to `in_progress`, which switches the breadcrumb to the implementation phase before planning artifacts are reviewed. Save `start` for step 1.4.

Skip when `python ./.omtre/scripts/task.py current --source` already points to a task.

#### 1.1 Requirement exploration `[required · repeatable]`

Load the `omtre-brainstorm` skill and explore requirements interactively with the user per the skill's guidance.

The brainstorm skill will guide you to:
- Ask one question at a time
- Prefer researching over asking the user
- Prefer offering options over open-ended questions
- Update `prd.md` immediately after each user answer
- Split large scopes into a parent task plus child tasks when the deliverables can be verified independently
- Keep `prd.md` focused on requirements and acceptance criteria
- For complex tasks, produce `design.md` and `implement.md` before implementation starts

When considering a parent/child split:
- Use a parent task when one request contains several independently verifiable deliverables.
- Parent tasks own source requirements, child-task mapping, cross-child acceptance criteria, and final integration review.
- Child tasks own actual deliverables that can be planned, implemented, checked, and archived independently.
- Parent/child structure is containment, not dependency. Hard ordering is the formal `blocked_by` field (`task.py set-meta <task> blocked_by "<dir-or-slug> ..."`), which `task.py frontier` resolves into the ready set; write softer sequencing in the child's `prd.md` / `implement.md`.
- Start the child task that owns the next deliverable. Do not start the parent unless the parent itself has direct implementation work.

Return to this step whenever requirements change and revise the relevant artifact.

#### 1.2 Research `[optional · repeatable]`

Research can happen at any time during requirement exploration. It isn't limited to local code — you can use any available tool (MCP servers, skills, web search, etc.) to look up external information, including third-party library docs, industry practices, API references, etc.

[Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi, Oh My Pi, ZCode, Snow, Reasonix, Trae, Grok, Kimi Code]

Spawn the research sub-agent:

- **Agent type**: `omtre-research`
- **Task description**: Research <specific question>
- **Key requirement**: Research output MUST be persisted to `{TASK_DIR}/research/`

[/Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi, Oh My Pi, ZCode, Snow, Reasonix, Trae, Grok, Kimi Code]

[codex-inline, Kilo, Antigravity, Devin, DeepSeek Harness]

Do the research in the main session directly and write findings into `{TASK_DIR}/research/`. `codex-inline` is the explicit mode that keeps work in the main session.

[/codex-inline, Kilo, Antigravity, Devin, DeepSeek Harness]

**Research artifact conventions**:
- One file per research topic (e.g. `research/auth-library-comparison.md`)
- Record third-party library usage examples, API references, version constraints in files
- Note relevant spec file paths you discovered for later reference

Brainstorm and research can interleave freely — pause to research a technical question, then return to talk with the user.

**Key principle**: Research output must be written to files, not left only in the chat. Conversations get compacted; files don't.

#### 1.3 Configure context `[required · once]`

[Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi, Oh My Pi, ZCode, Snow, Reasonix, Trae, Grok, Kimi Code, Devin]

Curate `implement.jsonl` and `check.jsonl` so the Phase 2 sub-agents get the right spec/research context. These files were seeded on `task create` with a single self-describing `_example` line; your job here is to fill in real entries.

**Location**: `{TASK_DIR}/implement.jsonl` and `{TASK_DIR}/check.jsonl` (already exist).

**Format**: one JSON object per line — `{"file": "<path>", "reason": "<why>"}`. Paths are repo-root relative.

**What to put in**:
- **Spec files** — `.omtre/spec/<package>/<layer>/index.md` and any specific guideline files (`error-handling.md`, `conventions.md`, etc.) relevant to this task
- **Research files** — `{TASK_DIR}/research/*.md` that the sub-agent will need to consult

**What NOT to put in**:
- Code files (`src/**`, `packages/**/*.ts`, etc.) — those are read by the sub-agent during implementation, not pre-registered here
- Files you're about to modify — same reason

**Split between the two files**:
- `implement.jsonl` → specs + research the implement sub-agent needs to write code correctly
- `check.jsonl` → specs for the check sub-agent (quality guidelines, check conventions, same research if needed)

These manifests do not replace `implement.md`. `implement.md` is the human-readable execution plan for a complex task; jsonl files only list context files to inject or load.

**How to discover relevant specs**:

```bash
python ./.omtre/scripts/get_context.py --mode packages
```

Lists every package + its spec layers with paths. Pick the entries that match this task's domain.

**How to append entries**:

Either edit the jsonl file directly in your editor, or use:

```bash
python ./.omtre/scripts/task.py add-context "$TASK_DIR" implement "<path>" "<reason>"
python ./.omtre/scripts/task.py add-context "$TASK_DIR" check "<path>" "<reason>"
```

Delete the seed `_example` line once real entries exist (optional — it's skipped automatically by consumers).

Ready gate: both `implement.jsonl` and `check.jsonl` must contain at least one real `{"file": "...", "reason": "..."}` entry before `task.py start`. The seed `_example` row alone is not ready.

Skip this step only when both files already have real curated entries.

[/Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi, Oh My Pi, ZCode, Snow, Reasonix, Trae, Grok, Kimi Code, Devin]

[codex-inline, Kilo, Antigravity, DeepSeek Harness]

Skip this step. Context is loaded directly by the `omtre-before-dev` skill in Phase 2.

[/codex-inline, Kilo, Antigravity, DeepSeek Harness]

#### 1.4 Activate task `[required · once]`

- `[B档]` after artifact review — the user confirms — flip the task status to `in_progress`:
- `[C档]` once the artifacts below are complete, run `start` without waiting — the review becomes an after-the-fact veto:

```bash
python ./.omtre/scripts/task.py start <task-dir>
```

For lightweight tasks, `prd.md` can be enough. For complex tasks, `prd.md`, `design.md`, and `implement.md` must exist and be reviewed before start. On sub-agent-dispatch platforms, `implement.jsonl` and `check.jsonl` must both have real curated entries before start. Runtime consumers tolerate missing or seed-only manifests for compatibility, but that tolerance is not a planning-ready state.

After this command succeeds, the breadcrumb auto-switches to `[workflow-state:in_progress]`, and the rest of Phase 2 / 3 follows.

If `task.py start` errors with a session-identity message (no context key from hook input, `OMTRE_CONTEXT_ID`, or platform-native session env), follow the hint in the error to set up session identity, then retry.

#### 1.5 Completion criteria

| Condition | Required |
|------|:---:|
| `prd.md` exists | ✅ |
| `prd.md` carries a `Domain:` line (a `.omtre/domains/<slug>/` path or `none（reason）`) | ✅ |
| `[B档]` User confirms task should enter implementation; `[C档]` auto-passes (veto afterwards) | ✅ |
| `task.py start` has been run (status = in_progress) | ✅ |
| `research/` has artifacts (complex tasks) | recommended |
| `design.md` exists (complex tasks) | ✅ |
| `implement.md` exists (complex tasks) | ✅ |

[Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi, Oh My Pi, ZCode, Snow, Reasonix, Trae, Grok, Kimi Code, Devin]

| `implement.jsonl` and `check.jsonl` each contain at least one real curated entry (seed row does not count) | ✅ |

[/Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi, Oh My Pi, ZCode, Snow, Reasonix, Trae, Grok, Kimi Code, Devin]

---

## Phase 2: Execute

Goal: turn reviewed planning artifacts into code that passes quality checks.

#### 2.1 Implement `[required · repeatable]`

[Claude Code, Cursor, OpenCode, codex-sub-agent, CodeBuddy, Droid, Pi, ZCode, Snow, Oh My Pi]

Spawn the implement sub-agent:

- **Agent type**: `omtre-implement`
- **Task description**: Implement the reviewed task artifacts, consulting materials under `{TASK_DIR}/research/`; finish by running project lint and type-check
- **Dispatch prompt guard**: The prompt MUST start with `Active task: <task path>`, then include the restate-first line — "After reading the task files, restate your task understanding in one line (task / domain / flag status / next step) before making any change" — then tell the spawned agent it is already the `omtre-implement` sub-agent and must implement directly, not spawn another `omtre-implement` / `omtre-check`.

The platform hook/plugin auto-handles:
- Reads `implement.jsonl` and injects referenced spec/research files into the agent prompt
- Injects `prd.md`, `design.md` if present, and `implement.md` if present
- For Codex, `SubagentStart` supplies native context injection; the agent profile keeps child-side loading as the fallback

[/Claude Code, Cursor, OpenCode, codex-sub-agent, CodeBuddy, Droid, Pi, ZCode, Snow, Oh My Pi]

[Gemini, Qoder, Copilot, Reasonix, Trae, Grok, Kimi Code]

Spawn the implement sub-agent:

- **Agent type**: `omtre-implement`
- **Task description**: Implement the reviewed task artifacts, consulting materials under `{TASK_DIR}/research/`; finish by running project lint and type-check
- **Dispatch prompt guard**: The prompt MUST start with `Active task: <task path>`, then include the restate-first line — "After reading the task files, restate your task understanding in one line (task / domain / flag status / next step) before making any change" — then explicitly say the spawned agent is already `omtre-implement` and must implement directly without spawning another `omtre-implement` / `omtre-check`.

The pull-based sub-agent definition auto-handles the context load requirement:
- Resolves the active task with `task.py current --source`, then reads `prd.md`, `design.md` if present, and `implement.md` if present
- Reads `implement.jsonl` and requires the agent to load each referenced spec/research file before coding

[/Gemini, Qoder, Copilot, Reasonix, Trae, Grok, Kimi Code]

[Kiro]

Spawn the implement sub-agent:

- **Agent type**: `omtre-implement`
- **Task description**: Implement the reviewed task artifacts, consulting materials under `{TASK_DIR}/research/`; finish by running project lint and type-check
- **Dispatch prompt guard**: Tell the spawned agent it is already the `omtre-implement` sub-agent and must implement directly, not spawn another `omtre-implement` / `omtre-check`. Include the restate-first line — "After reading the task files, restate your task understanding in one line (task / domain / flag status / next step) before making any change".

The platform prelude auto-handles the context load requirement:
- Reads `implement.jsonl` and injects referenced spec/research files into the agent prompt
- Injects `prd.md`, `design.md` if present, and `implement.md` if present

[/Kiro]

[Devin]

Dispatch the implement sub-agent via `run_subagent` (profile `subagent_general`, foreground — the main session waits for the report):

- **Agent type**: `omtre-implement` — role card `.omtre/agents/implement.md` (the same file the channel runtime loads).
- **Task description**: Implement the reviewed task artifacts, consulting materials under `{TASK_DIR}/research/`; TDD red→green per the role card; finish by running the full test suite plus lint/type-check.
- **Dispatch prompt guard**: The `task` prompt MUST start with `Active task: <task path>`, then the restate-first line — "After reading the task files, restate your task understanding in one line (task / domain / flag status / next step) before making any change" — then say: "You are the `omtre-implement` sub-agent. Read `.omtre/agents/implement.md` and follow it exactly. Implement directly — do not spawn further sub-agents."
- **Context mode is agent-pull**: Devin has no prompt-rewriting hook, so the card makes the child read `implement.jsonl` + `prd.md` / `design.md` / `implement.md` itself — this is why step 1.3 curation is required, not optional.
- The main session does not edit product code in Phase 2 — it dispatches and relays the sub-agent's report.

[/Devin]

[codex-inline, Kilo, Antigravity, DeepSeek Harness]

1. Load the `omtre-before-dev` skill to read project guidelines
2. Read `{TASK_DIR}/prd.md`, then `design.md` if present, then `implement.md` if present
3. Consult materials under `{TASK_DIR}/research/`
4. Implement the code per reviewed artifacts
5. Run project lint and type-check

[/codex-inline, Kilo, Antigravity, DeepSeek Harness]

#### 2.2 Quality check `[required · repeatable]`

[Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi, Oh My Pi, ZCode, Snow, Reasonix, Trae, Grok, Kimi Code]

Spawn TWO `omtre-check` sub-agents in parallel — one per axis. Card resolution is per axis and fail-closed: prefer `.omtre/agents/check.standards.md` / `.omtre/agents/check.spec.md` when the sub-card exists (the axes may run on different executors), else fall back to `.omtre/agents/check.md`. A missing `check` card is an error — never substitute an unrelated card.

- **Worker 1 — `Axis: standards`** (writable): review all code changes against `.omtre/spec/` standards; fix mechanical findings directly; run the repo's lint / typecheck / tests to verify.
- **Worker 2 — `Axis: spec`** (read-only): review all code changes against `prd.md`, `design.md` if present, and `implement.md` if present; report findings only, never edit files.
- **Dispatch prompt guard**: each prompt MUST start with `Active task: <task path>` and an `Axis: standards` / `Axis: spec` line, then the restate-first line — "After reading the task files, restate your task understanding in one line (task / domain / flag status / next step) before making any change" — then tell the spawned agent to read its resolved card file (`.omtre/agents/check.<axis>.md` if present, else `.omtre/agents/check.md`), that it is already the `omtre-check` sub-agent on that axis and must review directly, not spawn another `omtre-check` / `omtre-implement`.

Collect both reports and present them side by side — never merge or re-rank findings across axes.

[/Claude Code, Cursor, OpenCode, codex-sub-agent, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid, Pi, Oh My Pi, ZCode, Snow, Reasonix, Trae, Grok, Kimi Code]

[Devin]

Dispatch TWO check sub-agents via `run_subagent` (profile `subagent_general`, `is_background=true` on both so they run in parallel), then collect each report with `read_subagent` (`block=true`):

- **Agent type**: `omtre-check` — the `Axis:` parameter selects which review runs. Card resolution per axis: `.omtre/agents/check.standards.md` / `.omtre/agents/check.spec.md` win over `.omtre/agents/check.md` when present; a missing `check` card is an error, not a reason to improvise.
- **Worker 1 (`Axis: standards`, writable) task prompt**: starts `Active task: <task path>`, then the restate-first line — "After reading the task files, restate your task understanding in one line (task / domain / flag status / next step) before making any change" — then: "You are the `omtre-check` sub-agent on axis `standards`. Read `.omtre/agents/check.standards.md` if it exists, else `.omtre/agents/check.md`, and follow it exactly for your axis — you are writable: fix mechanical issues and run the repo's verification. Do not spawn further sub-agents."
- **Worker 2 (`Axis: spec`, read-only) task prompt**: same shape — `Active task:` line, restate-first line, axis `spec`, resolved card `check.spec.md` else `check.md` — "you are READ-ONLY: report findings, never edit files. Do not spawn further sub-agents."
- **Aggregate**: the main session places the two reports side by side under `## Standards` / `## Spec` — never merge or re-rank findings across axes — and relays them to the user; open design/judgment findings come back to the user. It does not review or fix inline.

[/Devin]

[codex-inline, Kilo, Antigravity, DeepSeek Harness]

Load the `omtre-check` skill and verify the code per its guidance:
- Spec compliance
- lint / type-check / tests
- Cross-layer consistency (when changes span layers)

If issues are found → fix → re-check, until green.

[/codex-inline, Kilo, Antigravity, DeepSeek Harness]

**Channel runtime note**: workers spawned via `omtre channel spawn --agent check` take their axis from an `Axis:` line in the spawn task text; an unmarked `check` spawn falls back to running both axes serially (the card's default). To pin an axis on its own card, spawn `--agent check.standards` / `--agent check.spec` when those files exist — the CLI resolves `check.<axis>` → falls back to `check` (see `agent-loader.ts` `resolveCheckAxisCard`).

**Final pass (before Phase 3.4 commit)**: the last 2.2 of a task must run full-scope, not just on the latest implement chunk. List all affected packages with `python ./.omtre/scripts/get_context.py --mode packages`, then load each package's spec index Quality Check section. This catches cross-layer / multi-package issues a mid-iteration local 2.2 cannot.

#### 2.3 Rollback `[on demand]`

- `check` reveals a prd defect → return to Phase 1, fix `prd.md`, then redo 2.1
- Implementation went wrong → revert code, redo 2.1
- Need more research → research (same as Phase 1.2), write findings into `research/`

---

## Phase 3: Finish

Goal: ensure code quality, capture lessons, record the work.

#### 3.2 Debug retrospective `[on demand]`

If this task involved repeated debugging (the same issue was fixed multiple times), load the `omtre-break-loop` skill to:
- Classify the root cause
- Explain why earlier fixes failed
- Propose prevention

The goal is to capture debugging lessons so the same class of issue doesn't recur.

#### 3.3 Spec update `[required · once]`

Load the `omtre-update-spec` skill and review whether this task produced new knowledge worth recording:
- Newly discovered patterns or conventions
- Pitfalls you hit
- New technical decisions

Update the docs under `.omtre/spec/` accordingly. Even if the conclusion is "nothing to update", walk through the judgment.

#### 3.4 Commit changes `[required · once]`

**Spec-sync preamble**: before drafting commits, ask: did this task fix a bug or surface non-obvious knowledge that should land in `.omtre/spec/` so future-you (or future-AI) doesn't repeat the mistake? If yes, return to Phase 3.3 first — spec writes belong in the same task's commit batch, not as a forgotten follow-up.

The AI drives a batched commit of this task's code changes so `/finish-work` can run cleanly afterwards. Goal: produce work commits FIRST, then bookkeeping (archive + journal) commits land after — never interleaved.

**Step-by-step**:

1. **Inspect dirty state**:
   ```bash
   git status --porcelain
   ```
   Snapshot every dirty path. If the working tree is clean, skip to 3.5.

2. **Learn commit style** from recent history (so drafted messages blend in):
   ```bash
   git log --oneline -5
   ```
   Note the prefix convention (`feat:` / `fix:` / `chore:` / `docs:` ...), language (中文/English), and length style.

3. **Classify dirty files into two groups**:
   - **AI-edited this session** — files you wrote/edited via Edit/Write/Bash tool calls in this session. You know what changed and why.
   - **Unrecognized** — dirty files you did NOT touch this session (could be the user's manual edits, leftover WIP from a previous session, or unrelated work). **Unrecognized files NEVER enter any commit — in every autonomy tier.** List them separately instead.

4. **Draft a commit plan**. Group AI-edited files into logical commits (1 commit per coherent change unit, not 1 commit per file). Each entry: `<commit message>` + file list. List unrecognized files separately at the bottom.

5. `[B档]` **Present the plan once, ask for one-shot confirmation**. `[C档]` Execute the plan directly — still list it in your report so the user can revert afterwards. Format:
   ```
   Proposed commits (in order):
     1. <message>
        - <file>
        - <file>
     2. <message>
        - <file>

   Unrecognized dirty files (NOT in any commit — confirm include/exclude):
     - <file>
     - <file>

   Reply 'ok' / '行' to execute. Reply with edits, or '我自己来' / 'manual' to abort.
   ```

6. `[B档]` **On confirmation**: run `git add <files>` + `git commit -m "<msg>"` for each batch in order. `[C档]` Run the same batches immediately, no confirmation wait. Either way: do not amend. Do not push.

7. **On rejection** (user replies "不行" / "我自己来" / "manual" / any pushback on the plan): stop. Do not attempt a second plan. The user will commit by hand; you skip ahead to 3.5 once they confirm.

**Rules**:
- No `git commit --amend` anywhere — three-stage three-commit flow (work commits → archive commit → journal commit).
- Never push to remote in this step — pushing belongs to the `/omt:finish-work` bookkeeping pass.
- If the user wants different message wording but accepts the file grouping, edit the message and re-confirm once — but if they reject the grouping, exit to manual mode.
- The batched plan is one prompt; do not prompt per commit.

#### 3.5 Wrap-up reminder

- `[B档]` After the above, remind the user they can run `/finish-work` to wrap up (archive the task, record the session, push if a remote exists).
- `[C档]` Run `/finish-work` yourself once commits are clean, then report the archive + journal + push result; the user can veto afterwards.

---

## Customizing Omtre (for forks)

This section is for developers who want to modify the Omtre workflow itself. All customization is done by editing this file; the scripts are parsers only.

### Changing what a step means

Edit the corresponding step's walkthrough body in the Phase 1 / 2 / 3 sections above. Critical invariants:
- No active task must triage first; task creation is routed to a domain in the same step and gated by consent only under `[B档]` (`autonomy: gated`).
- Planning must distinguish lightweight PRD-only tasks from complex tasks that require `prd.md`, `design.md`, and `implement.md` before start.
- Every required execution path must keep the Phase 3.4 commit reminder reachable before `/omt:finish-work`.

All tag blocks live in the `## Phase Index` section above, immediately after each phase summary:

| Scope | Corresponding tag |
|---|---|
| No active task (before Phase 1) | `[workflow-state:no_task]` (after the Phase Index ASCII art) |
| Active task record unreadable | `[workflow-state:task_error]` (repair the existing task before continuing) |
| All of Phase 1 (task created → ready for implementation) | `[workflow-state:planning]` (after Phase 1 summary) |
| Codex inline Phase 1 | `[workflow-state:planning-inline]` |
| Phase 2 + Phase 3.2–3.4 (implementation + check + wrap-up) | `[workflow-state:in_progress]` (after Phase 2 summary) |
| Codex inline Phase 2 + Phase 3.2–3.4 | `[workflow-state:in_progress-inline]` |
| After Phase 3.5 (archived) | back to `[workflow-state:no_task]`; the Python hook appends a computed `next: <frontier head>` line — the re-entry pointer |

### Changing the per-turn prompt text

Directly edit the body of the corresponding `[workflow-state:STATUS]` block. After editing, run `omtre update` (if you're a template maintainer) or restart your AI session (if you're customizing your own project) — no script changes required.

### Adding a custom status

Add a new block:

```
[workflow-state:my-status]
your per-turn prompt text
[/workflow-state:my-status]
```

Constraints:
- STATUS charset: `[A-Za-z0-9_-]+` (underscores and hyphens allowed, e.g. `in-review`, `blocked-by-team`)
- A lifecycle hook must write `task.json.status` to your custom value, otherwise the tag is never read
- Lifecycle hooks live in `task.json.hooks.after_*` and bind to one of `after_create / after_start / after_finish / after_archive`

### Adding a lifecycle hook

Add a `hooks` field to your `task.json`:

```json
{
  "hooks": {
    "after_finish": [
      "your-script-or-command-here"
    ]
  }
}
```

Supported events: `after_create / after_start / after_finish / after_archive`. Note that `after_finish` ≠ a status change (it only clears the active-task pointer); use `after_archive` for "task is done" notifications.

### Where the state comes from

- Parsers — `inject-workflow-state.py` (Python platforms; installed as a hook, e.g. `.claude/hooks/`, `.codex/hooks/`) and `inject-workflow-state.js` (OpenCode, `.opencode/plugins/`). Both read this file only — no fallback bodies live in the scripts.
- Writers — task status goes through `task.py` (`.omtre/scripts/common/task_store.py`); the active-task pointer lives under `.omtre/.runtime/` (`.omtre/scripts/common/active_task.py`).
- Pseudo-statuses — `no_task`, `task_error`, and `stale_<source_type>` come from the active-task pointer, not from `task.json.status`.
- Deeper customization — custom statuses, lifecycle hooks, writer details: bundled `omtre-meta` skill, `references/customize-local/`.
