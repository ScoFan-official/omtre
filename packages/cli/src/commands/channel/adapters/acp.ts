import { readFileSync } from "node:fs";

import type { AdapterEvent, ParseResult } from "./types.js";

/**
 * ACP (Agent Client Protocol) adapter — newline-delimited JSON-RPC 2.0
 * over stdio. One adapter (`provider: "acp"`) fronts multiple agent
 * executables selected by an `acp_target` id resolved through the
 * built-in registry in `acp-agents.json` (grok-build / codex / claude).
 *
 * Wire shape (real data — see research: 10-12-acp-probe raw logs):
 *
 *   Inbound message kinds:
 *     1. Response to our outgoing request: { id, result } | { id, error }
 *     2. Agent-to-client request:          { method, id, params } — must reply
 *     3. Notification:                     { method, params }     — no reply
 *
 *   Outbound flow: initialize → session/new | session/resume | session/load
 *   → optional session/set_config_option (mode/model/effort) →
 *   session/prompt per user message. `session/cancel` is a notification.
 *
 *   Translated events:
 *     session/new result.sessionId            → persistSessionId
 *     session/update agent_message_chunk      → progress(output delta) +
 *                                               buffered for `message`
 *     session/update agent_thought_chunk      → progress(reasoning delta)
 *     session/update tool_call/_update        → progress(tool status)
 *     session/request_permission              → auto reply allow_once +
 *                                               progress(permission)
 *     session/prompt result.stopReason        → message? + done / cancelled /
 *                                               error (see below)
 *     _x.ai/* / _auth/* / other notifications → progress(notification)
 *     unknown agent→client request            → -32601 + progress
 *
 *   Completion rule: `session/update` NEVER terminates a turn; only the
 *   session/prompt JSON-RPC response carries `stopReason` ("end_turn",
 *   "cancelled", "refusal", "max_tokens", "max_turn_requests").
 */

// ── Target registry ────────────────────────────────────────────────

export interface AcpConfigRequest {
  configId: string;
  value: string;
}

export interface AcpAgentEntry {
  /** Base executable/command (non-windows default). */
  command: string;
  /** Args appended after command (may contain {model}/{effort}/{cwd} placeholders). */
  args: string[];
  /** Env vars merged into the worker process env. */
  env: Record<string, string>;
  /** Optional per-platform override — `command`/`args` replace, `env` merges. */
  windows?: {
    command?: string;
    args?: string[];
    env?: Record<string, string>;
  };
  /** session/set_config_option configId used for model selection.
   *  Absent for targets resolved purely from a card-level command
   *  override — the registry row is where this id is learned. */
  modelOptionId?: string;
  /** session/set_config_option configId used for effort/thinking level. */
  effortOptionId?: string;
  /** configId/value pairs applied unconditionally after session start
   *  (e.g. claude mode=bypassPermissions for unattended runs). */
  postSessionConfig: AcpConfigRequest[];
  /** Hint appended to auth-ish failures so operators know where to log in. */
  authHint: string;
}

export interface ResolvedAcpTarget extends AcpAgentEntry {
  id: string;
}

// Read at module load so the JSON can be maintained without touching the
// adapter; `import ... with {type:"json"}` is avoided because the CLI's
// engine floor (node >=18.17) predates import-attribute support (>=18.19).
// scripts/copy-templates.js ships the file into dist/.
const ACP_AGENTS = JSON.parse(
  readFileSync(new URL("./acp-agents.json", import.meta.url), "utf-8"),
) as Record<string, AcpAgentEntry>;

export function listAcpTargets(): string[] {
  return Object.keys(ACP_AGENTS);
}

/**
 * Resolve an `acp_target` id + optional card-level command/args overrides
 * into a concrete launch spec. Applies the `windows` override on win32.
 *
 * Fail-closed contract (dispatch-roster schema): the id must be a registry
 * entry, OR the card must carry an explicit `command` override — an unlisted
 * id paired with a command resolves to a self-contained launch spec (no env
 * presets, no config-option ids, no auth hint; `windows` does not apply —
 * the override is the whole contract). An unlisted id WITHOUT a command
 * throws, as does a missing id — callers surface the error at spawn time
 * rather than inside the detached supervisor.
 */
