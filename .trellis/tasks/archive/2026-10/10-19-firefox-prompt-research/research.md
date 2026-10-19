# Firefox agent-instruction layout — primary-source research

Ticket: `10-19-firefox-prompt-research` (wayfinder map `10-19-omtre-standalone`)
Trigger video: Bilibili BV1Wrp76mEsW (no subtitles; treated as hypothesis only — everything below is verified against the repo).

## 0. Access notes

- Repo verified: `mozilla-firefox/firefox` on GitHub (the live mozilla-central mirror; branch `main`). Fetched via authenticated `gh api` on 2026-10.
- `curl` to raw.githubusercontent.com failed on this machine (TLS exit 60); `gh api ... -H "Accept: application/vnd.github.raw"` used instead.
- `firefox-source-docs.mozilla.org` reachable via webfetch. searchfox.org / hg.mozilla.org not needed — the GitHub mirror carries identical paths (AGENTS.md itself cites `searchfox.org/firefox-main`).

## 1. File inventory (verified)

| Path | Size | Role |
|---|---|---|
| `AGENTS.md` | 73 lines | Root, always loaded. Source: https://github.com/mozilla-firefox/firefox/blob/main/AGENTS.md |
| `CLAUDE.md` | 1 line, content `@AGENTS.md` | Claude Code entry point that just imports AGENTS.md. Source: https://github.com/mozilla-firefox/firefox/blob/main/CLAUDE.md |
| `js/AGENTS.md` | 80 lines | SpiderMonkey module. https://github.com/mozilla-firefox/firefox/blob/main/js/AGENTS.md |
| `layout/AGENTS.md` | 31 lines | Layout module. https://github.com/mozilla-firefox/firefox/blob/main/layout/AGENTS.md |
| `gfx/wr/AGENTS.md` | 123 lines | WebRender module. https://github.com/mozilla-firefox/firefox/blob/main/gfx/wr/AGENTS.md |
| `browser/extensions/newtab/AGENTS.md` | 108 lines | Newtab extension. https://github.com/mozilla-firefox/firefox/blob/main/browser/extensions/newtab/AGENTS.md |
| `browser/extensions/webcompat/AGENTS.md` | 128 lines | Web-interventions module. https://github.com/mozilla-firefox/firefox/blob/main/browser/extensions/webcompat/AGENTS.md |
| `security/nss/` | has `CLAUDE.md` instead | imported from upstream; root file tells the agent to read that one (AGENTS.md L16) |
| `.agents/skills/` | 24 skill dirs + `README.md` + `references/` + `scripts/` | In-tree skills (canonical per docs). https://github.com/mozilla-firefox/firefox/tree/main/.agents/skills |
| `.claude/skills/` | same 24 skill names | Mirror copy for Claude Code discovery; `review-context.toml` loads from here. `.claude/settings.json` registers the `mozilla/firefox-aidev-plugins` marketplace with `autoUpdate: true`. https://github.com/mozilla-firefox/firefox/blob/main/.claude/settings.json |
| `review-context.toml` | 67 lines, `version = 1`, 3 `[[rules]]` | Review-time context injector. https://github.com/mozilla-firefox/firefox/blob/main/review-context.toml |

Code search (`gh api search/code filename:AGENTS.md`) returns exactly the 6 AGENTS.md files above — no others in the tree.

### Root `AGENTS.md` structure (73 lines)

