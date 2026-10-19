import { describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { existsSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { collectPiTemplates } from "../../src/configurators/pi.js";
import {
  getAllAgents,
  getExtensionTemplate,
  getSettingsTemplate,
} from "../../src/templates/pi/index.js";

interface AgentConfig {
  model?: string;
  thinking?: string;
  tools?: string[];
  fallbackModels: string[];
}

interface PiRunConfig {
  model?: string;
  thinking?: string;
  tools?: string[];
}

interface ContextInjectionLimits {
  max_file_bytes: number;
  max_artifact_bytes: number;
  max_total_bytes: number;
}

interface RegisteredPiTool {
  execute: (
    id: string,
    input: { agent?: string; prompt?: string },
    signal?: AbortSignal,
    onUpdate?: (result: unknown) => void,
    ctx?: {
      cwd?: string;
      model?: { provider?: string; id?: string };
      sessionManager?: { getSessionId?: () => string };
    },
  ) => Promise<{ content: { type: "text"; text: string }[] }>;
}

interface PiExtensionInternals {
  normalizeAgent: (agent: string | undefined) => string;
  isOmtreAgent: (root: string, agent: string) => boolean;
  parseAgentFM: (content: string) => AgentConfig;
  buildPiArgs: (config: PiRunConfig) => string[];
  splitModelThinking: (
    model?: string,
    fallbackThinking?: string,
  ) => { model?: string; thinking?: string };
  resolveRunCfg: (
    input: { model?: string; thinking?: string },
    agentCfg: AgentConfig,
    inheritedThinking?: string,
    inheritedModel?: string,
  ) => PiRunConfig;
  contextModelRef: (ctx?: {
    model?: { provider?: string; id?: string };
  }) => string | undefined;
  cmdHasOmtreCtx: (cmd: string) => boolean;
  shellQuote: (v: string) => string;
  omtreExtension: (pi: {
    registerTool?: (tool: unknown) => void;
    registerShortcut?: (key: string, opts: unknown) => void;
    getThinkingLevel?: () => string;
    on?: (
      event: string,
      handler: (event: unknown, ctx?: unknown) => unknown,
    ) => void;
  }) => void;
  truncateUtf8: (buf: Buffer, cap: number) => Buffer;
  readContextInjectionLimits: (repoRoot: string) => ContextInjectionLimits;
  buildContextForTest: (
    root: string,
    agent: string,
    key: string | null,
  ) => string;
  servingSessionId: () => string | null;
  currentSessionId: (ctx?: {
    sessionManager?: { getSessionId?: () => string };
  }) => string | null;
  parentSessionIdForChild: (ctx?: {
    sessionManager?: { getSessionId?: () => string };
  }) => string | null;
  buildChildEnv: (
    key?: string | null,
    parentSessionId?: string | null,
  ) => NodeJS.ProcessEnv;
}

type MaxThinkingInternals = Pick<
  PiExtensionInternals,
  "buildPiArgs" | "resolveRunCfg" | "splitModelThinking"
>;

function evaluateExtension<T>(
  source: string,
  cwd: string,
  env: NodeJS.ProcessEnv,
): T {
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const require = createRequire(import.meta.url);
  const moduleObject: { exports: Record<string, unknown> } = { exports: {} };
  const sandboxProcess = Object.create(process) as NodeJS.Process;
  const sandboxEnv = { ...process.env, ...env };
  delete sandboxEnv.OMTRE_SUBAGENT_CHILD;
  Object.defineProperty(sandboxProcess, "cwd", { value: () => cwd });
  Object.defineProperty(sandboxProcess, "env", { value: sandboxEnv });
  const sandbox = vm.createContext({
    Buffer,
    console,
    exports: moduleObject.exports,
    module: moduleObject,
    process: sandboxProcess,
    require,
  });
  vm.runInContext(compiled, sandbox);
  return moduleObject.exports as T;
}

function loadExtensionInternals(
  cwd = process.cwd(),
  env: NodeJS.ProcessEnv = {},
): PiExtensionInternals {
  const source = `${getExtensionTemplate()}

export {
  normalizeAgent,
  isOmtreAgent,
  parseAgentFM,
  buildPiArgs,
  splitModelThinking,
  resolveRunCfg,
  contextModelRef,
  cmdHasOmtreCtx,
  shellQuote,
  omtreExtension,
  truncateUtf8,
  readContextInjectionLimits,
  buildContext as buildContextForTest,
  servingSessionId,
  currentSessionId,
  parentSessionIdForChild,
  buildChildEnv,
};
`;
  return evaluateExtension<PiExtensionInternals>(source, cwd, env);
}

function loadMaxThinkingInternals(
  extensionSource: string,
): MaxThinkingInternals {
  const source = `${extensionSource}

export { buildPiArgs, resolveRunCfg, splitModelThinking };
`;
  return evaluateExtension<MaxThinkingInternals>(
    source,
    process.cwd(),
    {},
  );
}

function createMinimalOmtreRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "omtre-pi-355-"));
  mkdirSync(join(root, ".pi"), { recursive: true });
  mkdirSync(join(root, ".omtre", "scripts"), { recursive: true });
  writeFileSync(
    join(root, ".omtre", "workflow.md"),
    [
      "[workflow-state:no_task]",
      "No active task. First classify the current turn and ask for task-creation consent before creating any Omtre task.",
      "[/workflow-state:no_task]",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(root, ".omtre", "scripts", "get_context.py"),
    [
      "#!/usr/bin/env python3",
      "import sys",
      "if '--mode' in sys.argv and 'phase' in sys.argv:",
      "    print('## Phase Index\\nPhase 1: Plan')",
      "else:",
      "    print('SESSION CONTEXT\\nCurrent task: none.')",
      "",
    ].join("\n"),
  );
  return root;
}

