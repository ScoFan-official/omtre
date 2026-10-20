# Journal - taosu (Part 5)

> Continuation from `journal-4.md` (archived at ~2000 lines)
> Started: 2026-04-30

---



## Session 138: Workflow-state breadcrumb SoT collapse + commit step + auto-active create

**Date**: 2026-04-30
**Task**: Workflow-state breadcrumb SoT collapse + commit step + auto-active create
**Branch**: `feat/v0.5.0-beta`

### Summary

Converged the workflow-state breadcrumb subsystem to workflow.md as single source of truth. R1+R2 added Phase 3.4 commit and Phase 1.3 jsonl curation enforcement to the relevant tag bodies; R5 deleted _FALLBACK_BREADCRUMBS dicts in py + js so drift is structurally impossible (load_breadcrumbs returns {} on miss; build_breadcrumb falls back to 'Refer to workflow.md'); R4 added per-tag managed-block migration in update.ts so existing user projects pick up new tags via trellis update; R7 made task.py create auto-set the session active-task pointer (best-effort + graceful degrade) so [workflow-state:planning] is reachable during brainstorm + jsonl curation; R8 rewrote /omt:continue Step 3 to route by task.json.status + artifact presence including 1.4 Activate; R6 added new spec at .omtre/spec/cli/backend/workflow-state-contract.md documenting marker syntax / parser-strip backreference invariant / runtime contract / status writer table / lifecycle ≠ status / reachability matrix / hook reachability / custom statuses. omtre-check found 6 nits/observations; landed Findings 1 (parser/strip regex backreference parity in 4 hook scripts + 4 runtime mirrors) + 2 (E2E legacy migration test) + 3 (no_task/completed presence tests) + 6 (create→start idempotency test). 783 → 788 tests passing; lint/typecheck/build all clean. Out of scope (tracked as follow-up): docs-site architecture page sync, omtre-meta SKILL.md update, stale omtre-update-spec/SKILL.md:345 reminder, vestigial 'done' status reader cleanup.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `ad49153` | (see git log) |
| `c52ece2` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 139: fix opencode omtre-research persist (#211)

**Date**: 2026-05-01
**Task**: fix opencode omtre-research persist (#211)
**Branch**: `feat/v0.5.0-rc`

### Summary

Rewrote opencode omtre-research agent template to grant write/edit permission and added the cursor/claude shared body (PERSIST + Workflow + Scope Limits). Extended the existing 'research agent persists findings' regression test to cover opencode (the missing platform that masked the drift). 789/789 vitest, lint, tsc clean. Closes #211.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `fd32162` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 140: regression test for opencode plugin export shape (#212)

**Date**: 2026-05-01
**Task**: regression test for opencode plugin export shape (#212)
**Branch**: `feat/v0.5.0-rc`

### Summary

Added regression test asserting every .opencode/plugins/*.js file has exactly one top-level export and that it is 'export default'. Backfills the missing test for dc2bea3's #212 fix — without this, anyone adding a named export to a plugin file would silently break opencode plugin loading. 792/792 vitest, lint, tsc clean. Manually verified the test catches a probe 'export const X = 1'.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `5e938d9` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 141: trellis uninstall command (#221)

**Date**: 2026-05-02
**Task**: trellis uninstall command (#221)
**Branch**: `feat/v0.5.0-rc`

### Summary

Added trellis uninstall: manifest-driven removal of all trellis assets + .omtre/ directory. Two-column listing (deleted/modified) + Continue? [Y/n] default Y; --yes / --dry-run options. Four scrubbers preserve user-added fields in 11 structured config files (claude/gemini/factory/codebuddy/qoder/codex/cursor/copilot/opencode/pi/codex-toml). Token-based command matching avoids substring false positives. Cleans up empty managed root dirs after file removal. 23 new tests; 830/830 total pass.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `255d499` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 142: Fix Gemini CLI 0.40.x template compat (#224)

**Date**: 2026-05-03
**Task**: Fix Gemini CLI 0.40.x template compat (#224)
**Branch**: `feat/v0.5.0-rc`

### Summary

Three Gemini CLI 0.40.x bug fixes from issue #224: drop `tools:` line from agent frontmatter (inherit parent), rename hook event UserPromptSubmit→BeforeAgent in settings.json + platform-aware hookEventName branch in inject-workflow-state.py, move shared skills from .gemini/skills/ to .agents/skills/. Bundled `{{CMD_REF}}` neutralization (resolvePlaceholdersNeutral) so Codex+Gemini render byte-identical content in .agents/skills/. Side-fix: needsCodexUpgrade narrowed to Codex-only markers (was false-positive on Gemini's new .agents/skills/ writes). Spec updates: workflow-state-contract.md (platform-aware hookEventName), platform-integration.md (neutral-resolver rule). 847/847 tests.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `9a4c53b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 143: Fix codex sub-agent missing active task (#225)

**Date**: 2026-05-04
**Task**: Fix codex sub-agent missing active task (#225)
**Branch**: `feat/v0.5.0-rc`

### Summary

Class-2 platform sub-agents (codex/copilot/gemini/qoder) couldn't find the active task because they run in separate sessions with different session ids. Three-layer fix: prelude reads 'Active task: <path>' from dispatch prompt, workflow.md in_progress breadcrumb mandates the protocol per turn, and resolve_active_task adds single-session fallback (with new session-fallback source type). 856 tests passing.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `8a39265` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


---



## Session 144: OMTRE_HOOKS env var to disable Trellis hooks at runtime

**Date**: 2026-05-05
**Task**: Inline change — add env-var gate so hook scripts return early when host process opts out
**Branch**: `feat/v0.5.0-rc`

### Summary

Added `OMTRE_HOOKS=0` / `OMTRE_DISABLE_HOOKS=1` early-return gate to every shipped Trellis hook (5 Python templates + 3 OpenCode JS plugins) plus their dogfood copies in this repo (12 files). When either env var is set on the host CLI process, all hooks emit empty stdout / no `additionalContext` so Claude/Codex/Cursor/Copilot/OpenCode see no Trellis injection. Use cases: (a) wrapper scripts (`OMTRE_HOOKS=0 claude`) for casual chat sessions where the operator does not want the workflow breadcrumb / spec index / sub-agent context; (b) programmatic spawn of host CLIs as subprocesses where the parent orchestrator wants a clean session. Researched whether any of Claude Code / Codex / OpenCode / Cursor expose true mid-session hook toggles — none do (Claude Code has `disableAllHooks` in settings.json with file-watcher reload; Cursor has the rename-hooks.json hack; Codex / OpenCode require restart). Concluded env-var gate is the right ergonomic for this round; punted on a `.runtime/config.json` JSON toggle and `task.py hooks on|off` UX until demand is clearer. Also fixed three pre-existing regression test failures rooted in `test/setup.ts` not stripping `*_PROJECT_DIR` host-shell env vars — when a dev runs vitest from inside a Claude Code / Copilot session, those vars made the hooks read the *real* repo's `.omtre/` instead of the test tmpDir. Fix follows the SoT documented in `.omtre/spec/cli/unit-test/conventions.md` "Test Isolation" section.

### Main Changes

- `packages/cli/src/templates/shared-hooks/session-start.py` — extend existing `should_skip_injection()` with OMTRE_HOOKS / OMTRE_DISABLE_HOOKS checks
- `packages/cli/src/templates/shared-hooks/inject-workflow-state.py` — early-return at `main()` head
- `packages/cli/src/templates/shared-hooks/inject-subagent-context.py` — early-return at `main()` head
- `packages/cli/src/templates/shared-hooks/inject-shell-session-context.py` — early-return at `main()` head
- `packages/cli/src/templates/codex/hooks/session-start.py` — prepend gate to local `should_skip_injection()`
- `packages/cli/src/templates/copilot/hooks/session-start.py` — prepend gate to local `should_skip_injection()`
- `packages/cli/src/templates/opencode/plugins/session-start.js` — early-return in `chat.message` handler
- `packages/cli/src/templates/opencode/plugins/inject-workflow-state.js` — early-return in `chat.message` handler
- `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js` — early-return in `tool.execute.before` handler
- `.claude/hooks/*.py`, `.cursor/hooks/*.py`, `.codex/hooks/*.py`, `.opencode/plugins/*.js` — dogfood sync (12 files)
- `packages/cli/test/setup.ts` — delete CLAUDE_/QODER_/CODEBUDDY_/FACTORY_/CURSOR_/GEMINI_/KIRO_/COPILOT_PROJECT_DIR before tests load
- `packages/cli/test/regression.test.ts` — two new regression tests under "current-task path normalization" / end-of-file: string-level invariant (all 9 hook scripts contain the gate) + runtime integration (baseline emits content; OMTRE_HOOKS=0 / OMTRE_DISABLE_HOOKS=1 emit empty stdout)

### Git Commits

| Hash | Message |
|------|---------|
| (pending) | feat(hooks): support OMTRE_HOOKS=0 env var to disable hooks at runtime |

### Testing

- [OK] `pnpm vitest run` — 858 / 858 tests (was 853 / 856 before this work; 3 pre-existing failures fixed via test/setup.ts, +2 new OMTRE_HOOKS regression tests)
- [OK] `pnpm lint` clean
- [OK] `pnpm typecheck` clean
- [OK] `pnpm build` clean (templates copied to dist with gate verified via grep on dist/)
- [OK] Python `py_compile` on all 5 modified template `.py` files
- [OK] `node --check` on all 3 modified OpenCode `.js` plugins
- [OK] Manual smoke test: shared-hooks templates emit 0 bytes stdout when invoked with `OMTRE_HOOKS=0`

### Status

[OK] **Completed**

### Next Steps

- Optional: README / docs-site mention of the new env vars (not done — punted per "fast push" instruction)
- Optional: `.omtre/spec/cli/backend/hooks-runtime-toggle.md` documenting the env-var gate as the only supported runtime toggle and recording the upstream-CLI comparison from this session's research


---



## Session 145: Integrate mem-poc into trellis CLI as 'trellis mem' subcommand

**Date**: 2026-05-04
**Task**: Integrate mem-poc into trellis CLI as 'trellis mem' subcommand
**Branch**: `feat/v0.6.0-beta`

### Summary

Created feat/v0.6.0-beta branch and ported the mem-poc chat-history.ts POC into packages/cli as the 'trellis mem' subcommand group (projects/list/search/context/extract). Wired through commander as a passthrough; added zod ^4 dep; adapted code to Trellis ESLint rules (interface over type, no non-null assertions, 'unknown' callback return for readJsonl). All 847 existing tests pass; smoke-tested all 5 subcommands against real session data.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e1b368d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 144: Fix Codex sub-agent recursion (#234) + Cursor agent description format

**Date**: 2026-05-06
**Task**: Fix Codex sub-agent recursion (#234) + Cursor agent description format
**Branch**: `feat/v0.6.0-beta`

### Summary

Two independent sub-agent template bugs fixed. (1) Codex multi_agent_v2: SessionStart hook indiscriminately injected 'dispatch omtre-implement' into every agent session, including spawned sub-agents — they re-read it and recursively spawned another same-name sub-agent, causing the outer wrapper to stay running forever and blocking wait_agent in the main session. Upstream openai/codex#16226 (no agent-identity field in SessionStart stdin) blocks the clean A-hard fix, so applied B + A-soft: Recursion guard at the top of omtre-implement.toml / omtre-check.toml developer_instructions, plus a Sub-agent self-exemption clause in both READY-state and <guidelines> blocks of codex/hooks/session-start.py and shared-hooks/session-start.py (Audit ALL Writers — covers Claude/Cursor/Gemini/Qoder/CodeBuddy/Droid/Kiro). (2) Cursor agent UI was leaving the Description field blank for omtre-research/implement/check because their .md frontmatters used YAML block scalar 'description: |' — Cursor's parser only recognizes inline literals; collapsed all three to single-line literals, body preserved verbatim. Tests: 3 keyword-assert tests in templates/codex.test.ts, 1 in shared-hooks.test.ts, new templates/cursor.test.ts (4 tests). 869/869 vitest green, lint clean. Research persisted to research/codex-sessionstart-subagent-signals.md documenting why A-hard isn't yet feasible.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `9768b08` | (see git log) |
| `0f3c706` | (see git log) |
| `d8efcbc` | (see git log) |
| `4cf0ab8` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 146: Release 0.5.2: Python <=3.11 f-string SyntaxError hotfix in session-start hooks

**Date**: 2026-05-06
**Task**: Release 0.5.2: Python <=3.11 f-string SyntaxError hotfix in session-start hooks
**Branch**: `main`

### Summary

Hotfix on top of 0.5.1. Trellis 0.5.0-rc.6 added a Windows MSYS/Cygwin/WSL path normalizer using f-string with .replace('/', '\\') inside the expression part. PEP 498 (Python <=3.11) forbids backslashes in f-string expression parts; the file failed to parse, the hook exited code 1 before running, and the user saw 'SessionStart hook (failed) — exited with code 1'. Codex CLI 0.128 + Trellis 0.5.0 reproduced in the field. PEP 701 (Python 3.12) lifted the restriction, hiding the bug from 3.12+ developers. Fix: lifted the .replace(...) call out of each f-string expression into a local variable across 9 occurrences in codex/hooks/session-start.py, copilot/hooks/session-start.py, and shared-hooks/session-start.py (Claude Code / Cursor / Gemini CLI / Qoder / CodeBuddy / Factory Droid / Kiro). Regression coverage in test/regression.test.ts: regex scan asserts no f-string contains a backslash inside any {...} expression, plus a best-effort python3 ast.parse check. 875/875 vitest green, lint clean. Released via main → tag v0.5.2 → GitHub Actions Publish to npm workflow (completed/success, 38s); npm omtre@latest now resolves to 0.5.2.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `3f1711b` | (see git log) |
| `263c8c6` | (see git log) |
| `601f213` | (see git log) |
| `2468cb2` | (see git log) |
| `5ad1e21` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 147: Release 0.5.3: class-1 sub-agent context fallback + non-blocking task.py start

**Date**: 2026-05-06
**Task**: Release 0.5.3: class-1 sub-agent context fallback + non-blocking task.py start
**Branch**: `feat/v0.6.0-beta`

### Summary

Hotfix on top of 0.5.2 addressing two related Windows + Claude Code failure modes traced via two omtre-research dispatches. (1) Class-1 platform sub-agent context injection (claude/cursor/opencode/kiro/codebuddy/droid) goes through inject-subagent-context.py PreToolUse hook, but the hook silent-skips on Windows at v2.1.119 (upstream anthropics/claude-code#53254) and existing class-1 sub-agent definition files trusted hook to always fire (no fallback) — sub-agents ran without specs. Added marker-based dual-channel: hook prepends <!-- omtre-hook-injected --> sentinel to build_implement_prompt/build_check_prompt/build_finish_prompt outputs (success path only); each class-1 omtre-implement/omtre-check definition opens with Trellis Context Loading Protocol section that branches on marker (present → hook injected, proceed; absent → read Active task: line + Read prd.md + jsonl yourself). workflow.md dispatch protocol scope changed from class-2-only to all platforms except omtre-research. omtre-research intentionally not marker'd (decoupled from active task). class-2 platforms untouched (already use buildPullBasedPrelude). (2) task.py start hard-failed (return 1) when resolve_context_key returned None, blocking AI when CLAUDE_ENV_FILE not sourced (Windows + Claude Code, --continue resume, fork distributions). Replaced with yellow degraded-mode warning + still flips planning→in_progress + return 0; happy path byte-identical. 16 source files (1 hook + 12 sub-agent defs + workflow + task.py + 1 test) and 156 lines of regression coverage. 890/890 vitest, lint clean. Released via main → tag v0.5.3 → GitHub Actions Publish to npm.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `6272a9e` | (see git log) |
| `1adb7b0` | (see git log) |
| `5b298ba` | (see git log) |
| `a7d54ec` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 148: Workflow-state recursion guard

**Date**: 2026-05-06
**Task**: Workflow-state recursion guard
**Branch**: `feat/v0.6.0-beta`

### Summary

Hardened workflow-state and implement/check agent prompts against recursive Trellis sub-agent dispatch; updated multi-platform templates, specs, and regression tests.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `0db57e5` | (see git log) |
| `48f966e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 149: 0.5.7 release + Codex dispatch mode + mem unit tests + 0.6 beta sync

**Date**: 2026-05-08
**Task**: 0.5.7 release + Codex dispatch mode + mem unit tests + 0.6 beta sync
**Branch**: `feat/v0.6.0-beta`

### Summary

Shipped 0.5.7 with Codex configurable dispatch mode (codex.dispatch_mode=sub-agent|inline) + new configSectionsAdded manifest field (generic mechanism for future config additions, append-only / idempotent). Tracked Codex 0.129 features.codex_hooks→features.hooks rename + new /hooks TUI approval gate across docs / spec / runtime warning / uninstall scrubber. Found and fixed parser bug in trellis_config.py during dogfood (inline # comments not stripped, breaking inline-mode detection). Merged main into feat/v0.6.0-beta to bring 0.5.5/0.5.6/0.5.7 into beta. Added 84 unit tests for trellis mem command (1461 LoC POC integrated to v0.6.0-beta with 0 coverage); 81.89% statement coverage achieved; only export annotations on mem.ts (no logic edits). Vitest 1019/1019, lint+typecheck green. npm 0.5.7 published as latest tag.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `278b40a` | (see git log) |
| `b5b23fb` | (see git log) |
| `b02faf1` | (see git log) |
| `b829b14` | (see git log) |
| `1ac65c2` | (see git log) |
| `1222f36` | (see git log) |
| `c10ded7` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 150: ship 0.5.9 + 0.6.0-beta.1; fix mem --since cross-day; spec audit batches A+B+C+D

**Date**: 2026-05-08
**Task**: ship 0.5.9 + 0.6.0-beta.1; fix mem --since cross-day; spec audit batches A+B+C+D
**Branch**: `feat/v0.6.0-beta`

### Summary

Released 0.5.9 (main) and 0.6.0-beta.1 (feat/v0.6.0-beta) shipping the codex dispatch namespace fix + default inline. Restored 0.6.0-beta.0.json on main for manifest continuity. Fixed tl mem list/search --since to respect cross-day session activity (interval-overlap helper, +23 tests, 1023→1046). Ran full spec audit (48 findings); cleared all P0 + mechanical P1 (Batch A+B+C+D): script-conventions task_context init-context drop, workflow-state-contract writer-table line-number refresh, quality-guidelines + unit-test conventions init.ts:931→:1081, directory-structure tree refresh, docs-site architecture.mdx .current-task fallback claim corrected EN+ZH. Out of scope: Batch E new spec files (mem.md/update.md/uninstall.md/uninstall-scrubbers.md/configurator-shared-helpers.md), Batch F docs-site Mode taxonomy + ai-tools coverage decisions, codex perf one-sided f.until prune, readJsonlFirst streaming, residual MEMORY.md iflow notes.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `4b90152` | (see git log) |
| `89bb3a0` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 151: spec batch E: 5 new specs for uncovered modules + mem search-index-gap doc

**Date**: 2026-05-08
**Task**: spec batch E: 5 new specs for uncovered modules + mem search-index-gap doc
**Branch**: `feat/v0.6.0-beta`

### Summary

Spawned 5 parallel omtre-implement agents to author commands-mem.md (634), commands-update.md (383), commands-uninstall.md (306), uninstall-scrubbers.md (330), configurator-shared.md (309) — total 1962 lines new spec content. omtre-check single agent reviewed bundle: style consistency (all 5 mirror platform-integration.md), 10 sampled file.ts:symbolName refs all resolved, fixed 1 stale uninstall-scrubbers.md ref (performUninstall→uninstall), updated backend/index.md with 5 rows + 4 checklist lines. Added 'Search index gaps (known limitations)' section to commands-mem.md documenting that tool_use / thinking / tool_result fields are excluded from search index — users searching for tool/skill/agent names should use raw grep over JSONL. Code untouched, 1046/1046 tests pass. Local commit only — not pushed per user directive.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `d7341cb` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 152: feat: tl mem extract --phase brainstorm|implement|all (cross-day fix already in 0.6.0-beta.2)

**Date**: 2026-05-08
**Task**: feat: tl mem extract --phase brainstorm|implement|all (cross-day fix already in 0.6.0-beta.2)
**Branch**: `feat/v0.6.0-beta`

### Summary

Added --phase flag to tl mem extract for slicing session into [task.py create, task.py start) brainstorm windows. Boundary signal: regex match on Bash tool_use commands with 6+ invoker variants (python/python3/py -3/no prefix, forward/backward/double-escaped slashes, abs/rel paths) and false-positive guards. Single-pass collector emits cleaned turns + task.py events with turnIndex (necessary because the cleaning pipeline drops tool_use). Multi-task pairing: slug match > FIFO; missing-pair fallbacks. Codex/OpenCode degrade to full dialogue + stderr warning. omtre-check caught a real bug (pre-compact task.py events not reset on compaction → stale turnIndex into collapsed [compact summary] surface) and pinned a regression test. Tests: 1046 → 1079 (+33). Spec: commands-mem.md adds ## Phase slicing (--phase) section. Local commit only — not pushed.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `a16b8d9` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 153: fix(mem): OpenCode SQLite reader (1.2+ users restored, perf streaming, --phase dogfood fixes)

**Date**: 2026-05-08
**Task**: fix(mem): OpenCode SQLite reader (1.2+ users restored, perf streaming, --phase dogfood fixes)
**Branch**: `feat/v0.6.0-beta`

### Summary

Major mem.ts overhaul on feat/v0.6.0-beta. (1) Batch E new spec files (commands-{mem,update,uninstall}.md, uninstall-scrubbers.md, configurator-shared.md, +index.md). (2) Added --phase brainstorm|implement|all to mem extract with task.py create/start boundary detection. (3) Dogfood-driven robustness: shell-arg $(...) closing-paren strip, multi-task.py-per-Bash-command, prose rejection, MM-DD- prefix strip; Codex collectCodexTurnsAndEvents. (4) perf: chunked sync streaming readJsonl + byte-prefix fast-reject — list 3.5s→0.67s (5x), extract 5.8s→0.73s (8x), heap from 36MB→256KB. (5) OpenCode SQLite reader replaces obsolete JSON-tree reader: 138 sessions visible (was 0), search 0.235s on 678 messages. better-sqlite3 added as deps with createRequire bridge for ESM, pnpm.onlyBuiltDependencies for native binding install, dynamic PRAGMA schema defense, soft-degrade if dep load fails. 1085 → 1087 tests. NOT pushed per user directive.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `d7341cb` | (see git log) |
| `a16b8d9` | (see git log) |
| `a992325` | (see git log) |
| `7e8f30c` | (see git log) |
| `f26c5fd` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 154: marketplace mem-recall: add --phase brainstorm + symlink user local

**Date**: 2026-05-09
**Task**: marketplace mem-recall: add --phase brainstorm + symlink user local
**Branch**: `feat/v0.6.0-beta`

### Summary

Updated marketplace/skills/mem-recall/SKILL.md to match 0.6.0-beta.3: prereq bump, 6 new brainstorm-rationale trigger phrases, new --phase brainstorm section with 5 examples, OpenCode row → SQLite, parent_id rename. Replaced user local ~/.claude/skills/chat-history-recall (old TS POC) with symlink to marketplace mem-recall. omtre-check caught 3 Codex-as-degraded mistakes (Codex actually supports phase), fixed. commands-mem.md spec also has same stale Codex degradation table — out of scope, follow-up.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `b397638` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 155: 0.6.0-beta.4 emergency revert: drop better-sqlite3 (Windows install fix)

**Date**: 2026-05-09
**Task**: 0.6.0-beta.4 emergency revert: drop better-sqlite3 (Windows install fix)
**Branch**: `feat/v0.6.0-beta`

### Summary

0.6.0-beta.3 added better-sqlite3 dep for OpenCode SQLite reader. Windows + China-network users hit prebuild-install timeouts; node-gyp fallback needed VS2017+ (most users don't have) → Trellis itself failed to install. Emergency revert: drop the dep, OpenCode adapters return [] + one-shot stderr warning, Claude/Codex unaffected. Synced marketplace mem-recall skill + commands-mem.md spec to match. mem.ts -279 lines, package.json deps cleaned, pnpm-lock -217 lines, tests 1095→1078. Released as 0.6.0-beta.4.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `300b729` | (see git log) |
| `daba04d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 156: Task artifact routing gates

**Date**: 2026-05-10
**Task**: Task artifact routing gates
**Branch**: `feat/v0.6.0-beta`

### Summary

Implemented task artifact contracts, task-creation consent gates, compact SessionStart context, cross-platform artifact loading, and matching CLI regression coverage.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `f01c772` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 157: Harden trellis upgrade execution

**Date**: 2026-05-11
**Task**: Harden trellis upgrade execution
**Branch**: `feat/v0.6.0-beta`

### Summary

Added cross-platform command planning for trellis upgrade, routed Windows npm execution through cmd.exe, preserved POSIX shell-free spawn, and expanded npm failure/success diagnostics with tests and spec coverage.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `aa54b45` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 158: Trellis Channel Runtime — multi-agent collaboration layer

**Date**: 2026-05-12
**Task**: Trellis Channel Runtime — multi-agent collaboration layer
**Branch**: `feat/v0.6.0-beta`

### Summary

Built the trellis channel command tree: 11 subcommands, claude/codex worker adapters, supervisor with ShutdownController, project-scoped storage with legacy migration, --ephemeral lifecycle, channel run one-shot, wait --all, --agent + --file + --jsonl context injection. Hardened against spawn race / kill ladder / signal handling bugs via multi-round dogfood CR. Spec doc + agent cards added; codex multi_agent_v2 disabled now that channel owns the multi-agent surface.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `a2d3c83` | (see git log) |
| `7608c30` | (see git log) |
| `dab8e57` | (see git log) |
| `f5681a4` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 159: Core mem and forum channels

**Date**: 2026-05-14
**Task**: Core mem and forum channels
**Branch**: `feat/v0.6.0-beta`

### Summary

Added the @omtre/core/mem subpath API, converted trellis mem into a CLI wrapper, renamed channel thread-board commands to forum terminology, updated specs, and passed Trellis check review.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `3e53e17` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 160: Align Agent Artifacts

**Date**: 2026-05-15
**Task**: Align Agent Artifacts
**Branch**: `feat/v0.6.0-beta`

### Summary

Aligned platform check agent templates with the task artifact contract, added optional-artifact regression coverage, and verified the beta templates with focused/full regression tests and typecheck.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `fb7a4ed` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 161: Workflow marketplace switcher

**Date**: 2026-05-15
**Task**: Workflow marketplace switcher
**Branch**: `feat/v0.6.0-beta`

### Summary

Implemented workflow marketplace templates and trellis workflow switching, documented the workflow command/update hash contract, and archived the workflow marketplace task.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `5c27923` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 162: Channel wait supervisor warnings

**Date**: 2026-05-15
**Task**: Channel wait supervisor warnings
**Branch**: `feat/v0.6.0-beta`

### Summary

Implemented channel wait kind unions and supervisor pre-timeout warning events; split worker inbox API into a follow-up child task; updated channel command spec and tests.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `d2e72268` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 163: Worker inbox core API

**Date**: 2026-05-15
**Task**: Worker inbox core API
**Branch**: `feat/v0.6.0-beta`

### Summary

Added the core worker inbox read/watch API, documented generation-boundary semantics, covered inbox routing and limit edge cases, and completed channel-driven check review.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `86f98938` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 164: Fix Cursor sessionStart context injection

**Date**: 2026-05-15
**Task**: Fix Cursor sessionStart context injection
**Branch**: `feat/v0.6.0-beta`

### Summary

Cursor's sessionStart expects top-level additional_context, not Claude's nested hookSpecificOutput.additionalContext — the schema mismatch caused all Cursor models (including GPT) to silently miss Trellis context. Shared session-start.py now dual-emits both fields. Also dropped the no-op beforeSubmitPrompt → inject-workflow-state.py registration for Cursor (Cursor's beforeSubmitPrompt schema accepts only continue/user_message; per-turn context injection is impossible on Cursor by design). Spec updated to capture both the support-matrix change and the dual-format output contract.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `98339802` | (see git log) |
| `d7491ed2` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 165: Channel Worker OOM Guard

**Date**: 2026-05-17
**Task**: Channel Worker OOM Guard
**Branch**: `feat/v0.6.0-beta`

### Summary

Added default idle cleanup and live-worker budget controls for channel workers, with config/env/CLI overrides, supervisor idle termination, core idle projection, tests, and channel command spec updates.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e7d626b0` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 166: Core Channel Durable Idempotency

**Date**: 2026-05-17
**Task**: Core Channel Durable Idempotency
**Branch**: `feat/v0.6.0-beta`

### Summary

Added durable idempotency keys to core channel send/thread writes, documented the event-log contract, verified with channel check workers, build, and dist-based real JSONL tests.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `b645447e` | (see git log) |
| `399ef98f` | (see git log) |
| `f301155f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 167: Bundle spec bootstrap skill

**Date**: 2026-05-19
**Task**: Bundle spec bootstrap skill
**Branch**: `feat/v0.6.0-beta`

### Summary

Investigated why v0.6.0-beta.18/19 did not install omtre-spec-bootstarp after trellis init. Ported the bundled spec bootstrap skill into the beta CLI templates, added init/update tracking tests, verified the built CLI through npm pack dry-run and a fresh temp-directory init/update smoke test, documented release artifact smoke-test requirements, updated docs-site changelog notes for Codex timeout bounds, and committed Trellis local platform/template refreshes in separate batches.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `6a8a9049` | (see git log) |
| `99f87d1c` | (see git log) |
| `3a296287` | (see git log) |
| `247d85c1` | (see git log) |
| `8bed2de5` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 168: Spec maintainer audit

**Date**: 2026-06-18
**Task**: Spec maintainer audit
**Package**: cli
**Branch**: `main`

### Summary

Repaired Trellis package/spec routing, added repo and core spec indexes, fixed stale spec references, and validated drift scanner/package context.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `db07899e` | (see git log) |
| `3c2f947f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 169: filterCommands 根因修：agentCapable && !hasHooks 平台 start 输出

**Date**: 2026-06-22
**Task**: filterCommands 根因修：agentCapable && !hasHooks 平台 start 输出
**Package**: cli
**Branch**: `main`

### Summary

外部用户反馈 trellis init --zcode 后既无 /omt:start 也无 omtre-start skill。诊断：shared.ts filterCommands 当 agentCapable=true 时无条件过滤 start，但 Codex/ZCode/OpenCode/Reasonix 这 4 个 agentCapable && !hasHooks 平台没有 hook 兜底，两头空。Codex 之前用 resolveCodexTrellisStartSkill 临时补丁绕开。\n\n方案：根因修——把判定收紧为 agentCapable && hasHooks 才过滤；删 helper + 三处调用块；让标准 resolver 路径自然产出 start。配套 workflow.md 13 处平台矩阵补全（B1/B3/B5/B7/B12 + B9 加 ZCode/Reasonix，B8 排除——它写 hook auto-handles 对 pull-based 不成立，line 186 散文也补）。新增 zcode/opencode/reasonix init.integration 回归断言。\n\n净效果：删 helper + 3 处调用 + 1 处冗余断言；workflow.md 矩阵补全；3 条新测试。Tests 1249/1249 绿，typecheck 净，byte-identity 端到端验证（同模板+同 resolver+同 wrapper）。\n\n副产物：marketplace 子模块同步镜像（test/templates/trellis.test.ts parity 强制）；记 feedback memory：群聊真名不进任何 artifact（用户指出开盒）。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `40791b8b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 170: 0.6.8 release + PR reviews + context injection caps (#441)

**Date**: 2026-07-22
**Task**: 0.6.8 release + PR reviews + context injection caps (#441)
**Package**: cli
**Branch**: `main`

### Summary

Reviewed PRs #452 (Kimi Code, merged after marketplace#10) and #443 (Snow CLI, four review blockers posted). Diagnosed and fixed test-before-build ordering in both ci.yml (#453) and publish.yml that broke main CI since #448. Released 0.6.8 (Grok/Kimi/Codex native dispatch/Pi skills migration), closed #451. Implemented #441 via task 07-22-subagent-context-limits: tiered context injection caps (32/64/128KiB, config.yaml context_injection, 0=unlimited) with UTF-8-safe truncation and degrade-to-index, mirrored in Python hook + Pi extension per frozen contract; jsonl hygiene warnings in task.py validate; spec updated in platform-integration.md; #349 tracking updated to 20 platforms.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `ea399def` | (see git log) |
| `26ca25f8` | (see git log) |
| `dc68f5a9` | (see git log) |
| `65a83d7d` | (see git log) |
| `bfa7f99d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 171: no-trellis skip keyword (#427) + stale task cleanup

**Date**: 2026-07-22
**Task**: no-trellis skip keyword (#427) + stale task cleanup
**Package**: cli
**Branch**: `main`

### Summary

Implemented prompt_injection.skip_keyword (default no-trellis): word-boundary case-insensitive keyword in user prompt mutes per-turn workflow-state injection for that turn; Python shared hook + OpenCode plugin + dogfood .claude/.codex copies; Pi documented coverage gap (no input handler / systemPrompt cache stability); quoted-empty-string YAML parser fix; 20 new tests, 1491 green. Spec contract added to platform-integration.md. Closed #427. Earlier: archived 4 stale tasks (kiro-injection done fbb38c93, #292 closed, #320 closed, #344 discussion closed/superseded by #445).

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `64df8759` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 172: Script QoL batch: journal flags, task tree, meta flag (#394, #402)

**Date**: 2026-07-22
**Task**: Script QoL batch: journal flags, task tree, meta flag (#394, #402)
**Package**: cli
**Branch**: `main`

### Summary

Batch of three script improvements, all probe-tested.

### Main Changes

- add_session.py: repeatable --change/--test/--next-step; empty sections omitted, placeholder text eliminated (#394)
- task.py list: dangling parent refs render flat instead of vanishing (#402; tree view itself predated from #395)
- task.py create --meta key=value (validated pre-mkdir) + set-meta subcommand for task.json meta field

### Git Commits

| Hash | Message |
|------|---------|
| `53a29d41` | (see git log) |

### Testing

- [OK] pnpm test 1500/1500 green, lint/typecheck clean, CI green

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 173: Snow merge + codex model keys + channel trusted dirs (#443/#459/#414)

**Date**: 2026-07-23
**Task**: Snow merge + codex model keys + channel trusted dirs (#443/#459/#414)
**Package**: cli
**Branch**: `main`

### Summary

Cross-day batch closing out platform and channel work.

### Main Changes

- Merged Snow CLI as 21st platform (#443): author fixed all four blockers, we contributed the missing workflow.md platform markers + marketplace mirror sync + contract test updates
- Codex #459: kept auto default after two decision reversals; user-set model/model_reasoning_effort in omtre-*.toml now survive update (heredoc-safe extraction); reporter field-verified low effort suffices
- Channel #414: channel.trusted_context_dirs allowlist + narrow auto-trust of .omtre/tasks|workspace symlink targets, consistent across context-loader/agent-loader/OMP template; adversarial review found no bypass

### Git Commits

| Hash | Message |
|------|---------|
| `ee4bffcc` | (see git log) |
| `3dc7ba07` | (see git log) |
| `530d2091` | (see git log) |

### Testing

- [OK] Suite grew 1517→1539, all green; lint/typecheck/build clean; main CI green after each merge

### Status

[OK] **Completed**

### Next Steps

- 0.6.9 release + #459 reply pending user approval
- #415 structural fix (per-session files + derived index) awaiting user decision on index.md leaving git


## Session 174: Journal merge=union quick fix (#415 partial) + branch mixup recovery

**Date**: 2026-07-24
**Task**: Journal merge=union quick fix (#415 partial) + branch mixup recovery
**Package**: cli
**Branch**: `main`

### Summary

Shipped the quick-fix tier of #415 after production evidence confirmed the diagnosis.

### Main Changes

- .gitattributes at project root (not nested .omtre/ — verified via real git check-attr that nested placement never matches) ships journal-*.md merge=union
- index.md intentionally left unmanaged; documented as safe-to-pick-either-side since task state lives in task.json, not index.md
- add_session.py warns once when run inside a linked git worktree with session_auto_commit enabled

### Git Commits

| Hash | Message |
|------|---------|
| `a5374864` | (see git log) |

### Testing

- [OK] 1554/1554 green, lint/typecheck clean, main CI green

### Status

[OK] **Completed**

### Next Steps

- Structural #415 fix (per-session files, index.md as derived non-git cache) still queued pending user decision
- Mid-session: commit accidentally landed on a stray local feat/v0.7-beta checkout (not created by me) instead of main; cherry-picked onto main, dropped an unrelated stray assets/claude.md that got swept in by git add -A, and restored feat/v0.7-beta to its original remote position


## Session 175: Fix Pi concurrent session isolation

**Date**: 2026-08-01
**Task**: Fix Pi concurrent session isolation
**Package**: cli
**Branch**: `fix/512-pi-session-isolation`

### Summary

Fixed Issue #512 by making Pi native session identity authoritative and removing unsafe runtime-pointer adoption.

### Main Changes

- Bound Pi session-manager method calls to their receiver so Pi 0.83.0 native IDs resolve correctly.
- Removed ambient main-session overrides and singleton runtime-pointer adoption from both Pi extension copies.
- Replaced the shallow Bash assertion with an event-level foreign-context regression test.
## Session 175: Spec on-demand injection — research, PR #468 review, cross-platform provider design

**Date**: 2026-07-25
**Task**: (no Trellis task — exploratory research + review)
**Package**: cli
**Branch**: `feat/v0.7-beta` (created this session)

### Summary

Started as "study how maka-agent returns tool results to the agent", ended as a full design + adversarial review cycle for spec on-demand injection. Produced: a v2 architecture artifact, two review comments on PR #468, GitHub Discussion #474, and a repo branch. Three of my own proposals were overturned by evidence during the session — that churn is the substance of this entry.

### Main Changes

- Created remote branch `feat/v0.7-beta` off `origin/main` (PR #468 targets it)
- Published artifact (v2) — Trellis hook unified architecture + spec injection design
- `tmp/pr-468-review.md` — 47 verified findings + three follow-up empirical sections (gitignored)
- `tmp/omtre-hook-architecture-v2.html` — standalone copy of the artifact
- PR #468: two comments (findings review; transcript-as-state proposal), plus a pointer comment scoping the PR back to Claude Code
- Discussion #474 (Ideas) — cross-platform provider design

### Key decisions and why

**Dropped content fingerprinting from the ticket protocol.** Maka's placeholder carries a `bodySha256`; I mirrored it. User pushed back: specs rarely change mid-session, and computing the digest means reading the whole spec file on the hottest path (PostToolUse fires on every Read). Removing it deletes one decision branch and makes *first injection* the only path that opens the spec file — silent and ticket paths become pure table lookups.

**v1 five-layer microkernel → v2 subprocess ABI.** v1 assumed the mess came from platform divergence, so it proposed a descriptor table + adapter layers. Measured: only **9** `platform ==` branches across the three shared hooks, each with a 3-5 line comment explaining why. The actual mess is **7 parallel implementations, ~8300 lines, ~1700 of them pure fork copies**. Layering fixes none of that; a subprocess ABI (thin adapters delegating to one core) fixes both Python-side duplication and the cross-language mirrors.

**Transcript-as-state proposal → event-driven state.** I proposed reading the platform transcript instead of keeping our own state (it self-corrects across compaction, needs no identity resolution). Then the docs research killed the foundation: Claude Code's sessions doc says entry format "is internal to Claude Code and changes between versions, so scripts that parse these files directly can break on any release"; Codex says "the transcript format isn't a stable interface for hooks". `compact_boundary` — the record my design keyed on — **appears nowhere in official docs**; I had reverse-engineered it from real files. Replacement: subscribe to `PreCompact`/`preCompact` and record "context was reset at T" in our own state file. Works on all three file-based platforms, uses only documented surface, and vindicates #468's state file as the correct substrate (what changes is *what goes in it*).

### Technical insights worth remembering

**Maka's archive-before-placeholder.** Serialize → hash → size → *archive first* → only on a non-empty artifact id, substitute a source-bearing placeholder; any failure keeps the original payload. Threshold 2048 est. tokens, runs in `prepareStep` between provider steps, never rewrites the persisted ledger. Author's measured A/B (121 tasks): performance **+2.48pp**, tokens **−41.7%**, cost **−31.6%**. His stated reason it's lossless: the semantics were already distilled into the assistant message that followed the tool result. Counter-case he documents: **thinking blocks cannot be pruned the same way** — the reasoning chain isn't restated in the visible reply, so dropping it is a correctness problem, not an efficiency one.

**Cutting history ≠ saving money.** Same author measured that trimming old turns *raised* cache-miss rate and total cost, so sliding-window trim went opt-in. This is why the injection protocol must be append-only: rewriting history invalidates the prompt prefix cache.

**Platform injection ceilings are per-platform and use different units.** Claude Code: 10,000 **characters**, overflow → saved to file + preview (not silent truncation). Codex: ~2,500 **tokens**, per entry, same spill behavior. Cursor: **undocumented**. So budget must be a provider property; #468's global 8192-byte constant is both too small for Claude Code and the wrong unit for Codex. CJK is hit hardest on Codex (~1200-2500 chars for 2500 tokens vs 10000 chars on Claude Code).

**`PostToolBatch` exists on Claude Code** — fires once per batch of parallel tool calls, before the next model call, no matcher filtering. That is the documented fix for duplicate injection under parallel tool use. It does not exist on Codex or Cursor, and neither documents parallel-tool hook semantics, so the portable answer is still a lock around the state read/write.

**Injected text is replayed on resume, not regenerated.** Claude Code saves `additionalContext` in the transcript; `--continue`/`--resume` replays the saved text rather than re-running the hook, so timestamps and commit SHAs go stale. Time-sensitive content belongs in `SessionStart` (which does re-run, with `source` = resume/fork/compact).

**Subagent transcripts are real and documented.** `projects/<project>/<session>/subagents/`; `SubagentStop`'s `transcript_path` points at the subagent's own file; `agent_id` is documented as "present only when the hook fires inside a subagent". Cursor has the parallel field `agent_transcript_path`. But in mid-session events the payload's `transcript_path` is the **parent's**.

**In-process platforms may not need file access at all.** Pi's `ctx.sessionManager.buildContextEntries()` returns the current branch with compaction already applied; OpenCode's `experimental.chat.messages.transform` receives the full message array. The two platforms I assumed were hardest are the easiest.

**Python stdlib reads SQLite; the Node CLI is what got burned.** Trellis's `trellis mem` OpenCode reader is disabled because `better-sqlite3` (native) fails to install on Windows. That does **not** transfer to hooks: `import sqlite3` is stdlib. Measured on Cursor's 797MB `state.vscdb`, opened read-only via `file:...?mode=ro&immutable=1`: targeted lookup of 20 messages = **1 ms**. (Moot in the end — Cursor hands `transcript_path` in the payload — but the reasoning error is worth remembering: I generalized a Node-side constraint to a Python context.)

### Gotchas discovered

**Transcript line count is not turn count — off by ~50x.** Real session here: 1112 lines, **9** real user turns (~124 lines/turn; the rest is assistant messages, tool results, attachments, snapshots). #468's `refresh_window_lines: 300` documented as "~30 turns" is in practice **≈2.4 turns**. Turn count is directly computable: `type == "user"` AND `message.content` is a string (not a `tool_result` array) AND no `isMeta`.

**Claude Code transcripts never shrink.** Compaction appends a `compact_boundary` record and keeps writing. Scanned 2917 real transcripts: 51 contain a boundary, **zero** ever shortened. So #468's "negative line delta ⇒ /compact happened" branch can never fire — the ticket model's core scenario is dead code on its only wired platform.

**Per-pid state sharding solves nothing.** #468 shards state files by pid to avoid write races without locking. Measured: 12 processes each appending **38,633 bytes in one `os.write()`** (far past PIPE_BUF) to a single `O_APPEND` file → 2400 lines, **zero corruption**. Real records are 200-600 bytes. Worse, each hook run is a fresh process, so pid differs every time → sharding degrades into *one file per emission*, and `load_state` globs and merges all of them every event. And it doesn't address the actual race, which is read-before-write (concurrent hooks all read empty state, all decide "first touch" — measured 2-5 duplicate full injections in one turn, 17-43KB).

**"Full injection" is often the first 5%.** 13 specs got `paths:` frontmatter in #468; **11 exceed** the 8192-byte per-spec cap. `platform-integration.md` is 162,692 bytes → injects 5.0%, cut mid-markdown-table, followed by a notice telling the model to go read a 162KB file. That is the index-only mode the design doc explicitly rejects, reached by another route.

**Pre-existing UTF-8 truncation bug still live.** `inject-subagent-context.py`'s `truncate_utf8` splits multi-byte characters when the cut lands exactly on a boundary: `你好世界` capped at 6 bytes → `你␦`. #468's derived copy fixed it; the original was never back-ported. Our specs are Chinese, so subagent context truncation corrupts the last character today.

**`_maybe_gc` deletes by extension only.** `rglob("*.jsonl")` + mtime check, no shard-name validation, no depth limit, on a `base_dir` taken straight from `OMTRE_SPEC_STATE_DIR` with no validation. Point that variable anywhere and it silently deletes user `.jsonl` files.

**State-write failure has no circuit breaker.** `append_records` warns and returns, but `stateless` stays `False` — so every subsequent event reads empty state, decides "first touch", re-emits the full body. Reproduced: 8,986 bytes, three runs in a row. The stateless ticket-only mode already exists; this path just never falls into it.

**`ZCode` has never been tested.** `registry-invariants.test.ts` loops over a **hand-written** list of 8 platforms; the registry has **21**, and 9 platforms actually have per-turn hook wiring. ZCode is the ninth and isn't in the list. Tests stay green. This is exactly the failure maka's provider-contract matrix guards against — their code comment records the same accident (a hand-written list silently dropped GitHub Copilot).

**Dogfood is six versions behind.** `.omtre/.version` = 0.6.2, CLI = 0.6.8; 5 of 11 tracked hook/wiring files differ from templates. Any "we use it ourselves and it's fine" claim is unfounded until that's reconciled.

**Workflow `args` must be a JSON value, not a JSON string.** Passing a stringified object made `args.draft` `undefined`, so four critique agents reviewed a draft that literally read "undefined". Worse: the resume cache keys on `(prompt, opts)`, so re-running with the same broken args replayed the same useless results. Fix was inlining the draft as a script const.

**Background agents can loop.** One research agent kept re-notifying "waiting on the last agent" with rising token counts (77k→83k) after already delivering its full result. `TaskStop` ended it; watch cumulative tokens across repeat notifications as the tell.

### Testing

- No source changes; nothing to run. All claims reproduced against `origin/feat/spec-on-demand-injection` with real `python3`, and against real transcripts under `~/.claude/projects`.

### Status

[OK] **Research + review delivered** — implementation not started

### Next Steps

- Rewrite Discussion #474: remove the `compact_boundary` recommendation (undocumented internal format), replace with event-driven state; add per-platform injection ceilings and stability grading with doc links
- Pi/OpenCode docs research still running — needed to confirm the compaction-event pattern holds for in-process platforms
- PR #468: author has not responded to either comment yet
- Unfixed and unfiled: channel orphan processes (`kill.ts:77/84/104/121`, `guard.ts:536`, `rm.ts:228` signal positive pids while `spawn.ts:312` uses `detached: true`); maka's `process-tree-terminator.ts` is a drop-in reference (217 lines, no native deps)
- Also unfiled: ZCode wiring untested; `truncate_utf8` fix not back-ported; dogfood version drift


## Session 175: Release v0.6.12: Pi concurrent session isolation

**Date**: 2026-08-01
**Task**: Release v0.6.12: Pi concurrent session isolation
**Package**: cli
**Branch**: `main`

### Summary

Released the Pi concurrent-session isolation fix as Trellis v0.6.12.

### Main Changes

- Merged PR #515 and published v0.6.12 through GitHub Actions.
- Published matching CLI and Core packages with the latest npm dist-tag.

### Git Commits

| Hash | Message |
|------|---------|
| `93f43713` | (see git log) |

### Testing

- [OK] Pi 0.83.0: two concurrent RPC processes exported distinct native-derived Trellis context keys through real Bash tool calls.
- [OK] Core: 333 passed, 1 skipped; CLI: 1586 passed.
- [OK] CLI build, typecheck, and lint passed.
| `58f51a04` | (see git log) |
| `43e82239` | (see git log) |
| `516b34e3` | (see git log) |

### Testing

- [OK] Local build, lint, typecheck, full test suite, manifest continuity, pack, and fresh-init smoke checks passed.
- [OK] GitHub publish workflow 30701189857 passed and public CLI execution returned 0.6.12.

### Status

[OK] **Completed**

### Next Steps

- Open and review the GitHub PR linked to Issue #512.
