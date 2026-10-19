---
name: mp-omtre-bridge
description: "Bridge contract between mattpocock engineering skills and an omtre-managed repo. Load before running /to-spec, /to-tickets, /triage, /wayfinder, /implement, whenever a mattpocock skill mentions 'the issue tracker', tickets, labels, or triage roles, or when the user asks for an unattended run (无人值守 / 放手跑 / hands-off 跑). Requires .omtre/."
---

# mattpocock × omtre bridge

In an omtre-managed repo, **"the issue tracker" IS the omtre task system**. The contract lives at `.omtre/spec/agents/issue-tracker.md` (spec → task dir + `prd.md`/`design.md`/`implement.md`; ticket → child task + `blocked_by` refs; triage role → `task.json` meta key; wayfinder map → parent task + `map.md`). Read it before publishing anything a mattpocock skill produces. `.scratch/` is only the triage inbox and scratch space — planned work never lives there.

## First-run setup (bootstrap)

If `.omtre/spec/agents/issue-tracker.md` is missing, run setup once before using the engineering skills:

1. **Verify omtre**: `.omtre/scripts/task.py` must exist. If not, stop and tell the user — this bridge only works in omtre-managed repos.
2. **Install the spec contracts** — two ways, pick the first that works:
   - Preferred: `omtre init --registry gh:ScoFan-official/omtre/marketplace --template agent-workflow --append` (installs the `agents/` + `guides/` spec contracts; the session-start hook injects the packages' `index.md` files, and the agent reads the contracts from those indexes). `--append` adds missing files only — safe on existing `.omtre/spec/` trees.
   - Fallback: copy `templates/issue-tracker.md`, `templates/triage-labels.md`, `templates/domain.md`, `templates/frontend-craft.md`, `templates/index.md` from this skill's directory into `.omtre/spec/agents/` (create the directory; skip files that already exist and report each skip).
   - Then make the guides index point at the guide: if `.omtre/spec/guides/mp-integration.md` exists, ensure `.omtre/spec/guides/index.md` carries a `- \`mp-integration.md\`` pointer — append the line when the file exists without it, create it with a `# Guides` heading when it doesn't. Never rewrite an existing index: the guides index is project-owned.
3. **Register the block**: append an `## Agent skills` section to `AGENTS.md` — strictly outside any `OMTRE:START`/`OMTRE:END` markers. Skip if the section already exists; create `AGENTS.md` with just that section if the file is missing. Use the block template below.
4. **Check the skill set**: look for mattpocock skills (`grill-with-docs`, `to-spec`) and `impeccable` in this agent's skills directory. If the mp skills are absent, tell the user to run `npx skills add mattpocock/skills --agent <their-platform> --copy`; if `impeccable` is absent, `python <pack>/scripts/install.py --platform <platform> --target . --component imp:impeccable` — the bridge is a contract layer, not the skills.
5. **Optional hooks**: automation examples live in this skill's own `hooks/` directory. They wire into `.omtre/config.yaml`'s `hooks:` section or per-task `task.json` hooks. Do not edit `config.yaml` unprompted.
6. **Full asset catalog**: the pack repo also vendors mattpocock + Everything-Claude-Code assets (1,700+: skills/sub-agents/commands/MCPs). Install any subset for 22 platforms via `python <pack>/scripts/install.py --platform <platform> --target <repo>`; see the pack README.

Report what was created/skipped, then continue with whatever invoked this skill.

## AGENTS.md block template

```markdown
## Agent skills

### Issue tracker

The tracker IS the omtre task system: specs/tickets land in `.omtre/tasks/` (spec → task dir + `prd.md`; ticket → child task + `blocked_by` refs). `.scratch/inbox/` holds raw inbound items awaiting triage. See `.omtre/spec/agents/issue-tracker.md`.

### Triage labels

Five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) as task `meta.triage` values. See `.omtre/spec/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` + `docs/adr/` at repo root, created lazily by `/domain-modeling`. See `.omtre/spec/agents/domain.md`.

### Frontend craft

The `impeccable` skill is the design toolchain; its PRODUCT.md/DESIGN.md live at `.omtre/spec/product.md` and `.omtre/spec/design-system.md`. Frontend tasks are gated: `implement.md` needs a `## Design review` section (audit/critique/polish results) before verification can record READY. See `.omtre/spec/agents/frontend-craft.md`.
```

## Lane rules

- **Active omtre task** → the omtre pipeline owns the phase; mp skills run inside steps (grilling inside `omtre-brainstorm`, `tdd` inside implementation, mp `code-review` after `omtre-check`). Do not let an mp skill create new tasks mid-flight without telling the user.
- **No active task, quick work** → standalone mp lane: grill → implement → code-review, no omtre task needed. If the work grows past one session, promote it: `/to-spec` → `/to-tickets`, which land in `.omtre/tasks/`.
- **Promotion boundary**: `.scratch/inbox/` items become real tasks only when triage lands `ready-for-agent`.

## Unattended-run handoff (dispatch-roster)

When a planning lane lands artifacts destined for agent execution, close with one question — **「要无人值守跑吗？」**:

- `wayfinder` — after the board map (parent task + `map.md`) is written and the child tickets exist.
- `grill-with-docs` — after the converged spec/PRD sits in a task that is ready for implementation.
- `to-tickets` — after the split lands child tasks with `blocked_by` refs.
- `omtre-brainstorm` — after the user approves the final planning summary (the same rule lives in that skill's close-out).

Yes → load `dispatch-roster` (probe → four decisions → summary → roster on disk). No or anything else → continue the normal interactive lane. `dispatch-roster` ends at roster-on-disk; `omtre-run` owns the launch. Do not ask when nothing produced agent-bound tickets — standalone quick-lane work is not roster material.

Keywords — 「无人值守」「放手跑」「hands-off 跑」/ unattended — load `dispatch-roster` directly at any point, no gate. A verbal request outranks lane position: asking again is wrong when the user already said it.

## Skill precedence on name collisions

- Inside a task: prefer `.agents/skills/` omtre variants (`feature-development`, `tdd-workflow`, `verification-loop`) — they read `prd.md` and acceptance items.
- Outside tasks: the mattpocock versions.
- `omtre-check` and mp `code-review` are complementary: check = spec/lint/tests; review = two-axis (Standards + Spec) diff analysis.
