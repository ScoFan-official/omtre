/**
 * Integration tests for the D2 post-archive re-entry pointer:
 *
 *   The `no_task` branch of inject-workflow-state.py appends a computed
 *   `next:` line — the dependency frontier's head (common/frontier.py).
 *   cmd_archive clears the active pointer in the same call that flips
 *   status, so this branch is what the next session sees after an archive;
 *   the pointer is the re-entry.
 *
 * Cases: ready head (priority order + domain), all-blocked cycle → none-ready
 * count, empty store → no line, active session pointer → line never appears
 * (not a no_task turn), Kiro plain-text parity, and an older scripts tree
 * (common/frontier.py absent) → graceful degrade.
 *
 * The real template hook is stamped into a throwaway repo and driven through
 * its actual stdin/stdout contract — no internal mocks.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getOmtreTemplatePath } from "../../src/templates/extract.js";

const TEMPLATE_SCRIPTS = path.join(getOmtreTemplatePath(), "scripts");
const SHARED_HOOKS = path.resolve(
  __dirname,
  "../../src/templates/shared-hooks",
);

function findPython(): string | null {
  // `python3` is the CI/precedent binary; `python` covers Windows dev hosts.
  for (const bin of ["python3", "python"]) {
    try {
      execFileSync(bin, ["--version"], { stdio: "ignore" });
      return bin;
    } catch {
      // try next candidate
    }
  }
  return null;
}

const PYTHON = findPython();

function setupRepo(tmp: string): void {
  fs.mkdirSync(path.join(tmp, ".omtre", "scripts"), { recursive: true });
  fs.cpSync(TEMPLATE_SCRIPTS, path.join(tmp, ".omtre", "scripts"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(tmp, ".omtre", "workflow.md"),
    [
      "# Workflow",
      "",
      "## Phase Index",
      "",
      "[workflow-state:no_task]",
      "No active task. Classify the turn before creating an Omtre task.",
      "[/workflow-state:no_task]",
      "",
      "[workflow-state:planning]",
      "Stay in planning.",
      "[/workflow-state:planning]",
      "",
      "## Phase 1: Plan",
      "",
    ].join("\n"),
  );
}

function writeTaskFixture(
  tmp: string,
  dirName: string,
  data: Record<string, unknown> = {},
): void {
  const dir = path.join(tmp, ".omtre", "tasks", dirName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "task.json"),
    JSON.stringify(
      {
        id: dirName,
        status: "planning",
        priority: "P2",
        title: `fixture ${dirName}`,
        ...data,
      },
      null,
      2,
    ),
    "utf-8",
  );
}

function hookEnv(tmp: string, platformVar: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    OMTRE_CONTEXT_ID: "",
  };
  // A leaked host identity would pre-empt the fixture's session key or
  // platform detection — drop the keys this test can legitimately see.
  delete env.CLAUDE_PROJECT_DIR;
  delete env.KIRO_PROJECT_DIR;
  delete env.CLAUDE_CODE_SESSION_ID;
  delete env.KIRO_SESSION_ID;
  env[platformVar] = tmp;
  return env;
}

function runHook(
  tmp: string,
  platformVar = "CLAUDE_PROJECT_DIR",
  sessionId = "test-session",
): { stdout: string; stderr: string; status: number | null } {
  const r = spawnSync(
    PYTHON as string,
    [path.join(SHARED_HOOKS, "inject-workflow-state.py")],
    {
      cwd: tmp,
      encoding: "utf-8",
      input: JSON.stringify({
        hook_event_name: "UserPromptSubmit",
        cwd: tmp,
        session_id: sessionId,
        prompt: "hi",
      }),
      env: hookEnv(tmp, platformVar),
    },
  );
  return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

function breadcrumbFrom(stdout: string): string {
  const parsed = JSON.parse(stdout) as {
    hookSpecificOutput?: { additionalContext?: string };
  };
  return parsed.hookSpecificOutput?.additionalContext ?? "";
}

describe.skipIf(PYTHON === null)(
  "no_task breadcrumb next: pointer (D2)",
  () => {
    let tmp: string;

    beforeEach(() => {
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), "omtre-next-itest-"));
      setupRepo(tmp);
    });

    afterEach(() => {
      fs.rmSync(tmp, { recursive: true, force: true });
    });

    it("appends the frontier head as next: — priority order wins over dir order, domain suffix rides along", () => {
      writeTaskFixture(tmp, "01-alpha", {
        priority: "P2",
        title: "Alpha ticket",
      });
      writeTaskFixture(tmp, "99-omega", {
        priority: "P0",
        title: "Omega ticket",
        meta: { domain: "deap" },
      });

      const { stdout, status } = runHook(tmp);

      expect(status).toBe(0);
      const ctx = breadcrumbFrom(stdout);
      expect(ctx).toContain("Status: no_task");
      expect(ctx).toContain(
        "next: 99-omega/ (planning) [P0] @deap Omega ticket",
      );
    });

    it("names the first startable ticket when several are ready", () => {
      writeTaskFixture(tmp, "01-alpha", {
        priority: "P1",
        title: "Alpha ticket",
      });
      writeTaskFixture(tmp, "02-beta", {
        priority: "P2",
        title: "Beta ticket",
      });

      const ctx = breadcrumbFrom(runHook(tmp).stdout);

      expect(ctx).toContain("next: 01-alpha/ (planning) [P1] Alpha ticket");
    });

    it("reports none-ready (with blocked count) when every ticket waits on a cycle", () => {
      writeTaskFixture(tmp, "01-alpha", { blocked_by: ["02-beta"] });
      writeTaskFixture(tmp, "02-beta", { blocked_by: ["01-alpha"] });

      const ctx = breadcrumbFrom(runHook(tmp).stdout);

      expect(ctx).toContain("next: (none ready — 2 blocked)");
    });

    it("omits the line entirely when no task is active at all", () => {
      const { stdout, status } = runHook(tmp);

      expect(status).toBe(0);
      const ctx = breadcrumbFrom(stdout);
      expect(ctx).toContain("Status: no_task");
      expect(ctx).not.toContain("next:");
    });

    it("never adds the line to an active-task turn", () => {
      writeTaskFixture(tmp, "01-alpha");
      fs.mkdirSync(path.join(tmp, ".omtre", ".runtime", "sessions"), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(
          tmp,
          ".omtre",
          ".runtime",
          "sessions",
          "claude_test-session.json",
        ),
        JSON.stringify({
          current_task: ".omtre/tasks/01-alpha",
          platform: "claude",
        }),
        "utf-8",
      );

      const ctx = breadcrumbFrom(runHook(tmp).stdout);

      expect(ctx).toContain("Task: 01-alpha (planning)");
      expect(ctx).toContain("Stay in planning.");
      expect(ctx).not.toContain("next:");
    });

    it("Kiro plain-text output carries the same pointer", () => {
      writeTaskFixture(tmp, "01-alpha", {
        priority: "P1",
        title: "Alpha ticket",
      });

      const { stdout, status } = runHook(tmp, "KIRO_PROJECT_DIR");

      expect(status).toBe(0);
      expect(stdout).toContain("next: 01-alpha/ (planning) [P1] Alpha ticket");
      expect(stdout).not.toContain("hookSpecificOutput");
    });

    it("degrades to no pointer when common/frontier.py is absent (older scripts tree)", () => {
      writeTaskFixture(tmp, "01-alpha", { title: "Alpha ticket" });
      fs.rmSync(path.join(tmp, ".omtre", "scripts", "common", "frontier.py"));

      const { stdout, status } = runHook(tmp);

      expect(status).toBe(0);
      const ctx = breadcrumbFrom(stdout);
      expect(ctx).toContain("Status: no_task");
      expect(ctx).not.toContain("next:");
    });
  },
);
