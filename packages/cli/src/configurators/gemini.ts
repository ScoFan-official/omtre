import { AI_TOOLS } from "../types/ai-tools.js";
import {
  resolvePlaceholders,
  resolveCommands,
  resolveSkillsNeutral,
  resolveBundledSkills,
  collectSkillTemplates,
  collectSharedHooks,
  applyPullBasedPreludeMarkdown,
} from "./shared.js";
import {
  getAllAgents,
  getSettingsTemplate,
} from "../templates/gemini/index.js";

/**
 * The Gemini CLI file set — written at init and diffed by `omtre update`.
 * Gemini is a pull-based class-2 platform.
 * - commands/omt/ — start + finish-work as TOML slash commands
 * - .agents/skills/omtre-{name}/SKILL.md — auto-triggered shared skills
 *   written to the cross-platform `.agents/skills/` workspace alias (Gemini
 *   CLI 0.40+ reads it natively; previously `.gemini/skills/` was used,
 *   which collided with Codex's identical write target and caused
 *   duplicate-skill warnings — issue #224). The neutral resolver keeps content
 *   byte-identical to Codex's writes for the same skill names.
 * - agents/{name}.md — sub-agent definitions, with pull-based prelude
 * - hooks/*.py — session-start only (no inject-subagent-context.py — Gemini
 *   BeforeTool can fire but #18128 limits chain-of-thought visibility; sub-agents
 *   Read jsonl/prd themselves)
 * - settings.json — hook configuration (SessionStart + BeforeAgent)
 */
export function collectGeminiTemplates(): Map<string, string> {
  const ctx = AI_TOOLS.gemini.templateContext;
  const files = new Map<string, string>();
  for (const cmd of resolveCommands(ctx)) {
    const toml = `description = "Omtre: ${cmd.name}"\n\nprompt = """\n${cmd.content}\n"""\n`;
    files.set(`.gemini/commands/omt/${cmd.name}.toml`, toml);
  }
  for (const [filePath, content] of collectSkillTemplates(
    ".agents/skills",
    resolveSkillsNeutral(ctx),
    resolveBundledSkills(ctx),
  )) {
    files.set(filePath, content);
  }
  for (const agent of applyPullBasedPreludeMarkdown(getAllAgents())) {
    files.set(`.gemini/agents/${agent.name}.md`, agent.content);
  }
  for (const [k, v] of collectSharedHooks(".gemini/hooks", "gemini")) {
    files.set(k, v);
  }
  files.set(
    ".gemini/settings.json",
    resolvePlaceholders(getSettingsTemplate()),
  );
  return files;
}
