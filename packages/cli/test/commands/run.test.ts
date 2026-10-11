/**
 * Policy tests for the D5 loop runner (`src/commands/run.ts`).
 *
 * The runner is a state machine around three external actors — the frontier,
 * one headless worker per ticket, and git/remote delivery — so these tests
 * drive `runLoop` through fake ports and assert what it actually DID: which
 * task.py verbs it ran and against which repo, what it pushed, what the ledger
 * recorded, and when it stopped the line instead of pushing on.
 *
 * No repo, no worker, no network. `run.dry-run.integration.test.ts` covers the
 * real frontier output shape.
 */

import { describe, expect, it } from "vitest";

import {
  normalizeOptions,
  parsePorcelain,
  runLoop,
  type FrontierEntry,
  type RunOptions,
  type RunnerPorts,
} from "../../src/commands/run.js";
import type { LedgerInput } from "../../src/commands/run/ledger.js";
import type { WorkerOutcome, WorkerRequest } from "../../src/commands/run/worker.js";

const ROOT = "/repo";
const wtOf = (dir: string): string => `${ROOT}/.trellis/.runtime/worktrees/${dir}`;
const OID = "abc1234def5678";

interface Script {
  ready?: FrontierEntry[];
  cycles?: string[][];
  /** dir → task.json field → value; overrides the branch/base defaults. */
  fields?: Record<string, Record<string, string | null>>;
  remote?: boolean;
  /** `false` always fails; an array is consumed one worker call at a time. */
  workerOk?: boolean | boolean[];
  verifyVerified?: boolean;
  /** How many commits the worker left ahead of base (default 1). */
  commitsAhead?: number;
  /** Uncommitted paths the worker left in the tree (`git status --porcelain`). */
  dirty?: string[];
  /** Directories whose worktree already exists before the run starts. */
  existingWorktrees?: string[];
  /** Directories whose branch already archived them (a previous run). */
  closedOnBranch?: string[];
  /**
   * CLAI-8 answer for the ticket branch. Default: tier refuses any push.
   * `code` is the machine refusal class; leave it out and the fake derives it
   * from `reason` the way `delivery_decision` does.
   */
  gate?: { allow?: boolean; reason?: string; tier?: string; code?: string };
  /** Paths the branch carries relative to base (`git diff --name-only`). */
  branchFiles?: string[];
  /** Paths CLAI-10 `check-commit` should report as forbidden (fake rule list). */
  guardOffending?: string[];
  /** Make `check-commit` unanswerable — the runner must treat that as refusal. */
  guardUnreadable?: boolean;
  /** Make the Nth `git push` (1-based) fail. */
  pushFail?: number;
  /** What `gh pr create` prints. Default: a real-looking PR URL. */
  ghOutput?: string;
  ghExit?: number;
}

interface Harness {
  ports: RunnerPorts;
  taskCalls: { args: string[]; cwd?: string }[];
  gitCalls: { args: string[]; cwd?: string }[];
  ghCalls: string[][];
  gateCalls: string[];
  guardQueries: string[];
  workerRequests: WorkerRequest[];
  pushed: string[][];
  stagingCalls: string[][];
  ledger: LedgerInput[];
  logs: string[];
  worktreeAdds: number;
}

function baseOptions(overrides: Partial<RunOptions> = {}): RunOptions {
  return {
    root: ROOT,
    maxTickets: 5,
    untilEmpty: true,
    dryRun: false,
    provider: "claude",
    workerTimeoutMs: 60000,
    failThreshold: 3,
    ...overrides,
  };
}

