# Design: no-trellis skip keyword

## Config

- New `prompt_injection.skip_keyword` read via `common.config` (Python) —
  add `get_prompt_injection_config()` beside `get_context_injection_limits()`,
  same parser, same invalid-value fallback (non-string → default).
- Default `"no-trellis"`; empty string disables.

## Matching rule (contract)

- Case-insensitive, word-boundary regex: `(?<![\w-])no-trellis(?![\w-])`
  (hyphen counts as a word char so `no-trellisx`/`xno-trellis` and
  `foo-no-trellis` don't match, but punctuation/whitespace boundaries do).
- Applied to the raw prompt string from the hook payload.

## Injection points

| Runtime | File | Prompt available? | Action |
| --- | --- | --- | --- |
| Shared Python hook | `shared-hooks/inject-workflow-state.py` | yes (hook JSON `prompt` field — verify exact key per platform payloads already parsed there) | check keyword right after payload parse; exit 0 with empty output on hit |
| OpenCode plugin | `opencode/plugins/inject-workflow-state.js` | verify (plugin event) | same rule if prompt visible; else document gap |
| Pi extension | `pi/extensions/trellis/index.ts.txt` | verify (persisted-message model differs) | same rule if applicable; else document gap |

Keyword check must run BEFORE any expensive work (task resolution, file reads).

## Out of scope

`session-start.py`, `inject-subagent-context.py`, `inject-shell-session-context.py`.

## Tests

Extend the python-probe pattern: spawn `inject-workflow-state.py` with crafted
hook JSON (there are existing tests doing this — find and follow them), assert
empty stdout on keyword hit, normal output otherwise. Config matrix via temp
`.omtre/config.yaml`.
