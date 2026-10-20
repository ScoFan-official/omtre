# Implementation plan

Ordered checklist. Each step names its verification.

## 1. Python side

- [ ] `config.py`: add `get_context_injection_limits()` (defaults 32768 / 65536 /
      131072; `0` = unlimited; invalid → default).
      → verify: unit test via python probe (spawn, print dict for crafted config.yaml).
- [ ] `inject-subagent-context.py`: add `truncate_utf8(data: bytes, cap: int)` and
      budget accounting in `read_file_content` / `read_directory_contents` /
      `get_agent_context` / `get_implement_context` / `get_check_context` per the
      design contract (JSONL first, then artifacts; degradation to index lines).
      → verify: new probe tests — oversize file truncated + notice; total-cap
      overflow degrades to index line; multi-byte boundary; `0` restores full inline;
      under-cap output byte-identical to current behavior (golden comparison).
- [ ] `config.yaml` template: append commented `context_injection:` section.
      → verify: template test asserts section present and commented.

- [ ] `task_context.py`: hygiene warnings in `_validate_jsonl` (code-file heuristic +
      over-cap size warning; yellow, non-blocking, exit code unchanged).
      → verify: probe tests — code path warns + exit 0; oversized file warns; clean
      spec manifest silent.

## 2. Pi extension (TS)

- [ ] Add `truncateUtf8(buf, cap)` and `readContextInjectionLimits(repoRoot)` as
      exported pure functions; wire into `buildContext()` with the same ordering
      and notice strings as Python.
      → verify: unit tests on the pure functions with the same fixture matrix as
      the Python probes (same inputs, assert same inlined/indexed decisions and
      notice text).

## 3. Sync copies

- [ ] Sync template ↔ dogfood copies byte-identically (`.omtre/scripts/common/
      config.py`, platform hook copies of inject-subagent-context.py, root
      `.omtre/config.yaml` untouched unless template changed).
      → verify: existing byte-parity assertions in regression.test.ts pass;
      `git diff --stat` shows only expected files.

## 4. Full-scope check

- [ ] `pnpm build && pnpm test && pnpm lint && pnpm typecheck` all green.
- [ ] Manual repro from #441: 2 MiB synthetic file in implement.jsonl → inspect
      generated context ≤ caps with notices (run the hook directly with a temp task).

## Review gates

- After step 1: confirm notice wording + config key names before mirroring into TS
  (they are contract, changing later means touching both sides again).

## Rollback

Single revert of the feature commit restores current behavior; no migrations, no
config written to user projects (section ships commented).
