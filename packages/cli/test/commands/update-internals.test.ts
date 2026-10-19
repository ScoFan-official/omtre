/**
 * Tests for internal helper functions exported from update.ts
 *
 * These test cleanupEmptyDirs and sortMigrationsForExecution
 * to cover command-level behavior that was previously untested.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  cleanupEmptyDirs,
  loadUpdateSkipPaths,
  renameTracesToJournal,
  shouldExcludeFromBackup,
  sortMigrationsForExecution,
} from "../../src/commands/update.js";

// =============================================================================
// cleanupEmptyDirs
// =============================================================================

describe("cleanupEmptyDirs", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "omtre-cleanup-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("removes empty subdirectory under managed path", () => {
    // Create .claude/commands/ (empty)
    fs.mkdirSync(path.join(tmpDir, ".claude", "commands"), { recursive: true });
    cleanupEmptyDirs(tmpDir, ".claude/commands");
    expect(fs.existsSync(path.join(tmpDir, ".claude", "commands"))).toBe(false);
  });

  it("does not remove non-empty directory", () => {
    fs.mkdirSync(path.join(tmpDir, ".claude", "commands"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, ".claude", "commands", "file.md"),
      "content",
    );
    cleanupEmptyDirs(tmpDir, ".claude/commands");
    expect(fs.existsSync(path.join(tmpDir, ".claude", "commands"))).toBe(true);
  });

  it("does not remove directories outside managed paths", () => {
    fs.mkdirSync(path.join(tmpDir, "src", "utils"), { recursive: true });
    cleanupEmptyDirs(tmpDir, "src/utils");
    // Should still exist because src/utils is not a managed path
    expect(fs.existsSync(path.join(tmpDir, "src", "utils"))).toBe(true);
  });

  it("[CR#1] does not delete managed root directories even if empty", () => {
    // This is the bug that CR#1 identified: .claude itself should never be deleted
    fs.mkdirSync(path.join(tmpDir, ".claude"), { recursive: true });
    cleanupEmptyDirs(tmpDir, ".claude");
    expect(fs.existsSync(path.join(tmpDir, ".claude"))).toBe(true);
  });

  it("[CR#1] does not delete .omtre root even if empty", () => {
    fs.mkdirSync(path.join(tmpDir, ".omtre"), { recursive: true });
    cleanupEmptyDirs(tmpDir, ".omtre");
    expect(fs.existsSync(path.join(tmpDir, ".omtre"))).toBe(true);
  });

  it("recursively cleans parent directories but stops at root", () => {
    // Create .omtre/scripts/multi_agent/ (all empty)
    fs.mkdirSync(path.join(tmpDir, ".omtre", "scripts", "multi_agent"), {
      recursive: true,
    });
    cleanupEmptyDirs(tmpDir, ".omtre/scripts/multi_agent");

    // multi_agent and scripts should be removed (both empty)
    expect(
      fs.existsSync(path.join(tmpDir, ".omtre", "scripts", "multi_agent")),
    ).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".omtre", "scripts"))).toBe(false);
    // .omtre root must survive
    expect(fs.existsSync(path.join(tmpDir, ".omtre"))).toBe(true);
  });

  it("handles non-existent directory gracefully", () => {
    // Should not throw
    expect(() => cleanupEmptyDirs(tmpDir, ".claude/nonexistent")).not.toThrow();
  });

  it("rejects traversal and dot segments before managed cleanup", () => {
    const userDir = path.join(tmpDir, "user-empty-dir");
    fs.mkdirSync(userDir);

    cleanupEmptyDirs(tmpDir, ".omtre/../user-empty-dir");
    cleanupEmptyDirs(tmpDir, ".omtre/./../user-empty-dir");

    expect(fs.existsSync(userDir)).toBe(true);
  });

  it.skipIf(process.platform === "win32")(
    "does not follow a managed parent symlink outside the project",
    () => {
      const external = fs.mkdtempSync(
        path.join(os.tmpdir(), "omtre-cleanup-external-"),
      );
      const externalEmpty = path.join(external, "empty");
      fs.mkdirSync(externalEmpty);
      fs.mkdirSync(path.join(tmpDir, ".omtre"));
      fs.symlinkSync(external, path.join(tmpDir, ".omtre", "linked"), "dir");

      try {
        cleanupEmptyDirs(tmpDir, ".omtre/linked/empty");
        expect(fs.existsSync(externalEmpty)).toBe(true);
      } finally {
        fs.rmSync(external, { recursive: true, force: true });
      }
    },
  );
});

// =============================================================================
// loadUpdateSkipPaths — YAML quote handling
// =============================================================================

describe("loadUpdateSkipPaths", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "omtre-skip-"));
    fs.mkdirSync(path.join(tmpDir, ".omtre"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("strips double quotes from skip paths", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".omtre", "config.yaml"),
      'update:\n  skip:\n    - ".claude/commands/"\n',
    );
    const paths = loadUpdateSkipPaths(tmpDir);
    expect(paths).toEqual([".claude/commands/"]);
  });

  it("strips single quotes from skip paths", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".omtre", "config.yaml"),
      "update:\n  skip:\n    - '.claude/commands/'\n",
    );
    const paths = loadUpdateSkipPaths(tmpDir);
    expect(paths).toEqual([".claude/commands/"]);
  });

  it("handles unquoted skip paths", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".omtre", "config.yaml"),
      "update:\n  skip:\n    - .claude/commands/\n",
    );
    const paths = loadUpdateSkipPaths(tmpDir);
    expect(paths).toEqual([".claude/commands/"]);
  });

  it("returns empty array when no config exists", () => {
    const paths = loadUpdateSkipPaths(tmpDir);
    expect(paths).toEqual([]);
  });
});

// =============================================================================
// sortMigrationsForExecution
// =============================================================================

describe("sortMigrationsForExecution", () => {
  it("returns empty array for empty input", () => {
    expect(sortMigrationsForExecution([])).toEqual([]);
  });

  it("puts rename-dir before rename and delete", () => {
    const items = [
      { type: "rename" as const, from: ".claude/a.md", to: ".claude/b.md" },
      { type: "rename-dir" as const, from: ".omtre/old", to: ".omtre/new" },
      { type: "delete" as const, from: ".claude/c.md" },
    ];
    const sorted = sortMigrationsForExecution(items);
    expect(sorted[0].type).toBe("rename-dir");
  });

  it("sorts rename-dir by path depth (deeper first)", () => {
    const items = [
      { type: "rename-dir" as const, from: ".omtre/a", to: ".omtre/x" },
      {
        type: "rename-dir" as const,
        from: ".omtre/a/b/c",
        to: ".omtre/x/y/z",
      },
      { type: "rename-dir" as const, from: ".omtre/a/b", to: ".omtre/x/y" },
    ];
    const sorted = sortMigrationsForExecution(items);
    expect(sorted[0].from).toBe(".omtre/a/b/c"); // depth 4
    expect(sorted[1].from).toBe(".omtre/a/b"); // depth 3
    expect(sorted[2].from).toBe(".omtre/a"); // depth 2
  });

  it("preserves relative order of rename and delete items", () => {
    const items = [
      { type: "rename" as const, from: ".claude/a.md", to: ".claude/b.md" },
      { type: "delete" as const, from: ".claude/c.md" },
      { type: "rename" as const, from: ".claude/d.md", to: ".claude/e.md" },
    ];
    const sorted = sortMigrationsForExecution(items);
    // No rename-dir items, so original order is preserved
    expect(sorted[0].from).toBe(".claude/a.md");
    expect(sorted[1].from).toBe(".claude/c.md");
    expect(sorted[2].from).toBe(".claude/d.md");
  });

  it("does not mutate original array", () => {
    const items = [
      { type: "rename" as const, from: "a", to: "b" },
      { type: "rename-dir" as const, from: "c", to: "d" },
    ];
    const original = [...items];
    sortMigrationsForExecution(items);
    expect(items).toEqual(original);
  });
});

// =============================================================================
// shouldExcludeFromBackup — worktrees + user data must not end up in backups
// =============================================================================

describe("shouldExcludeFromBackup", () => {
  // Platform-native worktree dirs host nested sub-repos spawned by the CLI.
  // Snapshotting them on every update would duplicate gigabytes; they must
  // be excluded regardless of which platform put them there.
  it.each([
    ".claude/worktrees/feature-x/src/main.ts",
    ".cursor/worktrees/bugfix-1/README.md",
    ".gemini/worktrees/exp/file.txt",
    ".factory/worktrees/any/file.md",
  ])("excludes %s (worktrees convention)", (p) => {
    expect(shouldExcludeFromBackup(p)).toBe(true);
  });

  it("excludes singular /worktree/ variant", () => {
    expect(shouldExcludeFromBackup(".opencode/worktree/branch/file.ts")).toBe(
      true,
    );
  });

  it("excludes domain boards/REGISTRY/worklogs (user data)", () => {
    expect(shouldExcludeFromBackup(".omtre/domains/REGISTRY.md")).toBe(true);
    expect(
      shouldExcludeFromBackup(".omtre/domains/deap/worklog/dev.md"),
    ).toBe(true);
  });

  it.each([
    ".opencode/node_modules/@opencode-ai/sdk/package.json",
    ".omtre/.backup-2026-04-22T10-24-27/.opencode/node_modules/zod/index.js",
  ])("excludes dependency tree %s", (p) => {
    expect(shouldExcludeFromBackup(p)).toBe(true);
  });

  it.each([
    ".omtre/workspace/developer/journal-1.md",
    ".omtre/tasks/04-17-foo/prd.md",
    ".omtre/spec/cli/backend/index.md",
    ".omtre/backlog/idea.md",
    ".omtre/agent-traces/trace.jsonl",
  ])("excludes user data %s", (p) => {
    expect(shouldExcludeFromBackup(p)).toBe(true);
  });

  it("excludes previous backups", () => {
    expect(
      shouldExcludeFromBackup(".omtre/.backup-2026-04-20T01-00-00/x"),
    ).toBe(true);
  });

  it.each([
    ".claude/commands/omt/continue.md",
    ".claude/skills/omtre-check/SKILL.md",
    ".omtre/workflow.md",
    ".omtre/scripts/get_context.py",
    ".agents/skills/omtre-check/SKILL.md",
  ])("includes managed file %s", (p) => {
    expect(shouldExcludeFromBackup(p)).toBe(false);
  });

  it("does not treat 'worktrees' as a substring match outside path segments", () => {
    // Files that happen to have "worktree" in their name but aren't inside a
    // worktree dir should still be backed up.
    expect(shouldExcludeFromBackup(".claude/worktree-notes.md")).toBe(false);
  });

  // Windows `path.relative` returns backslash paths. The slash-prefixed
  // exclude patterns (/worktrees/, /tasks/, /spec/, ...) must still match
  // after normalization, otherwise Omtre's native worktree protection
  // silently fails on Windows and `collectAllFiles` descends into nested
  // full project copies (observed in the field: stack-overflow crash on
  // `omtre update --migrate`, late April 2026).
  it.each([
    ".claude\\worktrees\\feat-x\\src\\main.ts",
    ".omtre\\tasks\\04-17-foo\\prd.md",
    ".omtre\\workspace\\dev\\journal-1.md",
    ".opencode\\node_modules\\zod\\index.js",
  ])("excludes Windows-style backslash path %s", (p) => {
    expect(shouldExcludeFromBackup(p)).toBe(true);
  });
});

// =============================================================================
// renameTracesToJournal — 0.2.0 traces→journal migration (data-safety)
// =============================================================================

describe("renameTracesToJournal", () => {
  let tmpDir: string;
  let ws: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "omtre-traces-"));
    ws = path.join(tmpDir, "workspace");
    fs.mkdirSync(path.join(ws, "alice"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("renames traces-N.md to journal-N.md when no target exists", () => {
    const dev = path.join(ws, "alice");
    fs.writeFileSync(path.join(dev, "traces-1.md"), "trace one");

    const { renamed, skipped } = renameTracesToJournal(ws);

    expect(renamed).toBe(1);
    expect(skipped).toEqual([]);
    expect(fs.existsSync(path.join(dev, "traces-1.md"))).toBe(false);
    expect(fs.readFileSync(path.join(dev, "journal-1.md"), "utf-8")).toBe(
      "trace one",
    );
  });

  it("never overwrites an existing journal target; keeps both and reports it", () => {
    const dev = path.join(ws, "alice");
    fs.writeFileSync(path.join(dev, "traces-1.md"), "old trace");
    // A newer session already created journal-1.md with real history.
    fs.writeFileSync(path.join(dev, "journal-1.md"), "REAL SESSION HISTORY");

    const { renamed, skipped } = renameTracesToJournal(ws);

    expect(renamed).toBe(0);
    expect(skipped).toEqual([path.join(dev, "traces-1.md")]);
    // Existing journal is untouched...
    expect(fs.readFileSync(path.join(dev, "journal-1.md"), "utf-8")).toBe(
      "REAL SESSION HISTORY",
    );
    // ...and the traces file is preserved, not destroyed.
    expect(fs.readFileSync(path.join(dev, "traces-1.md"), "utf-8")).toBe(
      "old trace",
    );
  });

  it("returns zero counts when the workspace dir does not exist", () => {
    expect(renameTracesToJournal(path.join(tmpDir, "nope"))).toEqual({
      renamed: 0,
      skipped: [],
    });
  });
});

// =============================================================================
// rename-dir ownership gate — 🔴-4: never auto-move a user-owned directory
// =============================================================================

import {
  classifyMigrations,
  dirHasManifestEntries,
} from "../../src/commands/update.js";
import type { MigrationItem } from "../../src/types/migration.js";

describe("dirHasManifestEntries", () => {
  it("is true when the manifest tracks a file under the dir", () => {
    expect(
      dirHasManifestEntries(".windsurf/workflows", {
        ".windsurf/workflows/a.md": "hash",
      }),
    ).toBe(true);
  });

  it("is true on an exact key match", () => {
    expect(dirHasManifestEntries("AGENTS.md", { "AGENTS.md": "h" })).toBe(true);
  });

  it("is false when nothing under the dir is tracked", () => {
    expect(
      dirHasManifestEntries(".windsurf/workflows", {
        ".claude/settings.json": "h",
      }),
    ).toBe(false);
  });

  it("does not match a sibling dir that shares a prefix string", () => {
    // ".devin" must not match ".devinX/..."
    expect(dirHasManifestEntries(".devin", { ".devinX/a.md": "h" })).toBe(
      false,
    );
  });
});

describe("classifyMigrations rename-dir ownership gate", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "omtre-renamedir-"));
    // A user-owned .windsurf/workflows that Omtre never created.
    fs.mkdirSync(path.join(tmpDir, ".windsurf", "workflows"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(tmpDir, ".windsurf", "workflows", "user.md"),
      "user workflow",
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const migration: MigrationItem[] = [
    { type: "rename-dir", from: ".windsurf/workflows", to: ".devin/workflows" },
  ];

  it("skips (never auto-moves) an unowned source dir when the target is absent", () => {
    const result = classifyMigrations(migration, tmpDir, {}, new Map());
    expect(result.auto).toHaveLength(0);
    expect(result.skip).toHaveLength(1);
    expect(result.skip[0].from).toBe(".windsurf/workflows");
  });

  it("auto-migrates when Omtre owns the source dir (manifest has entries)", () => {
    const hashes = { ".windsurf/workflows/user.md": "some-hash" };
    const result = classifyMigrations(migration, tmpDir, hashes, new Map());
    expect(result.skip).toHaveLength(0);
    expect(result.auto).toHaveLength(1);
    expect(result.auto[0].to).toBe(".devin/workflows");
  });
});
