# Purge references to deleted symbols before release

## Goal

Nothing that ships should describe machinery that no longer exists. Three sites
still name symbols deleted this week, and two of them go out in the npm package.

Target: a state worth releasing.

## The sites

### 1. `omtre-meta` bundled skill — ships to every user

`packages/cli/src/templates/common/bundled-skills/omtre-meta/references/local-architecture/bundled-skills.md`

- `:34` — "Each platform configurator calls `writeSkills(<root>, <workflowSkills>, resolveBundledSkills(ctx))` during `trellis init`… `writeSkills` then mirrors them under the platform's skill root."
- `:39` — a table row citing `configureCursor`
- `:70` — "`writeSkills(skillsRoot, workflowSkills, bundledSkills)` writes both workflow skills and bundled skill files under `skillsRoot`."

`writeSkills` and `configureCursor` were both deleted by `6ddd9412`. Cursor is
now `fromTemplates(collectCursorTemplates)`; skills reach disk through
`collectSkillTemplates` into the platform's map, then `writeTemplateMap`.

This is the most user-visible instance: it is auto-dispatched into every
platform's skill root, so an AI reading it will confidently describe a call
graph that does not exist.

### 2. `inject-workflow-state.py:25` — also ships

"each platform's hooks directory via `writeSharedHooks()` at init time." Same
deletion; shared hooks now arrive through `collectSharedHooks` into the
platform map.

### 3. The `OPENCODE_RUN_ID` contradiction — repo-internal, but it is a real one

`templates/opencode/lib/omtre-context.js:339` prefers `OPENCODE_RUN_ID` over
the plugin's own `sessionID`. The variable was real once — a 2026-04-27 live
shell test recorded it — but it is absent from all 84 `OPENCODE_*` literals in
OpenCode 1.17.18, along with `PROCESS_ROLE`. Upstream removed it.

The branch is inert, not wrong: `OMTRE_CONTEXT_ID` is first in the Python
precedence chain and the plugin sets it, so both resolvers key off the same
value. But the test suite now argues with itself in one file:

- `test/regression.test.ts:2860` lists `["opencode", "OPENCODE_RUN_ID"]` in
  `PURGED_ENV_NAMES`, asserting it resolves nothing.
- `test/regression.test.ts:4601` is titled "OpenCode resolver prefers
  `OPENCODE_RUN_ID` over plugin sessionID" and locks that preference in.

Both pass, because they exercise different layers. Two tests encoding opposite
intentions about one variable is how the next person gets misled.

Also `plugins/inject-subagent-context.js:405` says OpenCode "may not expose
`OPENCODE_RUN_ID` to Bash". On current versions it does not expose it anywhere.

## Requirements

- Describe what the code does now. Do not rewrite dead guidance into
  live-sounding guidance — where a mechanism is gone, the paragraph goes.
- Verify each replacement claim against the code before writing it. The audit
  that found these was wrong about four separate things this week; treat
  everything here as a lead.
- For site 3, decide **one** intent and make code, comment and tests agree.
  Removing the dead branch is the obvious reading — it can no longer fire, and
  keeping it means keeping a name we have documented as invented-on-this-version.
  If you find a reason it should stay, say so and fix the tests instead.
- Sites 1 and 2 change bytes that ship. The convergence landed a proof that
  `configure` and `collectTemplates` emit identical bytes; re-run it, do not
  assume a docs-only edit is inert.

## Acceptance Criteria

- [ ] `writeSkills`, `writeAgents`, `writeSharedHooks`, `configureCursor`,
      `copyDirFiltered`, `getAllCodexSkills` have zero hits across
      `packages/cli/src/templates/`, `.omtre/spec/`, and `packages/cli/src`.
- [ ] `omtre-meta`'s bundled-skills reference describes the current path:
      one `collect*Templates` per platform → `writeTemplateMap`.
- [ ] Site 3 resolved one way, with code, comments and both tests agreeing;
      the resolution is stated in the report.
- [ ] `pnpm build`, `lint`, `typecheck`, `test`, `lint:py` clean; both script
      trees byte-identical. Report the count against the 1654 baseline — a
      change means something outside docs moved.

## Out of Scope

- `.omtre/.backup-*` accumulation (22 directories since April) — same
  unbounded-growth class as the env file, but a product decision.
- Kiro's hook event, which needs a machine with Kiro installed.
- Adding a `trellis mem` adapter for Grok.
