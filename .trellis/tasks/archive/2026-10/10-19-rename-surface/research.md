# Rename-surface inventory: `.trellis` / `trellis` brand across the repo

Scope: whole repo minus `node_modules/`, `dist/`, `.git/`, `__pycache__/`.
Method: `grep -r` fixed/regex counts over the working tree on 2026-10-19 (Windows).
`marketplace/` and `docs-site/` are submodule gitlinks, **not checked out locally** — see §9.

Two distinct `.trellis` roots exist and must not be conflated by a rename:

1. **Repo-level** `<repo>/.trellis/` — the workflow data dir (the thing being renamed to `.omtre/`).
2. **User-home** `~/.trellis/` — global channel/agent state store, e.g.
   `packages/core/src/channel/internal/store/paths.ts:15` →
   `path.join(os.homedir(), ".trellis", "channels")` and the twin in
   `packages/cli/src/commands/channel/store/paths.ts:15`.

---

## 1. `.trellis` path literals

**Total: 10,107 occurrences in 1,405 files.**

| Area | Occurrences | Files |
|---|---:|---:|
| `packages/` (code + templates + tests) | 3,028 | 324 |
| `.trellis/` (this repo's own workflow data: tasks, spec, workspace, scripts) | 4,115 | 730 |
| installed platform dirs (`.claude` `.agents` `.opencode` `.cursor` `.pi` `.omp` `.codex`) | 2,908 | 338 |
| `docs/` + `drafts/` | 26 | 4 |
| root files (`README*` `AGENTS.md` `CONTRIBUTING*` `CHANGELOG` `.gitignore` `.gitattributes` `pyrightconfig.json`) | ~30 | 12 |

`packages/` breakdown (occurrences):

- `packages/cli/src/templates` — 1,149 (template file contents; every platform tree repeats the literals)
- `packages/cli/test/regression.test.ts` — ~622 in a single file (dumps all managed paths)
- `packages/cli/src/migrations` — 270 (manifest JSON changelogs/notes — historical data)
- `packages/cli/test/{scripts,commands,templates,utils,configurators}` — ~680
- `packages/cli/src` `*.ts` — 232 raw `.trellis` literal occurrences (incl. comments) vs only **105** uses of `DIR_NAMES.WORKFLOW` / `PATHS.*` / `DIR_WORKFLOW` across 13 files. The constant exists but adoption is partial.
- `packages/core` — ~62 (mostly `test/mem`)

Representative samples:

- `packages/cli/src/commands/run/orchestrator.ts:114` — `path.join(cwd, ".trellis", "config.yaml")` (bypasses `DIR_NAMES`)
- `packages/cli/src/commands/channel/agent-loader.ts:58` — `path.resolve(cwd, ".trellis", "agents")`
- `packages/core/src/channel/internal/store/paths.ts:15` — `path.join(os.homedir(), ".trellis", "channels")` (HOME root)
- `.trellis/scripts/common/paths.py:28` — `DIR_WORKFLOW = ".trellis"`
- `packages/cli/scripts/release.js:145` — `git add -A -- ':!docs-site' ':!marketplace' ':!.trellis'` (git pathspec, not a JS string)
- `.gitattributes:9` — `.trellis/workspace/*/journal-*.md merge=union`
- `pyrightconfig.json:3` — `".trellis/scripts/**/*.py"` include path

## 2. `TRELLIS_*` names (env vars + look-alikes)

**~1,062 occurrences in 236 files; ~41 distinct `TRELLIS_[A-Z_0-9]+` tokens.**

Caveat: the count includes ~20 occurrences of `TRELLIS_BLOCK_START`/`TRELLIS_BLOCK_END`
(they are TS constant names, not env vars) and `TRELLIS_DIR` (12) which is a
**shell local variable** in `packages/cli/scripts/migrate-features-to-tasks.sh:34`
(`TRELLIS_DIR="$PROJECT_DIR/.trellis"`) plus doc references — not an env contract.
Real env-var surface ≈ 39 names / ~1,040 occurrences.

Top names by occurrences:

- `TRELLIS_CONTEXT_ID` 454 — session-identity env injected into hooks/subagents; bulk is tests/specs (`packages/cli/test/regression.test.ts` 50×)
- `TRELLIS_HOOKS` 70, `TRELLIS_CHANNEL_PROJECT` 65, `TRELLIS_CHANNEL_ROOT` 56
- `TRELLIS_DISABLE_HOOKS` 41, `TRELLIS_WRITER` 37
- `TRELLIS_CHANNEL_WORKER_IDLE_TIMEOUT` 34, `TRELLIS_CHANNEL_MAX_LIVE_WORKERS` 34, `TRELLIS_CHANNEL_AS` 25
- `TRELLIS_ALLOW_HOMEDIR` 25, `TRELLIS_SKIP_PYTHON_CHECK` 21, `TRELLIS_PI_CLI_JS` 17
- `TRELLIS_DEVELOPER` 17, `TRELLIS_QUIET` 16, `TRELLIS_PLATFORM` 13, `TRELLIS_DEBUG` 12, `TRELLIS_PYTHON_CMD` 11
- ~20 more with ≤10 each (`TRELLIS_SUBAGENT_CHILD`, `TRELLIS_EXTENSION`, `TRELLIS_SKILLS`, `TRELLIS_PROMPTS`, `TRELLIS_AGENTS`, `TRELLIS_STATUSLINE`, `TRELLIS_AGENT_JSONL`, `TRELLIS_FAKE_CALL_LOG`, `TRELLIS_ABLATION_STATE_ROOT`, …)

Centralization: **almost none.** Only 3 env names exist as exported constants:

- `packages/cli/src/commands/channel/guard.ts:45,48` — `ENV_IDLE_TIMEOUT`, `ENV_MAX_LIVE_WORKERS`
- `packages/cli/src/utils/ablation-store.ts:27` — `ABLATION_STATE_ROOT_ENV`
- `.trellis/scripts/common/paths.py:42` — `ENV_DEVELOPER = "TRELLIS_DEVELOPER"` (Python side)

Everything else is a literal at the use site (`process.env.TRELLIS_*`,
`os.environ.get("TRELLIS_*")`, hook JSON, docs, test fixtures).

## 3. Managed-block markers

**40 marker-text occurrences in ~20 files.**

- `TRELLIS:START` 21, `TRELLIS:END` 13
- `TRELLIS:COPILOT-GUIDANCE:START/END` 4 (a second marker pair!)
- `TRELLIS:TEST` 2 (test fixture)

Canonical constants exist in TS:

- `packages/cli/src/utils/managed-paths.ts:6-7` —
  `TRELLIS_BLOCK_START = "<!-- TRELLIS:START -->"`, `TRELLIS_BLOCK_END = "…END…"`,
  consumed via `getManagedBlock()` in `commands/update.ts`, `managed-removal.ts`, `manifest-prune.ts`.
- Copilot markers are **separate local literals**, not via the shared consts:
  `packages/cli/src/templates/copilot/index.ts:23-25`.

The rest are data, not code: template file bodies (`templates/markdown/agents.md:1,22`,
`templates/copilot/copilot-instructions.md:1,11`), this repo's own `AGENTS.md:1,21`,
migration manifests, spec docs, task archives.

Related second marker family (lowercase, emitted by hooks — **not** covered by the
const scheme): `<!-- trellis-hook-injected -->` 65 occ, `<!-- trellis-emitted -->` 12,
`<!-- trellis-context -->` — see `packages/cli/src/templates/shared-hooks/inject-subagent-context.py`
(lines ~651/686/721) and installed copies under `.claude/hooks/`, `.codex/hooks/`, `.cursor/hooks/`.

## 4. `trellis-*` names and `/trellis:*` slash commands

- `trellis-<word>` tokens: **6,474 occurrences / 868 files** (~267 distinct tokens —
  includes task slugs, file names, historical names, one typo `trellis-spec-bootstarp`).
- `/trellis:<cmd>`: **525 occurrences / 137 files.**
  Top: `/trellis:finish-work` 173, `/trellis:continue` 72, `/trellis:start` 68,
  `/trellis:record-session` 31, `/trellis:parallel` 25
  (tokens like `xxx`, `my-command`, `command-name`, `foo` are doc placeholders).

Canonical skill set — **13 unique skill dirs** found on disk
(`trellis-before-dev`, `trellis-brainstorm`, `trellis-break-loop`, `trellis-channel`,
`trellis-check`, `trellis-continue`, `trellis-finish-work`, `trellis-meta`,
`trellis-meta-rewrite`, `trellis-session-insight`, `trellis-spec-bootstrap`,
`trellis-start`, `trellis-update-spec`), sourced from
`packages/cli/src/templates/common/bundled-skills/` (4 dirs) + platform trees,
installed to `.agents/skills/`, `.claude/skills/`, etc. Each carries
`name: trellis-*` frontmatter in `SKILL.md`.

Subagent definition files: `trellis-{implement,check,research}.{md,toml,json}` under
`packages/cli/src/templates/<platform>/agents/` for ~15 platforms
(53 `trellis-*` files total in `templates/`), plus
`devin/workflows/trellis-start.md`, `kiro/hooks/trellis-workflow-state.kiro.hook`,
`opencode/lib/trellis-context.js`.

The `/trellis:` namespace and `trellis-` filename prefix are **generated per platform
by literals inside ~15 configurator files**, two layout styles:

- subdir style: `packages/cli/src/configurators/claude.ts:114` —
  `` `.claude/commands/trellis/${cmd.name}.md` `` (also codebuddy, droid, gemini, opencode, zcode)
- flat prefix style: `packages/cli/src/configurators/cursor.ts:20` —
  `` `.cursor/commands/trellis-${n}.md` `` (also grok, omp, qoder, snow, trae, pi)

Name parsing is also prefix-dependent: `configurators/shared.ts:687-688`
(`base === "trellis-implement" || base === "trellis-check"`),
`codex.ts:116` (`.codex/agents/trellis-` prefix check),
`.claude/hooks/inject-subagent-context.py:65-67,898`
(`AGENT_IMPLEMENT = "trellis-implement"` …, `subagent_type.removeprefix("trellis-")`).

Also: `trellis-local` (130 occ) — documented user-local skill convention in
`trellis-meta` references; `trellis-context` (73) — `trellis-context.js` lib +
`write-trellis-context.py` log filename.

## 5. Bin names `trellis` / `tl` / `oh-my-trellis`

- `packages/cli/package.json:2` — `"name": "oh-my-trellis"`;
  `:8-11` bin map: `trellis`, `tl`, `oh-my-trellis` → all `./bin/trellis.js`
- `packages/cli/bin/trellis.js` — the shim (`import("../dist/cli/index.js")`)
- `packages/cli/src/cli/index.ts:71` — `.name("trellis")` (Commander program name →
  drives `Usage: trellis …` help output)
- `packages/core/package.json:2` — `"name": "@mindfoldhq/trellis-core"`
- `oh-my-trellis` literal: **86 occ / 23 files** — top: root `package.json`
  pnpm `--filter oh-my-trellis` scripts (12), `templates/devin/workflows/oh-my-update.md` (12),
  `docs/fork-sync.md` (11), `CHANGELOG.md` (9), `README.md` (7), `.github/workflows/{ci,release}.yml` (4)
- npm scope literals: `@mindfoldhq/trellis` **339 occ**, `@mindfoldhq/trellis-core`
  **373 occ** (~228 files total; also `trellis-agents`/`trellis-shared`/`trellis-app`/`trellis-code` ≤4 each, mostly docs).
  Partially centralized: `packages/cli/scripts/check-manifest-continuity.js:34`
  `PACKAGE_NAME = "@mindfoldhq/trellis"`. One ref in `pnpm-lock.yaml:20` (regenerable).
- `trellis <subcommand>` usage strings are the largest single brand surface:
  `trellis channel` ~1,099, `trellis update` ~906, `trellis init` ~635,
  `trellis uninstall` ~68, `trellis upgrade` ~55, `trellis run` ~26 …
  thousands across help text, skill bodies, docs, manifest changelogs.
  `tl` as the short alias appears mainly as `tl mem` in changelog/spec docs and the bin entry.
- Standalone brand word `Trellis` (capital-T, prose/comments/UI strings like
  "Managed by Trellis"): **~4,675 occ / 1,025 files.**

## 6. Config / runtime file names & keys

| Name | Occ | Files | Notes |
|---|---:|---:|---|
| `config.yaml` | 935 | 291 | filename + `.trellis/config.yaml` refs + `trellis_config.py` reader |
| `task.json` | 977 | 257 | per-task metadata file |
| `.template-hashes.json` | 283 | 106 | update/uninstall manifest |
| `.developer` | 275 | 101 | gitignored identity file |
| `.current-task` | 194 | 78 | legacy task pointer (still referenced) |
| `.version` | 155 | 61 | inflated — includes `.version(` calls; real filename literals ~6 sites |
| `hooks.local.json` / `.ralph-state.json` / `.runtime/` | tens | tens | runtime files in gitignore/exclude lists |

Centralization: `FILE_NAMES` in `constants/paths.ts:33-44` covers
`.developer`, `.current-task`, `task.json`, `workflow.md`, `journal-`.
**Not** centralized: `"config.yaml"` (e.g. `commands/channel/context-trust.ts:108`,
`commands/run/orchestrator.ts:114`), `".version"` (`cli/index.ts:34`,
`init.ts:1935`, `update.ts:1390,1398`), `".template-hashes.json"`.
`utils/template-hash.ts:265-272` `EXCLUDE_FROM_HASH` hardcodes the whole family
(`.template-hashes.json`, `.version`, `.developer`, `.current-task`, `workspace/`,
`tasks/`, `.trellis/spec/`, `.backup-`) as substring patterns.

Python mirror: `.trellis/scripts/common/paths.py:36-39` `FILE_DEVELOPER`,
`FILE_CURRENT_TASK`, `FILE_TASK_JSON`, `FILE_JOURNAL_PREFIX` (+ template copy).
`common/trellis_config.py` is itself a trellis-named module
(`read_trellis_config`, imported by ~6 script files / 13 import sites incl. templates).

## 7. Must-keep occurrences (copyright / upstream attribution)

- `COPYRIGHT:2` — `Copyright (C) 2026 Mindfold LLC` + AGPL grant text. MUST KEEP.
- `LICENSE` — full AGPL-3.0 text. MUST KEEP.
- `AGPL` refs: 18 occ / 14 files (README badge, CONTRIBUTING, fork docs).
- Upstream identity `mindfold-ai` (GitHub org): **178 occ / 63 files** —
  `docs/fork-sync.md` (the whole upstream-tracking doc), `README.md:9` fork notice
  ("`oh-my-trellis` fork … distribution of mindfold-ai/trellis (AGPL-3.0)"),
  README badges/links (:25-34, :157-169), `packages/core/package.json` repo URL,
  `.gitmodules` submodule URLs (docs-site, marketplace). KEEP — legal/upstream attribution.
- `Mindfold` standalone: 14 occ / 14 files.
- `@mindfoldhq/*` npm scope: **731 occ / 229 files** — dual nature: it is the
  upstream npm namespace (attribution-adjacent) AND the publish identity used by
  `.github/workflows/publish.yml` (:65-87) and install docs (`README.md:60`
  `npm install -g @mindfoldhq/trellis`). Decision needed whether `omtre` keeps
  publishing under this scope or moves; either way these are NOT mechanical
  `trellis→omtre` targets.
- No per-file copyright headers exist in `packages/*/src` (0 hits), so there is no
  header-comment sweep — the legal surface is the two root files + docs.

## 8. Centralized constants — what exists today

| Side | File | Constant | Adoption |
|---|---|---|---|
| TS | `packages/cli/src/constants/paths.ts:9-26` | `DIR_NAMES.WORKFLOW = ".trellis"` (+ `WORKSPACE`/`TASKS`/`SPEC`/`SCRIPTS`/`AGENTS`/`DOMAINS`) | only ~13 files / 105 uses; ~116 lines of raw literals remain in `cli/src/*.ts` (channel code, orchestrator, homedir store) |
| TS | same file `:29-44` | `FILE_NAMES` (`.developer` `.current-task` `task.json` `workflow.md` `journal-`) | partial; `config.yaml`/`.version`/`.template-hashes.json` absent |
| TS | same file `:47-68` | `PATHS` composite paths | same |
| TS | `packages/cli/src/utils/managed-paths.ts:6-7` | `TRELLIS_BLOCK_START/END` | used via `getManagedBlock`; copilot markers are separate literals |
| TS | `packages/cli/src/utils/workflow-resolver.ts:42,55` | `NATIVE_WORKFLOW_ID`, `OH_MY_WORKFLOW_ID` | workflow ids already centralized |
| TS | `packages/cli/scripts/check-manifest-continuity.js:34` | `PACKAGE_NAME = "@mindfoldhq/trellis"` | only site; elsewhere literals |
| Python | `.trellis/scripts/common/paths.py:28-39` | `DIR_WORKFLOW = ".trellis"` + `DIR_*`/`FILE_*`/`ENV_DEVELOPER` | **duplicated by design**: `common/active_task.py` has its own copy; each `shared-hooks/inject-*.py` ships a self-contained copy (10 files total define `DIR_WORKFLOW = `); identical template copies under `templates/trellis/scripts/common/` |
| Env vars | — | none (3 isolated consts) | literals everywhere |
| Skill/command names | — | none | per-configurator path templates + filename parsing |

## 9. Submodules / gitlinks

`.gitmodules` declares two submodules, both **gitlinks only** (mode `160000`,
dirs empty locally):

- `docs-site` → `https://github.com/mindfold-ai/docs.git` — the docs website
  content (`.mdx` files, its own `.trellis`/brand surface) lives upstream;
  any rename there is out of this repo's tree.
- `marketplace` → `https://github.com/mindfold-ai/marketplace.git` — same.
  `docs/pending/marketplace-native-workflow-autonomy.patch` is a queued patch
  against the marketplace repo and itself contains `.trellis` literals (13).

## 10. Consolidation recommendation (summary — detail in answer.md)

- **Already constant-shaped**: repo `.trellis` dir name (TS `DIR_NAMES.WORKFLOW`,
  Py `DIR_WORKFLOW`), block markers, workflow ids, `.developer`/`.current-task`/`task.json`.
  Work = chase remaining literal call sites into the constants (incl. `~/.trellis`
  home dir as a second constant) and edit the N self-contained Python copies.
- **Extend-the-constant then migrate**: `config.yaml`, `.version`,
  `.template-hashes.json`, `hooks.local.json`, `.runtime/`, `.ralph-state.json`
  → add to `FILE_NAMES`/Py `FILE_*`, migrate literal sites.
- **Codemod-only (name is the data)**: `TRELLIS_*` env vars (39 names, ~1,040 occ —
  decide back-compat alias policy), `trellis-*` skill/command/agent names +
  `/trellis:` namespace (file/dir renames + content + per-platform configurator
  templates + `removeprefix`/`SKILL.md name:` fields), bin names & `trellis <sub>`
  usage strings (thousands), `@mindfoldhq/*`/`oh-my-trellis` npm identity
  (package.json, publish.yml, imports, lock regen), brand word `Trellis` (~4.7k
  prose occurrences), lowercase hook markers `trellis-hook-injected`/`trellis-emitted`.
- **Exclude from codemod**: `COPYRIGHT`, `LICENSE`, `AGPL` texts, `mindfold-ai`
  URLs/attribution, `.gitmodules` URLs; plus pathspec/gitignore/gitattributes/
  pyrightconfig path entries need matching literal edits.
- **Regenerate rather than rewrite**: installed platform dirs at repo root
  (`.claude` `.codex` `.cursor` `.omp` `.opencode` `.pi` `.agents`, ~2,900 occ)
  and this repo's own `.trellis/` data (4,115 occ) — derived surfaces; the repo
  dogfoods, so `omtre update`-style regeneration or a wholesale pass applies.
