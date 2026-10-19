import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { AI_TOOLS } from "../types/ai-tools.js";
import { getClaudeTemplatePath } from "../templates/extract.js";
import {
  getSettingsTemplate,
  getStatuslineHook,
} from "../templates/claude/index.js";
import { toPosix } from "../utils/posix.js";
import {
  resolvePlaceholders,
  resolveCommands,
  resolveSkills,
  resolveBundledSkills,
  collectSkillTemplates,
  collectSharedHooks,
  writeTemplateMap,
  type PlatformConfigureOptions,
} from "./shared.js";

const EXCLUDE_PATTERNS = [
  ".d.ts",
  ".d.ts.map",
  ".js",
  ".js.map",
  ".ts", // TypeScript source — dev-only; not part of user-shipped templates
  "__pycache__",
];

function shouldExclude(filename: string): boolean {
  for (const pattern of EXCLUDE_PATTERNS) {
    if (filename.endsWith(pattern) || filename === pattern) {
      return true;
    }
  }
  return false;
}

/**
 * Inject the opt-in `statusLine` block into the settings.json template.
 * Runs BEFORE resolvePlaceholders so `{{PYTHON_CMD}}` resolves through the
 * normal path. The flag-off path never calls this — default output stays
 * byte-identical.
 *
 * Mirrors `preserveExistingClaudeStatusLine` (update.ts) exactly: parse →
 * assign (key lands at the END of the object) → stringify(null, 2) + "\n".
 * Byte-parity matters: `omtre update` re-derives the expected settings.json
 * via that preserve step, so any divergence (e.g. a different key position)
 * makes update flag a phantom settings.json change on every fresh opted-in
 * project.
 */
function injectStatusLine(content: string): string {
  const settings = JSON.parse(content) as Record<string, unknown>;
  settings.statusLine = {
    type: "command",
    command: "{{PYTHON_CMD}} .claude/hooks/statusline.py",
  };
  return `${JSON.stringify(settings, null, 2)}\n`;
}

/**
 * Walk the claude template directory into a `Map<relPath, content>` rooted at
 * `.claude/`, excluding build artifacts. Yields `agents/*.md` and
 * `settings.json`.
 *
 * `commands/` is skipped (sourced from the common template context) and so is
 * `hooks/` — the default hooks come from shared-hooks/ and the only file in
 * this tree's hooks/ is the opt-in statusline, which `configureClaude` adds
 * on request.
 */
function walkClaudeTemplateDir(): Map<string, string> {
  const files = new Map<string, string>();
  const sourcePath = getClaudeTemplatePath();

  function walk(relDir: string): void {
    const absDir = path.join(sourcePath, relDir);
    for (const entry of readdirSync(absDir)) {
      if (shouldExclude(entry)) continue;
      const absEntry = path.join(absDir, entry);
      const relEntry = relDir ? path.join(relDir, entry) : entry;
      if (statSync(absEntry).isDirectory()) {
        if (relEntry === "commands" || relEntry === "hooks") continue;
        walk(relEntry);
      } else {
        const content = readFileSync(absEntry, "utf-8");
        // Map keys are logical paths used as cross-platform hash keys
        // downstream. Always POSIX, regardless of host OS.
        files.set(
          toPosix(path.join(".claude", relEntry)),
          entry === "settings.json" ? resolvePlaceholders(content) : content,
        );
      }
    }
  }

  walk("");
  return files;
}

/**
 * The Claude Code file set — written at init and diffed by `omtre update`.
 * - agents/, settings.json from the platform template directory
 * - hooks/ from shared-hooks/ (unified with other platforms)
 * - commands/omt/ — start + finish-work as slash commands
 * - skills/omtre-{name}/SKILL.md — auto-triggered skills from `common/skills/`
 *
 * The opt-in statusline is deliberately absent — see `configureClaude`.
 */
export function collectClaudeTemplates(): Map<string, string> {
  const ctx = AI_TOOLS["claude-code"].templateContext;
  const files = walkClaudeTemplateDir();

  for (const cmd of resolveCommands(ctx)) {
    files.set(`.claude/commands/omt/${cmd.name}.md`, cmd.content);
  }
  for (const [filePath, content] of collectSkillTemplates(
    ".claude/skills",
    resolveSkills(ctx),
    resolveBundledSkills(ctx),
  )) {
    files.set(filePath, content);
  }
  for (const [k, v] of collectSharedHooks(".claude/hooks", "claude")) {
    files.set(k, v);
  }

  return files;
}

/**
 * Configure Claude Code by writing `collectClaudeTemplates`, plus the opt-in
 * statusline (`omtre init --with-statusline`) when requested.
 *
 * The statusline is a post-processor over the map rather than part of it:
 * `collectTemplates` has no parameter for a per-init flag, and a statusline
 * entry there would make `omtre update` force-install the hook on every
 * project that opted out (locked by regression.test.ts). It adds one file and
 * replaces one entry; it does not restate the file set.
 */
export async function configureClaude(
  cwd: string,
  options?: PlatformConfigureOptions,
): Promise<void> {
  const files = collectClaudeTemplates();

  if (options?.withStatusline === true) {
    const settings = getSettingsTemplate();
    files.set(
      `.claude/${settings.targetPath}`,
      resolvePlaceholders(injectStatusLine(settings.content)),
    );
    files.set(".claude/hooks/statusline.py", getStatuslineHook());
  }

  await writeTemplateMap(cwd, files);
}
