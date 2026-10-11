/**
 * The runner's two clocks (R5): the wall clock bounds a ticket that legitimately
 * runs long, the idle clock bounds a worker that says NOTHING at all. Both live
 * in `waitForTerminal`, which is driven here through an injected event source —
 * no channel, no provider, no AI.
 */

import { describe, expect, it } from "vitest";

import type { ChannelEvent } from "../../src/commands/channel/store/events.js";
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
