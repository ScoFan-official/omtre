import { AI_TOOLS } from "../types/ai-tools.js";
import {
  COPILOT_INSTRUCTIONS_PATH,
  getAllHooks,
  getCopilotInstructions,
  getHooksConfig,
} from "../templates/copilot/index.js";
import { getAllAgents as getCursorAgents } from "../templates/cursor/index.js";
import {
  resolvePlaceholders,
  resolveCommands,
  resolveSkills,
  resolveBundledSkills,
  collectSkillTemplates,
  collectSharedHooks,
  applyPullBasedPreludeMarkdown,
  normalizeCopilotMarkdownAgents,
} from "./shared.js";

/**
 * The GitHub Copilot file set — written at init and diffed by `omtre update`.
 * - prompts/ — start + finish-work as prompt files
 * - skills/omtre-{name}/SKILL.md — auto-triggered skills from `common/skills/`
 * - agents/{name}.agent.md — sub-agent definitions (note .agent.md suffix)
 * - copilot/hooks/ — platform-specific + shared hook scripts
 * - hooks config — hooks.json
 * - copilot-instructions.md — repository-wide review guidance. `omtre update`
 *   replaces this entry with a managed-block merge over the user's file
 *   (`buildCopilotInstructionsTemplate`); on a fresh project the merge returns
 *   the template verbatim, so init and update agree.
 */
export function collectCopilotTemplates(): Map<string, string> {
  const ctx = AI_TOOLS.copilot.templateContext;
  const files = new Map<string, string>();
  for (const cmd of resolveCommands(ctx)) {
    files.set(`.github/prompts/${cmd.name}.prompt.md`, cmd.content);
  }
  for (const [filePath, content] of collectSkillTemplates(
    ".github/skills",
    resolveSkills(ctx),
    resolveBundledSkills(ctx),
  )) {
    files.set(filePath, content);
  }
  // Copilot's own session-start hook
  for (const hook of getAllHooks()) {
    files.set(`.github/copilot/hooks/${hook.name}`, hook.content);
  }
  // Shared hooks (inject-workflow-state.py only). Copilot bundles its own
  // session-start.py above; sub-agent context is pull-based (class-2).
  for (const [k, v] of collectSharedHooks(".github/copilot/hooks", "copilot")) {
    files.set(k, v);
  }
  // Agents: reuse Cursor content + prepend pull-based prelude, then
  // normalize Cursor's Claude-style tools frontmatter for Copilot.
  for (const agent of applyPullBasedPreludeMarkdown(
    normalizeCopilotMarkdownAgents(getCursorAgents()),
  )) {
    files.set(`.github/agents/${agent.name}.agent.md`, agent.content);
  }
  files.set(COPILOT_INSTRUCTIONS_PATH, getCopilotInstructions());
  const hooksConfig = resolvePlaceholders(getHooksConfig());
  files.set(".github/copilot/hooks.json", hooksConfig);
  files.set(".github/hooks/omtre.json", hooksConfig);
  return files;
}
