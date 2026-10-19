import { describe, expect, it } from "vitest";
import {
  SHARED_HOOKS_BY_PLATFORM,
  getSharedHookScripts,
  getSharedHookScriptsForPlatform,
  type SharedHookName,
  type SharedHookPlatform,
} from "../../src/templates/shared-hooks/index.js";
import {
  collectPlatformTemplates,
  resolveCliFlag,
} from "../../src/configurators/index.js";

const ALL_HOOK_FILES = [
  "session-start.py",
  "inject-shell-session-context.py",
  "inject-workflow-state.py",
  "inject-subagent-context.py",
] as const;

const EMPTY_EXCEPT_PASS_RE = /except[^\n]*:\n\s*pass\s*$/m;

describe("shared-hooks capability table", () => {
  it("every capability-table entry names a real shared-hook file", () => {
    const realFiles = new Set(getSharedHookScripts().map((h) => h.name));
    for (const [platform, hooks] of Object.entries(
      SHARED_HOOKS_BY_PLATFORM,
    )) {
      for (const hook of hooks) {
        expect(
          realFiles.has(hook),
          `${platform} declares ${hook} but no such file exists under shared-hooks/`,
        ).toBe(true);
      }
    }
  });

  it("every shared-hook file is distributed to at least one platform", () => {
    const distributed = new Set<string>();
    for (const hooks of Object.values(SHARED_HOOKS_BY_PLATFORM)) {
      for (const h of hooks) distributed.add(h);
    }
    for (const hook of getSharedHookScripts()) {
      expect(
        distributed.has(hook.name),
        `${hook.name} exists under shared-hooks/ but no platform installs it — dead template`,
      ).toBe(true);
    }
  });

  it("statusline.py is not distributed by default", () => {
    const realFiles = new Set(getSharedHookScripts().map((h) => h.name));
    expect(realFiles.has("statusline.py")).toBe(false);
    for (const [platform, hooks] of Object.entries(
      SHARED_HOOKS_BY_PLATFORM,
    )) {
      expect(
        (hooks as readonly string[]).includes("statusline.py"),
        `${platform} must not install the generated statusline.py hook by default`,
      ).toBe(false);
    }
  });

  it("inject-subagent-context.py is restricted to platforms with native sub-agent context delivery", () => {
    // Codex uses SubagentStart.additionalContext; these remaining platforms
    // are class-2 and load their context from an agent-definition prelude.
    const class2 = new Set(["copilot", "gemini", "qoder", "trae"]);
    for (const [platform, hooks] of Object.entries(
      SHARED_HOOKS_BY_PLATFORM,
    )) {
      const has = hooks.includes("inject-subagent-context.py");
      if (class2.has(platform))
        expect(
          has,
          `${platform} is class-2 pull-based and must not ship inject-subagent-context.py`,
        ).toBe(false);
    }

    expect(SHARED_HOOKS_BY_PLATFORM.codex).toContain(
      "inject-subagent-context.py",
    );
  });

  it("codex + copilot do not take the shared session-start.py (they bundle their own)", () => {
    expect(SHARED_HOOKS_BY_PLATFORM.codex).not.toContain("session-start.py");
    expect(SHARED_HOOKS_BY_PLATFORM.copilot).not.toContain("session-start.py");
  });

  // A shared hook script only does something if the platform's own hook config
  // invokes it, and those configs are per-vendor files with different event
  // names (`beforeShellExecution`, `PreToolUse`, `BeforeTool`) that cannot be
  // derived. Both sides of this test ARE derived — from
  // SHARED_HOOKS_BY_PLATFORM and from each platform's collectTemplates() — so
  // adding platform #8 to the table without wiring its config fails the build
  // instead of silently shipping a script nothing calls. Never hard-code the
  // platform list here; that is the failure mode this test exists to prevent.
  describe("shared hooks are registered in each platform's own hook config", () => {
    function registrationsOf(
      platform: string,
      hook: SharedHookName,
    ): string[] {
      const tool = resolveCliFlag(platform);
      if (!tool) {
        throw new Error(
          `${platform} in SHARED_HOOKS_BY_PLATFORM matches no AI_TOOLS cliFlag`,
        );
      }
      const files = collectPlatformTemplates(tool);
      if (!files) {
        throw new Error(
          `${platform} collects no templates, so its hook config cannot be checked`,
        );
      }
      // Registration means a config invokes the script by path
      // (`.gemini/hooks/<hook>`), which is what distinguishes it from the
      // reference docs that merely name the file in a table. Hook configs are
      // never markdown on any platform.
      return [...files]
        .filter(
          ([filePath, content]) =>
            !filePath.endsWith(hook) &&
            !filePath.endsWith(".md") &&
            content.includes(`hooks/${hook}`),
        )
        .map(([filePath]) => filePath);
    }

    const SHELL_HOOK: SharedHookName = "inject-shell-session-context.py";

    it("every platform declaring the shell-session hook invokes it from its config", () => {
      const declaring = Object.entries(SHARED_HOOKS_BY_PLATFORM).filter(
        ([, hooks]) => hooks.includes(SHELL_HOOK),
      );
      // Cursor has shipped this since 0.5.0; an empty list means the filter
      // above silently stopped matching and every assertion below is vacuous.
      expect(declaring.length).toBeGreaterThan(0);

      for (const [platform] of declaring) {
        expect(
          registrationsOf(platform, SHELL_HOOK),
          `${platform} declares ${SHELL_HOOK} but no ${platform} config template invokes it — the script would be installed and never run`,
        ).not.toHaveLength(0);
      }
    });

    it("no platform invokes the shell-session hook without declaring it", () => {
      for (const [platform, hooks] of Object.entries(
        SHARED_HOOKS_BY_PLATFORM,
      )) {
        if (hooks.includes(SHELL_HOOK)) continue;
        expect(
          registrationsOf(platform, SHELL_HOOK),
          `${platform} invokes ${SHELL_HOOK} from its config but does not declare it — the config points at a script that is never installed`,
        ).toHaveLength(0);
      }
    });
  });

  it("kiro registers session-start, workflow-state, and subagent-context hooks", () => {
    // Kiro wires per-turn + spawn hooks on both surfaces (CLI agent
    // userPromptSubmit/agentSpawn + IDE .kiro.hook promptSubmit), so it ships
    // the same trio as other agent-capable push-based platforms.
    expect([...SHARED_HOOKS_BY_PLATFORM.kiro].sort()).toEqual(
      [
        "inject-subagent-context.py",
        "inject-workflow-state.py",
        "session-start.py",
      ].sort(),
    );
  });

  it("zcode registers session-start, workflow-state, subagent-context, and shell-session hooks", () => {
    // ZCode 3.x ships a workspace hook config (.zcode/config.json) covering
    // SessionStart + UserPromptSubmit + PreToolUse Agent/Task + PreToolUse
    // Bash. ZCode is the platform with no verified session env var name at all,
    // so the PreToolUse Bash ticket is its only route to session identity.
    expect([...SHARED_HOOKS_BY_PLATFORM.zcode].sort()).toEqual(
      [
        "inject-shell-session-context.py",
        "inject-subagent-context.py",
        "inject-workflow-state.py",
        "session-start.py",
      ].sort(),
    );
  });

  it("getSharedHookScriptsForPlatform returns exactly the declared set per platform", () => {
    for (const platform of Object.keys(
      SHARED_HOOKS_BY_PLATFORM,
    ) as SharedHookPlatform[]) {
      const names = getSharedHookScriptsForPlatform(platform)
        .map((h) => h.name)
        .sort();
      const expected = [...SHARED_HOOKS_BY_PLATFORM[platform]].sort();
      expect(names).toEqual(expected);
    }
  });

  it("shared-hooks directory only contains files enumerated by ALL_HOOK_FILES", () => {
    // Guards against a new shared hook being added without the capability
    // table being updated.
    const actual = new Set(getSharedHookScripts().map((h) => h.name));
    const expected = new Set(ALL_HOOK_FILES);
    expect(actual).toEqual(expected);
  });

  it("shared hooks do not read legacy .current-task state", () => {
    for (const hook of getSharedHookScripts()) {
      expect(
        hook.content,
        `${hook.name} must use the session-scoped active task resolver`,
      ).not.toContain(".current-task");
      expect(hook.content).not.toContain("global fallback");
    }
  });

  it("shared session-start.py injects compact task artifact guidance", () => {
    const sessionStart = getSharedHookScripts().find(
      (h) => h.name === "session-start.py",
    );
    expect(sessionStart, "session-start.py is missing from shared-hooks/").toBeDefined();
    const content = sessionStart ? sessionStart.content : "";
    expect(content).toContain("<omtre-workflow>");
    expect(content).toContain("Task context order");
    expect(content).toContain("jsonl entries -> `prd.md`");
    expect(content).toContain("Lightweight task can request start review with PRD-only");
    expect(content).toContain("complex task must add");
    expect(content).not.toContain("Status: READY");
    expect(content).not.toContain("<workflow>");
  });

  it("generated session and workflow-state hooks document fail-open exception suppression", () => {
    for (const name of ["session-start.py", "inject-workflow-state.py"]) {
      const hook = getSharedHookScripts().find((h) => h.name === name);
      expect(hook, `${name} is missing from shared-hooks/`).toBeDefined();
      const content = hook?.content ?? "";

      expect(content).not.toContain("BaseException");
      expect(content).not.toMatch(EMPTY_EXCEPT_PASS_RE);
    }
  });
});
