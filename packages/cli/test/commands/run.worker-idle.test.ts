/**
 * The runner's two clocks (R5): the wall clock bounds a ticket that legitimately
 * runs long, the idle clock bounds a worker that says NOTHING at all. Both live
 * in `waitForTerminal`, which is driven here through an injected event source —
 * no channel, no provider, no AI.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createChannel } from "../../src/commands/channel/create.js";
import type { ChannelEvent } from "../../src/commands/channel/store/events.js";
import { eventsPath } from "../../src/commands/channel/store/paths.js";
import { waitForTerminal } from "../../src/commands/run/worker.js";

const WORKER = "implementer-01-01-alpha";

function event(kind: string, extra: Record<string, unknown> = {}): ChannelEvent {
  return { kind, by: WORKER, ...extra } as unknown as ChannelEvent;
}

/**
 * Emits `steps` with the given gaps between them, then goes silent forever.
 * Every await is abort-aware so a stopped clock ends the iteration.
 */
function source(steps: { delayMs: number; ev?: ChannelEvent }[]) {
  return async function* (signal: AbortSignal): AsyncGenerator<ChannelEvent> {
    for (const step of steps) {
      await sleep(step.delayMs, signal);
      if (signal.aborted) return;
      if (step.ev) yield step.ev;
    }
    await new Promise<void>((resolve) => {
      if (signal.aborted) return resolve();
      signal.addEventListener("abort", () => resolve(), { once: true });
    });
  };
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

describe("waitForTerminal — the idle clock", () => {
  it("gives up on a silent worker without waiting out the wall clock", async () => {
    // Before R5 a wedged worker cost the full 30-minute default; idle is the
    // channel supervisor's knob, now honoured by the runner too.
    const started = Date.now();
    const wait = await waitForTerminal("run-test", WORKER, 60_000, {
      idleTimeoutMs: 60,
      source: source([]),
    });
    const elapsed = Date.now() - started;

    expect(wait.ok).toBe(false);
    expect(wait.error).toMatch(/idle for 60ms/);
    expect(wait.error).toMatch(/channel.worker_guard.idle_timeout/);
    expect(elapsed).toBeLessThan(3_000);
  });

  it("re-arms the idle clock on every event, so a busy worker is never idle", async () => {
    // Two 40ms gaps under a 120ms idle budget: silence never accumulates.
    const wait = await waitForTerminal("run-test", WORKER, 60_000, {
      idleTimeoutMs: 120,
      source: source([
        { delayMs: 40, ev: event("message", { text: "still working" }) },
        { delayMs: 40, ev: event("done") },
      ]),
    });

    expect(wait.ok).toBe(true);
  });

  it("lets the wall clock decide when idle cleanup is disabled", async () => {
    // `0` disables idle in the guard policy as well — same knob, same meaning.
    const wait = await waitForTerminal("run-test", WORKER, 60, {
      idleTimeoutMs: 0,
      source: source([]),
    });

    expect(wait.ok).toBe(false);
    expect(wait.error).toMatch(/timeout after 60ms waiting for/);
  });

  it("still reports the worker's own terminal events first", async () => {
    const errored = await waitForTerminal("run-test", WORKER, 5_000, {
      idleTimeoutMs: 200,
      source: source([{ delayMs: 10, ev: event("error", { message: "provider exited 1" }) }]),
    });
    expect(errored.error).toContain("provider exited 1");

    const killed = await waitForTerminal("run-test", WORKER, 5_000, {
      idleTimeoutMs: 200,
      source: source([{ delayMs: 10, ev: event("killed", { reason: "budget" }) }]),
    });
    expect(killed.error).toContain("killed: budget");
  });
});

describe("waitForTerminal — the real event source", () => {
  // Lifecycle events are recorded `by: "supervisor:<worker>"`; a crash during
  // the ACP handshake can land them on disk BEFORE the watcher subscribes.
  // Both must still end the wait — the dogfood run hung ~30 minutes when a
  // supervisor-written handshake error slipped the worker-name filter.
  let tmpDir: string;
  let projectDir: string;
  let oldRoot: string | undefined;
  let oldProject: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "omtre-run-worker-test-"));
    projectDir = path.join(tmpDir, "project");
    fs.mkdirSync(projectDir);
    oldRoot = process.env.OMTRE_CHANNEL_ROOT;
    oldProject = process.env.OMTRE_CHANNEL_PROJECT;
    process.env.OMTRE_CHANNEL_ROOT = path.join(tmpDir, "channels");
    delete process.env.OMTRE_CHANNEL_PROJECT;
    vi.spyOn(process, "cwd").mockReturnValue(projectDir);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (oldRoot === undefined) delete process.env.OMTRE_CHANNEL_ROOT;
    else process.env.OMTRE_CHANNEL_ROOT = oldRoot;
    if (oldProject === undefined) delete process.env.OMTRE_CHANNEL_PROJECT;
    else process.env.OMTRE_CHANNEL_PROJECT = oldProject;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("sees a supervisor-written terminal event already on disk", async () => {
    const channel = "run-real-source";
    await createChannel(channel, { by: "main" });
    fs.appendFileSync(
      eventsPath(channel),
      `${JSON.stringify({
        seq: 4,
        ts: new Date().toISOString(),
        kind: "error",
        by: `supervisor:${WORKER}`,
        message: "handshake failed: ACP initialize did not respond within 30s",
      })}\n`,
    );

    const wait = await waitForTerminal(channel, WORKER, 5_000, {
      idleTimeoutMs: 2_000,
    });
    expect(wait.ok).toBe(false);
    expect(wait.error).toContain("handshake failed");
  });

  it("sees a supervisor-written killed event", async () => {
    const channel = "run-real-source-killed";
    await createChannel(channel, { by: "main" });
    fs.appendFileSync(
      eventsPath(channel),
      `${JSON.stringify({
        seq: 5,
        ts: new Date().toISOString(),
        kind: "killed",
        by: `supervisor:${WORKER}`,
        reason: "crash",
      })}\n`,
    );

    const wait = await waitForTerminal(channel, WORKER, 5_000, {
      idleTimeoutMs: 2_000,
    });
    expect(wait.ok).toBe(false);
    expect(wait.error).toContain("killed: crash");
  });
});
