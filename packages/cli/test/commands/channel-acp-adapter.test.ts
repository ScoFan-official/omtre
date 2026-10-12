import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { loadAgent } from "../../src/commands/channel/agent-loader.js";
import {
  acpHandshake,
  buildAcpArgs,
  createAcpCtx,
  encodeAcpUserMessage,
  encodeAcpInterruptMessage,
  isAcpReady,
  listAcpTargets,
  parseAcpLine,
  pickAcpPermissionOption,
  resolveAcpCommand,
  resolveAcpTarget,
  substituteAcpArgs,
  type AcpCtx,
} from "../../src/commands/channel/adapters/acp.js";
import { getAdapter, isProvider, listProviders } from "../../src/commands/channel/adapters/index.js";

function parse(
  line: Record<string, unknown> | string,
  ctx: AcpCtx,
): ReturnType<typeof parseAcpLine> {
  return parseAcpLine(typeof line === "string" ? line : JSON.stringify(line), ctx);
}

function firstReply(r: ReturnType<typeof parseAcpLine>): Record<string, unknown> {
  const s = r.side?.reply?.[0];
  if (!s) throw new Error("expected a reply line");
  return JSON.parse(s) as Record<string, unknown>;
}

const SESSION = "01a12d8b-d470-7782-a73b-dc2c3a0e084a";

/** session/update notification shaped like raw-codex-auto.log entries. */
function sessionUpdate(update: Record<string, unknown>): string {
  return JSON.stringify({
    jsonrpc: "2.0",
    method: "session/update",
    params: { sessionId: SESSION, update },
  });
}

function seedSession(ctx: AcpCtx, id = SESSION): void {
  ctx.pending.set(2, "session/new");
  parse(
    {
      id: 2,
      result: {
        sessionId: id,
        configOptions: [
          {
            id: "model",
            name: "Model",
            category: "model",
            type: "select",
            currentValue: "grok-4.7",
            options: [{ value: "grok-4.7", name: "Grok 4.7" }],
          },
          {
            id: "reasoning_effort",
            name: "Reasoning Effort",
            category: "thought_level",
            type: "select",
            currentValue: "high",
            options: [{ value: "high" }, { value: "low" }],
          },
        ],
      },
    },
    ctx,
  );
}

