# Fix #465 Codex truncated hook context recovery

## Goal

Ensure Codex Trellis sub-agents recover the complete hook payload or load task
context themselves when `SubagentStart.additionalContext` is truncated.

## Background

Codex keeps a head/tail preview when hook output exceeds its model-visible
budget and reports `Full hook output saved to: <path>`. Trellis puts
`<!-- omtre-hook-injected -->` at the start of the payload. The shipped
Codex implement, check, and research profiles currently treat that marker as
proof that the entire payload was loaded, so files removed from the middle are
silently skipped.

## Requirements

- Update the three shipped Codex agent profiles with this precedence:
  1. A `Full hook output saved to:` notice means the visible payload is
     incomplete; read the referenced file before doing role work.
  2. If that file cannot be read, use the existing role-specific pull fallback.
  3. Only a marker without a truncation notice means injected context is
     complete.
- Implement and check fallbacks must read the role JSONL, each listed file,
  `prd.md`, and optional `design.md` / `implement.md`.
- Research must remain role-isolated: recover its full hook output or use the
  supplied active-task path, but never load `implement.jsonl` or `check.jsonl`.
- Limit the change to shipped Codex templates and their tests. The tracked
  project `.codex/agents` files currently use an older pull-only profile and
  must not be rewritten as an unrelated dogfood migration.
- Preserve model-key hints, recursion guards, TOML validity, and update-time
  model-key preservation.

## Acceptance Criteria

- [x] Generated implement, check, and research profiles all distinguish
      truncated output from complete marker-bearing output.
- [x] Each profile attempts the saved full-output file before its role-specific
      fallback.
- [x] Implement/check fallbacks name the correct JSONL and task artifacts;
      research does not name either execution JSONL.
- [x] `trellis init --codex` still produces valid agent TOML with unchanged
      model-key and recursion-guard behavior.
- [x] Focused template tests would fail if any one of the three roles regressed
      to marker-only detection.

## Out of Scope

- Changing Codex's hook-output limit.
- Reducing Trellis context-injection limits.
- Adding runtime parsing or file reads to the hook itself.
- Changing non-Codex agent profiles.
