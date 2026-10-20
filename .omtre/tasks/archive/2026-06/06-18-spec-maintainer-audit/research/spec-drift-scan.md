# Spec Drift Scan

## Commands Run

```bash
python3 ./.omtre/scripts/get_context.py --mode packages
python3 "${CODEX_HOME:-$HOME/.codex}/skills/omtre-spec-maintainer/scripts/scan_spec_drift.py"
uv run python ./.omtre/scripts/check_package_map.py
sc worktree status --json
fd -t f 'package\.json$|pnpm-workspace\.yaml$|config\.yaml$' . packages apps docs-site .omtre -E node_modules -E .git -E dist
rg -n "packages/api/src/routers|packages/api|apps/web|/onboard|primary_channel_id|daemon|runtime-manager|runner|packages/core|@omtre/core|omtre|docs-site|workflow-state|current task|single-repo" .omtre/spec .omtre/config.yaml
```

## Confirmed Facts

- `pnpm-workspace.yaml` declares `packages/*`.
- `packages/cli/package.json` is `omtre` version `0.6.3`.
- `packages/core/package.json` is `@omtre/core` version `0.6.3`.
- `docs-site/package.json` is `omtre-docs`, private, outside the pnpm
  workspace declaration.
- `.omtre/config.yaml` has no active `packages:` map; it only has commented
  examples.
- `get_context.py --mode packages` currently reports:

```text
Single-repo project (no packages configured)

Spec layers: cli, docs-site
```

- GitNexus shows package context is driven by
  `packages/cli/src/templates/trellis/scripts/common/packages_context.py`.
  `get_context_packages_text()` reads `get_packages_info()`, which reads
  `common/config.py:get_packages()` and scans `.omtre/spec/<package>/<layer>`.
- Existing specs already document the TypeScript monorepo:
  `.omtre/spec/cli/backend/directory-structure.md` says the repo publishes
  `omtre` and `@omtre/core`.
- Existing specs already document the core/CLI boundary in
  `.omtre/spec/cli/backend/omtre-core-sdk.md`.

## Drift Scanner Findings

The maintainer drift scanner reported:

```text
ERROR: .omtre/config.yaml has no packages map
ERROR: workspace package path missing from config: packages/cli
ERROR: workspace package path missing from config: packages/core
```

It also reported missing-path candidates:

```text
.omtre/spec/cli/backend/commands-channel.md: `.omtre/agents/x.md`
.omtre/spec/cli/backend/commands-workflow.md: `.omtre/workflow.md.new`
.omtre/spec/cli/backend/platform-integration.md: `.omtre/tasks/04-17-subagent-hook-reliability-audit/research/platform-hook-audit.md`
.omtre/spec/cli/backend/platform-integration.md: `.omtre/tasks/04-17-workflow-enforcement-v2/prd.md`
.omtre/spec/cli/backend/quality-guidelines.md: `.omtre/scripts/create_bootstrap.py`
.omtre/spec/cli/backend/script-conventions.md: `.omtre/worktrees`
.omtre/spec/cli/backend/script-conventions.md: `.omtre/.cache`
```

These are candidates, not confirmed active-truth errors. They need targeted
inspection before any wording change.

## Confirmed Spec-File Problems Beyond Config

### Missing / unreachable specs

- `.omtre/spec/tech/repo/index.md` is referenced by the maintainer workflow
  but does not exist.
- `.omtre/spec/core/` does not exist even though `packages/core` is a real
  workspace package. Existing detailed core rules live in
  `.omtre/spec/cli/backend/omtre-core-sdk.md`, so package-scoped context
  would otherwise show `core` without configured specs after the package map is
  repaired.
- `.omtre/spec/guides/cross-platform-thinking-guide.md` exists, but
  `.omtre/spec/guides/index.md` does not list it in "Available Guides" or the
  quick-reference trigger list. Future sessions can miss cross-platform checks.

### Stale active paths

- `.omtre/spec/cli/backend/platform-integration.md` says the full sub-agent
  reliability audit "lives at"
  `.omtre/tasks/04-17-subagent-hook-reliability-audit/research/platform-hook-audit.md`.
  The file currently lives under
  `.omtre/tasks/archive/2026-04/04-17-subagent-hook-reliability-audit/research/platform-hook-audit.md`.
