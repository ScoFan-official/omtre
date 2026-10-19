import path from "node:path";
import { AI_TOOLS } from "../types/ai-tools.js";
import {
  resolvePlaceholders,
  wrapWithCommandFrontmatter,
  collectBothTemplates,
  collectSharedHooks,
  applyPullBasedPreludeMarkdown,
} from "./shared.js";
import { getAllAgents, getSettingsTemplate } from "../templates/qoder/index.js";

/**
 * The Qoder file set — written at init and diffed by `omtre update`.
 *
 * Qoder is a pull-based class-2 platform. Custom Commands require YAML
 * frontmatter with `name` + `description` and use a flat layout, so
 * session-boundary commands get wrapped via `wrapWithCommandFrontmatter`;
 * auto-trigger workflows stay as plain skills. `inject-subagent-context.py` is
 * excluded because Qoder's hook can't inject sub-agent prompts — sub-agents
 * pull task context themselves.
 */
export function collectQoderTemplates(): Map<string, string> {
  const files = collectBothTemplates(
    AI_TOOLS.qoder.templateContext,
    (n) => `.qoder/commands/omtre-${n}.md`,
    ".qoder/skills",
    (filePath, content) => {
      const name = path.basename(filePath, ".md");
      return wrapWithCommandFrontmatter(name, content);
    },
  );
  for (const agent of applyPullBasedPreludeMarkdown(getAllAgents())) {
    files.set(`.qoder/agents/${agent.name}.md`, agent.content);
  }
  for (const [k, v] of collectSharedHooks(".qoder/hooks", "qoder")) {
    files.set(k, v);
  }
  const settings = getSettingsTemplate();
  files.set(
    `.qoder/${settings.targetPath}`,
    resolvePlaceholders(settings.content),
  );
  return files;
}
