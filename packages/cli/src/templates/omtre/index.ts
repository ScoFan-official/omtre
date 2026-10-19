/**
 * Omtre workflow templates
 *
 * These are GENERIC templates for user projects.
 * Do NOT use Omtre project's own .omtre/ directory (which may be customized).
 *
 * Directory structure:
 *   omtre/
 *   ├── scripts/
 *   │   ├── __init__.py
 *   │   ├── common/           # Shared utilities (Python)
 *   │   └── *.py              # Main scripts (Python)
 *   ├── agents/                # Channel runtime agent definitions
 *   │   └── *.md               # Loaded by `omtre channel spawn --agent <name>`
 *   ├── domains/               # Domain-layer scaffold (seed-once user data)
 *   ├── scripts-shell-archive/ # Archived shell scripts (for reference)
 *   ├── workflow.md           # Workflow guide
 *   ├── config.yaml            # Omtre configuration
 *   ├── gitignore.txt         # .gitignore content
 *   └── gitattributes.txt     # project-root .gitattributes content
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function readTemplate(relativePath: string): string {
  return readFileSync(join(__dirname, relativePath), "utf-8");
}

// Python scripts - package init
export const scriptsInit = readTemplate("scripts/__init__.py");

// Python scripts - common
export const commonInit = readTemplate("scripts/common/__init__.py");
export const commonPaths = readTemplate("scripts/common/paths.py");
export const commonDeveloper = readTemplate("scripts/common/developer.py");
export const commonGitContext = readTemplate("scripts/common/git_context.py");
export const commonTaskQueue = readTemplate("scripts/common/task_queue.py");
export const commonTaskUtils = readTemplate("scripts/common/task_utils.py");
export const commonActiveTask = readTemplate("scripts/common/active_task.py");
export const commonClaiDelta = readTemplate("scripts/common/clai_delta.py");
export const commonCliAdapter = readTemplate("scripts/common/cli_adapter.py");
export const commonConfig = readTemplate("scripts/common/config.py");
export const commonIo = readTemplate("scripts/common/io.py");
export const commonLog = readTemplate("scripts/common/log.py");
export const commonGit = readTemplate("scripts/common/git.py");
export const commonTypes = readTemplate("scripts/common/types.py");
export const commonTasks = readTemplate("scripts/common/tasks.py");
export const commonTaskContext = readTemplate("scripts/common/task_context.py");
export const commonTaskStore = readTemplate("scripts/common/task_store.py");
export const commonSessionContext = readTemplate(
  "scripts/common/session_context.py",
);
export const commonPackagesContext = readTemplate(
  "scripts/common/packages_context.py",
);
export const commonWorkflowPhase = readTemplate(
  "scripts/common/workflow_phase.py",
);
export const commonOmtreConfig = readTemplate("scripts/common/omtre_config.py");
export const commonSafeCommit = readTemplate("scripts/common/safe_commit.py");
export const commonFrontier = readTemplate("scripts/common/frontier.py");
export const commonRoster = readTemplate("scripts/common/roster.py");
export const commonVerify = readTemplate("scripts/common/verify.py");

// Python scripts - main
export const getDeveloperScript = readTemplate("scripts/get_developer.py");
export const initDeveloperScript = readTemplate("scripts/init_developer.py");
export const taskScript = readTemplate("scripts/task.py");
export const getContextScript = readTemplate("scripts/get_context.py");
export const addSessionScript = readTemplate("scripts/add_session.py");

// Configuration files
export const workflowMdTemplate = readTemplate("workflow.md");
// [oh-my] Fork's default workflow — Laber's variant with Devin `run_subagent`
// dispatch blocks ([Devin] markers). Bundled alongside the `native` flavor
// above; both carry the [oh-my] domain-routing / autonomy delta, so neither
// is byte-identical to upstream's `workflow.md`.
export const ohMyWorkflowMdTemplate = readTemplate("workflow-oh-my.md");
export const configYamlTemplate = readTemplate("config.yaml");
export const gitignoreTemplate = readTemplate("gitignore.txt");
export const gitattributesTemplate = readTemplate("gitattributes.txt");

// Channel runtime agent definitions (loaded by
// `packages/cli/src/commands/channel/agent-loader.ts` from `.omtre/agents/`).
// These are platform-agnostic Omtre runtime files dispatched at `omtre init`
// and refreshed by `omtre update`.
export const implementAgentTemplate = readTemplate("agents/implement.md");
export const checkAgentTemplate = readTemplate("agents/check.md");
export const researchAgentTemplate = readTemplate("agents/research.md");
export const orchestratorAgentTemplate = readTemplate("agents/orchestrator.md");

// Domain-layer scaffold files (dispatched under `.omtre/domains/`).
// `.omtre/domains/**` is a user-data zone: `omtre update` seeds these
// files only when missing and never manages, overwrites, or prompts on
// existing domain content (see `update.ts` collectTemplateFiles +
// PROTECTED_PATHS). `_scaffold/` is the per-domain skeleton agents copy when
// creating a new board — it is infra, not a board.
export const domainRegistryTemplate = readTemplate("domains/REGISTRY.md");
export const domainDisciplineTemplate = readTemplate("domains/DISCIPLINE.md");
export const domainWorklogProtocolTemplate = readTemplate(
  "domains/WORKLOG-PROTOCOL.md",
);
export const domainScaffoldReadmeTemplate = readTemplate(
  "domains/_scaffold/README.md",
);
export const domainScaffoldBoundaryTemplate = readTemplate(
  "domains/_scaffold/BOUNDARY.md",
);
export const domainScaffoldWorklogGitkeepTemplate = readTemplate(
  "domains/_scaffold/worklog/.gitkeep",
);
export const domainScaffoldReviewGitkeepTemplate = readTemplate(
  "domains/_scaffold/review/.gitkeep",
);

/**
 * Get all script templates as a map of relative path to content
 */