describe("ACP target registry", () => {
  it("exposes grok-build, codex, and claude targets", () => {
    expect(listAcpTargets().sort()).toEqual(["claude", "codex", "grok-build"]);
  });

  it("resolves grok-build to `grok agent stdio`", () => {
    const t = resolveAcpTarget({ target: "grok-build" });
    expect(t.id).toBe("grok-build");
    expect(t.command).toMatch(/grok/);
    expect(t.args).toEqual(["agent", "stdio"]);
    expect(t.modelOptionId).toBe("model");
    expect(t.effortOptionId).toBe("reasoning_effort");
  });

  it("applies the codex unattended env preset", () => {
    const t = resolveAcpTarget({ target: "codex" });
    expect(t.env.INITIAL_AGENT_MODE).toBe("agent-full-access");
  });

  it("claude target sets bypassPermissions as a post-session config", () => {
    const t = resolveAcpTarget({ target: "claude" });
    expect(t.postSessionConfig).toEqual([
      { configId: "mode", value: "bypassPermissions" },
    ]);
    expect(t.effortOptionId).toBe("effort");
  });

  it("windows variants exist for every shipped target", () => {
    for (const id of listAcpTargets()) {
      const t = resolveAcpTarget({ target: id });
      expect(t.windows ?? t.command).toBeTruthy();
    }
  });

  it("honors card-level command/args overrides", () => {
    const t = resolveAcpTarget({
      target: "grok-build",
      command: "/custom/grok",
      args: ["run", "--flag"],
    });
    expect(t.command).toBe("/custom/grok");
    expect(t.args).toEqual(["run", "--flag"]);
  });

  it("rejects an unknown target with the registered list in the error", () => {
    expect(() => resolveAcpTarget({ target: "bogus" })).toThrow(
      /Unknown acp_target 'bogus'.*grok-build.*codex.*claude/s,
    );
  });

  it("rejects a missing target (provider acp requires acp_target)", () => {
    expect(() => resolveAcpTarget({})).toThrow(/requires an acp_target/);
  });

  it("uses the windows override on win32", () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("win32");
    try {
      const t = resolveAcpTarget({ target: "grok-build" });
      expect(t.command).toBe("C:\\Users\\ScoFan\\.grok\\bin\\grok.exe");
    } finally {
      vi.restoreAllMocks();
    }
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ACP arg substitution", () => {
  it("drops a flag/value pair when the placeholder is undefined", () => {
    expect(
      substituteAcpArgs(["agent", "stdio", "-m", "{model}", "{cwd}"], {
        model: undefined,
        cwd: "/tmp/x",
      }),
    ).toEqual(["agent", "stdio", "/tmp/x"]);
  });

  it("substitutes values for defined placeholders", () => {
    expect(
      substituteAcpArgs(["-m", "{model}", "--effort={effort}"], {
        model: "gpt-5.6-sol",
        effort: "high",
      }),
    ).toEqual(["-m", "gpt-5.6-sol", "--effort=high"]);
  });

  it("drops an inline arg when its placeholder is undefined", () => {
    expect(
      substituteAcpArgs(["--effort={effort}", "--model", "{model}"], {
        effort: undefined,
        model: "grok-4.7",
      }),
    ).toEqual(["--model", "grok-4.7"]);
  });

  it("buildAcpArgs returns the target's argv (no placeholders by default)", () => {
    expect(
      buildAcpArgs({ acpTarget: "grok-build", model: "x", cwd: "/w" }),
    ).toEqual(["agent", "stdio"]);
  });

  it("resolveAcpCommand returns the target command", () => {
    expect(resolveAcpCommand({ acpTarget: "codex" })).toBeTruthy();
    expect(() => resolveAcpCommand({})).toThrow(/acp_target/);
  });
});

describe("ACP parse — session acquisition", () => {
  it("session/new response persists the session id and captures configOptions", () => {
    const ctx = createAcpCtx();
    ctx.pending.set(2, "session/new");
    const r = parse(
      { id: 2, result: { sessionId: SESSION, configOptions: [{ id: "model" }] } },
      ctx,
    );
    expect(r.side?.persistSessionId).toBe(SESSION);
    expect(ctx.sessionId).toBe(SESSION);
    expect(ctx.configOptions).toHaveLength(1);
    expect(isAcpReady(ctx)).toBe(true);
  });

  it("session/load response finds the id inside _meta (grok replay shape)", () => {
    const ctx = createAcpCtx();
    ctx.requestedSessionId = SESSION;
    ctx.pending.set(5, "session/load");
    const r = parse(
      {
        id: 5,
        result: {
          models: { currentModelId: "grok-4.7", availableModels: [] },
          configOptions: [],
          _meta: { sessionId: SESSION },
        },
      },
      ctx,
    );
    expect(r.side?.persistSessionId).toBe(SESSION);
    expect(ctx.sessionId).toBe(SESSION);
  });

  it("session/new error sets sessionError and emits progress, not terminal", () => {
    const ctx = createAcpCtx();
    ctx.pending.set(2, "session/new");
    const r = parse(
      { id: 2, error: { code: -32002, message: "Authentication required" } },
      ctx,
    );
    expect(ctx.sessionError).toBe("Authentication required");
    expect(ctx.sessionId).toBeUndefined();
    expect(r.events).toHaveLength(1);
    expect(r.events[0].kind).toBe("progress");
    expect(r.events[0].payload?.detail).toMatchObject({
      kind: "session_acquire_failed",
    });
  });

  it("initialize response marks ctx initialized and stores capabilities", () => {
    const ctx = createAcpCtx();
    ctx.pending.set(1, "initialize");
    parse(
      {
        id: 1,
        result: {
          protocolVersion: 1,
          agentCapabilities: {
            loadSession: true,
            sessionCapabilities: { resume: {} },
          },
        },
      },
      ctx,
    );
    expect(ctx.initialized).toBe(true);
    expect(ctx.agentCapabilities?.loadSession).toBe(true);
    expect(ctx.agentCapabilities?.sessionCapabilities?.resume).toEqual({});
  });

  it("initialize error records initError for the handshake to abort", () => {
    const ctx = createAcpCtx();
    ctx.pending.set(1, "initialize");
    const r = parse({ id: 1, error: { code: -32600, message: "bad init" } }, ctx);
    expect(ctx.initError).toBe("bad init");
    expect(r.events[0].kind).toBe("progress");
  });
});

describe("ACP parse — session/update streaming (raw probe shapes)", () => {
  it("agent_message_chunk emits output progress and buffers for message", () => {
    const ctx = createAcpCtx();
    seedSession(ctx);
    const r = parse(
      sessionUpdate({
        sessionUpdate: "agent_message_chunk",
        messageId: "msg_06b58",
        content: { type: "text", text: "Hello" },
      }),
      ctx,
    );
    expect(r.events).toEqual([
      {
        kind: "progress",
        payload: {
          detail: {
            kind: "output",
            stream_id: "msg_06b58",
            text_delta: "Hello",
          },
        },
      },
    ]);
    expect(ctx.messageBuf.join("")).toBe("Hello");
  });

  it("agent_thought_chunk emits reasoning progress", () => {
    const ctx = createAcpCtx();
    seedSession(ctx);
    const r = parse(
      sessionUpdate({
        sessionUpdate: "agent_thought_chunk",
        messageId: "rs_06b58",
        content: { type: "text", text: "thinking…" },
      }),
      ctx,
    );
    expect(r.events[0]).toMatchObject({
      kind: "progress",
      payload: {
        detail: { kind: "reasoning", stream_id: "rs_06b58", text_delta: "thinking…" },
      },
    });
  });

  it("tool_call and tool_call_update emit tool progress", () => {
    const ctx = createAcpCtx();
    seedSession(ctx);
    const call = parse(
      sessionUpdate({
        sessionUpdate: "tool_call",
        toolCallId: "exec-83a7",
        kind: "edit",
        title: "Editing files",
        status: "in_progress",
      }),
      ctx,
    );
    expect(call.events[0]).toMatchObject({
      kind: "progress",
      payload: {
        detail: {
          kind: "tool_call",
          tool_call_id: "exec-83a7",
          tool_kind: "edit",
          status: "in_progress",
        },
      },
    });
    const upd = parse(
      sessionUpdate({
        sessionUpdate: "tool_call_update",
        toolCallId: "exec-83a7",
        status: "completed",
      }),
      ctx,
    );
    expect(upd.events[0]).toMatchObject({
      kind: "progress",
      payload: {
        detail: {
          kind: "tool_call_update",
          tool_call_id: "exec-83a7",
          status: "completed",
        },
      },
    });
  });

  it("echo/infra updates stay silent", () => {
    const ctx = createAcpCtx();
    seedSession(ctx);
    for (const update of [
      {
        sessionUpdate: "user_message_chunk",
        content: { type: "text", text: "echo of my own prompt" },
      },
      { sessionUpdate: "session_info_update", _meta: {} },
      { sessionUpdate: "usage_update", used: 23751, size: 258400 },
      { sessionUpdate: "available_commands_update", availableCommands: [] },
      { sessionUpdate: "some_future_unknown_update", whatever: true },
    ]) {
      const r = parse(sessionUpdate(update), ctx);
      expect(r.events).toEqual([]);
    }
  });
});

describe("ACP parse — session/prompt completion", () => {
  it("end_turn response flushes buffered text as message then done", () => {
    const ctx = createAcpCtx();
    seedSession(ctx);
    encodeAcpUserMessage(ctx, "say hi");
    parse(
      sessionUpdate({
        sessionUpdate: "agent_message_chunk",
        messageId: "m1",
        content: { type: "text", text: "done writing hello.txt" },
      }),
      ctx,
    );
    const r = parse(
      {
        id: 1,
        result: {
          stopReason: "end_turn",
          usage: { totalTokens: 171706 },
        },
      },
      ctx,
    );
    expect(r.events).toEqual([
      { kind: "message", payload: { text: "done writing hello.txt" } },
      {
        kind: "done",
        payload: { stopReason: "end_turn", usage: { totalTokens: 171706 } },
      },
    ]);
  });

  it("a bare prompt response (no chunks) emits only done", () => {
    const ctx = createAcpCtx();
    seedSession(ctx);
    encodeAcpUserMessage(ctx, "hi");
    const r = parse({ id: 1, result: { stopReason: "max_tokens" } }, ctx);
    expect(r.events).toEqual([
      { kind: "done", payload: { stopReason: "max_tokens" } },
    ]);
  });

  it("agent-initiated cancelled turn surfaces an error", () => {
    const ctx = createAcpCtx();
    seedSession(ctx);
    encodeAcpUserMessage(ctx, "work");
    const r = parse({ id: 1, result: { stopReason: "cancelled" } }, ctx);
    expect(r.events).toEqual([
      {
        kind: "error",
        payload: { message: "ACP turn cancelled by agent", stopReason: "cancelled" },
      },
    ]);
  });

  it("an interrupt-superseded prompt response never emits terminal", () => {
    const ctx = createAcpCtx();
    seedSession(ctx);
    encodeAcpUserMessage(ctx, "work"); // id=1 — the prompt we will interrupt
    const lines = encodeAcpInterruptMessage(ctx, "redirect: new task");
    expect(lines).toContain('"session/cancel"');
    expect(lines).toContain('"session/prompt"');
    // id 1 = old prompt (superseded); session/cancel is a notification
    // (no id consumed); id 2 = replacement prompt.
    const superseded = parse(
      { id: 1, result: { stopReason: "cancelled" } },
      ctx,
    );
    expect(superseded.events).toHaveLength(1);
    expect(superseded.events[0].kind).toBe("progress");
    expect(superseded.events[0].payload?.detail).toMatchObject({
      kind: "prompt_superseded",
      stopReason: "cancelled",
    });
    // The replacement prompt still completes normally.
    const done = parse({ id: 2, result: { stopReason: "end_turn" } }, ctx);
    expect(done.events.map((e) => e.kind)).toEqual(["done"]);
  });

  it("prompt error response emits a terminal error", () => {
    const ctx = createAcpCtx();
    seedSession(ctx);
    encodeAcpUserMessage(ctx, "work");
    const r = parse(
      { id: 1, error: { code: -32000, message: "model overloaded" } },
      ctx,
    );
    expect(r.events[0].kind).toBe("error");
    expect(r.events[0].payload?.message).toContain("model overloaded");
  });

  it("stopReason sniffs untracked prompt responses", () => {
    const ctx = createAcpCtx();
    seedSession(ctx);
    const r = parse({ id: 99, result: { stopReason: "end_turn" } }, ctx);
    expect(r.events.map((e) => e.kind)).toEqual(["done"]);
  });
});

describe("ACP parse — permission requests & server requests", () => {
  it("auto-answers session/request_permission with allow_once", () => {
    const ctx = createAcpCtx();
    seedSession(ctx);
    // Verbatim option set from raw-codex-ro-permgate.log.
    const r = parse(
      {
        id: 0,
        method: "session/request_permission",
        params: {
          sessionId: SESSION,
          toolCall: {
            toolCallId: "exec-83a74076",
            title: "Run command",
            kind: "execute",
            status: "pending",
          },
          options: [
            { optionId: "allow_once", name: "Yes, proceed", kind: "allow_once" },
            { optionId: "always", name: "Yes, always", kind: "allow_always" },
            { optionId: "reject", name: "No", kind: "reject_once" },
          ],
        },
      },
      ctx,
    );
    expect(r.events[0]).toMatchObject({
      kind: "progress",
      payload: {
        detail: {
          kind: "permission",
          tool_call_id: "exec-83a74076",
          decision: "auto:allow_once",
        },
      },
    });
    const reply = firstReply(r);
    expect(reply.id).toBe(0);
    expect(reply.result).toEqual({
      outcome: { outcome: "selected", optionId: "allow_once" },
    });
  });

  it("falls back to allow_always when allow_once is absent", () => {
    expect(
      pickAcpPermissionOption([
        { optionId: "always", kind: "allow_always" },
        { optionId: "reject", kind: "reject_once" },
      ]),
    ).toEqual({ outcome: "selected", optionId: "always" });
  });

  it("answers cancelled when the agent offers no options", () => {
    expect(pickAcpPermissionOption([])).toEqual({ outcome: "cancelled" });
    expect(pickAcpPermissionOption(undefined)).toEqual({ outcome: "cancelled" });
  });

  it("answers -32601 for an unadvertised blocking request (e.g. fs/read)", () => {
    const ctx = createAcpCtx();
    seedSession(ctx);
    const r = parse(
      {
        id: 7,
        method: "fs/read_text_file",
        params: { sessionId: SESSION, path: "/x" },
      },
      ctx,
    );
    expect(r.events[0]).toMatchObject({
      kind: "progress",
      payload: {
        detail: { kind: "unsupported_request", method: "fs/read_text_file" },
      },
    });
    const reply = firstReply(r);
    expect(reply.id).toBe(7);
    expect(reply.error).toMatchObject({ code: -32601 });
  });
});

describe("ACP parse — misc robustness", () => {
  it("malformed JSON is an error event, not a crash", () => {
    const ctx = createAcpCtx();
    const r = parse("{not json!!!", ctx);
    expect(r.events).toEqual([
      {
        kind: "error",
        payload: {
          message: "Failed to parse ACP stdout line",
          raw_excerpt: "{not json!!!",
        },
      },
    ]);
  });

  it("private _x.ai/* notifications become progress breadcrumbs", () => {
    const ctx = createAcpCtx();
    seedSession(ctx);
    const r = parse(
      {
        method: "_x.ai/session/update",
        params: {
          sessionId: SESSION,
          update: { sessionUpdate: "turn_completed", stop_reason: "cancelled" },
        },
      },
      ctx,
    );
    expect(r.events[0]).toMatchObject({
      kind: "progress",
      payload: { detail: { kind: "notification", method: "_x.ai/session/update" } },
    });
  });

  it("session/update NEVER produces a terminal event", () => {
    const ctx = createAcpCtx();
    seedSession(ctx);
    for (const kind of [
      "agent_message_chunk",
      "agent_thought_chunk",
      "tool_call",
      "tool_call_update",
      "plan",
      "current_mode_update",
    ]) {
      const r = parse(
        sessionUpdate({
          sessionUpdate: kind,
          content: { type: "text", text: "x" },
          toolCallId: "t1",
        }),
        ctx,
      );
      expect(r.events.every((e) => e.kind !== "done" && e.kind !== "error")).toBe(
        true,
      );
    }
  });
});

describe("ACP outbound encoders", () => {
  it("encodeUserMessage writes a session/prompt request", () => {
    const ctx = createAcpCtx();
    seedSession(ctx);
    const line = encodeAcpUserMessage(ctx, "hello world");
    const msg = JSON.parse(line);
    expect(msg.method).toBe("session/prompt");
    expect(msg.params.sessionId).toBe(SESSION);
    expect(msg.params.prompt).toEqual([{ type: "text", text: "hello world" }]);
    expect(ctx.promptIds.has(msg.id)).toBe(true);
  });

  it("encodeUserMessage injects systemPrompt into the first prompt only", () => {
    const ctx = createAcpCtx();
    ctx.systemPrompt = "you are a build robot";
    seedSession(ctx);
    const first = JSON.parse(encodeAcpUserMessage(ctx, "go"));
    expect(first.params.prompt[0].text).toContain("[SYSTEM PROMPT]");
    expect(first.params.prompt[0].text).toContain("you are a build robot");
    expect(first.params.prompt[0].text).toContain("go");
    const second = JSON.parse(encodeAcpUserMessage(ctx, "again"));
    expect(second.params.prompt[0].text).toBe("again");
  });

  it("encodeUserMessage throws before the session exists", () => {
    const ctx = createAcpCtx();
    expect(() => encodeAcpUserMessage(ctx, "x")).toThrow(/session not established/);
  });

  it("encodeInterruptMessage emits cancel then a replacement prompt", () => {
    const ctx = createAcpCtx();
    seedSession(ctx);
    encodeAcpUserMessage(ctx, "work");
    const wire = encodeAcpInterruptMessage(ctx, "stop and do this instead");
    const msgs = wire
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    expect(msgs[0].method).toBe("session/cancel");
    expect(msgs[0].id).toBeUndefined(); // notification, not a request
    expect(msgs[0].params.sessionId).toBe(SESSION);
    expect(msgs[1].method).toBe("session/prompt");
    expect(msgs[1].params.prompt[0].text).toContain("GRID INTERRUPT");
    expect(ctx.expectedCancelled.has(1)).toBe(true);
  });
});

describe("ACP handshake (mocked child)", () => {
  function makeDriver(
    responses: (req: { id?: number; method?: string }) => Record<string, unknown> | undefined,
  ) {
    const ctx = createAcpCtx();
    const sent: { id?: number; method?: string; params?: unknown }[] = [];
    const child = {
      stdin: {
        write(s: string) {
          const req = JSON.parse(s.trim()) as {
            id?: number;
            method?: string;
            params?: unknown;
          };
          sent.push(req);
          const res = responses(req);
          if (res && req.id !== undefined) {
            parseAcpLine(JSON.stringify({ jsonrpc: "2.0", id: req.id, ...res }), ctx);
          }
        },
      },
    };
    return { ctx, child, sent };
  }

  it("initialize → session/new → post-session config (claude bypassPermissions)", async () => {
    const { ctx, child, sent } = makeDriver((req) => {
      switch (req.method) {
        case "initialize":
          return {
            result: {
              protocolVersion: 1,
              agentCapabilities: { loadSession: true },
            },
          };
        case "session/new":
          return {
            result: {
              sessionId: SESSION,
              configOptions: [
                { id: "mode", options: [{ value: "bypassPermissions" }] },
                { id: "model", options: [{ value: "sonnet" }] },
              ],
            },
          };
        case "session/set_config_option":
          return { result: { configOptions: [] } };
        default:
          return undefined;
      }
    });
    await acpHandshake({
      child,
      ctx,
      view: {
        acpTarget: "claude",
        model: "sonnet",
        cwd: "/tmp/proj",
        systemPrompt: "sys",
      },
    });
    expect(ctx.sessionId).toBe(SESSION);
    expect(sent.map((m) => m.method)).toEqual([
      "initialize",
      "session/new",
      "session/set_config_option",
      "session/set_config_option",
    ]);
    expect(sent[2].params).toMatchObject({
      configId: "mode",
      value: "bypassPermissions",
    });
    expect(sent[3].params).toMatchObject({ configId: "model", value: "sonnet" });
  });

  it("falls back session/resume → session/load → session/new honoring caps", async () => {
    const { ctx, child, sent } = makeDriver((req) => {
      switch (req.method) {
        case "initialize":
          return {
            result: {
              protocolVersion: 1,
              agentCapabilities: {
                loadSession: true,
                sessionCapabilities: { resume: {} },
              },
            },
          };
        case "session/resume":
          return { error: { code: -32000, message: "resume failed" } };
        case "session/load":
          return { error: { code: -32000, message: "load failed" } };
        case "session/new":
          return { result: { sessionId: SESSION, configOptions: [] } };
        default:
          return { result: {} };
      }
    });
    await acpHandshake({
      child,
      ctx,
      view: {
        acpTarget: "grok-build",
        resume: "old-session",
        cwd: "/tmp/proj",
        systemPrompt: "",
      },
    });
    expect(ctx.sessionId).toBe(SESSION);
    expect(sent.map((m) => m.method)).toEqual([
      "initialize",
      "session/resume",
      "session/load",
      "session/new",
    ]);
    expect(sent[1].params).toMatchObject({ sessionId: "old-session" });
    expect(sent[2].params).toMatchObject({ sessionId: "old-session" });
  });

  it("uses session/load when the agent does not advertise resume", async () => {
    const { ctx, child, sent } = makeDriver((req) => {
      switch (req.method) {
        case "initialize":
          return {
            result: {
              protocolVersion: 1,
              agentCapabilities: { loadSession: true },
            },
          };
        case "session/load":
          return {
            result: {
              models: {},
              configOptions: [],
              _meta: { sessionId: "old-session" },
            },
          };
        default:
          return { result: {} };
      }
    });
    await acpHandshake({
      child,
      ctx,
      view: {
        acpTarget: "grok-build",
        resume: "old-session",
        cwd: "/tmp/proj",
        systemPrompt: "sys",
      },
    });
    expect(ctx.sessionId).toBe("old-session");
    expect(sent.map((m) => m.method)).toEqual(["initialize", "session/load"]);
    // Resumed sessions do NOT get the system prompt re-injected.
    expect(ctx.systemPromptInjected).toBe(true);
  });

  it("aborts when initialize errors", async () => {
    const { ctx, child } = makeDriver((req) =>
      req.method === "initialize"
        ? { error: { code: -32600, message: "protocol too old" } }
        : { result: {} },
    );
    await expect(
      acpHandshake({
        child,
        ctx,
        view: { acpTarget: "grok-build", cwd: "/x", systemPrompt: "" },
      }),
    ).rejects.toThrow(/ACP initialize failed: protocol too old/);
  });

  it("fails with authHint when session acquisition never succeeds", async () => {
    const { ctx, child } = makeDriver((req) => {
      if (req.method === "initialize") {
        return { result: { protocolVersion: 1, agentCapabilities: {} } };
      }
      return { error: { code: -32002, message: "Authentication required" } };
    });
    await expect(
      acpHandshake({
        child,
        ctx,
        view: { acpTarget: "grok-build", cwd: "/x", systemPrompt: "" },
      }),
    ).rejects.toThrow(/session acquisition failed.*grok/i);
  });
});

describe("ACP agent card fields", () => {
  it("loadAgent validates provider via the registry and exposes acp_* raw fields", () => {
    const tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "acp-agent-"));
    try {
      const agentsDir = path.join(tmp, ".trellis", "agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(
        path.join(agentsDir, "acp-grok-build.md"),
        [
          "---",
          "name: acp-grok-build",
          "provider: acp",
          "acp_target: grok-build",
          "model: grok-4.7",
          "effort: high",
          "---",
          "",
          "You are Grok in build mode.",
        ].join("\n"),
      );
      const agent = loadAgent("acp-grok-build", tmp, []);
      expect(agent.provider).toBe("acp"); // registry-aware, not a hardcoded list
      expect(agent.model).toBe("grok-4.7");
      expect(agent.effort).toBe("high");
      expect(agent.raw.acp_target).toBe("grok-build");
      expect(agent.systemPrompt).toContain("Grok in build mode");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("loadAgent still accepts claude/codex and rejects unknown providers", () => {
    const tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "acp-agent-"));
    try {
      const agentsDir = path.join(tmp, ".trellis", "agents");
      fs.mkdirSync(agentsDir, { recursive: true });
      for (const [name, provider] of [
        ["ok-claude", "claude"],
        ["ok-codex", "codex"],
        ["bad", "gpt"],
      ] as const) {
        fs.writeFileSync(
          path.join(agentsDir, `${name}.md`),
          ["---", `name: ${name}`, `provider: ${provider}`, "---", "", "body"].join("\n"),
        );
      }
      expect(loadAgent("ok-claude", tmp, []).provider).toBe("claude");
      expect(loadAgent("ok-codex", tmp, []).provider).toBe("codex");
      expect(loadAgent("bad", tmp, []).provider).toBeUndefined();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("ACP adapter registration", () => {
  it("'acp' is a registered provider alongside claude and codex", () => {
    expect(isProvider("acp")).toBe(true);
    expect(isProvider("claude")).toBe(true);
    expect(isProvider("codex")).toBe(true);
    expect(listProviders()).toContain("acp");
  });

  it("getAdapter('acp') returns a working adapter", () => {
    const adapter = getAdapter("acp");
    expect(adapter.provider).toBe("acp");
    const ctx = adapter.createCtx();
    expect(adapter.isReady(ctx)).toBe(false);
    expect(
      adapter.buildArgs({
        cwd: "/tmp",
        resume: undefined,
        model: undefined,
        systemPrompt: "",
        acpTarget: "grok-build",
      }),
    ).toEqual(["agent", "stdio"]);
    expect(
      adapter.resolveCommand?.({
        cwd: "/tmp",
        resume: undefined,
        model: undefined,
        systemPrompt: "",
        acpTarget: "codex",
      }),
    ).toBeTruthy();
  });
});
