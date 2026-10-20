# Fix #469 fallback session cleanup

## Goal

Make `task.py finish` delete the session file that actually supplied the
resolved active task, including a single-session fallback.

## Background

`clear_active_task()` resolves the previous task correctly, including
`source_type="session-fallback"` and its source `context_key`, but deletes the
path derived from the current process identity. When those keys differ, finish
reports success while the fallback file remains and immediately reactivates
the completed task.

## Requirements

- Resolve the previous active task before choosing the file to delete.
- Delete the file identified by the resolved active task's `context_key`,
  whether the source is an exact session or a single-session fallback.
- Preserve the safe no-task/no-context behavior: do not guess a file and do not
  delete unrelated runtime sessions.
- Keep `clear_task_from_sessions()` and archive behavior unchanged; finish
  clears one resolved session, not every session pointing at the task.
- Keep the canonical `active_task.py` template and tracked live copy
  byte-identical.
- Add a regression test matching the reported flow: a different
  `CODEX_THREAD_ID`, exactly one older session file, `finish`, then `current`.

## Acceptance Criteria

- [x] Exact-session finish still removes the exact session file and returns the
      previous task/source.
- [x] Fallback-session finish removes the fallback file named by
      `previous.context_key`.
- [x] After fallback finish, `task.py current --source` returns no active task.
- [x] Zero-session and ambiguous multi-session cases delete nothing.
- [x] Other sessions for the same task remain untouched by `finish`.
- [x] The canonical template and tracked live copy are byte-identical.

## Out of Scope

- Redesigning or removing single-session fallback.
- Fixing the separate OpenCode fallback-selection behavior in #446.
- Changing archive-wide session cleanup.