export function resolveAcpTarget(opts: {
  target?: string;
  command?: string;
  args?: string[];
}): ResolvedAcpTarget {
  const id = (opts.target ?? "").trim();
  if (!id) {
    throw new Error(
      `provider 'acp' requires an acp_target (agent card frontmatter ` +
        `\`acp_target:\` or --acp-target <id>; known targets: ${listAcpTargets().join(", ")})`,
    );
  }
  const entry = ACP_AGENTS[id];
  const cmdOverride = opts.command?.trim();
  if (!entry) {
    if (cmdOverride) {
      return {
        id,
        command: cmdOverride,
        args: opts.args ?? [],
        env: {},
        postSessionConfig: [],
        authHint: "",
      };
    }
    throw new Error(
      `Unknown acp_target '${id}' (registered targets: ${listAcpTargets().join(", ")}) ` +
        `— either register it in acp-agents.json or set an explicit ` +
        `\`acp_command:\` on the agent card`,
    );
  }
  const onWindows = process.platform === "win32";
  const win = onWindows ? entry.windows : undefined;
  const command =
    cmdOverride !== undefined && cmdOverride.length > 0
      ? cmdOverride
      : (win?.command ?? entry.command);
  return {
    id,
    command,
    args: opts.args ?? win?.args ?? entry.args,
    env: { ...entry.env, ...(win?.env ?? {}) },
    windows: entry.windows,
    modelOptionId: entry.modelOptionId,
    effortOptionId: entry.effortOptionId,
    postSessionConfig: entry.postSessionConfig,
    authHint: entry.authHint,
  };
}

/** `{name}`-style placeholder substitution for target args. When a
 *  placeholder resolves to undefined the arg — and its preceding flag
 *  (e.g. `-m {model}`) — is dropped so no dangling flag reaches the
 *  spawned command. Inline occurrences (`--model={model}`) drop the arg. */
export function substituteAcpArgs(
  args: string[],
  values: Record<string, string | undefined>,
): string[] {
  const out: string[] = [];
  for (const arg of args) {
    const exact = /^\{([a-zA-Z_]+)\}$/.exec(arg);
    if (exact) {
      const v = values[exact[1]];
      if (v === undefined) {
        // Drop the preceding flag token if it looks like `-f`/`--flag`.
        if (out.length > 0 && /^-{1,2}\w/.test(out[out.length - 1])) {
          out.pop();
        }
        continue;
      }
      out.push(v);
      continue;
    }
    let dropped = false;
    const substituted = arg.replace(/\{([a-zA-Z_]+)\}/g, (_m, name: string) => {
      const v = values[name];
      if (v === undefined) {
        dropped = true;
        return "";
      }
      return v;
    });
    if (!dropped) out.push(substituted);
  }
  return out;
}

/** Command string the supervisor should resolve for this spawn. */
export function resolveAcpCommand(view: {
  acpTarget?: string;
  acpCommand?: string;
  acpArgs?: string[];
}): string {
  return resolveAcpTarget({
    target: view.acpTarget,
    command: view.acpCommand,
    args: view.acpArgs,
  }).command;
}

export function buildAcpArgs(view: {
  acpTarget?: string;
  acpCommand?: string;
  acpArgs?: string[];
  model?: string;
  effort?: string;
  cwd?: string;
}): string[] {
  const t = resolveAcpTarget({
    target: view.acpTarget,
    command: view.acpCommand,
    args: view.acpArgs,
  });
  return substituteAcpArgs(t.args, {
    model: view.model,
    effort: view.effort,
    cwd: view.cwd,
  });
}

// ── Adapter context ────────────────────────────────────────────────

