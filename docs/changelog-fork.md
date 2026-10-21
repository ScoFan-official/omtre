# Changelog — oh-my-trellis (fork of mindfold-ai/trellis)

Versions are `UPSTREAM_BASE-ohmy.N`: the suffix increments for our changes on a given upstream base; syncing to a new upstream release resets `-ohmy.N` to `-ohmy.1`.

## 0.6.17-ohmy.4

- `update-spec` template: "Recurring Mechanical Mistake" now prefers a
  deterministic guardrail (lint rule / hook / CI check) over spec text —
  mp `retro` discipline: mistakes a tool can catch should be made
  impossible, not just documented.

## 0.6.17-ohmy.3

Parallel dual-axis check — Phase 2.2 now runs `trellis-check` as two
concurrent workers so the axes don't pollute each other (mattpocock
canonical `code-review` pattern).

- `trellis/agents/check.md` gains an `Axis:` contract: the dispatch prompt
  declares `Axis: standards` or `Axis: spec`; a bare spawn / legacy dispatch
  with no axis still runs both axes serially (backward compatible).
- `Axis: standards` is **writable** — mechanical self-fix + full repo
  verification, reports `### Standards`. `Axis: spec` is **READ-ONLY** —
  reports `### Spec` findings, never edits files or runs verification.
- `workflow-oh-my.md` 2.2: `[Devin]` dispatches two `run_subagent` calls
  (`is_background=true`) and collects both reports via `read_subagent`;
  the generic sub-agent block uses the same two-worker pattern; channel
  note records the spawn-task `Axis:` convention. Reports are aggregated
  side by side, never merged across axes.

## 0.6.17-ohmy.2

Single-repo surface revision — `ScoFan-official/oh-my-trellis` is now THE
user-facing repo; the fork is source/build workspace only.

- Update surface repointed: `trellis update` version check and
  `trellis upgrade` now read `ScoFan-official/oh-my-trellis` releases
  filtered to `cli-v*` tags (the pack's own `vX.Y.Z` releases share the list,
  so `/releases/latest` is never used). `--tag` accepts `0.6.17-ohmy.N`,
  `v…`, or `cli-v…` spellings.
- Fixed the comparator wart: `0.6.17-ohmy.N` on base `0.6.17` no longer
  reports "older than project 0.6.17" — same-base `X.Y.Z-ohmy.N` ranks >=
  `X.Y.Z` (new `compareOhmyVersions`; mirrored in `session_context.py`'s
  update hint).
- `oh-my-update` workflow template: check/install URLs moved to
  oh-my-trellis `cli-v*` releases; registry flag aligned to repo-root
  `-r gh:ScoFan-official/oh-my-trellis`.
- Fork-hosted releases deprecated: `.github/workflows/release.yml` is now
  `workflow_dispatch`-only; canonical artifacts publish from oh-my-trellis
  `cli-v*` tags (its `cli-release.yml` clones this fork at the matching
  `v*` tag, builds, packs and creates the release).

## 0.6.17-ohmy.1

Upstream base: `v0.6.17` (tagged `upstream-0.6.17`, commit `833a5846`).

- Devin Phase 2 (`implement`/`check`) runs as `run_subagent` dispatches, main session orchestrates only — new `oh-my` workflow template (managed default) with `[Devin]` dispatch blocks.
- `.trellis/agents/{implement,check}.md` ship mattpocock-flavored role cards (TDD red-green, Standards+Spec two-axis review).
- `.devin` counts as a sub-agent platform in `task_store.py` (JSONL manifests seeded at create, `start` gate applies).
- Devin templates: updated `trellis-start` routing table, `trellis-check` dispatch note, new `oh-my-update` workflow (release-check → summary → confirm → `npm i -g` → `trellis update` → `npx skills add`).
- CLI identity: package `oh-my-trellis`, bins `trellis` + `oh-my-trellis`, update/upgrade checks `ScoFan-official/trellis` GitHub releases.
- Default spec/workflow source points at `gh:ScoFan-official/oh-my-trellis` (repo root; `--registry` explicit form unchanged).
- `docs/fork-sync.md` upstream-sync runbook; `publish.yml` dormant (workflow_dispatch only).
