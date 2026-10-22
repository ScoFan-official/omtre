# Upstream notes

omtre is an independent project. It started from Trellis and keeps a documented
lineage, but its version line, roadmap, product surface, and design principles
are its own.

## Lineage

- Upstream: <https://github.com/mindfold-ai/trellis>
- Initial baseline: upstream `0.6.17` (tag `upstream-0.6.17` → `833a5846d18ad7a5ccd8c41c876d89cc936f5fd9`).
- Last pre-1.0 fork release: `0.6.18-ohmy.5` (historical tag `cli-v0.6.18-ohmy.5`).
- Independent line: starts at `1.0.0`.
- License: AGPL-3.0. Upstream copyright remains with Mindfold LLC; see `LICENSE` and `NOTICE`.

## What is inherited

The AGPL-3.0 license, the upstream copyright, and the original workflow
concepts. Everything a user sees — the `omtre`/`omt` binaries, the `.omtre/`
layout, the documentation, the artwork, the release cadence — is maintained by
omtre.

## Sync policy

Upstream is an input, not a release train.

1. Fetch `upstream/main` into a dedicated sync branch.
2. Review commits since the last baseline. Prefer small, focused merges.
3. Resolve conflicts in omtre-native surfaces — do not reintroduce upstream
   paths, package names, version suffixes, or branding.
4. Run the full gate: `pnpm check:legacy-names`, `pnpm typecheck`, `pnpm lint`,
   `pnpm --filter omtre lint:py`, and the relevant tests.
5. Record the new baseline tag (`upstream-<version>`) only after the merge is
   verified.

## Release policy

- omtre uses independent semantic versioning. Do not copy upstream version
  numbers into `packages/*/package.json` or release tags.
- Tag format: `cli-v<version>` (for example `cli-v1.0.0`). The `cli-` prefix
  identifies the CLI release channel; the number belongs to omtre.
- Channels:
  - npm: `omtre` (primary).
  - GitHub Release: `omtre-<version>.tgz` (fallback and offline install).
- `@omtre/core` is bundled into the CLI tarball. Publishing it separately is
  optional and does not change the CLI install path.

## Historical naming

The pre-1.0 fork used `-ohmy.N` versions and `oh-my-trellis` naming. Those are
historical records, not the current product identity. `omtre migrate` still
recognizes Trellis 0.6.x projects; that compatibility is intentional and lives
in the migration code and tests, not in the product surface.

## Attribution rules

- Keep `LICENSE`, `COPYRIGHT`, and `NOTICE` intact.
- Keep the lineage section in `README.md` and the upstream link in this file.
- Do not use upstream names, logos, screenshots, community links, or badges as
  omtre branding.
- When a document needs to mention the upstream project, use the attribution
  markers recognized by `scripts/check-legacy-names.mjs` so the gate can
  distinguish lineage from accidental branding.
