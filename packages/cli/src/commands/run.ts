/**
 * `trellis run` — the unattended loop runner (design D5).
 *
 * Takes the frontier head, gives it an isolated worktree, hands it to one
 * headless worker, runs the ticket's own verification contract, and records
 * every step in a run ledger. Delivery is decided by config, not by a flag:
 * `task.py delivery-gate` (CLAI-8) answers for the ticket branch, and only
 * `autonomy: supervised-delivery` with a matching `delivery.auto_push_refs`
 * entry lets the runner push at all (AC5).
 *
 * Why everything happens in the worktree: `.trellis/` is committed content, so
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

import { loadTaskRecord } from "@mindfoldhq/trellis-core/task";

import { listProviders, type Provider } from "./channel/adapters/index.js";
import { resolveWorkerGuardConfig } from "./channel/guard.js";
import { parseDuration } from "./channel/wait.js";
import { resolveSupportedPython } from "./init.js";
import { openLedger, type LedgerInput } from "./run/ledger.js";
import { oneShotWorker, type WorkerOutcome, type WorkerRequest } from "./run/worker.js";

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
  deliveryGate(ref: string): { allow: boolean; reason: string; tier: string; code: string };
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
  provider?: Provider;
  agent?: string;
  model?: string;
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

type TicketStep =
  | { kind: "archived" }
  | { kind: "failed"; reason: string }
  | { kind: "stop"; reason: StopReason; detail: string };

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
    return { ok: false, error: `${flag} must be a positive integer, got "${value}"` };
  }
  return { ok: true, value: parsed };
}

/**
 * The action plan a dry run prints. Delivery comes from `task.py delivery-gate`
 * (CLAI-8), so the plan names the verdict the config gives for this ticket's
 * branch rather than a flag the operator waved.
 */
