/**
 * Contract tests for the single-ticket runner (`runTicket`) and its
 * fail-closed dispatch resolution (`resolveDispatch`).
 *
 * The dispatch chain is the roster contract: --worker/--model (this
 * invocation) → task.json meta.worker/model/effort → the agent card's
 * frontmatter → config.yaml worker_default → mechanical refusal with a fix
 * hint. No layer may invent a worker on its own.
 */

import { describe, expect, it } from "vitest";

import {
  normalizeTicketOptions,
  runTicket,
  type RunnerPorts,
} from "../../src/commands/run.js";
import {
  parseWorkerDefault,
  resolveDispatch,
  type AgentCardInfo,
  type DispatchPorts,
} from "../../src/commands/run/dispatch.js";
import type { LedgerInput } from "../../src/commands/run/ledger.js";
import type {
  WorkerOutcome,
  WorkerRequest,
} from "../../src/commands/run/worker.js";

const ROOT = "/repo";
const DIR = "01-01-alpha";
const WT = `${ROOT}/.trellis/.runtime/worktrees/${DIR}`;

// ---------------------------------------------------------------------------
// resolveDispatch — the roster chain
// ---------------------------------------------------------------------------

function dispatchPorts(overrides: Partial<DispatchPorts> = {}): DispatchPorts {
  return {
    taskMeta: () => ({}),
    agentCard: () => null,
    workerDefault: () => null,
    ...overrides,
  };
}

describe("resolveDispatch — precedence", () => {
  const implCard: AgentCardInfo = {
    provider: "claude",
    model: "card-model",
    effort: "low",
  };

  it("meta.worker names the card; the card supplies provider/model/effort", () => {
    const out = resolveDispatch(
      DIR,
      {},
      dispatchPorts({
        taskMeta: () => ({ worker: "implement" }),
        agentCard: (name) => (name === "implement" ? implCard : null),
        workerDefault: () => "other-card",
      }),
    );
    expect(out).toEqual({
      ok: true,
      dispatch: {
        provider: "claude",
        agent: "implement",
        model: "card-model",
        effort: "low",
      },
    });
  });

  it("meta.model and meta.effort override the card values", () => {
    const out = resolveDispatch(
      DIR,
      {},
      dispatchPorts({
        taskMeta: () => ({
          worker: "implement",
          model: "ticket-model",
          effort: "high",
        }),
        agentCard: () => implCard,
      }),
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.dispatch.model).toBe("ticket-model");
      expect(out.dispatch.effort).toBe("high");
    }
  });

  it("falls back to worker_default when the ticket names no card", () => {
    const out = resolveDispatch(
      DIR,
      {},
      dispatchPorts({
        agentCard: (name) => (name === "backup" ? { provider: "codex" } : null),
        workerDefault: () => "backup",
      }),
    );
    expect(out).toEqual({
      ok: true,
      dispatch: {
        provider: "codex",
        agent: "backup",
        model: undefined,
        effort: undefined,
      },
    });
  });

  it("--worker wins over meta.worker and worker_default", () => {
    const out = resolveDispatch(
      DIR,
      { worker: "cli-card" },
      dispatchPorts({
        taskMeta: () => ({ worker: "meta-card" }),
        agentCard: (name) =>
          name === "cli-card" ? { provider: "claude" } : null,
        workerDefault: () => "backup",
      }),
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.dispatch.agent).toBe("cli-card");
  });

  it("--model wins over meta.model and the card", () => {
    const out = resolveDispatch(
      DIR,
      { model: "cli-model" },
      dispatchPorts({
        taskMeta: () => ({ worker: "implement", model: "ticket-model" }),
        agentCard: () => implCard,
      }),
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.dispatch.model).toBe("cli-model");
  });

  it("--provider wins over the card frontmatter", () => {
    const out = resolveDispatch(
      DIR,
      { provider: "codex" },
      dispatchPorts({
        taskMeta: () => ({ worker: "implement" }),
        agentCard: () => implCard,
      }),
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.dispatch.provider).toBe("codex");
  });
});

