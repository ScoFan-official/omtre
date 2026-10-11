# Fork Sync — oh-my-trellis

This fork (`ScoFan-official/trellis`, published as `oh-my-trellis`) tracks
`mindfold-ai/trellis` upstream. All fork-specific customization is concentrated
in `packages/cli` and is committed with the `[oh-my]` prefix so the delta is
greppable: `git log --oneline --grep '^\[oh-my\]'`.

## Baseline

- Base release: upstream `0.6.17`
- Baseline tag: `upstream-0.6.17` → `833a5846d18ad7a5ccd8c41c876d89cc936f5fd9`
- Fork commits live on top of upstream `main` (currently a few commits past the
  tag — that's fine; the tag records the *release* baseline, not the merge
  point).

## The `[oh-my]` surface

Customization lives in these files (all under `packages/cli/` unless noted):

| Area | Files |
|---|---|
| Agent role cards | `src/templates/trellis/agents/{implement,check}.md` |
| Task store | `src/templates/trellis/scripts/common/task_store.py` (`.devin` in `_SUBAGENT_CONFIG_DIRS` + comments) |
| `oh-my` workflow | `src/templates/trellis/workflow-oh-my.md`, `src/utils/workflow-resolver.ts` (`OH_MY_WORKFLOW_ID` / `DEFAULT_WORKFLOW_ID`) |
| Managed workflow id | `src/commands/init.ts`, `src/commands/workflow.ts`, `src/commands/update.ts`, `src/configurators/workflow.ts` (oh-my is hash-managed; `native` is user-managed in this fork) |
| Devin templates | `src/templates/devin/` (start override, oh-my-update workflow, check skill dispatch note in `src/configurators/devin.ts`) |
| CLI identity | `packages/cli/package.json`, `src/commands/upgrade.ts`, `src/commands/update.ts` (GitHub releases lookup), `src/cli/index.ts` (help text) |
| Delivery layer (CLAI-1…10) | `src/templates/trellis/scripts/common/clai_delta.py` (all Python divergence, thin call sites elsewhere) + the two zero-conflict new files `common/frontier.py`, `common/verify.py`; the runner is new CLI surface: `src/commands/run.ts`, `src/commands/run/{worker,ledger}.ts` |
| Breadcrumb injection | `src/templates/shared-hooks/inject-workflow-state.py` **and** its installed copies under the platform dirs (`.claude/`, `.codex/`, `.opencode/`) — the `next:` line lives there, not only in the workflow text |
| Tests | `test/` — a few upstream tests assert `native`-managed semantics and are patched to the fork's `oh-my` contract |
| Fork release checks | `packages/cli/scripts/fork-release-carries.js` — its own file: upstream `scripts/release-preflight.js` is left untouched, because editing upstream tooling is what step 4 below calls a delta leak |
| Docs | `docs/fork-sync.md` (this file) |

`packages/core` is intentionally untouched — the fork keeps the
`@mindfoldhq/trellis-core` dependency verbatim.

## Sync procedure

1. `git fetch upstream`
2. Review upstream commits since the last sync:
   `git log --oneline HEAD..upstream/main`
3. Merge (preferred — preserves `[oh-my]` commits and is easier to audit):
   `git merge upstream/main` — or rebase if you prefer a linear history:
   `git rebase upstream/main`
4. Resolve conflicts **only inside the `[oh-my]` surface** listed above. If a
   conflict lands outside it, the fork delta leaked — re-scope it back into
   `packages/cli` before continuing.
5. Rerun the template diff checks (the customizations must still be present):
   - `git diff upstream/main -- packages/cli/src/templates/trellis/agents/` shows only the role-card rewrite
   - `git diff upstream/main -- packages/cli/src/templates/trellis/scripts/common/task_store.py` shows only the `.devin` block + comment lines
   - `packages/cli/src/templates/trellis/workflow.md` (native) carries the fork's autonomy tiers and routing text — **it is not diff-free** (both variants are maintained: `workflow.md` and `workflow-oh-my.md`, and the fork's own `.trellis/workflow.md` is a third copy kept in step)