export interface AcpConfigOption {
  id?: string;
  name?: string;
  category?: string;
  type?: string;
  currentValue?: string;
  options?: { value?: string; name?: string }[];
}

export interface AcpAgentCapabilities {
  loadSession?: boolean;
  sessionCapabilities?: {
    resume?: unknown;
    list?: unknown;
    close?: unknown;
    fork?: unknown;
  };
}

interface JsonRpcInbound {
  jsonrpc?: string;
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code?: number; message?: string };
}

type PendingLabel =
  | "initialize"
  | "session/new"
  | "session/resume"
  | "session/load"
  | "session/prompt"
  | "set_config_option"
  | "other";

export interface AcpCtx {
  /** id → label tracking outgoing requests so responses can be routed. */
  pending: Map<number, PendingLabel>;
  /** Monotonic outbound id allocator. */
  nextId: number;
  /** True once the initialize response arrived. */
  initialized: boolean;
  /** Set on initialize failure — handshake aborts with this message. */
  initError?: string;
  /** Agent-advertised capabilities from initialize. */
  agentCapabilities?: AcpAgentCapabilities;
  /** Current ACP session id (set by session/new|resume|load response). */
  sessionId?: string;
  /** Set on session acquisition failure — handshake may fall back. */
  sessionError?: string;
  /** sessionId we asked to resume/load (used when the response omits it). */
  requestedSessionId?: string;
  /** configOptions advertised by session/new|resume|load result. */
  configOptions: AcpConfigOption[];
  /** In-flight session/prompt request ids. */
  promptIds: Set<number>;
  /** Prompt ids interrupted by `session/cancel` — their responses are
   *  superseded and must not emit terminal events. */
  expectedCancelled: Set<number>;
  /** agent_message_chunk text buffered until the turn completes. */
  messageBuf: string[];
  /** Whether the buffered chunks were already flushed as `message`. */
  messageFlushed: boolean;
  /** Resolved launch target — set during handshake. */
  target?: ResolvedAcpTarget;
  /** cwd carried into session/new|load params. */
  cwd: string;
  /** System prompt injected into the first session/prompt of a FRESH
   *  session (resumed sessions keep their own context). */
  systemPrompt: string;
  /** True once a prompt carried the systemPrompt (or the session was
   *  resumed — no injection on resumes). */
  systemPromptInjected: boolean;
}

export function createAcpCtx(): AcpCtx {
  return {
    pending: new Map(),
    nextId: 1,
    initialized: false,
    configOptions: [],
    promptIds: new Set(),
    expectedCancelled: new Set(),
    messageBuf: [],
    messageFlushed: false,
    cwd: "",
    systemPrompt: "",
    systemPromptInjected: false,
  };
}

// ── Outbound helpers ───────────────────────────────────────────────

export function encodeAcpRequest(
  ctx: AcpCtx,
  method: string,
  params: unknown,
  label: PendingLabel = "other",
): { id: number; line: string } {
  const id = ctx.nextId++;
  ctx.pending.set(id, label);
  return {
    id,
    line: JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n",
  };
}

/** `session/cancel` is a JSON-RPC notification (no id). */
export function encodeAcpCancel(sessionId: string): string {
  return (
    JSON.stringify({
      jsonrpc: "2.0",
      method: "session/cancel",
      params: { sessionId },
    }) + "\n"
  );
}

function buildPromptText(ctx: AcpCtx, text: string): string {
  if (ctx.systemPromptInjected || !ctx.systemPrompt.trim()) return text;
  ctx.systemPromptInjected = true;
  return `[SYSTEM PROMPT]\n${ctx.systemPrompt}\n\n[USER MESSAGE]\n${text}`;
}

