/**
 * `omtre run` — the unattended loop runner (design D5).
 *
 * Takes the frontier head, gives it an isolated worktree, hands it to one
 * headless worker, runs the ticket's own verification contract, and records
 * every step in a run ledger. Delivery is decided by config, not by a flag:
 * `task.py delivery-gate` (CLAI-8) answers for the ticket branch, and only
 * `autonomy: supervised-delivery` with a matching `delivery.auto_push_refs`
 * entry lets the runner push at all (AC5).
 *
 * Why everything happens in the worktree: `.omtre/` is committed content, so
 * a worktree carries its own copy of the task tree. Claim, verify and archive
 * therefore land as commits on the ticket branch, and the orchestrating repo is
 * never mutated — no dirty `task.json`, no half-applied bookkeeping. When the
 * branch is merged by a human, the ticket closes there (PR ≠ 交付). The main
 * repo is read only: for the frontier, and for branch metadata.
 *
 * Stop lines:
 *   - a dependency cycle → stop, grab nothing (frontier exits non-zero)
 *   - N consecutive failures on the same ticket (default 3) → mark it
 *     `triage=ready-for-human` and halt the whole line
 *   - the gate refusing a protected or unlisted ref → halt for adjudication
 *     (AC4); a tier that simply does not push → defer and stop there
 *
 * `runLoop` talks to the world only through `RunnerPorts`, so the policy is
 * testable without a repo, a worker, or a network. The real ports are the thin
 * adapters at the bottom.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { loadTaskRecord } from "@omtre/core/task";

import {
  isProvider,
  listProviders,
  type Provider,
} from "./channel/adapters/index.js";
import { loadAgent } from "./channel/agent-loader.js";
import { resolveWorkerGuardConfig } from "./channel/guard.js";
import { parseDuration } from "./channel/wait.js";
import { resolveSupportedPython } from "./init.js";
import {
  loadWorkerDefault,
  resolveDispatch,
  type AgentCardInfo,
  type TicketDispatch,
} from "./run/dispatch.js";
import { openLedger, type LedgerInput } from "./run/ledger.js";
import {
  oneShotWorker,
  type WorkerOutcome,
  type WorkerRequest,
} from "./run/worker.js";

const DEFAULT_MAX_TICKETS = 5;
const DEFAULT_FAIL_THRESHOLD = 3;
const DEFAULT_WORKER_TIMEOUT_MS = 30 * 60 * 1000;

export interface CommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

export interface FrontierEntry {
  dir: string;
  title?: string;
  priority?: string;
  status?: string;
}

export interface FrontierSnapshot {
  ready: FrontierEntry[];
  blocked?: FrontierEntry[];
  cycles?: string[][];
  warnings?: string[];
}

/** Everything `runLoop` can do to the outside world. */
export interface RunnerPorts {
  task(args: string[], cwd?: string): CommandResult;
  git(args: string[], cwd?: string): CommandResult;
  gh(args: string[]): CommandResult;
  hasRemote(): boolean;
  /**
   * CLAI-8: may this repo push `ref`? The tier + whitelist answer comes from
   * `task.py delivery-gate`, so config is the only source of truth about
   * delivery — a CLI flag would be a second one. `code` is the machine-readable
   * refusal class (`tier` / `protected` / `whitelist` / `config` / `deferred`);
   * callers branch on it, never on the human `reason` prose.
   */
  deliveryGate(ref: string): {
    allow: boolean;
    reason: string;
    tier: string;
    code: string;
  };
  /**
   * CLAI-10: may these paths go into an automated commit? The rule list lives
   * in `task.py check-commit`, not here — the runner and an agent committing
   * by hand answer to one authority. An unreadable answer counts as a refusal.
   */
  commitGuard(paths: string[]): { ok: boolean; offending: string[] };
  /** The interpreter this CLI uses for its own `task.py` calls, for prompt text. */
  pythonCommand(): string;
  /** Read one top-level string field of the main repo's copy of a ticket. */
  taskField(dir: string, field: string): string | null;
  /**
   * Read the ticket's task.json `meta` object for dispatch resolution
   * (`meta.worker` / `meta.model` / `meta.effort`). `{}` when unreadable —
   * `taskField` cannot see it because `meta` is not a top-level string.
   */
  taskMeta(dir: string): Record<string, unknown>;
  /**
   * The dispatch-relevant slice of `.omtre/agents/<name>.md` frontmatter,
   * read in the orchestrating repo. `null` when the card is missing or
   * unreadable — spawn re-reads the card inside the ticket worktree, so an
   * uncommitted card is undispatchable.
   */
  agentCard(name: string): AgentCardInfo | null;
  /** `.omtre/config.yaml` `worker_default:`; null when unset. */
  workerDefault(): string | null;
  /**
   * Whether the ticket's own branch exists but no longer carries the task dir —
   * i.e. a previous run already closed it there. The orchestrating copy lags
   * behind until the branch is merged, so this is the durable "nothing to do"
   * signal for a ticket the frontier still lists.
   */
  ticketClosedOnBranch(branch: string, dir: string): boolean;
  /**
   * Whether the ticket's worktree directory still holds content — a previous
   * attempt that died mid-flight. An empty directory is not a leftover (git
   * happily reuses it); a non-empty one is evidence a human has to judge.
   */
  worktreeOccupied(dir: string): boolean;
  worktreePath(dir: string): string;
  pathExists(target: string): boolean;
  ticketDocs(dir: string): string[];
  worker(req: WorkerRequest): Promise<WorkerOutcome>;
  ledgerAppend(input: LedgerInput): void;
  log(message: string): void;
}

export interface RunOptions {
  root: string;
  board?: string;
  maxTickets: number;
  untilEmpty: boolean;
  dryRun: boolean;
  workerTimeoutMs: number;
  failThreshold: number;
}

export type StopReason =
  | "dry_run"
  | "frontier_empty"
  | "no_grabbable_ticket"
  | "single_ticket"
  | "max_tickets"
  | "cycle"
  | "frontier_error"
  | "fail_threshold"
  | "dispatch_refused"
  | "delivery_deferred"
  | "push_refused"
  | "always_stop";

export interface RunResult {
  stopped: StopReason;
  attempted: number;
  archived: number;
  failed: number;
  ledgerFile?: string;
}

/** What `run-verify` observed, when the attempt got that far. */
export interface VerifySummary {
  verified: boolean;
  reason?: string;
  exit: number;
}

export type TicketStep =
  | { kind: "archived"; verify?: VerifySummary }
  | { kind: "failed"; reason: string; verify?: VerifySummary }
  | {
      kind: "stop";
      reason: StopReason;
      detail: string;
      verify?: VerifySummary;
    };

