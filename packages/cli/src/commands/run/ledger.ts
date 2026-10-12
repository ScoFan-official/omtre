/**
 * Run ledger — one JSONL file per `trellis run`, under
 * `.trellis/.runtime/runs/` (gitignored, same area as `.runtime/sessions/`).
 *
 * Each line is one action the runner took, so a run can be reconstructed
 * after the fact: which ticket, which worker, which commit, which verify
 * command with which exit code, and why the line stopped.
 *
 * The ledger is a runtime trace, NOT a reconciliation source: truth order
 * stays git history > worklog > README `## 进度` (see WORKLOG-PROTOCOL). The
 * close-out step summarizes it into the worklog's 验证 field.
 */

import fs from "node:fs";
import path from "node:path";

export type LedgerAction =
  | "run_start"
  | "attempt_started"
  | "ticket_start"
  | "worktree"
  | "worker"
  | "verify"
  | "delivery"
  | "archived"
  | "attempt_finished"
  | "ticket_result"
  | "blocked"
  | "stop";

export interface LedgerLine {
  ts: string;
  ticket: string;
  action: LedgerAction;
  worker?: string;
  commit?: string;
  command?: string;
  exit?: number;
  reason?: string;
  detail?: string;
}

export type LedgerInput = Omit<LedgerLine, "ts">;

export interface Ledger {
  file: string;
  append(input: LedgerInput): LedgerLine;
}

/** `20261009T101112Z` — sortable, collision-free at second granularity. */
export function ledgerStamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function runsDir(repoRoot: string): string {
  return path.join(repoRoot, ".trellis", ".runtime", "runs");
}

/**
 * Open the ledger for one run. The directory and file are created on the
 * first `append`, so a `--dry-run` (which never opens a ledger, and would
 * otherwise still leave a directory behind) writes nothing at all.
 */
export function openLedger(
  repoRoot: string,
  now: Date = new Date(),
  dir: string = runsDir(repoRoot),
): Ledger {
  const file = path.join(dir, `run-${ledgerStamp(now)}.jsonl`);
  return {
    file,
    append(input: LedgerInput): LedgerLine {
      const line: LedgerLine = { ts: new Date().toISOString(), ...input };
      fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(file, `${JSON.stringify(line)}\n`, "utf-8");
      return line;
    },
  };
}
