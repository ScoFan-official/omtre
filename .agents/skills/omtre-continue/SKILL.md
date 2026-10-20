---
name: omtre-continue
description: "Resume work on the current task. Loads the workflow Phase Index, figures out which phase/step to pick up at, then pulls the step-level detail via get_context.py --mode phase. Use when coming back to an in-progress task and you need to know what to do next."
---

# Continue Current Task

Resume work on the current task — pick up at the right phase/step in `.omtre/workflow.md`.

---

## Step 1: Load Current Context

```bash
python ./.omtre/scripts/get_context.py
```

Confirms: current task, git state, recent commits.

## Step 2: Load the Phase Index

```bash
python ./.omtre/scripts/get_context.py --mode phase
```

Shows the Phase Index (Plan / Execute / Finish) with routing + skill mapping.

## Step 3: Decide Where You Are

`get_context.py` shows the active task's `status` field. Route by `status` + artifact presence. This command replaces the user needing to remember the OMTRE flow; it does not itself approve implementation.

- `status=planning` + no `prd.md` → **1.1** (load `omtre-brainstorm`)
- `status=planning` + `prd.md` only → decide whether the task is lightweight or complex. Lightweight can move to **1.4** review; complex returns to **1.1** to add `design.md` + `implement.md`.
- `status=planning` + complex artifacts complete + sub-agent jsonl not curated (empty, or only a legacy `_example` placeholder row) → **1.3**
- `status=planning` + required artifacts complete + required jsonl curated or inline mode → **1.4** (`[B档]` ask for start review first; `[C档]` run `task.py start` directly)
- `status=in_progress` + implementation not started → **2.1**
- `status=in_progress` + implementation done, not yet checked → **2.2**
- `status=in_progress` + check passed → **3.3** (spec update) → **3.4** (commit — `[B档]` confirm plan once; `[C档]` execute and report)
- `status=completed` (rare; usually archived immediately) → archive flow

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

Phase rules (full detail in `.omtre/workflow.md`):

1. Run steps **in order** within a phase — `[required]` steps must not be skipped
2. `[once]` steps are already done if the required output exists. `prd.md` alone can be enough only for lightweight tasks; complex tasks also need `design.md` and `implement.md`.
3. You may go back to an earlier phase if discoveries require it

## Step 4: Load the Specific Step

Once you know which step to resume at:

```bash
python ./.omtre/scripts/get_context.py --mode phase --step <X.X> --platform codex
```

Follow the loaded instructions. After each `[required]` step completes, move to the next.

---

## Reference

Full workflow and detailed phase steps live in `.omtre/workflow.md`. This command is only an entry point — the canonical guidance is there.