- L1 `# Global instructions` — the only H1; everything else is a flat rule list or short H2 sections.
- L2 first rule: *"Limit the amount of comments you put in the code to a strict minimum. You should almost never add comments, except sometimes on non-trivial code, function definitions if the arguments aren't self-explanatory, and class definitions and their members."* (matches the video's "almost never write comments")
- L4: don't remove unrelated existing comments.
- L6: good-first-bug trigger → *"see the `file-good-first-bug` skill"* (pointer to a skill).
- L8: repo too big for blind `rg`/`grep`; prefer `rg` over `grep`.
- L10–16: **directory routing table** — working under `js/`, `gfx/wr/`, `layout/`, `security/nss/`, `browser/extensions/newtab/` → open the `AGENTS.md` *inside that directory*, using the `Read` tool (explicitly overriding the harness default of cat/sed); `security/nss/` has `CLAUDE.md` instead.
- L18–44 `## Tooling for Firefox work`: `moz` MCP server; `searchfox-cli` (**"you MUST use the `searchfox-cli` tool if you want to know about something"**, L20) with a 4-line usage crib; identifier vs text-search split (L27–30); `./mach` command cheat-sheet (format/build/test/run/doc/python); `treeherder-cli`; MCP resources `@moz:bugzilla://bug/{id}`, `@moz:phabricator://revision/D{id}`.
- L46–52 `## Fixing review comments`: how to find the Phabricator revision (`jj log -T builtin_log_detailed` / `git log -v -l 10`).
- L54–57 `## Referring to code in bugs, reviews and commit messages`: **"Reference a name, not a position"**; Searchfox permalinks via `searchfox-cli -q <term> -p <path> --permalink`; warns `/source/<path>` links rot.
- L59–60 `## Code Style`: "Our style guide forbids the use of emoji."
- L62–73 `## Workflow`: pull if stale; `./mach test --auto` then ask before `mach try auto`; never pipe slow commands through tail/grep (redirect to `artifacts/`); `build faster` vs `build binaries` rules; Phabricator submission needs explicit approval; reviewer syntax `r?#group` vs `r?user`; bug-reference format `bug NNNNNN comment N`; `DONTBUILD` pitfall.

### `.agents/skills/README.md` (43 lines) — the "when to write" policy

- Skills in-tree must be *"broadly useful, tree-wide workflows"* (filing a bug, splitting commits, running a linter).
- Cost model stated explicitly (L14–18): *"a skill's `description` is loaded into the agent's context on every session so the agent can decide when to invoke it. A description that is too broad can trigger the skill where it shouldn't."*
- Team/component-specific skills go to **marketplaces** instead: `mozilla/firefox-aidev-plugins` (enabled by default in-tree, browsable via `/plugin`), or `mozilla/aidev-plugins` for non-Firefox work. *"When in doubt, prefer a marketplace plugin: it reaches the people who need it without adding context cost for everyone else."*
- Format: own subdir, `SKILL.md` with YAML frontmatter (min `name` + `description`), scripts/assets alongside.
- Source: https://github.com/mozilla-firefox/firefox/blob/main/.agents/skills/README.md ; rendered list: https://firefox-source-docs.mozilla.org/ai-agent-tools/skills.html ("These skills live in `.agents/skills/`").

Skill inventory (24): `accessibility-frontend-review`, `android`, `android-new-module`, `bug-filing`, `documentation`, `file-good-first-bug`, `find-reviewer`, `firefox-commits`, `firefox-desktop-frontend`, `fluent-migration`, `gecko-web-standard-implementation`, `js-perf-investigation`, `js-review`, `media-patch-review`, `mozlint`, `nimbus-prefs`, `perf-regression-triage`, `perftest`, `profile-capture`, `profiler-analysis`, `spec-trace`, `specmap`, `stack-reorganize`, `stack-split-commit`, `stmo`, `webspec-index`. Larger skills carry `references/` subdirs (e.g. `profiler-analysis/references/*.md` case files, `stack-reorganize/references/{git,jj,fold-resplit,drop-superseded}.md`) — progressive disclosure inside the skill.

Example descriptions (the trigger surface):
- `mozlint`: *"You MUST use this skill when working with Firefox's linting infrastructure…"* — https://github.com/mozilla-firefox/firefox/blob/main/.agents/skills/mozlint/SKILL.md
- `file-good-first-bug`: *"…Trigger on phrases like 'file a good first bug', 'open good first bugs for X'…"* plus `scripts/build_url.py`. https://github.com/mozilla-firefox/firefox/blob/main/.agents/skills/file-good-first-bug/SKILL.md
- `find-reviewer`: fires "when committing changes, to fill in the `r=` part"; carries `allowed-tools: [Bash(./mach file-info:*)]` — tool permissions scoped by frontmatter. https://github.com/mozilla-firefox/firefox/blob/main/.agents/skills/find-reviewer/SKILL.md

### `review-context.toml` (67 lines) — trigger-driven injection

Mechanism (official doc): *"Review Helper can load domain knowledge from the tree at review time and inject it into the review prompt before the model sees a patch."* Rules declare `when` predicates matched against changed file paths (`any_file`/`all_files` with `include`/`exclude` globs + `ext`), plus `all`/`any`/`not` composition; `load` lists fetch files injected as trusted `<context>` blocks; loads deduplicated; failures non-fatal. Validated by `./mach lint review-context.toml`. Full language lives in the bugbug repo (`docs/code-review-skills.md`). Source: https://firefox-source-docs.mozilla.org/ai-agent-tools/code-review-context.html

Live rules:
1. **"Firefox desktop frontend"** — `any_file include browser/** toolkit/** devtools/**, exclude **/test/** **/tests/**, ext .js/.mjs/.html/.xhtml/.css/.svg` → loads `.claude/skills/firefox-desktop-frontend/SKILL.md`.
2. **"Gecko WebIDL / web standard implementation"** — `all: [any_file ext .webidl, any_file ext .h/.cpp]` (both shapes required) → loads `gecko-web-standard-implementation/SKILL.md`.
3. **"JavaScript Engine"** — `any_file include js/**, ext .js/.cpp/.h` → loads `js-review/SKILL.md`.

### Maintenance history ("prompts rot" evidence)

`git log` on `AGENTS.md` (https://github.com/mozilla-firefox/firefox/commits/main/AGENTS.md):
- First commit 2025-11-26: *"Bug 2002464 - Add an AGENTS.md file to the Firefox repository"*.
- Since then steady fixes: `Correct and tighten the guidance on referring to code`, `Rewrite try auto instructions to require human intervention`, `Add layout/ to the root AGENTS.md directory list and point security/nss/ at its CLAUDE.md`, etc.
- Every commit carries reviewer `r=ai4dev-reviewers` — a **dedicated review group** for agent-instruction changes, i.e. prompts are treated as code that rots and gets reviewed.

## 2. The six principles — Firefox practice + concrete example

### P1 Scope > Prompts
Route by where the work happens instead of piling everything into one global file.
- Root `AGENTS.md` L10–16 is a routing table: 5 directories have their own `AGENTS.md`; the agent opens the scoped file only when working there. `security/nss/` routes to upstream `CLAUDE.md`.
- Per-module files restate the boundary: `js/AGENTS.md` L4–5 *"Project-wide instructions live in `../AGENTS.md`… Notes below cover what is specific to `js/`."*; `layout/AGENTS.md` L3 *"Scoped guidance for `layout/`. The global `../AGENTS.md` still applies."*
- `review-context.toml` scopes by *changed paths*, not directories-being-edited: frontend rules fire only when a patch touches `browser|toolkit|devtools` front-end extensions, excluding test-only changes.

### P2 Pointers > Prose
Keep the always-loaded file thin; name the target + the condition for reaching it.
- Root file is 73 lines for a ~30 GB tree. Most lines name tools/paths rather than explain them; L6 *"see the `file-good-first-bug` skill"*; L19–20 point at `moz` MCP and `searchfox-cli --help` instead of embedding docs.
- `js/AGENTS.md` L57–74 "Documentation" section is a pure pointer list to `src/doc/*.md` plus the `[SMDOC]` in-source comment convention — teaching the agent where truth lives, not restating it.
- Skills README: the description *is* the always-loaded pointer and must earn its cost.

### P3 Tools > Prompts
If a tool can answer, don't write prose instructions — name the tool and its incantation.
- L20–33: `searchfox-cli` is mandated for repo questions (*"you MUST use"*); `rg`/`grep` demoted to local-changes only; *"If you can't find something quickly, it is better to ask than run local searches."* (L34)
- `treeherder-cli` for CI results; `moz` MCP server resources for bugs/revisions; `./mach` as the single dev-task CLI. Missing tools → `./mach bootstrap` (L33).
- Skills wrap tooling rather than re-describing it: `find-reviewer` = "run `./mach file-info reviewers`"; `file-good-first-bug` ships `scripts/build_url.py`; `stmo` wraps `stmo-cli`.

### P4 Lazy > Always
Load only what the current branch of work needs.
- Per-module `AGENTS.md` = lazy layer (read on directory entry, not at session start).
- `review-context.toml` = lazy injection at review time, keyed on diff paths.
- Skill descriptions are always loaded; bodies are lazy. README makes this the explicit admission criterion for adding a skill in-tree.
- Big skills push detail into `references/` files loaded on demand (`profiler-analysis` keeps 10+ case-study files out of the SKILL.md body).

### P5 Triggers > Memory
Don't rely on the agent remembering — wire the condition into a file the agent always sees or a rule that fires.
- Trigger conditions live in three places: skill `description` frontmatter (*"Trigger on phrases like…"*), the always-loaded routing table in root `AGENTS.md` L10–16, and `when` predicates in `review-context.toml`.
- Example: L6 *"If you see a good first bug that isn't directly related to your work, don't hesitate to propose it… (see the `file-good-first-bug` skill)"* — a behavioral trigger embedded in always-loaded context.
- `find-reviewer` fires "when committing" — a lifecycle trigger, not a user keyword.

### P6 Prompts rot
Instruction files drift stale; treat them as code under review and prune.
- `AGENTS.md` amended ~monthly since Nov 2025; every change reviewed by `ai4dev-reviewers`.
- The file itself encodes rot-awareness: L57 *"The `/source/<path>` form follows tip and rots like a bare line number"* — prefer rev-pinned permalinks; L63 tells the agent to flag a stale checkout.
- Root file actively *deletes* failure modes once tooling covers them (e.g. bug 2070136 "Correct and tighten the guidance on referring to code" replaced weaker prose).

### Bonus: when you SHOULD write (README + docs policy)
- Write in-tree only for *broadly useful, tree-wide* workflows; everything else → marketplace (`firefox-aidev-plugins` auto-enabled, `aidev-plugins` for general Mozilla).
- Write when the description's always-on context cost is earned by genuine cross-team reuse; a description "too broad" that misfires is worse than no skill.
- `review-context.toml` rules are written by the *owners* of the code: *"lets the people who own a piece of code encode their review expectations once, in a file in the repository, and have the agent apply them automatically every time."*
- Validate before landing: `./mach lint review-context.toml`.

## 3. omtre/Laber mechanisms read for the comparison

| Mechanism | Path | What it does |
|---|---|---|
| `rules-audit` skill | `Laber/tools/mp-trellis-pack/skills/rules-audit/SKILL.md` | Audits always-loaded rule files: enumerate each instruction, find evidence (command exists / path exists / convention honored), rule `keep`/`prune`/`annotate`, gated vs hands-off application, runs `voice_lint.py --changed` after edits. Directly implements "prompts rot" remediation. |
| `voice.md` | `Laber/.trellis/spec/agents/voice.md` | Bilingual style spec. I-rules for prompt files: I4 (every requirement names trigger condition + object + action), I7 (one requirement in one place, elsewhere only a pointer), I8 (requirements must be checkable). Ratchet lint via `voice_lint.py`. |
| `writing-for-agents` skill | `Laber/tools/mp-trellis-pack/skills/writing-for-agents/SKILL.md` + `SKILL-MECHANICS.md` | The full theory: context pointers (wording = trigger), two loads (context vs cognitive), information hierarchy (in-file step → in-file reference → disclosed reference), progressive disclosure, leading words, pruning vocabulary (relevance / sediment / no-op / cache), model-invoked vs user-invoked skills, router skills. |
| omtre root `AGENTS.md` | `omtre/AGENTS.md` | Managed `TRELLIS:START/END` block: 4 pointer bullets to `.trellis/` dirs + skills/subagents note. Pure pointer style, ~19 lines of managed content. |
| Session-start injection | `omtre/packages/cli/src/templates/shared-hooks/session-start.py` | Emits compact `<session-context>`: git state, active task, spec-index *paths only* (`## Available indexes (read on demand)`, L900–903), workflow Phase Index summary (breadcrumb tag blocks stripped to avoid duplication, L789–801), `<task-status>` with computed Next-Action, closing `<ready>` *"Load workflow/spec/task details only when needed."* (L916). |
| Per-turn breadcrumb | `omtre/packages/cli/src/templates/shared-hooks/inject-workflow-state.py` | UserPromptSubmit hook: re-injects a 3-line `<workflow-state>` every turn, parsed from `workflow.md` `[workflow-state:STATUS]` tag blocks (single source of truth, L13–18); `no_task` branch carries computed `next:` frontier pointer; `prompt_injection.skip_keyword` escape hatch. |

## 4. Gap analysis (detail behind answer.md)

- **Scope > Prompts**: omtre scopes by *task* (spec indexes filtered via `spec_scope`/`active_task` in session-start.py L608–664) and by phase (workflow-state tags), not by *directory*. No convention of per-directory `AGENTS.md` in generated projects. **Partial.**
- **Pointers > Prose**: omtre's AGENTS.md is pointer-pure; session-start emits index *paths* not content; writing-for-agents formalizes pointer wording. **Covered** (and deeper than Firefox's implicit practice).
- **Tools > Prompts**: session-start tells the agent `task.py`/`get_context.py` commands; spec routing is computed by scripts, not described. Equivalent spirit to searchfox-cli guidance. **Covered/partial** — omtre lacks an explicit "prefer tool X over searching" mandate in root AGENTS.md, but hook scripts do the lookups.
- **Lazy > Always**: session-start is explicitly lazy (pointers + "read on demand"); skills exist via marketplace/bundled-skills; per-turn breadcrumb re-injects only 3 lines. **Covered.**
- **Triggers > Memory**: voice I4 requires trigger conditions in writing; inject-workflow-state fires on every prompt (status trigger); codex `dispatch_mode` banner. But no equivalent of path-triggered `review-context.toml` — no file-match → inject-rule mechanism for review or edits. **Partial.**
- **Prompts rot**: `rules-audit` is a dedicated remediation skill (evidence-based prune/annotate); writing-for-agents defines sediment/no-op/cache; `trellis update` rewrites managed blocks. Rot is handled *reactively by skill*, not *continuously by review process* — no `ai4dev-reviewers` analog; coverage depends on someone invoking the skill. **Partial→covered** (mechanism exists, cadence is manual).
- **When to write**: writing-for-agents SKILL-MECHANICS gives the invocation cost model; rules-audit's audit objects define what belongs always-loaded. Comparable to Firefox's README gate. **Covered** at the level of guidance; Firefox adds a *structural* gate (marketplace vs in-tree) that omtre mirrors with bundled vs marketplace skills.
