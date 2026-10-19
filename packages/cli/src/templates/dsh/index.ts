/**
 * DeepSeek Harness (dsh) template module.
 *
 * dsh is a class-2 pull-based, skills-only platform:
 * - Workflow + bundled skills go to the shared `.agents/skills/` root via
 *   the neutral resolver (byte-identical to Codex/Gemini/Pi/Kimi writes).
 * - User-invocable entry points (`omtre-start` / `omtre-continue` /
 *   `omtre-finish-work`, loaded by the dsh agent through its skill-loader
 *   tool) live under `.dsh/skills/<name>/SKILL.md` — dsh's own highest-rank
 *   project skill root.
 * - Operator guide `.dsh/DSH.md`.
 *
 * dsh has no shipped session-start hook, so `omtre-start` is kept as a
 * user-invocable skill. dsh ships no project-level sub-agent definition
 * surface, so no omtre-implement / omtre-check / omtre-research agent
 * prompts are written; implement/check/research run inline through the
 * workflow skills.
 */

import { createTemplateReader } from "../template-utils.js";

const { readTemplate } = createTemplateReader(import.meta.url);

/** Operator guide copied to `.dsh/DSH.md`. */
export function getDshGuide(): string {
  return readTemplate("DSH.md");
}
