# PRD: Cap sub-agent context injection with configurable limits

Fixes #441.

## Problem

Sub-agent context injection inlines the **complete body of every file** referenced by
`implement.jsonl` / `check.jsonl`, plus full `prd.md` / `design.md` / `implement.md`,
with no limits on individual file size, file count, or aggregate payload. A single
2 MiB referenced file lands verbatim in the first model request. On Pi the payload can
also enter the main-session system prompt before dispatch.

Two parallel implementations are affected:

- `packages/cli/src/templates/shared-hooks/inject-subagent-context.py` (Claude Code,
  Cursor, Codex, Copilot, Droid, ZCode + dogfood copies)
- `packages/cli/src/templates/pi/extensions/trellis/index.ts.txt` (Pi extension)

## Decision (approved by maintainer)

**Option B — keep inlining, add tiered limits, degrade overflow to index entries.**
Pure index-mode (inject paths only, agent reads on demand) was rejected: class-2
pull-based platforms follow read instructions unreliably, and normal curated tasks
would regress.

## Requirements

1. **Per-file cap** for JSONL-referenced files: default 32 KiB. Oversized files are
   truncated at the cap with an explicit trailing notice naming the source path.
2. **Per-artifact cap** for `prd.md` / `design.md` / `implement.md`: default 64 KiB,
   same truncation notice.
3. **Total payload cap**: default 128 KiB. Once cumulative injected bytes reach the
   cap, remaining files are **not inlined**; they degrade to index lines
   (path + reason + size) so the agent can read them on demand.
4. **UTF-8-safe truncation**: never split a multi-byte sequence.
5. **Configurable** via `.omtre/config.yaml` under a `context_injection:` section;
   `0` disables the corresponding limit (matches `channel.worker_guard` convention).
6. **Both implementations behave identically** for the same inputs and config.
7. Directory entries in JSONL (`read_directory_contents`) respect the same per-file
   and total caps.

8. **JSONL hygiene warnings** in `task.py validate` (and surfaced wherever validate
   runs): warn — never block — when an entry looks like a code file rather than a
   spec/research document (extension in a code set like `.ts/.js/.py/.go/...` AND
   path outside `.omtre/spec/`, `docs`, or the task's own directory), and when an
   entry's file size exceeds the per-file injection cap (ties into requirement 1,
   using the same configured limits).

## Non-goals

- No change to what gets curated into the JSONL files or the curation workflow.
- No env-var or CLI-flag override layer (config.yaml only; add later if requested).
- No token-based accounting (bytes only).

## Acceptance criteria

- A 2 MiB file in `implement.jsonl` injects ≤ 32 KiB + truncation notice; total
  payload never exceeds 128 KiB (defaults).
- Files beyond the total cap appear as index lines with path, reason, and byte size.
- Payload for a typical curated task (all files under caps) is byte-identical to
  today's output for the shared Python hook. The Pi extension intentionally
  converges its block format (`=== path ===` headers) to the Python format as part
  of the cross-implementation contract — an approved deviation from its old
  TS-only format.
- Config overrides in `.omtre/config.yaml` change the behavior in both the Python
  hook and the Pi extension; `0` restores unlimited behavior.
- Truncation never produces invalid UTF-8 (multi-byte boundary test).
- Existing test suites stay green; new tests cover the three cap types, degradation,
  UTF-8 safety, and config parsing in both implementations.
- `task.py validate` on a jsonl containing a `src/**/*.ts` entry prints a code-file
  warning and still exits 0; an oversized entry prints a size warning; a normal
  spec-only manifest stays warning-free.
