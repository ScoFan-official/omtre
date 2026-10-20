# OpenCode: bridge session identity via shell.env plugin

## Goal

Make `task.py start` work on OpenCode by having a plugin inject
`OMTRE_CONTEXT_ID` into every shell command OpenCode runs.

## Background

`_ENV_SESSION_KEYS` declares three OpenCode env vars — `OPENCODE_SESSION_ID`,
`OPENCODE_SESSIONID`, `OPENCODE_RUN_ID`. Research (see the parent task's
`research/platform-session-identity.md`) confirmed **all three are invented**:
zero hits across OpenCode 1.18.13 source, and `strings` on the installed 1.17.18
binary finds 59 `OPENCODE_*` literals, none session-scoped. So `task.py start`
on OpenCode has always run in degraded mode and never persisted the active-task
pointer.

OpenCode provides the exact primitive needed — a **`shell.env`** plugin hook,
documented as "inject environment variables into all shell execution (AI tools
and user terminals)". Its input already carries `sessionID`:

```
plugin.trigger("shell.env", { cwd, sessionID, callID }, { env: {} })
// child env = { ...process.env, ...extra.env }
```

Trellis already ships three OpenCode plugins, so the scaffold exists.

## Requirements

- A `shell.env` handler sets `OMTRE_CONTEXT_ID` from the hook's `sessionID`.
- Key format must match what other platforms produce so runtime session files
  are consistent — follow the existing `<platform>_<id>` convention used by
  `resolve_context_key` / `_context_key` in `active_task.py` (Snow uses
  `snow-<sid>`; check what the Python side expects and match it exactly).
- **Do not overwrite an existing `OMTRE_CONTEXT_ID`.** A parent harness stays
  authoritative — this is the contract Snow implements
  (`sessionIdentityEnv.ts`) and Trellis's own resolver checks the override
  first.
- Sanitize the id the same way `_sanitize_key` does before using it in an env
  value, so the key round-trips to the same runtime filename.
- Fail soft: a throwing handler must never block shell execution. Match the
  `try/catch` + `debugLog` style of the sibling plugins.
- Register the plugin wherever the other three are registered so `trellis init`
  and `trellis update` both emit it.

## Constraints

- Match the existing plugin file style exactly: factory function
  `export default async ({ directory, client }) => ({ "shell.env": … })`, same
  `debugLog` namespace convention, no new dependencies.
- Respect the existing kill switches: `OMTRE_HOOKS=0` /
  `OMTRE_DISABLE_HOOKS=1`.
- Surgical change. Do not refactor the other plugins or `lib/omtre-context.js`.

## Acceptance Criteria

- [ ] A `shell.env` handler exists in `src/templates/opencode/plugins/` and is
      registered alongside the other three.
- [ ] It sets `OMTRE_CONTEXT_ID` only when unset, from `input.sessionID`,
      sanitized and prefixed to match the Python resolver's expectation.
- [ ] Round-trip verified: the key the plugin writes resolves to the same
      runtime session filename that `resolve_context_key` would compute for that
      id. Prove it with a test, not by inspection.
- [ ] `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass.
- [ ] Template-emission tests cover the new plugin the way the existing three
      are covered (see `test/templates/opencode.test.ts` and the
      `collectPlatformTemplates` path in `configurators/index.ts`, which must
      stay byte-identical to what the configurator writes).
- [ ] The three invented `OPENCODE_*` names are left alone in this task —
      removing them is the parent task's cleanup item, and touching them here
      would widen the diff.

## Out of Scope

- The other 20 platforms.
- Removing invented env var names anywhere.
- Kilo CLI, which vendors the same `shell.env` code but is registered as an
  inline platform — needs a separate product decision first.

---

## Outcome: ABANDONED — the premise was wrong

Real end-to-end testing on OpenCode 1.17.18 disproved the premise. Controlled
experiment, same project, same prompt:

- with the new plugin → `export OMTRE_CONTEXT_ID='opencode_ses_02e55409…'` → resolved
- **with the plugin removed** → `export OMTRE_CONTEXT_ID='opencode_ses_02e54808…'` → **also resolved**

`plugins/inject-subagent-context.js:444` already prefixes every bash command with
`export OMTRE_CONTEXT_ID=…; ` (with four regex guards against double
injection). OpenCode was never broken. The three invented `OPENCODE_*` env names
in `_ENV_SESSION_KEYS` are dead code that was never on the working path.

The plugin and its tests were reverted. Keeping both mechanisms would have added
a second way to compute the same key — the exact duplication this task tree is
supposed to be removing.

Noted for later, not done: `shell.env` is structurally cleaner than rewriting
command strings (no quoting/PowerShell edge cases, and it covers user terminals).
Migrating the prefix hack to `shell.env` is a legitimate cleanup — but as a
replacement, never as an addition.

Root cause of the wrong premise: the audit that asked "which platforms already
bridge `OMTRE_CONTEXT_ID`" used a hand-written platform list that omitted
`opencode`, and a later pass omitted the `shared-hooks/` directory where the
Claude and Cursor bridges live. Hand-maintained platform lists are the same
defect class this tree is chasing.
