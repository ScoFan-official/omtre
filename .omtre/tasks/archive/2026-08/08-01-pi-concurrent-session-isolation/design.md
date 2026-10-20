# Design

## Root Cause

Trellis treats unproven process-wide state as session identity. The Pi
extension has a reliable native identity available, but `contextKey()` checks
the generic Trellis environment first. It then passes every candidate through
`adoptKey()`, which can replace that candidate with the only active runtime
pointer in the repository. Neither source proves ownership by the current Pi
window.

## Change

Use the native Pi session ID as the authoritative main-session identity and
remove singleton runtime-pointer adoption from Pi key resolution.

The resolution order will be:

1. `ctx.sessionManager.getSessionId()`
2. `PI_SESSION_ID` / `PI_SESSIONID`
3. Session ID carried by the Pi event
4. Session transcript path
5. A process-local random fallback, cached for the lifetime of the extension

An ambient `OMTRE_CONTEXT_ID` is not a valid Pi main-session identity because
it has no binding to the native Pi session. The extension already skips loading
inside `OMTRE_SUBAGENT_CHILD=1` processes, while the parent explicitly passes
its resolved key to child commands. Removing the ambient main-session override
does not remove subagent context inheritance.

## Affected Flow

```text
Pi native session ID
  -> contextKey()
  -> getKey() cached session key
  -> SessionStart / before_agent_start context
  -> Bash OMTRE_CONTEXT_ID
  -> task.py session pointer
```

`adoptKey()` and its runtime-directory scan are deleted. This fixes the shared
identity point once instead of adding guards to each event handler.

## Files

- `packages/cli/src/templates/pi/extensions/trellis/index.ts.txt`
  - Make native Pi identity authoritative.
  - Delete foreign runtime-pointer adoption.
- `.pi/extensions/trellis/index.ts`
  - Keep the repository's generated extension identical to the template.
- `packages/cli/test/templates/pi.test.ts`
  - Add event-level regression coverage for key selection, context injection,
    Bash propagation, and pointer isolation.

No new dependency or production abstraction is required.

## Verification Strategy

### Deterministic extension regression

Load the extension template through the existing VM harness, register its real
event handlers, and create real temporary `.omtre/.runtime/sessions` files.
Verify:

- a foreign singleton pointer is ignored;
- a foreign ambient override is ignored when a native Pi ID exists;
- Bash receives the native-derived key;
- `before_agent_start` does not include foreign task content;
- two native IDs produce different keys;
- a missing native ID uses a stable local fallback without foreign adoption.

### Real Pi process reproduction

Run two isolated Pi 0.83.0 processes in RPC mode against the same temporary
repository. Use explicit distinct `--session-id` values, load only the Trellis
extension, and send direct RPC Bash commands that print `PI_SESSION_ID` and
`OMTRE_CONTEXT_ID`. This exercises actual Pi event wiring without an LLM call.

The reproduction must fail on the vulnerable implementation and pass after the
fix. Processes are terminated after the RPC assertions.

## Compatibility

- Existing task pointers derived from native Pi IDs keep the same
  `pi_<sanitized-session-id>` format.
- Process/transcript fallbacks remain available for Pi hosts that omit a native
  session ID, but they no longer inspect unrelated runtime files.
- Explicit subagent inheritance remains unchanged and covered by existing tests.

## Risks

- A legacy Pi session that depended on singleton-pointer adoption may no longer
  resume that pointer automatically. This behavior is intentionally removed
  because it cannot distinguish continuity from cross-window contamination.
- Pi RPC startup may emit unrelated events. The process test will correlate RPC
  responses by request ID and assert only the two non-secret identity variables.