/** The machine-readable outcome vocabulary of a single-ticket run. */
export type TicketOutcome =
  | "delivered"
  | "failed"
  | "stop-line"
  | "delivery_deferred";

/**
 * The structured result `omtre run --ticket` prints (one JSON line) and
 * mirrors into the run ledger (`ticket_result`). The orchestrator reads this
 * row; `attempt_started`/`attempt_finished` are the lifecycle pair it uses to
 * spot an attempt that never reported back.
 */
export interface TicketResult {
  dir: string;
  outcome: TicketOutcome;
  /** Machine reason code (`worker_failed`, `always_stop`, `delivered`, …). */
  code: string;
  /** Human-readable detail behind the code. */
  detail: string;
  /** Consecutive failures this invocation observed — a single attempt: 0 or 1. */
  strikes: number;
  verify?: VerifySummary;
  /** The dispatch triple the ticket ran (or was asked to run) under. */
  dispatch: TicketDispatch;
}

export interface TicketRun {
  step: TicketStep;
  result: TicketResult;
}

/** Per-invocation extras for `runTicket` — the loop passes frontier metadata. */
export interface RunTicketOptions {
  workerTimeoutMs?: number;
  /** Ticket title, used as the PR title when the run pushes one. */
  title?: string;
  /** Frontier priority, recorded on the `ticket_start` ledger line. */
  priority?: string;
}

function firstLine(text: string): string {
  const line = (text ?? "").split("\n").find((l) => l.trim());
  return (line ?? "").trim().slice(0, 200);
}

/** A CLI count flag: absent means the default, present must be ≥ 1. */
function positiveInt(
  flag: string,
  value: unknown,
  fallback: number,
): { ok: true; value: number } | { ok: false; error: string } {
  if (typeof value !== "string" || !value.trim()) {
    return { ok: true, value: fallback };
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return {
      ok: false,
      error: `${flag} must be a positive integer, got "${value}"`,
    };
  }
  return { ok: true, value: parsed };
}

/**
 * The action plan a dry run prints. Delivery comes from `task.py delivery-gate`
 * (CLAI-8), so the plan names the verdict the config gives for this ticket's
 * branch rather than a flag the operator waved — and the worker is the triple
 * the ticket's own roster resolved.
 */
function plannedActions(dispatch: TicketDispatch, delivery: string): string[] {
  return [
    "frontier:head",
    "worktree:add",
    `worker:${dispatch.agent ?? dispatch.provider}:${dispatch.model ?? "default"}`,
    "verify:run-verify",
    delivery,
    "task:archive(on the ticket branch)",
  ];
}

/**
 * The brief the worker is handed. Platforms without a prompt-rewriting hook get
 * their context from the entry point, so the ticket's own documents travel with
 * the prompt instead of being assumed.
 */
function buildPrompt(
  dir: string,
  docs: string[],
  worktree: string,
  pythonCmd: string,
): string {
  return [
    `You are the unattended implementation worker for Omtre ticket \`${dir}\`.`,
    `Your working directory is that ticket's own worktree: ${worktree}`,
    ``,
    `Read the ticket brief first — it carries the requirement, the acceptance`,
    `items and the test plan:`,
    ...docs.map((p) => `  ${p}`),
    ``,
    `Rules:`,
    `1. Implement the acceptance items. Keep the scope inside this ticket.`,
    `2. Commit your work on this branch with a message naming the ticket.`,
    `   Do NOT push, do NOT open PRs, never touch the default branch or tags.`,
    `3. Do not touch other tickets, \`.omtre/domains/\` boards or worklogs —`,
    `   board bookkeeping belongs to the orchestrating session, not to this`,
    `   worker, and a domain-layer anchor check will reject your commit anyway.`,
    `4. Before finishing, run the ticket's own contract:`,
    `   ${pythonCmd} ./.omtre/scripts/task.py run-verify ${dir}`,
    `   If it fails, fix it or say so plainly — do not record a passing run you`,
    `   did not observe.`,
  ].join("\n");
}

/** Curate the ticket's context lists so `start`'s empty-seed guard stays meaningful. */
function curateContext(
  dir: string,
  worktree: string,
  ports: RunnerPorts,
): void {
  for (const doc of ports.ticketDocs(dir)) {
    for (const list of ["implement", "check"]) {
      ports.task(
        ["add-context", dir, list, doc, `run-injected for ${dir}`],
        worktree,
      );
    }
  }
}

/** `git status --porcelain` → the changed paths, renames resolved to target. */
export function parsePorcelain(out: string): string[] {
  const files: string[] = [];
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    const body = line.slice(3);
    const target = body.includes(" -> ")
      ? (body.split(" -> ").pop() as string)
      : body;
    const trimmed = target.trim();
    files.push(
      trimmed.startsWith('"') && trimmed.endsWith('"')
        ? trimmed.slice(1, -1).replace(/\\"/g, '"')
        : trimmed,
    );
  }
  return files;
}

/**
 * Task-tree paths the runner must not fold into the work commit: claiming a
 * ticket rewrites its own `task.json` / `*.jsonl`, and `task.py archive` moves
 * exactly those files afterwards. Committing both in one commit makes the work
 * commit un-revertable (rename/delete conflict), and 「每票一 commit 可单独
 * revert」 is the whole point of the ledger.
 */
const BOOKKEEPING_PREFIXES = [".omtre/tasks/", ".omtre/.runtime/"];

function isBookkeeping(p: string): boolean {
  const norm = p.toLowerCase().replace(/\\/g, "/");
  return BOOKKEEPING_PREFIXES.some((frag) => norm.startsWith(frag));
}

type FallbackCommit =
  | { ok: true; paths: string[]; bookkeeping: number; oid: string }
  | { ok: false; reason: string };

/**
 * Commit what the worker left uncommitted. A sandboxed worker (codex
 * `workspace-write` keeps `.git` read-only) can write files but not commit
 * them; without this the ticket would fail for a reason that has nothing to do
 * with the work. Staging is by explicit pathspec so a stray protected file
 * stops the ticket rather than riding into the review.
 */
