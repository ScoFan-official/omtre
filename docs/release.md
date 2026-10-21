# Releasing omtre

omtre ships one version through two channels:

- **npm** — `omtre` (primary): `npm install -g omtre`
- **GitHub Release** — `omtre-<version>.tgz` (standalone fallback)

`@omtre/core` is bundled into the CLI tarball. Publishing it separately is
optional and does not gate the CLI install.

## Before the first release

1. Use an npm account with publish rights to the `omtre` package.
2. Optional: create the npm org `omtre` if you also want to publish
   `@omtre/core`.
3. Add a repository secret named `NPM_TOKEN`: a granular access token with
   publish rights for `omtre` (and `@omtre/core` if used). Keep 2FA enabled on
   the account.
4. Confirm the version pair and the tag:

   ```bash
   node packages/cli/scripts/release-preflight.js check-versions
   ```

   Both packages must be on the same version; the release tag is
   `cli-v<version>`.

## Release

1. Merge the release commit to `main`.
2. Tag and push:

   ```bash
   git tag cli-v1.0.0
   git push origin main
   git push origin cli-v1.0.0
   ```

3. GitHub Actions handles both channels:
   - `cli-release.yml` builds and attaches `omtre-<version>.tgz`.
   - `publish.yml` publishes `omtre@<version>` to npm, then verifies it.

4. For the first publish, or if the tag-triggered run is unavailable, dispatch
   the workflow manually:

   - Actions → **Publish to npm** → **Run workflow**
   - Select the tag `cli-v1.0.0`, not a branch: `check-versions --require-tag`
     fails when `GITHUB_REF_NAME` is a branch
   - Leave `publish_core` off unless the npm org `omtre` exists

5. Verify the public registry and a clean install:

   ```bash
   npm view omtre@1.0.0 version dist-tags
   npm i -g omtre@1.0.0
   omtre --version
   ```

6. Optional core publish: create the npm org `omtre`, then re-run the workflow
   with `publish_core=true`. The CLI publish does not depend on it.

## Version policy

- omtre uses independent semantic versioning. Do not copy upstream version
  numbers into `packages/*/package.json` or release tags.
- The root `VERSION` file is the frozen legacy skills-pack line (`1.3.0`); it
  is not the omtre product version. The product version lives in
  `packages/cli/package.json` and `packages/core/package.json`.
- Tag format: `cli-v<version>`. The `cli-` prefix identifies the release
  channel; the number belongs to omtre.
- Lineage, baseline tags, and the sync policy are documented in
  [upstream.md](./upstream.md).

## Security

- Never commit tokens or `.npmrc` files.
- Use a granular token with publish rights; rotate it if it was shared.
- npm provenance is enabled for both packages (`NPM_CONFIG_PROVENANCE=true`).
- Do not publish official packages locally; use the CI workflow so the
  provenance record and idempotency checks stay intact.
