import { AI_TOOLS } from "../types/ai-tools.js";
import { collectBothTemplates } from "./shared.js";

/**
 * The Antigravity file set — written at init and diffed by `omtre update`.
 * - workflows/ — start + finish-work as slash commands
 * - skills/omtre-{name}/SKILL.md — auto-triggered skills from `common/skills/`
 */
export function collectAntigravityTemplates(): Map<string, string> {
  return collectBothTemplates(
    AI_TOOLS.antigravity.templateContext,
    (n) => `.agent/workflows/${n}.md`,
    ".agent/skills",
  );
}
