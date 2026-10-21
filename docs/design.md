# omtre design notes

omtre is a repo-native workflow harness for AI coding agents. It is not an
agent, a model, or a hosted service. It is the layer that gives an agent three
things at the start of every session: the project's contracts, the active
task's context, and the memory of previous work.

## Five commitments

### 1. Contracts over advice

Prompt-only guidance decays. omtre keeps the durable rules in
`.omtre/spec/`, scopes them by path and task, and makes the workflow check
against them. A rule that a tool can enforce should not depend on the agent
remembering it.

### 2. Repo-native state

Specs, tasks, decisions, and journals live in the repository. There is no
hidden control plane and no vendor-owned source of truth. A reviewer can read
the same artifacts the agent read, and a fork can keep working if the tool
disappears.

### 3. One spine, many agents

The harness is agent-agnostic. The same `.omtre/` layout and workflow contract
drive 22 coding agents and IDEs. Adapters translate file conventions; they do
not fork the process or the vocabulary.

### 4. Small core, absorbable edge

The core should stay small enough to audit: task state, spec loading, gates,
and the CLI. Skills, templates, and catalog assets are the edge. External
ideas are absorbed by rewriting them into native verbs, gates, specs, or
skills; copying a file verbatim is the exception, recorded with attribution.

### 5. Independent cadence, transparent lineage

omtre has its own semantic version line, roadmap, and release cadence. Upstream
projects are inputs, not the roadmap. Lineage is documented in `NOTICE`,
`docs/upstream.md`, and the repository history; attribution is not a brand.

## What omtre deliberately does not do

- It does not own your model, editor, or agent runtime.
- It does not hide project state in a SaaS.
- It does not require a particular vendor or a single IDE.
- It does not copy upstream version numbers into its own releases.
- It does not treat a skill catalog as a substitute for a contract.

## Versioning

omtre starts its independent line at `1.0.0`. Releases use semantic versioning
and the `cli-v<version>` tag prefix. The prefix identifies the CLI channel; the
number belongs to omtre. See `docs/upstream.md` for the sync policy.