export function encodeAcpUserMessage(ctx: AcpCtx, text: string): string {
  if (!ctx.sessionId) {
    throw new Error(
      "ACP adapter: session not established; cannot send user message yet",
    );
  }
  ctx.messageBuf = [];
  ctx.messageFlushed = false;
  const req = encodeAcpRequest(
    ctx,
    "session/prompt",
    {
      sessionId: ctx.sessionId,
      prompt: [{ type: "text", text: buildPromptText(ctx, text) }],
    },
    "session/prompt",
  );
  ctx.promptIds.add(req.id);
  return req.line;
}

/**
 * Interrupt = `session/cancel` notification for the active prompt, then a
 * replacement session/prompt carrying the redirect text. The old prompt's
 * response is suppressed (see `expectedCancelled`) because the inbox has
 * already closed that turn as aborted.
 */
export function encodeAcpInterruptMessage(ctx: AcpCtx, text: string): string {
  if (!ctx.sessionId) return "";
  const lines: string[] = [];
  for (const id of ctx.promptIds) {
    ctx.expectedCancelled.add(id);
  }
  lines.push(encodeAcpCancel(ctx.sessionId));
  const req = encodeAcpRequest(
    ctx,
    "session/prompt",
    {
      sessionId: ctx.sessionId,
      prompt: [
        {
          type: "text",
          text:
            "[GRID INTERRUPT - drop current work and follow this new instruction]\n" +
            text,
        },
      ],
    },
    "session/prompt",
  );
  ctx.promptIds.add(req.id);
  lines.push(req.line);
  return lines.join("");
}

// ── Handshake ──────────────────────────────────────────────────────

