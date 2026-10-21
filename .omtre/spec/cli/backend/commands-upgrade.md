# `omtre upgrade` Command

How `omtre upgrade` upgrades the globally installed omtre CLI package.

This command is intentionally separate from `omtre update`:

- `omtre upgrade` updates the **CLI binary** by running npm's global install.
- `omtre update` updates a **project's bundled omtre files** under `.omtre/`
  and platform directories.

---

## User-facing contract

```text
omtre upgrade [--tag <tag-or-version>] [--dry-run]
```

Behavior:

- Resolves the GitHub release tag to its `omtre-<version>.tgz` asset and runs
  `npm install -g <tarball-url>`.
- POSIX execution must spawn `npm` directly without shell execution.
- Windows execution must route through `cmd.exe /d /s /c npm install -g ...`
  instead of directly spawning `npm.cmd`.
- `latest` (the default) resolves the newest `cli-v*` GitHub release.
- `--tag <tag-or-version>` accepts a version (`1.0.0`), a `v`-prefixed version,
  or a full `cli-v...` tag.
- `--dry-run` prints the exact npm command and exits without changing anything.

The implementation does not detect or preserve the original installer. omtre
is published as an npm package, so npm is the upgrade backend even when the user
installed Node through pnpm, Homebrew, Volta, proto, or another manager.

---

## Failure behavior

- If npm is unavailable, fail with the manual npm command.
- If npm exits non-zero, surface the exit code.
- If npm is interrupted by a signal, report the signal.
- Append troubleshooting guidance for npm global prefix / PATH mismatches,
  permissions, existing-bin or locked-file conflicts, and the manual command.
- Do not automatically run `sudo`, pass `--force`, rewrite npm prefix, delete
  files, or detect package managers.
- Reject shell-shaped `--tag` input before spawning npm. Never build a shell
  command string for POSIX execution.

## Success behavior

After npm reports success, print both:

```text
omtre --version
```

and a platform-specific binary-resolution check:

```text
which omtre   # POSIX
where omtre   # Windows
```

This catches the common case where npm installed into one global prefix while
the user's shell still resolves an older `omtre` binary earlier on PATH.

---

## Update hints

Any user-facing hint that previously said:

```text
npm install -g omtre@latest
```

should now prefer:

```text
omtre upgrade
```

This applies to CLI startup warnings, `omtre update` downgrade guidance, and
session-start update hints.

---

## Test requirements

- Tag inference: stable → `latest`, beta → `beta`, RC → `rc`.
- Explicit tag override.
- Invalid tag rejection.
- POSIX direct npm command with `shell: false`.
- Windows `cmd.exe /d /s /c npm ...` command plan with `shell: false`.
- Dry-run does not spawn npm.
- Non-zero npm exit becomes a command failure with troubleshooting guidance.
