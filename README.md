<p align="center">
<picture>
<source srcset="assets/hero.png" media="(prefers-color-scheme: dark)">
<source srcset="assets/hero.png" media="(prefers-color-scheme: light)">
<img src="assets/hero.png" alt="omtre Logo" width="500" style="image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges;">
</picture>
</p>

> **omtre** — this repo is the source/build workspace of [omtre](https://github.com/ScoFan-official/omtre), a standalone framework hard-forked from [mindfold-ai/trellis](https://github.com/mindfold-ai/trellis) (AGPL-3.0) with mattpocock-flavored role cards, Devin sub-agent dispatch, the `oh-my` workflow template, and `oh-my-update` self-update. Versions are `UPSTREAM-ohmy.N`; install from [omtre releases](https://github.com/ScoFan-official/omtre/releases) (`cli-v*` tags): `npm i -g https://github.com/ScoFan-official/omtre/releases/download/cli-v<ver>/omtre-<ver>.tgz`.

<p align="center">
<strong>An out-of-the-box engineering framework for AI coding.</strong><br/>
<sub>AI writes code fast, but every session it starts from scratch — no memory of your project, your conventions, or your team's requirements. omtre persists specs, tasks, and memory into your repo, so any coding agent works to your engineering standards.</sub>
</p>

<p align="center">
<a href="./README_CN.md">简体中文</a> •
<a href="./README.pack.md">Docs</a> •
<a href="#quick-start">Quick Start</a> •
<a href="./README.pack.md#platform-support-22">Supported Platforms</a> •
<a href="./marketplace/README.md">Marketplace</a>
</p>

<p align="center">
<a href="https://github.com/ScoFan-official/omtre/releases"><img src="https://img.shields.io/github/v/release/ScoFan-official/omtre?style=flat-square&color=2563eb" alt="release version" /></a>
<a href="https://github.com/mindfold-ai/Trellis/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-16a34a.svg?style=flat-square" alt="license" /></a>
<a href="https://github.com/ScoFan-official/omtre/stargazers"><img src="https://img.shields.io/github/stars/ScoFan-official/omtre?style=flat-square&color=eab308" alt="stars" /></a>
<a href="https://discord.com/invite/tWcCZ3aRHc"><img src="https://img.shields.io/badge/Discord-Join-5865F2?style=flat-square&logo=discord&logoColor=white" alt="Discord" /></a>
<a href="https://github.com/mindfold-ai/Trellis/issues"><img src="https://img.shields.io/github/issues/mindfold-ai/Trellis?style=flat-square&color=e67e22" alt="open issues" /></a>
<a href="https://github.com/mindfold-ai/Trellis/pulls"><img src="https://img.shields.io/github/issues-pr/mindfold-ai/Trellis?style=flat-square&color=9b59b6" alt="open PRs" /></a>
<a href="https://deepwiki.com/mindfold-ai/Trellis"><img src="https://img.shields.io/badge/Ask-DeepWiki-blue?style=flat-square" alt="Ask DeepWiki" /></a>
<a href="https://chatgpt.com/?q=Explain+the+project+mindfold-ai/Trellis+on+GitHub"><img src="https://img.shields.io/badge/Ask-ChatGPT-74aa9c?style=flat-square&logo=openai&logoColor=white" alt="Ask ChatGPT" /></a>
</p>

<p align="center">
<img src="assets/workflow.png" alt="omtre workflow demo" width="100%">
</p>

## Why omtre?

| Capability | What it changes |
| --- | --- |
| **Auto-injected specs** | Write conventions once in `.omtre/spec/`, then let omtre inject the relevant context into each session instead of repeating yourself. |
| **Task-centered workflow** | Keep PRDs, implementation context, review context, and task status in `.omtre/tasks/` so AI work stays structured. |
| **Project memory** | Journals in `.omtre/workspace/` preserve what happened last time, so each new session starts with real context. |
| **Team-shared standards** | Specs live in the repo, so one person's hard-won workflow or rule can benefit the whole team. |
| **Multi-platform setup** | Bring the same omtre structure to 22 AI coding platforms instead of rebuilding your workflow per tool. |

## Prerequisites:

- **Node.js** >= 18
- **Python** >= 3.9

## Quick Start

```bash
# 1. Install omtre
npm install -g omtre@latest

# 2. Initialize in your repo
omtre init -u your-name

# 3. Or initialize with the platforms you actually use
omtre init --cursor --opencode --codex -u your-name
```

See the [Quick Start](#quick-start) and [Supported Platforms](./README.pack.md#platform-support-22) guides for setup details.

## How to Use

The workflow is simple:

1. **Describe what you want** in natural language.
2. **Brainstorm** with the AI one question at a time until the PRD is clear, then implementation begins.
3. **Let it run** — the AI calls omtre Implement and auto-checks the result against specs, lint, type-check, and tests.
4. **Type `/omt:finish-work`** when the work is done or the session context fills up. omtre archives the task and updates journals.

## How It Works

omtre runs a 4-phase loop with auto-invoked skills and sub-agents:

1. **Plan** — `omtre-brainstorm` walks through requirements one question at a time and writes `prd.md`. Research-heavy items go to an `omtre-research` sub-agent. The result is curated specs + research files referenced from `implement.jsonl` / `check.jsonl`.
2. **Implement** — an `omtre-implement` sub-agent writes code from the PRD with the curated context auto-injected, no git commit.
3. **Verify** — an `omtre-check` sub-agent reviews the diff against specs and runs lint, type-check, and tests, self-fixing where it can.
4. **Finish** — a final check runs, then `omtre-update-spec` promotes new learnings back into `.omtre/spec/` so the next session starts smarter.

## Resources

| Need                            | Link                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------ |
| Install omtre in a repo         | [Quick Start](#quick-start)                                                    |
| Understand platform differences | [Supported Platforms](./README.pack.md#platform-support-22)                    |
| See the workflow in practice    | [Pack & Workflow Guide](./README.pack.md)                                      |
| Start from spec templates       | [Marketplace Templates](./marketplace/README.md)                               |
| Track releases                  | [Changelog](./CHANGELOG.md)                                                    |

## FAQ

<details>
<summary><strong>How is omtre different from <code>CLAUDE.md</code>, <code>AGENTS.md</code>, or <code>.cursorrules</code>?</strong></summary>

Those files are useful entry points, but they tend to become monolithic. omtre adds scoped specs, task PRDs, workflow gates, workspace memory, and platform-aware generated files around them.

</details>

<details>
<summary><strong>Is omtre only for Claude Code?</strong></summary>

No. omtre is a project layer that works across multiple coding agents and IDEs.

</details>

<details>
<summary><strong>Is omtre for solo developers or teams?</strong></summary>

Both. Solo developers use it for memory and repeatable workflow. Teams get the larger benefit: shared standards, task boundaries, reviewable context, and platform portability.

</details>

<details>
<summary><strong>Do I have to write every spec file manually?</strong></summary>

No. Many teams start by letting AI draft specs from existing code and then tighten the important parts by hand. omtre works best when you keep the high-signal rules explicit and versioned.

</details>

<details>
<summary><strong>Can teams use this without constant conflicts?</strong></summary>

Yes. Personal workspace journals stay separate per developer, while shared specs and tasks stay in the repo where they can be reviewed and improved like any other project artifact.

</details>

<details>
<summary><strong>Can I temporarily compare a project with and without omtre?</strong></summary>

Yes. `omtre ablate` temporarily removes all supported project-owned omtre
surfaces after creating a verified recovery transaction outside the project.
Start a fresh agent session for the comparison, then run `omtre restore` to
recover the exact prior state. Use `--dry-run` to preview either operation.
The private recovery transaction includes exact `.omtre` task, spec, and
workspace bytes, which may contain user-authored sensitive text, and is kept
until restore verifies successfully.

This is different from `omtre uninstall` (permanent removal) and
`OMTRE_HOOKS=0` (hooks only). Ablation does not launch agents, manage
worktrees, hide Git changes, or remove the global CLI, channel logs, or host
transcripts. If a managed path changes while ablated, restore refuses all
writes until the conflict is resolved.

</details>

## Community & Resources

- [Pack & Workflow Guide](./README.pack.md)
- [GitHub Issues](https://github.com/mindfold-ai/Trellis/issues)
- [Discord](https://discord.com/invite/tWcCZ3aRHc)
- [Marketplace](./marketplace/README.md)

<p align="center">
<a href="https://github.com/mindfold-ai/Trellis">Upstream Repository</a> •
<a href="https://github.com/mindfold-ai/Trellis/blob/main/LICENSE">AGPL-3.0 License</a> •
Originally built by <a href="https://github.com/mindfold-ai">Mindfold</a>
</p>
