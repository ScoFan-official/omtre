# Audit and repair Trellis specs

## Goal

Align `.omtre/config.yaml` and `.omtre/spec/**` with the current Trellis
codebase so future AI sessions load the right package/layer specs and do not
inherit stale package-map or legacy architecture claims.

## Requirements

- Treat current code, package manifests, Trellis runtime scripts, and tests as
  the source of truth.
- Fix package/spec map drift found by the maintainer scan:
  - `.omtre/config.yaml` currently has no active `packages:` map.
  - `pnpm-workspace.yaml` declares `packages/*`.
  - Real workspace packages are `packages/cli` (`omtre`) and
    `packages/core` (`@omtre/core`).
  - `docs-site/` has a package manifest and existing docs-site specs, but is
    not part of the pnpm workspace.
- Add or repair repo/package index docs so package ownership and spec routing
  are explicit.
- Repair confirmed spec-file drift:
  - missing repo-level spec index under `.omtre/spec/tech/repo/index.md`;
  - missing package-scoped spec visibility for `core`;
  - `.omtre/spec/guides/index.md` omits the existing
    `cross-platform-thinking-guide.md`;
  - `.omtre/spec/cli/backend/quality-guidelines.md` still describes
    `.omtre/scripts/create_bootstrap.py` as shipped/dead even though the file
    was removed by the 0.5.0-beta.9 cleanup;
  - `.omtre/spec/cli/backend/platform-integration.md` cites archived task
    artifacts through their former active-task paths;
  - `.omtre/spec/cli/backend/commands-channel.md` needs clearer wording for
    the current core-vs-CLI channel store boundary.
- Preserve current `cli` and `docs-site` spec directories unless the code
  requires a rename; avoid broad spec path churn.
- Repair stale active claims only when backed by code paths, package manifests,
  tests, or current spec/runtime contracts.
- Mark useful old behavior as historical when it is not current active truth.
- Do not edit task archives as part of this task.
- Do not run frontend `dev`, `build`, `start`, or `serve` commands.

## Acceptance Criteria

- [ ] `.omtre/config.yaml` exposes the real package map used by Trellis
      package-context scripts.
- [ ] `.omtre/spec/tech/repo/index.md` exists and documents the current repo
      package/source/spec map.
- [ ] Any newly discovered package/layer spec gap has either a minimal spec or
      an explicit documented ownership decision.
- [ ] The guide index links every guide file that should be reachable by future
      sessions, including cross-platform checks.
- [ ] Historical task citations in active specs either point to archived paths
      or are worded as historical references, not active files.
- [ ] Spec text about removed files such as `create_bootstrap.py` matches the
      current removal state.
- [ ] Channel specs distinguish canonical core APIs from current CLI-local
      supervisor/storage wrappers.
- [ ] Targeted stale-fact searches for package-map and legacy claims no longer
      show incorrect active statements.
- [ ] The maintainer scanner has been run:
      `python3 "${CODEX_HOME:-$HOME/.codex}/skills/omtre-spec-maintainer/scripts/scan_spec_drift.py"`.
- [ ] `uv run python ./.omtre/scripts/get_context.py --mode packages` has
      been run and reports the expected package/layer visibility.
- [ ] `uv run python ./.omtre/scripts/check_package_map.py` is run if the
      repo provides it; if absent, the absence is recorded.
- [ ] `git diff --check -- .omtre/config.yaml .omtre/spec` passes.
- [ ] No frontend dev/build/start/serve command is used.

## Notes

- Planning evidence is recorded in `research/spec-drift-scan.md`.
