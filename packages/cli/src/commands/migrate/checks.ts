import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ALL_MANAGED_DIRS,
  collectPlatformTemplates,
} from "../../configurators/index.js";
import type { AITool } from "../../types/ai-tools.js";
import { toPosix } from "../../utils/posix.js";
import {
  ATTRIBUTION_URL_REGEX,
  HISTORICAL_TASK_SLUG_REGEX,
  isBinaryBuffer,
  scanExternalFileContent,
  walkFilesRecursive,
} from "./rewriter.js";
import type {
  ExternalReferenceItem,
  ExternalReferenceReport,
  MigrateExternalMatch,
  MigrateSelfCheckItem,
  PostMigrationSelfCheckResult,
} from "./types.js";

/**
 * Fallback characteristic legacy paths for detecting configured platforms
 * when `.trellis/.template-hashes.json` is absent or incomplete.
 */
export const COLLECT_PLATFORMS_FALLBACK: Partial<Record<AITool, string[]>> = {
  "claude-code": [
    ".claude/commands/trellis",
    ".claude/skills/trellis-start",
    ".claude/agents/trellis-implement.md",
    ".claude/hooks/session-start.py",
  ],
  cursor: [
    ".cursor/commands/trellis-start.md",
    ".cursor/skills/trellis-start",
    ".cursor/hooks/session-start.py",
  ],
  opencode: [
    ".opencode/commands/trellis",
    ".opencode/skills/trellis-start",
    ".opencode/agents/trellis-implement.md",
    ".opencode/lib/trellis-context.js",
  ],
  codex: [
    ".codex/agents/trellis-implement.toml",
    ".codex/skills/trellis-start",
    ".codex/hooks/session-start.py",
    ".codex/hooks/write-trellis-context.py",
    ".agents/skills/trellis-start",
  ],
  antigravity: [".agent/workflows/trellis-start.md"],
  copilot: [
    ".github/prompts/trellis-start.prompt.md",
    ".github/skills/trellis-start",
    ".github/agents/trellis-implement.agent.md",
    ".github/hooks/trellis.json",
  ],
  gemini: [
    ".gemini/commands/trellis",
    ".gemini/skills/trellis-start",
    ".gemini/hooks/session-start.py",
  ],
  grok: [".grok/commands/trellis", ".grok/skills/trellis-start"],
  kimi: [".kimi/skills/trellis-start", ".kimi/agents/trellis-implement.md"],
  kiro: [".kiro/skills/trellis-start", ".kiro/agents/trellis-implement.json"],
  droid: [
    ".factory/commands/trellis",
    ".factory/skills/trellis-start",
    ".factory/droids/trellis-implement.md",
  ],
  dsh: [".dsh/commands/trellis", ".dsh/skills/trellis-start"],
  devin: [
    ".devin/skills/trellis-start",
    ".windsurf/workflows/trellis-start.md",
  ],
  omp: [
    ".omp/skills/trellis-start",
    ".omp/agents/trellis-implement.md",
    ".omp/extensions/trellis/index.ts",
  ],
  pi: [
    ".pi/skills/trellis-start",
    ".pi/agents/trellis-implement.md",
    ".pi/extensions/trellis/index.ts",
    ".pi/prompts/trellis-start.md",
  ],
  qoder: [
    ".qoder/commands/trellis",
    ".qoder/skills/trellis-start",
    ".qoder/hooks/session-start.py",
  ],
  codebuddy: [
    ".codebuddy/commands/trellis",
    ".codebuddy/skills/trellis-start",
    ".codebuddy/hooks/session-start.py",
  ],
  trae: [
    ".trae/commands/trellis-start.md",
    ".trae/skills/trellis-start",
    ".trae/hooks/session-start.py",
  ],
  reasonix: [".reasonix/commands/trellis", ".reasonix/skills/trellis-start"],
  zcode: [
    ".zcode/commands/trellis",
    ".zcode/skills/trellis-start",
    ".zcode/hooks/session-start.py",
  ],
  snow: [
    ".snow/skills/trellis-start",
    ".snow/agents/trellis-implement.md",
    ".snow/hooks/write-trellis-context.py",
  ],
};

/**
 * Detect an available Python 3 interpreter on the current machine.
 */