describe("resolveDispatch — fail closed, with a fix hint", () => {
  it("refuses when neither meta.worker nor worker_default names a card", () => {
    const out = resolveDispatch(DIR, {}, dispatchPorts());
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error).toContain("meta.worker");
      expect(out.error).toContain("worker_default");
      expect(out.error).toContain("--worker");
    }
  });

  it("refuses when the named card does not exist", () => {
    const out = resolveDispatch(
      DIR,
      {},
      dispatchPorts({
        taskMeta: () => ({ worker: "ghost" }),
        agentCard: () => null,
      }),
    );
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error).toContain("ghost");
      expect(out.error).toContain(".trellis/agents/ghost.md");
    }
  });

  it("refuses when the card names no provider and no --provider is given", () => {
    const out = resolveDispatch(
      DIR,
      {},
      dispatchPorts({
        taskMeta: () => ({ worker: "implement" }),
        agentCard: () => ({ model: "x" }),
      }),
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toContain("provider");
  });

  it("refuses a provider that is not in the registry", () => {
    const out = resolveDispatch(
      DIR,
      {},
      dispatchPorts({
        taskMeta: () => ({ worker: "implement" }),
        agentCard: () => ({ provider: "nonexistent-provider" }),
      }),
    );
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error).toContain("nonexistent-provider");
      expect(out.error).toContain("claude");
    }
  });

  it("accepts the acp provider once it is registered", () => {
    const out = resolveDispatch(
      DIR,
      {},
      dispatchPorts({
        taskMeta: () => ({ worker: "implement" }),
        agentCard: () => ({ provider: "acp" }),
      }),
    );
    expect(out.ok).toBe(true);
  });
});

describe("parseWorkerDefault", () => {
  it("reads a top-level scalar", () => {
    expect(
      parseWorkerDefault("autonomy: hands-off\nworker_default: implement\n"),
    ).toBe("implement");
  });

  it("ignores nested keys and comments", () => {
    expect(
      parseWorkerDefault("orchestrator:\n  worker_default: nested\n"),
    ).toBeNull();
    expect(parseWorkerDefault("# worker_default: commented\n")).toBeNull();
  });

  it("tolerates quotes and trailing comments", () => {
    expect(parseWorkerDefault(`worker_default: "check"  # the card\n`)).toBe(
      "check",
    );
  });
});

// ---------------------------------------------------------------------------
// runTicket — one attempt, the ledger pair + the result row
// ---------------------------------------------------------------------------

interface Script {
  workerOk?: boolean;
  verifyVerified?: boolean;
  commitsAhead?: number;
  gate?: { allow?: boolean; reason?: string; tier?: string; code?: string };
  remote?: boolean;
  guardOffending?: string[];
  fields?: Record<string, string | null>;
}

function harness(script: Script = {}) {
  const ledger: LedgerInput[] = [];
  const workerRequests: WorkerRequest[] = [];
  const gitCalls: string[][] = [];
  const taskCalls: string[][] = [];

  const ok = (stdout = "") => ({ status: 0, stdout, stderr: "" });
  const ports: RunnerPorts = {
    task(args) {
      taskCalls.push(args);
      if (args[0] === "run-verify") {
        const verified = script.verifyVerified ?? true;
        return {
          status: verified ? 0 : 1,
          stdout: JSON.stringify({ verified, results: [] }),
          stderr: "",
        };
      }
      return ok();
    },
    git(args) {
      gitCalls.push(args);
      const verb = args[0];
      if (verb === "rev-parse" && args[1] === "--verify")
        return { status: 1, stdout: "", stderr: "" };
      if (verb === "rev-parse") return ok("abc1234\n");
      if (verb === "rev-list") return ok(`${script.commitsAhead ?? 1}\n`);
      if (verb === "status") return ok("");
      if (verb === "diff") return ok("src/app.ts\n");
      if (verb === "remote") return ok(script.remote ? "origin\n" : "");
      return ok();
    },
    gh: () => ok("https://github.com/o/r/pull/9\n"),
    hasRemote: () => script.remote === true,
    deliveryGate: () => ({
      allow: script.gate?.allow === true,
      reason:
        script.gate?.reason ??
        "tier(hands-off) — push needs supervised-delivery",
      tier: script.gate?.tier ?? "hands-off",
      code: script.gate?.code ?? "tier",
    }),
    commitGuard: (paths) => ({
      ok: !(script.guardOffending ?? []).some((p) => paths.includes(p)),
      offending: paths.filter((p) => (script.guardOffending ?? []).includes(p)),
    }),
    pythonCommand: () => "python",
    taskField: (_dir, field) =>
      script.fields?.[field] ??
      (field === "branch"
        ? "feature/x"
        : field === "base_branch"
          ? "main"
          : null),
    taskMeta: () => ({}),
    agentCard: () => null,
    workerDefault: () => null,
    ticketClosedOnBranch: () => false,
    worktreeOccupied: () => false,
    worktreePath: () => WT,
    pathExists: () => true,
    ticketDocs: () => [],
    async worker(req): Promise<WorkerOutcome> {
      workerRequests.push(req);
      return script.workerOk === false
        ? { ok: false, worker: "w", text: "", error: "worker boom" }
        : { ok: true, worker: "w", text: "done" };
    },
    ledgerAppend: (input) => void ledger.push(input),
    log: () => undefined,
  };
  return { ports, ledger, workerRequests, gitCalls, taskCalls };
}

const DISPATCH = {
  provider: "claude" as const,
  agent: "implement",
  model: "m",
};

