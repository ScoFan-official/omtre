# Release Process

Release, versioning, and npm publishing rules for the omtre monorepo.

---

## Channels

| Channel | Artifact | Notes |
|---|---|---|
| npm | `omtre` | Primary install path: `npm install -g omtre`. |
| GitHub Release | `omtre-<version>.tgz` | Standalone fallback; contains the bundled core. |
| npm (optional) | `@omtre/core` | Bundled into the CLI; published separately only when explicitly requested. |

If both npm packages are published, they share the exact version and dist-tag.
The CLI install does not require a separate core publish.

---

## CI-only publishing

Official npm publishing must happen through `.github/workflows/publish.yml`.

Do not run `npm publish` or `pnpm publish` locally for official omtre packages.
Local machines may run `pnpm pack`, `release-preflight`, tests, lint, typecheck,
and dry-run checks, but not package publication.

If a CI publish looks partial or inconsistent:

1. Inspect the GitHub Actions publish run.
2. Verify public npm visibility:
   ```bash
   npm view omtre@<version> version dist-tags --json --registry=https://registry.npmjs.org/
   ```
3. Fix the workflow or release scripts.
4. Re-run the CI path or move the tag after the fix when the same version is
   still the intended release artifact.

Do not compensate by publishing a missing package locally. That creates a
release artifact without CI provenance and hides the workflow failure from the
next release.

The publish workflow verifies the CLI after publish with:

```bash
node packages/cli/scripts/release-preflight.js verify-npm --package cli
```

When `@omtre/core` is published, also verify it with `--package all`.

---

## Version invariants

| Invariant | Rule |
|---|---|
| Shared version | `packages/cli/package.json` and `packages/core/package.json` must have the same `version`. |
| Shared tag | Git tag `cli-v<version>` must match both package versions. |
| Shared npm dist-tag | `beta` for `-beta.N`, `rc` for `-rc.N`, `alpha` for `-alpha.N`, `latest` for GA. |
| Source dependency | CLI source depends on core with `workspace:*`. |
| Packed dependency | Published CLI package must depend on `@omtre/core` with the exact release version. |

`packages/cli/scripts/release-preflight.js` is the source of truth for these checks.

Required gates:

```bash
node packages/cli/scripts/release-preflight.js check-versions
node packages/cli/scripts/release-preflight.js verify-packed-cli
node packages/cli/scripts/release-preflight.js publish-plan
```

---

## Branch and release tracks

| Track | Branch pattern | Version pattern | npm tag | Notes |
|---|---|---|---|---|
| Stable | `main` | `X.Y.Z` | `latest` | Patch/minor/major GA releases. |
| Beta | `feat/vX.Y.Z-beta` or equivalent long-lived beta branch | `X.Y.Z-beta.N` | `beta` | Feature incubation. |
| RC | release candidate branch or the stabilized beta branch | `X.Y.Z-rc.N` | `rc` | Pre-GA validation. |
| GA promotion | stable release branch / `main` | `X.Y.Z` | `latest` | Promote the release candidate into the stable channel. |

A new beta cycle starts from the current stable baseline and uses the next
minor or major version, for example `1.1.0-beta.0` after `1.0.x`.

Stable fixes normally flow from `main` to beta/rc by cherry-pick. Beta-only
features do not flow back to `main` by cherry-pick; rewrite them as
stable-ready commits when needed.

---

## Release command sequence

The root release scripts delegate to the CLI package:

```bash
pnpm release
pnpm release:beta
pnpm release:rc
pnpm release:promote
```

`packages/cli/scripts/release.js` runs:

1. `check-manifest-continuity`
2. `check-docs-changelog --type beta|rc|promote` for prerelease/promotion tracks
3. core tests
4. CLI tests
5. pre-release commit excluding `.omtre`
6. `bump-versions.js <type>` to update both package versions together
7. `release-preflight check-versions`
8. version commit with the version string as the commit message
9. git tag `cli-v<version>`
10. push branch and tags
11. GitHub Actions:
    - `cli-release.yml` builds and attaches `omtre-<version>.tgz`
    - `publish.yml` publishes `omtre` to npm and verifies it

The release script does not publish locally. The pushed tag starts both
distribution channels.

---

## Publish workflow sequence

`.github/workflows/publish.yml` runs on `cli-v*` tag pushes and on manual
dispatch. It is idempotent for reruns on the same tag.

Required order:

1. install dependencies
2. `release-preflight check-versions --require-tag`
3. `pnpm typecheck`
4. `pnpm build`
5. `pnpm test`
6. `release-preflight verify-packed-cli`
7. `release-preflight publish-plan --github`
8. publish `omtre` if missing
9. `release-preflight verify-npm --package cli`
10. publish `@omtre/core` only when `publish_core=true` and it is missing

The CLI publishes first because it is self-contained; the optional core package
does not gate the CLI install.

---

## Manifest continuity across branches

Each release branch maintains its own
`packages/cli/src/migrations/manifests/<version>.json`. The CLI update logic
walks the manifest chain between `fromVersion` and `toVersion`, so every
published version that a user can upgrade through must have a local manifest on
the release branch.

When a stable patch manifest is missing from a beta branch:

```bash
git show main:packages/cli/src/migrations/manifests/<version>.json \
  > packages/cli/src/migrations/manifests/<version>.json
git add packages/cli/src/migrations/manifests/<version>.json
git commit -m "chore: restore manifest <version> from main"
```

Restore published manifests deliberately. Do not auto-merge whole manifest
directories across release branches, because branch-specific manifests can
mention files that do not exist on the other branch.

---

## Artifact verification for release-claimed assets

Any changelog, docs page, or marketplace entry that says a feature is
"bundled", "installed automatically", or "included with omtre" must be verified
against the built package artifact, not only against the source tree.

Before tagging a release that adds or changes a bundled template, skill,
workflow, hook, script, or generated platform asset:

1. Run the CLI build.
2. Run `npm pack --dry-run --json` from `packages/cli/` and check the expected
   `dist/templates/**` paths are present.
3. Use the built binary (`node packages/cli/bin/omtre.js`) in a fresh temp git
   repository and run the user-facing command that should install the asset.
4. Check both the generated files and `.omtre/.template-hashes.json` for the
   expected paths.
5. Run `omtre update --dry-run` from the temp repository and confirm it reports
   the project is already up to date.

A source file existing on another branch, in `marketplace/`, or in a docs
directory is not evidence that the npm package contains it.

---

## Pre-release checklist

- [ ] Worktree is clean except intentional release changes.
- [ ] Relevant coding specs have been read.
- [ ] Manifest exists for the target version.
- [ ] `CHANGELOG.md` has the release entry.
- [ ] `node packages/cli/scripts/release-preflight.js check-versions` passes.
- [ ] `node packages/cli/scripts/release-preflight.js verify-packed-cli` passes.
- [ ] Release-claimed bundled assets are verified in `npm pack --dry-run --json`
      and a fresh temp-directory `omtre init` / `omtre update --dry-run` smoke test.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass or the blocker is recorded.
- [ ] Breaking releases include `migrationGuide` and `aiInstructions` in the manifest.
- [ ] Official package publication is left to CI.

---

## Cross-references

- Core/CLI code ownership and package boundaries: `omtre-core-sdk.md`
- Manifest format and migration types: `migrations.md`
- Native dependency policy: `quality-guidelines.md`
