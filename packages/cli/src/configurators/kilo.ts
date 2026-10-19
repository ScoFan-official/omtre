import { AI_TOOLS } from "../types/ai-tools.js";
import { collectBothTemplates } from "./shared.js";

/**
 * The Kilo CLI file set — written at init and diffed by `omtre update`.
 * - workflows/ — start + finish-work as slash commands
 * - skills/omtre-{name}/SKILL.md — auto-triggered skills from `common/skills/`
 */
export function collectKiloTemplates(): Map<string, string> {
  return collectBothTemplates(
    AI_TOOLS.kilo.templateContext,
    (n) => `.kilocode/workflows/${n}.md`,
    ".kilocode/skills",
  );
}
