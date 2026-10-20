# Fix post-0.6.9 task and Codex regressions

## Goal

Restore supported Python task-script execution, complete Codex sub-agent
context recovery, and correct fallback-session cleanup through three
independently verifiable fixes.

## Background

- [#476](https://github.com/mindfold-ai/Trellis/issues/476) makes every
  `task.py` command fail at import time on supported Python 3.9-3.11.
- [#465](https://github.com/mindfold-ai/Trellis/issues/465) allows Codex to
  truncate `SubagentStart.additionalContext` while the retained marker tells
  the child agent that all task context is present.
- [#469](https://github.com/mindfold-ai/Trellis/issues/469) lets
  `task.py finish` report success without deleting the session file that
  supplied a single-session fallback.

## Child Tasks

| Child | Deliverable |
|---|---|
| `07-27-python-task-script-compat` | Fix #476 and preserve Python 3.9+ compatibility |
| `07-27-codex-hook-truncation-recovery` | Fix #465 in shipped Codex agent profiles |
| `07-27-fallback-session-cleanup` | Fix #469 without clearing unrelated sessions |

## Requirements

- Each defect must be implemented, tested, reviewed, and archived through its
  owning child task.
- The child tasks must remain independently revertible; no shared abstraction
  may be introduced solely to group unrelated fixes.
- Implementation order is #476, then #465, then #469. The order reflects user
  impact, not a code dependency.
- Generated templates and tracked live copies must follow their existing
  ownership/parity rules.
- The final integration review must inspect the combined diff and run the full
  repository verification suite.

## Acceptance Criteria

- [x] All three child tasks satisfy their acceptance criteria and are archived.
- [x] The combined diff contains only files owned by the three fixes plus
      required specs, tests, and task records.
- [x] `pnpm build`, `pnpm test`, `pnpm lint`, and `pnpm typecheck` pass after
      all children are integrated.
- [x] GitNexus/available change detection confirms only the expected symbols
      and execution flows are affected before commit.

## Out of Scope

- Publishing a release.
- Commenting on or closing the GitHub issues.
- Refactoring the broader context-injection or active-task architecture.
