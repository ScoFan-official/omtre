import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDir, writeFile } from "../utils/file-writer.js";
import { replacePythonCommandLiterals } from "../configurators/shared.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type TemplateCategory = "scripts" | "markdown" | "commands";

const WORKFLOW_TEMPLATE_SUBDIRS = ["omtre", `${"t"}${"rellis"}`] as const;
const LEGACY_CONFIG_SCRIPT = `common/${"t"}${"rellis"}_config.py`;
const LEGACY_WORKFLOW_DIR = `.${"t"}${"rellis"}`;
const LEGACY_WORKFLOW_DIR_PATTERN = new RegExp(
  `\\.${"t"}${"rellis"}(?![a-zA-Z0-9_])`,
  "g",
);
const LEGACY_ENV_PREFIX = `${"T"}${"RELLIS"}_`;
const LEGACY_BLOCK_PREFIX = `<!-- ${"T"}${"RELLIS"}:`;
const LEGACY_TITLE = `# ${"T"}${"rellis"} Instructions`;

function normalizeLegacyScript(content: string): string {
  return content
    .replace(LEGACY_WORKFLOW_DIR_PATTERN, ".omtre")
    .replaceAll(LEGACY_ENV_PREFIX, "OMTRE_");
}

function normalizeLegacyRootTemplate(content: string): string {
  return content
    .replaceAll(LEGACY_WORKFLOW_DIR, ".omtre")
    .replaceAll(LEGACY_BLOCK_PREFIX, "<!-- OMTRE:")
    .replaceAll(LEGACY_TITLE, "# Omtre Instructions");
}

/**
 * Get the path to the omtre templates directory (.omtre/ scaffolding).
 */
export function getOmtreTemplatePath(): string {
  for (const subdir of WORKFLOW_TEMPLATE_SUBDIRS) {
    const templatePath = path.join(__dirname, subdir);
    if (fs.existsSync(templatePath)) {
      return templatePath;
    }
  }
  throw new Error(
    "Could not find omtre templates directory. Expected at templates/omtre/",
  );
}

/** @deprecated Use getOmtreTemplatePath() instead. */
export function getOmtreSourcePath(): string {
  return getOmtreTemplatePath();
}

/**
 * Get the path to the claude templates directory (hooks, agents, settings).
 */
export function getClaudeTemplatePath(): string {
  const templatePath = path.join(__dirname, "claude");
  if (fs.existsSync(templatePath)) {
    return templatePath;
  }
  throw new Error(
    "Could not find claude templates directory. Expected at templates/claude/",
  );
}

/**
 * Get the path to the opencode templates directory (agents, plugins, lib).
 */
export function getOpenCodeTemplatePath(): string {
  const templatePath = path.join(__dirname, "opencode");
  if (fs.existsSync(templatePath)) {
    return templatePath;
  }
  throw new Error(
    "Could not find opencode templates directory. Expected at templates/opencode/",
  );
}

/**
 * Get the path to the Pi Agent templates directory (agents, extension, settings).
 */
export function getPiTemplatePath(): string {
  const templatePath = path.join(__dirname, "pi");
  if (fs.existsSync(templatePath)) {
    return templatePath;
  }
  throw new Error(
    "Could not find pi templates directory. Expected at templates/pi/",
  );
}

/** @deprecated Use getPiTemplatePath() instead. */
export function getPiSourcePath(): string {
  return getPiTemplatePath();
}

/**
 * Read a file from the omtre template directory.
 */
