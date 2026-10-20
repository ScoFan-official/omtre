import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import inquirer from "inquirer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { migrate } from "../../src/commands/migrate.js";
import { VERSION } from "../../src/constants/version.js";
import { computeHash } from "../../src/utils/template-hash.js";

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function initGitRepo(dir: string): void {
  git(dir, ["init"]);
  git(dir, ["config", "user.email", "test@example.com"]);
  git(dir, ["config", "user.name", "Test User"]);
}

function commitAll(dir: string, message = "initial"): void {
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-m", message, "--allow-empty"]);
}

interface LegacyFixtureOptions {
  version?: string;
  withClaude?: boolean;
  withCursor?: boolean;
  withCodex?: boolean;
  withPi?: boolean;
  modifyClaudeHook?: boolean;
  withRuntimeCache?: boolean;
}

/**
 * Populate a realistic 0.6.x `.trellis/` project fixture inside `dir`.
 */
function createLegacyTrellisFixture(
  dir: string,
  opts: LegacyFixtureOptions = {},
): {
  hashes: Record<string, string>;
} {
  const {
    version = "0.6.0-beta.2",
    withClaude = true,
    withCursor = false,
    withCodex = false,
    withPi = false,
    modifyClaudeHook = false,
    withRuntimeCache = true,
  } = opts;

  const hashes: Record<string, string> = {};
  const writeTracked = (
    relPosix: string,
    content: string,
    diskOverride?: string,
  ) => {
    const full = path.join(dir, ...relPosix.split("/"));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    hashes[relPosix] = computeHash(content);
    fs.writeFileSync(full, diskOverride ?? content, "utf-8");
  };

  const writeUntracked = (relPosix: string, content: string) => {
    const full = path.join(dir, ...relPosix.split("/"));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, "utf-8");
  };

  // 1. Core `.trellis/` files
  writeUntracked(".trellis/.version", `${version}\n`);
  writeUntracked(".trellis/.developer", "name=alice\n");
  writeUntracked(
    ".trellis/config.yaml",
    [
      "# Trellis configuration",
      "worktree_dir: ../.trellis-worktrees",
      "hooks:",
      "  after_create:",
      '    - echo "Task in .trellis/tasks created with $TRELLIS_NonInteractive"',
      "",
    ].join("\n"),
  );
  writeTracked(
    ".trellis/workflow.md",
    "# Trellis Workflow\nSee https://github.com/mindfold-ai/trellis for background.\n",
  );
  writeTracked(
    ".trellis/scripts/task.py",
    "# legacy task.py placeholder\nprint('legacy')\n",
  );

  // Built-in agent with custom frontmatter keys (`provider`, `model`, `effort`)
  writeTracked(
    ".trellis/agents/implement.md",
    [
      "---",
      "name: implement",
      "description: Implementation agent",
      "tools: Read, Write, Edit, Bash",
      "model: claude-opus-4-6",
      "provider: anthropic",
      "effort: high",
      "---",
      "Legacy implement body referencing .trellis/spec/guides/index.md",
      "",
    ].join("\n"),
  );

  // User custom agent inside `.trellis/agents/`
  writeUntracked(
    ".trellis/agents/security-reviewer.md",
    [
      "---",
      "name: security-reviewer",
      "---",
      "Read `.trellis/spec/backend/index.md` and run `/trellis:check`.",
      "",
    ].join("\n"),
  );

  // 2. `.trellis/tasks/` and `.trellis/tasks/archive/` (including task dir containing `trellis-`)
  writeUntracked(
    ".trellis/tasks/10-19-rename-rules/task.json",
    JSON.stringify(
      {
        id: "10-19-rename-rules",
        name: "10-19-rename-rules",
        title: "Rename rules",
        status: "in_progress",
        parent: null,
        children: ["10-20-trellis-legacy-audit"],
        related_tasks: ["10-18-trellis-bootstrap"],
        meta: {
          spec_path: ".trellis/spec/guides/index.md",
        },
      },
      null,
      2,
    ) + "\n",
  );
  writeUntracked(
    ".trellis/tasks/10-19-rename-rules/prd.md",
    [
      "# Rename Rules",
      "",
      "Depends on archived task `.trellis/tasks/archive/2026-10/10-18-trellis-bootstrap/prd.md`.",
      "Child task: `10-20-trellis-legacy-audit`.",
      "Run `python3 ./.trellis/scripts/task.py status` or `/trellis:start`.",
      "Set `TRELLIS_NON_INTERACTIVE=1` in CI.",
      "Attribution: https://github.com/mindfold-ai/trellis must remain unchanged.",
      "",
    ].join("\n"),
  );

  writeUntracked(
    ".trellis/tasks/10-20-trellis-legacy-audit/task.json",
    JSON.stringify(
      {
        id: "10-20-trellis-legacy-audit",
        name: "10-20-trellis-legacy-audit",
        title: "Audit legacy trellis references",
        status: "planning",
        parent: "10-19-rename-rules",
        children: [],
        related_tasks: [],
      },
      null,
      2,
    ) + "\n",
  );
  writeUntracked(
    ".trellis/tasks/10-20-trellis-legacy-audit/prd.md",
    "# Audit\nCheck `.trellis/workspace/alice/journal-1.md` and `$trellis-check`.\n",
  );

  writeUntracked(
    ".trellis/tasks/archive/2026-10/10-18-trellis-bootstrap/task.json",
    JSON.stringify(
      {
        id: "10-18-trellis-bootstrap",
        name: "10-18-trellis-bootstrap",
        title: "Bootstrap trellis",
        status: "completed",
        parent: null,
        children: [],
        related_tasks: ["10-19-rename-rules"],
      },
      null,
      2,
    ) + "\n",
  );
  writeUntracked(
    ".trellis/tasks/archive/2026-10/10-18-trellis-bootstrap/prd.md",
    "# Bootstrap\nArchived task inside `.trellis/tasks/archive/2026-10/10-18-trellis-bootstrap`.\n",
  );

  // 3. `.trellis/spec/`, `.trellis/workspace/`, `.trellis/domains/`
  writeUntracked(
    ".trellis/spec/guides/index.md",
    "# Guides\nUse `.trellis/scripts/get-context.py` and `/trellis:finish-work`.\n",
  );
  writeUntracked(
    ".trellis/spec/guides/trellis-conventions.md",
    "# Conventions\nCheck `.trellis/spec/guides/trellis-conventions.md` and `TRELLIS_ALLOW_DIRTY`.\n",
  );
  writeUntracked(
    ".trellis/workspace/index.md",
    "# Workspace Index\nActive developer: alice (`.trellis/workspace/alice/index.md`).\n",
  );
  writeUntracked(
    ".trellis/workspace/alice/journal-1.md",
    "# Journal 1\nUsed `/trellis:start` and `trellis-implement` agent on `10-18-trellis-bootstrap`.\n",
  );
  writeUntracked(
    ".trellis/domains/core.md",
    "# Core Domain\nManaged under `.trellis/domains/core.md`.\n",
  );

  // 4. Root files (`AGENTS.md`, `CLAUDE.md`, `.gitignore`, `.gitattributes`)
  writeUntracked(
    "AGENTS.md",
    [
      "# Project Instructions",
      "",
      "Custom project header.",
      "",
      "<!-- TRELLIS:START -->",
      "# Trellis Instructions",
      "Use `/trellis:start` and read `.trellis/workflow.md`.",
      "<!-- TRELLIS:END -->",
      "",
    ].join("\n"),
  );
  writeUntracked(
    ".gitignore",
    [
      "node_modules/",
      ".trellis/.current-task",
      ".trellis/.runtime/",
      ".claude/settings.local.json",
      "",
    ].join("\n"),
  );
  writeUntracked(
    ".gitattributes",
    ".trellis/workspace/** merge=union\n.trellis/tasks/** merge=union\n",
  );

  // 5. Platform files
  if (withClaude) {
    const origHookContent = "#!/usr/bin/env python3\n# original session-start\n";
    const diskHookContent = modifyClaudeHook
      ? "#!/usr/bin/env python3\n# user customized session-start hook!\n"
      : origHookContent;
    writeTracked(".claude/hooks/session-start.py", origHookContent, diskHookContent);
    writeTracked(
      ".claude/commands/trellis/start.md",
      "# Legacy /trellis:start\n",
    );
    writeTracked(
      ".claude/skills/trellis-start/SKILL.md",
      "# Legacy trellis-start skill\n",
    );
    writeTracked(
      ".claude/agents/trellis-implement.md",
      "# Legacy trellis-implement agent\n",
    );

    // Custom user command under `.claude/commands/trellis/release-notes.md`
    writeUntracked(
      ".claude/commands/trellis/release-notes.md",
      "# Release Notes\nRead `.trellis/tasks` and run `/trellis:check` with `TRELLIS_ENV=prod`.\n",
    );
    // Custom user skill under `.claude/skills/contribute/SKILL.md`
    writeUntracked(
      ".claude/skills/contribute/SKILL.md",
      "# Contribute\nInspect `.trellis/spec/guides/index.md` and invoke `/trellis:finish-work`.\n",
    );

    // Shared `.claude/settings.json` with both legacy Trellis hooks and user custom keys/hooks
    const claudeSettings = JSON.stringify(
      {
        env: {
          CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1",
          MY_CUSTOM_ENV: "keep-me",
        },
        permissions: {
          allow: ["Bash(git status)"],
        },
        statusLine: {
          type: "command",
          command: 'python3 "$CLAUDE_PROJECT_DIR/.trellis/scripts/HUD.py"',
        },
        hooks: {
          SessionStart: [
            {
              matcher: "startup",
              hooks: [
                {
                  type: "command",
                  command:
                    'python3 "$CLAUDE_PROJECT_DIR/.claude/hooks/session-start.py"',
                },
                {
                  type: "command",
                  command: "echo 'user custom startup hook'",
                },
              ],
            },
          ],
        },
      },
      null,
      2,
    ) + "\n";
    writeTracked(".claude/settings.json", claudeSettings);
  }

  if (withCursor) {
    writeTracked(
      ".cursor/commands/trellis-start.md",
      "# Legacy Cursor /trellis-start\n",
    );
    writeUntracked(
      ".cursor/commands/trellis-deploy.md",
      "# Custom Cursor Deploy\nRun `/trellis-check` and read `.trellis/config.yaml`.\n",
    );
    writeUntracked(
      ".cursor/hooks.json",
      JSON.stringify(
        {
          version: 1,
          hooks: {
            sessionStart: [
              {
                command: 'python3 ".cursor/hooks/session-start.py"',
              },
              {
                command: "echo custom-cursor-hook",
              },
            ],
          },
        },
        null,
        2,
      ) + "\n",
    );
  }

  if (withCodex) {
    writeTracked(
      ".codex/agents/trellis-implement.toml",
      [
        'name = "trellis-implement"',
        'description = "Legacy codex implement"',
        'model = "gpt-5.4"',
        'model_reasoning_effort = "high"',
        'developer_instructions = """',
        "Legacy instructions",
        '"""',
        "",
      ].join("\n"),
    );
    writeTracked(
      ".codex/hooks/write-trellis-context.py",
      "# retired codex hook\n",
    );
    writeUntracked(
      ".codex/config.toml",
      [
        "# Added by Trellis",
        "[features]",
        "multi_agent = true",
        "codex_hooks = true",
        'custom_user_flag = "preserved"',
        "",
      ].join("\n"),
    );
    writeUntracked(
      ".codex/hooks.json",
      JSON.stringify(
        {
          hooks: {
            SessionStart: [
              {
                matcher: "startup",
                hooks: [
                  {
                    type: "command",
                    command: "python3 .codex/hooks/session-start.py",
                  },
                ],
              },
            ],
          },
        },
        null,
        2,
      ) + "\n",
    );
  }

  if (withPi) {
    writeTracked(
      ".pi/extensions/trellis/index.ts",
      "// legacy pi extension\n",
    );
    writeTracked(".pi/prompts/trellis-start.md", "# legacy pi start\n");
    writeUntracked(
      ".pi/settings.json",
      JSON.stringify(
        {
          theme: "dark",
          extensions: [
            ".pi/extensions/trellis/index.ts",
            ".pi/extensions/custom-user/index.ts",
          ],
        },
        null,
        2,
      ) + "\n",
    );
  }

  // 6. Category 3 runtime/cache files
  if (withRuntimeCache) {
    writeUntracked(".trellis/.current-task", "10-19-rename-rules\n");
    writeUntracked(".trellis/.ralph-state.json", '{"loop":1}\n');
    writeUntracked(".trellis/.runtime/state.json", '{"active":false}\n');
    writeUntracked(".trellis/.backup-20261001/old.txt", "old\n");
    writeUntracked(".trellis/scripts/__pycache__/task.cpython-312.pyc", "bin");
  }

  // 7. Write `.trellis/.template-hashes.json`
  writeUntracked(
    ".trellis/.template-hashes.json",
    JSON.stringify({ __version: 2, hashes }, null, 2) + "\n",
  );

  return { hashes };
}