describe("runTicket — the structured result", () => {
  it("delivers a verified ticket and reports every required field", async () => {
    const h = harness();
    const { step, result } = await runTicket(DIR, DISPATCH, h.ports);

    expect(step.kind).toBe("archived");
    expect(result).toMatchObject({
      dir: DIR,
      outcome: "delivered",
      code: "delivered",
      strikes: 0,
      dispatch: DISPATCH,
    });
    expect(result.verify).toEqual({
      verified: true,
      reason: undefined,
      exit: 0,
    });
  });

  it("reports a failed attempt with its machine code and one strike", async () => {
    const h = harness({ workerOk: false });
    const { result } = await runTicket(DIR, DISPATCH, h.ports);

    expect(result.outcome).toBe("failed");
    expect(result.code).toBe("worker_failed");
    expect(result.strikes).toBe(1);
    expect(result.detail).toMatch(/worker_failed/);
  });

  it("distinguishes a hands-off deferral from a failure", async () => {
    const h = harness({ remote: true });
    const { result } = await runTicket(DIR, DISPATCH, h.ports);

    expect(result.outcome).toBe("delivery_deferred");
    expect(result.code).toBe("delivery_deferred");
    expect(result.strikes).toBe(0);
    expect(result.verify?.verified).toBe(true);
  });

  it("maps an always-stop halt to the stop-line outcome", async () => {
    const h = harness({ remote: true, guardOffending: ["src/app.ts"] });
    const { result } = await runTicket(DIR, DISPATCH, h.ports);

    expect(result.outcome).toBe("stop-line");
    expect(result.code).toBe("always_stop");
    expect(result.strikes).toBe(0);
  });

  it("fails closed on an undispatchable dispatch before any worktree work", async () => {
    const h = harness();
    const { result } = await runTicket(DIR, {}, h.ports);

    expect(result.outcome).toBe("failed");
    expect(result.code).toBe("dispatch_invalid");
    expect(h.workerRequests).toEqual([]);
    expect(h.gitCalls.some((c) => c[0] === "worktree")).toBe(false);
    // Not an attempt — no started/finished pair, but the result row lands.
    expect(h.ledger.some((l) => l.action === "attempt_started")).toBe(false);
    expect(h.ledger.some((l) => l.action === "attempt_finished")).toBe(false);
    expect(h.ledger.some((l) => l.action === "ticket_result")).toBe(true);
  });
});

describe("runTicket — the ledger rows", () => {
  it("wraps every real attempt in attempt_started/attempt_finished and one ticket_result", async () => {
    const h = harness({ workerOk: false });
    const { result } = await runTicket(DIR, DISPATCH, h.ports);

    const started = h.ledger.find((l) => l.action === "attempt_started");
    const finished = h.ledger.find((l) => l.action === "attempt_finished");
    const ticketResult = h.ledger.find((l) => l.action === "ticket_result");

    expect(started?.worker).toBe("implement");
    expect(started?.detail).toContain("provider=claude");
    expect(finished?.reason).toBe("failed:worker_failed");
    expect(ticketResult?.reason).toBe("failed:worker_failed");
    // The ledger row carries the same JSON the CLI prints on stdout.
    expect(JSON.parse(ticketResult?.detail ?? "")).toEqual(result);
  });

  it("keeps the mechanical pipeline rows in order inside the attempt pair", async () => {
    const h = harness();
    await runTicket(DIR, DISPATCH, h.ports);

    expect(h.ledger.map((l) => l.action)).toEqual([
      "attempt_started",
      "worktree",
      "ticket_start",
      "worker",
      "verify",
      "delivery",
      "archived",
      "attempt_finished",
      "ticket_result",
    ]);
  });
});

// ---------------------------------------------------------------------------
// normalizeTicketOptions — the --ticket flag surface
// ---------------------------------------------------------------------------

describe("normalizeTicketOptions", () => {
  it("requires a ticket dir", () => {
    const out = normalizeTicketOptions({}, ROOT);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/--ticket/);
  });

  it("refuses --agent so it cannot be mistaken for the card override", () => {
    const out = normalizeTicketOptions(
      { ticket: DIR, agent: "implement" },
      ROOT,
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/--worker/);
  });

  it("refuses --until-empty — the loop and the single run are mutually exclusive", () => {
    const out = normalizeTicketOptions(
      { ticket: DIR, untilEmpty: true },
      ROOT,
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/--until-empty/);
  });

  it("refuses an unknown provider", () => {
    const out = normalizeTicketOptions(
      { ticket: DIR, provider: "gemini" },
      ROOT,
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/unknown --provider/);
  });

  it("passes through worker/model/provider overrides", () => {
    const out = normalizeTicketOptions(
      { ticket: DIR, worker: "check", model: "m2", provider: "codex" },
      ROOT,
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.options.worker).toBe("check");
      expect(out.options.model).toBe("m2");
      expect(out.options.provider).toBe("codex");
    }
  });
});
