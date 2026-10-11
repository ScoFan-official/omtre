/**
 * One-shot headless worker for the loop runner.
 *
 * Same primitives as `channel run` (ephemeral channel → spawn → send → wait on
 * the event stream), but it RETURNS an outcome instead of printing and setting
 * `process.exitCode`: a loop needs `ok / text / worker` per ticket, and a
 * failed worker must not end the process that is about to try again.
 *
 * A failed channel is kept for inspection exactly like `channel run` does —
 * it stays `ephemeral`, so `channel prune --ephemeral` reclaims it.
 */

import crypto from "node:crypto";
import fs from "node:fs";

import type { Provider } from "../channel/adapters/index.js";
import { createChannel } from "../channel/create.js";
import { channelRm } from "../channel/rm.js";
import { channelSend } from "../channel/send.js";
import { channelSpawn } from "../channel/spawn.js";
import { channelDir, eventsPath } from "../channel/store/paths.js";
import type { ChannelEvent } from "../channel/store/events.js";
import { watchEvents } from "../channel/store/watch.js";

export interface WorkerRequest {
  /** Task dir name; used to name the channel and to label the ledger. */
  ticket: string;
  /** Working directory the worker runs in — the ticket's worktree. */
  cwd: string;
  prompt: string;
  provider?: Provider;
  agent?: string;
  /**
   * Worker name inside the channel. `channelSpawn` requires one, and without an
   * agent definition there is nothing to fall back to, so the runner names its
   * own implementer.
   */
  workerName?: string;
  model?: string;
  timeoutMs: number;
  /**
   * Idle budget from the channel supervisor's guard policy
   * (`channel.worker_guard.idle_timeout`, same precedence as `channel run`).
   * A worker that produces no events at all is a different failure from one
   * that ran long: it can be given up on in minutes instead of the full wall
   * clock. `0` disables idle cleanup, exactly as it does for the supervisor.
   */
  idleTimeoutMs?: number;
  /** Context files handed to the worker (ticket docs + spec indexes). */
  files?: string[];
  jsonls?: string[];
}

export interface WorkerOutcome {
  ok: boolean;
  worker: string;
  /** The worker's last user-visible message, when there was one. */
  text: string;
  /** Set when the worker failed: kept channel dir for inspection. */
  channelDir?: string;
  error?: string;
}

function channelNameFor(ticket: string): string {
  const slug = ticket
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const rand = crypto.randomBytes(4).toString("hex");
  return `run-${slug || "ticket"}-${rand}`;
}

/** Last `message` event authored by this worker, read back off the store. */
function finalMessage(channelName: string, workerName: string): string {
  const file = eventsPath(channelName);
  if (!fs.existsSync(file)) return "";
  const body = fs.readFileSync(file, "utf-8");
  let candidate: ChannelEvent | undefined;
  for (const raw of body.split("\n")) {
    if (!raw.trim()) continue;
    try {
      const ev = JSON.parse(raw) as ChannelEvent;
      if (ev.kind === "message" && ev.by === workerName) candidate = ev;
    } catch {
      // A torn tail line is expected while the supervisor is mid-write.
    }
  }
  return (candidate as { text?: string } | undefined)?.text ?? "";
}

/**
 * Wait for the worker's terminal event. Two independent clocks:
 *
 *   wall clock (`timeoutMs`)  — the ticket may legitimately run long.
 *   idle clock (`idleTimeoutMs`) — no event AT ALL for this long means the
 *     worker is wedged, and waiting out the wall clock for it is waste.
 *
 * The idle timer re-arms on every event, so a busy worker is never judged idle,
 * and `0` disables it, which is the same knob the channel supervisor exposes.
 * `source` is injectable so the idle path can be driven without a real channel.
 */
export async function waitForTerminal(
  channelName: string,
  workerName: string,
  timeoutMs: number,
  opts: {
    idleTimeoutMs?: number;
    source?: (signal: AbortSignal) => AsyncIterable<ChannelEvent>;
  } = {},
): Promise<{ ok: boolean; error?: string }> {
  const idleTimeoutMs = opts.idleTimeoutMs ?? 0;
  const abort = new AbortController();
  let expired: "wall" | "idle" | undefined;
  let idle: ReturnType<typeof setTimeout> | undefined;

  const armIdle = (): void => {
    if (idleTimeoutMs <= 0) return;
    if (idle !== undefined) clearTimeout(idle);
    idle = setTimeout(() => {
      expired = "idle";
      abort.abort();
    }, idleTimeoutMs);
  };

  const wall = setTimeout(() => {
    expired = "wall";
    abort.abort();
  }, timeoutMs);

  const source =
    opts.source ??
    ((signal: AbortSignal) =>
      watchEvents(channelName, { self: "main", from: [workerName] }, { signal }));

  try {
    armIdle();
    for await (const ev of source(abort.signal)) {
      armIdle();
      if (ev.kind === "done") return { ok: true };
      if (ev.kind === "error") {
        const msg = (ev as { message?: string }).message ?? "(no message)";
        return { ok: false, error: `worker ${workerName} reported error: ${msg}` };
      }
      if (ev.kind === "killed") {
        const reason = (ev as { reason?: string }).reason ?? "(unknown)";
        return { ok: false, error: `worker ${workerName} killed: ${reason}` };
      }
    }
    if (expired === "idle") {
      return {
        ok: false,
        error: `idle for ${idleTimeoutMs}ms — no event from ${workerName} (channel.worker_guard.idle_timeout)`,
      };
    }
    return {
      ok: false,
      error: `timeout after ${timeoutMs}ms waiting for ${workerName} done`,
    };
  } finally {
    clearTimeout(wall);
    if (idle !== undefined) clearTimeout(idle);
  }
}

export async function oneShotWorker(
  req: WorkerRequest,
): Promise<WorkerOutcome> {
  const name = channelNameFor(req.ticket);
  let workerName = "";

  await createChannel(name, {
    by: "main",
    cwd: req.cwd,
    ephemeral: true,
    origin: "run",
  });

  try {
    const spawned = await channelSpawn(name, {
      agent: req.agent,
      provider: req.provider,
      as: req.workerName ?? `implementer-${req.ticket}`,
      cwd: req.cwd,
      model: req.model,
      timeoutMs: req.timeoutMs,
      files: req.files,
      jsonls: req.jsonls,
    });
    workerName = spawned.worker;

    await channelSend(name, { as: "main", to: workerName, text: req.prompt });

    const wait = await waitForTerminal(name, workerName, req.timeoutMs, {
      idleTimeoutMs: req.idleTimeoutMs,
    });
    const text = finalMessage(name, workerName);
    if (!wait.ok) {
      return {
        ok: false,
        worker: workerName,
        text,
        channelDir: channelDir(name),
        error: wait.error,
      };
    }
    await channelRm(name, { force: true });
    return { ok: true, worker: workerName, text };
  } catch (err) {
    return {
      ok: false,
      worker: workerName,
      text: "",
      channelDir: channelDir(name),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