export function detectPythonCommand(): string | null {
  const candidates =
    process.platform === "win32"
      ? ["python", "python3", "py -3"]
      : ["python3", "python"];

  for (const candidate of candidates) {
    const parts = candidate.split(/\s+/);
    const bin = parts[0] ?? "python3";
    const args = [...parts.slice(1), "--version"];
    try {
      const res = spawnSync(bin, args, {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 3000,
      });
      if (res.status === 0) {
        return candidate;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

/**
 * Run a git command in `cwd` and return `{ ok, stdout, stderr }`.
 */
export function runGitCommand(
  cwd: string,
  args: string[],
): { ok: boolean; stdout: string; stderr: string } {
  try {
    const res = spawnSync("git", args, {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 5000,
    });
    return {
      ok: res.status === 0,
      stdout: (res.stdout ?? "").trim(),
      stderr: (res.stderr ?? "").trim(),
    };
  } catch {
    return { ok: false, stdout: "", stderr: "" };
  }
}

export function isInsideGitWorkTree(cwd: string): boolean {
  const res = runGitCommand(cwd, ["rev-parse", "--is-inside-work-tree"]);
  return res.ok && res.stdout === "true";
}

export function getGitDirtyStatusLines(cwd: string): string[] {
  const res = runGitCommand(cwd, ["status", "--porcelain"]);
  if (!res.ok) return [];
  return res.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Collect non-blocking warnings for multiple git worktrees or unmerged branches.
 */
export function collectGitMigrationWarnings(cwd: string): string[] {
  const warnings: string[] = [];

  const wtRes = runGitCommand(cwd, ["worktree", "list", "--porcelain"]);
  if (wtRes.ok && wtRes.stdout) {
    const worktrees = wtRes.stdout
      .split(/\r?\n/)
      .filter((line) => line.startsWith("worktree "));
    if (worktrees.length > 1) {
      warnings.push(
        `Multiple Git worktrees detected (${worktrees.length}). Merging or switching worktrees after migration may cause rename conflicts (.trellis/ -> .omtre/). Merge or remove extra worktrees before migrating if possible.`,
      );
    }
  }

  const branchRes = runGitCommand(cwd, ["branch", "--no-merged", "HEAD"]);
  if (branchRes.ok && branchRes.stdout) {
    const branches = branchRes.stdout
      .split(/\r?\n/)
      .map((line) => line.replace(/^[*+]\s*/, "").trim())
      .filter((line) => line.length > 0);
    if (branches.length > 0) {
      warnings.push(
        `Unmerged Git branches detected (${branches.join(", ")}). Merging branches created before migration may cause rename conflicts (.trellis/ -> .omtre/). Merge branches before migrating if possible.`,
      );
    }
  }

  return warnings;
}

/**
 * Check if a numeric PID is currently alive on the host OS.
 */
export function isPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "EPERM") return true;
    return false;
  }
}

function parsePidFromContent(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (typeof parsed.pid === "number") return parsed.pid;
    if (typeof parsed.pid === "string" && /^\d+$/.test(parsed.pid)) {
      return Number.parseInt(parsed.pid, 10);
    }
  } catch {
    // ignore non-JSON pidfile content
  }
  return null;
}

/**
 * Scan `~/.trellis/channels`, `~/.omtre/channels`, and `.trellis/.runtime/`
 * for active channel daemon/worker processes or running `omtre run` processes.
 */
export function detectActiveProcesses(
  cwd: string,
  homeDirOverride?: string,
): string[] {
  const active: string[] = [];
  const homeDir =
    homeDirOverride ?? process.env.OMTRE_MIGRATE_HOME_DIR ?? os.homedir();

  const channelRoots = [
    path.join(homeDir, ".trellis", "channels"),
    path.join(homeDir, ".omtre", "channels"),
  ];

  for (const root of channelRoots) {
    if (!fs.existsSync(root)) continue;
    const files = walkFilesRecursive(root, new Set([".git", "node_modules"]));
    for (const rel of files) {
      if (!rel.endsWith(".pid")) continue;
      const abs = path.join(root, rel);
      try {
        const pid = parsePidFromContent(fs.readFileSync(abs, "utf-8"));
        if (pid !== null && isPidAlive(pid)) {
          active.push(`Active channel process (PID ${pid}) at ${toPosix(abs)}`);
        }
      } catch {
        // ignore unreadable pidfile
      }
    }
  }

  const runtimeRoot = path.join(cwd, ".trellis", ".runtime");
  if (fs.existsSync(runtimeRoot)) {
    const files = walkFilesRecursive(runtimeRoot, new Set());
    for (const rel of files) {
      const abs = path.join(runtimeRoot, rel);
      if (rel.endsWith(".pid") || rel.endsWith(".json")) {
        try {
          const raw = fs.readFileSync(abs, "utf-8");
          if (rel.endsWith(".pid")) {
            const pid = parsePidFromContent(raw);
            if (pid !== null && isPidAlive(pid)) {
              active.push(
                `Active runtime process (PID ${pid}) at .trellis/.runtime/${rel}`,
              );
            }
          } else {
            const data = JSON.parse(raw) as Record<string, unknown>;
            const status = data.status;
            const pid =
              typeof data.pid === "number"
                ? data.pid
                : typeof data.pid === "string" && /^\d+$/.test(data.pid)
                  ? Number.parseInt(data.pid, 10)
                  : null;
            if (
              pid !== null &&
              isPidAlive(pid) &&
              status !== "stopped" &&
              status !== "completed" &&
              status !== "failed"
            ) {
              active.push(
                `Active runtime process (PID ${pid}) at .trellis/.runtime/${rel}`,
              );
            } else if (
              (status === "running" || status === "starting") &&
              pid === null &&
              path.basename(rel) === "run.json"
            ) {
              active.push(
                `Active run process (status=${String(status)}) at .trellis/.runtime/${rel}`,
              );
            }
          }
        } catch {
          // ignore malformed runtime file
        }
      }
    }
  }

  return active;
}

const NON_REWRITTEN_SKIP_PREFIXES = [
  ".trellis/",
  ".omtre/",
  ".claude/",
  ".cursor/",
  ".codex/",
  ".agents/",
  ".agent/",
  ".opencode/",
  ".pi/",
  ".omp/",
  ".devin/",
  ".windsurf/",
  ".gemini/",
  ".grok/",
  ".kimi/",
  ".kiro/",
  ".droid/",
  ".dsh/",
  ".qoder/",
  ".codebuddy/",
  ".trae/",
  ".reasonix/",
  ".zcode/",
  ".snow/",
  ".factory/",
  ".github/prompts/",
  ".github/skills/",
  ".github/agents/",
  ".github/hooks/",
];

const REWRITTEN_ROOT_FILES = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  ".gitignore",
  ".gitattributes",
  ".github/copilot-instructions.md",
]);