function plannedActions(opts: RunOptions, delivery: string): string[] {
  return [
    "frontier:head",
    "worktree:add",
    `worker:${opts.provider ?? opts.agent}:${opts.model ?? "default"}`,
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
function buildPrompt(dir: string, docs: string[], worktree: string, pythonCmd: string): string {
  return [
    `You are the unattended implementation worker for Trellis ticket \`${dir}\`.`,
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
    `3. Do not touch other tickets, \`.trellis/domains/\` boards or worklogs —`,
    `   board bookkeeping belongs to the orchestrating session, not to this`,
    `   worker, and a domain-layer anchor check will reject your commit anyway.`,
    `4. Before finishing, run the ticket's own contract:`,
    `   ${pythonCmd} ./.trellis/scripts/task.py run-verify ${dir}`,
    `   If it fails, fix it or say so plainly — do not record a passing run you`,
    `   did not observe.`,
  ].join("\n");
}

/** Curate the ticket's context lists so `start`'s empty-seed guard stays meaningful. */
function curateContext(dir: string, worktree: string, ports: RunnerPorts): void {
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
    const target = body.includes(" -> ") ? (body.split(" -> ").pop() as string) : body;
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
const BOOKKEEPING_PREFIXES = [".trellis/tasks/", ".trellis/.runtime/"];

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
    return { ok: false, reason: `status_failed(${firstLine(status.stderr || status.stdout)})` };
  }
  const changed = parsePorcelain(status.stdout);
  const paths = changed.filter((p) => !isBookkeeping(p));
  const bookkeeping = changed.length - paths.length;
  if (paths.length === 0) {
    return {
      ok: false,
      reason: changed.length === 0
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
    return { ok: false, reason: `stage_failed(${firstLine(staged.stderr || staged.stdout)})` };
  }
  const committed = ports.git(
    ["commit", "-m", `run(${dir}): worker output committed by the runner`],
    worktree,
  );
  if (committed.status !== 0) {
    return { ok: false, reason: `commit_failed(${firstLine(committed.stderr || committed.stdout)})` };
  }

  const head = ports.git(["rev-parse", "HEAD"], worktree);
  return { ok: true, paths, bookkeeping, oid: head.stdout.trim() };
}

async function processOne(
  entry: FrontierEntry,
  opts: RunOptions,
  ports: RunnerPorts,
): Promise<TicketStep> {
  const dir = entry.dir;
  const branch = ports.taskField(dir, "branch");
  const base = ports.taskField(dir, "base_branch");
  if (!branch || !base) {
    return { kind: "failed", reason: "no_branch_metadata(set-branch/set-base-branch first)" };
  }

  const worktree = ports.worktreePath(dir);
  if (ports.worktreeOccupied(dir)) {
    return { kind: "failed", reason: `worktree_occupied(${worktree})` };
  }

  const hasBranch = ports.git(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]);
  const addArgs =
    hasBranch.status === 0
      ? ["worktree", "add", worktree, branch]
      : ["worktree", "add", worktree, "-b", branch, base];
  const added = ports.git(addArgs);
  if (added.status !== 0) {
    return { kind: "failed", reason: `worktree_add_failed(${firstLine(added.stderr || added.stdout)})` };
  }
  ports.ledgerAppend({ ticket: dir, action: "worktree", detail: worktree });
  if (!ports.pathExists(path.join(worktree, ".trellis", "scripts", "task.py"))) {
    // `get_repo_root()` walks up from cwd, so a worktree without its own
    // committed .trellis/ would silently aim at the orchestrating repo instead.
    ports.git(["worktree", "remove", "--force", worktree]);
    return { kind: "failed", reason: `worktree_has_no_trellis(commit .trellis on ${base} first)` };
  }

  try {
    return await runAttempt(dir, entry, branch, base, worktree, opts, ports);
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
  entry: FrontierEntry,
  branch: string,
  base: string,
  worktree: string,
  opts: RunOptions,
  ports: RunnerPorts,
): Promise<TicketStep> {
  ports.task(["set-worktree", dir, worktree], worktree);

  curateContext(dir, worktree, ports);

  const started = ports.task(["start", dir], worktree);
  if (started.status !== 0) {
    return { kind: "failed", reason: `start_refused(${firstLine(started.stderr || started.stdout)})` };
  }
  ports.ledgerAppend({ ticket: dir, action: "ticket_start", detail: `priority=${entry.priority ?? "-"} branch=${branch}` });

  const docs = ports.ticketDocs(dir).map((doc) => path.join(worktree, ".trellis", "tasks", dir, path.basename(doc)));
  const outcome = await ports.worker({
    ticket: dir,
    cwd: worktree,
    prompt: buildPrompt(dir, docs, worktree, ports.pythonCommand()),
    provider: opts.provider,
    agent: opts.agent,
    model: opts.model,
    timeoutMs: opts.workerTimeoutMs,
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
    (ports.git(["rev-list", "--count", `${base}..HEAD`], worktree).stdout || "").trim(),
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
      (ports.git(["rev-list", "--count", `${base}..HEAD`], worktree).stdout || "0").trim(),
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
    const parsed = JSON.parse(verify.stdout) as { verified?: boolean; reason?: string };
    verified = parsed.verified === true;
    verifyReason = parsed.reason;
  } catch {
    verifyReason = "unreadable_output";
  }
  ports.ledgerAppend({
    ticket: dir,
    action: "verify",
    commit: oid,
    command: "task.py run-verify --json",
    exit: verify.status,
    reason: verified ? undefined : (verifyReason ?? `exit_${verify.status}`),
  });
  if (!verified) {
    return { kind: "failed", reason: `verify_failed(${verifyReason ?? `exit_${verify.status}`})` };
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
      };
    }
    const pushed = ports.git(["push", "-u", "origin", branch], worktree);
    if (pushed.status !== 0) {
      return { kind: "failed", reason: `push_failed(${firstLine(pushed.stderr || pushed.stdout)})` };
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
      entry.title ?? dir,
      "--body",
      `Unattended run for ticket \`${dir}\`. Verify: \`${ports.pythonCommand()} ./.trellis/scripts/task.py run-verify ${dir}\`.`,
    ]);
    if (pr.status !== 0) {
      return { kind: "failed", reason: `pr_open_failed(${firstLine(pr.stderr || pr.stdout)})` };
    }
    const url = firstLine(pr.stdout);
    if (!/^https?:\/\//.test(url)) {
      return {
        kind: "failed",
        reason: `pr_url_unreadable(gh printed: ${url || "(nothing)"}; the branch is pushed, open the PR by hand)`,
      };
    }
    ports.task(["set-pr", dir, url], worktree);
    ports.ledgerAppend({ ticket: dir, action: "delivery", commit: oid, detail: url });
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
    return { kind: "failed", reason: `archive_refused(${firstLine(archived.stderr || archived.stdout)})` };
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
      };
    }
  }

  ports.ledgerAppend({
    ticket: dir,
    action: "archived",
    commit: oid,
    detail: `branch tip ${ports.git(["rev-parse", "HEAD"], worktree).stdout.trim().slice(0, 8)}`,
  });
  return { kind: "archived" };
}

