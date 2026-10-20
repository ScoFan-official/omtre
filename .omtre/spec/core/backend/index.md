# Core Backend Guidelines

These guidelines apply to `packages/core`.

## Purpose

`@omtre/core` owns reusable SDK/domain primitives that must stay
independent of CLI rendering and process-control concerns.

## Source Map

| Area | Path | Purpose |
| --- | --- | --- |
| Root exports | `packages/core/src/index.ts` | Package root public API. Keep this small. |
| Channel API | `packages/core/src/channel/` | Durable channel/event APIs, reducers, workers, inbox, runtime contracts. |
| Mem API | `packages/core/src/mem/` | Persisted AI session readers, search, filtering, dialogue extraction, and project aggregation. |
| Task API | `packages/core/src/task/` | Reusable task record, schema, phase, and path helpers. |
| Testing API | `packages/core/src/testing/` | Public test helpers intended for package consumers. |
| Tests | `packages/core/test/` | Core-owned unit/integration coverage. |

## Contracts

- Core APIs must not print terminal output, call `process.exit`, parse CLI argv,
  or depend on Chalk / Commander / Inquirer.
- CLI code must import core through public exports such as
  `@omtre/core/channel`, not deep paths under `packages/core/src`.
- Public subpaths must be declared explicitly in `packages/core/package.json`.
- Core and CLI publish together with the same version.
- Detailed package-boundary rules currently live in
  `.omtre/spec/cli/backend/omtre-core-sdk.md`; keep this file and that
  boundary spec consistent until the detailed core rules are split fully under
  `.omtre/spec/core/`.

## Pre-Development Checklist

- Read `.omtre/spec/cli/backend/omtre-core-sdk.md` before editing
  `packages/core/**` or moving logic between CLI and core.
- Read `.omtre/spec/cli/unit-test/conventions.md` before adding or changing
  core tests.
- For channel changes, also read
  `.omtre/spec/cli/backend/commands-channel.md`.
- For mem changes, also read `.omtre/spec/cli/backend/commands-mem.md`.

## Quality Check

Run the package-scoped checks that match the change:

```bash
pnpm --filter @omtre/core lint
pnpm --filter @omtre/core typecheck
pnpm --filter @omtre/core test
```

For changes that affect CLI imports or release packaging, also run the root
typecheck path so CLI declaration resolution is exercised:

```bash
pnpm typecheck
```