function acpClientHello(): Record<string, unknown> {
  return {
    protocolVersion: 1,
    clientCapabilities: {
      fs: { readTextFile: false, writeTextFile: false },
      terminal: false,
      auth: { terminal: false },
    },
    clientInfo: { name: "omtre-channel", version: "0.1" },
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(
  pred: () => boolean,
  deadlineMs: number,
): Promise<boolean> {
  const deadline = Date.now() + deadlineMs;
  while (!pred() && Date.now() < deadline) {
    await sleep(50);
  }
  return pred();
}

/**
 * ACP handshake: resolve the launch target, `initialize`, acquire a
 * session (resume → load → new fallback chain honoring agent caps), then
 * apply post-session config options (mode preset, model, effort).
 */
export async function acpHandshake(args: {
  child: { stdin: { write: (s: string) => void } };
  ctx: AcpCtx;
  view: {
    acpTarget?: string;
    acpCommand?: string;
    acpArgs?: string[];
    resume?: string;
    model?: string;
    effort?: string;
    cwd: string;
    systemPrompt: string;
  };
}): Promise<void> {
  const { child, ctx, view } = args;
  ctx.target = resolveAcpTarget({
    target: view.acpTarget,
    command: view.acpCommand,
    args: view.acpArgs,
  });
  ctx.cwd = view.cwd;
  ctx.systemPrompt = view.systemPrompt;

  const init = encodeAcpRequest(
    ctx,
    "initialize",
    acpClientHello(),
    "initialize",
  );
  child.stdin.write(init.line);
  const initOk = await waitFor(
    () => ctx.initialized || ctx.initError !== undefined,
    30_000,
  );
  if (ctx.initError) {
    throw new Error(`ACP initialize failed: ${ctx.initError}`);
  }
  if (!initOk || !ctx.initialized) {
    throw new Error("ACP initialize did not respond within 30s");
  }

  // Session acquisition: prefer resume → load → fresh new. Capability
  // fields differ between agents (codex/claude expose
  // sessionCapabilities.resume + loadSession; grok exposes both too).
  const caps = ctx.agentCapabilities ?? {};
  const canResume = Boolean(caps.sessionCapabilities?.resume);
  const canLoad = Boolean(caps.loadSession);
  const sessionParams = (): Record<string, unknown> => ({
    cwd: ctx.cwd,
    mcpServers: [],
  });

  const tryAcquire = async (
    method: "session/resume" | "session/load",
    sessionId: string,
  ): Promise<boolean> => {
    ctx.requestedSessionId = sessionId;
    const req = encodeAcpRequest(
      ctx,
      method,
      { ...sessionParams(), sessionId },
      method,
    );
    child.stdin.write(req.line);
    // Settled = sessionId OR sessionError; success = sessionId present.
    await waitFor(
      () => ctx.sessionId !== undefined || ctx.sessionError !== undefined,
      30_000,
    );
    if (ctx.sessionId) {
      ctx.systemPromptInjected = true;
      return true;
    }
    ctx.sessionError = undefined;
    return false;
  };

  if (view.resume && canResume && !ctx.sessionId) {
    await tryAcquire("session/resume", view.resume);
  }
  if (view.resume && canLoad && !ctx.sessionId) {
    await tryAcquire("session/load", view.resume);
  }
  if (!ctx.sessionId) {
    const req = encodeAcpRequest(
      ctx,
      "session/new",
      sessionParams(),
      "session/new",
    );
    child.stdin.write(req.line);
    await waitFor(
      () => ctx.sessionId !== undefined || ctx.sessionError !== undefined,
      30_000,
    );
  }
  if (!ctx.sessionId) {
    const hint = ctx.target.authHint;
    throw new Error(
      `ACP session acquisition failed` +
        (ctx.sessionError
          ? `: ${ctx.sessionError}`
          : " (no response within 30s)") +
        (hint ? ` — ${hint}` : ""),
    );
  }

  // Post-session config: target presets (e.g. claude bypassPermissions),
  // then model/effort selects when the option id is advertised.
  const configReqs: AcpConfigRequest[] = [...ctx.target.postSessionConfig];
  const hasOption = (id: string | undefined): boolean =>
    id !== undefined && ctx.configOptions.some((o) => o.id === id);
  if (
    view.model &&
    ctx.target.modelOptionId !== undefined &&
    hasOption(ctx.target.modelOptionId)
  ) {
    configReqs.push({ configId: ctx.target.modelOptionId, value: view.model });
  }
  if (
    view.effort &&
    ctx.target.effortOptionId !== undefined &&
    hasOption(ctx.target.effortOptionId)
  ) {
    configReqs.push({
      configId: ctx.target.effortOptionId,
      value: view.effort,
    });
  }
  for (const c of configReqs) {
    const req = encodeAcpRequest(
      ctx,
      "session/set_config_option",
      { sessionId: ctx.sessionId, configId: c.configId, value: c.value },
      "set_config_option",
    );
    child.stdin.write(req.line);
  }
  // Give config requests a short window to land; errors surface as
  // progress events rather than handshake failures.
  if (configReqs.length > 0) {
    await waitFor(
      () => ![...ctx.pending.values()].includes("set_config_option"),
      10_000,
    );
  }
}

export function isAcpReady(ctx: AcpCtx): boolean {
  return Boolean(ctx.sessionId);
}

// ── Inbound parsing ────────────────────────────────────────────────

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function summarize(input: unknown, max = 120): string {
  if (input === null || input === undefined) return "";
  let s: string;
  try {
    s = typeof input === "string" ? input : JSON.stringify(input);
  } catch {
    s = String(input);
  }
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function jsonReply(id: number | string, result: unknown): string {
  return JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n";
}

function jsonErrorReply(
  id: number | string,
  code: number,
  message: string,
): string {
  return (
    JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n"
  );
}

/**
 * Deterministic non-interactive permission policy: prefer an `allow_once`
 * option, then `allow_always`, then the first offered option; when the
 * agent offers nothing, answer `cancelled`. Tool execution is already
 * gated by whoever spawned the worker, so allow_once is the safe default.
 */
export function pickAcpPermissionOption(
  options: { optionId?: string; kind?: string }[] | undefined,
): { outcome: "selected"; optionId: string } | { outcome: "cancelled" } {
  const opts = (options ?? []).filter((o) => typeof o.optionId === "string");
  if (opts.length === 0) return { outcome: "cancelled" };
  const pick =
    opts.find((o) => o.kind === "allow_once") ??
    opts.find((o) => o.kind === "allow_always") ??
    opts[0];
  return { outcome: "selected", optionId: pick.optionId as string };
}

export function parseAcpLine(line: string, ctx: AcpCtx): ParseResult {
  const trimmed = line.trim();
  if (!trimmed) return { events: [] };

  let msg: JsonRpcInbound;
  try {
    msg = JSON.parse(trimmed) as JsonRpcInbound;
  } catch {
    return {
      events: [
        {
          kind: "error",
          payload: {
            message: "Failed to parse ACP stdout line",
            raw_excerpt: trimmed.slice(0, 200),
          },
        },
      ],
    };
  }

  // (1) Agent-to-client request: method AND id → must reply
  if (msg.method && msg.id !== undefined) {
    return handleAcpServerRequest(msg);
  }
  // (2) Response to our outgoing request: id present, no method
  if (msg.id !== undefined && msg.method === undefined) {
    return handleAcpResponse(msg, ctx);
  }
  // (3) Notification
  if (msg.method) {
    return handleAcpNotification(msg, ctx);
  }
  return { events: [] };
}

function handleAcpServerRequest(msg: JsonRpcInbound): ParseResult {
  if (msg.id === undefined) return { events: [] };
  const id = msg.id;

  if (msg.method === "session/request_permission") {
    const params = msg.params ?? {};
    const toolCall = isObject(params.toolCall) ? params.toolCall : {};
    const options = Array.isArray(params.options)
      ? (params.options as { optionId?: string; kind?: string }[])
      : undefined;
    const outcome = pickAcpPermissionOption(options);
    return {
      events: [
        {
          kind: "progress",
          payload: {
            detail: {
              kind: "permission",
              tool_call_id: toolCall.toolCallId,
              title: summarize(toolCall.title, 200),
              tool_kind: toolCall.kind,
              decision:
                outcome.outcome === "selected"
                  ? `auto:${outcome.optionId}`
                  : "cancelled",
            },
          },
        },
      ],
      side: { reply: [jsonReply(id, { outcome })] },
    };
  }

  // Unknown blocking request (e.g. fs/* or terminal/* we did not
  // advertise): -32601 per JSON-RPC, plus a progress breadcrumb.
  return {
    events: [
      {
        kind: "progress",
        payload: {
          detail: {
            kind: "unsupported_request",
            method: msg.method,
            request_id: id,
          },
        },
      },
    ],
    side: {
      reply: [jsonErrorReply(id, -32601, `Method not found: ${msg.method}`)],
    },
  };
}

function resultSessionId(result: unknown): string | undefined {
  if (!isObject(result)) return undefined;
  if (typeof result.sessionId === "string") return result.sessionId;
  const meta = result._meta;
  if (isObject(meta) && typeof meta.sessionId === "string") {
    return meta.sessionId;
  }
  return undefined;
}

function resultConfigOptions(result: unknown): AcpConfigOption[] {
  if (!isObject(result) || !Array.isArray(result.configOptions)) return [];
  return result.configOptions as AcpConfigOption[];
}

function handleAcpResponse(msg: JsonRpcInbound, ctx: AcpCtx): ParseResult {
  const id = msg.id as number;
  const label = ctx.pending.get(id) ?? "other";
  ctx.pending.delete(id);

  const events: AdapterEvent[] = [];
  const side: ParseResult["side"] = {
    resolved: [{ id, result: msg.result, error: msg.error }],
  };

  if (msg.error) {
    return handleAcpError(id, label, msg, ctx, events, side);
  }

  switch (label) {
    case "initialize":
      ctx.initialized = true;
      if (isObject(msg.result) && isObject(msg.result.agentCapabilities)) {
        ctx.agentCapabilities = msg.result
          .agentCapabilities as AcpAgentCapabilities;
      }
      return { events, side };
    case "session/new":
    case "session/resume":
    case "session/load": {
      const sid = resultSessionId(msg.result) ?? ctx.requestedSessionId;
      if (sid) {
        ctx.sessionId = sid;
        ctx.sessionError = undefined;
        side.persistSessionId = sid;
      }
      const opts = resultConfigOptions(msg.result);
      if (opts.length > 0) ctx.configOptions = opts;
      return { events, side };
    }
    case "session/prompt": {
      ctx.promptIds.delete(id);
      const result: Record<string, unknown> = isObject(msg.result)
        ? msg.result
        : {};
      const stopReason =
        typeof result.stopReason === "string" ? result.stopReason : "end_turn";

      if (ctx.expectedCancelled.delete(id)) {
        // Superseded prompt: its turn was already closed as aborted by
        // the inbox interrupt path — never emit terminal for it.
        return {
          events: [
            {
              kind: "progress",
              payload: {
                detail: {
                  kind: "prompt_superseded",
                  stopReason,
                  request_id: id,
                },
              },
            },
          ],
          side,
        };
      }

      if (stopReason === "cancelled") {
        // Agent cancelled a turn we did not interrupt — surface as error.
        ctx.messageBuf = [];
        return {
          events: [
            {
              kind: "error",
              payload: { message: "ACP turn cancelled by agent", stopReason },
            },
          ],
          side,
        };
      }

      const text = ctx.messageBuf.join("");
      ctx.messageBuf = [];
      if (text && !ctx.messageFlushed) {
        ctx.messageFlushed = true;
        events.push({ kind: "message", payload: { text } });
      }
      events.push({
        kind: "done",
        payload: {
          stopReason,
          ...(isObject(result.usage) ? { usage: result.usage } : {}),
        },
      });
      return { events, side };
    }
    case "set_config_option": {
      const opts = resultConfigOptions(msg.result);
      if (opts.length > 0) ctx.configOptions = opts;
      return { events, side };
    }
    default: {
      // Untracked id: sniff the result shape so out-of-sync pending maps
      // (dev trace replay, late duplicate responses) still route sanely.
      if (isObject(msg.result) && typeof msg.result.stopReason === "string") {
        // A session/prompt response we didn't send — process it like a
        // prompt completion but without claiming our promptIds.
        const result = msg.result;
        const stopReason = result.stopReason as string;
        const text = ctx.messageBuf.join("");
        ctx.messageBuf = [];
        if (text && !ctx.messageFlushed) {
          ctx.messageFlushed = true;
          events.push({ kind: "message", payload: { text } });
        }
        events.push({
          kind: "done",
          payload: {
            stopReason,
            ...(isObject(result.usage) ? { usage: result.usage } : {}),
          },
        });
        return { events, side };
      }
      const sid = resultSessionId(msg.result);
      if (sid) {
        ctx.sessionId = sid;
        side.persistSessionId = sid;
        const opts = resultConfigOptions(msg.result);
        if (opts.length > 0) ctx.configOptions = opts;
      }
      return { events, side };
    }
  }
}

function handleAcpError(
  id: number,
  label: PendingLabel,
  msg: JsonRpcInbound,
  ctx: AcpCtx,
  events: AdapterEvent[],
  side: ParseResult["side"],
): ParseResult {
  const errMsg = msg.error?.message ?? "unknown error";
  const authSuffix = ctx.target?.authHint ? ` — ${ctx.target.authHint}` : "";

  switch (label) {
    case "initialize":
      ctx.initError = errMsg;
      return {
        events: [
          {
            kind: "progress",
            payload: {
              detail: {
                kind: "handshake_error",
                method: "initialize",
                message: errMsg,
              },
            },
          },
        ],
        side,
      };
    case "session/new":
    case "session/resume":
    case "session/load":
      // Session acquisition failure — handshake decides whether to fall
      // back (resume→load→new), so no terminal error here.
      ctx.sessionError = errMsg;
      return {
        events: [
          {
            kind: "progress",
            payload: {
              detail: {
                kind: "session_acquire_failed",
                method: label,
                message: errMsg,
                code: msg.error?.code,
              },
            },
          },
        ],
        side,
      };
    case "session/prompt": {
      ctx.promptIds.delete(id);
      if (ctx.expectedCancelled.delete(id)) {
        return {
          events: [
            {
              kind: "progress",
              payload: {
                detail: {
                  kind: "prompt_superseded",
                  error: errMsg,
                  request_id: id,
                },
              },
            },
          ],
          side,
        };
      }
      ctx.messageBuf = [];
      return {
        events: [
          {
            kind: "error",
            payload: {
              message: `ACP prompt failed (id=${id}): ${errMsg}${authSuffix}`,
              code: msg.error?.code,
            },
          },
        ],
        side,
      };
    }
    default:
      // set_config_option / other failures are advisory — progress only.
      return {
        events: [
          {
            kind: "progress",
            payload: {
              detail: {
                kind: "rpc_error",
                method: label,
                request_id: id,
                message: errMsg,
                code: msg.error?.code,
              },
            },
          },
        ],
        side,
      };
  }
}

function contentText(content: unknown): string | undefined {
  if (!isObject(content)) return undefined;
  if (content.type === "text" && typeof content.text === "string") {
    return content.text;
  }
  return undefined;
}

function handleAcpNotification(msg: JsonRpcInbound, ctx: AcpCtx): ParseResult {
  const method = msg.method as string;

  if (method === "session/update") {
    return handleSessionUpdate(msg, ctx);
  }

  // Private/unknown notifications (`_x.ai/*`, `_auth/*`, …): progress
  // breadcrumb, never a terminal event, never a reply.
  return {
    events: [
      {
        kind: "progress",
        payload: {
          detail: {
            kind: "notification",
            method,
            params: summarize(msg.params),
          },
        },
      },
    ],
  };
}

function handleSessionUpdate(msg: JsonRpcInbound, ctx: AcpCtx): ParseResult {
  const params = msg.params ?? {};
  const update = isObject(params.update) ? params.update : {};
  const kind = update.sessionUpdate as string | undefined;

  switch (kind) {
    case "agent_message_chunk": {
      const text = contentText(update.content);
      if (!text) return { events: [] };
      ctx.messageBuf.push(text);
      return {
        events: [
          {
            kind: "progress",
            payload: {
              detail: {
                kind: "output",
                stream_id: update.messageId,
                text_delta: text,
              },
            },
          },
        ],
      };
    }
    case "agent_thought_chunk": {
      const text = contentText(update.content);
      if (!text) return { events: [] };
      return {
        events: [
          {
            kind: "progress",
            payload: {
              detail: {
                kind: "reasoning",
                stream_id: update.messageId,
                text_delta: text,
              },
            },
          },
        ],
      };
    }
    case "tool_call":
      return {
        events: [
          {
            kind: "progress",
            payload: {
              detail: {
                kind: "tool_call",
                tool_call_id: update.toolCallId,
                tool_kind: update.kind,
                title: summarize(update.title, 200),
                status: update.status,
              },
            },
          },
        ],
      };
    case "tool_call_update":
      return {
        events: [
          {
            kind: "progress",
            payload: {
              detail: {
                kind: "tool_call_update",
                tool_call_id: update.toolCallId,
                title: update.title ? summarize(update.title, 200) : undefined,
                status: update.status,
              },
            },
          },
        ],
      };
    case "plan":
      return {
        events: [
          {
            kind: "progress",
            payload: {
              detail: {
                kind: "plan",
                entries: Array.isArray(update.entries)
                  ? update.entries.length
                  : 0,
              },
            },
          },
        ],
      };
    case "current_mode_update":
      return {
        events: [
          {
            kind: "progress",
            payload: {
              detail: { kind: "mode", mode: update.currentModeId },
            },
          },
        ],
      };
    default:
      // user_message_chunk, session_info_update, usage_update,
      // available_commands_update, unknown updates — silent.
      return { events: [] };
  }
}
