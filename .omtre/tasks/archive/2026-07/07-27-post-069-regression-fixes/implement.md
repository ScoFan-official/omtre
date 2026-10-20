# Implementation Plan: Post-0.6.9 Regression Fixes

## Execution Order

### 1. Fix #476

- Activate `07-27-python-task-script-compat`.
- Load `omtre-before-dev` and run required impact analysis before editing.
- Replace both PEP 701-only warning expressions without changing output.
- Keep template/live `task_context.py` copies byte-identical.
- Add a focused regression guard.
- Verify with:
  - `uv run --no-project --python 3.9 python -m py_compile <both files>`
  - `uv run --no-project --python 3.11 python -m py_compile <both files>`
  - `uv run --no-project --python 3.9 python ./.omtre/scripts/task.py --help`
  - `uv run --no-project --python 3.11 python ./.omtre/scripts/task.py --help`
  - `pnpm --filter omtre exec vitest run test/regression.test.ts`

### 2. Fix #465

- Activate `07-27-codex-hook-truncation-recovery`.
- Load `omtre-before-dev`; inspect template ownership before editing.
- Update all three shipped Codex profiles with truncation-first recovery.
- Preserve role boundaries, recursion guards, model hints, and TOML shape.
- Add focused assertions in `test/templates/codex.test.ts`.
- Verify with:
  - `pnpm --filter omtre exec vitest run test/templates/codex.test.ts`
  - a temporary-project `trellis init --codex` smoke check using the built CLI

### 3. Fix #469

- Activate `07-27-fallback-session-cleanup`.
- Load `omtre-before-dev` and run impact analysis for
  `clear_active_task()` before editing.
- Delete the session path from the resolved previous context key.
- Keep template/live `active_task.py` copies byte-identical.
- Add the reported finish-to-current regression to the existing active-task
  regression suite.
- Verify with:
  - `pnpm --filter omtre exec vitest run test/regression.test.ts`
  - a direct Python reproduction with mismatched current/fallback context keys

## Integration Review

- Review the combined diff against all four planning artifacts.
- Confirm no child introduced unrelated refactoring or shared abstractions.
- Run:
  - `pnpm build`
  - `pnpm test`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm --filter omtre lint:py`
- Run `detect_changes()` against `main` before committing.
- Update relevant executable specs only when implementation changes a frozen
  contract; do not restate unchanged behavior.

## Rollback Points

- Complete and verify each child before starting the next.
- Keep commits child-scoped so any fix can be reverted independently.