function runnerFallbackCommit(
  dir: string,
  worktree: string,
  ports: RunnerPorts,
): FallbackCommit {
  const status = ports.git(["status", "--porcelain"], worktree);
  if (status.status !== 0) {
    return {
      ok: false,
      reason: `status_failed(${firstLine(status.stderr || status.stdout)})`,
    };
  }
  const changed = parsePorcelain(status.stdout);
  const paths = changed.filter((p) => !isBookkeeping(p));
  const bookkeeping = changed.length - paths.length;
  if (paths.length === 0) {
    return {
      ok: false,
      reason:
        changed.length === 0
          ? "no_work(worker neither committed nor changed the tree)"
          : `no_work(only task bookkeeping changed: ${changed.length} path(s); the worker committed nothing)`,
    };
  }
  const blocked = ports.commitGuard(paths);
  if (!blocked.ok) {
    return {
      ok: false,
      reason: `protected_path_in_tree(${blocked.offending.slice(0, 3).join(", ")}; stage by hand)`,
    };
  }

  const staged = ports.git(["add", "--", ...paths], worktree);
  if (staged.status !== 0) {
    return {
      ok: false,
      reason: `stage_failed(${firstLine(staged.stderr || staged.stdout)})`,
    };
  }
  const committed = ports.git(
    ["commit", "-m", `run(${dir}): worker output committed by the runner`],
    worktree,
  );
  if (committed.status !== 0) {
    return {
      ok: false,
      reason: `commit_failed(${firstLine(committed.stderr || committed.stdout)})`,
    };
  }

  const head = ports.git(["rev-parse", "HEAD"], worktree);
  return { ok: true, paths, bookkeeping, oid: head.stdout.trim() };
}

async function processOne(
  dir: string,
  info: { title?: string; priority?: string },
  dispatch: TicketDispatch,
  workerTimeoutMs: number,
  ports: RunnerPorts,
): Promise<TicketStep> {
  const branch = ports.taskField(dir, "branch");
  const base = ports.taskField(dir, "base_branch");
  if (!branch || !base) {
    return {
      kind: "failed",
      reason: "no_branch_metadata(set-branch/set-base-branch first)",
    };
  }

  const worktree = ports.worktreePath(dir);
  if (ports.worktreeOccupied(dir)) {
    return { kind: "failed", reason: `worktree_occupied(${worktree})` };
  }

  const hasBranch = ports.git([
    "rev-parse",
    "--verify",
    "--quiet",
    `refs/heads/${branch}`,
  ]);
  const addArgs =
    hasBranch.status === 0
      ? ["worktree", "add", worktree, branch]
      : ["worktree", "add", worktree, "-b", branch, base];
  const added = ports.git(addArgs);
  if (added.status !== 0) {
    return {
      kind: "failed",
      reason: `worktree_add_failed(${firstLine(added.stderr || added.stdout)})`,
    };
  }
  ports.ledgerAppend({ ticket: dir, action: "worktree", detail: worktree });
  if (!ports.pathExists(path.join(worktree, ".omtre", "scripts", "task.py"))) {
    // `get_repo_root()` walks up from cwd, so a worktree without its own
    // committed .omtre/ would silently aim at the orchestrating repo instead.
    ports.git(["worktree", "remove", "--force", worktree]);
    return {
      kind: "failed",
      reason: `worktree_has_no_omtre(commit .omtre on ${base} first)`,
    };
  }

  try {
    return await runAttempt(
      dir,
      info,
      branch,
      base,
      worktree,
      dispatch,
      workerTimeoutMs,
      ports,
    );
  } finally {
    // The worktree is always transient — it would otherwise make the ticket
    // ungrabbable and the strike counter could never reach the threshold. The
    // evidence lives on the branch (one commit, revertable) and in the ledger;
    // a failed worker additionally keeps its own channel for inspection.
    // `--force` because an aborted worker leaves uncommitted junk, and
    // uncommitted work is not evidence.
    ports.git(["worktree", "remove", "--force", worktree]);
  }
}