export async function runLoop(opts: RunOptions, ports: RunnerPorts): Promise<RunResult> {
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
      opts.board ? ["frontier", "--json", "--board", opts.board] : ["frontier", "--json"],
    );
    let snapshot: FrontierSnapshot;
    try {
      snapshot = JSON.parse(front.stdout) as FrontierSnapshot;
    } catch {
      const detail = firstLine(front.stderr || front.stdout) || "no output";
      ports.ledgerAppend({ ticket: "-", action: "stop", reason: `frontier_unreadable: ${detail}` });
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
      ports.ledgerAppend({ ticket: "-", action: "stop", reason: "max_tickets reached" });
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
      const reason = skipped.length > 0 ? "no_grabbable_ticket" : "frontier_empty";
      ports.ledgerAppend({
        ticket: "-",
        action: "stop",
        reason: skipped.length > 0 ? `nothing grabbable: ${skipped.join("; ")}` : "frontier empty",
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
      ports.log(
        JSON.stringify(
          { ticket: head.dir, branch, tier: gate.tier, actions: plannedActions(opts, delivery) },
          null,
          2,
        ),
      );
      return { stopped: "dry_run", attempted, archived, failed };
    }

    attempted += 1;
    ports.log(`→ ${head.dir} (${head.priority ?? "-"})`);
    const step = await processOne(head, opts, ports);

    if (step.kind === "stop") {
      // The machine reason leads the ledger line: "why did the line stop" has
      // to be readable without re-parsing a human sentence.
      ports.ledgerAppend({ ticket: head.dir, action: "stop", reason: `${step.reason}: ${step.detail}` });
      ports.log(`Stopped (${step.reason}): ${step.detail}`);
      return { stopped: step.reason, attempted, archived, failed };
    }

    if (step.kind === "failed") {
      failed += 1;
      const count = (strikes.get(head.dir) ?? 0) + 1;
      strikes.set(head.dir, count);
      ports.log(`✗ ${head.dir}: ${step.reason} (strike ${count}/${opts.failThreshold})`);
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
        ports.log(`Stopped: ${head.dir} failed ${count} times in a row — handed to a human.`);
        return { stopped: "fail_threshold", attempted, archived, failed };
      }
      continue;
    }

    strikes.delete(head.dir);
    delivered.add(head.dir);
    archived += 1;
    ports.log(`✓ ${head.dir} archived on its branch`);
    if (!opts.untilEmpty) {
      ports.ledgerAppend({ ticket: "-", action: "stop", reason: "one ticket (--until-empty not set)" });
      return { stopped: "single_ticket", attempted, archived, failed };
    }
  }
}

// -----------------------------------------------------------------------------
// Real ports — thin adapters over subprocess and fs. No policy lives here.
// -----------------------------------------------------------------------------

