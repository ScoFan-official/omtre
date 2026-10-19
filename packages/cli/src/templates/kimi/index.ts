/**
 * Kimi Code template module.
 *
 * Kimi Code is a class-2 pull-based platform:
 * - Workflow/bundled skills go to the shared `.agents/skills/` root via the
 *   neutral resolver (byte-identical to Codex/Gemini/Pi writes).
 * - User-invocable entry points (`omtre-start` / `omtre-continue` /
 *   `omtre-finish-work`, invoked as `/skill:omtre-<name>`) and the Omtre
 *   agent prompts live under `.kimi-code/skills/<name>/SKILL.md`.
 * - The same agent prompts are also installed as project-level custom
 *   sub-agent definitions under `.kimi-code/agents/<name>.md`.
 *
 * Kimi has no project-level hooks/settings file Omtre may write, so no
 * hooks or settings are shipped; omtre-implement / omtre-check get the
 * pull-based prelude, omtre-research stays standalone.
 */

import { createTemplateReader, type AgentTemplate } from "../template-utils.js";

const { listMdAgents } = createTemplateReader(import.meta.url);

/** Omtre agent prompts (omtre-implement, omtre-check, omtre-research), installed as Kimi skills. */
export function getAllAgents(): AgentTemplate[] {
  return listMdAgents();
}
