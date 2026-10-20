# Design: Cap sub-agent context injection

## Config schema (`.omtre/config.yaml`)

```yaml
# Sub-agent context injection limits (bytes). 0 disables a limit.
#
# context_injection:
#   max_file_bytes: 32768        # per implement.jsonl / check.jsonl referenced file
#   max_artifact_bytes: 65536    # per task artifact (prd.md / design.md / implement.md)
#   max_total_bytes: 131072      # whole injected payload; overflow degrades to index lines
```

Defaults live in code on both sides; the config section ships commented-out in the
`config.yaml` template (matches `codex.dispatch_mode` precedent). Parsing:

- Python: extend `scripts/common/config.py` with `get_context_injection_limits()`
  returning a dict with the three ints. Reuses the existing no-dependency parser
  (nested-section support already exists for `channel.worker_guard`).
- TS (Pi extension): the extension does not read `config.yaml` today. Add a small
  `readContextInjectionLimits(repoRoot)` that scans `.omtre/config.yaml` for the
  `context_injection:` block with line-based parsing of exactly these three keys
  (`key: int`, `#` comments stripped). Not a general YAML parser — mirrors the
  Python parser's semantics for this section only.

Invalid values (non-int, negative) fall back to the default for that key.

## Shared behavioral contract (both implementations MUST match)

Definitions: `F` = max_file_bytes, `A` = max_artifact_bytes, `T` = max_total_bytes.
A value of 0 means "no limit" for that knob.

1. Files are processed in today's existing order (JSONL order, then prd → design →
   implement.md). Ordering does not change.
2. For each JSONL-referenced file: read up to `F` bytes (UTF-8-safe boundary). If
   truncated, append:
   `\n[Trellis: truncated at <F> bytes — read <path> for the full content]`
3. For each task artifact: same rule with `A`.
4. Total accounting: sum of bytes actually emitted (content + notices + headers).
   Before inlining each file, if `emitted + would_add > T`, do not inline; emit an
   index line instead:
   `[Trellis: not inlined (total context limit reached) — <path> (<size> bytes): <reason>]`
   Artifacts (prd/design/implement.md) participate in the same accounting; JSONL
   files are processed first, so artifacts can only be index-degraded if JSONL
   content already consumed the budget — acceptable, since ordering is preserved
   and the notice tells the agent what to read.
5. Directory entries (`type: directory` handling in `read_directory_contents`):
   each contained file obeys `F`; the running total obeys `T`; existing
   `max_files` behavior unchanged.
6. UTF-8 safety: truncate at the last complete code point ≤ the cap.
   - Python: `data[:F]` on bytes, then back off while `(b & 0xC0) == 0x80`.
   - TS: `Buffer.prototype.slice` + back-off with the same continuation-byte scan,
     then `toString("utf-8")`.

"Behaviorally identical" means: same files inlined vs indexed, same truncation
points, same notice texts. Byte-identical output for inputs under all caps.

## JSONL hygiene warnings (`_validate_jsonl`)

Extend `_validate_jsonl` in `scripts/common/task_context.py` (template + dogfood):

- **Code-file heuristic**: warn when the entry's extension is in
  `{.ts,.tsx,.js,.jsx,.mjs,.cjs,.py,.go,.rs,.java,.rb,.c,.cc,.cpp,.h}` AND the path
  is not under `.omtre/spec/`, `docs`/`docs-site`, or the task's own directory.
  Message: `looks like a code file — implement/check.jsonl should reference
  spec/research docs; agents read code themselves`.
- **Size warning**: warn when the file's size exceeds `max_file_bytes` from
  `get_context_injection_limits()` (skip when the limit is 0). Message names the
  size, the cap, and that injection will truncate it.
- Warnings are yellow, never increment `errors`, never change the exit code.

## Touched files

| File | Change |
| --- | --- |
| `packages/cli/src/templates/shared-hooks/inject-subagent-context.py` | caps + degradation + notices |
| `packages/cli/src/templates/trellis/scripts/common/config.py` | `get_context_injection_limits()` |
| `packages/cli/src/templates/trellis/config.yaml` | commented `context_injection:` section |
| `packages/cli/src/templates/pi/extensions/trellis/index.ts.txt` | caps + config reader |
| `packages/cli/src/templates/trellis/scripts/common/task_context.py` | hygiene warnings in `_validate_jsonl` |
| Dogfood copies (`.omtre/scripts/common/config.py`, `.claude`/... hooks) | byte-identical sync |

Dogfood/template copies must stay byte-identical (regression.test.ts asserts this
pattern for other files; follow it).

## Risks

- **Two-implementation drift** is the main risk. Mitigation: the contract above is
  the source of truth; tests on both sides use the same fixture matrix (small file,
  file exactly at cap, file 1 byte over cap, multi-byte char straddling the cap,
  total-cap overflow with 3 files, `0`-disabled).
- Pi extension is 1700 lines with its own test surface (`pi-extension` tests exist
  under `packages/cli/test/`); keep the new logic in small pure functions
  (`truncateUtf8`, `budgetedInline`) so they are unit-testable without spawning Pi.
- Existing behavior must not shift for under-cap projects (byte-identity acceptance
  criterion protects this).
