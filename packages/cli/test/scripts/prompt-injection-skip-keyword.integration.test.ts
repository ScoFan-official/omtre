/**
 * Integration tests for the `no-omtre` per-turn skip keyword (issue #427).
 *
 * `shared-hooks/inject-workflow-state.py` checks the user prompt for a
 * configurable, word-boundary, case-insensitive skip keyword (default
 * "no-omtre") right after resolving `.omtre/config.yaml`, before any
 * task resolution or breadcrumb template loading. On a hit it exits 0 with
 * empty stdout for that turn only. `session-start.py` (SessionStart) and
 * `inject-subagent-context.py` (sub-agent context) must ignore the keyword
 * entirely — the escape hatch only mutes the per-turn breadcrumb.
 *
 * Scripts are stamped into a fresh temp dir and exercised through the real
 * `python3` interpreter (no mocking of file I/O or config parsing).
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

function writeConfig(tmp: string, yaml: string): void {
  fs.writeFileSync(path.join(tmp, ".omtre", "config.yaml"), yaml, "utf-8");
}

function runHook(
  tmp: string,
  script: string,
  prompt: string,
): { stdout: string; stderr: string; status: number | null } {
  const r = spawnSync("python3", [path.join(SHARED_HOOKS, script)], {
    cwd: tmp,
    encoding: "utf-8",
    input: JSON.stringify({
      hook_event_name: "userPromptSubmit",
      cwd: tmp,
      session_id: "test-session",
      prompt,
    }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: tmp },
  });
  return { stdout: r.stdout, stderr: r.stderr, status: r.status };
}

function runConfigProbe(tmp: string, code: string): string {
  const probePath = path.join(tmp, "config_probe.py");
  const script = `
import sys
sys.path.insert(0, ${JSON.stringify(path.join(tmp, ".omtre", "scripts"))})
from pathlib import Path
from common.config import get_prompt_injection_config
REPO_ROOT = Path(${JSON.stringify(tmp)})
${code}
`;
  fs.writeFileSync(probePath, script, "utf-8");
  const r = spawnSync("python3", [probePath], { cwd: tmp, encoding: "utf-8" });
  if (r.status !== 0) {
    throw new Error(`probe failed (rc=${r.status}): ${r.stderr}`);
  }
  return r.stdout;
}

const describeFn = hasPython() ? describe : describe.skip;

describeFn("no-omtre skip keyword (issue #427)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "omtre-skip-keyword-"));
    setupRepo(tmp);
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  describe("common/config.py: get_prompt_injection_config", () => {
    it("returns the default skip_keyword when config.yaml has no prompt_injection section", () => {
      writeConfig(tmp, "session_auto_commit: true\n");
      const out = runConfigProbe(
        tmp,
        "print(get_prompt_injection_config(REPO_ROOT))",
      );
      expect(out.trim()).toBe("{'skip_keyword': 'no-omtre'}");
    });

    it("returns the default skip_keyword when config.yaml is absent", () => {
      const out = runConfigProbe(
        tmp,
        "print(get_prompt_injection_config(REPO_ROOT))",
      );
      expect(out.trim()).toBe("{'skip_keyword': 'no-omtre'}");
    });

    it("applies an explicit custom skip_keyword override", () => {
      writeConfig(
        tmp,
        ["prompt_injection:", '  skip_keyword: "off-topic"'].join("\n"),
      );
      const out = runConfigProbe(
        tmp,
        "print(get_prompt_injection_config(REPO_ROOT))",
      );
      expect(out.trim()).toBe("{'skip_keyword': 'off-topic'}");
    });

    it('empty string skip_keyword disables the escape hatch and is preserved as-is', () => {
      writeConfig(
        tmp,
        ["prompt_injection:", '  skip_keyword: ""'].join("\n"),
      );
      const out = runConfigProbe(
        tmp,
        "print(get_prompt_injection_config(REPO_ROOT))",
      );
      expect(out.trim()).toBe("{'skip_keyword': ''}");
    });
  });

  describe("inject-workflow-state.py: default keyword", () => {
    it("emits empty stdout when the prompt contains 'no-omtre' as a standalone word", () => {
      const { stdout, status } = runHook(
        tmp,
        "inject-workflow-state.py",
        "no-omtre how do I write this regex",
      );
      expect(status).toBe(0);
      expect(stdout).toBe("");
    });

    it("is case-insensitive", () => {
      const { stdout, status } = runHook(
        tmp,
        "inject-workflow-state.py",
        "No-Omtre please help",
      );
      expect(status).toBe(0);
      expect(stdout).toBe("");
    });

    it("emits normal injection when the keyword is absent", () => {
      const { stdout, status } = runHook(
        tmp,
        "inject-workflow-state.py",
        "how do I write this regex",
      );
      expect(status).toBe(0);
      expect(stdout).not.toBe("");
      const parsed = JSON.parse(stdout) as {
        hookSpecificOutput?: { additionalContext?: string };
      };
      expect(parsed.hookSpecificOutput?.additionalContext).toContain(
        "<workflow-state>",
      );
    });
  });

  describe("inject-workflow-state.py: word-boundary negatives", () => {
    it("does NOT skip on 'no-omtrefoo' (suffix attached, no boundary)", () => {
      const { stdout, status } = runHook(
        tmp,
        "inject-workflow-state.py",
        "no-omtrefoo is a weird word",
      );
      expect(status).toBe(0);
      expect(stdout).not.toBe("");
    });

    it("does NOT skip on 'foo-no-omtre' (prefix attached via hyphen, no boundary)", () => {
      const { stdout, status } = runHook(
        tmp,
        "inject-workflow-state.py",
        "foo-no-omtre is also weird",
      );
      expect(status).toBe(0);
      expect(stdout).not.toBe("");
    });

    it("DOES skip on 'path/no-omtre.md' — '/' and '.' are boundaries, keyword is standalone", () => {
      const { stdout, status } = runHook(
        tmp,
        "inject-workflow-state.py",
        "look at path/no-omtre.md please",
      );
      expect(status).toBe(0);
      expect(stdout).toBe("");
    });

    it("skips when the keyword is surrounded by punctuation", () => {
      const { stdout, status } = runHook(
        tmp,
        "inject-workflow-state.py",
        "(no-omtre) skip this turn",
      );
      expect(status).toBe(0);
      expect(stdout).toBe("");
    });
  });

  describe("inject-workflow-state.py: custom keyword config", () => {
    it("makes the custom keyword trigger and the default keyword inert", () => {
      writeConfig(
        tmp,
        ["prompt_injection:", '  skip_keyword: "off-topic"'].join("\n"),
      );

      const customHit = runHook(
        tmp,
        "inject-workflow-state.py",
        "off-topic question here",
      );
      expect(customHit.status).toBe(0);
      expect(customHit.stdout).toBe("");

      const defaultInert = runHook(
        tmp,
        "inject-workflow-state.py",
        "no-omtre question here",
      );
      expect(defaultInert.status).toBe(0);
      expect(defaultInert.stdout).not.toBe("");
    });

    it("disables the escape hatch entirely with skip_keyword: \"\"", () => {
      writeConfig(
        tmp,
        ["prompt_injection:", '  skip_keyword: ""'].join("\n"),
      );

      const { stdout, status } = runHook(
        tmp,
        "inject-workflow-state.py",
        "no-omtre question here",
      );
      expect(status).toBe(0);
      expect(stdout).not.toBe("");
    });
  });

  describe("SessionStart / sub-agent injection paths ignore the keyword", () => {
    it("session-start.py still emits context when the prompt contains the skip keyword", () => {
      const r = spawnSync(
        "python3",
        [path.join(SHARED_HOOKS, "session-start.py")],
        {
          cwd: tmp,
          encoding: "utf-8",
          input: JSON.stringify({
            hook_event_name: "SessionStart",
            cwd: tmp,
            session_id: "test-session",
            prompt: "no-omtre",
          }),
          env: { ...process.env, CLAUDE_PROJECT_DIR: tmp },
        },
      );
      expect(r.status).toBe(0);
      expect(r.stdout).toContain("<session-context>");
    });

    it("inject-subagent-context.py has no skip-keyword handling (module source check)", () => {
      const source = fs.readFileSync(
        path.join(SHARED_HOOKS, "inject-subagent-context.py"),
        "utf-8",
      );
      expect(source).not.toContain("skip_keyword");
      expect(source).not.toContain("prompt_has_skip_keyword");
    });
  });
});
