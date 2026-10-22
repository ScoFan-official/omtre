# Changelog

omtre uses independent semantic versioning. The first independent release is
`1.0.0`; pre-1.0 fork history lives in [docs/changelog-fork.md](./docs/changelog-fork.md).

## 1.0.0 — 2026-10-21

Independent identity and distribution.

### Brand and documentation

- Rewrote the English and Chinese READMEs around omtre's own positioning,
  install path, workflow, and design principles.
- Added `docs/design.md` (design commitments) and `docs/upstream.md` (lineage,
  sync policy, independent release policy).
- Added `NOTICE`; upstream attribution now lives in the license/lineage
  surfaces instead of the product header.
- Replaced the upstream hero and workflow artwork with omtre-native SVG assets;
  removed upstream demo GIFs, memes, community QR codes, screenshots, and
  wordmark files.
- Consolidated Chinese docs: `README.zh-CN.md` is the product README,
  `docs/pack.zh-CN.md` is the skills/marketplace guide, and `README_CN.md` is a
  short redirect.

### Product surface

- Kept the `omtre`/`omt` binaries, `.omtre/` layout, and `figlet` banner; the
  banner tagline is now omtre's own.
- Cleaned the dogfood `.omtre/` config and agent cards.
- Updated installed platform copies (`.claude/`, `.agents/`, `.codex/`,
  `.cursor/`) so contributor skills and commands refer to omtre, not upstream.
- Removed upstream community links and badges from the product docs.

### Release and distribution

- Set the independent version line to `1.0.0` across the CLI and core packages.
- Release tags are `cli-v1.0.0`; the `cli-v` prefix identifies the CLI channel,
  not an upstream version.
- npm is the primary channel (`npm install -g omtre`); the GitHub Release
  `omtre-1.0.0.tgz` remains the standalone fallback.
- Kept `@omtre/core` bundled into the CLI tarball.

### Quality gates

- Extended `check:legacy-names` to reject bare upstream names on active
  surfaces while allowing explicit attribution, migration compatibility,
  historical records, and vendored catalog content.
- Added a banner regression check for the independent tagline.

## Prior history

- Fork history (0.6.x, including `-ohmy.N` releases): [docs/changelog-fork.md](./docs/changelog-fork.md)
- Pack history: [docs/pack-changelog.md](./docs/pack-changelog.md)
