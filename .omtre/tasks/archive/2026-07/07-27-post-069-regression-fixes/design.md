# Design: Post-0.6.9 Regression Fixes

## Boundaries

The parent task coordinates three isolated fixes and owns no shared runtime
implementation.

| Child | Change boundary | Existing mechanism reused |
|---|---|---|
| #476 | Two warning expressions in `task_context.py` | Plain string construction and existing validation flow |
| #465 | Three shipped Codex agent-profile instructions | Existing marker and role-specific pull fallback |
| #469 | `clear_active_task()` deletion target | Resolved `ActiveTask.context_key` and `_context_path()` |

No new helper, configuration key, file format, or compatibility layer is
required.

## Data and Control Flow

### #476

JSONL validation builds each warning message as a normal string, passes it to
`colored()`, and prints the same result. Moving string construction outside a
nested f-string changes only parser compatibility.

### #465

Codex supplies either the complete hook payload or a truncated preview plus a
saved-output path. The child profile interprets the host notice before the
Trellis marker:

```text
saved-output notice -> read full payload -> role work
                  \-> read failure -> existing role pull fallback
marker without notice -> role work
no marker/no notice -> existing role pull fallback
```

This remains an instruction-level recovery protocol; the hook does not inspect
or compensate for host truncation.

### #469

`resolve_active_task()` is the source of truth for both the previous task and
the context key that supplied it. `clear_active_task()` deletes
`_context_path(repo_root, previous.context_key)` only when that resolved key is
present. It must not fall back to bulk cleanup.

## Compatibility

- Python scripts continue targeting Python 3.9+.
- Codex profile TOML structure, model-key preservation, and recursion guards
  remain unchanged.
- Active-task persistence format remains unchanged.
- Canonical templates and tracked live script copies retain their existing
  parity requirements.

## Risk and Rollback

- #476 risk is warning-output drift; exact message assertions and twin parity
  contain it.
- #465 risk is weakening research-role isolation; role-specific assertions
  prevent execution JSONL loading by research.
- #469 risk is deleting another session; tests must prove finish removes only
  the resolved source context.

Each child can be reverted independently.
