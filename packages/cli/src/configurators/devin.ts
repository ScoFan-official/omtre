import { AI_TOOLS } from "../types/ai-tools.js";
import { collectBothTemplates, resolvePlaceholders } from "./shared.js";
import {
  ohMyUpdateWorkflowTemplate,
  omtreStartWorkflowTemplate,
} from "../templates/devin/index.js";

/**
 * [oh-my] Devin dispatch note prepended to the `omtre-check` skill body:
 * on Devin, Phase 2.2 runs as a `run_subagent` dispatch (per the `[Devin]`
 * block in workflow.md), not as an inline checklist.
 */
const DEVIN_CHECK_DISPATCH_NOTE = `> **Dispatch mode (this repo):** inside an active Omtre task, Phase 2.2 runs as a sub-agent — dispatch \`run_subagent\` with a prompt starting \`Active task: <path>\` + "read the resolved check card — \`.omtre/agents/check.<axis>.md\` if it exists, else \`.omtre/agents/check.md\` — and follow it exactly" (see \`.omtre/workflow.md\` Phase 2 \`[Devin]\` block). Run this checklist inline only for a manual one-off check outside a task.`;

/**
 * The Devin (formerly Windsurf) file set — written at init and diffed by
 * `omtre update`.
 * - workflows/ — start + finish-work as slash commands (+ oh-my-update)
 * - skills/omtre-{name}/SKILL.md — auto-triggered skills from `common/skills/`
 *
 * [oh-my] fork deltas vs upstream:
 * - `.devin/workflows/omtre-start.md` is replaced by the Devin-specific
 *   template (`src/templates/devin/workflows/omtre-start.md`) which routes
 *   Phase 2 work to `run_subagent` dispatches.
 * - `.devin/workflows/oh-my-update.md` is added — the fork's update workflow.
 * - `.devin/skills/omtre-check/SKILL.md` gains a dispatch-mode note so the
 *   checklist is not run inline inside an active task.
 */
export function collectDevinTemplates(): Map<string, string> {
  const ctx = AI_TOOLS.devin.templateContext;
  const files = collectBothTemplates(
    ctx,
    (n) => `.devin/workflows/omtre-${n}.md`,
    ".devin/skills",
  );

  files.set(
    ".devin/workflows/omtre-start.md",
    resolvePlaceholders(omtreStartWorkflowTemplate, ctx),
  );
  files.set(
    ".devin/workflows/oh-my-update.md",
    resolvePlaceholders(ohMyUpdateWorkflowTemplate, ctx),
  );

  const checkSkillPath = ".devin/skills/omtre-check/SKILL.md";
  const checkSkill = files.get(checkSkillPath);
  if (checkSkill) {
    files.set(
      checkSkillPath,
      checkSkill.replace(
        "# Code Quality Check\n",
        `# Code Quality Check\n\n${DEVIN_CHECK_DISPATCH_NOTE}\n`,
      ),
    );
  }

  return files;
}