function harness(script: Script = {}): Harness {
  const h: Harness = {
    taskCalls: [],
    gitCalls: [],
    ghCalls: [],
    gateCalls: [],
    guardQueries: [],
    workerRequests: [],
    pushed: [],
    stagingCalls: [],
    ledger: [],
    logs: [],
    worktreeAdds: 0,
    ports: undefined as unknown as RunnerPorts,
  };

  const created = new Set<string>();
  const existing = new Set<string>(script.existingWorktrees ?? []);
  // A ticket archived by this run is closed on its branch; `closedOnBranch`
  // seeds the same fact from an earlier run.
  const archivedDirs = new Set<string>(script.closedOnBranch ?? []);
  const workerResults: boolean[] =
    typeof script.workerOk === "boolean" || script.workerOk === undefined
      ? []
      : [...script.workerOk];
  let workerCalls = 0;

  const ok = (stdout = ""): { status: number; stdout: string; stderr: string } => ({
    status: 0,
    stdout,
    stderr: "",
  });

  const ports: RunnerPorts = {
    task(args, cwd) {
      h.taskCalls.push({ args, cwd });
      if (args[0] === "frontier") {
        return ok(
          JSON.stringify({
            ready: script.ready ?? [],
            blocked: [],
            cycles: script.cycles ?? [],
          }),
        );
      }
      if (args[0] === "run-verify") {
        const verified = script.verifyVerified ?? true;
        return {
          status: verified ? 0 : 1,
          stdout: JSON.stringify({ verified, results: [] }),
          stderr: "",
        };
      }
      if (args[0] === "archive") {
        archivedDirs.add(args[1] as string);
      }
      return ok();
    },
    git(args, cwd) {
      h.gitCalls.push({ args, cwd });
      const verb = args[0];
      if (verb === "rev-parse" && args[1] === "--verify") return { status: 1, stdout: "", stderr: "" };
      if (verb === "worktree" && args[1] === "add") {
        h.worktreeAdds += 1;
        created.add(args[2] as string);
        return ok();
      }
      if (verb === "worktree" && args[1] === "remove") {
        created.delete(args[args.length - 1] as string);
        return ok();
      }
      if (verb === "rev-parse") return ok(`${OID}\n`);
      if (verb === "rev-list") return ok(`${script.commitsAhead ?? 1}\n`);
      if (verb === "status") {
        return ok((script.dirty ?? []).map((p) => `?? ${p}`).join("\n"));
      }
      if (verb === "add" || verb === "commit") {
        h.stagingCalls.push(args);
        return ok();
      }
      if (verb === "push") {
        h.pushed.push(args);
        return script.pushFail === h.pushed.length
          ? { status: 1, stdout: "", stderr: "remote: denied" }
          : ok();
      }
      if (verb === "remote") return ok(script.remote ? "origin\thttps://example.invalid/o/r.git (fetch)\n" : "");
      if (verb === "diff") return ok((script.branchFiles ?? []).join("\n"));
      return ok();
    },
    gh(args) {
      h.ghCalls.push(args);
      return {
        status: script.ghExit ?? 0,
        stdout: script.ghOutput ?? "https://github.com/o/r/pull/9\n",
        stderr: "",
      };
    },
    hasRemote() {
      return script.remote === true;
    },
    deliveryGate(ref) {
      h.gateCalls.push(ref);
      const reason = script.gate?.reason ?? "tier(hands-off) — push needs supervised-delivery";
      // The fake plays `delivery_decision`: it emits the same refusal class the
      // Python gate derives from its own reason string. Production code reads
      // `code`, never the prose.
      const derived =
        script.gate?.allow === true
          ? "allowed"
          : reason.startsWith("tier(")
            ? "tier"
            : reason.startsWith("protected_ref")
              ? "protected"
              : reason.startsWith("malformed_auto_push_refs")
                ? "config"
                : reason.startsWith("empty_auto_push_refs")
                  ? "deferred"
                  : reason.startsWith("outside_auto_push_refs")
                    ? "whitelist"
                    : "unreadable";
      return {
        allow: script.gate?.allow === true,
        reason,
        tier: script.gate?.tier ?? "hands-off",
        code: script.gate?.code ?? derived,
      };
    },
    /**
     * The fake plays `task.py check-commit` (CLAI-10). Production code holds no
     * copy of the rule list, so neither may the harness invent one: it either
     * reports the paths a test nominated, or cannot answer at all.
     */
    commitGuard(paths) {
      h.guardQueries.push(paths.join("\n"));
      if (script.guardUnreadable === true) return { ok: false, offending: paths };
      const offending = paths.filter((p) => (script.guardOffending ?? []).includes(p));
      return { ok: offending.length === 0, offending };
    },
    pythonCommand() {
      return "python";
    },
    taskField(dir, field) {
      const table = script.fields?.[dir];
      if (table) return table[field] ?? null;
      if (field === "branch") return `feature/${dir}`;
      if (field === "base_branch") return "main";
      return null;
    },
    worktreePath: wtOf,
    worktreeOccupied: (dir) => (script.existingWorktrees ?? []).includes(wtOf(dir)),
    ticketClosedOnBranch: (_branch, dir) => archivedDirs.has(dir),
    pathExists(target) {
      // Separator-agnostic: the runner builds these with path.join, which uses
      // native separators on Windows while the fixture paths are POSIX.
      const normalized = target.replace(/\\/g, "/");
      for (const wt of [...created, ...existing]) {
        if (normalized === wt || normalized.startsWith(`${wt}/`)) return true;
      }
      return false;
    },
    ticketDocs(dir) {
      return [`${ROOT}/.trellis/tasks/${dir}/prd.md`, `${ROOT}/.trellis/tasks/${dir}/implement.md`];
    },
    async worker(req): Promise<WorkerOutcome> {
      h.workerRequests.push(req);
      workerCalls += 1;
      const okFlag =
        workerResults.length > 0 ? workerResults[workerCalls - 1] : (script.workerOk ?? true);
      return okFlag === false
        ? { ok: false, worker: "worker-1", text: "", error: "worker boom: provider exited 1" }
        : { ok: true, worker: "worker-1", text: "implemented and committed" };
    },
    ledgerAppend: (input) => h.ledger.push(input),
    log: (message) => h.logs.push(message),
  };

  h.ports = ports;
  return h;
}

