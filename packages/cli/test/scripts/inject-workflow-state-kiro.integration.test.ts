/**
 * Integration test for the Kiro output branch of the shared per-turn and
 * session-start hooks.
 *
 * Kiro adds a hook's stdout directly to the conversation context (no JSON
 * envelope). `inject-workflow-state.py` and `session-start.py` therefore have
 * a `platform == "kiro"` branch that prints bare text instead of the
 * Claude-style `{"hookSpecificOutput": ...}` JSON used by every other
 * platform. This test stamps the real templates and runs the actual scripts to
 * verify the branch is plain text for Kiro and that non-Kiro platforms keep the
 * JSON envelope (isolation guard).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

function hasPython(): boolean {
  try {
    execFileSync("python3", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function setupRepo(tmp: string): void {
  fs.mkdirSync(path.join(tmp, ".omtre", "scripts"), { recursive: true });
  fs.cpSync(TEMPLATE_SCRIPTS, path.join(tmp, ".omtre", "scripts"), {
    recursive: true,
  });
  // workflow.md with a no_task breadcrumb so the body is deterministic.
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
      "## Phase 1: Plan",
      "",
    ].join("\n"),
  );
}

function runHook(
  tmp: string,
  script: string,
  platformEnvVar: string,
): { stdout: string; status: number | null } {
  const r = spawnSync(
    "python3",
    [path.join(SHARED_HOOKS, script)],
    {
      cwd: tmp,
      encoding: "utf-8",
      input: JSON.stringify({
        hook_event_name: "userPromptSubmit",
        cwd: tmp,
        session_id: "test-session",
        prompt: "hi",
      }),
      env: { ...process.env, [platformEnvVar]: tmp },
    },
  );
  return { stdout: r.stdout, status: r.status };
}

const describeFn = hasPython() ? describe : describe.skip;

describeFn("Kiro hook output branch", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "omtre-kiro-hook-"));
    setupRepo(tmp);
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("inject-workflow-state.py emits plain-text breadcrumb for Kiro", () => {
    const { stdout, status } = runHook(
      tmp,
      "inject-workflow-state.py",
      "KIRO_PROJECT_DIR",
    );
    expect(status).toBe(0);
    expect(stdout).toContain("<workflow-state>");
    expect(stdout).toContain("Status: no_task");
    // Plain text — NOT the Claude-style JSON envelope.
    expect(stdout).not.toContain("hookSpecificOutput");
    expect(stdout).not.toContain("additionalContext");
  });

  it("inject-workflow-state.py keeps JSON envelope for non-Kiro (isolation)", () => {
    const { stdout, status } = runHook(
      tmp,
      "inject-workflow-state.py",
      "CLAUDE_PROJECT_DIR",
    );
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout) as {
      hookSpecificOutput?: { additionalContext?: string };
    };
    expect(parsed.hookSpecificOutput?.additionalContext).toContain(
      "<workflow-state>",
    );
  });

  it("session-start.py emits plain-text overview for Kiro", () => {
    const { stdout, status } = runHook(
      tmp,
      "session-start.py",
      "KIRO_PROJECT_DIR",
    );
    expect(status).toBe(0);
    expect(stdout).toContain("<session-context>");
    expect(stdout).not.toContain("hookSpecificOutput");
    expect(stdout).not.toContain("additional_context");
  });

  it("session-start.py keeps JSON envelope for non-Kiro (isolation)", () => {
    const { stdout, status } = runHook(
      tmp,
      "session-start.py",
      "CLAUDE_PROJECT_DIR",
    );
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout) as {
      hookSpecificOutput?: { additionalContext?: string };
    };
    expect(parsed.hookSpecificOutput?.additionalContext).toContain(
      "<session-context>",
    );
  });
});