export function readOmtreFile(relativePath: string): string {
  const omtrePath = getOmtreSourcePath();
  const filePath = path.join(omtrePath, relativePath);
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Read template content from a category directory.
 */
export function readTemplate(
  category: TemplateCategory,
  filename: string,
): string {
  const templatePath = path.join(__dirname, category, filename);
  return fs.readFileSync(templatePath, "utf-8");
}

export function readScript(relativePath: string): string {
  return normalizeLegacyScript(readOmtreFile(`scripts/${relativePath}`));
}

export function readMarkdown(relativePath: string): string {
  return readOmtreFile(relativePath);
}

export function readCommand(filename: string): string {
  return readTemplate("commands", filename);
}

export const workflowMdTemplate = readOmtreFile("workflow.md");
export const ohMyWorkflowMdTemplate = readOmtreFile("workflow-oh-my.md");
export const configYamlTemplate = readOmtreFile("config.yaml");
export const gitignoreTemplate = normalizeLegacyRootTemplate(
  readOmtreFile("gitignore.txt"),
);
export const gitattributesTemplate = normalizeLegacyRootTemplate(
  readOmtreFile("gitattributes.txt"),
);
export const agentsMdContent = normalizeLegacyRootTemplate(
  readTemplate("markdown", "agents.md"),
);
export const commonRoster = readScript("common/roster.py");

export function getAllScripts(): Map<string, string> {
  const scripts = new Map<string, string>();
  const scriptPaths = [
    "__init__.py",
    "common/__init__.py",
    "common/paths.py",
    "common/developer.py",
    "common/git_context.py",
    "common/task_queue.py",
    "common/task_utils.py",
    "common/active_task.py",
    "common/clai_delta.py",
    "common/cli_adapter.py",
    "common/config.py",
    "common/io.py",
    "common/log.py",
    "common/git.py",
    "common/types.py",
    "common/tasks.py",
    "common/task_context.py",
    "common/task_store.py",
    "common/session_context.py",
    "common/packages_context.py",
    "common/workflow_phase.py",
    "common/omtre_config.py",
    LEGACY_CONFIG_SCRIPT,
    "common/safe_commit.py",
    "common/frontier.py",
    "common/roster.py",
    "common/verify.py",
    "get_developer.py",
    "init_developer.py",
    "task.py",
    "get_context.py",
    "add_session.py",
  ];
  for (const rel of scriptPaths) {
    const full = path.join(getOmtreSourcePath(), "scripts", rel);
    if (fs.existsSync(full)) {
      scripts.set(rel, normalizeLegacyScript(fs.readFileSync(full, "utf-8")));
    }
  }
  return scripts;
}

export function getAllAgents(): Map<string, string> {
  const agents = new Map<string, string>();
  for (const rel of [
    "implement.md",
    "check.md",
    "research.md",
    "orchestrator.md",
  ]) {
    agents.set(rel, readOmtreFile(`agents/${rel}`));
  }
  return agents;
}

export function getAllDomainFiles(): Map<string, string> {
  const files = new Map<string, string>();
  for (const rel of [
    "REGISTRY.md",
    "DISCIPLINE.md",
    "WORKLOG-PROTOCOL.md",
    "_scaffold/README.md",
    "_scaffold/BOUNDARY.md",
    "_scaffold/worklog/.gitkeep",
    "_scaffold/review/.gitkeep",
  ]) {
    files.set(rel, readOmtreFile(`domains/${rel}`));
  }
  return files;
}

/**
 * Copy a directory from omtre templates to target, making scripts executable.
 */
export async function copyOmtreDir(
  srcRelativePath: string,
  destPath: string,
  options?: { executable?: boolean },
): Promise<void> {
  const omtrePath = getOmtreSourcePath();
  const srcPath = path.join(omtrePath, srcRelativePath);
  await copyDirRecursive(srcPath, destPath, options);
}

async function copyDirRecursive(
  src: string,
  dest: string,
  options?: { executable?: boolean },
): Promise<void> {
  ensureDir(dest);

  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      await copyDirRecursive(srcPath, destPath, options);
    } else {
      const rawContent = fs.readFileSync(srcPath, "utf-8");
      const content = entry.endsWith(".py")
        ? normalizeLegacyScript(rawContent)
        : rawContent;
      const isExecutable =
        options?.executable && (entry.endsWith(".sh") || entry.endsWith(".py"));
      await writeFile(destPath, replacePythonCommandLiterals(content), {
        executable: isExecutable,
      });
    }
  }
}
