# Implementation Plan

## Steps

- [ ] Add OpenCode sub-agent detection helper for `input.agent`.
- [ ] Make `session-start.js` skip `omtre-implement`, `omtre-check`, and `omtre-research`.
- [ ] Make `inject-workflow-state.js` skip the same Trellis sub-agents.
- [ ] Add JS single-session fallback to `TrellisContext.getActiveTask()`.
- [ ] Add `Active task: <path>` prompt fallback to `inject-subagent-context.js`.
- [ ] Make sub-agent context readers resolve task paths through `ctx.resolveTaskDir()`.
- [ ] Add `<!-- omtre-hook-injected -->` marker to OpenCode injected sub-agent prompts.
- [ ] Add OpenCode regression tests.
- [ ] Update `.omtre/spec/cli/backend/platform-integration.md`.
- [ ] Run targeted tests, lint, and typecheck.

## Validation Commands

```bash
pnpm --filter omtre test -- test/templates/opencode.test.ts
pnpm --filter omtre lint
pnpm --filter omtre typecheck
```

## Rollback

Revert changes to:

- `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js`
- `packages/cli/src/templates/opencode/plugins/session-start.js`
- `packages/cli/src/templates/opencode/plugins/inject-workflow-state.js`
- `packages/cli/src/templates/opencode/lib/omtre-context.js`
- `packages/cli/test/templates/opencode.test.ts`
- `.omtre/spec/cli/backend/platform-integration.md`

