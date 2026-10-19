# Omtre on DeepSeek Harness (dsh)

dsh is a **class-2 pull-based** Omtre host: no session-start hook auto-injects
workflow context, so the agent loads the Omtre skills on demand through its
skill-loader tool.

| Capability | Status |
| --- | --- |
| Skills (`.agents/skills/omtre-*/SKILL.md`) | Works — dsh discovers this shared root natively |
| Entry skills (`.dsh/skills/omtre-*/SKILL.md`) | Works — dsh's own project skill root (highest rank) |
| Context hooks | None — pull-based: skills read `.omtre/` files directly |
| Sub-agents | None shipped — implement/check/research run inline via the workflow skills |

## Quick start

```bash
omtre init --dsh -u your-name
dsh web        # or: dsh --profile headless "start a Omtre task for ..."
```

In dsh:

1. Open a session in the project root and describe the work in natural
   language. For a new task the agent should load the `omtre-start` skill,
   which reads the current task state from `.omtre/` and routes to
   `omtre-brainstorm` (unclear requirements), `omtre-before-dev` (about to
   write code), `omtre-check` (done coding), or `omtre-update-spec`
   (learned something worth capturing).
2. Entry skills are `omtre-start` / `omtre-continue` / `omtre-finish-work`
   in `.dsh/skills/`. You can also ask for them by name at any time.
3. Type `/omt:finish-work` is a slash-command convention from other hosts —
   dsh has no slash palette, so say "finish the omtre task" instead, and the
   agent loads `omtre-finish-work`.

## File map

- `.agents/skills/` — auto-triggered workflow skills (`omtre-before-dev`,
  `omtre-brainstorm`, `omtre-check`, `omtre-break-loop`,
  `omtre-update-spec`) plus the bundled `omtre-meta` /
  `omtre-spec-bootstrap` / `omtre-session-insight` skills. Byte-identical
  to Codex / Gemini CLI / Pi / Kimi writes into the same shared root.
- `.dsh/skills/` — dsh-private entry skills (`omtre-start` /
  `omtre-continue` / `omtre-finish-work`).
- `.omtre/` — specs, tasks, workspace memory, and the shared scripts the
  skills invoke (`get_context.py`, `task.py`, ...).

## Notes

- Skill scripts pass `--platform dsh` to `get_context.py`; the value is used
  as a platform-scoped context key.
- The shipped `minimal` agent preset composes only `bash` +
  `str_replace_editor`; the default presets include `web_search` and the
  filesystem/terminal tools the skills assume.
- dsh has no project-level sub-agent definition surface, so Omtre ships no
  `omtre-implement` / `omtre-check` / `omtre-research` agent prompts
  here — the workflow skills run those phases inline in the main session.
