# PRD: Skip per-turn context injection via `no-trellis` keyword

Fixes #427.

## Problem

Every user prompt in a Trellis project gets the per-turn `<workflow-state>`
injection, even for questions unrelated to the workflow. Users want a one-turn
escape hatch.

## Requirements

1. When the user prompt contains the skip keyword (default `no-trellis`) as a
   standalone word (word-boundary match, case-insensitive), the per-turn
   injection emits **nothing** for that turn. Next turn is unaffected.
2. Keyword configurable in `.omtre/config.yaml`:
   ```yaml
   # prompt_injection:
   #   skip_keyword: "no-trellis"   # "" disables the escape hatch entirely
   ```
   Ships commented; default lives in code (same pattern as `context_injection`).
3. Scope: ONLY the per-turn prompt injection (`inject-workflow-state.py` and
   runtime equivalents). SessionStart injection and sub-agent context injection
   are NOT affected — the keyword is about muting chat-turn noise, not about
   disabling Trellis.
4. Coverage: the shared Python hook (all promptSubmit platforms) is mandatory.
   OpenCode plugin / Pi extension: cover them IF their event exposes the user
   prompt text; if a runtime cannot see the prompt, document the gap in the
   task notes instead of hacking around it.

## Acceptance criteria

- Prompt "no-trellis how do I write this regex" → hook exits with empty output;
  same prompt without the keyword → normal injection (existing behavior,
  byte-identical).
- "no-trellisfoo" / "foo-no-trellis" do NOT trigger the skip (word-boundary);
  "path/no-trellis.md" DOES trigger (slash/dot are boundaries — an accepted
  false-positive: a turn mentioning that filename is muted, which is harmless).
- `skip_keyword: "off-topic"` makes `off-topic` the trigger and `no-trellis`
  inert; `skip_keyword: ""` disables skipping.
- Tests cover: default keyword hit/miss, word-boundary negatives, custom
  keyword, disabled, and that SessionStart/sub-agent injection paths ignore
  the keyword.
- Docs: config.yaml template section comment is self-explanatory.

## Notes

### Coverage gaps

- **Pi Agent (`src/templates/pi/extensions/trellis/index.ts.txt`) — NOT covered.**
  Per `.omtre/spec/cli/backend/platform-integration.md` ("Class-3 injection
  points (Pi extension)"), Pi's extension explicitly does **not** register a
  Trellis `input` handler: "Trellis must not rewrite submitted user text;
  context identity is resolved in `before_agent_start` and `tool_call` where
  it is needed." The only per-turn injection point, `before_agent_start`,
  receives `event.systemPrompt` and context-key inputs (`session_id` /
  `sessionId` / etc.) — it does not carry the raw user-typed prompt text, and
  its output (`systemPrompt` / persisted `message`) must stay byte-identical
  across turns for provider prefix caching (see "Cache-stability invariant" in
  the same spec section). There is no existing, architecturally-sanctioned
  place in the Pi extension to read the current turn's prompt text without
  either (a) registering a new `input` handler that the spec forbids for
  Trellis runtime context, or (b) breaking the systemPrompt cache-stability
  contract. Implementing the skip keyword for Pi was intentionally left out
  rather than hacking around this — the `<workflow-state>` breadcrumb keeps
  firing on every turn for Pi regardless of the `no-trellis` keyword.
- **OpenCode plugin (`src/templates/opencode/plugins/inject-workflow-state.js`)
  — covered.** `chat.message(input, output)` exposes the user's submitted text
  via `output.parts` (the existing `session-start.js` / `inject-workflow-state.js`
  code already reads `parts[textPartIndex].text` as `originalText` before
  prepending injected context), so the same word-boundary/case-insensitive
  regex rule was implemented there, gated on the same `.omtre/config.yaml`
  `prompt_injection.skip_keyword`.