/**
 * Scan repository files outside the automatic rewrite scope (per PRD 3.4) as
 * well as user home directory / environment variables (per T4) for legacy
 * `.trellis` / `TRELLIS_` references. Report-only — never modifies any files.
 */
export function scanExternalReferences(
  cwdOrHomeDir?: string,
  homeDirOrEnv?: string | NodeJS.ProcessEnv,
  maybeEnv?: NodeJS.ProcessEnv,
): ExternalReferenceReport {
  let cwd: string | undefined;
  let homeDirOverride: string | undefined;
  let envOverride: NodeJS.ProcessEnv | undefined;

  if (typeof homeDirOrEnv === "object" && homeDirOrEnv !== null) {
    homeDirOverride = cwdOrHomeDir;
    envOverride = homeDirOrEnv;
  } else {
    cwd = cwdOrHomeDir;
    homeDirOverride = homeDirOrEnv;
    envOverride = maybeEnv;
  }

  const items: ExternalReferenceItem[] = [];
  const matches: MigrateExternalMatch[] = [];

  // 1. Scan non-rewritten repository files when `cwd` is provided (PRD 3.4)
  if (cwd && fs.existsSync(cwd)) {
    const repoFiles = walkFilesRecursive(
      cwd,
      new Set([".git", "node_modules", "__pycache__", "dist", "build"]),
    );
    for (const relPath of repoFiles) {
      if (relPath.endsWith(".backup")) continue;
      if (REWRITTEN_ROOT_FILES.has(relPath)) continue;
      if (NON_REWRITTEN_SKIP_PREFIXES.some((p) => relPath.startsWith(p))) {
        continue;
      }
      const absPath = path.join(cwd, ...relPath.split("/"));
      let buf: Buffer;
      try {
        buf = fs.readFileSync(absPath);
      } catch {
        continue;
      }
      if (isBinaryBuffer(absPath, buf)) continue;
      const fileMatches = scanExternalFileContent(
        relPath,
        buf.toString("utf-8"),
      );
      for (const m of fileMatches) {
        matches.push(m);
        items.push({
          category: "repo-file",
          location: `${m.file}:${m.line}`,
          detail: `Line ${m.line} contains "${m.match}": ${m.text}`,
          suggestion: `Review ${m.file}:${m.line} and update legacy Trellis reference if needed.`,
          file: m.file,
          line: m.line,
          match: m.match,
        });
      }
    }
  }

  // 2. Scan user home directory (report-only, never modified)
  const homeDir =
    homeDirOverride ?? process.env.OMTRE_MIGRATE_HOME_DIR ?? os.homedir();
  if (homeDir && fs.existsSync(homeDir)) {
    const homeTrellis = path.join(homeDir, ".trellis");
    if (fs.existsSync(homeTrellis)) {
      items.push({
        category: "home-dir",
        location: toPosix(homeTrellis),
        detail: "Legacy ~/.trellis directory exists in user home.",
        suggestion:
          "~/.trellis is left untouched by project migration. Migrate or remove ~/.trellis manually when all projects are migrated.",
      });
    }

    const globalAgentFiles = [
      ".claude/CLAUDE.md",
      ".claude/settings.json",
      ".codex/AGENTS.md",
      ".codex/config.toml",
      ".cursor/hooks.json",
      ".gemini/GEMINI.md",
    ];
    for (const rel of globalAgentFiles) {
      const full = path.join(homeDir, ...rel.split("/"));
      if (!fs.existsSync(full)) continue;
      try {
        const content = fs.readFileSync(full, "utf-8");
        const m = scanExternalFileContent(`~/${rel}`, content);
        const firstMatch = m[0];
        if (firstMatch) {
          items.push({
            category: "global-agent-config",
            location: toPosix(full),
            detail: `Found ${m.length} legacy Trellis reference(s) (e.g. "${firstMatch.match}" on line ${firstMatch.line}).`,
            suggestion: `Update global agent configuration in ~/${rel} to use Omtre paths/commands.`,
            file: `~/${rel}`,
            line: firstMatch.line,
            match: firstMatch.match,
          });
        }
      } catch {
        // ignore unreadable file
      }
    }

    const shellRcFiles = [
      ".zshrc",
      ".bashrc",
      ".bash_profile",
      ".profile",
      ".config/fish/config.fish",
    ];
    for (const rel of shellRcFiles) {
      const full = path.join(homeDir, ...rel.split("/"));
      if (!fs.existsSync(full)) continue;
      try {
        const content = fs.readFileSync(full, "utf-8");
        const m = scanExternalFileContent(`~/${rel}`, content);
        const firstMatch = m[0];
        if (firstMatch) {
          items.push({
            category: "shell-rc",
            location: toPosix(full),
            detail: `Found ${m.length} legacy Trellis reference(s) (e.g. "${firstMatch.match}" on line ${firstMatch.line}).`,
            suggestion: `Update shell profile ~/${rel} (e.g. TRELLIS_* -> OMTRE_*).`,
            file: `~/${rel}`,
            line: firstMatch.line,
            match: firstMatch.match,
          });
        }
      } catch {
        // ignore
      }
    }

    const serviceDirs = [
      path.join(homeDir, ".config", "systemd", "user"),
      path.join(homeDir, "Library", "LaunchAgents"),
    ];
    for (const sDir of serviceDirs) {
      if (!fs.existsSync(sDir)) continue;
      try {
        for (const entry of fs.readdirSync(sDir)) {
          if (entry.toLowerCase().includes("trellis")) {
            items.push({
              category: "service",
              location: toPosix(path.join(sDir, entry)),
              detail: `Legacy background service file "${entry}" detected.`,
              suggestion:
                "Update or recreate the background service for Omtre.",
            });
          }
        }
      } catch {
        // ignore
      }
    }
  }

  // 3. Scan environment variables for `TRELLIS_*`
  const envToScan = envOverride ?? process.env;
  for (const [key, val] of Object.entries(envToScan)) {
    if (key.startsWith("TRELLIS_") && val !== undefined) {
      items.push({
        category: "env",
        location: key,
        detail: `Environment variable ${key} is set in the current environment.`,
        suggestion: `Rename ${key} to OMTRE_${key.slice("TRELLIS_".length)}.`,
      });
    }
  }

  return { items, matches };
}

