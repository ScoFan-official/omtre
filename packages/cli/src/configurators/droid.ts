import { AI_TOOLS } from "../types/ai-tools.js";
import {
  resolvePlaceholders,
  collectBothTemplates,
  collectSharedHooks,
} from "./shared.js";
import { getAllDroids, getSettingsTemplate } from "../templates/droid/index.js";

/**
 * The Factory Droid file set — written at init and diffed by `omtre update`.
 * - commands/omt/ — start + finish-work as slash commands
 * - skills/omtre-{name}/SKILL.md — auto-triggered skills from `common/skills/`
 * - droids/{name}.md — sub-agent definitions (Droid calls them "droids")
 * - hooks/*.py — shared hook scripts
 * - settings.json — hook configuration
 */
export function collectDroidTemplates(): Map<string, string> {
  const files = collectBothTemplates(
    AI_TOOLS.droid.templateContext,
    (n) => `.factory/commands/omt/${n}.md`,
    ".factory/skills",
  );
  for (const droid of getAllDroids()) {
    files.set(`.factory/droids/${droid.name}.md`, droid.content);
  }
  for (const [k, v] of collectSharedHooks(".factory/hooks", "droid")) {
    files.set(k, v);
  }
  const settings = getSettingsTemplate();
  files.set(
    `.factory/${settings.targetPath}`,
    resolvePlaceholders(settings.content),
  );
  return files;
}
