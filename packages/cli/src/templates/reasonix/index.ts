/**
 * Reasonix template module.
 *
 * Reasonix (DeepSeek-Reasonix) is a DeepSeek-native AI coding agent.
 * It stores skills as `.reasonix/skills/<name>/SKILL.md` (Markdown + frontmatter).
 *
 * Subagent skills (omtre-implement, omtre-check) use `runAs: subagent`
 * frontmatter so Reasonix spawns them as isolated subagent loops.
 */

import { createTemplateReader, type AgentTemplate } from "../template-utils.js";

const { listMdAgents } = createTemplateReader(import.meta.url);

/** Subagent skill definitions (omtre-implement, omtre-check). */
export function getAllAgents(): AgentTemplate[] {
  return listMdAgents();
}
