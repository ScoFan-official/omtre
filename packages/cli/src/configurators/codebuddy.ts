import { AI_TOOLS } from "../types/ai-tools.js";
import {
  resolvePlaceholders,
  collectBothTemplates,
  collectSharedHooks,
} from "./shared.js";
import {
  getAllAgents,
  getSettingsTemplate,
} from "../templates/codebuddy/index.js";

/**
 * The CodeBuddy file set — written at init and diffed by `omtre update`.
 * - commands/omt/ — start + finish-work as slash commands
 * - skills/omtre-{name}/SKILL.md — auto-triggered skills from `common/skills/`
 * - agents/{name}.md — sub-agent definitions
 * - hooks/*.py — shared hook scripts
 * - settings.json — hook configuration
 */
export function collectCodebuddyTemplates(): Map<string, string> {
  const files = collectBothTemplates(
    AI_TOOLS.codebuddy.templateContext,
    (n) => `.codebuddy/commands/omt/${n}.md`,
    ".codebuddy/skills",
  );
  for (const agent of getAllAgents()) {
    files.set(`.codebuddy/agents/${agent.name}.md`, agent.content);
  }
  for (const [k, v] of collectSharedHooks(".codebuddy/hooks", "codebuddy")) {
    files.set(k, v);
  }
  const settings = getSettingsTemplate();
  files.set(
    `.codebuddy/${settings.targetPath}`,
    resolvePlaceholders(settings.content),
  );
  return files;
}
