import path from "node:path";
import { AI_TOOLS } from "../types/ai-tools.js";
import {
  resolvePlaceholders,
  wrapWithCommandFrontmatter,
  collectBothTemplates,
  collectSharedHooks,
  applyPullBasedPreludeMarkdown,
} from "./shared.js";
import { getAllAgents, getSettingsTemplate } from "../templates/trae/index.js";

/**
 * The Trae IDE file set — written at init and diffed by `omtre update`.
 *
 * Trae is a class-2 platform: hooks fire on SessionStart + UserPromptSubmit in
 * the main session, but cannot inject sub-agent prompts. Sub-agents use a
 * pull-based prelude to load context themselves.
 *
 *   .trae/
 *   ├── commands/      # Slash commands (omtre-*.md with frontmatter)
 *   ├── skills/        # Skill definitions
 *   ├── agents/        # Sub-agent definitions with pull-based prelude
 *   ├── hooks/         # Shared Python hook scripts
 *   └── hooks.json     # Hook event registration
 */
export function collectTraeTemplates(): Map<string, string> {
  const files = collectBothTemplates(
    AI_TOOLS.trae.templateContext,
    (n) => `.trae/commands/omtre-${n}.md`,
    ".trae/skills",
    (filePath, content) => {
      const name = path.basename(filePath, ".md");
      return wrapWithCommandFrontmatter(name, content);
    },
  );
  for (const agent of applyPullBasedPreludeMarkdown(getAllAgents())) {
    files.set(`.trae/agents/${agent.name}.md`, agent.content);
  }
  for (const [k, v] of collectSharedHooks(".trae/hooks", "trae")) {
    files.set(k, v);
  }
  const settings = getSettingsTemplate();
  files.set(
    `.trae/${settings.targetPath}`,
    resolvePlaceholders(settings.content),
  );
  return files;
}