describe("pi templates", () => {
  it("provides the three Omtre sub-agent definitions", () => {
    const agents = getAllAgents();
    expect(agents.map((agent) => agent.name).sort()).toEqual([
      "omtre-check",
      "omtre-implement",
      "omtre-research",
    ]);

    for (const agent of agents) {
      expect(agent.content).toContain(`name: ${agent.name}`);
      expect(agent.content).not.toContain("inject-subagent-context.py");
    }
  });

  it("settings no longer list a private skills root — Pi discovers shared .agents/skills/ natively (#447)", () => {
    const settings = JSON.parse(getSettingsTemplate().content) as {
      enableSkillCommands?: boolean;
      extensions?: string[];
      skills?: string[];
      prompts?: string[];
      packages?: unknown[];
    };

    expect(settings.enableSkillCommands).toBe(true);
    expect(settings.extensions).toEqual(["./extensions/omtre/index.ts"]);
    expect(settings.skills).toBeUndefined();
    expect(settings.prompts).toEqual(["./prompts"]);
    expect(settings.packages).toBeUndefined();
  });

  it("writes shared skills to .agents/skills/, not a private .pi/skills/ root (#447)", () => {
    const templates = collectPiTemplates();

    expect(
      templates.get(".agents/skills/omtre-check/SKILL.md"),
    ).toBeDefined();
    for (const key of templates.keys()) {
      expect(key.startsWith(".pi/skills/")).toBe(false);
    }
  });

  it("collects a manual omtre-start prompt for Pi fallback bootstrap", () => {
    const templates = collectPiTemplates();

    expect(templates.get(".pi/prompts/omtre-start.md")).toContain(
      "# Start Session",
    );
    expect(templates.get(".pi/prompts/omtre-continue.md")).toContain(
      "get_context.py --mode phase",
    );
    expect(templates.get(".pi/prompts/omtre-finish-work.md")).toContain(
      "finish-work",
    );
  });

  it("extension registers the omtre_subagent tool with mode+thinking schema", () => {
    const extension = getExtensionTemplate();

    // Tool name + label avoid collision with community subagent packages.
    expect(extension).toContain('name: "omtre_subagent"');
    expect(extension).toContain('label: "Omtre Subagent"');

    // Schema must declare the three dispatch modes and the thinking enum so the LLM
    // can pick a valid mode and override thinking per call.
    expect(extension).toContain(
      'enum: ["single", "parallel", "chain"]',
    );
    expect(extension).toContain(
      'enum: ["off", "minimal", "low", "medium", "high", "xhigh", "max"]',
    );

    // Dispatch protocol carries the "Active task: <path>" prefix rule.
    expect(extension).toContain("Active task:");
  });

  it("extension wires the Pi events Omtre needs for context flow", () => {
    const extension = getExtensionTemplate();

    // session_start: notify-only welcome
    expect(extension).toContain('pi.on?.("session_start"');
    // input: not used; Omtre must not rewrite submitted user text
    expect(extension).not.toContain('pi.on?.("input"');
    // before_agent_start: preserves system prompt context and persists hidden runtime context
    expect(extension).toContain('pi.on?.("before_agent_start"');
    // context: preserves the existing context-key establishment behavior only
    expect(extension).toContain('pi.on?.("context"');
    // tool_call: inject OMTRE_CONTEXT_ID into bash commands
    expect(extension).toContain('pi.on?.("tool_call"');
    // tool_result: mark failed/cancelled subagent runs as errors
    expect(extension).toContain('pi.on?.("tool_result"');
  });

  it("keeps user input clean while persisting hidden runtime context", () => {
    const root = createMinimalOmtreRoot();
    const { omtreExtension } = loadExtensionInternals(root);
    const handlers = new Map<
      string,
      (event: unknown, ctx?: unknown) => unknown
    >();

    omtreExtension({
      registerTool: vi.fn(),
      registerShortcut: vi.fn(),
      on(event, handler) {
        handlers.set(event, handler);
      },
    });

    const ctx = {
      sessionManager: { getSessionId: () => "pi-unit-355" },
      ui: { notify: vi.fn() },
    };

    expect(handlers.has("input")).toBe(false);

    const beforeAgentStart = handlers.get("before_agent_start");
    const first = beforeAgentStart?.(
      {
        type: "before_agent_start",
        prompt: "Adjust service routing",
        systemPrompt: "BASE",
        systemPromptOptions: {},
      },
      ctx,
    ) as {
      systemPrompt?: string;
      message: { customType?: string; content?: string; display?: boolean };
    };

    expect(first.systemPrompt).toContain("BASE");
    expect(first.systemPrompt).toContain(
      "Omtre compact SessionStart context",
    );
    expect(first.systemPrompt).toContain("<first-reply-notice>");
    expect(first.systemPrompt).toContain("the user's current request");
    expect(first.systemPrompt).toContain(
      "the user message that triggered this reply",
    );
    expect(first.systemPrompt).toContain("has no clear natural language");
    expect(first.systemPrompt).toContain(
      "explicitly established project communication language",
    );
    expect(first.systemPrompt).toContain("Omtre SessionStart ✓");
    expect(first.systemPrompt).toContain(
      "Continue directly with the user's request",
    );
    expect(first.systemPrompt).toContain(
      "must not alter the language used for the remainder of the response",
    );
    expect(first.systemPrompt).toContain("This notice is one-shot");
    expect(first.systemPrompt).not.toContain("say once in Chinese");
    expect(first.systemPrompt).not.toContain(
      "exactly one short Chinese sentence",
    );
    expect(first.systemPrompt).not.toContain(
      "Omtre SessionStart 已注入：workflow、当前任务状态、开发者身份、git 状态、active tasks、spec 索引已加载。",
    );
    expect(first.systemPrompt).toContain("<omtre-workflow>");
    expect(first.systemPrompt).toContain("Phase 1: Plan");
    expect(first.systemPrompt).toContain("No active Omtre task found");
    expect(first.systemPrompt).not.toContain("<workflow-state>");
    // The system prompt carries startup's session-overview snapshot.
    expect(first.systemPrompt).toContain("<session-overview>");
    expect(first.message).toEqual(
      expect.objectContaining({
        customType: "omtre-runtime-context",
        display: false,
      }),
    );
    expect("role" in first.message).toBe(false);
    expect("timestamp" in first.message).toBe(false);
    expect(first.message.content).not.toContain("BASE");
    expect(first.message.content).not.toContain(
      "Omtre compact SessionStart context",
    );
    expect(first.message.content).toContain("<workflow-state>");
    expect(first.message.content).toContain("Status: no_task");
    expect(first.message.content).toContain("<session-overview>");

    const second = beforeAgentStart?.(
      {
        type: "before_agent_start",
        prompt: "Continue",
        systemPrompt: "BASE",
        systemPromptOptions: {},
      },
      ctx,
    ) as {
      systemPrompt?: string;
      message?: { customType?: string; content?: string; display?: boolean };
    };

    // Provider prefix caches invalidate from byte 0 on any systemPrompt
    // change, so later turns must return the exact same bytes as turn one.
    expect(second.systemPrompt).toBe(first.systemPrompt);
    // Unchanged runtime context is not re-sent: the persisted message from
    // turn one is already in the session history.
    expect(second.message).toBeUndefined();
    expect(handlers.has("context")).toBe(true);
  });

  it("delivers task context changes as persisted messages, not systemPrompt churn", () => {
    const root = createMinimalOmtreRoot();
    const { omtreExtension } = loadExtensionInternals(root);
    const handlers = new Map<
      string,
      (event: unknown, ctx?: unknown) => unknown
    >();

    omtreExtension({
      registerTool: vi.fn(),
      registerShortcut: vi.fn(),
      on(event, handler) {
        handlers.set(event, handler);
      },
    });

    const ctx = {
      sessionManager: { getSessionId: () => "pi-unit-task-update" },
      ui: { notify: vi.fn() },
    };
    const beforeAgentStart = handlers.get("before_agent_start");
    const fire = () =>
      beforeAgentStart?.(
        {
          type: "before_agent_start",
          prompt: "Continue",
          systemPrompt: "BASE",
          systemPromptOptions: {},
        },
        ctx,
      ) as {
        systemPrompt?: string;
        message?: { customType?: string; content?: string; display?: boolean };
      };

    const first = fire();
    expect(first.systemPrompt).toContain("No active Omtre task found");

    // A task is created and activated mid-session.
    const taskDir = join(root, ".omtre", "tasks", "07-07-cache-fix");
    mkdirSync(taskDir, { recursive: true });
    writeFileSync(join(taskDir, "prd.md"), "# PRD\nStable prefix matters.");
    writeFileSync(
      join(taskDir, "task.json"),
      JSON.stringify({ id: "07-07-cache-fix", status: "in_progress" }),
    );
    mkdirSync(join(root, ".omtre", ".runtime", "sessions"), {
      recursive: true,
    });
    writeFileSync(
      join(root, ".omtre", ".runtime", "sessions", "pi_pi-unit-task-update.json"),
      JSON.stringify({ current_task: "tasks/07-07-cache-fix" }),
    );

    const second = fire();
    // systemPrompt keeps the turn-one snapshot byte-for-byte...
    expect(second.systemPrompt).toBe(first.systemPrompt);
    // ...and the new task context arrives as a persisted hidden message.
    expect(second.message?.customType).toBe("omtre-runtime-context");
    expect(second.message?.content).toContain("<omtre-task-context-update>");
    expect(second.message?.content).toContain("Stable prefix matters.");

    // No further changes -> nothing new to persist.
    const third = fire();
    expect(third.systemPrompt).toBe(first.systemPrompt);
    expect(third.message).toBeUndefined();
  });

  it("keeps a native Pi session isolated from a foreign context key (#512)", () => {
    const root = createMinimalOmtreRoot();
    const taskDir = join(root, ".omtre", "tasks", "foreign-task");
    const sessionsDir = join(root, ".omtre", ".runtime", "sessions");
    mkdirSync(taskDir, { recursive: true });
    mkdirSync(sessionsDir, { recursive: true });
    writeFileSync(join(taskDir, "prd.md"), "FOREIGN TASK CONTENT");
    writeFileSync(
      join(taskDir, "task.json"),
      JSON.stringify({ id: "foreign-task", status: "in_progress" }),
    );
    writeFileSync(
      join(sessionsDir, "pi_process_foreign.json"),
      JSON.stringify({ current_task: "tasks/foreign-task" }),
    );

    try {
      const { omtreExtension } = loadExtensionInternals(root, {
        OMTRE_CONTEXT_ID: "pi_process_foreign",
      });
      const handlers = new Map<
        string,
        (event: unknown, ctx?: unknown) => unknown
      >();
      omtreExtension({
        registerTool: vi.fn(),
        registerShortcut: vi.fn(),
        on(event, handler) {
          handlers.set(event, handler);
        },
      });
      const ctx = {
        sessionManager: {
          sessionId: "native-window-b",
          getSessionId(this: { sessionId: string }) {
            return this.sessionId;
          },
        },
        ui: { notify: vi.fn() },
      };

      handlers.get("session_start")?.({ type: "session_start" }, ctx);
      const bashEvent = {
        toolName: "bash",
        input: { command: "printf safe" },
      };
      handlers.get("tool_call")?.(bashEvent, ctx);
      expect(bashEvent.input.command).toBe(
        "export OMTRE_CONTEXT_ID='pi_native-window-b'; printf safe",
      );

      const collisionKeys = ["native/window", "native:window"].map(
        (sessionId) => {
          const collisionHandlers = new Map<
            string,
            (event: unknown, ctx?: unknown) => unknown
          >();
          loadExtensionInternals(root).omtreExtension({
            on(event, handler) {
              collisionHandlers.set(event, handler);
            },
          });
          const event = {
            toolName: "bash",
            input: { command: "printf collision" },
          };
          collisionHandlers.get("tool_call")?.(event, {
            sessionManager: { getSessionId: () => sessionId },
          });
          return event.input.command.match(
            /^export OMTRE_CONTEXT_ID='([^']+)'/,
          )?.[1];
        },
      );
      expect(collisionKeys[0]).toMatch(/^pi_native_window_[a-f0-9]{24}$/);
      expect(collisionKeys[1]).toMatch(/^pi_native_window_[a-f0-9]{24}$/);
      expect(collisionKeys[0]).not.toBe(collisionKeys[1]);

      const beforeAgentStart = handlers.get("before_agent_start")?.(
        { type: "before_agent_start", systemPrompt: "BASE" },
        ctx,
      ) as { systemPrompt?: string; message?: { content?: string } };
      expect(beforeAgentStart.systemPrompt).not.toContain("FOREIGN TASK CONTENT");
      expect(beforeAgentStart.message?.content).not.toContain(
        "FOREIGN TASK CONTENT",
      );

      const fallbackHandlers = new Map<
        string,
        (event: unknown, ctx?: unknown) => unknown
      >();
      loadExtensionInternals(root, {
        OMTRE_CONTEXT_ID: "pi_process_foreign",
      }).omtreExtension({
        on(event, handler) {
          fallbackHandlers.set(event, handler);
        },
      });
      const firstFallback = {
        toolName: "bash",
        input: { command: "printf one" },
      };
      const secondFallback = {
        toolName: "bash",
        input: { command: "printf two" },
      };
      fallbackHandlers.get("tool_call")?.(firstFallback);
      fallbackHandlers.get("tool_call")?.(secondFallback);
      const fallbackKey = firstFallback.input.command.match(
        /^export OMTRE_CONTEXT_ID='([^']+)'/,
      )?.[1];
      expect(fallbackKey).toMatch(/^pi_process_[a-f0-9]{24}$/);
      expect(fallbackKey).not.toBe("pi_process_foreign");
      expect(secondFallback.input.command).toContain(
        `OMTRE_CONTEXT_ID='${fallbackKey}'`,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("scopes per-session caches by resolved root when ctx.cwd changes", () => {
    const root1 = createMinimalOmtreRoot();
    const root2 = createMinimalOmtreRoot();
    const sessionsDir1 = join(root1, ".omtre", ".runtime", "sessions");
    const sessionsDir2 = join(root2, ".omtre", ".runtime", "sessions");
    const taskDir1 = join(root1, ".omtre", "tasks", "shared-task");
    const taskDir2 = join(root2, ".omtre", "tasks", "shared-task");
    mkdirSync(sessionsDir1, { recursive: true });
    mkdirSync(sessionsDir2, { recursive: true });
    mkdirSync(taskDir1, { recursive: true });
    mkdirSync(taskDir2, { recursive: true });
    writeFileSync(join(taskDir1, "prd.md"), "ROOT ONE PRD CONTENT");
    writeFileSync(join(taskDir2, "prd.md"), "ROOT TWO PRD CONTENT");
    const sessionRef = JSON.stringify({ current_task: "tasks/shared-task" });
    writeFileSync(join(sessionsDir1, "pi_shared-session.json"), sessionRef);
    writeFileSync(join(sessionsDir2, "pi_shared-session.json"), sessionRef);

    try {
      const { omtreExtension } = loadExtensionInternals();
      const handlers = new Map<
        string,
        (event: unknown, ctx?: unknown) => unknown
      >();
      omtreExtension({
        registerTool: vi.fn(),
        registerShortcut: vi.fn(),
        on(event, handler) {
          handlers.set(event, handler);
        },
      });
      const fire = (cwd: string) =>
        handlers.get("before_agent_start")?.(
          { type: "before_agent_start", systemPrompt: "BASE" },
          { cwd, sessionManager: { getSessionId: () => "shared-session" } },
        ) as { systemPrompt?: string; message?: { content?: string } };

      const first = fire(root1);
      expect(first.systemPrompt).toContain("ROOT ONE PRD CONTENT");

      // Same session key but a different session cwd must NOT reuse the
      // first project's cached startup/task context.
      const second = fire(root2);
      expect(second.systemPrompt).toContain("ROOT TWO PRD CONTENT");
      expect(second.systemPrompt).not.toContain("ROOT ONE PRD CONTENT");
    } finally {
      rmSync(root1, { recursive: true, force: true });
      rmSync(root2, { recursive: true, force: true });
    }
  });

  it("re-asserts the current root's task context when a session switches back", () => {
    const root1 = createMinimalOmtreRoot();
    const root2 = createMinimalOmtreRoot();
    const sessionsDir1 = join(root1, ".omtre", ".runtime", "sessions");
    const sessionsDir2 = join(root2, ".omtre", ".runtime", "sessions");
    const taskDir1 = join(root1, ".omtre", "tasks", "shared-task");
    const taskDir2 = join(root2, ".omtre", "tasks", "shared-task");
    mkdirSync(sessionsDir1, { recursive: true });
    mkdirSync(sessionsDir2, { recursive: true });
    mkdirSync(taskDir1, { recursive: true });
    mkdirSync(taskDir2, { recursive: true });
    writeFileSync(join(taskDir1, "prd.md"), "ROOT ONE PRD CONTENT");
    writeFileSync(join(taskDir2, "prd.md"), "ROOT TWO PRD CONTENT");
    const sessionRef = JSON.stringify({ current_task: "tasks/shared-task" });
    writeFileSync(join(sessionsDir1, "pi_shared-session.json"), sessionRef);
    writeFileSync(join(sessionsDir2, "pi_shared-session.json"), sessionRef);

    try {
      const { omtreExtension } = loadExtensionInternals();
      const handlers = new Map<
        string,
        (event: unknown, ctx?: unknown) => unknown
      >();
      omtreExtension({
        registerTool: vi.fn(),
        registerShortcut: vi.fn(),
        on(event, handler) {
          handlers.set(event, handler);
        },
      });
      const fire = (cwd: string) =>
        handlers.get("before_agent_start")?.(
          { type: "before_agent_start", systemPrompt: "BASE" },
          { cwd, sessionManager: { getSessionId: () => "shared-session" } },
        ) as { systemPrompt?: string; message?: { content?: string } };

      // A: first visit seeds the snapshot into the system prompt; the
      // persisted history carries only the runtime context.
      const a1 = fire(root1);
      expect(a1.message?.content ?? "").not.toContain(
        "<omtre-task-context-update>",
      );

      // A -> B: the switch re-asserts B's task context as a persisted
      // update (it supersedes the system-prompt context).
      const b = fire(root2);
      expect(b.message?.content).toContain("<omtre-task-context-update>");
      expect(b.message?.content).toContain("ROOT TWO PRD CONTENT");

      // B -> A with unchanged A on disk: A's task context must be re-emitted
      // so the most recent persisted update belongs to A, not B.
      const a2 = fire(root1);
      expect(a2.message?.content).toContain("<omtre-task-context-update>");
      expect(a2.message?.content).toContain("ROOT ONE PRD CONTENT");
      expect(a2.message?.content).not.toContain("ROOT TWO PRD CONTENT");
    } finally {
      rmSync(root1, { recursive: true, force: true });
      rmSync(root2, { recursive: true, force: true });
    }
  });

  it("extension tool_result handler marks failed/cancelled subagent runs as errors", () => {
    const extension = getExtensionTemplate();

    expect(extension).toContain('ev.toolName === "omtre_subagent"');
    expect(extension).toContain('r.status === "failed"');
    expect(extension).toContain('r.status === "cancelled"');
    expect(extension).toContain("isError: true");
  });

  it("normalizeAgent prefixes bare names with omtre- and leaves prefixed names alone", () => {
    const { normalizeAgent } = loadExtensionInternals();

    expect(normalizeAgent("implement")).toBe("omtre-implement");
    expect(normalizeAgent("check")).toBe("omtre-check");
    expect(normalizeAgent("omtre-research")).toBe("omtre-research");
    expect(normalizeAgent(undefined)).toBe("omtre-implement");
    expect(normalizeAgent("omtre-custom")).toBe("omtre-custom");
  });

  it("isOmtreAgent gates on a real .pi/agents/*.md definition file", () => {
    const { isOmtreAgent } = loadExtensionInternals();

    const root = mkdtempSync(join(tmpdir(), "omtre-pi-test-"));
    mkdirSync(join(root, ".pi", "agents"), { recursive: true });
    writeFileSync(
      join(root, ".pi", "agents", "omtre-implement.md"),
      "---\nname: omtre-implement\n---\n",
    );

    expect(isOmtreAgent(root, "omtre-implement")).toBe(true);
    expect(isOmtreAgent(root, "omtre-foo")).toBe(false);
    expect(existsSync(root)).toBe(true);
  });

  it("parseAgentFM reads model/thinking/fallbackModels/tools from agent frontmatter", () => {
    const { parseAgentFM } = loadExtensionInternals();

    // Mixed-case tool names in frontmatter must be normalized to lowercase:
    // Pi's built-in tools are lowercase (read, bash, edit, write, grep, find, ls)
    // and pi applies the allowlist without case normalization, so uppercase names
    // would silently fail to enable any tool.
    const cfg = parseAgentFM(`---
name: reviewer
model: anthropic/claude-sonnet-4
thinking: high
tools: Read, Write, Bash, find, Grep
fallbackModels:
  - openai/gpt-5-mini
  - "google/gemini-2.5-pro"
---
# Reviewer
`);

    expect(cfg).toEqual({
      model: "anthropic/claude-sonnet-4",
      thinking: "high",
      tools: ["read", "write", "bash", "find", "grep"],
      fallbackModels: ["openai/gpt-5-mini", "google/gemini-2.5-pro"],
    });
    // Belt-and-suspenders: no tool name survives with uppercase letters.
    expect(cfg.tools?.every((t) => t === t.toLowerCase())).toBe(true);
  });

  it("buildPiArgs maps PiRunConfig onto Pi CLI args", () => {
    const { buildPiArgs } = loadExtensionInternals();

    // model + thinking → composes "model:thinking" suffix when not already present
    expect(buildPiArgs({ model: "anthropic/claude-sonnet-4", thinking: "high" })).toEqual([
      "--mode",
      "json",
      "-p",
      "--no-session",
      "--model",
      "anthropic/claude-sonnet-4:high",
    ]);

    // model already has thinking suffix → passed through unchanged
    expect(
      buildPiArgs({ model: "anthropic/claude-sonnet-4:low", thinking: "high" }),
    ).toEqual([
      "--mode",
      "json",
      "-p",
      "--no-session",
      "--model",
      "anthropic/claude-sonnet-4:low",
    ]);

    // thinking-only (no model) → standalone --thinking flag
    expect(buildPiArgs({ thinking: "minimal" })).toEqual([
      "--mode",
      "json",
      "-p",
      "--no-session",
      "--thinking",
      "minimal",
    ]);

    // thinking=off is suppressed
    expect(buildPiArgs({ model: "gpt-5", thinking: "off" })).toEqual([
      "--mode",
      "json",
      "-p",
      "--no-session",
      "--model",
      "gpt-5",
    ]);

    // tools → --tools flag
    expect(
      buildPiArgs({ tools: ["Read", "Write", "Bash", "find", "Grep"] }),
    ).toEqual([
      "--mode",
      "json",
      "-p",
      "--no-session",
      "--tools",
      "Read,Write,Bash,find,Grep",
    ]);
  });

  it("supports max thinking for GPT-5.6 subagents (#470)", () => {
    const agentCfg: AgentConfig = {
      model: "openai/gpt-5.6-sol",
      thinking: "max",
      fallbackModels: [],
    };
    const dogfoodPath = join(
      process.cwd(),
      "..",
      "..",
      ".pi",
      "extensions",
      "omtre",
      "index.ts",
    );
    const extensionSources = existsSync(dogfoodPath)
      ? [getExtensionTemplate(), readFileSync(dogfoodPath, "utf-8")]
      : [getExtensionTemplate()];

    for (const extensionSource of extensionSources) {
      const { buildPiArgs, resolveRunCfg, splitModelThinking } =
        loadMaxThinkingInternals(extensionSource);
      const config = resolveRunCfg({}, agentCfg);

      expect(config).toEqual({
        model: "openai/gpt-5.6-sol:max",
        thinking: "max",
      });
      expect(buildPiArgs(config)).toEqual([
        "--mode",
        "json",
        "-p",
        "--no-session",
        "--model",
        "openai/gpt-5.6-sol:max",
      ]);
      expect(splitModelThinking(config.model)).toEqual({
        model: "openai/gpt-5.6-sol",
        thinking: "max",
      });
    }
  });

  it("inherits the invoking Pi model after per-call and agent defaults", () => {
    const { buildPiArgs, contextModelRef, resolveRunCfg } =
      loadExtensionInternals();

    const agentCfg: AgentConfig = {
      model: "anthropic/claude-sonnet-4",
      thinking: "high",
      tools: ["Read", "Write", "Edit", "Bash", "find", "Grep"],
      fallbackModels: [],
    };

    // Per-call model + thinking win over agent config
    expect(
      resolveRunCfg(
        { model: "openai/gpt-5", thinking: "xhigh" },
        agentCfg,
        "medium",
        "google/gemini-2.5-pro",
      ),
    ).toEqual({
      model: "openai/gpt-5:xhigh",
      thinking: "xhigh",
      tools: agentCfg.tools,
    });

    // Agent config wins over the invoking session model.
    expect(
      resolveRunCfg({}, agentCfg, "medium", "google/gemini-2.5-pro"),
    ).toEqual({
      model: "anthropic/claude-sonnet-4:high",
      thinking: "high",
      tools: agentCfg.tools,
    });

    // With no stronger model, use the provider-qualified invoking session model.
    const inheritedModel = contextModelRef({
      model: { provider: "openai-proxy", id: "gpt-5.6-sol" },
    });
    const inheritedCfg = resolveRunCfg(
      {},
      { fallbackModels: [] },
      "xhigh",
      inheritedModel,
    );
    expect(inheritedCfg).toEqual({
      model: "openai-proxy/gpt-5.6-sol:xhigh",
      thinking: "xhigh",
    });
    expect(buildPiArgs(inheritedCfg)).toEqual([
      "--mode",
      "json",
      "-p",
      "--no-session",
      "--model",
      "openai-proxy/gpt-5.6-sol:xhigh",
    ]);

    // Incomplete context preserves the previous no-model behavior.
    expect(contextModelRef()).toBeUndefined();
    expect(contextModelRef({ model: { id: "gpt-5.6-sol" } })).toBeUndefined();
  });

  it("passes the invoking Pi model to the spawned child process", async () => {
    const hostRoot = createMinimalOmtreRoot();
    const sessionRoot = createMinimalOmtreRoot();
    const agentDir = join(sessionRoot, ".pi", "agents");
    const fakeCli = join(sessionRoot, "fake-pi.cjs");
    const capturedArgs = join(sessionRoot, "child-args.json");
    const capturedCwd = join(sessionRoot, "child-cwd.txt");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(
      join(agentDir, "omtre-implement.md"),
      "---\nname: omtre-implement\n---\nImplement the task.\n",
    );
    writeFileSync(
      fakeCli,
      [
        'const { writeFileSync } = require("node:fs");',
        `writeFileSync(${JSON.stringify(capturedArgs)}, JSON.stringify(process.argv.slice(2)));`,
        `writeFileSync(${JSON.stringify(capturedCwd)}, process.cwd());`,
        'process.stdout.write(JSON.stringify({ message: { role: "assistant", content: [{ type: "text", text: "fake child ok" }] } }) + "\\n");',
        "",
      ].join("\n"),
    );

    try {
      const { omtreExtension } = loadExtensionInternals(hostRoot, {
        OMTRE_PI_CLI_JS: fakeCli,
      });
      let registeredTool: RegisteredPiTool | undefined;
      omtreExtension({
        registerTool(tool) {
          registeredTool = tool as RegisteredPiTool;
        },
        getThinkingLevel: () => "xhigh",
      });
      expect(registeredTool).toBeDefined();
      if (!registeredTool)
        throw new Error("omtre_subagent was not registered");

      const result = await registeredTool.execute(
        "model-inheritance-test",
        { agent: "omtre-implement", prompt: "Implement the task" },
        undefined,
        undefined,
        {
          cwd: sessionRoot,
          model: { provider: "openai-proxy", id: "gpt-5.6-sol" },
        },
      );

      expect(result.content[0]?.text).toBe("fake child ok");
      expect(realpathSync(readFileSync(capturedCwd, "utf-8"))).toBe(
        realpathSync(sessionRoot),
      );
      expect(JSON.parse(readFileSync(capturedArgs, "utf-8"))).toEqual([
        "--mode",
        "json",
        "-p",
        "--no-session",
        "--model",
        "openai-proxy/gpt-5.6-sol:xhigh",
      ]);
    } finally {
      rmSync(hostRoot, { recursive: true, force: true });
      rmSync(sessionRoot, { recursive: true, force: true });
    }
  });

  it("cmdHasOmtreCtx detects already-prefixed bash commands", () => {
    const { cmdHasOmtreCtx } = loadExtensionInternals();

    expect(cmdHasOmtreCtx("export OMTRE_CONTEXT_ID=foo; ls")).toBe(true);
    expect(cmdHasOmtreCtx("OMTRE_CONTEXT_ID=foo ls")).toBe(true);
    expect(cmdHasOmtreCtx("env OMTRE_CONTEXT_ID=foo ls")).toBe(true);
    expect(cmdHasOmtreCtx("ls -la")).toBe(false);
    expect(cmdHasOmtreCtx("")).toBe(false);
  });

  describe("permission-forwarding parent session (#610)", () => {
  function writeHeartbeat(
    sessionDir: string,
    sessionId: string,
    pid: number,
    updatedAt: number,
    fileName?: string,
  ): void {
    const dir = join(sessionDir, "permission-forwarding", "serving");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, fileName ?? `${encodeURIComponent(sessionId)}.json`),
      JSON.stringify({ sessionId, pid, updatedAt }),
    );
  }

  it("prefers the serving heartbeat id over a live ctx id and stale PI_SESSION_ID", () => {
    const sessionDir = mkdtempSync(join(tmpdir(), "omtre-pi-610-serving-"));
    writeHeartbeat(sessionDir, "serving-session", process.pid, 200);
    writeHeartbeat(sessionDir, "older-serving", process.pid, 100, "older.json");
    writeHeartbeat(sessionDir, "other-process", process.pid + 1, 999);

    try {
      const { servingSessionId, parentSessionIdForChild, currentSessionId } =
        loadExtensionInternals(process.cwd(), {
          PI_CODING_AGENT_SESSION_DIR: sessionDir,
          PI_SESSION_ID: "stale-env-id",
        });

      expect(servingSessionId()).toBe("serving-session");
      expect(
        currentSessionId({
          sessionManager: { getSessionId: () => "live-forked-id" },
        }),
      ).toBe("live-forked-id");
      expect(
        parentSessionIdForChild({
          sessionManager: { getSessionId: () => "live-forked-id" },
        }),
      ).toBe("serving-session");
    } finally {
      rmSync(sessionDir, { recursive: true, force: true });
    }
  });

  it("falls back to ctx then env when no serving heartbeat exists", () => {
    const sessionDir = mkdtempSync(join(tmpdir(), "omtre-pi-610-fallback-"));

    try {
      const withCtx = loadExtensionInternals(process.cwd(), {
        PI_CODING_AGENT_SESSION_DIR: sessionDir,
        PI_SESSION_ID: "stale-env-id",
      });
      expect(
        withCtx.parentSessionIdForChild({
          sessionManager: { getSessionId: () => "ctx-session" },
        }),
      ).toBe("ctx-session");

      const envOnly = loadExtensionInternals(process.cwd(), {
        PI_CODING_AGENT_SESSION_DIR: sessionDir,
        PI_SESSION_ID: "stale-env-id",
      });
      expect(envOnly.parentSessionIdForChild()).toBe("stale-env-id");
    } finally {
      rmSync(sessionDir, { recursive: true, force: true });
    }
  });

  it("strips inherited PI_SESSION_ID and always marks the child as a subagent", () => {
    const { buildChildEnv } = loadExtensionInternals(process.cwd(), {
      PI_SESSION_ID: "parent-session",
      PI_SESSIONID: "parent-session-alt",
      PATH: "/usr/bin",
    });

    const withParent = buildChildEnv("pi_ctx", "serving-session");
    expect(withParent.OMTRE_SUBAGENT_CHILD).toBe("1");
    expect(withParent.PI_SUBAGENT_CHILD).toBe("1");
    expect(withParent.OMTRE_CONTEXT_ID).toBe("pi_ctx");
    expect(withParent.PI_SUBAGENT_PARENT_SESSION).toBe("serving-session");
    expect(withParent.PI_SESSION_ID).toBeUndefined();
    expect(withParent.PI_SESSIONID).toBeUndefined();

    const noParent = buildChildEnv(null, null);
    expect(noParent.PI_SUBAGENT_CHILD).toBe("1");
    expect(noParent.PI_SUBAGENT_PARENT_SESSION).toBeUndefined();
    expect(noParent.OMTRE_CONTEXT_ID).toBeUndefined();
  });

  it("injects serving parent env into the spawned headless pi process", async () => {
    const hostRoot = createMinimalOmtreRoot();
    const sessionRoot = createMinimalOmtreRoot();
    const sessionDir = mkdtempSync(join(tmpdir(), "omtre-pi-610-spawn-"));
    const agentDir = join(sessionRoot, ".pi", "agents");
    const fakeCli = join(sessionRoot, "fake-pi.cjs");
    const capturedEnv = join(sessionRoot, "child-env.json");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(
      join(agentDir, "omtre-implement.md"),
      "---\nname: omtre-implement\n---\nImplement the task.\n",
    );
    writeHeartbeat(sessionDir, "serving-heartbeat-id", process.pid, Date.now());
    writeFileSync(
      fakeCli,
      [
        'const { writeFileSync } = require("node:fs");',
        `writeFileSync(${JSON.stringify(capturedEnv)}, JSON.stringify({`,
        "  PI_SUBAGENT_CHILD: process.env.PI_SUBAGENT_CHILD,",
        "  PI_SUBAGENT_PARENT_SESSION: process.env.PI_SUBAGENT_PARENT_SESSION,",
        "  OMTRE_SUBAGENT_CHILD: process.env.OMTRE_SUBAGENT_CHILD,",
        "  PI_SESSION_ID: process.env.PI_SESSION_ID ?? null,",
        "  PI_SESSIONID: process.env.PI_SESSIONID ?? null,",
        "}));",
        'process.stdout.write(JSON.stringify({ message: { role: "assistant", content: [{ type: "text", text: "fake child ok" }] } }) + "\\n");',
        "",
      ].join("\n"),
    );

    try {
      const { omtreExtension } = loadExtensionInternals(hostRoot, {
        OMTRE_PI_CLI_JS: fakeCli,
        PI_CODING_AGENT_SESSION_DIR: sessionDir,
        PI_SESSION_ID: "stale-parent-id",
      });
      let registeredTool: RegisteredPiTool | undefined;
      omtreExtension({
        registerTool(tool) {
          registeredTool = tool as RegisteredPiTool;
        },
        getThinkingLevel: () => "low",
      });
      expect(registeredTool).toBeDefined();
      if (!registeredTool)
        throw new Error("omtre_subagent was not registered");

      const result = await registeredTool.execute(
        "permission-forward-test",
        { agent: "omtre-implement", prompt: "Implement the task" },
        undefined,
        undefined,
        {
          cwd: sessionRoot,
          sessionManager: { getSessionId: () => "live-forked-id" },
        },
      );

      expect(result.content[0]?.text).toBe("fake child ok");
      expect(JSON.parse(readFileSync(capturedEnv, "utf-8"))).toEqual({
        PI_SUBAGENT_CHILD: "1",
        PI_SUBAGENT_PARENT_SESSION: "serving-heartbeat-id",
        OMTRE_SUBAGENT_CHILD: "1",
        PI_SESSION_ID: null,
        PI_SESSIONID: null,
      });
    } finally {
      rmSync(hostRoot, { recursive: true, force: true });
      rmSync(sessionRoot, { recursive: true, force: true });
      rmSync(sessionDir, { recursive: true, force: true });
    }
  });
});

  it("shellQuote single-quotes values and escapes embedded single quotes", () => {
    const { shellQuote } = loadExtensionInternals();

    expect(shellQuote("simple")).toBe("'simple'");
    expect(shellQuote("with space")).toBe("'with space'");
    expect(shellQuote("with 'quote'")).toBe("'with '\\''quote'\\'''");
  });

  it("extension forwards OMTRE_CONTEXT_ID into spawned Pi child env", () => {
    const extension = getExtensionTemplate();

    // The child pi process must inherit OMTRE_CONTEXT_ID so sub-agent
    // task.py current resolves to the same task.
    expect(extension).toContain("OMTRE_CONTEXT_ID:");
    expect(extension).toContain("...process.env");
  });

  it("forwards permission asks to the serving parent session (#610)", () => {
    const dogfoodPath = join(
      process.cwd(),
      "..",
      "..",
      ".pi",
      "extensions",
      "omtre",
      "index.ts",
    );
    const extensions = existsSync(dogfoodPath)
      ? [getExtensionTemplate(), readFileSync(dogfoodPath, "utf-8")]
      : [getExtensionTemplate()];

    for (const extension of extensions) {
      expect(extension).toContain("PI_SUBAGENT_PARENT_SESSION");
      expect(extension).toContain('PI_SUBAGENT_CHILD: "1"');
      expect(extension).toContain("delete childEnv.PI_SESSION_ID");
      expect(extension).toContain("delete childEnv.PI_SESSIONID");
      expect(extension).toContain("permission-forwarding");
      expect(extension).toContain("servingSessionId()");
    }
  });

  it("extension validates agent definition before spawning a child pi process", () => {
    const extension = getExtensionTemplate();

    // Non-Omtre agent calls must short-circuit and point users to community
    // subagent packages instead of silently spawning a child pi process with
    // a missing agent definition.
    expect(extension).toContain("isOmtreAgent(root, agentName)");
    expect(extension).toContain("npm:@tintinweb/pi-subagents");
    expect(extension).toContain("npm:pi-subagents");
  });
});

