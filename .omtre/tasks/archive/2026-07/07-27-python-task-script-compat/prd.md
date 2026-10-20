# Fix #476 Python 3.9-3.11 task script compatibility

## Goal

Make every generated `task.py` command parse and run on the documented Python
3.9+ floor.

## Background

`common/task_context.py` contains two multiline nested f-strings introduced
with the context-injection warnings. PEP 701 permits this grammar on Python
3.12+, but Python 3.9-3.11 fail while importing the module, before command
dispatch. The two affected warning blocks are currently near lines 240 and
249 in both the canonical template and tracked live copy.

## Requirements

- Remove both PEP 701-only expressions without changing warning text, color,
  validation severity, or exit behavior.
- Keep
  `packages/cli/src/templates/trellis/scripts/common/task_context.py` and
  `.omtre/scripts/common/task_context.py` byte-identical.
- Preserve the documented Python 3.9 minimum; do not raise the version floor or
  suppress syntax failures.
- Add a regression gate that fails on the current construct even when the CI
  host runs Python 3.12+.
- Verify the distributed scripts with real Python 3.9 and 3.11 interpreters.

## Acceptance Criteria

- [x] Python 3.9 and 3.11 can compile both `task_context.py` copies.
- [x] Python 3.9 and 3.11 can run `.omtre/scripts/task.py --help` without a
      syntax error.
- [x] Both code-file and oversized-file warnings retain their existing text,
      color, and non-blocking behavior.
- [x] The canonical template and tracked live copy are byte-identical.
- [x] The focused regression test fails against the pre-fix source and passes
      after the fix.

## Out of Scope

- A Python CI matrix for the whole repository.
- Any change to context-injection limits or JSONL validation policy.
- Publishing a patch release.
