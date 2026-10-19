import { AI_TOOLS } from "../types/ai-tools.js";
import {
  resolvePlaceholders,
  resolveAllAsSkills,
  resolveBundledSkills,
  collectSkillTemplates,
  collectSharedHooks,
} from "./shared.js";
import { getAllAgents, getIdeHooks } from "../templates/kiro/index.js";

/**
 * The Kiro Code file set — written at init and diffed by `omtre update`.
 * Kiro's configDir is ".kiro/skills"; agents and hooks go under ".kiro/".
 * - skills/omtre-{name}/SKILL.md — all templates as auto-triggered skills
 * - agents/{name}.json — main `omtre` agent (per-turn workflow-state +
 *   session-start hooks) plus 3 sub-agents (agentSpawn → inject-subagent-context)
 * - hooks/*.py — shared hook scripts (referenced by agent JSON / .kiro.hook)
 * - hooks/*.kiro.hook — IDE hook definitions (promptSubmit → inject-workflow-state)
 */
export function collectKiroTemplates(): Map<string, string> {
  const files = new Map<string, string>();
  const ctx = AI_TOOLS.kiro.templateContext;
  for (const [filePath, content] of collectSkillTemplates(
    ".kiro/skills",
    resolveAllAsSkills(ctx),
    resolveBundledSkills(ctx),
  )) {
    files.set(filePath, content);
  }
  for (const agent of getAllAgents()) {
    files.set(
      `.kiro/agents/${agent.name}.json`,
      resolvePlaceholders(agent.content),
    );
  }
  for (const [k, v] of collectSharedHooks(".kiro/hooks", "kiro")) {
    files.set(k, v);
  }
  for (const hook of getIdeHooks()) {
    files.set(`.kiro/hooks/${hook.name}`, resolvePlaceholders(hook.content));
  }
  return files;
}