function run(cmd: string, args: string[], cwd: string, input?: string): CommandResult {
  const res = spawnSync(cmd, args, { cwd, encoding: "utf-8", input });
  if (res.error && (res.error as NodeJS.ErrnoException).code === "ENOENT") {
    return { status: 127, stdout: "", stderr: `${cmd}: not found on PATH` };
  }
  return { status: res.status ?? 1, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

export function realPorts(
  root: string,
  ledgerAppend: (input: LedgerInput) => void,
  log: (message: string) => void = (message): void => {
    console.log(message);
  },
): RunnerPorts {
  const python = resolveSupportedPython().command;
  const taskPy = path.join(root, ".trellis", "scripts", "task.py");
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
      const script = cwd ? path.join(cwd, ".trellis", "scripts", "task.py") : taskPy;
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
          reason: parsed.reason ?? `unreadable_output(${firstLine(res.stderr || res.stdout)})`,
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
        const parsed = JSON.parse(res.stdout) as { ok?: boolean; offending?: string[] };
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
          taskDir: path.join(root, ".trellis", "tasks", dir),
          cwd: root,
        }) as unknown as Record<string, unknown>;
        const value = record[field];
        return typeof value === "string" && value.length > 0 ? value : null;
      } catch {
        return null;
      }
    },
    worktreePath(dir) {
      return path.join(root, ".trellis", ".runtime", "worktrees", dir);
    },
    ticketClosedOnBranch(branch, dir) {
      const ref = run("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], root);
      if (ref.status !== 0) return false;
      const onBranch = run(
        "git",
        ["cat-file", "-e", `${branch}:.trellis/tasks/${dir}/task.json`],
        root,
      );
      return onBranch.status !== 0;
    },
    worktreeOccupied(dir) {
      const target = path.join(root, ".trellis", ".runtime", "worktrees", dir);
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
      const taskDir = path.join(root, ".trellis", "tasks", dir);
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

/** Normalize commander's loose option bag into a validated `RunOptions`. */
export function normalizeOptions(
  raw: Record<string, unknown>,
  root: string,
): { ok: true; options: RunOptions } | { ok: false; error: string } {
  const provider = typeof raw.provider === "string" && raw.provider ? raw.provider : undefined;
  const agent = typeof raw.agent === "string" && raw.agent ? raw.agent : undefined;
  if (provider && !listProviders().includes(provider as Provider)) {
    return {
      ok: false,
      error: `unknown --provider "${provider}" (known: ${listProviders().join(", ")})`,
    };
  }
  if (!provider && !agent) {
    return {
      ok: false,
      error:
        `needs --provider <${listProviders().join("|")}> or --agent <name> — ` +
        "an unattended run must name the worker it is delegating to",
    };
  }

  const maxTickets = positiveInt("--max-tickets", raw.maxTickets, DEFAULT_MAX_TICKETS);
  if (!maxTickets.ok) return maxTickets;
  const failThreshold = positiveInt("--max-failures", raw.maxFailures, DEFAULT_FAIL_THRESHOLD);
  if (!failThreshold.ok) return failThreshold;

  const timeout = parseDuration(typeof raw.timeout === "string" ? raw.timeout : undefined);

  return {
    ok: true,
    options: {
      root,
      board: typeof raw.board === "string" && raw.board ? raw.board : undefined,
      maxTickets: maxTickets.value,
      untilEmpty: raw.untilEmpty === true,
      dryRun: raw.dryRun === true,
      provider: provider as Provider | undefined,
      agent,
      model: typeof raw.model === "string" && raw.model ? raw.model : undefined,
      workerTimeoutMs: timeout ?? DEFAULT_WORKER_TIMEOUT_MS,
      failThreshold: failThreshold.value,
    },
  };
}

export async function runCommand(
  raw: Record<string, unknown>,
  root: string = process.cwd(),
): Promise<RunResult> {
  if (!fs.existsSync(path.join(root, ".trellis", "scripts", "task.py"))) {
    throw new Error(
      "no .trellis/scripts/task.py here — `trellis run` drives a Trellis-managed repo",
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
