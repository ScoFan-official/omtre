---
name: contribute
description: "Guide for contributing to omtre: first-party skills, marketplace skills and spec templates, docs, and pull requests. Use when adding or updating a skill, template, workflow, or documentation page."
---

# Contributing to omtre

omtre is a single repository. There is no separate docs site or docs repo;
user-facing docs live in `README.md`, `README.zh-CN.md`, and `docs/`.

## Where things live

| What | Where |
| --- | --- |
| First-party skills | `skills/<name>/SKILL.md` |
| Marketplace skills | `marketplace/skills/<name>/SKILL.md` |
| Spec templates | `marketplace/specs/<name>/` |
| Workflows | `marketplace/workflows/<name>/` |
| Registry | `marketplace/index.json` |
| Product docs | `README.md`, `README.zh-CN.md`, `docs/` |
| CLI code | `packages/cli/src/` |
| Core SDK | `packages/core/src/` |

## Adding a first-party skill

1. Create `skills/<name>/SKILL.md`; keep the directory name and the
   frontmatter `name` identical.
2. Put long references under `skills/<name>/references/` and link them from
   `SKILL.md`; do not duplicate the same text in several files.
3. If the skill belongs to the recommended set, add it to the install list in
   `docs/pack.md` and `docs/pack.zh-CN.md`.
4. Test it in a scratch repository before opening a PR.

## Adding a marketplace skill or spec template

1. Create the skill under `marketplace/skills/<name>/` or the template under
   `marketplace/specs/<name>/`.
2. Add an entry to `marketplace/index.json` with `id`, `type`, `name`,
   `description`, `path`, and `tags`.
3. Verify installation:
   ```bash
   python scripts/install.py --platform <platform> --target <tmp-dir>
   ```
4. Update the relevant section of `docs/pack.md` and `docs/pack.zh-CN.md` if the
   recommended set changes.

## Documentation

- Keep English and Chinese user-facing docs in sync.
- Verify every command you document by running it.
- Attribute vendored content in `marketplace/ATTRIBUTION.md` or
  `catalog/ATTRIBUTION.md`.
- Keep lineage statements in `NOTICE` and `docs/upstream.md`; do not put
  upstream branding back into the product surface.

## Before a PR

```bash
pnpm check:legacy-names
pnpm typecheck
pnpm lint
pnpm --filter omtre lint:py
```

Run the relevant tests for the area you changed. If a test cannot run locally,
say so in the PR and let CI cover it.

## Submitting a PR

1. Branch from `main`.
2. Commit with a conventional message, for example
   `docs: explain the task lifecycle`.
3. Open a PR and list the verification commands you actually ran.
