/**
 * `omtre migrate` — One-time project migration from `.trellis/` to `.omtre/`.
 *
 * Implements the full migration contract:
 * 1. Preconditions & state detection (idempotent already-migrated, interrupted
 *    dual-directory refusal, Git worktree & dirty-tree checks, active daemon /
 *    runtime process checks, 0.6.x source version check).
 * 2. Three-category file handling:
 *    - Category 1 (Managed files): clean legacy Trellis entries, back up
 *      user-modified managed files to `<file>.backup`, preserve user settings
 *      in shared config files & Codex/agent model keys, and regenerate fresh
 *      Omtre templates via existing configurators.
 *    - Category 2 (Project/user data): migrate `.trellis/` -> `.omtre/`,
 *      preserve all tasks/specs/workspace/domains/config, relocate custom
 *      commands/skills/agents, and rewrite legacy identifiers within the
 *      approved scope while protecting historical task directory names and
 *      attribution links.
 *    - Category 3 (Runtime/cache): clean `.runtime/`, `.current-task`,
 *      `.ralph-state.json`, `.backup-*`, and `__pycache__/`; write fresh
 *      `.omtre/.version`, `.omtre/.template-hashes.json`, and
 *      `.omtre/.migrated-from`.
 * 3. External reference scanning (report-only, never mutates user global env).
 * 4. Four post-migration self-checks.
 */

import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import inquirer from "inquirer";

import {
  COLLECT_PLATFORMS_FALLBACK,
  detectActiveProcesses,
  collectGitMigrationWarnings,
  collectTaskInventory,
  getGitDirtyStatusLines,
  isInsideGitWorkTree,
  runPostMigrationSelfChecks,
  scanExternalReferences,
} from "./migrate/checks.js";
import {
  applyAgentFrontmatterCustomizations,
  cleanLegacyEntriesFromSettingsObject,
  cleanTomlLegacyComments,
  extractAgentFrontmatterCustomizations,
  mergePreservedSettingsIntoJson,
  processFileRewrite,
  rewriteTextContent,
} from "./migrate/rewriter.js";
import type {
  ExternalReferenceReport,
  MigrateOptions,
  MigrateResult,
  MigrationBackupEntry,
  MigrationPlan,
  MigrationRewriteEntry,
} from "./migrate/types.js";
import {
  ALL_MANAGED_DIRS,
  collectPlatformTemplates,
  configurePlatform,
  PLATFORM_IDS,
  PLATFORM_MANAGED_DIRS,
} from "../configurators/index.js";
import {
  applyCodexAgentModelKeys,
  extractCodexAgentModelKeys,
  type CodexAgentModelKeys,
} from "../configurators/codex.js";
import { createWorkflowStructure } from "../configurators/workflow.js";
import { DIR_NAMES } from "../constants/paths.js";
import { VERSION } from "../constants/version.js";
import { AI_TOOLS, getManagedPaths, type AITool } from "../types/ai-tools.js";
import type { TemplateHashes } from "../types/migration.js";
import { writeFileAtomic } from "../utils/atomic-write.js";
import {
  setWriteMode,
  startRecordingWrites,
  stopRecordingWrites,
} from "../utils/file-writer.js";
import { toPosix } from "../utils/posix.js";
import { computeHash, initializeHashes } from "../utils/template-hash.js";

export type {
  ExternalReferenceItem,
  ExternalReferenceReport,
  MigrateOptions,
  MigrateResult,
  MigrationBackupEntry,
  MigrationPlan,
  MigrationRewriteEntry,
  PostMigrationSelfCheckResult,
} from "./migrate/types.js";

const BUILTIN_COMMANDS = new Set(["start", "continue", "finish-work"]);

const BUILTIN_SKILL_SLUGS = new Set([
  "brainstorm",
  "before-dev",
  "check",
  "create-command",
  "finish-work",
  "integrate-skill",
  "meta",
  "onboard",
  "parallel",
  "record-session",
  "start",
  "continue",
  "update-spec",
  "break-loop",
  "channel",
  "session-insight",
  "spec-bootstrap",
]);

const BUILTIN_AGENT_ROLES = new Set([
  "check",
  "debug",
  "implement",
  "orchestrator",
  "plan",
  "research",
]);

/**
 * Shared settings/config files where user keys/hooks must be preserved and
 * merged with fresh Omtre configuration rather than unlinked wholesale.
 */
const SHARED_SETTINGS_FILES = new Set([
  ".claude/settings.json",
  ".claude/settings.local.json",
  ".cursor/hooks.json",
  ".gemini/settings.json",
  ".codebuddy/settings.json",
  ".factory/settings.json",
  ".qoder/settings.json",
  ".trae/hooks.json",
  ".zcode/hooks.json",
  ".snow/hooks.json",
  ".github/copilot/hooks.json",
  ".codex/hooks.json",
  ".codex/config.toml",
  ".pi/settings.json",
  ".opencode/opencode.json",
  ".opencode/package.json",
]);

const ROOT_REWRITE_FILES = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  ".gitignore",
  ".gitattributes",
  ".github/copilot-instructions.md",
]);

const RUNTIME_AND_CACHE_ENTRIES = [
  ".runtime",
  ".current-task",
  ".ralph-state.json",
  ".session-id",
  ".agent-log",
  ".plan-log",
];

/**
 * Convert a new Omtre template path (e.g. `.claude/commands/omt/start.md`)
 * to its legacy Trellis counterpart (e.g. `.claude/commands/trellis/start.md`).
 */
