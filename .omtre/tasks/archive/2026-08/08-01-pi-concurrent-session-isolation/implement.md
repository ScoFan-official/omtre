# Implementation Plan

## 1. Establish the failing loop

- Extend the existing Pi template VM harness with one focused event-level test.
- Seed a foreign `pi_process_*` task pointer and a distinct native Pi session ID.
- Assert that SessionStart/Bash/context injection uses only the native-derived
  key and leaves the foreign pointer untouched.
- Run the test against the current implementation and record the expected
  failure before changing production code.

## 2. Fix key resolution

- Make native Pi session metadata authoritative in `contextKey()`.
- Remove ambient main-session override handling.
- Delete `adoptKey()` and its runtime-directory scan.
- Keep `getKey()` as a process-stable cache around native, transcript, or local
  fallback identity.
- Apply the same change to the CLI template and repository-generated extension.

## 3. Complete regression coverage

- Cover a foreign ambient `OMTRE_CONTEXT_ID` plus a valid native session ID.
- Cover two distinct native Pi session IDs.
- Cover missing native metadata with a stable, non-adopting fallback.
- Confirm foreign task artifacts are absent from injected context.
- Confirm existing Pi subagent child inheritance remains unchanged.

## 4. Verify with real Pi 0.83.0 processes

- Create an isolated temporary Trellis repository with a foreign task pointer.
- Launch two Pi 0.83.0 RPC processes concurrently with distinct native session
  IDs and only the local Trellis extension enabled.
- Execute direct RPC Bash identity probes without invoking an LLM.
- Assert distinct native-derived Trellis keys and unchanged foreign pointers.
- Terminate both processes and clean the temporary repository.

## 5. Quality and delivery checks

- Verify both Pi extension copies contain the same session-isolation behavior.
- Run the focused Pi template tests, then the relevant CLI test/type/lint suite.
- Run CodeGraph/GitNexus change detection where available and review the final
  diff for unexpected flow changes.
- Prepare one reviewable commit and PR linked to Issue #512.
