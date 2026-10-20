# Pi concurrent session isolation

## Goal

Fix GitHub Issue #512 so each Pi main window uses its own native Pi session
identity for Trellis task context and cannot read or mutate another Pi window's
active-task pointer.

## Problem

The Pi extension currently permits two unsafe identity paths:

1. `contextKey()` accepts an ambient `OMTRE_CONTEXT_ID` before Pi's native
   session ID.
2. `adoptKey()` treats a singleton runtime pointer as proof of ownership and can
   replace a fresh Pi key with another window's `pi_process_*` key.

The selected key is cached and reused for SessionStart context injection and
Bash command propagation. A foreign key can therefore expose another task's
artifacts and allow ordinary task commands to overwrite the foreign pointer.

## Requirements

- A Pi main session with a native session ID MUST derive its Trellis key from
  that native ID.
- An ambient `OMTRE_CONTEXT_ID` MUST NOT supersede a Pi main session's native
  identity.
- A Pi main session MUST NOT adopt a runtime pointer based on directory
  cardinality or key prefix.
- Two distinct native Pi session IDs in the same repository MUST resolve to two
  distinct Trellis keys.
- A new Pi session MUST NOT inject artifacts from a foreign task or export a
  foreign key to Bash.
- Pi subagent children MUST continue to receive the invoking session's context
  through the existing explicit child environment.
- The generated project extension and the CLI extension template MUST implement
  the same session-isolation behavior.
- The fix MUST cover both the reported Pi 0.83.0 behavior and the extension's
  deterministic unit-test seam.

## Out of Scope

- The platform-independent task lifecycle guard tracked by Issue #511.
- Generic task switching or explicit task attachment UX.
- OpenCode or other platform session-key behavior tracked by Issue #446.
- Pi-native transcript/session storage changes.
- Image paste behavior; the issue evidence does not identify it as causal.

## Acceptance Criteria

- [x] With one foreign `pi_process_*` pointer present, a fresh native Pi session
      resolves to `pi_<native-session-id>`.
- [x] With a foreign ambient `OMTRE_CONTEXT_ID` present, a native Pi session
      still resolves to `pi_<native-session-id>`.
- [x] Two concurrently running Pi 0.83.0 RPC processes in one test repository
      export different native-derived Trellis keys.
- [x] Neither process receives the other process's task artifacts or mutates the
      other process's runtime pointer.
- [x] A Pi session without native session metadata retains a stable local
      fallback without scanning or adopting foreign runtime pointers.
- [x] Existing subagent context inheritance tests continue to pass.
- [x] Pi template tests, type checks, lint, and build checks pass.

## Evidence

- GitHub Issue: <https://github.com/mindfold-ai/Trellis/issues/512>
- Confirmed on Pi 0.83.0, Trellis 0.6.9, Node 26.5.0, and macOS 15.
- `contextKey()` and `adoptKey()` each feed the shared `getKey()` path used by
  `session_start`, `before_agent_start`, `context`, and `tool_call`.