describe("runLoop — the success path", () => {
  it("takes the frontier head, works in its worktree, verifies and archives there", async () => {
    const h = harness({ ready: [{ dir: "01-01-alpha", priority: "P0" }] });
    const result = await runLoop(baseOptions(), h.ports);

    expect(result).toMatchObject({
      stopped: "no_grabbable_ticket",
      attempted: 1,
      archived: 1,
      failed: 0,
    });
    expect(h.worktreeAdds).toBe(1);
    const add = h.gitCalls.find((c) => c.args[0] === "worktree" && c.args[1] === "add");
    expect(add?.args).toEqual(["worktree", "add", wtOf("01-01-alpha"), "-b", "feature/01-01-alpha", "main"]);
    expect(h.workerRequests[0]?.cwd).toBe(wtOf("01-01-alpha"));
    // No remote at all: the commit on the ticket branch is the accounting, so
    // archiving there is legal and nothing is pushed.
    expect(h.pushed).toEqual([]);
    const archive = h.taskCalls.find((c) => c.args[0] === "archive");
    expect(archive?.cwd).toBe(wtOf("01-01-alpha"));
    expect(h.ledger.map((l) => l.action)).toEqual([
      "run_start",
      "worktree",
      "ticket_start",
      "worker",
      "verify",
      "delivery",
      "archived",
      "stop",
    ]);
  });

  it("clears the worktree pointer before the archive commit", async () => {
    const h = harness({ ready: [{ dir: "01-01-alpha" }] });
    await runLoop(baseOptions(), h.ports);

    const order = h.taskCalls.map((c) => `${c.args[0]} ${c.args.slice(1).join(" ")}`);
    const clear = order.indexOf("set-worktree 01-01-alpha -");
    const archive = order.findIndex((line) => line.startsWith("archive "));
    expect(clear).toBeGreaterThanOrEqual(0);
    expect(archive).toBeGreaterThan(clear);
  });

  it("stops after one ticket without --until-empty", async () => {
    const h = harness({ ready: [{ dir: "01-01-alpha" }, { dir: "01-02-beta" }] });
    const result = await runLoop(baseOptions({ untilEmpty: false }), h.ports);

    expect(result.stopped).toBe("single_ticket");
    expect(result.attempted).toBe(1);
    expect(h.worktreeAdds).toBe(1);
  });

  it("caps attempts at --max-tickets", async () => {
    const h = harness({ ready: [{ dir: "01-01-alpha" }, { dir: "01-02-beta" }, { dir: "01-03-gamma" }] });
    const result = await runLoop(baseOptions({ maxTickets: 2 }), h.ports);

    expect(result.attempted).toBe(2);
    expect(result.stopped).toBe("max_tickets");
  });

  it("moves on to the next ticket after archiving one", async () => {
    const h = harness({ ready: [{ dir: "01-01-alpha" }, { dir: "01-02-beta" }] });
    const result = await runLoop(baseOptions(), h.ports);

    expect(result).toMatchObject({ stopped: "no_grabbable_ticket", attempted: 2, archived: 2 });
    expect(h.worktreeAdds).toBe(2);
    expect(h.workerRequests.map((r) => r.ticket)).toEqual(["01-01-alpha", "01-02-beta"]);
  });

  it("curates context before claiming, inside the worktree", async () => {
    const h = harness({ ready: [{ dir: "01-01-alpha" }] });
    await runLoop(baseOptions(), h.ports);

    const verbs = h.taskCalls.map((c) => c.args[0]);
    expect(verbs.indexOf("add-context")).toBeGreaterThanOrEqual(0);
    expect(verbs.indexOf("add-context")).toBeLessThan(verbs.indexOf("start"));
    const injected = h.taskCalls.filter((c) => c.args[0] === "add-context");
    expect(injected.map((c) => c.args[2]).sort()).toEqual(["check", "check", "implement", "implement"]);
    expect(injected.every((c) => c.cwd === wtOf("01-01-alpha"))).toBe(true);
  });
});