export function toLegacyTemplatePath(newRelPath: string): string {
  return newRelPath
    .replace(/^\.omtre\//, ".trellis/")
    .replace(/\/commands\/omt\//g, "/commands/trellis/")
    .replace(/\/extensions\/omtre\//g, "/extensions/trellis/")
    .replace(/\/omtre\.json$/g, "/trellis.json")
    .replace(/\/omtre_config\.py$/g, "/trellis_config.py")
    .replace(/\/omtre-/g, "/trellis-");
}

/**
 * Convert a legacy Trellis template path to its new Omtre counterpart.
 */
export function toNewTemplatePath(legacyRelPath: string): string {
  return legacyRelPath
    .replace(/^\.trellis\//, ".omtre/")
    .replace(/\/commands\/trellis\//g, "/commands/omt/")
    .replace(/\/extensions\/trellis\//g, "/extensions/omtre/")
    .replace(/\/trellis\.json$/g, "/omtre.json")
    .replace(/\/trellis_config\.py$/g, "/omtre_config.py")
    .replace(/\/trellis-/g, "/omtre-");
}

/**
 * Load `.trellis/.template-hashes.json` (supports both v2 `{ __version, hashes }`
 * and legacy flat dictionaries).
 */
function loadLegacyHashes(cwd: string): TemplateHashes {
  const hashFile = path.join(cwd, ".trellis", ".template-hashes.json");
  if (!fs.existsSync(hashFile)) {
    return {};
  }
  try {
    const raw = JSON.parse(fs.readFileSync(hashFile, "utf-8")) as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return {};
    }
    const obj = raw as Record<string, unknown>;
    const dict =
      typeof obj.hashes === "object" &&
      obj.hashes !== null &&
      !Array.isArray(obj.hashes)
        ? (obj.hashes as Record<string, unknown>)
        : obj;
    const out: TemplateHashes = {};
    for (const [k, v] of Object.entries(dict)) {
      if (typeof v === "string") {
        out[toPosix(k)] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Detect which AI platforms are configured in the legacy `.trellis/` project
 * by checking both `.trellis/.template-hashes.json` and characteristic
 * Trellis-managed paths on disk.
 */
function detectLegacyConfiguredPlatforms(
  cwd: string,
  legacyHashes: TemplateHashes,
): AITool[] {
  const detected = new Set<AITool>();
  const hashKeys = Object.keys(legacyHashes);

  for (const id of PLATFORM_IDS) {
    const configDir = AI_TOOLS[id].configDir;
    const templates = collectPlatformTemplates(id);
    if (templates) {
      for (const newPath of templates.keys()) {
        const legacyPath = toLegacyTemplatePath(newPath);
        if (
          (legacyPath === configDir ||
            legacyPath.startsWith(`${configDir}/`)) &&
          legacyHashes[legacyPath] !== undefined
        ) {
          detected.add(id);
          break;
        }
      }
    }
    if (detected.has(id)) continue;

    // Fallback: check characteristic on-disk legacy directories/files for this platform
    const probePaths = COLLECT_PLATFORMS_FALLBACK[id] ?? [];
    for (const probe of probePaths) {
      const fullProbe = path.join(cwd, ...probe.split("/"));
      if (fs.existsSync(fullProbe)) {
        detected.add(id);
        break;
      }
    }
  }

  // Legacy Windsurf -> Devin migration support
  if (
    hashKeys.some((k) => k.startsWith(".windsurf/workflows/trellis-")) ||
    fs.existsSync(path.join(cwd, ".windsurf", "workflows"))
  ) {
    try {
      const windsurfFiles = fs.existsSync(
        path.join(cwd, ".windsurf", "workflows"),
      )
        ? fs.readdirSync(path.join(cwd, ".windsurf", "workflows"))
        : [];
      if (
        hashKeys.some((k) => k.startsWith(".windsurf/workflows/trellis-")) ||
        windsurfFiles.some((f) => f.startsWith("trellis-"))
      ) {
        detected.add("devin");
      }
    } catch {
      // ignore
    }
  }

  return [...detected];
}

function walkFilesRelative(rootDir: string, relSubdir: string): string[] {
  const fullDir = path.join(rootDir, ...relSubdir.split("/"));
  if (!fs.existsSync(fullDir)) return [];
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(fullDir, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const entry of entries) {
    if (
      entry.name === "node_modules" ||
      entry.name === "__pycache__" ||
      entry.name === ".git"
    ) {
      continue;
    }
    const childRel = relSubdir ? `${relSubdir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      // Skip user runtime/session history folders inside platform dirs
      if (
        childRel === ".claude/projects" ||
        childRel === ".codex/sessions" ||
        childRel === ".cursor/chats"
      ) {
        continue;
      }
      results.push(...walkFilesRelative(rootDir, childRel));
    } else if (entry.isFile()) {
      results.push(toPosix(childRel));
    }
  }
  return results;
}

/**
 * Determine whether a platform file is a legacy Trellis-managed file that
 * should be replaced/removed during regeneration, versus a user custom file
 * or shared settings file.
 */
function classifyPlatformFile(
  relPosix: string,
  legacyExpectedMap: Map<string, string>,
  legacyHashes: TemplateHashes,
):
  | { kind: "shared-settings" }
  | { kind: "managed"; targetNewPath: string }
  | { kind: "custom-command"; targetNewPath: string }
  | { kind: "custom-skill"; targetNewPath: string }
  | { kind: "custom-agent"; targetNewPath: string }
  | { kind: "legacy-backup"; targetNewPath: string }
  | { kind: "other-user-file" } {
  if (ROOT_REWRITE_FILES.has(relPosix)) {
    return { kind: "other-user-file" };
  }
  if (SHARED_SETTINGS_FILES.has(relPosix)) {
    return { kind: "shared-settings" };
  }
  if (relPosix.endsWith(".backup")) {
    return {
      kind: "legacy-backup",
      targetNewPath: toNewTemplatePath(relPosix),
    };
  }

  // Direct match against expected legacy template path
  const mappedNew = legacyExpectedMap.get(relPosix);
  if (mappedNew) {
    return { kind: "managed", targetNewPath: mappedNew };
  }

  // Namespace-style commands: `<platform>/commands/trellis/<file>.md`
  const nsCmdMatch = /^(\.[^/]+)\/commands\/trellis\/([^/]+\.md)$/.exec(
    relPosix,
  );
  if (nsCmdMatch) {
    const [, platformDir, fileName] = nsCmdMatch;
    const baseSlug = fileName.replace(/\.md$/, "");
    if (
      BUILTIN_COMMANDS.has(baseSlug) ||
      BUILTIN_SKILL_SLUGS.has(baseSlug) ||
      legacyHashes[relPosix] !== undefined
    ) {
      return {
        kind: "managed",
        targetNewPath: `${platformDir}/commands/omt/${fileName}`,
      };
    }
    return {
      kind: "custom-command",
      targetNewPath: `${platformDir}/commands/omt/${fileName}`,
    };
  }

  // Flat commands / prompts / workflows: `<dir>/trellis-<slug>.md` (or `.prompt.md`)
  const flatCmdMatch =
    /^(\.[^/]+\/(?:commands|prompts|workflows))\/trellis-([^/]+?)(\.prompt\.md|\.md)$/.exec(
      relPosix,
    );
  if (flatCmdMatch) {
    const [, dirPrefix, slug, ext] = flatCmdMatch;
    const normalizedDir =
      dirPrefix === ".windsurf/workflows" ? ".devin/workflows" : dirPrefix;
    if (
      BUILTIN_COMMANDS.has(slug) ||
      BUILTIN_SKILL_SLUGS.has(slug) ||
      legacyHashes[relPosix] !== undefined
    ) {
      return {
        kind: "managed",
        targetNewPath: `${normalizedDir}/omtre-${slug}${ext}`,
      };
    }
    return {
      kind: "custom-command",
      targetNewPath: `${normalizedDir}/omt-${slug}${ext}`,
    };
  }

  // Skills: `<dir>/skills/<skillDir>/<rest>`
  const skillMatch = /^(\.[^/]+\/skills)\/([^/]+)\/(.+)$/.exec(relPosix);
  if (skillMatch) {
    const [, skillsBase, skillDir, rest] = skillMatch;
    if (skillDir.startsWith("trellis-")) {
      const slug = skillDir.slice("trellis-".length);
      if (
        BUILTIN_SKILL_SLUGS.has(slug) ||
        legacyHashes[relPosix] !== undefined
      ) {
        return {
          kind: "managed",
          targetNewPath: `${skillsBase}/omtre-${slug}/${rest}`,
        };
      }
      return {
        kind: "custom-skill",
        targetNewPath: `${skillsBase}/omtre-${slug}/${rest}`,
      };
    }
    return {
      kind: "custom-skill",
      targetNewPath: relPosix,
    };
  }

  // Agents / droids: `<dir>/(?:agents|droids)/<name>`
  const agentMatch =
    /^(\.[^/]+\/(?:agents|droids))\/([^/]+?)(\.agent\.md|\.md|\.toml)$/.exec(
      relPosix,
    );
  if (agentMatch) {
    const [, agentsBase, baseName, ext] = agentMatch;
    if (baseName.startsWith("trellis-")) {
      const role = baseName.slice("trellis-".length);
      if (
        BUILTIN_AGENT_ROLES.has(role) ||
        legacyHashes[relPosix] !== undefined
      ) {
        return {
          kind: "managed",
          targetNewPath: `${agentsBase}/omtre-${role}${ext}`,
        };
      }
      return {
        kind: "custom-agent",
        targetNewPath: `${agentsBase}/omtre-${role}${ext}`,
      };
    }
    return {
      kind: "custom-agent",
      targetNewPath: relPosix,
    };
  }

  // Extensions: `.pi/extensions/trellis/...` or `.omp/extensions/trellis/...`
  if (
    relPosix.startsWith(".pi/extensions/trellis/") ||
    relPosix.startsWith(".omp/extensions/trellis/")
  ) {
    return {
      kind: "managed",
      targetNewPath: toNewTemplatePath(relPosix),
    };
  }

  // Known retired/renamed managed hook & lib files
  if (
    relPosix === ".opencode/lib/trellis-context.js" ||
    relPosix === ".github/hooks/trellis.json" ||
    relPosix === ".codex/hooks/write-trellis-context.py" ||
    (legacyHashes[relPosix] !== undefined &&
      !relPosix.startsWith(".trellis/") &&
      !relPosix.includes("/projects/") &&
      !relPosix.includes("/sessions/"))
  ) {
    return {
      kind: "managed",
      targetNewPath: toNewTemplatePath(relPosix),
    };
  }

  return { kind: "other-user-file" };
}

/**
 * Remove empty directories bottom-up inside a root path, stopping at `stopAt`.
 */
function pruneEmptyDirs(dirPath: string, stopAt: string): void {
  const resolvedStop = path.resolve(stopAt);
  let current = path.resolve(dirPath);
  while (
    current.startsWith(resolvedStop) &&
    current !== resolvedStop &&
    fs.existsSync(current)
  ) {
    try {
      const entries = fs.readdirSync(current);
      if (entries.length === 0) {
        fs.rmdirSync(current);
        current = path.dirname(current);
      } else {
        break;
      }
    } catch {
      break;
    }
  }
}

/**
 * Move `.trellis` -> `.omtre` with fallback to recursive copy + remove on
 * Windows if `renameSync` encounters transient `EPERM`/`EXDEV`.
 */
function moveDirectory(srcDir: string, destDir: string): void {
  try {
    fs.renameSync(srcDir, destDir);
  } catch {
    fs.cpSync(srcDir, destDir, { recursive: true });
    fs.rmSync(srcDir, { recursive: true, force: true });
  }
}

/**
 * Inspect the project (without mutating disk) and construct a comprehensive
 * migration plan for preview (`--dry-run`) and execution.
 */
function buildMigrationPlan(
  cwd: string,
  sourceVersion: string,
  warnings: string[],
  externalReferences: ExternalReferenceReport,
): {
  plan: MigrationPlan;
  legacyHashes: TemplateHashes;
  modifiedBackupsToWrite: {
    sourcePath: string;
    backupPath: string;
    content: string;
  }[];
  customMoves: { fromRel: string; toRel: string }[];
  legacyBackupsToMove: { fromRel: string; toRel: string }[];
} {
  const legacyHashes = loadLegacyHashes(cwd);
  const configuredPlatforms = detectLegacyConfiguredPlatforms(
    cwd,
    legacyHashes,
  );

  // Build map of legacy template paths -> new Omtre template paths across configured platforms
  const legacyExpectedMap = new Map<string, string>();
  for (const id of configuredPlatforms) {
    const templates = collectPlatformTemplates(id);
    if (!templates) continue;
    for (const newPath of templates.keys()) {
      legacyExpectedMap.set(toLegacyTemplatePath(newPath), newPath);
    }
  }

  const legacyFilesToRemove: string[] = [];
  const backups: MigrationBackupEntry[] = [];
  const modifiedBackupsToWrite: {
    sourcePath: string;
    backupPath: string;
    content: string;
  }[] = [];
  const preservedSettingsFiles: string[] = [];
  const customMoves: { fromRel: string; toRel: string }[] = [];
  const legacyBackupsToMove: { fromRel: string; toRel: string }[] = [];
  const customFilesToRewrite = new Set<string>();

  // Scan platform directories on disk
  const dirsToScan = new Set<string>([
    ...configuredPlatforms.flatMap((id) => getManagedPaths(id)),
    ...PLATFORM_MANAGED_DIRS,
    ".windsurf/workflows",
  ]);

  const seenPlatformFiles = new Set<string>();
  for (const dirRel of dirsToScan) {
    for (const fileRel of walkFilesRelative(cwd, dirRel)) {
      if (seenPlatformFiles.has(fileRel)) continue;
      seenPlatformFiles.add(fileRel);

      const classification = classifyPlatformFile(
        fileRel,
        legacyExpectedMap,
        legacyHashes,
      );

      if (classification.kind === "shared-settings") {
        preservedSettingsFiles.push(fileRel);
        const storedHash = legacyHashes[fileRel];
        if (storedHash) {
          try {
            const diskContent = fs.readFileSync(
              path.join(cwd, ...fileRel.split("/")),
              "utf-8",
            );
            if (computeHash(diskContent) !== storedHash) {
              const backupRel = `${fileRel}.backup`;
              backups.push({
                sourcePath: fileRel,
                backupPath: backupRel,
                reason: "modified-managed-file",
              });
              modifiedBackupsToWrite.push({
                sourcePath: fileRel,
                backupPath: backupRel,
                content: diskContent,
              });
            }
          } catch {
            // ignore unreadable file
          }
        }
        continue;
      }

      if (classification.kind === "legacy-backup") {
        if (classification.targetNewPath !== fileRel) {
          legacyBackupsToMove.push({
            fromRel: fileRel,
            toRel: classification.targetNewPath,
          });
        }
        continue;
      }

      if (classification.kind === "managed") {
        legacyFilesToRemove.push(fileRel);
        const storedHash = legacyHashes[fileRel];
        if (storedHash) {
          try {
            const diskContent = fs.readFileSync(
              path.join(cwd, ...fileRel.split("/")),
              "utf-8",
            );
            // For Codex agent TOMLs where only model/model_reasoning_effort was
            // customized, those keys are preserved directly into the new TOML.
            if (computeHash(diskContent) !== storedHash) {
              const backupRel = `${classification.targetNewPath}.backup`;
              backups.push({
                sourcePath: fileRel,
                backupPath: backupRel,
                reason: "modified-managed-file",
              });
              modifiedBackupsToWrite.push({
                sourcePath: fileRel,
                backupPath: backupRel,
                content: diskContent,
              });
            }
          } catch {
            // ignore unreadable file
          }
        }
        continue;
      }

      if (
        classification.kind === "custom-command" ||
        classification.kind === "custom-skill" ||
        classification.kind === "custom-agent"
      ) {
        if (classification.targetNewPath !== fileRel) {
          customMoves.push({
            fromRel: fileRel,
            toRel: classification.targetNewPath,
          });
        }
        customFilesToRewrite.add(classification.targetNewPath);
      }
    }
  }

  // Also check managed files inside `.trellis/` (`workflow.md`, `scripts/**`, built-in `agents/*.md`)
  // for user modifications relative to `.trellis/.template-hashes.json`.
  const trellisFiles = walkFilesRelative(cwd, ".trellis");
  for (const fileRel of trellisFiles) {
    const isManagedTrellisTemplate =
      fileRel === ".trellis/workflow.md" ||
      fileRel.startsWith(".trellis/scripts/") ||
      (fileRel.startsWith(".trellis/agents/") &&
        BUILTIN_AGENT_ROLES.has(path.basename(fileRel, path.extname(fileRel))));
    if (!isManagedTrellisTemplate) continue;
    const storedHash = legacyHashes[fileRel];
    if (!storedHash) continue;
    try {
      const diskContent = fs.readFileSync(
        path.join(cwd, ...fileRel.split("/")),
        "utf-8",
      );
      if (computeHash(diskContent) !== storedHash) {
        const newRel = toNewTemplatePath(fileRel);
        const backupRel = `${newRel}.backup`;
        backups.push({
          sourcePath: fileRel,
          backupPath: backupRel,
          reason: "modified-managed-file",
        });
        modifiedBackupsToWrite.push({
          sourcePath: fileRel,
          backupPath: backupRel,
          content: diskContent,
        });
      }
    } catch {
      // ignore
    }
  }

  // Preview Category 2 rewrites without writing to disk
  const taskInventory = collectTaskInventory(path.join(cwd, ".trellis"));
  const previewRewrites: MigrationRewriteEntry[] = [];

  const previewCandidateFiles: {
    diskRel: string;
    reportedRel: string;
    updateAgentsBlock?: boolean;
  }[] = [];

  for (const fileRel of trellisFiles) {
    if (
      fileRel === ".trellis/config.yaml" ||
      fileRel === ".trellis/hooks.local.json" ||
      fileRel === ".trellis/.developer" ||
      fileRel.startsWith(".trellis/tasks/") ||
      fileRel.startsWith(".trellis/spec/") ||
      fileRel.startsWith(".trellis/workspace/") ||
      fileRel.startsWith(".trellis/domains/")
    ) {
      let reportedRel = toNewTemplatePath(fileRel);
      if (reportedRel.startsWith(".omtre/spec/")) {
        reportedRel = reportedRel.replace(/\/trellis-/g, "/omtre-");
      }
      previewCandidateFiles.push({ diskRel: fileRel, reportedRel });
    } else if (
      fileRel.startsWith(".trellis/agents/") &&
      !BUILTIN_AGENT_ROLES.has(path.basename(fileRel, path.extname(fileRel)))
    ) {
      previewCandidateFiles.push({
        diskRel: fileRel,
        reportedRel: toNewTemplatePath(fileRel),
      });
    }
  }

  for (const rootFile of ROOT_REWRITE_FILES) {
    if (fs.existsSync(path.join(cwd, ...rootFile.split("/")))) {
      previewCandidateFiles.push({
        diskRel: rootFile,
        reportedRel: rootFile,
        updateAgentsBlock: rootFile === "AGENTS.md" || rootFile === "CLAUDE.md",
      });
    }
  }

  for (const move of customMoves) {
    previewCandidateFiles.push({
      diskRel: move.fromRel,
      reportedRel: move.toRel,
    });
  }
  for (const customRel of customFilesToRewrite) {
    if (!customMoves.some((m) => m.toRel === customRel)) {
      previewCandidateFiles.push({
        diskRel: customRel,
        reportedRel: customRel,
      });
    }
  }

  for (const candidate of previewCandidateFiles) {
    const entry = processFileRewrite(
      path.join(cwd, ...candidate.diskRel.split("/")),
      candidate.reportedRel,
      {
        dryRun: true,
        protectedTokens: taskInventory.taskDirNames,
        updateAgentsBlock: candidate.updateAgentsBlock,
      },
    );
    if (entry) {
      previewRewrites.push(entry);
    }
  }

  // Category 3 runtime/cache items present on disk
  const cleanedPaths: string[] = [];
  for (const entryName of RUNTIME_AND_CACHE_ENTRIES) {
    const rel = `.trellis/${entryName}`;
    if (fs.existsSync(path.join(cwd, ".trellis", entryName))) {
      cleanedPaths.push(rel);
    }
  }
  if (fs.existsSync(path.join(cwd, ".trellis"))) {
    for (const item of fs.readdirSync(path.join(cwd, ".trellis"))) {
      if (item.startsWith(".backup-")) {
        cleanedPaths.push(`.trellis/${item}`);
      }
    }
  }

  const preservedSubdirs = ["tasks", "spec", "workspace", "domains"].filter(
    (sub) => fs.existsSync(path.join(cwd, ".trellis", sub)),
  );

  const plan: MigrationPlan = {
    sourceDir: ".trellis",
    targetDir: ".omtre",
    sourceVersion,
    targetVersion: VERSION,
    configuredPlatforms,
    managed: {
      regeneratePlatforms: configuredPlatforms,
      legacyFilesToRemove: legacyFilesToRemove.sort(),
      backups,
      preservedSettingsFiles: [...new Set(preservedSettingsFiles)].sort(),
    },
    projectData: {
      renamedRoot: { from: ".trellis", to: ".omtre" },
      preservedSubdirs,
      customCommandsRelocated: customMoves.map((m) => ({
        from: m.fromRel,
        to: m.toRel,
      })),
      rewrites: previewRewrites,
    },
    runtimeAndCache: {
      cleanedPaths,
      metadataWritten: [
        ".omtre/.version",
        ".omtre/.template-hashes.json",
        ".omtre/.migrated-from",
      ],
    },
    externalReferences,
    warnings,
  };

  return {
    plan,
    legacyHashes,
    modifiedBackupsToWrite,
    customMoves,
    legacyBackupsToMove,
  };
}

function renderHumanMigrationPlan(plan: MigrationPlan, dryRun: boolean): void {
  console.log(
    chalk.bold(
      dryRun
        ? "\nOmtre Migration Plan (dry-run — no files will be modified)\n"
        : "\nOmtre Migration Plan\n",
    ),
  );
  console.log(
    `  Source: ${chalk.cyan(plan.sourceDir)} (v${plan.sourceVersion}) → Target: ${chalk.green(plan.targetDir)} (v${plan.targetVersion})`,
  );
  console.log(
    `  Configured platforms (${plan.configuredPlatforms.length}): ${
      plan.configuredPlatforms.length > 0
        ? plan.configuredPlatforms.join(", ")
        : "none"
    }`,
  );
  console.log(
    `  Category 1 (Managed files): ${plan.managed.legacyFilesToRemove.length} legacy file(s) to replace, ${plan.managed.backups.length} modified file backup(s), ${plan.managed.preservedSettingsFiles.length} shared config(s) preserved`,
  );
  console.log(
    `  Category 2 (Project/user data): preserve [${plan.projectData.preservedSubdirs.join(", ")}], ${plan.projectData.customCommandsRelocated.length} custom asset(s) relocated, ${plan.projectData.rewrites.length} file(s) with scoped identifier rewrites`,
  );
  console.log(
    `  Category 3 (Runtime/cache): ${plan.runtimeAndCache.cleanedPaths.length} transient path(s) cleaned, write ${plan.runtimeAndCache.metadataWritten.join(", ")}`,
  );

  if (plan.warnings.length > 0) {
    console.log(chalk.yellow("\nWarnings:"));
    for (const w of plan.warnings) {
      console.log(chalk.yellow(`  ⚠ ${w}`));
    }
  }

  if (plan.externalReferences.items.length > 0) {
    console.log(
      chalk.cyan(
        "\nExternal references detected (report-only — not modified automatically):",
      ),
    );
    for (const item of plan.externalReferences.items) {
      console.log(`  • [${item.category}] ${item.location}: ${item.detail}`);
      console.log(chalk.gray(`    Suggestion: ${item.suggestion}`));
    }
  }
  console.log();
}

function failMigration(result: MigrateResult, json?: boolean): MigrateResult {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.error(chalk.red(`Error: ${result.message}`));
  }
  process.exitCode = 1;
  process.exit(1);
  return result;
}

/**
 * Execute or preview the `.trellis/` -> `.omtre/` project migration.
 */
export async function migrate(
  options: MigrateOptions = {},
): Promise<MigrateResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const trellisDir = path.join(cwd, ".trellis");
  const omtreDir = path.join(cwd, DIR_NAMES.WORKFLOW);

  const hasTrellis = fs.existsSync(trellisDir);
  const hasOmtre = fs.existsSync(omtreDir);

  // 1. State detection: already migrated -> idempotent exit 0
  if (!hasTrellis && hasOmtre) {
    const result: MigrateResult = {
      status: "already-migrated",
      message: "Project is already migrated to .omtre/ (nothing to do).",
      warnings: [],
    };
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(chalk.green(`✓ ${result.message}`));
    }
    return result;
  }

  // 2. State detection: both `.trellis/` and `.omtre/` exist -> interrupted migration
  if (hasTrellis && hasOmtre) {
    return failMigration(
      {
        status: "error",
        message:
          "Both .trellis/ and .omtre/ exist (interrupted migration). Please restore the working tree first (`git restore . && git clean -fd`) and re-run `omtre migrate`.",
        warnings: [],
      },
      options.json,
    );
  }

  // 3. State detection: neither `.trellis/` nor `.omtre/` exists
  if (!hasTrellis && !hasOmtre) {
    return failMigration(
      {
        status: "error",
        message:
          "No .trellis/ directory found in the current project. Nothing to migrate.",
        warnings: [],
      },
      options.json,
    );
  }

  // 4. Git worktree check
  if (!isInsideGitWorkTree(cwd)) {
    return failMigration(
      {
        status: "error",
        message:
          "Current directory is not inside a Git worktree (`git rev-parse --is-inside-work-tree` failed). `omtre migrate` requires a Git repository for safe rollback.",
        warnings: [],
      },
      options.json,
    );
  }

  // 5. Dirty working tree check (skipped in `--dry-run`, overridden by `--allow-dirty`)
  const dirtyLines = getGitDirtyStatusLines(cwd);
  if (dirtyLines.length > 0 && !options.dryRun && !options.allowDirty) {
    return failMigration(
      {
        status: "error",
        message: `Git working tree has uncommitted changes (${dirtyLines.length} path(s)). Commit or stash your changes before migrating, or pass --allow-dirty to proceed.`,
        warnings: [],
      },
      options.json,
    );
  }

  // 6. Git worktree / unmerged branch warnings (non-blocking)
  const warnings = collectGitMigrationWarnings(cwd);

  // 7. Active daemon / runtime process check
  const activeProcesses = detectActiveProcesses(cwd, options.homeDir);
  if (activeProcesses.length > 0) {
    return failMigration(
      {
        status: "error",
        message: `Active channel daemon or run process detected. Please stop running processes before migrating: ${activeProcesses.join("; ")}`,
        warnings,
      },
      options.json,
    );
  }

  // 8. Source version check (`.trellis/.version` must be `0.6.*`)
  const versionFilePath = path.join(trellisDir, ".version");
  if (!fs.existsSync(versionFilePath)) {
    return failMigration(
      {
        status: "error",
        message:
          "Missing .trellis/.version file. `omtre migrate` requires a 0.6.x Trellis project.",
        warnings,
      },
      options.json,
    );
  }
  const sourceVersion = fs.readFileSync(versionFilePath, "utf-8").trim();
  if (!sourceVersion.startsWith("0.6.")) {
    return failMigration(
      {
        status: "error",
        message: `Unsupported source Trellis version "${sourceVersion}". \`omtre migrate\` only supports migrating from 0.6.x (0.6.0-beta.0+). Please upgrade your project to 0.6.x first.`,
        warnings,
      },
      options.json,
    );
  }

  // Scan external references (report-only) and build migration plan
  const externalReferences = scanExternalReferences(
    cwd,
    options.homeDir,
    options.env,
  );
  const { plan, modifiedBackupsToWrite, customMoves, legacyBackupsToMove } =
    buildMigrationPlan(cwd, sourceVersion, warnings, externalReferences);

  // Dry-run mode: output plan and exit 0 without modifying any files
  if (options.dryRun) {
    const result: MigrateResult = {
      status: "dry-run",
      message: "Dry-run complete. No files were modified.",
      plan,
      warnings,
      externalReferences,
    };
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      renderHumanMigrationPlan(plan, true);
    }
    return result;
  }

  // Interactive confirmation when neither `--yes` (`--force`) nor `--json` is passed
  const confirmed = Boolean(options.yes ?? options.force);
  if (!confirmed && !options.json) {
    renderHumanMigrationPlan(plan, false);
    if (!process.stdin.isTTY) {
      return failMigration(
        {
          status: "error",
          message:
            "Refusing to prompt for migration confirmation in a non-interactive shell. Pass --yes/-y to confirm or --dry-run to preview.",
          plan,
          warnings,
        },
        options.json,
      );
    }
    const { proceed } = await inquirer.prompt<{ proceed: boolean }>([
      {
        type: "confirm",
        name: "proceed",
        message:
          "Proceed with migrating this project from .trellis/ to .omtre/?",
        default: true,
      },
    ]);
    if (!proceed) {
      const cancelled: MigrateResult = {
        status: "cancelled",
        message: "Migration cancelled by user.",
        plan,
        warnings,
      };
      console.log(chalk.gray("Migration cancelled."));
      return cancelled;
    }
  }

  // =========================================================================
  // Execute Migration
  // =========================================================================

  // Step 1: Collect pre-migration task inventory & preserve user customizations
  const preMigrationInventory = collectTaskInventory(trellisDir);

  // Preserve user-configured frontmatter keys from `.trellis/agents/<role>.md`
  const preservedAgentFrontmatter = new Map<string, Record<string, string>>();
  for (const role of BUILTIN_AGENT_ROLES) {
    const agentMdPath = path.join(trellisDir, "agents", `${role}.md`);
    if (fs.existsSync(agentMdPath)) {
      try {
        const custom = extractAgentFrontmatterCustomizations(
          fs.readFileSync(agentMdPath, "utf-8"),
        );
        if (Object.keys(custom).length > 0) {
          preservedAgentFrontmatter.set(role, custom);
        }
      } catch {
        // ignore
      }
    }
  }

  // Preserve Codex `model` / `model_reasoning_effort` before removing `trellis-*.toml`
  const codexModelKeys = plan.configuredPlatforms.includes("codex")
    ? extractLegacyCodexAgentModelKeys(cwd)
    : new Map<string, CodexAgentModelKeys>();

  // Preserve existing `.trellis/config.yaml` and `.trellis/workspace/index.md`
  // so `createWorkflowStructure` does not overwrite them with blank templates.
  const preservedConfigYamlPath = path.join(trellisDir, "config.yaml");
  const preservedConfigYaml = fs.existsSync(preservedConfigYamlPath)
    ? fs.readFileSync(preservedConfigYamlPath, "utf-8")
    : undefined;

  const preservedWorkspaceIndexPath = path.join(
    trellisDir,
    "workspace",
    "index.md",
  );
  const preservedWorkspaceIndex = fs.existsSync(preservedWorkspaceIndexPath)
    ? fs.readFileSync(preservedWorkspaceIndexPath, "utf-8")
    : undefined;

  // Clean and preserve user settings in shared JSON / TOML files
  const cleanedJsonSettings = new Map<string, Record<string, unknown>>();
  const preservedTomlComments = new Map<string, string>();
  let hadClaudeStatusLine = false;

  for (const settingsRel of plan.managed.preservedSettingsFiles) {
    const fullSettingsPath = path.join(cwd, ...settingsRel.split("/"));
    if (!fs.existsSync(fullSettingsPath)) continue;
    try {
      const rawText = fs.readFileSync(fullSettingsPath, "utf-8");
      if (settingsRel.endsWith(".json")) {
        const parsed = JSON.parse(rawText) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const { cleaned, hadClaudeStatusLine: hadStatus } =
            cleanLegacyEntriesFromSettingsObject(
              parsed as Record<string, unknown>,
            );
          if (settingsRel === ".claude/settings.json" && hadStatus) {
            hadClaudeStatusLine = true;
          }
          cleanedJsonSettings.set(settingsFpKey(settingsRel), cleaned);
        }
      } else if (settingsRel === ".codex/config.toml") {
        preservedTomlComments.set(
          settingsRel,
          cleanTomlLegacyComments(rawText),
        );
      }
    } catch {
      // ignore malformed settings file
    }
  }

  // Step 2: Clean Category 3 runtime/cache files inside `.trellis/` before rename
  for (const entryName of RUNTIME_AND_CACHE_ENTRIES) {
    const target = path.join(trellisDir, entryName);
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
  for (const item of fs.readdirSync(trellisDir)) {
    if (
      item.startsWith(".backup-") ||
      item === ".version" ||
      item === ".template-hashes.json"
    ) {
      fs.rmSync(path.join(trellisDir, item), { recursive: true, force: true });
    }
  }
  removePycacheDirs(trellisDir);

  // Step 3: Rename `.trellis/` -> `.omtre/`
  moveDirectory(trellisDir, omtreDir);

  // Remove legacy `.trellis/scripts/common/trellis_config.py` (superseded by `omtre_config.py`)
  fs.rmSync(path.join(omtreDir, "scripts", "common", "trellis_config.py"), {
    force: true,
  });

  // Rename any `trellis-*` files/dirs inside `.omtre/spec/` and non-task-slug `trellis-*`
  // artifacts inside `.omtre/tasks/` to `omtre-*`
  renameTrellisPrefixedSpecFiles(path.join(omtreDir, "spec"));
  renameTrellisPrefixedSpecFiles(path.join(omtreDir, "tasks"));

  // Step 4: Relocate custom commands, custom skills, custom agents, and legacy `.backup` files
  for (const move of [...customMoves, ...legacyBackupsToMove]) {
    const srcFull = path.join(cwd, ...move.fromRel.split("/"));
    const dstFull = path.join(cwd, ...move.toRel.split("/"));
    if (!fs.existsSync(srcFull)) continue;
    fs.mkdirSync(path.dirname(dstFull), { recursive: true });
    fs.renameSync(srcFull, dstFull);
    pruneEmptyDirs(path.dirname(srcFull), cwd);
  }

  // Step 5: Remove legacy managed platform files and prune empty legacy directories
  for (const relRemove of plan.managed.legacyFilesToRemove) {
    const fullRemove = path.join(cwd, ...relRemove.split("/"));
    if (fs.existsSync(fullRemove)) {
      fs.rmSync(fullRemove, { force: true });
      pruneEmptyDirs(path.dirname(fullRemove), cwd);
    }
  }

  // Rewrite root `.gitattributes` BEFORE `createWorkflowStructure` runs
  // `ensureGitattributes`, so existing `.trellis/` merge=union lines become
  // `.omtre/` lines first and are not duplicated.
  const actualRewrites: MigrationRewriteEntry[] = [];
  const gitattributesFull = path.join(cwd, ".gitattributes");
  if (fs.existsSync(gitattributesFull)) {
    const entry = processFileRewrite(gitattributesFull, ".gitattributes", {
      protectedTokens: preMigrationInventory.taskDirNames,
    });
    if (entry) actualRewrites.push(entry);
  }

  // Preserve user content outside `COPILOT-GUIDANCE` block in `.github/copilot-instructions.md`
  const copilotInstructionsFull = path.join(
    cwd,
    ".github",
    "copilot-instructions.md",
  );
  const preExistingCopilotInstructions = fs.existsSync(copilotInstructionsFull)
    ? fs.readFileSync(copilotInstructionsFull, "utf-8")
    : undefined;

  // Step 6: Regenerate Omtre managed workflow & platform files via configurators
  setWriteMode("force");
  const recordedWrites = startRecordingWrites(cwd);
  try {
    await createWorkflowStructure(cwd, {
      projectType: "fullstack",
      skipSpecTemplates: true,
    });

    for (const platformId of plan.managed.regeneratePlatforms) {
      await configurePlatform(
        platformId,
        cwd,
        platformId === "claude-code" && hadClaudeStatusLine
          ? { withStatusline: true }
          : undefined,
      );
    }
  } finally {
    stopRecordingWrites();
    setWriteMode("ask");
  }

  // Ensure no `__pycache__` directories remain inside `.omtre/` (e.g. if local
  // template directories contained cached `.pyc` files during development)
  removePycacheDirs(omtreDir);
  for (const w of [...recordedWrites]) {
    if (w.includes("__pycache__")) {
      recordedWrites.delete(w);
    }
  }

  // Re-apply preserved Codex `model` / `model_reasoning_effort` keys
  if (plan.configuredPlatforms.includes("codex") && codexModelKeys.size > 0) {
    for (const [agentFileName, keys] of codexModelKeys) {
      const targetTomlPath = path.join(cwd, ".codex", "agents", agentFileName);
      if (fs.existsSync(targetTomlPath)) {
        const freshToml = fs.readFileSync(targetTomlPath, "utf-8");
        const updatedToml = applyCodexAgentModelKeys(freshToml, keys);
        writeFileAtomic(targetTomlPath, updatedToml);
      }
    }
  }

  // Re-apply preserved `.omtre/agents/<role>.md` frontmatter keys
  for (const [role, customKeys] of preservedAgentFrontmatter) {
    const targetAgentPath = path.join(omtreDir, "agents", `${role}.md`);
    if (fs.existsSync(targetAgentPath)) {
      const updated = applyAgentFrontmatterCustomizations(
        fs.readFileSync(targetAgentPath, "utf-8"),
        customKeys,
      );
      writeFileAtomic(targetAgentPath, updated);
    }
  }

  // Restore user's `.omtre/config.yaml` and `.omtre/workspace/index.md`
  // before running Category 2 scoped text rewrites on them.
  if (preservedConfigYaml !== undefined) {
    writeFileAtomic(path.join(omtreDir, "config.yaml"), preservedConfigYaml);
  }
  if (preservedWorkspaceIndex !== undefined) {
    writeFileAtomic(
      path.join(omtreDir, "workspace", "index.md"),
      preservedWorkspaceIndex,
    );
  }

  // Merge preserved user settings back into regenerated shared JSON / TOML files
  for (const [settingsRel, cleanedObj] of cleanedJsonSettings) {
    const fullSettingsPath = path.join(cwd, ...settingsRel.split("/"));
    if (fs.existsSync(fullSettingsPath)) {
      try {
        const freshObj = JSON.parse(
          fs.readFileSync(fullSettingsPath, "utf-8"),
        ) as Record<string, unknown>;
        const merged = mergePreservedSettingsIntoJson(freshObj, cleanedObj);
        writeFileAtomic(
          fullSettingsPath,
          JSON.stringify(merged, null, 2) + "\n",
        );
      } catch {
        // ignore
      }
    } else if (Object.keys(cleanedObj).length > 0) {
      fs.mkdirSync(path.dirname(fullSettingsPath), { recursive: true });
      writeFileAtomic(
        fullSettingsPath,
        JSON.stringify(cleanedObj, null, 2) + "\n",
      );
    }
  }

  for (const [tomlRel, cleanedToml] of preservedTomlComments) {
    const fullTomlPath = path.join(cwd, ...tomlRel.split("/"));
    if (fs.existsSync(fullTomlPath)) {
      // Preserve any custom top-level non-comment lines from user's config.toml
      // that aren't in the regenerated template while keeping clean comments.
      const freshToml = fs.readFileSync(fullTomlPath, "utf-8");
      const mergedToml = mergeCodexConfigToml(cleanedToml, freshToml);
      writeFileAtomic(fullTomlPath, mergedToml);
    }
  }

  // Write `.backup` files for user-modified managed files
  for (const b of modifiedBackupsToWrite) {
    const fullBackupPath = path.join(cwd, ...b.backupPath.split("/"));
    fs.mkdirSync(path.dirname(fullBackupPath), { recursive: true });
    writeFileAtomic(fullBackupPath, b.content);
  }

  // Step 7: Rewrite Category 2 files in place
  const omtreFiles = walkFilesRelative(cwd, ".omtre");
  for (const fileRel of omtreFiles) {
    if (fileRel.endsWith(".backup")) continue;
    const isRewritableOmtreFile =
      fileRel === ".omtre/config.yaml" ||
      fileRel === ".omtre/hooks.local.json" ||
      fileRel === ".omtre/.developer" ||
      fileRel.startsWith(".omtre/tasks/") ||
      fileRel.startsWith(".omtre/spec/") ||
      fileRel.startsWith(".omtre/workspace/") ||
      fileRel.startsWith(".omtre/domains/") ||
      (fileRel.startsWith(".omtre/agents/") &&
        !BUILTIN_AGENT_ROLES.has(
          path.basename(fileRel, path.extname(fileRel)),
        ));
    if (!isRewritableOmtreFile) continue;

    const entry = processFileRewrite(
      path.join(cwd, ...fileRel.split("/")),
      fileRel,
      {
        protectedTokens: preMigrationInventory.taskDirNames,
      },
    );
    if (entry) actualRewrites.push(entry);
  }

  // Rewrite root files (`AGENTS.md`, `CLAUDE.md`, `.gitignore`, `.github/copilot-instructions.md`)
  for (const rootFile of ROOT_REWRITE_FILES) {
    if (rootFile === ".gitattributes") continue; // already rewritten before ensureGitattributes
    const fullRootFile = path.join(cwd, ...rootFile.split("/"));
    if (!fs.existsSync(fullRootFile)) continue;

    if (
      rootFile === ".github/copilot-instructions.md" &&
      preExistingCopilotInstructions !== undefined
    ) {
      const freshBlock = fs.readFileSync(fullRootFile, "utf-8");
      const mergedCopilot = mergeCopilotInstructions(
        preExistingCopilotInstructions,
        freshBlock,
      );
      writeFileAtomic(fullRootFile, mergedCopilot);
    }

    const entry = processFileRewrite(fullRootFile, rootFile, {
      protectedTokens: preMigrationInventory.taskDirNames,
      updateAgentsBlock: rootFile === "AGENTS.md" || rootFile === "CLAUDE.md",
    });
    if (entry) actualRewrites.push(entry);
  }

  // Rewrite custom commands, skills, agents, and any non-managed files inside platform dirs
  for (const dirRel of new Set([
    ...ALL_MANAGED_DIRS.filter((d) => d !== ".omtre"),
    ".claude",
    ".cursor",
    ".opencode",
    ".codex",
    ".agents",
    ".pi",
    ".devin",
    ".omp",
  ])) {
    for (const fileRel of walkFilesRelative(cwd, dirRel)) {
      if (fileRel.endsWith(".backup")) continue;
      if (recordedWrites.has(fileRel)) continue;
      if (SHARED_SETTINGS_FILES.has(fileRel)) continue;
      const entry = processFileRewrite(
        path.join(cwd, ...fileRel.split("/")),
        fileRel,
        {
          protectedTokens: preMigrationInventory.taskDirNames,
        },
      );
      if (entry) actualRewrites.push(entry);
    }
  }

  // Step 8: Write `.omtre/.version`, `.omtre/.template-hashes.json`, and `.omtre/.migrated-from`
  writeFileAtomic(path.join(omtreDir, ".version"), `${VERSION}\n`);
  initializeHashes(cwd, { trackedPaths: recordedWrites });
  const migratedFromPayload = {
    sourceVersion,
    targetVersion: VERSION,
    migratedAt: new Date().toISOString(),
  };
  writeFileAtomic(
    path.join(omtreDir, ".migrated-from"),
    JSON.stringify(migratedFromPayload, null, 2) + "\n",
  );

  // Update plan's rewrites with the actual applied rewrites
  plan.projectData.rewrites = actualRewrites;

  // Step 9: Run all 4 post-migration self-checks
  const selfCheck = runPostMigrationSelfChecks(
    cwd,
    preMigrationInventory,
    ALL_MANAGED_DIRS,
    plan.configuredPlatforms,
  );

  if (!selfCheck.passed) {
    return failMigration(
      {
        status: "error",
        message: `Post-migration self-check failed: ${selfCheck.errors.join(" | ")}`,
        plan,
        selfCheck,
        selfChecks: selfCheck.items,
        warnings,
        externalReferences,
      },
      options.json,
    );
  }

  const result: MigrateResult = {
    status: "migrated",
    message: `Successfully migrated project from .trellis/ (v${sourceVersion}) to .omtre/ (v${VERSION}).`,
    plan,
    selfCheck,
    selfChecks: selfCheck.items,
    warnings,
    externalReferences,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(chalk.green(`\n✓ ${result.message}`));
    console.log(
      chalk.gray(
        `  Tasks verified: ${selfCheck.checks.taskIntegrity.postCount}/${selfCheck.checks.taskIntegrity.preCount} (broken refs: ${selfCheck.checks.taskIntegrity.brokenReferences.length})`,
      ),
    );
    if (plan.managed.backups.length > 0) {
      console.log(
        chalk.yellow(
          `  Backed up ${plan.managed.backups.length} modified managed file(s):`,
        ),
      );
      for (const b of plan.managed.backups) {
        console.log(chalk.yellow(`    • ${b.backupPath}`));
      }
    }
    if (externalReferences.items.length > 0) {
      console.log(
        chalk.cyan(
          `\n  Note: ${externalReferences.items.length} external reference(s) detected outside the repository (report-only):`,
        ),
      );
      for (const item of externalReferences.items) {
        console.log(
          `    • [${item.category}] ${item.location}: ${item.detail}`,
        );
        console.log(chalk.gray(`      Suggestion: ${item.suggestion}`));
      }
    }
  }

  return result;
}

function settingsFpKey(relPath: string): string {
  return toPosix(relPath);
}

function extractLegacyCodexAgentModelKeys(
  cwd: string,
): Map<string, CodexAgentModelKeys> {
  const result = new Map<string, CodexAgentModelKeys>();
  const agentsDir = path.join(cwd, ".codex", "agents");
  if (!fs.existsSync(agentsDir)) return result;

  for (const role of BUILTIN_AGENT_ROLES) {
    for (const prefix of ["trellis-", "omtre-"]) {
      const candidatePath = path.join(agentsDir, `${prefix}${role}.toml`);
      if (!fs.existsSync(candidatePath)) continue;
      try {
        const content = fs.readFileSync(candidatePath, "utf-8");
        const extracted = extractCodexAgentModelKeys(content);
        if (
          extracted.model !== undefined ||
          extracted.model_reasoning_effort !== undefined
        ) {
          result.set(`omtre-${role}.toml`, extracted);
        }
      } catch {
        // ignore unreadable file
      }
    }
  }
  return result;
}

function removePycacheDirs(dirPath: string): void {
  if (!fs.existsSync(dirPath)) return;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__pycache__") {
        fs.rmSync(full, { recursive: true, force: true });
      } else {
        removePycacheDirs(full);
      }
    }
  }
}

function renameTrellisPrefixedSpecFiles(specDir: string): void {
  if (!fs.existsSync(specDir)) return;
  for (const entry of fs.readdirSync(specDir, { withFileTypes: true })) {
    const full = path.join(specDir, entry.name);
    if (entry.isDirectory()) {
      renameTrellisPrefixedSpecFiles(full);
      if (/trellis-/i.test(entry.name) && !/^\d{2}-\d{2}-/.test(entry.name)) {
        const newDirName = entry.name.replace(/trellis-/gi, "omtre-");
        const targetDir = path.join(specDir, newDirName);
        if (!fs.existsSync(targetDir)) {
          fs.renameSync(full, targetDir);
        }
      }
    } else if (
      entry.isFile() &&
      /trellis-/i.test(entry.name) &&
      !/^\d{2}-\d{2}-/.test(entry.name)
    ) {
      const newName = entry.name.replace(/trellis-/gi, "omtre-");
      const targetPath = path.join(specDir, newName);
      if (!fs.existsSync(targetPath)) {
        fs.renameSync(full, targetPath);
      }
    }
  }
}

function mergeCodexConfigToml(
  cleanedUserToml: string,
  freshTemplateToml: string,
): string {
  // Keep any non-comment, non-blank lines from the user's TOML that are not
  // already present in the fresh template (e.g. extra `[features]` keys or
  // custom sections).
  const freshLines = new Set(
    freshTemplateToml
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean),
  );
  const extraUserLines: string[] = [];
  for (const line of cleanedUserToml.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed === "[features]") {
      continue;
    }
    if (!freshLines.has(trimmed)) {
      const { content } = rewriteTextContent(line);
      extraUserLines.push(content);
    }
  }
  if (extraUserLines.length === 0) {
    return freshTemplateToml;
  }
  return `${freshTemplateToml.trimEnd()}\n${extraUserLines.join("\n")}\n`;
}

function mergeCopilotInstructions(
  preExistingContent: string,
  freshTemplateBlock: string,
): string {
  const legacyBlockRegex =
    /<!--\s*(?:TRELLIS|OMTRE):COPILOT-GUIDANCE:START\s*-->[\s\S]*?<!--\s*(?:TRELLIS|OMTRE):COPILOT-GUIDANCE:END\s*-->/;
  if (legacyBlockRegex.test(preExistingContent)) {
    return preExistingContent.replace(
      legacyBlockRegex,
      freshTemplateBlock.trim(),
    );
  }
  return freshTemplateBlock;
}