export interface TaskInventory {
  /** All task directory relative paths under `<workflowDir>/tasks` (e.g. `10-20-migrate-command`, `archive/2026-10/10-19-rename-rules`) */
  taskRelDirs: string[];
  /** Set of all task directory basenames (e.g. `01-22-trellis-agents-gui`, `10-20-migrate-command`) */
  taskDirNames: Set<string>;
  /** Set of all known task identifiers (`id`, `name`, dir basename, relative path) */
  knownTaskKeys: Set<string>;
}

/**
 * Collect all active and archived task directories under `<workflowDir>/tasks`.
 */
export function collectTaskInventory(workflowDir: string): TaskInventory {
  const tasksRoot = path.join(workflowDir, "tasks");
  const taskRelDirs: string[] = [];
  const taskDirNames = new Set<string>();
  const knownTaskKeys = new Set<string>();

  if (!fs.existsSync(tasksRoot)) {
    return { taskRelDirs, taskDirNames, knownTaskKeys };
  }

  const registerTaskDir = (absDir: string, relFromTasks: string): void => {
    const posixRel = toPosix(relFromTasks);
    const base = path.basename(absDir);
    taskRelDirs.push(posixRel);
    taskDirNames.add(base);
    knownTaskKeys.add(base);
    knownTaskKeys.add(posixRel);
    knownTaskKeys.add(`tasks/${posixRel}`);
    knownTaskKeys.add(`.omtre/tasks/${posixRel}`);
    knownTaskKeys.add(`.omtre/tasks/${base}`);

    const taskJsonPath = path.join(absDir, "task.json");
    if (fs.existsSync(taskJsonPath)) {
      try {
        const data = JSON.parse(
          fs.readFileSync(taskJsonPath, "utf-8"),
        ) as Record<string, unknown>;
        if (typeof data.id === "string" && data.id.trim()) {
          knownTaskKeys.add(data.id.trim());
        }
        if (typeof data.name === "string" && data.name.trim()) {
          knownTaskKeys.add(data.name.trim());
        }
      } catch {
        // Tolerate corrupted historical JSON per PRD 4.3
      }
    }
  };

  let topEntries: fs.Dirent[] = [];
  try {
    topEntries = fs.readdirSync(tasksRoot, { withFileTypes: true });
  } catch {
    return { taskRelDirs, taskDirNames, knownTaskKeys };
  }

  topEntries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of topEntries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    if (entry.name === "archive") {
      const archiveRoot = path.join(tasksRoot, "archive");
      let archiveEntries: fs.Dirent[] = [];
      try {
        archiveEntries = fs.readdirSync(archiveRoot, { withFileTypes: true });
      } catch {
        continue;
      }
      archiveEntries.sort((a, b) => a.name.localeCompare(b.name));
      for (const archEntry of archiveEntries) {
        if (!archEntry.isDirectory() || archEntry.name.startsWith(".")) {
          continue;
        }
        const archChildAbs = path.join(archiveRoot, archEntry.name);
        const hasOwnTaskFiles =
          fs.existsSync(path.join(archChildAbs, "task.json")) ||
          fs.existsSync(path.join(archChildAbs, "prd.md")) ||
          fs.existsSync(path.join(archChildAbs, "question.md"));
        if (/^\d{4}-\d{2}$/.test(archEntry.name) && !hasOwnTaskFiles) {
          let monthTasks: fs.Dirent[] = [];
          try {
            monthTasks = fs.readdirSync(archChildAbs, { withFileTypes: true });
          } catch {
            continue;
          }
          monthTasks.sort((a, b) => a.name.localeCompare(b.name));
          for (const mt of monthTasks) {
            if (!mt.isDirectory() || mt.name.startsWith(".")) continue;
            registerTaskDir(
              path.join(archChildAbs, mt.name),
              `archive/${archEntry.name}/${mt.name}`,
            );
          }
        } else {
          registerTaskDir(archChildAbs, `archive/${archEntry.name}`);
        }
      }
      continue;
    }

    registerTaskDir(path.join(tasksRoot, entry.name), entry.name);
  }

  return { taskRelDirs, taskDirNames, knownTaskKeys };
}