export function getAllScripts(): Map<string, string> {
  const scripts = new Map<string, string>();

  // Package init
  scripts.set("__init__.py", scriptsInit);

  // Common
  scripts.set("common/__init__.py", commonInit);
  scripts.set("common/paths.py", commonPaths);
  scripts.set("common/developer.py", commonDeveloper);
  scripts.set("common/git_context.py", commonGitContext);
  scripts.set("common/task_queue.py", commonTaskQueue);
  scripts.set("common/task_utils.py", commonTaskUtils);
  scripts.set("common/active_task.py", commonActiveTask);
  scripts.set("common/clai_delta.py", commonClaiDelta);
  scripts.set("common/cli_adapter.py", commonCliAdapter);
  scripts.set("common/config.py", commonConfig);
  scripts.set("common/io.py", commonIo);
  scripts.set("common/log.py", commonLog);
  scripts.set("common/git.py", commonGit);
  scripts.set("common/types.py", commonTypes);
  scripts.set("common/tasks.py", commonTasks);
  scripts.set("common/task_context.py", commonTaskContext);
  scripts.set("common/task_store.py", commonTaskStore);
  scripts.set("common/session_context.py", commonSessionContext);
  scripts.set("common/packages_context.py", commonPackagesContext);
  scripts.set("common/workflow_phase.py", commonWorkflowPhase);
  scripts.set("common/omtre_config.py", commonOmtreConfig);
  scripts.set("common/safe_commit.py", commonSafeCommit);
  scripts.set("common/frontier.py", commonFrontier);
  scripts.set("common/roster.py", commonRoster);
  scripts.set("common/verify.py", commonVerify);

  // Main
  scripts.set("get_developer.py", getDeveloperScript);
  scripts.set("init_developer.py", initDeveloperScript);
  scripts.set("task.py", taskScript);
  scripts.set("get_context.py", getContextScript);
  scripts.set("add_session.py", addSessionScript);

  return scripts;
}

/**
 * Get all channel runtime agent definitions as a map of relative path
 * (under `.omtre/agents/`) to content.
 *
 * Consumed by `omtre init` (to dispatch on first install) and by
 * `omtre update` (to backfill missing files and surface conflicts on edited
 * ones via the standard hash machinery).
 */
export function getAllAgents(): Map<string, string> {
  const agents = new Map<string, string>();
  agents.set("implement.md", implementAgentTemplate);
  agents.set("check.md", checkAgentTemplate);
  agents.set("research.md", researchAgentTemplate);
  agents.set("orchestrator.md", orchestratorAgentTemplate);
  return agents;
}

/**
 * Get all domain-layer scaffold files as a map of relative path (under
 * `.omtre/domains/`) to content.
 *
 * Consumed by `omtre init` (workflow configurator) and `omtre update`
 * (`collectTemplateFiles`). Both callers apply seed-once semantics: a path
 * that already exists on disk is user data and is never offered for write.
 */
export function getAllDomainFiles(): Map<string, string> {
  const files = new Map<string, string>();
  files.set("REGISTRY.md", domainRegistryTemplate);
  files.set("DISCIPLINE.md", domainDisciplineTemplate);
  files.set("WORKLOG-PROTOCOL.md", domainWorklogProtocolTemplate);
  files.set("_scaffold/README.md", domainScaffoldReadmeTemplate);
  files.set("_scaffold/BOUNDARY.md", domainScaffoldBoundaryTemplate);
  files.set("_scaffold/worklog/.gitkeep", domainScaffoldWorklogGitkeepTemplate);
  files.set("_scaffold/review/.gitkeep", domainScaffoldReviewGitkeepTemplate);
  return files;
}