describe("pi extension: context injection limits (issue #441)", () => {
  const SESSION_KEY = "ctxlimit-session";

  function createRoot(): string {
    const root = mkdtempSync(join(tmpdir(), "omtre-pi-ctxlimit-"));
    mkdirSync(join(root, ".pi", "agents"), { recursive: true });
    writeFileSync(
      join(root, ".pi", "agents", "omtre-implement.md"),
      "---\nname: omtre-implement\n---\n# Implement\n",
    );
    return root;
  }

  function activateTask(root: string, taskDirName: string): string {
    const taskDir = join(root, ".omtre", "tasks", taskDirName);
    mkdirSync(taskDir, { recursive: true });
    mkdirSync(join(root, ".omtre", ".runtime", "sessions"), {
      recursive: true,
    });
    writeFileSync(
      join(root, ".omtre", ".runtime", "sessions", `${SESSION_KEY}.json`),
      JSON.stringify({ current_task: `tasks/${taskDirName}` }),
    );
    return taskDir;
  }

  function writeConfig(root: string, yaml: string): void {
    writeFileSync(join(root, ".omtre", "config.yaml"), yaml, "utf-8");
  }

  describe("truncateUtf8", () => {
    it("leaves data untouched when cap is 0 (unlimited)", () => {
      const { truncateUtf8 } = loadExtensionInternals();
      const data = Buffer.from("X".repeat(1000));
      expect(truncateUtf8(data, 0)).toEqual(data);
    });

    it("leaves data untouched when data is at or under the cap", () => {
      const { truncateUtf8 } = loadExtensionInternals();
      const data = Buffer.from("hello world");
      expect(truncateUtf8(data, data.length)).toEqual(data);
      expect(truncateUtf8(data, data.length + 5)).toEqual(data);
    });

    it("truncates ASCII data exactly at the cap (1 byte over cap)", () => {
      const { truncateUtf8 } = loadExtensionInternals();
      const data = Buffer.from("abcdefghij"); // 10 bytes
      expect(truncateUtf8(data, 9)).toEqual(Buffer.from("abcdefghi"));
    });

    it("never splits a 2-byte UTF-8 sequence at the boundary (café)", () => {
      const { truncateUtf8 } = loadExtensionInternals();
      const data = Buffer.from("café", "utf-8");
      for (let cap = 0; cap <= data.length; cap++) {
        const out = truncateUtf8(data, cap);
        expect(() => {
          // Buffer#toString silently replaces invalid sequences with U+FFFD;
          // assert no replacement char appears instead of throwing.
          const decoded = out.toString("utf-8");
          if (decoded.includes("�")) throw new Error("invalid utf-8");
        }).not.toThrow();
      }
      expect(truncateUtf8(data, 4).toString("utf-8")).toBe("caf");
    });

    it("never splits a 3-byte UTF-8 sequence at the boundary (euro sign)", () => {
      const { truncateUtf8 } = loadExtensionInternals();
      const data = Buffer.from("x€", "utf-8"); // x + 3-byte euro sign
      for (let cap = 0; cap <= data.length; cap++) {
        const out = truncateUtf8(data, cap);
        expect(out.toString("utf-8")).not.toContain("�");
      }
    });
  });

  describe("readContextInjectionLimits", () => {
    it("returns built-in defaults when config.yaml has no context_injection section", () => {
      const root = createRoot();
      mkdirSync(join(root, ".omtre"), { recursive: true });
      writeConfig(root, "session_auto_commit: true\n");
      const { readContextInjectionLimits } = loadExtensionInternals();
      expect(readContextInjectionLimits(root)).toEqual({
        max_file_bytes: 32768,
        max_artifact_bytes: 65536,
        max_total_bytes: 131072,
      });
    });

    it("returns built-in defaults when config.yaml is absent", () => {
      const root = createRoot();
      const { readContextInjectionLimits } = loadExtensionInternals();
      expect(readContextInjectionLimits(root)).toEqual({
        max_file_bytes: 32768,
        max_artifact_bytes: 65536,
        max_total_bytes: 131072,
      });
    });

    it("applies explicit overrides for all three keys", () => {
      const root = createRoot();
      mkdirSync(join(root, ".omtre"), { recursive: true });
      writeConfig(
        root,
        [
          "context_injection:",
          "  max_file_bytes: 100",
          "  max_artifact_bytes: 200",
          "  max_total_bytes: 300",
        ].join("\n"),
      );
      const { readContextInjectionLimits } = loadExtensionInternals();
      expect(readContextInjectionLimits(root)).toEqual({
        max_file_bytes: 100,
        max_artifact_bytes: 200,
        max_total_bytes: 300,
      });
    });

    it("0 means unlimited and is preserved as-is (not replaced by default)", () => {
      const root = createRoot();
      mkdirSync(join(root, ".omtre"), { recursive: true });
      writeConfig(
        root,
        ["context_injection:", "  max_total_bytes: 0"].join("\n"),
      );
      const { readContextInjectionLimits } = loadExtensionInternals();
      expect(readContextInjectionLimits(root).max_total_bytes).toBe(0);
    });

    it("falls back to default for a negative value", () => {
      const root = createRoot();
      mkdirSync(join(root, ".omtre"), { recursive: true });
      writeConfig(
        root,
        ["context_injection:", "  max_file_bytes: -5"].join("\n"),
      );
      const { readContextInjectionLimits } = loadExtensionInternals();
      expect(readContextInjectionLimits(root).max_file_bytes).toBe(32768);
    });

    it("falls back to default for a non-integer value", () => {
      const root = createRoot();
      mkdirSync(join(root, ".omtre"), { recursive: true });
      writeConfig(
        root,
        ["context_injection:", "  max_artifact_bytes: not-a-number"].join(
          "\n",
        ),
      );
      const { readContextInjectionLimits } = loadExtensionInternals();
      expect(readContextInjectionLimits(root).max_artifact_bytes).toBe(65536);
    });
  });

  describe("buildContext: per-file and per-artifact caps", () => {
    it("under-cap content is inlined with no truncation/index notices (golden)", () => {
      const root = createRoot();
      const taskDir = activateTask(root, "task-golden");
      writeFileSync(join(root, "small.md"), "small spec content\n", "utf-8");
      writeFileSync(
        join(taskDir, "implement.jsonl"),
        JSON.stringify({ file: "small.md", reason: "r" }) + "\n",
        "utf-8",
      );
      writeFileSync(join(taskDir, "prd.md"), "prd body\n", "utf-8");
      const { buildContextForTest } = loadExtensionInternals();
      const out = buildContextForTest(root, "omtre-implement", SESSION_KEY);
      expect(out).toContain("=== small.md ===\nsmall spec content");
      expect(out).toContain("prd body");
      expect(out).not.toContain("[Omtre: truncated");
      expect(out).not.toContain("[Omtre: not inlined");
    });

    it("keeps binary jsonl references as notices even when limits are unlimited", () => {
      const root = createRoot();
      const taskDir = activateTask(root, "task-binary-reference");
      const binary = Buffer.from([
        0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x41, 0x42,
      ]);
      writeFileSync(join(root, "design.png"), binary);
      writeFileSync(join(root, "invalid.bin"), Buffer.from([0xff, 0xfe, 0xfd]));
      writeFileSync(
        join(taskDir, "implement.jsonl"),
        [
          JSON.stringify({ file: "design.png", reason: "visual baseline" }),
          JSON.stringify({ file: "invalid.bin", reason: "legacy export" }),
        ].join("\n") + "\n",
        "utf-8",
      );
      writeConfig(
        root,
        [
          "context_injection:",
          "  max_file_bytes: 0",
          "  max_total_bytes: 0",
        ].join("\n"),
      );

      const { buildContextForTest } = loadExtensionInternals();
      const out = buildContextForTest(root, "omtre-implement", SESSION_KEY);

      expect(out).toContain(
        "[Omtre: not inlined (binary file) — design.png (10 bytes): visual baseline]",
      );
      expect(out).toContain(
        "[Omtre: not inlined (binary file) — invalid.bin (3 bytes): legacy export]",
      );
      expect(out).not.toContain("=== design.png ===");
      expect(out).not.toContain("=== invalid.bin ===");
      expect(out).not.toContain("\u0000");
      expect(out).not.toContain("�");
    });

    it("does not misclassify legitimate multi-byte UTF-8 content as binary", () => {
      const root = createRoot();
      const taskDir = activateTask(root, "task-utf8-not-binary");
      const multiByteContent =
        "emoji: 🎉🚀 cjk: 中文测试 bmp: café naïve\n";
      writeFileSync(join(root, "multibyte.md"), multiByteContent, "utf-8");
      writeFileSync(
        join(taskDir, "implement.jsonl"),
        JSON.stringify({ file: "multibyte.md", reason: "unicode spec" }) +
          "\n",
        "utf-8",
      );
      writeConfig(root, "");

      const { buildContextForTest } = loadExtensionInternals();
      const out = buildContextForTest(root, "omtre-implement", SESSION_KEY);

      expect(out).toContain(`=== multibyte.md ===\n${multiByteContent}`);
      expect(out).not.toContain("[Omtre: not inlined (binary file)");
    });

    it("classifies a file as binary when binary bytes appear only at the end", () => {
      const root = createRoot();
      const taskDir = activateTask(root, "task-text-head-binary-tail");
      const mixed = Buffer.concat([
        Buffer.from("looks like a normal text file up front\n", "utf-8"),
        Buffer.from([0x00, 0xff, 0xfe]),
      ]);
      writeFileSync(join(root, "mixed.dat"), mixed);
      writeFileSync(
        join(taskDir, "implement.jsonl"),
        JSON.stringify({ file: "mixed.dat", reason: "mixed content" }) + "\n",
        "utf-8",
      );
      writeConfig(root, "");

      const { buildContextForTest } = loadExtensionInternals();
      const out = buildContextForTest(root, "omtre-implement", SESSION_KEY);

      expect(out).toContain(
        `[Omtre: not inlined (binary file) — mixed.dat (${mixed.length} bytes): mixed content]`,
      );
      expect(out).not.toContain("=== mixed.dat ===");
    });

    it("truncates an oversized jsonl-referenced file at max_file_bytes with a notice", () => {
      const root = createRoot();
      const taskDir = activateTask(root, "task-oversize");
      writeFileSync(join(root, "big.txt"), "A".repeat(2 * 1024 * 1024), "utf-8");
      writeFileSync(
        join(taskDir, "implement.jsonl"),
        JSON.stringify({ file: "big.txt", reason: "big" }) + "\n",
        "utf-8",
      );
      const { buildContextForTest } = loadExtensionInternals();
      const out = buildContextForTest(root, "omtre-implement", SESSION_KEY);
      expect(Buffer.byteLength(out, "utf-8")).toBeLessThanOrEqual(
        128 * 1024 + 1024,
      );
      expect(out).toContain(
        "[Omtre: truncated at 32768 bytes — read big.txt for the full content]",
      );
    });

    it("degrades to an index line once the total budget is exhausted (3 files)", () => {
      const root = createRoot();
      const taskDir = activateTask(root, "task-total-cap");
      writeFileSync(join(root, "f1.txt"), "1".repeat(50), "utf-8");
      writeFileSync(join(root, "f2.txt"), "2".repeat(50), "utf-8");
      writeFileSync(join(root, "f3.txt"), "3".repeat(50), "utf-8");
      writeFileSync(
        join(taskDir, "implement.jsonl"),
        [
          JSON.stringify({ file: "f1.txt", reason: "first" }),
          JSON.stringify({ file: "f2.txt", reason: "second" }),
          JSON.stringify({ file: "f3.txt", reason: "third" }),
        ].join("\n") + "\n",
        "utf-8",
      );
      mkdirSync(join(root, ".omtre"), { recursive: true });
      writeConfig(
        root,
        [
          "context_injection:",
          "  max_file_bytes: 0",
          "  max_artifact_bytes: 0",
          "  max_total_bytes: 120", // fits f1 fully, degrades f2/f3
        ].join("\n"),
      );
      const { buildContextForTest } = loadExtensionInternals();
      const out = buildContextForTest(root, "omtre-implement", SESSION_KEY);
      expect(out).toContain("=== f1.txt ===\n" + "1".repeat(50));
      expect(out).toContain(
        "[Omtre: not inlined (total context limit reached) — f2.txt (50 bytes): second]",
      );
      expect(out).toContain(
        "[Omtre: not inlined (total context limit reached) — f3.txt (50 bytes): third]",
      );
      expect(out).not.toContain("=== f2.txt ===");
      expect(out).not.toContain("=== f3.txt ===");
    });

    it("max_total_bytes: 0 restores fully unlimited inlining", () => {
      const root = createRoot();
      const taskDir = activateTask(root, "task-unlimited-total");
      const bigContent = "Z".repeat(5000);
      writeFileSync(join(root, "big.txt"), bigContent, "utf-8");
      writeFileSync(
        join(taskDir, "implement.jsonl"),
        JSON.stringify({ file: "big.txt", reason: "big" }) + "\n",
        "utf-8",
      );
      mkdirSync(join(root, ".omtre"), { recursive: true });
      writeConfig(
        root,
        [
          "context_injection:",
          "  max_file_bytes: 0",
          "  max_total_bytes: 0",
        ].join("\n"),
      );
      const { buildContextForTest } = loadExtensionInternals();
      const out = buildContextForTest(root, "omtre-implement", SESSION_KEY);
      expect(out).toContain("=== big.txt ===\n" + bigContent);
      expect(out).not.toContain("[Omtre: not inlined");
    });

    it("artifacts (prd/design/implement.md) obey max_artifact_bytes independently of max_file_bytes", () => {
      const root = createRoot();
      const taskDir = activateTask(root, "task-artifact-cap");
      writeFileSync(join(taskDir, "prd.md"), "P".repeat(1000), "utf-8");
      mkdirSync(join(root, ".omtre"), { recursive: true });
      writeConfig(
        root,
        [
          "context_injection:",
          "  max_file_bytes: 0",
          "  max_artifact_bytes: 20",
          "  max_total_bytes: 0",
        ].join("\n"),
      );
      const { buildContextForTest } = loadExtensionInternals();
      const out = buildContextForTest(root, "omtre-implement", SESSION_KEY);
      const relTaskDir = "tasks/task-artifact-cap".replace(
        "tasks/",
        ".omtre/tasks/",
      );
      expect(out).toContain("P".repeat(20));
      expect(out).not.toContain("P".repeat(21));
      expect(out).toContain(
        `[Omtre: truncated at 20 bytes — read ${relTaskDir}/prd.md for the full content]`,
      );
    });
  });
});