/**
 * Self-check #2 residual regex:
 * Checks that `.trellis/` (or `.trellis`), `TRELLIS_`, `/trellis:`, `TRELLIS:START`
 * (and `TRELLIS:END`, `TRELLIS:COPILOT-GUIDANCE`, `trellis-hook-injected`, `trellis-emitted`)
 * are 0 in managed files and `.omtre/` data (excluding `.backup` files and
 * `mindfold-ai/trellis` attribution URLs).
 */
const RESIDUAL_CHECK_REGEX =
  /(~\/\.trellis|\.trellis|TRELLIS:COPILOT-GUIDANCE|TRELLIS:START|TRELLIS:END|TRELLIS_[A-Za-z0-9_]*|trellis-hook-injected|trellis-emitted|\/trellis:[A-Za-z0-9_-]*|@mindfoldhq\/trellis(?:-core)?\b|\boh-my-trellis\b|trellis-[A-Za-z0-9_-]*)/g;

export function runPostMigrationSelfChecks(
  cwd: string,
  preMigrationInventoryOrCount: TaskInventory | number,
  managedPathsToScan: Iterable<string> = ALL_MANAGED_DIRS,
  configuredPlatforms: AITool[] = [],
): PostMigrationSelfCheckResult {
  const preMigrationTaskCount =
    typeof preMigrationInventoryOrCount === "number"
      ? preMigrationInventoryOrCount
      : preMigrationInventoryOrCount.taskRelDirs.length;

  const items: MigrateSelfCheckItem[] = [];
  const errors: string[] = [];

  // 1. `.trellis/` no longer exists
  const legacyDirExists = fs.existsSync(path.join(cwd, ".trellis"));
  items.push({
    id: "no-legacy-dir",
    name: "No .trellis/ directory remains",
    passed: !legacyDirExists,
    details: legacyDirExists
      ? ".trellis/ directory still exists after migration"
      : ".trellis/ directory removed",
  });
  if (legacyDirExists) {
    errors.push(".trellis/ directory still exists after migration.");
  }

  // 2. Zero residual legacy tokens in `.omtre/` and managed files (excluding `.backup`)
  const omtreDir = path.join(cwd, ".omtre");
  const postInventory = collectTaskInventory(omtreDir);
  const filesToScan = new Set<string>();

  if (fs.existsSync(omtreDir)) {
    for (const rel of walkFilesRecursive(omtreDir)) {
      filesToScan.add(`.omtre/${rel}`);
    }
  }
  for (const p of managedPathsToScan) {
    const posixP = toPosix(p);
    const fullP = path.join(cwd, ...posixP.split("/"));
    if (!fs.existsSync(fullP)) continue;
    try {
      const st = fs.statSync(fullP);
      if (st.isDirectory()) {
        for (const rel of walkFilesRecursive(fullP)) {
          filesToScan.add(`${posixP}/${rel}`);
        }
      } else if (st.isFile()) {
        filesToScan.add(posixP);
      }
    } catch {
      // ignore
    }
  }
  for (const rootFile of [
    "AGENTS.md",
    "CLAUDE.md",
    ".gitignore",
    ".gitattributes",
    ".github/copilot-instructions.md",
  ]) {
    if (fs.existsSync(path.join(cwd, rootFile))) {
      filesToScan.add(rootFile);
    }
  }

  const residualViolations: string[] = [];
  for (const relPath of Array.from(filesToScan).sort()) {
    if (relPath.endsWith(".backup")) continue;
    if (
      relPath.startsWith(".claude/projects/") ||
      relPath.startsWith(".codex/sessions/") ||
      relPath.startsWith(".cursor/chats/")
    ) {
      continue;
    }
    const absPath = path.join(cwd, ...relPath.split("/"));
    if (!fs.existsSync(absPath)) continue;
    let stat: fs.Stats;
    try {
      stat = fs.statSync(absPath);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;

    let buf: Buffer;
    try {
      buf = fs.readFileSync(absPath);
    } catch {
      continue;
    }
    if (isBinaryBuffer(absPath, buf)) continue;

    const lines = buf.toString("utf-8").split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i] ?? "";
      let sanitized = lineText.replace(ATTRIBUTION_URL_REGEX, "");
      sanitized = sanitized.replace(HISTORICAL_TASK_SLUG_REGEX, "");
      for (const taskDirName of postInventory.taskDirNames) {
        if (taskDirName.toLowerCase().includes("trellis")) {
          sanitized = sanitized.split(taskDirName).join("");
        }
      }
      RESIDUAL_CHECK_REGEX.lastIndex = 0;
      const m = RESIDUAL_CHECK_REGEX.exec(sanitized);
      if (m) {
        residualViolations.push(`${relPath}:${i + 1}: ${m[0]}`);
      }
    }
  }

  const zeroResiduePassed = residualViolations.length === 0;
  items.push({
    id: "zero-residual-tokens",
    name: "Zero residual legacy tokens in managed files and .omtre/",
    passed: zeroResiduePassed,
    details: zeroResiduePassed
      ? "0 residual tokens found"
      : `Found ${residualViolations.length} residual token(s): ${residualViolations.slice(0, 10).join("; ")}`,
  });
  if (!zeroResiduePassed) {
    errors.push(
      `Residual legacy tokens found (${residualViolations.length}): ${residualViolations.slice(0, 5).join("; ")}`,
    );
  }

  // 3. Task count matches pre-migration count, and every valid `task.json` reference resolves
  const postTaskCount = postInventory.taskRelDirs.length;
  const brokenReferences: string[] = [];

  for (const relDir of postInventory.taskRelDirs) {
    const taskJsonAbs = path.join(omtreDir, "tasks", relDir, "task.json");
    if (!fs.existsSync(taskJsonAbs)) continue;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(fs.readFileSync(taskJsonAbs, "utf-8")) as Record<
        string,
        unknown
      >;
    } catch {
      // Per PRD 4.3: tolerate corrupted JSON in historical archives
      continue;
    }

    const refsToCheck: unknown[] = [];
    if (Array.isArray(parsed.blocked_by)) {
      refsToCheck.push(...parsed.blocked_by);
    }
    if (
      typeof parsed.meta === "object" &&
      parsed.meta !== null &&
      Array.isArray((parsed.meta as Record<string, unknown>).blocked_by)
    ) {
      refsToCheck.push(
        ...((parsed.meta as Record<string, unknown>).blocked_by as unknown[]),
      );
    }
    if (typeof parsed.parent === "string" && parsed.parent.trim()) {
      refsToCheck.push(parsed.parent);
    }
    if (Array.isArray(parsed.children)) {
      refsToCheck.push(...parsed.children);
    }
    if (Array.isArray(parsed.related_tasks)) {
      refsToCheck.push(...parsed.related_tasks);
    }

    for (const rawRef of refsToCheck) {
      if (typeof rawRef !== "string" || !rawRef.trim()) continue;
      const ref = toPosix(rawRef.trim());
      if (ref.includes(".trellis/") || ref.startsWith(".trellis")) {
        brokenReferences.push(
          `.omtre/tasks/${relDir}/task.json -> ${ref} (unmigrated .trellis prefix)`,
        );
        continue;
      }
      const stripped = ref
        .replace(/^\.\//, "")
        .replace(/^\.omtre\/tasks\//, "")
        .replace(/^tasks\//, "");
      const base = path.posix.basename(stripped);
      const resolved =
        postInventory.knownTaskKeys.has(ref) ||
        postInventory.knownTaskKeys.has(stripped) ||
        postInventory.knownTaskKeys.has(base);
      if (!resolved) {
        brokenReferences.push(
          `.omtre/tasks/${relDir}/task.json -> ${ref} (target task not found)`,
        );
      }
    }
  }

  const countMatches = postTaskCount === preMigrationTaskCount;
  const tasksCheckPassed = countMatches && brokenReferences.length === 0;
  const taskDetails: string[] = [];
  if (!countMatches) {
    taskDetails.push(
      `Task count mismatch: before=${preMigrationTaskCount}, after=${postTaskCount}`,
    );
  } else {
    taskDetails.push(`Task count preserved (${postTaskCount})`);
  }
  if (brokenReferences.length > 0) {
    taskDetails.push(
      `Unresolved task references (${brokenReferences.length}): ${brokenReferences.slice(0, 5).join("; ")}`,
    );
  } else {
    taskDetails.push("All task references resolved");
  }

  items.push({
    id: "tasks-and-blocked-by",
    name: "Task count preserved and all blocked_by references resolve",
    passed: tasksCheckPassed,
    details: taskDetails.join("; "),
  });
  if (!tasksCheckPassed) {
    errors.push(taskDetails.join("; "));
  }

  // 4. Session-start context injection runs once with exit code 0 and non-empty output
  const pythonCmd = detectPythonCommand() ?? "python3";
  const pythonParts = pythonCmd.split(/\s+/);
  const pythonBin = pythonParts[0] ?? "python3";
  const pythonPrefixArgs = pythonParts.slice(1);

  const sessionStartCandidates = [
    ".claude/hooks/session-start.py",
    ".cursor/hooks/session-start.py",
    ".codex/hooks/session-start.py",
    ".gemini/hooks/session-start.py",
    ".qoder/hooks/session-start.py",
    ".omtre/scripts/get_context.py",
  ];

  let selectedScript: string | null = null;
  for (const candidate of sessionStartCandidates) {
    if (fs.existsSync(path.join(cwd, ...candidate.split("/")))) {
      selectedScript = candidate;
      break;
    }
  }

  const runtimeDirAbs = path.join(omtreDir, ".runtime");
  const hadRuntimeDirBefore = fs.existsSync(runtimeDirAbs);

  let hookPassed = false;
  let hookDetails = "";
  let hookOutputLength = 0;

  // Build clean environment so outer host `*_PROJECT_DIR` or `*_NON_INTERACTIVE`
  // variables do not redirect or suppress the session-start probe in `cwd`.
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PYTHONIOENCODING: "utf-8",
    PYTHONDONTWRITEBYTECODE: "1",
    OMTRE_HOOKS: "1",
    OMTRE_DISABLE_HOOKS: "0",
    OMTRE_NON_INTERACTIVE: "0",
    CLAUDE_NON_INTERACTIVE: "0",
    QODER_NON_INTERACTIVE: "0",
    CODEBUDDY_NON_INTERACTIVE: "0",
    FACTORY_NON_INTERACTIVE: "0",
    CURSOR_NON_INTERACTIVE: "0",
    GEMINI_NON_INTERACTIVE: "0",
    KIRO_NON_INTERACTIVE: "0",
    COPILOT_NON_INTERACTIVE: "0",
    TRAE_NON_INTERACTIVE: "0",
    ZCODE_NON_INTERACTIVE: "0",
    CLAUDE_PROJECT_DIR: cwd,
    QODER_PROJECT_DIR: undefined,
    CODEBUDDY_PROJECT_DIR: undefined,
    FACTORY_PROJECT_DIR: undefined,
    CURSOR_PROJECT_DIR: undefined,
    GEMINI_PROJECT_DIR: undefined,
    KIRO_PROJECT_DIR: undefined,
    COPILOT_PROJECT_DIR: undefined,
    TRAE_PROJECT_DIR: undefined,
    ZCODE_PROJECT_DIR: undefined,
  };

  if (!selectedScript) {
    hookPassed = false;
    hookDetails =
      "Neither .omtre/scripts/get_context.py nor platform session-start.py was found";
  } else {
    try {
      const res = spawnSync(
        pythonBin,
        [...pythonPrefixArgs, "-B", "-W", "ignore", selectedScript],
        {
          cwd,
          input: JSON.stringify({ cwd }),
          encoding: "utf-8",
          env: childEnv,
          timeout: 15000,
        },
      );
      const stdout = (res.stdout ?? "").trim();
      const stderr = (res.stderr ?? "").trim();
      hookOutputLength = stdout.length;
      if (res.status === 0 && stdout.length > 0) {
        hookPassed = true;
        hookDetails = `${selectedScript} exited 0 (${stdout.length} chars output)`;
      } else {
        hookPassed = false;
        hookDetails = `${selectedScript} failed (exit=${String(res.status)}, stdout=${stdout.length} chars${stderr ? `, stderr=${stderr}` : ""})`;
      }
    } catch (err) {
      hookPassed = false;
      hookDetails = `${selectedScript} threw error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  // Also verify `.omtre/scripts/task.py list` works
  let taskScriptPassed = true;
  let taskScriptExitCode: number | null = 0;
  let taskScriptError: string | undefined;
  const taskPyPath = path.join(omtreDir, "scripts", "task.py");
  if (fs.existsSync(taskPyPath)) {
    try {
      const res = spawnSync(
        pythonBin,
        [
          ...pythonPrefixArgs,
          "-B",
          "-W",
          "ignore",
          ".omtre/scripts/task.py",
          "list",
        ],
        {
          cwd,
          encoding: "utf-8",
          env: childEnv,
          timeout: 15000,
        },
      );
      taskScriptExitCode = res.status;
      if (res.status !== 0) {
        taskScriptPassed = false;
        taskScriptError =
          (res.stderr ?? "").trim() || `exit=${String(res.status)}`;
      }
    } catch (err) {
      taskScriptPassed = false;
      taskScriptError = err instanceof Error ? err.message : String(err);
    }
  }

  // Clean up any transient `.omtre/.runtime` marker created during the self-check probe
  if (!hadRuntimeDirBefore && fs.existsSync(runtimeDirAbs)) {
    try {
      fs.rmSync(runtimeDirAbs, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  items.push({
    id: "session-start-hook",
    name: "Session start context hook executes cleanly",
    passed: hookPassed,
    details: hookDetails,
  });
  if (!hookPassed) {
    errors.push(hookDetails);
  }

  // Check platform template consistency & `.omtre/.template-hashes.json`
  const missingPlatformFiles: string[] = [];
  for (const platformId of configuredPlatforms) {
    const templates = collectPlatformTemplates(platformId);
    if (!templates) continue;
    for (const relPath of templates.keys()) {
      if (!fs.existsSync(path.join(cwd, ...relPath.split("/")))) {
        missingPlatformFiles.push(relPath);
      }
    }
  }
  const hashesPath = path.join(omtreDir, ".template-hashes.json");
  let hashesValid = false;
  if (fs.existsSync(hashesPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(hashesPath, "utf-8")) as {
        __version?: number;
        hashes?: Record<string, string>;
      };
      hashesValid =
        parsed.__version === 2 &&
        typeof parsed.hashes === "object" &&
        parsed.hashes !== null;
    } catch {
      hashesValid = false;
    }
  }
  if (!hashesValid) {
    missingPlatformFiles.push(".omtre/.template-hashes.json");
  }
  const platformConsistencyPassed = missingPlatformFiles.length === 0;
  if (!platformConsistencyPassed) {
    errors.push(
      `Missing expected platform/metadata files: ${missingPlatformFiles.join(", ")}`,
    );
  }

  const allPassed =
    !legacyDirExists &&
    zeroResiduePassed &&
    tasksCheckPassed &&
    hookPassed &&
    taskScriptPassed &&
    platformConsistencyPassed;

  return {
    passed: allPassed,
    items,
    checks: {
      noLegacyDir: {
        passed: !legacyDirExists,
      },
      taskIntegrity: {
        passed: tasksCheckPassed,
        preCount: preMigrationTaskCount,
        postCount: postTaskCount,
        brokenReferences,
      },
      zeroLegacyResidue: {
        passed: zeroResiduePassed,
        violations: residualViolations,
      },
      sessionStartHook: {
        passed: hookPassed,
        script: selectedScript,
        outputLength: hookOutputLength,
        error: hookPassed ? undefined : hookDetails,
      },
      taskScriptCheck: {
        passed: taskScriptPassed,
        exitCode: taskScriptExitCode,
        error: taskScriptError,
      },
      platformConsistency: {
        passed: platformConsistencyPassed,
        missingFiles: missingPlatformFiles,
      },
    },
    errors,
  };
}