6. Rebuild and test:
   `pnpm install && pnpm --filter oh-my-trellis build && pnpm --filter oh-my-trellis test`
   Then the e2e: `cd packages/cli && pnpm pack`, `npm i -g ./oh-my-trellis-*.tgz`, and in a scratch dir
   `trellis init --devin -y` — verify `.trellis/workflow.md` contains `[Devin]` blocks and `.devin/workflows/oh-my-update.md` exists.
7. When upstream publishes a new release, re-tag the baseline:
   `git fetch upstream --tags` → locate the release commit →
   `git tag upstream-<version> <sha>` — and bump the fork version's base
   component (`<upstream>-ohmy.N`).

## Versioning

Fork releases are `<upstream-version>-ohmy.<N>` (e.g. `0.6.17-ohmy.1`):
SemVer-prerelease-shaped, monotonic per upstream base, and clearly not an
upstream version. On a new upstream base, reset `N` to 1.

## Release channel

Canonical CLI distribution is via GitHub release tarballs on
`ScoFan-official/oh-my-trellis` under `cli-v<upstream>-ohmy.<N>` tags —
`oh-my-trellis` is THE user-facing repo; this fork is source/build workspace
only. The CLI's update check and `trellis upgrade` list
`api.github.com/repos/ScoFan-official/oh-my-trellis/releases` and pick the
newest `cli-v*` tag — not npm, and never `/releases/latest` (the pack's own
`vX.Y.Z` releases share the list). The default registry/marketplace source
points at the pack repo root (`gh:ScoFan-official/oh-my-trellis`); custom
`--workflow-source` / `--registry` overrides are unchanged upstream plumbing.

### Release procedure

1. Tag this fork at the release commit and push:
   `git tag v<upstream>-ohmy.<N> && git push origin v<upstream>-ohmy.<N>`
   (e.g. `v0.6.17-ohmy.2`).
2. On the pack repo (`ScoFan-official/oh-my-trellis`), tag the matching
   `cli-` alias and push:
   `git tag cli-v<upstream>-ohmy.<N> && git push origin cli-v<upstream>-ohmy.<N>`
3. The pack's `.github/workflows/cli-release.yml` fires on `cli-v*`, clones
   this fork at the matching `v<upstream>-ohmy.<N>` tag
   (`${GITHUB_REF_NAME#cli-}`), runs `pnpm --filter oh-my-trellis build`,
   `pnpm pack`, and `gh release create` with the tarball.

No PAT needed — the pack workflow clones the public fork anonymously.
`.github/workflows/release.yml` here is demoted to `workflow_dispatch`
(internal tarball testing only); fork-hosted releases are deprecated.

What the fork's release route does **not** do, and why:

- **`pnpm release` is unusable here.** `release.js` gates on `release-preflight check-versions`, which requires cli and core to share a version — `-ohmy.N` breaks that on purpose (see below) — and it refuses to cut a stable release from any branch but `main`. The fork's releases are a hand-written version commit on `main` (touching `packages/cli/package.json` only) plus the two tags. Upstream's `verify-packed-cli` is likewise unwired for the same version reason.
- **Reconcile before burning the number.** A version, once published, cannot be reused. Before tagging, check the ref actually carries the work the ticket names: `node packages/cli/scripts/fork-release-carries.js --ref origin/main --sha <a>,<b>,…`. This is also why the fork merges PRs as merge commits: a squash rewrites the branch SHAs away and that reconciliation silently loses its ground.
- **Template wording is pinned by tests.** `test/templates/trellis.test.ts` asserts golden strings taken from `workflow.md`; rewording contract text turns CI red after the push. Grep the tests for the sentence before changing it.

`.github/workflows/publish.yml` is upstream's npm pipeline and is dormant on
the fork: its `on:` block was changed to `workflow_dispatch` only, because
upstream's triggers (`release: published`, `v*` tag push) both fire on a fork
release. `verify-packed-cli` also expects cli version == core version, which
`-ohmy.N` intentionally breaks. Re-enable the triggers when channel B (npm)
ships.
