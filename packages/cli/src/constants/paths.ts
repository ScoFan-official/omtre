/**
 * Path constants for omtre workflow structure
 *
 * Change these values to rename directories across the entire project.
 * All paths should be relative to the project root.
 */

/** Home directory state root (under os.homedir()) */
export const HOME_DIR_NAME = ".omtre";

/** CLI binary and prefix constants */
export const CLI_BIN_NAME = "omtre";
export const CLI_SHORT_BIN_NAME = "omt";
export const SKILL_PREFIX = "omtre-";
export const SLASH_COMMAND_NS = "omt";

// Directory names (can be renamed)
export const DIR_NAMES = {
  /** Root workflow directory */
  WORKFLOW: ".omtre",
  /** Workspace directory (under .omtre/) - developer work areas */
  WORKSPACE: "workspace",
  /** Tasks directory (under .omtre/) - unified task storage */
  TASKS: "tasks",
  /** Archive directory (under tasks/) */
  ARCHIVE: "archive",
  /** Spec/guidelines directory (under .omtre/) */
  SPEC: "spec",
  /** Scripts directory (under .omtre/) */
  SCRIPTS: "scripts",
  /** Channel runtime agent definitions (under .omtre/) */
  AGENTS: "agents",
  /** Domain-layer boards (under .omtre/) — user-data zone, scaffold-once */
  DOMAINS: "domains",
} as const;

// File names
export const FILE_NAMES = {
  /** Root agent instructions file */
  AGENTS: "AGENTS.md",
  /** Developer identity file */
  DEVELOPER: ".developer",
  /** Current task pointer */
  CURRENT_TASK: ".current-task",
  /** Task metadata */
  TASK_JSON: "task.json",
  /** Requirements document */
  PRD: "prd.md",
  /** Workflow guide */
  WORKFLOW_GUIDE: "workflow.md",
  /** Journal file prefix */
  JOURNAL_PREFIX: "journal-",
  /** Workflow configuration file */
  CONFIG_YAML: "config.yaml",
  /** Installed workflow version file */
  VERSION: ".version",
  /** Template hash manifest file */
  TEMPLATE_HASHES: ".template-hashes.json",
  /** Local hook overrides file */
  HOOKS_LOCAL: "hooks.local.json",
  /** Runtime state directory */
  RUNTIME_DIR: ".runtime",
  /** Ralph loop state file */
  RALPH_STATE: ".ralph-state.json",
  /** Migration provenance marker file */
  MIGRATED_FROM: ".migrated-from",
} as const;

// Constructed paths (relative to project root)
export const PATHS = {
  /** .omtre/ */
  WORKFLOW: DIR_NAMES.WORKFLOW,
  /** .omtre/workspace/ */
  WORKSPACE: `${DIR_NAMES.WORKFLOW}/${DIR_NAMES.WORKSPACE}`,
  /** .omtre/tasks/ */
  TASKS: `${DIR_NAMES.WORKFLOW}/${DIR_NAMES.TASKS}`,
  /** .omtre/spec/ */
  SPEC: `${DIR_NAMES.WORKFLOW}/${DIR_NAMES.SPEC}`,
  /** .omtre/scripts/ */
  SCRIPTS: `${DIR_NAMES.WORKFLOW}/${DIR_NAMES.SCRIPTS}`,
  /** .omtre/agents/ */
  AGENTS: `${DIR_NAMES.WORKFLOW}/${DIR_NAMES.AGENTS}`,
  /** .omtre/domains/ */
  DOMAINS: `${DIR_NAMES.WORKFLOW}/${DIR_NAMES.DOMAINS}`,
  /** .omtre/.developer */
  DEVELOPER_FILE: `${DIR_NAMES.WORKFLOW}/${FILE_NAMES.DEVELOPER}`,
  /** .omtre/.current-task */
  CURRENT_TASK_FILE: `${DIR_NAMES.WORKFLOW}/${FILE_NAMES.CURRENT_TASK}`,
  /** .omtre/workflow.md */
  WORKFLOW_GUIDE_FILE: `${DIR_NAMES.WORKFLOW}/${FILE_NAMES.WORKFLOW_GUIDE}`,
} as const;

/**
 * Get developer's workspace directory path
 * @example getWorkspaceDir("john") => ".omtre/workspace/john"
 */
export function getWorkspaceDir(developer: string): string {
  return `${PATHS.WORKSPACE}/${developer}`;
}

/**
 * Get task directory path
 * @example getTaskDir("01-21-my-task") => ".omtre/tasks/01-21-my-task"
 */
export function getTaskDir(taskName: string): string {
  return `${PATHS.TASKS}/${taskName}`;
}

/**
 * Get archive directory path
 * @example getArchiveDir() => ".omtre/tasks/archive"
 */
export function getArchiveDir(): string {
  return `${PATHS.TASKS}/${DIR_NAMES.ARCHIVE}`;
}
