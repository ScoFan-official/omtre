/**
 * Reasonix configurator.
 *
 * Reasonix (DeepSeek-Reasonix) stores skills as `.reasonix/skills/<name>/SKILL.md`
 * with YAML frontmatter (name + description). Slash commands are code-built-in,
 * so no commands directory is generated.
 *
 * Workflow templates are surfaced as skills with `omtre-` prefix (invocable
 * via `/skill omtre-start`, `/skill omtre-continue`, etc.).
 * Subagent skills (omtre-implement, omtre-check) use `runAs: subagent`
 * frontmatter so Reasonix spawns them as isolated subagent loops.
 */

import { AI_TOOLS } from "../types/ai-tools.js";
import { getAllAgents } from "../templates/reasonix/index.js";
import {
  collectSkillTemplates,
  resolveAllAsSkills,
  resolveBundledSkills,
} from "./shared.js";

/**
 * The Reasonix file set — written at init and diffed by `omtre update`.
 */
export function collectReasonixTemplates(): Map<string, string> {
  const config = AI_TOOLS.reasonix;
  const ctx = config.templateContext;
  const files = new Map<string, string>();

  // Subagent skill names that replace common-skill equivalents.
  const agentNames = new Set(getAllAgents().map((a) => a.name));

  // Workflow skills filtered to avoid collision with subagent skills.
  const skills = resolveAllAsSkills(ctx).filter((s) => !agentNames.has(s.name));

  for (const [filePath, content] of collectSkillTemplates(
    ".reasonix/skills",
    skills,
    resolveBundledSkills(ctx),
  )) {
    files.set(filePath, content);
  }

  // Subagent skills (omtre-implement, omtre-check) — written with
  // runAs: subagent frontmatter for isolated subagent loops.
  for (const agent of getAllAgents()) {
    files.set(`.reasonix/skills/${agent.name}/SKILL.md`, agent.content);
  }

  return files;
}