- The same file cites
  `.omtre/tasks/04-17-workflow-enforcement-v2/prd.md`; the current path is
  `.omtre/tasks/archive/2026-04/04-17-workflow-enforcement-v2/prd.md`.

### Stale removed-file wording

- `.omtre/spec/cli/backend/quality-guidelines.md` still lists
  `.omtre/scripts/create_bootstrap.py` as an orphan Python CLI "shipped as
  template but dead." The file no longer exists in `.omtre/scripts`; release
  manifest `0.5.0-beta.9` records the hash-verified delete. The case study is
  useful, but its wording needs to say the file was one of the historical drift
  modes and is now removed.

### Ambiguous channel ownership wording

- `.omtre/spec/cli/backend/commands-channel.md` documents core-owned worker
  lifecycle / inbox / delivery contracts, but the active CLI still has
  `packages/cli/src/commands/channel/store/*` modules. Code comments show these
  are current CLI-local wrappers used by supervisor / spawn / kill while the
  migration to core APIs continues. The spec should state that boundary
  directly so future work neither deletes the wrappers prematurely nor treats
  them as the canonical reusable store.

## Scanner Candidates Classified As Not Errors

- `.omtre/spec/cli/backend/commands-workflow.md` mentions
  `.omtre/workflow.md.new` as an output file written by
  `trellis workflow --create-new`; it is not expected to exist beforehand.
- `.omtre/spec/cli/backend/commands-channel.md` mentions
  `.omtre/agents/x.md` as a security test fixture path, not as an existing
  repository file.
- `.omtre/spec/cli/backend/script-conventions.md` mentions
  `.omtre/worktrees` and `.omtre/.cache` as excluded generated/user-data
  paths; absence in the current checkout is acceptable.

## Tooling Gap

`uv run python ./.omtre/scripts/check_package_map.py` failed because
`.omtre/scripts/check_package_map.py` does not exist in this repository.
The maintainer workflow says to run it when provided; here the validation
result should record absence rather than fabricate an equivalent script.

Follow-up check with `fd -t f 'check_package_map\.py$' .omtre/scripts
packages/cli/src/templates/trellis/scripts` also found no checker.

## Final Validation Results

After repairs:

```text
python3 "${CODEX_HOME:-$HOME/.codex}/skills/omtre-spec-maintainer/scripts/scan_spec_drift.py"

## Package map
OK

## Missing path candidates
OK
```

Package context output now reports:

```text
## PACKAGES

### cli (default)
Path: packages/cli
Spec layers: backend, unit-test
  - .omtre/spec/cli/backend/index.md
  - .omtre/spec/cli/unit-test/index.md

### core
Path: packages/core
Spec layers: backend
  - .omtre/spec/core/backend/index.md

### docs-site [submodule]
Path: docs-site
Spec layers: docs
  - .omtre/spec/docs-site/docs/index.md

### Shared Guides (always included)
Path: .omtre/spec/guides/index.md
```

`git diff --check -- .omtre/config.yaml .omtre/spec` passed.

Archive references were verified:

- `.omtre/tasks/archive/2026-04/04-17-subagent-hook-reliability-audit/research/platform-hook-audit.md`
- `.omtre/tasks/archive/2026-04/04-17-workflow-enforcement-v2/prd.md`

GitNexus `detect_changes(scope="all")` reported no changed symbols, no affected
processes, and low risk, which matches the docs/config-only change set.

## Spec-Update Judgment

Phase 3.3 did not require an additional spec beyond the files repaired in this
task. The reusable lessons were captured directly in long-lived specs:

- repo/package routing in `.omtre/spec/tech/repo/index.md`;
- core package visibility in `.omtre/spec/core/backend/index.md`;
- cross-platform guide discoverability in `.omtre/spec/guides/index.md`;
- core-vs-CLI channel ownership in
  `.omtre/spec/cli/backend/commands-channel.md`;
- task schema audit surfaces in
  `.omtre/spec/cli/backend/quality-guidelines.md`;
- archived historical references in
  `.omtre/spec/cli/backend/platform-integration.md`;
- generated / optional path wording in workflow and script specs.

## Initial Design Decision

Use Trellis package keys `cli`, `core`, and `docs-site` in `.omtre/config.yaml`.
This preserves existing spec paths (`.omtre/spec/cli` and
`.omtre/spec/docs-site`) and gives `packages/core` an explicit package key
without renaming npm packages into spec directory names.
