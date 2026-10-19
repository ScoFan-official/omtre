/**
 * Grok Build configurator.
 *
 * Grok Build (xAI) is a pull-based class-2 platform (agentCapable, no hooks).
 * Three output paths:
 * - `.grok/skills/` — workflow and bundled skills
 * - `.grok/commands/omtre-*.md` — flat slash commands (Grok layout)
 * - `.grok/agents/` — sub-agent definitions with pull-based prelude
 *
 * Do not install SessionStart/UserPromptSubmit injection hooks here until Grok
 * consumes hook stdout additionalContext (verified absent on 0.2.x).
 */

import { AI_TOOLS } from "../types/ai-tools.js";
import { getAllAgents } from "../templates/grok/index.js";
import {
  collectSkillTemplates,
  resolveBundledSkills,
  resolveCommands,
  resolveSkills,
  applyPullBasedPreludeMarkdown,
} from "./shared.js";

/**
 * The Grok Build file set — written at init and diffed by `omtre update`.
 */
export function collectGrokTemplates(): Map<string, string> {
  const config = AI_TOOLS.grok;
  const ctx = config.templateContext;
  const files = new Map<string, string>();

  // 1. Workflow + bundled skills → .grok/skills/
  for (const [filePath, content] of collectSkillTemplates(
    ".grok/skills",
    resolveSkills(ctx),
    resolveBundledSkills(ctx),
  )) {
    files.set(filePath, content);
  }

  // 2. Commands → flat .grok/commands/omtre-<name>.md
  //    Grok discovers slash commands as flat *.md under commands/ (stem = name).
  for (const cmd of resolveCommands(ctx)) {
    files.set(`.grok/commands/omtre-${cmd.name}.md`, cmd.content);
  }

  // 3. Sub-agents → .grok/agents/ (with pull-based prelude on implement/check)
  for (const agent of applyPullBasedPreludeMarkdown(getAllAgents())) {
    files.set(`.grok/agents/${agent.name}.md`, agent.content);
  }

  return files;
}
