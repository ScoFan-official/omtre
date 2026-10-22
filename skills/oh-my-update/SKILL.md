---
name: oh-my-update
description: "Update the omtre stack — CLI, .omtre/ templates, installed skills and .omtre/spec/ contracts — to the latest ScoFan-official releases. Load when the user asks to update omtre, check for a new version, or 更新 omtre 环境."
---

# omtre update

Update this project's omtre stack: the global `omtre`
CLI, `.omtre/` templates, installed skills and `.omtre/spec/` — in that
order, with a confirmation gate before anything changes. (On Devin this same
flow ships as the `/oh-my-update` workflow.)

## Step 1: Check versions

```bash
omtre --version
gh api repos/ScoFan-official/omtre/releases
```

CLI releases live on `ScoFan-official/omtre` tagged `cli-v<ver>`
(e.g. `cli-v1.0.0`). The repository's pack releases (`vX.Y.Z`) share the same
list — filter `tag_name` on the `cli-v` prefix and pick the newest match.
Do NOT use `/releases/latest`: it can resolve to a pack release. Legacy
`-ohmy.N` tags may still appear; semver order picks the newest.

Record:

- `current` = the version `omtre --version` prints (e.g. `1.0.0`)
- `latest` = the newest `cli-v*` `tag_name`, minus the `cli-v` prefix
  (e.g. `1.0.0`)
- `tarball` =
  `https://github.com/ScoFan-official/omtre/releases/download/cli-v<latest>/omtre-<latest>.tgz`
  (or the `.tgz` asset's `browser_download_url` from the release response)

If `gh` is unavailable or the API call fails, stop and report — do not guess
the latest version.

Also check pack freshness (skills layer): the skills CLI lock records the
hash this repo's skills were installed at — inspect `skills-lock.json`
(project root) and diff it against the remote pack state. `npx skills`
reports the same drift when you ask it to update. If the lock's recorded
source/hash is behind `ScoFan-official/omtre@main` (or the pack's
latest pack `v*` tag / `VERSION`), the skills layer is stale too.

## Step 2: Summarize the update

Before touching anything, present:

- version delta: `<current> → <latest>` (or "already up to date" — then stop,
  unless the pack layer is stale)
- pack delta: installed skills hash vs remote, if stale
- changelog summary: the first section of the release `body`, condensed to a
  few bullets
- affected layers: omtre templates (`.omtre/`), skills (the platform's
  skills dir), specs (`.omtre/spec/`)

## Step 3: Get approval

Ask the user to approve the update. Do not proceed on silence. On a "no",
stop and report nothing was changed.

## Step 4: Apply, in order

```bash
npm i -g <tarball>   # the release .tgz asset URL from Step 1
omtre update         # refresh .omtre/ + platform managed templates
npx skills add ScoFan-official/omtre --agent <platform> --copy
omtre init -r gh:ScoFan-official/omtre/marketplace -t agent-workflow --append
```

`<platform>` is this agent's platform id as the skills CLI knows it
(`devin`, `codex`, `claude`, `cursor`, …).

Run each step only if the previous succeeded. On failure stop and report
which step failed.

## Step 5: Report

- old version → new version (`omtre --version` again to check)
- per-layer result: CLI / omtre templates / skills / specs —
  updated | skipped | failed
- leftover `.new` files: `find . -name '*.new'` — list them and remind the
  user to diff-and-merge
