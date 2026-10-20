import type { AITool } from "../../types/ai-tools.js";

export interface MigrateOptions {
  /** Directory to migrate (defaults to process.cwd()) */
  cwd?: string;
  /** Preview migration plan without mutating disk */
  dryRun?: boolean;
  /** Output structured JSON plan/result */
  json?: boolean;
  /** Skip interactive confirmation (-y / --yes) */
  yes?: boolean;
  /** Alias for --yes (--force) */
  force?: boolean;
  /** Allow running when git working tree has uncommitted changes */
  allowDirty?: boolean;
  /** Optional home directory override (used for channel daemon & external checks in tests) */
  homeDir?: string;
  /** Optional environment variables override (used for external env scan in tests) */
  env?: NodeJS.ProcessEnv;
}

export interface MigrateRewriteRuleHit {
  rule: string;
  count: number;
}

export interface MigrationRewriteEntry {
  /** Target path relative to repo root (POSIX) */
  file: string;
  /** Source path before move/rename relative to repo root (POSIX) */
  sourceFile: string;
  /** Total replacements in this file */
  replacements: number;
  /** Breakdown by rule */
  rules: MigrateRewriteRuleHit[];
}

export type MigrateRewriteFileDetail = MigrationRewriteEntry;

export interface MigrationBackupEntry {
  /** Original legacy path relative to repo root (POSIX) */
  sourcePath: string;
  /** Backup file path written relative to repo root (POSIX) */
  backupPath: string;
  /** Reason for creating the backup */
  reason: "modified-managed-file" | "existing-backup";
}

export type MigrateBackupEntry = MigrationBackupEntry;

export interface MigrateRelocatedItem {
  from: string;
  to: string;
  kind?:
    | "workflow-root"
    | "spec-file"
    | "custom-command"
    | "custom-skill"
    | "custom-agent";
}

export interface MigrateExternalMatch {
  file: string;
  line: number;
  match: string;
  text: string;
}

export interface ExternalReferenceItem {
  category:
    | "repo-file"
    | "home-dir"
    | "global-agent-config"
    | "shell-rc"
    | "service"
    | "env";
  location: string;
  detail: string;
  suggestion: string;
  file?: string;
  line?: number;
  match?: string;
}

export interface ExternalReferenceReport {
  items: ExternalReferenceItem[];
  matches: MigrateExternalMatch[];
}

export interface MigrateSelfCheckItem {
  id:
    | "no-legacy-dir"
    | "zero-residual-tokens"
    | "tasks-and-blocked-by"
    | "session-start-hook";
  name: string;
  passed: boolean;
  details?: string;
}

export interface PostMigrationSelfCheckResult {
  passed: boolean;
  items: MigrateSelfCheckItem[];
  checks: {
    noLegacyDir: {
      passed: boolean;
    };
    taskIntegrity: {
      passed: boolean;
      preCount: number;
      postCount: number;
      brokenReferences: string[];
    };
    zeroLegacyResidue: {
      passed: boolean;
      violations: string[];
    };
    sessionStartHook: {
      passed: boolean;
      script: string | null;
      outputLength: number;
      error?: string;
    };
    taskScriptCheck: {
      passed: boolean;
      exitCode: number | null;
      error?: string;
    };
    platformConsistency: {
      passed: boolean;
      missingFiles: string[];
    };
  };
  errors: string[];
}

export interface MigrationPlan {
  sourceDir: ".trellis";
  targetDir: ".omtre";
  sourceVersion: string;
  targetVersion: string;
  configuredPlatforms: AITool[];
  /** Category 1: Managed files to regenerate or clean */
  managed: {
    regeneratePlatforms: AITool[];
    legacyFilesToRemove: string[];
    backups: MigrationBackupEntry[];
    preservedSettingsFiles: string[];
  };
  /** Category 2: Project/user data & root instructions to relocate and rewrite */
  projectData: {
    renamedRoot: { from: ".trellis"; to: ".omtre" };
    preservedSubdirs: string[];
    customCommandsRelocated: { from: string; to: string }[];
    rewrites: MigrationRewriteEntry[];
  };
  /** Category 3: Runtime/cache paths cleaned & metadata written */
  runtimeAndCache: {
    cleanedPaths: string[];
    metadataWritten: string[];
  };
  /** Report-only matches in external repository files and user global env */
  externalReferences: ExternalReferenceReport;
  /** Non-blocking warnings (e.g. multiple worktrees, unmerged branches) */
  warnings: string[];
}

export type MigratePlan = MigrationPlan;

export type MigrateStatus =
  | "migrated"
  | "already-migrated"
  | "dry-run"
  | "cancelled"
  | "error";

export interface MigrateResult {
  status: MigrateStatus;
  message: string;
  plan?: MigrationPlan;
  selfCheck?: PostMigrationSelfCheckResult;
  selfChecks?: MigrateSelfCheckItem[];
  warnings: string[];
  externalReferences?: ExternalReferenceReport;
}