describe("omtre migrate", () => {
  let tempDir: string;
  let fakeHomeDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "omtre-migrate-test-"));
    fakeHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), "omtre-migrate-home-"));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.rmSync(fakeHomeDir, { recursive: true, force: true });
  });

  describe("state detection & precondition guards", () => {
    it("exits 0 idempotently when already migrated (.trellis absent, .omtre present)", async () => {
      initGitRepo(tempDir);
      fs.mkdirSync(path.join(tempDir, ".omtre"), { recursive: true });
      fs.writeFileSync(path.join(tempDir, ".omtre", ".version"), `${VERSION}\n`);
      commitAll(tempDir);

      const res = await migrate({
        cwd: tempDir,
        homeDir: fakeHomeDir,
        env: {},
        yes: true,
      });

      expect(res.status).toBe("already-migrated");
      expect(process.exitCode).toBeUndefined();
    });

    it("refuses with exit 1 when both .trellis/ and .omtre/ exist (interrupted migration)", async () => {
      initGitRepo(tempDir);
      fs.mkdirSync(path.join(tempDir, ".trellis"), { recursive: true });
      fs.mkdirSync(path.join(tempDir, ".omtre"), { recursive: true });
      commitAll(tempDir);

      const exitSpy = vi
        .spyOn(process, "exit")
        .mockImplementation((() => {
          throw new Error("process.exit(1)");
        }) as never);

      await expect(
        migrate({ cwd: tempDir, homeDir: fakeHomeDir, env: {}, yes: true }),
      ).rejects.toThrow("process.exit(1)");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("refuses with exit 1 when neither .trellis/ nor .omtre/ exists", async () => {
      initGitRepo(tempDir);
      commitAll(tempDir);

      const exitSpy = vi
        .spyOn(process, "exit")
        .mockImplementation((() => {
          throw new Error("process.exit(1)");
        }) as never);

      await expect(
        migrate({ cwd: tempDir, homeDir: fakeHomeDir, env: {}, yes: true }),
      ).rejects.toThrow("process.exit(1)");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("refuses with exit 1 when not inside a Git worktree", async () => {
      createLegacyTrellisFixture(tempDir);

      const exitSpy = vi
        .spyOn(process, "exit")
        .mockImplementation((() => {
          throw new Error("process.exit(1)");
        }) as never);

      await expect(
        migrate({ cwd: tempDir, homeDir: fakeHomeDir, env: {}, yes: true }),
      ).rejects.toThrow("process.exit(1)");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("refuses dirty Git working tree by default, but allows --dry-run and --allow-dirty", async () => {
      initGitRepo(tempDir);
      createLegacyTrellisFixture(tempDir);
      commitAll(tempDir);

      // Make working tree dirty
      fs.writeFileSync(path.join(tempDir, "dirty.txt"), "uncommitted\n");

      const exitSpy = vi
        .spyOn(process, "exit")
        .mockImplementation((() => {
          throw new Error("process.exit(1)");
        }) as never);

      await expect(
        migrate({ cwd: tempDir, homeDir: fakeHomeDir, env: {}, yes: true }),
      ).rejects.toThrow("process.exit(1)");
      expect(exitSpy).toHaveBeenCalledWith(1);

      // --dry-run succeeds on dirty tree without mutating files
      exitSpy.mockRestore();
      process.exitCode = undefined;
      const dryRes = await migrate({
        cwd: tempDir,
        homeDir: fakeHomeDir,
        env: {},
        dryRun: true,
      });
      expect(dryRes.status).toBe("dry-run");
      expect(fs.existsSync(path.join(tempDir, ".trellis"))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, ".omtre"))).toBe(false);

      // --allow-dirty succeeds on dirty tree
      const allowDirtyRes = await migrate({
        cwd: tempDir,
        homeDir: fakeHomeDir,
        env: {},
        yes: true,
        allowDirty: true,
      });
      expect(allowDirtyRes.status).toBe("migrated");
      expect(fs.existsSync(path.join(tempDir, ".omtre"))).toBe(true);
    });

    it("refuses when .trellis/.version is not 0.6.x", async () => {
      initGitRepo(tempDir);
      createLegacyTrellisFixture(tempDir, { version: "0.5.9" });
      commitAll(tempDir);

      const exitSpy = vi
        .spyOn(process, "exit")
        .mockImplementation((() => {
          throw new Error("process.exit(1)");
        }) as never);

      await expect(
        migrate({ cwd: tempDir, homeDir: fakeHomeDir, env: {}, yes: true }),
      ).rejects.toThrow("process.exit(1)");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("refuses when an active daemon or runtime session PID is alive", async () => {
      initGitRepo(tempDir);
      createLegacyTrellisFixture(tempDir);
      commitAll(tempDir);

      // Simulate active channel daemon PID using current process.pid
      const daemonPidPath = path.join(
        fakeHomeDir,
        ".trellis",
        "channels",
        "daemon.pid",
      );
      fs.mkdirSync(path.dirname(daemonPidPath), { recursive: true });
      fs.writeFileSync(daemonPidPath, `${process.pid}\n`, "utf-8");

      const exitSpy = vi
        .spyOn(process, "exit")
        .mockImplementation((() => {
          throw new Error("process.exit(1)");
        }) as never);

      await expect(
        migrate({ cwd: tempDir, homeDir: fakeHomeDir, env: {}, yes: true }),
      ).rejects.toThrow("process.exit(1)");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("full migration execution & 4 post-migration self-checks", () => {
    it("migrates .trellis -> .omtre, preserves user data & settings, backs up modified managed files, cleans runtime, and passes all 4 self-checks", async () => {
      initGitRepo(tempDir);
      createLegacyTrellisFixture(tempDir, {
        withClaude: true,
        withCursor: true,
        withCodex: true,
        withPi: true,
        modifyClaudeHook: true,
        withRuntimeCache: true,
      });

      // Add a historical archived task with corrupted JSON (per PRD 4.3, self-check must tolerate it)
      const corruptedTaskJson = path.join(
        tempDir,
        ".trellis",
        "tasks",
        "archive",
        "2026-09",
        "09-01-corrupted-archive",
        "task.json",
      );
      fs.mkdirSync(path.dirname(corruptedTaskJson), { recursive: true });
      fs.writeFileSync(
        corruptedTaskJson,
        '{ "id": "09-01-corrupted-archive", broken json\n',
        "utf-8",
      );

      // Add a repo-internal out-of-scope file (e.g. custom CI script) that must be reported with line numbers but NOT modified
      const customCiScript = path.join(tempDir, "scripts", "custom-ci.sh");
      fs.mkdirSync(path.dirname(customCiScript), { recursive: true });
      const origCustomCiContent = [
        "#!/usr/bin/env bash",
        "export TRELLIS_CI_MODE=1",
        "ls .trellis/tasks",
        "",
      ].join("\n");
      fs.writeFileSync(customCiScript, origCustomCiContent, "utf-8");

      commitAll(tempDir);

      // Simulate external references in fakeHomeDir and env (should be reported only, never mutated)
      const globalTrellisDir = path.join(fakeHomeDir, ".trellis");
      fs.mkdirSync(globalTrellisDir, { recursive: true });
      const globalClaudeMd = path.join(fakeHomeDir, ".claude", "CLAUDE.md");
      fs.mkdirSync(path.dirname(globalClaudeMd), { recursive: true });
      const origGlobalClaudeContent = "Global instructions using /trellis:start\n";
      fs.writeFileSync(globalClaudeMd, origGlobalClaudeContent, "utf-8");
      const zshrcPath = path.join(fakeHomeDir, ".zshrc");
      const origZshrcContent = "export TRELLIS_NON_INTERACTIVE=1\n";
      fs.writeFileSync(zshrcPath, origZshrcContent, "utf-8");

      const result = await migrate({
        cwd: tempDir,
        homeDir: fakeHomeDir,
        env: { TRELLIS_NON_INTERACTIVE: "1" },
        yes: true,
        json: true,
      });

      expect(result.status).toBe("migrated");
      expect(result.selfCheck?.passed).toBe(true);
      expect(result.selfCheck?.checks.taskIntegrity.passed).toBe(true);
      expect(result.selfCheck?.checks.taskIntegrity.preCount).toBe(4);
      expect(result.selfCheck?.checks.taskIntegrity.postCount).toBe(4);
      expect(result.selfCheck?.checks.zeroLegacyResidue.passed).toBe(true);
      expect(result.selfCheck?.checks.taskScriptCheck.passed).toBe(true);
      expect(result.selfCheck?.checks.platformConsistency.passed).toBe(true);

      // 1. `.trellis/` is gone, `.omtre/` exists
      expect(fs.existsSync(path.join(tempDir, ".trellis"))).toBe(false);
      expect(fs.existsSync(path.join(tempDir, ".omtre"))).toBe(true);

      // 2. Category 1: Modified `.claude/hooks/session-start.py` was backed up to `.claude/hooks/session-start.py.backup`
      const backupHookPath = path.join(
        tempDir,
        ".claude",
        "hooks",
        "session-start.py.backup",
      );
      expect(fs.existsSync(backupHookPath)).toBe(true);
      expect(fs.readFileSync(backupHookPath, "utf-8")).toContain(
        "user customized session-start hook!",
      );
      expect(
        result.plan?.managed.backups.some(
          (b) => b.backupPath === ".claude/hooks/session-start.py.backup",
        ),
      ).toBe(true);

      // Regenerated Omtre platform files exist & legacy Trellis platform files were removed
      expect(
        fs.existsSync(
          path.join(tempDir, ".claude", "commands", "omt", "continue.md"),
        ),
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(tempDir, ".claude", "commands", "omt", "finish-work.md"),
        ),
      ).toBe(true);
      expect(
        fs.existsSync(path.join(tempDir, ".claude", "commands", "trellis")),
      ).toBe(false);
      expect(
        fs.existsSync(
          path.join(tempDir, ".claude", "skills", "omtre-check", "SKILL.md"),
        ),
      ).toBe(true);
      expect(
        fs.existsSync(path.join(tempDir, ".claude", "skills", "trellis-start")),
      ).toBe(false);
      expect(
        fs.existsSync(
          path.join(tempDir, ".claude", "agents", "omtre-implement.md"),
        ),
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(tempDir, ".claude", "agents", "trellis-implement.md"),
        ),
      ).toBe(false);

      // Shared settings preserved user custom keys & hooks while updating Omtre hooks
      const claudeSettings = JSON.parse(
        fs.readFileSync(path.join(tempDir, ".claude", "settings.json"), "utf-8"),
      ) as Record<string, unknown>;
      expect(
        (claudeSettings.env as Record<string, string>).MY_CUSTOM_ENV,
      ).toBe("keep-me");
      expect(
        (claudeSettings.statusLine as { command: string }).command,
      ).toContain(".omtre/scripts/HUD.py");
      expect(
        JSON.stringify(claudeSettings.hooks),
      ).toContain("user custom startup hook");

      // Codex preserved `model` and `model_reasoning_effort` in `.codex/agents/omtre-implement.toml`
      const codexImplementToml = fs.readFileSync(
        path.join(tempDir, ".codex", "agents", "omtre-implement.toml"),
        "utf-8",
      );
      expect(codexImplementToml).toContain('model = "gpt-5.4"');
      expect(codexImplementToml).toContain('model_reasoning_effort = "high"');
      expect(
        fs.existsSync(
          path.join(tempDir, ".codex", "hooks", "write-trellis-context.py"),
        ),
      ).toBe(false);
      const codexConfigToml = fs.readFileSync(
        path.join(tempDir, ".codex", "config.toml"),
        "utf-8",
      );
      expect(codexConfigToml).not.toContain("# Added by Trellis");
      expect(codexConfigToml).toContain('custom_user_flag = "preserved"');

      // `.omtre/agents/implement.md` preserved customized frontmatter keys (`provider`, `model`, `effort`)
      const implementAgentMd = fs.readFileSync(
        path.join(tempDir, ".omtre", "agents", "implement.md"),
        "utf-8",
      );
      expect(implementAgentMd).toContain("model: claude-opus-4-6");
      expect(implementAgentMd).toContain("provider: anthropic");
      expect(implementAgentMd).toContain("effort: high");

      // `.pi/settings.json` preserved user theme & custom extension while replacing `.pi/extensions/trellis/index.ts`
      const piSettings = JSON.parse(
        fs.readFileSync(path.join(tempDir, ".pi", "settings.json"), "utf-8"),
      ) as { theme: string; extensions: string[] };
      expect(piSettings.theme).toBe("dark");
      expect(piSettings.extensions).toContain(
        ".pi/extensions/custom-user/index.ts",
      );
      expect(piSettings.extensions).toContain("./extensions/omtre/index.ts");
      expect(piSettings.extensions).not.toContain(
        ".pi/extensions/trellis/index.ts",
      );

      // 3. Category 2: Custom commands & skills relocated and rewritten
      const customClaudeCmd = path.join(
        tempDir,
        ".claude",
        "commands",
        "omt",
        "release-notes.md",
      );
      expect(fs.existsSync(customClaudeCmd)).toBe(true);
      expect(fs.readFileSync(customClaudeCmd, "utf-8")).toContain(
        "Read `.omtre/tasks` and run `/omt:check` with `OMTRE_ENV=prod`.",
      );

      const customCursorCmd = path.join(
        tempDir,
        ".cursor",
        "commands",
        "omt-deploy.md",
      );
      expect(fs.existsSync(customCursorCmd)).toBe(true);
      expect(fs.readFileSync(customCursorCmd, "utf-8")).toContain(
        "Run `/omtre-check` and read `.omtre/config.yaml`.",
      );

      const customSkillMd = path.join(
        tempDir,
        ".claude",
        "skills",
        "contribute",
        "SKILL.md",
      );
      expect(fs.readFileSync(customSkillMd, "utf-8")).toContain(
        "Inspect `.omtre/spec/guides/index.md` and invoke `/omt:finish-work`.",
      );

      // `trellis-conventions.md` spec file renamed to `omtre-conventions.md` and content rewritten
      const renamedSpecPath = path.join(
        tempDir,
        ".omtre",
        "spec",
        "guides",
        "omtre-conventions.md",
      );
      expect(fs.existsSync(renamedSpecPath)).toBe(true);
      expect(fs.readFileSync(renamedSpecPath, "utf-8")).toContain(
        "OMTRE_ALLOW_DIRTY",
      );

      // Historical task directory names (`10-20-trellis-legacy-audit`, `10-18-trellis-bootstrap`)
      // and `mindfold-ai/trellis` attribution link MUST be preserved!
      expect(
        fs.existsSync(
          path.join(tempDir, ".omtre", "tasks", "10-20-trellis-legacy-audit"),
        ),
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(
            tempDir,
            ".omtre",
            "tasks",
            "archive",
            "2026-10",
            "10-18-trellis-bootstrap",
          ),
        ),
      ).toBe(true);

      const renameRulesPrd = fs.readFileSync(
        path.join(tempDir, ".omtre", "tasks", "10-19-rename-rules", "prd.md"),
        "utf-8",
      );
      expect(renameRulesPrd).toContain(
        ".omtre/tasks/archive/2026-10/10-18-trellis-bootstrap/prd.md",
      );
      expect(renameRulesPrd).toContain("`10-20-trellis-legacy-audit`");
      expect(renameRulesPrd).toContain("python3 ./.omtre/scripts/task.py status");
      expect(renameRulesPrd).toContain("/omt:start");
      expect(renameRulesPrd).toContain("OMTRE_NON_INTERACTIVE=1");
      expect(renameRulesPrd).toContain("https://github.com/mindfold-ai/trellis");

      // Root `AGENTS.md` updated to `<!-- OMTRE:START --> ... <!-- OMTRE:END -->` while keeping custom header
      const agentsMd = fs.readFileSync(path.join(tempDir, "AGENTS.md"), "utf-8");
      expect(agentsMd).toContain("Custom project header.");
      expect(agentsMd).toContain("<!-- OMTRE:START -->");
      expect(agentsMd).toContain("<!-- OMTRE:END -->");
      expect(agentsMd).not.toContain("<!-- TRELLIS:START -->");

      // 4. Category 3: Runtime/cache cleaned & metadata written
      expect(fs.existsSync(path.join(tempDir, ".omtre", ".current-task"))).toBe(
        false,
      );
      expect(
        fs.existsSync(path.join(tempDir, ".omtre", ".ralph-state.json")),
      ).toBe(false);
      expect(fs.existsSync(path.join(tempDir, ".omtre", ".runtime"))).toBe(
        false,
      );
      expect(
        fs.existsSync(path.join(tempDir, ".omtre", ".backup-20261001")),
      ).toBe(false);
      expect(
        fs.existsSync(
          path.join(tempDir, ".omtre", "scripts", "__pycache__"),
        ),
      ).toBe(false);

      expect(
        fs.readFileSync(path.join(tempDir, ".omtre", ".version"), "utf-8").trim(),
      ).toBe(VERSION);

      const migratedFrom = JSON.parse(
        fs.readFileSync(path.join(tempDir, ".omtre", ".migrated-from"), "utf-8"),
      ) as {
        sourceVersion: string;
        targetVersion: string;
        migratedAt: string;
      };
      expect(migratedFrom.sourceVersion).toBe("0.6.0-beta.2");
      expect(migratedFrom.targetVersion).toBe(VERSION);
      expect(Date.parse(migratedFrom.migratedAt)).not.toBeNaN();

      const hashesPayload = JSON.parse(
        fs.readFileSync(
          path.join(tempDir, ".omtre", ".template-hashes.json"),
          "utf-8",
        ),
      ) as { __version: number; hashes: Record<string, string> };
      expect(hashesPayload.__version).toBe(2);
      expect(hashesPayload.hashes[".omtre/workflow.md"]).toMatch(
        /^[a-f0-9]{64}$/,
      );

      // 5. External references (both repo-internal out-of-scope files and global home/env) were reported and NEVER modified on disk
      expect(result.externalReferences?.items.length).toBeGreaterThanOrEqual(5);
      expect(
        result.externalReferences?.matches?.some(
          (m) =>
            m.file === "scripts/custom-ci.sh" &&
            m.line === 2 &&
            m.match === "TRELLIS_CI_MODE",
        ),
      ).toBe(true);
      expect(
        result.externalReferences?.matches?.some(
          (m) =>
            m.file === "scripts/custom-ci.sh" &&
            m.line === 3 &&
            m.match === ".trellis/",
        ),
      ).toBe(true);
      expect(fs.readFileSync(customCiScript, "utf-8")).toBe(origCustomCiContent);
      expect(fs.existsSync(globalTrellisDir)).toBe(true);
      expect(fs.readFileSync(globalClaudeMd, "utf-8")).toBe(
        origGlobalClaudeContent,
      );
      expect(fs.readFileSync(zshrcPath, "utf-8")).toBe(origZshrcContent);
    });

    it("prompts for confirmation in interactive mode and cancels cleanly if user declines", async () => {
      initGitRepo(tempDir);
      createLegacyTrellisFixture(tempDir);
      commitAll(tempDir);

      const origIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, "isTTY", {
        value: true,
        configurable: true,
      });
      const promptSpy = vi
        .spyOn(inquirer, "prompt")
        .mockResolvedValue({ proceed: false } as never);

      try {
        const res = await migrate({
          cwd: tempDir,
          homeDir: fakeHomeDir,
          env: {},
        });
        expect(res.status).toBe("cancelled");
        expect(promptSpy).toHaveBeenCalledOnce();
        expect(fs.existsSync(path.join(tempDir, ".trellis"))).toBe(true);
        expect(fs.existsSync(path.join(tempDir, ".omtre"))).toBe(false);
      } finally {
        Object.defineProperty(process.stdin, "isTTY", {
          value: origIsTTY,
          configurable: true,
        });
      }
    });

    it("exposes --dry-run, --json, -y/--yes, and --allow-dirty in omtre migrate --help", () => {
      const cliEntry = path.resolve(
        import.meta.dirname,
        "../../dist/cli/index.js",
      );
      if (!fs.existsSync(cliEntry)) return;
      const helpOutput = execFileSync(
        process.execPath,
        [cliEntry, "migrate", "--help"],
        { encoding: "utf-8" },
      );
      expect(helpOutput).toContain("--dry-run");
      expect(helpOutput).toContain("--json");
      expect(helpOutput).toContain("-y, --yes");
      expect(helpOutput).toContain("--allow-dirty");
    });
  });
});
