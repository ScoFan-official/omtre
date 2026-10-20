---
name: omtre-start
description: "Initializes an AI development session by reading workflow guides, developer identity, git status, active tasks, and project guidelines from .omtre/. Classifies incoming tasks and routes to brainstorm, direct edit, or task workflow. Use when beginning a new coding session, resuming work, starting a new task, or re-establishing project context."
---

# Start Session

Initialize an OMTRE-managed development session. This platform has no session-start hook, so manually load the equivalent compact context by following these steps.

---

## Step 1: Current state
Identity, git status, current task, active tasks, journal location.

```bash
python ./.omtre/scripts/get_context.py
```

If this output includes a line beginning `OMTRE update available:`, copy the full line verbatim when summarizing session context. Do not shorten operational command hints.

## Step 2: Workflow overview
Compact Phase Index, request triage rules, planning artifact contract, and the step-detail command.

```bash
python ./.omtre/scripts/get_context.py --mode phase
```

Full guide in `.omtre/workflow.md` (read on demand).

## Step 3: Guideline indexes
Discover packages + spec layers, then read each relevant index file.

```bash
python ./.omtre/scripts/get_context.py --mode packages
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
  python ./.omtre/scripts/get_context.py --mode phase --step 2.1 --platform codex
  ```
- **No active task** → classify first. `[B档]` ask whether this turn should create an OMTRE task (and for complex work, whether to enter planning); `[C档]` create it directly when warranted. Creating a task also routes it to a domain — see `.omtre/workflow.md` step 1.0.

### Domain handover read chain (接手读档链)

Pick the tier matching how this session came to own the work — it runs in both autonomy modes (information step, not an approval gate):

- **Same-session continuation** → skip the chain; context is already in hand.
- **New session, domain task** (`meta.domain` in `task.json`, or `Domain: .omtre/domains/<slug>/` in `prd.md`) → run the FULL chain below, then output the five-line restatement.
- **New session, domain-less task** (`Domain: none` in `prd.md`) → light chain: task artifacts (`prd.md` / `implement.md`) + journal summary; no domain reads.
- **Cross-writer takeover** (the domain flag is someone else's, or a different machine/writer) → full chain + stale-flag three-anchor check per `.omtre/domains/DISCIPLINE.md` §2.

Full chain — read in order:

1. `.omtre/domains/REGISTRY.md` — locate the owning domain.
2. `.omtre/domains/<slug>/README.md` — first-line flag + `## 进度` table.
3. `BOUNDARY.md` — registered rulings.
4. `NN-*` docs — `状态:已定版` entries first.
5. `worklog/` — grep the domain for `[~]`/`[!]`/`🔄`/`⛔` markers to anchor in-flight work.
6. Output the five-line restatement — any item missing = handoff incomplete, do not start work:
   - current task directory + `status`
   - domain ownership: `meta.domain` slug or `Domain: none（reason）`
   - flag status per affected domain: none / own / another writer's (who + since when + disposition)
   - latest worklog entry ID + `git merge-base --is-ancestor <hash> HEAD` verification of its referenced commit
   - next action, one line

Reconciliation priority (fixed): git history > worklog entries > README `## 进度` — journal is session narrative and does not participate. `omtre mem` is optional background only — never a substitute for the chain, never a fact source.

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
