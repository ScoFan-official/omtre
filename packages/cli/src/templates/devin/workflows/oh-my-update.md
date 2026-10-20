---
description: Update omtre (CLI, Omtre templates, skills, specs) to the latest fork release.
---

# omtre Update

Update this project's omtre stack: the global `omtre`/`omt` CLI, `.omtre/` templates, `.devin/` skills and `.omtre/spec/` — in that order, with a confirmation gate before anything changes.

## Step 1: Check versions

```bash
omtre --version
gh api repos/ScoFan-official/omtre/releases
```

CLI releases live on `ScoFan-official/omtre` tagged `cli-v<ver>` (e.g. `cli-v0.6.17-ohmy.2`). The repo's own pack releases (`vX.Y.Z`) share the same list — filter `tag_name` on the `cli-v` prefix and pick the newest match. Do NOT use `/releases/latest`: it can resolve to a pack release.

Record:

- `current` = the version `omtre --version` prints (e.g. `0.6.17-ohmy.2`)
- `latest` = the newest `cli-v*` `tag_name`, minus the `cli-v` prefix (e.g. `0.6.17-ohmy.2`)
- `tarball` = `https://github.com/ScoFan-official/omtre/releases/download/cli-v<latest>/omtre-<latest>.tgz` (or the `.tgz` asset's `browser_download_url` from the release response)

If `gh` is unavailable or the API call fails, stop and report — do not guess the latest version.

## Step 2: Summarize the update

Before touching anything, present:

- version delta: `<current> → <latest>` (or "already up to date" — then stop)
- changelog summary: the first section of the release `body`, condensed to a few bullets
- affected layers: Omtre templates (`.omtre/`), skills (`.devin/skills/`), specs (`.omtre/spec/`)

## Step 3: Confirm

Ask the user to confirm the update. Do not proceed on silence; on a "no", stop and report nothing was changed.

## Step 4: Apply, in order

```bash
npm i -g <tarball>   # the release .tgz asset URL from Step 1
omtre update         # refresh .omtre/ + .devin/ managed templates
npx skills add ScoFan-official/omtre --agent devin --copy
omtre init -r gh:ScoFan-official/omtre -t agent-workflow --append
```

Run each step only if the previous succeeded; on failure stop and report which step failed.

**Non-TTY (subagent / CI)**: every interactive prompt crashes with `ERR_USE_AFTER_CLOSE` — always pass the non-interactive flags instead:

```bash
omtre update --create-new
npx skills add ScoFan-official/omtre --agent devin --copy -y
omtre init -r gh:ScoFan-official/omtre -t agent-workflow --append --devin --monorepo   # monorepo repos only; omit --monorepo otherwise
```

**Publishing a release (maintainers)**: never chain `git commit && git tag && git push` — a failed commit (e.g. a red local test suite) silently leaves the tag pointing at the previous tree. Commit, verify `git log -1` is the intended commit, then tag and push. In the unified `ScoFan-official/omtre` repository, tag `cli-v<ver>` (matching `packages/cli/package.json` and `packages/core/package.json` version) and push the tag to trigger `cli-release.yml`, which builds and publishes `omtre-<ver>.tgz`.

## Step 5: Report

- old version → new version (`omtre --version` again to verify)
- per-layer result: CLI / Omtre templates / skills / specs — updated | skipped | failed
- leftover `.new` files: `find . -name '*.new'` — list them and remind the user to diff-and-merge