async function runAttempt(
  dir: string,
  info: { title?: string; priority?: string },
  branch: string,
  base: string,
  worktree: string,
  dispatch: TicketDispatch,
  workerTimeoutMs: number,
  ports: RunnerPorts,
): Promise<TicketStep> {
  ports.task(["set-worktree", dir, worktree], worktree);

  curateContext(dir, worktree, ports);

  const started = ports.task(["start", dir], worktree);
  if (started.status !== 0) {
    return {
      kind: "failed",
      reason: `start_refused(${firstLine(started.stderr || started.stdout)})`,
    };
  }
  ports.ledgerAppend({
    ticket: dir,
    action: "ticket_start",
    detail: `priority=${info.priority ?? "-"} branch=${branch}`,
  });

  const docs = ports
    .ticketDocs(dir)
    .map((doc) =>
      path.join(worktree, ".omtre", "tasks", dir, path.basename(doc)),
    );
  const outcome = await ports.worker({
    ticket: dir,
    cwd: worktree,
    prompt: buildPrompt(dir, docs, worktree, ports.pythonCommand()),
    provider: dispatch.provider,
    agent: dispatch.agent,
    model: dispatch.model,
    timeoutMs: workerTimeoutMs,
    files: docs,
  });
  if (!outcome.ok) {
    return {
      kind: "failed",
      reason: `worker_failed(${firstLine(outcome.error ?? "no reason")}; channel kept by the worker for inspection)`,
    };
  }

  const report = firstLine(outcome.text);
  let oid = ports.git(["rev-parse", "HEAD"], worktree).stdout.trim();
  let commits = Number.parseInt(
    (
      ports.git(["rev-list", "--count", `${base}..HEAD`], worktree).stdout || ""
    ).trim(),
    10,
  );
  let stagedByRunner = "";

  if (!Number.isFinite(commits) || commits === 0) {
    const fallback = runnerFallbackCommit(dir, worktree, ports);
    if (!fallback.ok) {
      return {
        kind: "failed",
        reason: `${fallback.reason} (worker reported: ${report || "nothing"})`,
      };
    }
    stagedByRunner =
      `runner staged ${fallback.paths.length} path(s)` +
      (fallback.bookkeeping > 0
        ? `, left ${fallback.bookkeeping} task-bookkeeping path(s) for the archive commit`
        : "") +
      "; ";
    oid = fallback.oid;
    commits = Number.parseInt(
      (
        ports.git(["rev-list", "--count", `${base}..HEAD`], worktree).stdout ||
        "0"
      ).trim(),
      10,
    );
  }

  ports.ledgerAppend({
    ticket: dir,
    action: "worker",
    worker: outcome.worker,
    commit: oid,
    detail: `${stagedByRunner}${commits} commit(s) ahead of ${base}; report: ${report || "-"}`,
  });

  // always-stop is a refusal, not a warning, so it has to be checked against
  // what actually landed on the branch — not only against what the runner is
  // about to stage. A headless worker that committed `.env` or a board file
  // itself would otherwise sail straight through to push + PR.
  const landed = ports.git(["diff", "--name-only", `${base}..HEAD`], worktree);
  const touched = landed.stdout
    .split(/\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const carried = ports.commitGuard(touched);
  if (!carried.ok) {
    const offender = carried.offending[0] ?? "(check-commit unreadable)";
    return {
      kind: "stop",
      reason: "always_stop",
      detail: `${offender} landed on ${branch}; the line halts — a board file or a secret in a commit is a human's call`,
    };
  }

  const verify = ports.task(["run-verify", dir, "--json"], worktree);
  let verified = false;
  let verifyReason: string | undefined;
  try {
    const parsed = JSON.parse(verify.stdout) as {
      verified?: boolean;
      reason?: string;
    };
    verified = parsed.verified === true;
    verifyReason = parsed.reason;
  } catch {
    verifyReason = "unreadable_output";
  }
  const verifySummary: VerifySummary = {
    verified,
    reason: verifyReason,
    exit: verify.status,
  };
  ports.ledgerAppend({
    ticket: dir,
    action: "verify",
    commit: oid,
    command: "task.py run-verify --json",
    exit: verify.status,
    reason: verified ? undefined : (verifyReason ?? `exit_${verify.status}`),
  });
  if (!verified) {
    return {
      kind: "failed",
      reason: `verify_failed(${verifyReason ?? `exit_${verify.status}`})`,
      verify: verifySummary,
    };
  }

  if (ports.hasRemote()) {
    const gate = ports.deliveryGate(branch);
    if (!gate.allow) {
      // Two different refusals, on purpose (AC4/AC5): a tier that does not
      // permit push at all is ordinary — the work stands on its branch, and an
      // empty whitelist degrades to hands-off the same way. Everything else
      // means the operator's intent and the ticket's shape disagree, so the
      // line halts for adjudication instead of a warning nobody is watching.
      // Classified on the gate's machine `code`, never on its prose: matching
      // `reason` with a regex would silently reclassify on every rewording, and
      // an unreadable answer must count as a refusal (fail closed).
      const adjudicate = gate.code !== "tier" && gate.code !== "deferred";
      ports.ledgerAppend({
        ticket: dir,
        action: "delivery",
        commit: oid,
        reason: `${adjudicate ? "refused" : "deferred"}: ${gate.reason}`,
      });
      return {
        kind: "stop",
        reason: adjudicate ? "push_refused" : "delivery_deferred",
        detail: adjudicate
          ? `push of ${branch} refused by delivery-gate (${gate.reason}) — the line stops here for a human`
          : `${dir} verified at ${oid} but ${gate.reason} — the work stands on ${branch}, unarchived`,
        verify: verifySummary,
      };
    }
    const pushed = ports.git(["push", "-u", "origin", branch], worktree);
    if (pushed.status !== 0) {
      return {
        kind: "failed",
        reason: `push_failed(${firstLine(pushed.stderr || pushed.stdout)})`,
        verify: verifySummary,
      };
    }
    // No `--draft`: the 定版 rule is that the runner opens a PR that is already
    // ready for review (gh opens ready by default), and no `--ready` either —
    // that flag does not exist, which the live run discovered the hard way.
    const pr = ports.gh([
      "pr",
      "create",
      "--head",
      branch,
      "--base",
      base,
      "--title",
      info.title ?? dir,
      "--body",
      `Unattended run for ticket \`${dir}\`. Verify: \`${ports.pythonCommand()} ./.omtre/scripts/task.py run-verify ${dir}\`.`,
    ]);
    if (pr.status !== 0) {
      return {
        kind: "failed",
        reason: `pr_open_failed(${firstLine(pr.stderr || pr.stdout)})`,
        verify: verifySummary,
      };
    }
    const url = firstLine(pr.stdout);
    if (!/^https?:\/\//.test(url)) {
      return {
        kind: "failed",
        reason: `pr_url_unreadable(gh printed: ${url || "(nothing)"}; the branch is pushed, open the PR by hand)`,
        verify: verifySummary,
      };
    }
    ports.task(["set-pr", dir, url], worktree);
    ports.ledgerAppend({
      ticket: dir,
      action: "delivery",
      commit: oid,
      detail: url,
    });
  } else {
    // WORKLOG-PROTOCOL 第 0 铁律 degradation: with no remote there is nothing to
    // push, so the commit on the ticket branch IS the accounting.
    ports.ledgerAppend({
      ticket: dir,
      action: "delivery",
      commit: oid,
      reason: "degraded_no_remote: commit is the record",
    });
  }

  // Clear the pointer before the archive commit so the merged branch carries no
  // reference to a directory that will not exist.
  ports.task(["set-worktree", dir, "-"], worktree);
  const archived = ports.task(["archive", dir], worktree);
  if (archived.status !== 0) {
    return {
      kind: "failed",
      reason: `archive_refused(${firstLine(archived.stderr || archived.stdout)})`,
      verify: verifySummary,
    };
  }

  // The archive commit is what carries `pr_url` and moves the task dir, so the
  // PR is only mergeable-to-closure once it is on the remote. Pushing before
  // archiving leaves a PR that closes nothing — measured on the live GitHub run:
  // the reviewed branch had the work commit with `status=planning`,
  // `pr_url=null`, while the closure sat on an unpushed local branch.
  if (ports.hasRemote()) {
    const afterArchive = ports.git(["push", "origin", branch], worktree);
    if (afterArchive.status !== 0) {
      return {
        kind: "failed",
        reason: `post_archive_push_failed(${firstLine(afterArchive.stderr || afterArchive.stdout)}; the ticket is closed locally only)`,
        verify: verifySummary,
      };
    }
  }

  ports.ledgerAppend({
    ticket: dir,
    action: "archived",
    commit: oid,
    detail: `branch tip ${ports.git(["rev-parse", "HEAD"], worktree).stdout.trim().slice(0, 8)}`,
  });
  return { kind: "archived", verify: verifySummary };
}

/** `worker_failed(timeout 1800s)` → `worker_failed` — the machine prefix of a reason. */
function reasonCode(reason: string): string {
  const paren = reason.indexOf("(");
  return (paren === -1 ? reason : reason.slice(0, paren)).trim();
}

/**
 * The step a ticket took → the result row an orchestrator reads. `outcome`
 * folds the step vocabulary into four terminal classes; `code` keeps the
 * machine reason for anything that did not deliver.
 */
function ticketResult(
  dir: string,
  dispatch: TicketDispatch,
  step: TicketStep,
): TicketResult {
  const base = {
    dir,
    dispatch,
    // internal_error = runner-side bug, not a worker failure — the same
    // contract as "attempt_started without finished": infra death never
    // charges the ticket's strike budget.
    strikes:
      step.kind === "failed" && !step.reason.startsWith("internal_error(")
        ? 1
        : 0,
    ...(step.verify ? { verify: step.verify } : {}),
  };
  if (step.kind === "archived") {
    return {
      ...base,
      outcome: "delivered",
      code: "delivered",
      detail: `archived on the ticket branch`,
    };
  }
  if (step.kind === "failed") {
    return {
      ...base,
      outcome: "failed",
      code: reasonCode(step.reason),
      detail: step.reason,
    };
  }
  if (step.reason === "delivery_deferred") {
    return {
      ...base,
      outcome: "delivery_deferred",
      code: "delivery_deferred",
      detail: step.detail,
    };
  }
  return {
    ...base,
    outcome: "stop-line",
    code: step.reason,
    detail: step.detail,
  };
}

/**
 * Run exactly one ticket through the mechanical pipeline:
 * worktree → start → worker → always-stop ×2 → verify → delivery-gate →
 * push/pr → archive. `dispatch` is the resolved provider/agent/model triple;
 * resolving it is `resolveDispatch`'s job (fail-closed roster chain).
 *
 * Every call writes `attempt_started` + `attempt_finished` (a started row
 * with no finished row means the runner died mid-attempt — the orchestrator's
 * takeover signal) and one `ticket_result` row carrying the structured
 * result. Nothing here writes durable task state — `meta.triage` and blocked
 * rows stay `task.py`'s, strikes stay the loop's in-memory count.
 */
export async function runTicket(
  dir: string,
  dispatch: TicketDispatch,
  ports: RunnerPorts,
  opts: RunTicketOptions = {},
): Promise<TicketRun> {
  const resultRow = (result: TicketResult): void => {
    ports.ledgerAppend({
      ticket: dir,
      action: "ticket_result",
      reason: `${result.outcome}:${result.code}`,
      detail: JSON.stringify(result),
    });
  };
  // An attempt that never started gets no started/finished pair — the pair is
  // the crash-detection contract, and a refusal is not a crashed attempt. It
  // still gets the result row so the refusal is visible.
  const refuse = (reason: string): TicketRun => {
    const step: TicketStep = { kind: "failed", reason };
    const result: TicketResult = {
      dir,
      outcome: "failed",
      code: reasonCode(reason),
      detail: reason,
      strikes: 0,
      dispatch,
    };
    resultRow(result);
    return { step, result };
  };
  const emit = (step: TicketStep): TicketRun => {
    const result = ticketResult(dir, dispatch, step);
    ports.ledgerAppend({
      ticket: dir,
      action: "attempt_finished",
      reason: `${result.outcome}:${result.code}`,
    });
    resultRow(result);
    return { step, result };
  };

  // Fail closed before a worktree exists: a dispatch that cannot name a
  // worker or a registered provider would only burn a spawn to fail anyway.
  if (!dispatch.agent && !dispatch.provider) {
    return refuse(
      "dispatch_invalid(agent or provider required — resolve a dispatch card first)",
    );
  }
  if (dispatch.provider !== undefined && !isProvider(dispatch.provider)) {
    return refuse(
      `dispatch_invalid(unknown provider ${dispatch.provider}; known: ${listProviders().join(", ")})`,
    );
  }

  ports.ledgerAppend({
    ticket: dir,
    action: "attempt_started",
    worker: dispatch.agent ?? dispatch.provider,
    detail:
      `provider=${dispatch.provider ?? "-"} agent=${dispatch.agent ?? "-"} ` +
      `model=${dispatch.model ?? "-"} effort=${dispatch.effort ?? "-"}`,
  });

  let step: TicketStep;
  try {
    step = await processOne(
      dir,
      { title: opts.title, priority: opts.priority },
      dispatch,
      opts.workerTimeoutMs ?? DEFAULT_WORKER_TIMEOUT_MS,
      ports,
    );
  } catch (error) {
    // The pipeline is written to return steps, not throw — an escape here is
    // a bug. Still leave the ledger pair so the attempt is not mistaken for
    // a crashed runner mid-flight.
    step = {
      kind: "failed",
      reason: `internal_error(${firstLine(error instanceof Error ? error.message : String(error))})`,
    };
  }
  return emit(step);
}

/**
 * The fail-closed refusal row both entry points emit when the roster chain
 * cannot name a worker (`resolveDispatch` not-ok): no attempt pair — a
 * refusal is not a crashed attempt — but one `ticket_result` row so the
 * refusal is visible to an unattended caller, carrying the machine code
 * `dispatch_refused` and the partial dispatch it was asked to run under.
 */
function dispatchRefusal(
  dir: string,
  resolved: { error: string; partial: TicketDispatch },
  ports: RunnerPorts,
): TicketRun {
  const result: TicketResult = {
    dir,
    outcome: "failed",
    code: "dispatch_refused",
    detail: resolved.error,
    strikes: 0,
    dispatch: resolved.partial,
  };
  ports.ledgerAppend({
    ticket: dir,
    action: "ticket_result",
    reason: `${result.outcome}:${result.code}`,
    detail: JSON.stringify(result),
  });
  return {
    step: { kind: "failed", reason: `dispatch_refused(${resolved.error})` },
    result,
  };
}

export async function runLoop(
  opts: RunOptions,
  ports: RunnerPorts,
): Promise<RunResult> {
  const strikes = new Map<string, number>();
  const delivered = new Set<string>();
  let attempted = 0;
  let archived = 0;
  let failed = 0;

  ports.ledgerAppend({
    ticket: "-",
    action: "run_start",
    detail: `board=${opts.board ?? "-"} max=${opts.maxTickets} dry=${opts.dryRun}`,
  });

  for (;;) {
    const front = ports.task(
      opts.board
        ? ["frontier", "--json", "--board", opts.board]
        : ["frontier", "--json"],
    );
    let snapshot: FrontierSnapshot;
    try {
      snapshot = JSON.parse(front.stdout) as FrontierSnapshot;
    } catch {
      const detail = firstLine(front.stderr || front.stdout) || "no output";
      ports.ledgerAppend({
        ticket: "-",
        action: "stop",
        reason: `frontier_unreadable: ${detail}`,
      });
      ports.log(`Stopped: frontier output unreadable — ${detail}`);
      return { stopped: "frontier_error", attempted, archived, failed };
    }

    const cycles = snapshot.cycles ?? [];
    if (cycles.length > 0) {
      const detail = `dependency cycle: ${cycles.map((c) => c.join(" ↔ ")).join("; ")}`;
      ports.ledgerAppend({ ticket: "-", action: "stop", reason: detail });
      ports.log(`Stopped: ${detail}`);
      return { stopped: "cycle", attempted, archived, failed };
    }

    if (attempted >= opts.maxTickets) {
      ports.ledgerAppend({
        ticket: "-",
        action: "stop",
        reason: "max_tickets reached",
      });
      return { stopped: "max_tickets", attempted, archived, failed };
    }

    const ready = snapshot.ready ?? [];
    const candidates: FrontierEntry[] = [];
    const skipped: string[] = [];
    for (const entry of ready) {
      if (opts.dryRun) {
        candidates.push(entry);
        break;
      }
      if (delivered.has(entry.dir)) {
        skipped.push(`${entry.dir}: closed earlier this run`);
        continue;
      }
      // A ticket already carrying a review pointer is pending a human decision;
      // its branch is out of the runner's hands.
      if (ports.taskField(entry.dir, "pr_url")) {
        skipped.push(`${entry.dir}: pr_url set (pending review)`);
        continue;
      }
      const branch = ports.taskField(entry.dir, "branch");
      if (branch && ports.ticketClosedOnBranch(branch, entry.dir)) {
        skipped.push(`${entry.dir}: already archived on ${branch}`);
        continue;
      }
      if (ports.worktreeOccupied(entry.dir)) {
        skipped.push(`${entry.dir}: worktree still holds content`);
        continue;
      }
      candidates.push(entry);
      break;
    }

    if (candidates.length === 0) {
      const reason =
        skipped.length > 0 ? "no_grabbable_ticket" : "frontier_empty";
      ports.ledgerAppend({
        ticket: "-",
        action: "stop",
        reason:
          skipped.length > 0
            ? `nothing grabbable: ${skipped.join("; ")}`
            : "frontier empty",
      });
      if (skipped.length > 0) ports.log(`Stopped: ${skipped.join("; ")}`);
      return { stopped: reason, attempted, archived, failed };
    }

    const head = candidates[0] as FrontierEntry;
    if (opts.dryRun) {
      const branch = ports.taskField(head.dir, "branch") ?? "(no branch set)";
      const gate = ports.deliveryGate(branch);
      const delivery = gate.allow
        ? `delivery:push(${branch})+pr`
        : `delivery:refused(${gate.reason})`;
      // The plan names the worker the ticket's roster would dispatch — a
      // resolution that cannot name one is itself the plan's headline.
      const resolved = resolveDispatch(head.dir, {}, ports);
      ports.log(
        JSON.stringify(
          {
            ticket: head.dir,
            branch,
            tier: gate.tier,
            dispatch: resolved.ok ? resolved.dispatch : null,
            ...(resolved.ok ? {} : { dispatch_error: resolved.error }),
            actions: resolved.ok
              ? plannedActions(resolved.dispatch, delivery)
              : ["dispatch_refused"],
          },
          null,
          2,
        ),
      );
      return { stopped: "dry_run", attempted, archived, failed };
    }

    attempted += 1;
    ports.log(`→ ${head.dir} (${head.priority ?? "-"})`);
    // Per-ticket dispatch — the same resolveDispatch → runTicket path
    // `--ticket` takes. The roster (meta.worker → agent card →
    // worker_default) answers per ticket; a refusal is fail-closed and lands
    // in the loop's ordinary failure accounting (strikes → threshold → the
    // task.py-owned ready-for-human mark), never a silent fallback.
    const resolved = resolveDispatch(head.dir, {}, ports);
    const ticketRun = resolved.ok
      ? await runTicket(head.dir, resolved.dispatch, ports, {
          workerTimeoutMs: opts.workerTimeoutMs,
          title: head.title,
          priority: head.priority,
        })
      : dispatchRefusal(head.dir, resolved, ports);
    const step = ticketRun.step;

    if (step.kind === "stop") {
      // The machine reason leads the ledger line: "why did the line stop" has
      // to be readable without re-parsing a human sentence.
      ports.ledgerAppend({
        ticket: head.dir,
        action: "stop",
        reason: `${step.reason}: ${step.detail}`,
      });
      ports.log(`Stopped (${step.reason}): ${step.detail}`);
      return { stopped: step.reason, attempted, archived, failed };
    }

    if (step.kind === "failed") {
      failed += 1;
      // A deterministic refusal cannot heal across polls — the ticket's
      // meta would be re-resolved identically forever. Mark it for a human
      // and halt the line now; it is not a strike.
      if (ticketRun.result?.code === "dispatch_refused") {
        ports.task(["set-meta", head.dir, "triage", "ready-for-human"]);
        ports.ledgerAppend({
          ticket: head.dir,
          action: "blocked",
          reason: `dispatch refused: ${step.reason}`,
          detail: "marked triage=ready-for-human; fix the roster and rerun",
        });
        ports.log(
          `Stopped: ${head.dir} dispatch refused — fix the roster and rerun.`,
        );
        return { stopped: "dispatch_refused", attempted, archived, failed };
      }
      // Charge what the ticket_result row charged: internal_error carries
      // strikes:0 — a runner-side death never burns the worker's budget.
      const count =
        (strikes.get(head.dir) ?? 0) + (ticketRun.result?.strikes ?? 1);
      strikes.set(head.dir, count);
      ports.log(
        `✗ ${head.dir}: ${step.reason} (strike ${count}/${opts.failThreshold})`,
      );
      if (count >= opts.failThreshold) {
        // Marked in the orchestrating repo: that is the copy a human reads when
        // the frontier line is handed back to them.
        ports.task(["set-meta", head.dir, "triage", "ready-for-human"]);
        ports.ledgerAppend({
          ticket: head.dir,
          action: "blocked",
          reason: `${count} consecutive failures: ${step.reason}`,
          detail: "marked triage=ready-for-human; the whole line halts",
        });
        ports.log(
          `Stopped: ${head.dir} failed ${count} times in a row — handed to a human.`,
        );
        return { stopped: "fail_threshold", attempted, archived, failed };
      }
      continue;
    }

    strikes.delete(head.dir);
    delivered.add(head.dir);
    archived += 1;
    ports.log(`✓ ${head.dir} archived on its branch`);
    if (!opts.untilEmpty) {
      ports.ledgerAppend({
        ticket: "-",
        action: "stop",
        reason: "one ticket (--until-empty not set)",
      });
      return { stopped: "single_ticket", attempted, archived, failed };
    }
  }
}

// -----------------------------------------------------------------------------
// Real ports — thin adapters over subprocess and fs. No policy lives here.
// -----------------------------------------------------------------------------

function run(
  cmd: string,
  args: string[],
  cwd: string,
  input?: string,
): CommandResult {
  const res = spawnSync(cmd, args, { cwd, encoding: "utf-8", input });
  if (res.error && (res.error as NodeJS.ErrnoException).code === "ENOENT") {
    return { status: 127, stdout: "", stderr: `${cmd}: not found on PATH` };
  }
  return {
    status: res.status ?? 1,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
  };
}

export function realPorts(
  root: string,
  ledgerAppend: (input: LedgerInput) => void,
  log: (message: string) => void = (message): void => {
    console.log(message);
  },
): RunnerPorts {
  const python = resolveSupportedPython().command;
  const taskPy = path.join(root, ".omtre", "scripts", "task.py");
  // R5: the worker inherits the channel supervisor's guard policy, so a wedged
  // worker is given up on after `channel.worker_guard.idle_timeout` rather than
  // burning the whole wall clock, and the precedence (flag > env > config >
  // default) is the one place `channel run` already implements.
  // `maxLiveWorkers` is deliberately not consulted: the loop works one ticket at
  // a time, so at most one worker is ever live.
  const guard = resolveWorkerGuardConfig({ cwd: root });

  return {
    task(args, cwd) {
      // task.py is resolved from the main repo so the interpreter and script
      // version stay one thing; `cwd` decides which task tree it operates on.
      const script = cwd
        ? path.join(cwd, ".omtre", "scripts", "task.py")
        : taskPy;
      return run(python, [script, ...args], cwd ?? root);
    },
    git(args, cwd) {
      return run("git", args, cwd ?? root);
    },
    gh(args) {
      return run("gh", args, root);
    },
    hasRemote() {
      return run("git", ["remote"], root).stdout.trim().length > 0;
    },
    deliveryGate(ref) {
      const res = run(python, [taskPy, "delivery-gate", ref, "--json"], root);
      try {
        const parsed = JSON.parse(res.stdout) as {
          allow?: boolean;
          reason?: string;
          tier?: string;
          code?: string;
        };
        return {
          allow: parsed.allow === true,
          reason:
            parsed.reason ??
            `unreadable_output(${firstLine(res.stderr || res.stdout)})`,
          tier: parsed.tier ?? "unknown",
          code: parsed.code ?? "unreadable",
        };
      } catch {
        return {
          allow: false,
          reason: `unreadable_output(${firstLine(res.stderr || res.stdout) || `exit_${res.status}`})`,
          tier: "unknown",
          code: "unreadable",
        };
      }
    },
    commitGuard(paths) {
      if (paths.length === 0) return { ok: true, offending: [] };
      // Paths travel over stdin: a wide diff would otherwise hit an
      // argument-length limit right at the moment we least want a silent
      // failure. The question goes to the orchestrator's own script so the rule
      // has one version, not one per worktree.
      const res = run(
        python,
        [taskPy, "check-commit", "--from-stdin", "--json"],
        root,
        `${paths.join("\n")}\n`,
      );
      try {
        const parsed = JSON.parse(res.stdout) as {
          ok?: boolean;
          offending?: string[];
        };
        return {
          ok: parsed.ok === true && res.status === 0,
          offending: parsed.offending ?? [],
        };
      } catch {
        // Unreadable verdict, refused in full: a rule we cannot read is a rule
        // we cannot rely on.
        return { ok: false, offending: paths };
      }
    },
    pythonCommand() {
      return python;
    },
    taskField(dir, field) {
      try {
        const record = loadTaskRecord({
          taskDir: path.join(root, ".omtre", "tasks", dir),
          cwd: root,
        }) as unknown as Record<string, unknown>;
        const value = record[field];
        return typeof value === "string" && value.length > 0 ? value : null;
      } catch {
        return null;
      }
    },
    taskMeta(dir) {
      try {
        const record = loadTaskRecord({
          taskDir: path.join(root, ".omtre", "tasks", dir),
          cwd: root,
        }) as unknown as { meta?: Record<string, unknown> };
        return record.meta ?? {};
      } catch {
        return {};
      }
    },
    agentCard(name) {
      try {
        // The raw frontmatter value matters: `provider: acp` must survive to
        // the registry check — the loader's normalized field drops it, which
        // would turn a typo or a not-yet-registered provider into a silent
        // "missing provider" instead of a named refusal.
        const agent = loadAgent(name, root);
        return {
          provider: agent.raw.provider?.trim() || undefined,
          model: agent.model,
          effort: agent.raw.effort?.trim() || undefined,
        };
      } catch {
        return null;
      }
    },
    workerDefault() {
      return loadWorkerDefault(root);
    },
    worktreePath(dir) {
      return path.join(root, ".omtre", ".runtime", "worktrees", dir);
    },
    ticketClosedOnBranch(branch, dir) {
      const ref = run(
        "git",
        ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`],
        root,
      );
      if (ref.status !== 0) return false;
      const onBranch = run(
        "git",
        ["cat-file", "-e", `${branch}:.omtre/tasks/${dir}/task.json`],
        root,
      );
      return onBranch.status !== 0;
    },
    worktreeOccupied(dir) {
      const target = path.join(root, ".omtre", ".runtime", "worktrees", dir);
      try {
        return fs.readdirSync(target).length > 0;
      } catch {
        return false;
      }
    },
    pathExists(target) {
      return fs.existsSync(target);
    },
    ticketDocs(dir) {
      const taskDir = path.join(root, ".omtre", "tasks", dir);
      return ["prd.md", "design.md", "implement.md"]
        .map((name) => path.join(taskDir, name))
        .filter((p) => fs.existsSync(p));
    },
    worker(req) {
      return oneShotWorker({
        ...req,
        idleTimeoutMs: req.idleTimeoutMs ?? guard.idleTimeoutMs,
      });
    },
    ledgerAppend,
    log,
  };
}

/**
 * Normalize commander's loose option bag into a validated `RunOptions`.
 *
 * The loop accepts NO dispatch flags — the same refusal idiom ticket mode
 * applies to `--agent`. Each ticket's dispatch resolves from its own roster
 * (meta.worker → agent card → worker_default); a flag that forced one
 * triple for the whole run, or that silently did nothing, would be a second
 * source of truth next to the roster. Single-run overrides live on
 * `--ticket` (`--worker`/`--provider`/`--model`).
 */
export function normalizeOptions(
  raw: Record<string, unknown>,
  root: string,
): { ok: true; options: RunOptions } | { ok: false; error: string } {
  if (typeof raw.worker === "string" && raw.worker) {
    return {
      ok: false,
      error:
        "--worker is only valid with --ticket — the loop resolves each " +
        "ticket's own dispatch from the roster",
    };
  }
  if (typeof raw.agent === "string" && raw.agent) {
    return {
      ok: false,
      error:
        "--agent is not valid here — the loop resolves each ticket's dispatch " +
        "from its roster (meta.worker → agent card → worker_default); the " +
        "single-run card override is --ticket --worker",
    };
  }
  if (typeof raw.provider === "string" && raw.provider) {
    return {
      ok: false,
      error:
        "--provider is not valid here — each ticket's provider comes from its " +
        "dispatch card's frontmatter; --ticket accepts --provider as a " +
        "single-run override",
    };
  }
  if (typeof raw.model === "string" && raw.model) {
    return {
      ok: false,
      error:
        "--model is not valid here — each ticket's model comes from its " +
        "roster (meta.model → card model); --ticket accepts --model as a " +
        "single-run override",
    };
  }

  const maxTickets = positiveInt(
    "--max-tickets",
    raw.maxTickets,
    DEFAULT_MAX_TICKETS,
  );
  if (!maxTickets.ok) return maxTickets;
  const failThreshold = positiveInt(
    "--max-failures",
    raw.maxFailures,
    DEFAULT_FAIL_THRESHOLD,
  );
  if (!failThreshold.ok) return failThreshold;

  const timeout = parseDuration(
    typeof raw.timeout === "string" ? raw.timeout : undefined,
  );

  return {
    ok: true,
    options: {
      root,
      board: typeof raw.board === "string" && raw.board ? raw.board : undefined,
      maxTickets: maxTickets.value,
      untilEmpty: raw.untilEmpty === true,
      dryRun: raw.dryRun === true,
      workerTimeoutMs: timeout ?? DEFAULT_WORKER_TIMEOUT_MS,
      failThreshold: failThreshold.value,
    },
  };
}

export async function runCommand(
  raw: Record<string, unknown>,
  root: string = process.cwd(),
): Promise<RunResult> {
  if (!fs.existsSync(path.join(root, ".omtre", "scripts", "task.py"))) {
    throw new Error(
      "no .omtre/scripts/task.py here — `omtre run` drives an Omtre-managed repo",
    );
  }
  const normalized = normalizeOptions(raw, root);
  if (!normalized.ok) {
    throw new Error(normalized.error);
  }
  const opts = normalized.options;

  // A dry run must not create the runs/ directory either, so it gets a sink
  // instead of a ledger.
  const ledger = opts.dryRun ? null : openLedger(opts.root);
  const append: (input: LedgerInput) => void = ledger
    ? (input): void => {
        ledger.append(input);
      }
    : (): void => undefined;
  const ports = realPorts(opts.root, append);
  const result = await runLoop(opts, ports);
  return ledger ? { ...result, ledgerFile: ledger.file } : result;
}

// -----------------------------------------------------------------------------
// `omtre run --ticket <dir>` — one ticket, one attempt, one result row.
// -----------------------------------------------------------------------------

export interface TicketCommandOptions {
  root: string;
  dir: string;
  dryRun: boolean;
  worker?: string;
  provider?: Provider;
  model?: string;
  workerTimeoutMs: number;
}

export interface TicketCommandResult {
  /** `null` only for a dry run, which prints a plan instead of a result. */
  result: TicketResult | null;
  ledgerFile?: string;
}

/**
 * The ticket-mode option surface is intentionally smaller than the loop's:
 * one ticket, and dispatch overrides that apply to this invocation only.
 * `--agent` is refused outright so it cannot be silently mistaken for the
 * card override — ticket mode calls it `--worker`.
 */
export function normalizeTicketOptions(
  raw: Record<string, unknown>,
  root: string,
): { ok: true; options: TicketCommandOptions } | { ok: false; error: string } {
  const dir =
    typeof raw.ticket === "string" && raw.ticket.trim()
      ? raw.ticket.trim()
      : "";
  if (!dir) {
    return {
      ok: false,
      error: "--ticket needs a task dir name (e.g. --ticket 10-12-run-ticket)",
    };
  }
  if (typeof raw.agent === "string" && raw.agent) {
    return {
      ok: false,
      error:
        "--agent is not valid with --ticket — name the dispatch card with --worker",
    };
  }
  if (raw.untilEmpty === true) {
    return {
      ok: false,
      error:
        "--until-empty is not valid with --ticket — ticket mode runs exactly " +
        "one dir; the frontier loop is the other mode",
    };
  }
  const provider =
    typeof raw.provider === "string" && raw.provider ? raw.provider : undefined;
  if (provider && !isProvider(provider)) {
    return {
      ok: false,
      error: `unknown --provider "${provider}" (known: ${listProviders().join(", ")})`,
    };
  }
  const timeout = parseDuration(
    typeof raw.timeout === "string" ? raw.timeout : undefined,
  );
  return {
    ok: true,
    options: {
      root,
      dir,
      dryRun: raw.dryRun === true,
      worker:
        typeof raw.worker === "string" && raw.worker ? raw.worker : undefined,
      provider: provider as Provider | undefined,
      model: typeof raw.model === "string" && raw.model ? raw.model : undefined,
      workerTimeoutMs: timeout ?? DEFAULT_WORKER_TIMEOUT_MS,
    },
  };
}

/**
 * Run exactly one ticket and report back a machine-readable result. Dispatch
 * is resolved inside the runner (`resolveDispatch`): ticket meta → agent card
 * → `worker_default` → refuse. A refusal still writes a `ticket_result`
 * ledger row so an unattended caller can see why nothing ran.
 */
export async function runTicketCommand(
  raw: Record<string, unknown>,
  root: string = process.cwd(),
): Promise<TicketCommandResult> {
  if (!fs.existsSync(path.join(root, ".omtre", "scripts", "task.py"))) {
    throw new Error(
      "no .omtre/scripts/task.py here — `omtre run` drives an Omtre-managed repo",
    );
  }
  const normalized = normalizeTicketOptions(raw, root);
  if (!normalized.ok) {
    throw new Error(normalized.error);
  }
  const opts = normalized.options;

  const ledger = opts.dryRun ? null : openLedger(opts.root);
  const append: (input: LedgerInput) => void = ledger
    ? (input): void => {
        ledger.append(input);
      }
    : (): void => undefined;
  const ports = realPorts(opts.root, append);

  const resolved = resolveDispatch(
    opts.dir,
    { worker: opts.worker, provider: opts.provider, model: opts.model },
    ports,
  );

  if (opts.dryRun) {
    // A dry run must not create runs/ — the plan is printed and nothing is
    // appended to any ledger.
    ports.log(
      JSON.stringify(
        {
          ticket: opts.dir,
          dispatch: resolved.ok ? resolved.dispatch : null,
          ...(resolved.ok ? {} : { dispatch_error: resolved.error }),
          actions: resolved.ok
            ? [
                "worktree:add",
                "ticket:start",
                "worker",
                "verify:run-verify",
                "delivery-gate",
                "archive",
              ]
            : ["dispatch_refused"],
        },
        null,
        2,
      ),
    );
    return { result: null, ledgerFile: ledger?.file };
  }

  ports.ledgerAppend({
    ticket: opts.dir,
    action: "run_start",
    detail: `ticket=${opts.dir}`,
  });

  if (!resolved.ok) {
    const { result } = dispatchRefusal(opts.dir, resolved, ports);
    ports.log(`✗ ${opts.dir}: dispatch refused — ${resolved.error}`);
    return { result, ledgerFile: ledger?.file };
  }

  ports.log(
    `→ ${opts.dir} as ${resolved.dispatch.agent ?? resolved.dispatch.provider}`,
  );
  const ticketRun = await runTicket(opts.dir, resolved.dispatch, ports, {
    workerTimeoutMs: opts.workerTimeoutMs,
  });
  return { result: ticketRun.result, ledgerFile: ledger?.file };
}
