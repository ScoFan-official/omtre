import { AI_TOOLS } from "../types/ai-tools.js";
import {
  resolvePlaceholders,
  collectBothTemplates,
  collectSharedHooks,
} from "./shared.js";
import { getAllAgents, getHooksConfig } from "../templates/cursor/index.js";

/**
 * The Cursor file set — written at init and diffed by `omtre update`.
 * - commands/ — start + finish-work as slash commands (omtre- prefix, flat)
 * - skills/omtre-{name}/SKILL.md — auto-triggered skills from `common/skills/`
 * - agents/{name}.md — sub-agent definitions
 * - hooks/*.py — shared hook scripts
 * - hooks.json — hook configuration (separate file, not settings.json)
 */
export function collectCursorTemplates(): Map<string, string> {
  const files = collectBothTemplates(
    AI_TOOLS.cursor.templateContext,
    (n) => `.cursor/commands/omtre-${n}.md`,
    ".cursor/skills",
  );
  for (const agent of getAllAgents()) {
    files.set(`.cursor/agents/${agent.name}.md`, agent.content);
  }
  for (const [k, v] of collectSharedHooks(".cursor/hooks", "cursor")) {
    files.set(k, v);
  }
  files.set(".cursor/hooks.json", resolvePlaceholders(getHooksConfig()));
  return files;
}
