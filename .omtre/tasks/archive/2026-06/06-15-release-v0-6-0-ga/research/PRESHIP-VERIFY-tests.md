# PRESHIP-VERIFY: test suite + lint + typecheck

**Date**: 2026-06-15
**Branch**: feat/v0.6.0-rc
**Verifier**: omtre-check (CHECK 8)

## Overall Result: PASS

| Command | Exit | Result |
| --- | --- | --- |
| `pnpm typecheck` | 0 | PASS |
| `pnpm lint` | 0 | PASS |
| `pnpm test` | 0 | PASS |

---

## 1. `pnpm typecheck`

- **Exit code**: 0
- **Command chain**: `pnpm --filter @omtre/core build && pnpm --filter omtre typecheck`
- **Core**: `tsc` compile of `@omtre/core@0.6.0-rc.0` completed without diagnostics.
- **CLI**: `tsc --noEmit` for `omtre@0.6.0-rc.0` completed without diagnostics.

## 2. `pnpm lint`

- **Exit code**: 0
- **Command chain**: `pnpm --filter @omtre/core lint && pnpm --filter omtre lint`
- Both packages run `eslint src/ test/` and produced no errors or warnings.
- Note: rtk's `eslint` filter intercepted the binary and surfaced a global ESLint 8.x stack trace; bypassing via `rtk proxy pnpm lint` (which still invokes the local `eslint@9.39.2` resolved by pnpm) confirms a clean lint pass. Direct invocation through `./node_modules/.bin/eslint src/ test/` in both packages also exited 0.

## 3. `pnpm test`

- **Exit code**: 0
- **Command chain**: `pnpm --filter @omtre/core test && pnpm --filter omtre test` (vitest `run` mode in each).

| Package | Test files | Tests | Failures |
| --- | --- | --- | --- |
| `@omtre/core` | 17 | 278 | 0 |
| `omtre` (CLI) | 47 | 1210 | 0 |
| **Total** | **64** | **1488** | **0** |

CLI threshold from the check brief (>=1210 passing, 0 failing) is met exactly on the CLI side; combined total is 1488.

### Targeted re-check: `packages/cli/test/configurators/platforms.test.ts`

- File-level result: 58 tests passed, 0 failed (exit 0).
- `BUNDLED_SKILL_NAMES` constant (line 39-44) now contains 4 entries:
  1. `omtre-channel`
  2. `omtre-meta`
  3. `omtre-session-insight`
  4. `omtre-spec-bootstrap`
- All three downstream assertions (lines 282, 378, 547) consume the updated 4-entry array, confirming the regression introduced when `omtre-channel` was bundled is resolved.

---

## Summary

Pre-ship gates green: typecheck, lint, and the full test suite (1488 tests across both workspace packages) all pass with exit code 0. The previously failing `platforms.test.ts` BUNDLED_SKILL_NAMES expectation now reflects the 4 bundled skills (including `omtre-channel`).