describe("runLoop — the stop lines", () => {
  it("grabs nothing when the dependency graph has a cycle", async () => {
    const h = harness({ cycles: [["01-01-alpha", "01-02-beta"]], ready: [{ dir: "01-01-alpha" }] });
    const result = await runLoop(baseOptions(), h.ports);

    expect(result.stopped).toBe("cycle");
    expect(result.attempted).toBe(0);
    expect(h.worktreeAdds).toBe(0);
    expect(h.ledger.some((l) => l.action === "stop" && /cycle/.test(l.reason ?? ""))).toBe(true);
  });

  it("halts the line after three consecutive failures on one ticket", async () => {
    const h = harness({ ready: [{ dir: "01-01-alpha" }], workerOk: false });
    const result = await runLoop(baseOptions(), h.ports);

    expect(result.stopped).toBe("fail_threshold");
    expect(result.failed).toBe(3);
    expect(result.archived).toBe(0);
    // The human-facing mark lands in the ORCHESTRATING repo (no cwd): that is
    // the copy the board reads when the line is handed back.
    const marked = h.taskCalls.find((c) => c.args[0] === "set-meta");
    expect(marked?.args).toEqual(["set-meta", "01-01-alpha", "triage", "ready-for-human"]);
    expect(marked?.cwd).toBeUndefined();
    expect(h.ledger.some((l) => l.action === "blocked" && /worker_failed/.test(l.reason ?? ""))).toBe(true);
  });

  it("resets strikes once the retried ticket passes", async () => {
    const h = harness({ ready: [{ dir: "01-01-alpha" }], workerOk: [false, false, true] });
    const result = await runLoop(baseOptions(), h.ports);

    expect(result.archived).toBe(1);
    expect(result.failed).toBe(2);
    expect(result.stopped).toBe("no_grabbable_ticket");
    expect(h.taskCalls.some((c) => c.args[0] === "set-meta")).toBe(false);
  });

  it("never delivers on a failed verification contract", async () => {
    const h = harness({
      ready: [{ dir: "01-01-alpha" }],
      remote: true,
      verifyVerified: false,
      gate: { allow: true, reason: "whitelist(feature/*)", tier: "supervised-delivery" },
    });
    const result = await runLoop({ ...baseOptions(), failThreshold: 1 }, h.ports);

    expect(result.stopped).toBe("fail_threshold");
    expect(h.pushed).toEqual([]);
    expect(h.ghCalls).toEqual([]);
    expect(h.taskCalls.some((c) => c.args[0] === "archive")).toBe(false);
    expect(h.ledger.some((l) => l.action === "verify" && l.exit !== 0)).toBe(true);
  });

  it("defers and stops at the ticket when the tier does not permit push", async () => {
    // AC5: outside supervised-delivery nothing is pushed. This is ordinary, not
    // anomalous, so the ticket stays open on its branch and the line halts
    // there rather than striking out.
    const h = harness({ ready: [{ dir: "01-01-alpha" }], remote: true });
    const result = await runLoop(baseOptions(), h.ports);

    expect(result.stopped).toBe("delivery_deferred");
    expect(result.attempted).toBe(1);
    expect(result.archived).toBe(0);
    expect(h.pushed).toEqual([]);
    expect(h.gateCalls).toEqual(["feature/01-01-alpha"]);
    expect(h.taskCalls.some((c) => c.args[0] === "archive")).toBe(false);
    expect(h.ledger.find((l) => l.action === "delivery")?.reason).toMatch(/^deferred: tier\(hands-off\)/);
  });

  it("halts for adjudication when the gate protects the ref", async () => {
    // AC4: a ticket whose branch IS the default branch must be refused with a
    // trace, and the whole line stops — not a warning walked past.
    const h = harness({
      ready: [{ dir: "01-01-alpha" }],
      remote: true,
      fields: { "01-01-alpha": { branch: "main", base_branch: "develop" } },
      gate: { reason: "protected_ref(default_branch=main;remote_head)", tier: "supervised-delivery" },
    });
    const result = await runLoop(baseOptions(), h.ports);

    expect(result.stopped).toBe("push_refused");
    expect(h.pushed).toEqual([]);
    expect(h.taskCalls.some((c) => c.args[0] === "archive")).toBe(false);
    expect(h.ledger.some((l) => l.action === "delivery" && /refused: protected_ref/.test(l.reason ?? ""))).toBe(
      true,
    );
  });

  it("treats a ref the whitelist never named as an anomaly, not a pass", async () => {
    const h = harness({
      ready: [{ dir: "01-01-alpha" }],
      remote: true,
      gate: { reason: "outside_auto_push_refs", tier: "supervised-delivery" },
    });
    const result = await runLoop(baseOptions(), h.ports);

    expect(result.stopped).toBe("push_refused");
    expect(h.pushed).toEqual([]);
  });

  it("fails closed when the gate answer cannot be read", async () => {
    // An unreadable answer is a refusal, not a routine deferral: nobody is
    // watching for a warning in an unattended run, so the line halts for
    // adjudication and the ledger says refused.
    const h = harness({
      ready: [{ dir: "01-01-alpha" }],
      remote: true,
      gate: { reason: "unreadable_output(traceback: boom)", tier: "unknown" },
    });
    const result = await runLoop(baseOptions(), h.ports);

    expect(result.stopped).toBe("push_refused");
    expect(h.pushed).toEqual([]);
    expect(h.taskCalls.some((c) => c.args[0] === "archive")).toBe(false);
    expect(h.ledger.some((l) => l.action === "delivery" && /refused: unreadable_output/.test(l.reason ?? ""))).toBe(
      true,
    );
  });

  it("refuses a broken whitelist instead of booking it as a routine deferral", async () => {
    // `malformed_auto_push_refs` means config and intent disagree, which is the
    // same class of anomaly as a protected ref — not "the tier said no".
    const h = harness({
      ready: [{ dir: "01-01-alpha" }],
      remote: true,
      gate: {
        reason: "malformed_auto_push_refs(not a list)",
        tier: "supervised-delivery",
        code: "config",
      },
    });
    const result = await runLoop(baseOptions(), h.ports);

    expect(result.stopped).toBe("push_refused");
    expect(h.pushed).toEqual([]);
    expect(h.ledger.some((l) => l.action === "delivery" && /refused: malformed_auto_push_refs/.test(l.reason ?? ""))).toBe(
      true,
    );
  });

  it("defers when an empty whitelist degrades the tier to hands-off", async () => {
    // Documented behaviour, not an anomaly: no whitelist means no push rights.
    const h = harness({
      ready: [{ dir: "01-01-alpha" }],
      remote: true,
      gate: {
        reason: "empty_auto_push_refs(degrades to hands-off)",
        tier: "supervised-delivery",
        code: "deferred",
      },
    });
    const result = await runLoop(baseOptions(), h.ports);

    expect(result.stopped).toBe("delivery_deferred");
    expect(h.ledger.find((l) => l.action === "delivery")?.reason).toMatch(/^deferred: empty_auto_push_refs/);
  });

  it("halts the line when the worker's own commit carries an always-stop path", async () => {
    // The fallback commit checks the working tree, but a worker that committed
    // `.env` itself is not the runner's staging decision — it must still never
    // reach a reviewer as an automated delivery.
    const h = harness({
      ready: [{ dir: "01-01-alpha" }],
      remote: true,
      branchFiles: ["src/app.ts", ".env"],
      guardOffending: [".env"],
      gate: { allow: true, reason: "whitelist(feature/*)", tier: "supervised-delivery" },
    });
    const result = await runLoop(baseOptions(), h.ports);

    expect(result.stopped).toBe("always_stop");
    expect(result.archived).toBe(0);
    expect(h.pushed).toEqual([]);
    expect(h.ghCalls).toEqual([]);
    expect(h.taskCalls.some((c) => c.args[0] === "archive")).toBe(false);
    expect(h.ledger.some((l) => l.action === "stop" && /always_stop/.test(l.reason ?? ""))).toBe(true);
    expect(h.guardQueries.some((q) => q.includes(".env"))).toBe(true);
  });

  it("refuses delivery when the commit gate cannot answer", async () => {
    // Fail closed: an unreadable `check-commit` verdict is a refusal, not a
    // pass, and every path it was asked about is reported as offending.
    const h = harness({
      ready: [{ dir: "01-01-alpha" }],
      remote: true,
      branchFiles: ["src/app.ts"],
      guardUnreadable: true,
      gate: { allow: true, reason: "whitelist(feature/*)", tier: "supervised-delivery" },
    });
    const result = await runLoop(baseOptions(), h.ports);

    expect(result.stopped).toBe("always_stop");
    expect(h.pushed).toEqual([]);
  });

  it("delivers normally when the branch touches nothing protected", async () => {
    const h = harness({
      ready: [{ dir: "01-01-alpha" }],
      remote: true,
      branchFiles: ["src/app.ts", "src/secret-store.test.ts"],
      gate: { allow: true, reason: "whitelist(feature/*)", tier: "supervised-delivery" },
    });
    const result = await runLoop(baseOptions(), h.ports);

    expect(result.archived).toBe(1);
    expect(h.pushed.length).toBe(2);
  });

  it("pushes, opens a ready PR and records the pointer when the gate allows the ref", async () => {
    // AC6 shape: ready PR + pr_url write-back, and the runner never merges.
    const h = harness({
      ready: [{ dir: "01-01-alpha" }],
      remote: true,
      gate: { allow: true, reason: "whitelist(feature/*)", tier: "supervised-delivery" },
    });
    const result = await runLoop(baseOptions(), h.ports);

    expect(result.archived).toBe(1);
    expect(h.pushed).toEqual([
      ["push", "-u", "origin", "feature/01-01-alpha"],
      ["push", "origin", "feature/01-01-alpha"],
    ]);
    expect(h.ghCalls[0]?.slice(0, 2)).toEqual(["pr", "create"]);
    // 定版 rule: the runner's PR arrives ready for review, never draft — and
    // `--ready` is not a flag gh accepts (the live run proved it).
    expect(h.ghCalls[0]).not.toContain("--draft");
    expect(h.ghCalls[0]).not.toContain("--ready");
    expect(h.ghCalls[0]).toContain("--head");
    expect(h.ghCalls[0]).toContain("--base");
    const setPr = h.taskCalls.find((c) => c.args[0] === "set-pr");
    expect(setPr?.args[1]).toBe("01-01-alpha");
    expect(setPr?.args[2]).toBe("https://github.com/o/r/pull/9");
    expect(setPr?.cwd).toBe(wtOf("01-01-alpha"));
  });

  it("refuses to store a review pointer gh did not actually print", async () => {
    const h = harness({
      ready: [{ dir: "01-01-alpha" }],
      remote: true,
      gate: { allow: true, reason: "whitelist(feature/*)", tier: "supervised-delivery" },
      ghOutput: "could not determine which repository to use\n",
    });
    const result = await runLoop({ ...baseOptions(), failThreshold: 1 }, h.ports);

    expect(result.stopped).toBe("fail_threshold");
    expect(h.pushed).toEqual([["push", "-u", "origin", "feature/01-01-alpha"]]);
    expect(h.taskCalls.some((c) => c.args[0] === "set-pr")).toBe(false);
    expect(h.taskCalls.some((c) => c.args[0] === "archive")).toBe(false);
    expect(h.ledger.find((l) => l.action === "blocked")?.reason).toMatch(/pr_url_unreadable/);
  });

  it("treats a closure left unpushed as a failure, not an archived ticket", async () => {
    // The archive commit carries pr_url and the task-dir move; if it cannot
    // reach the remote the PR closes nothing, so the run must say so. This
    // ordering bug is what the live GitHub run exposed.
    const h = harness({
      ready: [{ dir: "01-01-alpha" }],
      remote: true,
      gate: { allow: true, reason: "whitelist(feature/*)", tier: "supervised-delivery" },
      pushFail: 2,
    });
    const result = await runLoop({ ...baseOptions(), failThreshold: 1 }, h.ports);

    expect(result.stopped).toBe("fail_threshold");
    expect(result.archived).toBe(0);
    expect(h.pushed).toHaveLength(2);
    expect(h.ledger.some((l) => l.action === "archived")).toBe(false);
    expect(h.ledger.find((l) => l.action === "blocked")?.reason).toMatch(/post_archive_push_failed/);
  });

  it("leaves a ticket that already has a review pointer untouched", async () => {
    const h = harness({
      ready: [{ dir: "01-01-alpha" }],
      remote: true,
      fields: { "01-01-alpha": { pr_url: "https://github.com/o/r/pull/1" } },
    });
    const result = await runLoop(baseOptions(), h.ports);

    expect(result.stopped).toBe("no_grabbable_ticket");
    expect(result.attempted).toBe(0);
    expect(h.worktreeAdds).toBe(0);
  });

  it("skips a ticket a previous run already archived on its branch", async () => {
    // The orchestrating copy lags until the branch is merged, so the frontier
    // still lists it. Reading the branch is what keeps the loop from re-grabbing
    // work nobody asked for and striking out on a task dir that is not there.
    const h = harness({ ready: [{ dir: "01-01-alpha" }], closedOnBranch: ["01-01-alpha"] });
    const result = await runLoop(baseOptions(), h.ports);

    expect(result.stopped).toBe("no_grabbable_ticket");
    expect(result.attempted).toBe(0);
    expect(h.worktreeAdds).toBe(0);
    expect(h.ledger.some((l) => l.action === "stop" && /already archived on/.test(l.reason ?? "")))
      .toBe(true);
  });

  it("does not stack a worktree onto one that is still there", async () => {
    // A kept worktree means nobody cleaned up a previous attempt yet — skipping
    // it is not a failure, and re-adding on top would clobber the evidence.
    const h = harness({
      ready: [{ dir: "01-01-alpha" }],
      existingWorktrees: [wtOf("01-01-alpha")],
    });
    const result = await runLoop({ ...baseOptions(), failThreshold: 1 }, h.ports);

    expect(h.worktreeAdds).toBe(0);
    expect(result.stopped).toBe("no_grabbable_ticket");
    expect(result.attempted).toBe(0);
    expect(result.failed).toBe(0);
    expect(h.ledger.some((l) => l.action === "stop" && /worktree still holds content/.test(l.reason ?? "")))
      .toBe(true);
  });

  it("fails the ticket when the worker neither committed nor changed the tree", async () => {
    // The worker's closing line goes into the reason: its channel is pruned on
    // success, so without this a no-op run leaves no trace of what it claimed.
    const h = harness({ ready: [{ dir: "01-01-alpha" }], commitsAhead: 0 });
    const result = await runLoop({ ...baseOptions(), failThreshold: 1 }, h.ports);

    expect(result.stopped).toBe("fail_threshold");
    expect(result.archived).toBe(0);
    expect(h.taskCalls.some((c) => c.args[0] === "archive")).toBe(false);
    expect(h.ledger.find((l) => l.action === "blocked")?.reason).toMatch(
      /no_work.*worker reported: implemented and committed/,
    );
  });

  it("commits what a sandboxed worker left uncommitted", async () => {
    // codex keeps `.git` read-only in workspace-write: the files land, the
    // commit cannot. Staging is by explicit pathspec, never `git add -A`.
    const h = harness({ ready: [{ dir: "01-01-alpha" }], commitsAhead: 0, dirty: ["greet.txt"] });
    const result = await runLoop(baseOptions(), h.ports);

    expect(result.archived).toBe(1);
    expect(h.stagingCalls[0]).toEqual(["add", "--", "greet.txt"]);
    expect(h.stagingCalls[1]?.[0]).toBe("commit");
    const worker = h.ledger.find((l) => l.action === "worker");
    expect(worker?.detail).toMatch(/runner staged 1 path\(s\)/);
  });

  it("leaves task bookkeeping out of the work commit so it stays revertable", async () => {
    // Claiming a ticket rewrites its own task.json/*.jsonl, and `archive` moves
    // exactly those files. Folding both into one commit makes the work commit
    // un-revertable (rename/delete conflict) — proven on the live run.
    const h = harness({
      ready: [{ dir: "01-01-alpha" }],
      commitsAhead: 0,
      dirty: [".trellis/tasks/01-01-alpha/task.json", "greet.txt"],
    });
    const result = await runLoop(baseOptions(), h.ports);

    expect(result.archived).toBe(1);
    expect(h.stagingCalls[0]).toEqual(["add", "--", "greet.txt"]);
    expect(h.ledger.find((l) => l.action === "worker")?.detail).toMatch(
      /left 1 task-bookkeeping path\(s\) for the archive commit/,
    );
  });

  it("calls a bookkeeping-only run what it is: no work", async () => {
    const h = harness({
      ready: [{ dir: "01-01-alpha" }],
      commitsAhead: 0,
      dirty: [".trellis/tasks/01-01-alpha/check.jsonl"],
    });
    const result = await runLoop({ ...baseOptions(), failThreshold: 1 }, h.ports);

    expect(result.stopped).toBe("fail_threshold");
    expect(h.stagingCalls).toEqual([]);
    expect(h.ledger.find((l) => l.action === "blocked")?.reason).toMatch(
      /only task bookkeeping changed/,
    );
  });

  it("does not touch staging when the worker committed itself", async () => {
    const h = harness({ ready: [{ dir: "01-01-alpha" }], dirty: ["stray.txt"] });
    const result = await runLoop(baseOptions(), h.ports);

    expect(result.archived).toBe(1);
    expect(h.stagingCalls).toEqual([]);
  });

  it("refuses to commit a protected path out of the tree", async () => {
    const h = harness({
      ready: [{ dir: "01-01-alpha" }],
      commitsAhead: 0,
      dirty: [".env.local", "src/app.ts"],
      guardOffending: [".env.local"],
    });
    const result = await runLoop({ ...baseOptions(), failThreshold: 1 }, h.ports);

    expect(result.stopped).toBe("fail_threshold");
    expect(h.stagingCalls).toEqual([]);
    expect(h.taskCalls.some((c) => c.args[0] === "archive")).toBe(false);
    expect(h.ledger.find((l) => l.action === "blocked")?.reason).toMatch(
      /protected_path_in_tree\(\.env\.local/,
    );
  });

  it("refuses to invent a ref for a ticket without branch metadata", async () => {
    const h = harness({ ready: [{ dir: "01-01-alpha" }], fields: { "01-01-alpha": {} } });
    const result = await runLoop({ ...baseOptions(), failThreshold: 1 }, h.ports);

    expect(result.stopped).toBe("fail_threshold");
    expect(h.worktreeAdds).toBe(0);
    expect(h.ledger.some((l) => l.action === "blocked" && /no_branch_metadata/.test(l.reason ?? ""))).toBe(
      true,
    );
  });
});

describe("parsePorcelain — the fallback commit's input", () => {
  it("reads modified, untracked and renamed paths", () => {
    expect(
      parsePorcelain([" M src/a.ts", "?? greet.txt", "R  old.ts -> new.ts", ""].join("\n")),
    ).toEqual(["src/a.ts", "greet.txt", "new.ts"]);
  });

  it("unquotes paths with spaces", () => {
    expect(parsePorcelain('?? "my file.txt"')).toEqual(["my file.txt"]);
  });

  // Which paths are forbidden is `task.py check-commit`'s decision (CLAI-10),
  // asserted against the real script in clai10-check-commit.integration.test.ts:
  // a second copy of that list in TS is exactly the drift this removes.
});

describe("normalizeOptions — the CLI surface refuses ambiguity", () => {
  it("requires a named worker", () => {
    const out = normalizeOptions({ dryRun: true }, ROOT);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/needs --provider/);
  });

  it("rejects a provider with no adapter", () => {
    const out = normalizeOptions({ provider: "gemini" }, ROOT);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/unknown --provider/);
  });

  it("accepts an agent definition in place of a provider", () => {
    const out = normalizeOptions({ agent: "reviewer" }, ROOT);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.options.agent).toBe("reviewer");
  });

  it("defaults the thresholds the contract names", () => {
    const out = normalizeOptions({ provider: "claude" }, ROOT);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.options.maxTickets).toBe(5);
      expect(out.options.failThreshold).toBe(3);
    }
  });

  it("refuses a non-positive count instead of looping forever", () => {
    for (const raw of [{ provider: "claude", maxTickets: "0" }, { provider: "claude", maxTickets: "-2" }]) {
      const out = normalizeOptions(raw, ROOT);
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.error).toMatch(/--max-tickets/);
    }
    const failures = normalizeOptions({ provider: "claude", maxFailures: "x" }, ROOT);
    expect(failures.ok).toBe(false);
  });

  it("parses durations and board filters", () => {
    const out = normalizeOptions({ provider: "claude", board: "deap", timeout: "20m" }, ROOT);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.options.board).toBe("deap");
      expect(out.options.workerTimeoutMs).toBe(20 * 60 * 1000);
    }
  });

  it("ignores a leftover --allow-push instead of keeping a second source of truth", () => {
    // Delivery is config (CLAI-8). Honouring a flag here would let an operator
    // outvote the protected-position rule, which is the whole point of the gate.
    const out = normalizeOptions({ provider: "claude", allowPush: "main" }, ROOT);
    expect(out.ok).toBe(true);
    expect(JSON.stringify(out.ok ? out.options : {})).not.toMatch(/allowPush/);
  });
});

