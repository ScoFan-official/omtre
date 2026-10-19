import { AI_TOOLS } from "../types/ai-tools.js";
import {
  applyPullBasedPreludeMarkdown,
  collectSkillTemplates,
  resolveCommands,
  resolveBundledSkills,
  resolvePlaceholders,
  resolveSkillsNeutral,
} from "./shared.js";
import {
  getAllAgents,
  getExtensionTemplate,
  getSettingsTemplate,
} from "../templates/pi/index.js";

function resolvePiCommands(): ReturnType<typeof resolveCommands> {
  const ctx = AI_TOOLS.pi.templateContext;
  const commands = resolveCommands(ctx);
  if (commands.some((command) => command.name === "start")) return commands;

  // Pi has extension hooks, so the shared command resolver filters `start`.
  // Keep a manual fallback because Pi's `session_start` event cannot mutate
  // model context; the strong startup injection happens later at agent start.
  const start = resolveCommands({ ...ctx, hasHooks: false }).find(
    (command) => command.name === "start",
  );
  return start ? [start, ...commands] : commands;
}

/**
 * The Pi file set — written at init and diffed by `omtre update`.
 */
export function collectPiTemplates(): Map<string, string> {
  const files = new Map<string, string>();
  const ctx = AI_TOOLS.pi.templateContext;

  for (const command of resolvePiCommands()) {
    files.set(`.pi/prompts/omtre-${command.name}.md`, command.content);
  }

  // Shared skills go to `.agents/skills/` (Pi discovers this cross-platform
  // workspace alias natively). Neutral resolver keeps content byte-identical
  // to Codex's/Gemini's writes for the same skill names, avoiding the
  // duplicate/conflicting-skill installs reported in #447.
  for (const [filePath, content] of collectSkillTemplates(
    ".agents/skills",
    resolveSkillsNeutral(ctx),
    resolveBundledSkills(ctx),
  )) {
    files.set(filePath, content);
  }

  for (const agent of applyPullBasedPreludeMarkdown(getAllAgents())) {
    files.set(`.pi/agents/${agent.name}.md`, agent.content);
  }

  files.set(".pi/extensions/omtre/index.ts", getExtensionTemplate());

  const settings = getSettingsTemplate();
  files.set(
    `.pi/${settings.targetPath}`,
    resolvePlaceholders(settings.content),
  );

  return files;
}