describe("runLoop — dry run", () => {
  it("names the head and mutates nothing", async () => {
    const h = harness({ ready: [{ dir: "01-01-alpha", priority: "P0" }] });
    const result = await runLoop(baseOptions({ dryRun: true }), h.ports);

    expect(result.stopped).toBe("dry_run");
    expect(result.attempted).toBe(0);
    expect(h.worktreeAdds).toBe(0);
    expect(h.workerRequests).toEqual([]);
    expect(h.gitCalls).toEqual([]);
    expect(h.taskCalls.every((c) => c.args[0] === "frontier")).toBe(true);
    expect(h.logs.join("\n")).toContain("01-01-alpha");
  });

  it("filters the frontier by board before choosing a head", async () => {
    const h = harness({ ready: [{ dir: "01-01-alpha" }] });
    await runLoop(baseOptions({ board: "deap", dryRun: true }), h.ports);

    expect(h.taskCalls[0]?.args).toEqual(["frontier", "--json", "--board", "deap"]);
  });

  it("prints the push the config would allow", async () => {
    const h = harness({
      ready: [{ dir: "01-01-alpha" }],
      remote: true,
      gate: { allow: true, reason: "whitelist(feature/*)", tier: "supervised-delivery" },
    });
    await runLoop(baseOptions({ dryRun: true }), h.ports);

    const printed = h.logs.find((line) => line.startsWith("{"));
    expect(printed).toContain("delivery:push(feature/01-01-alpha)+pr");
    expect(printed).toContain("supervised-delivery");
  });

  it("says delivery defers when the tier refuses, and asks the gate for the branch", async () => {
    const h = harness({ ready: [{ dir: "01-01-alpha" }] });
    await runLoop(baseOptions({ dryRun: true }), h.ports);

    const printed = h.logs.find((line) => line.startsWith("{"));
    expect(printed).toContain("delivery:refused(tier(hands-off)");
    expect(h.gateCalls).toEqual(["feature/01-01-alpha"]);
    expect(h.worktreeAdds).toBe(0);
  });
});
