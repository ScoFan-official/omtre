/**
 * End-to-end test for the single-ticket runner against the REAL task system:
 * real `task.py` scripts, real git worktrees, a real ledger file — and a
 * simulated worker (a file write stands in for the headless provider, exactly
 * the seam `RunnerPorts.worker` exists for).
 *
 *   trellis run --ticket … → worktree → start → worker → always-stop ×2 →
 *   verify → delivery-gate → …
 *
 * The repo sits at `hands-off`, so a verified ticket defers at the gate —
 * `delivery_deferred`, the hands-off terminal state the orchestrator treats
 * as a successful, human-deliverable result. Along the way it must prove:
 *   - `attempt_started` / `attempt_finished` / `ticket_result` rows land in a
 *     real `.runtime/runs/*.jsonl` file (the takeover contract)
 *   - the structured result carries dir/outcome/code/strikes/verify
 *   - durable state stays task.py-owned: no `meta.triage=ready-for-human`
 *     write on a deferred ticket, the ticket still lives under tasks/
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { realPorts, runTicket } from "../../src/commands/run.js";
import { openLedger } from "../../src/commands/run/ledger.js";

const TEMPLATE_SCRIPTS = path.resolve(
  __dirname,
  "../../src/templates/trellis/scripts",
);

function findBin(candidates: string[]): string | null {
  for (const bin of candidates) {
    try {
      execFileSync(bin, ["--version"], { stdio: "ignore" });
      return bin;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

const PYTHON = findBin(["python3", "python"]);
const GIT = findBin(["git"]);

function testEnv(): NodeJS.ProcessEnv {
  return { ...process.env, TRELLIS_WRITER: "qoder-TESTHOST-agent" };
}

function runIn(repo: string, cmd: string, args: string[]): void {
  const r = spawnSync(cmd, args, {
    cwd: repo,
    encoding: "utf-8",
    env: testEnv(),
  });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed: ${r.stdout}${r.stderr}`);
  }
}

function taskDir(repo: string, slug: string): string {
  const dir = fs
    .readdirSync(path.join(repo, ".trellis", "tasks"))
    .find((d) => d.includes(slug));
  if (!dir) throw new Error(`no task dir matching ${slug}`);
  return dir;
}

let repo = "";
const cleanup: string[] = [];

beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), "run-ticket-itest-"));
  cleanup.push(repo);
  fs.mkdirSync(path.join(repo, ".trellis"), { recursive: true });
  fs.cpSync(TEMPLATE_SCRIPTS, path.join(repo, ".trellis", "scripts"), {
    recursive: true,
  });
  runIn(repo, PYTHON as string, [
    ".trellis/scripts/init_developer.py",
    "tester",
  ]);
  fs.writeFileSync(
    path.join(repo, ".trellis", "config.yaml"),
    "autonomy: hands-off\n",
    "utf-8",
  );
  runIn(repo, GIT as string, ["init", "-b", "main"]);
  runIn(repo, GIT as string, ["config", "user.email", "test@example.com"]);
  runIn(repo, GIT as string, ["config", "user.name", "test"]);
});

afterEach(() => {
  for (const dir of cleanup.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe.skipIf(PYTHON === null || GIT === null)(
  "trellis run --ticket e2e",
  () => {
    it("runs one ticket to delivery_deferred under hands-off, leaving the ledger contract on disk", async () => {
      // A ticket with the two things the pipeline reads: branch metadata and a
      // trivially passing verification contract.
      runIn(repo, PYTHON as string, [
        ".trellis/scripts/task.py",
        "create",
        "Alpha",
        "--slug",
        "alpha",
        "--no-start",
        "-d",
        "first ticket",
      ]);
      const dir = taskDir(repo, "alpha");
      runIn(repo, PYTHON as string, [
        ".trellis/scripts/task.py",
        "set-branch",
        dir,
        "feature/alpha",
      ]);
      runIn(repo, PYTHON as string, [
        ".trellis/scripts/task.py",
        "set-base-branch",
        dir,
        "main",
      ]);
      runIn(repo, PYTHON as string, [
        ".trellis/scripts/task.py",
        "add-verify",
        dir,
        "exit 0",
      ]);
      // The worktree inherits only what the base branch carries — commit it all.
      runIn(repo, GIT as string, ["add", "-A"]);
      runIn(repo, GIT as string, ["commit", "-m", "seed"]);
      // A remote exists so the gate is actually consulted — but it is never
      // pushed to, because hands-off refuses push before any network call.
      runIn(repo, GIT as string, [
        "remote",
        "add",
        "origin",
        path.join(repo, "..", "never-pushed.git"),
      ]);

      const ledger = openLedger(repo);
      const workerCwds: string[] = [];
      const ports = {
        ...realPorts(repo, (input) => {
          ledger.append(input);
        }),
        async worker(req: { cwd: string }) {
          // Stand-in for a headless provider: leave one file, let the runner's
          // fallback stage it — that exercises the guard + commit path too.
          workerCwds.push(req.cwd);
          fs.writeFileSync(
            path.join(req.cwd, "worker-output.txt"),
            "fake worker artifact\n",
          );
          return { ok: true as const, worker: "fake-worker", text: "done" };
        },
        log: () => undefined,
      };

      const { step, result } = await runTicket(
        dir,
        { provider: "claude", agent: "implement" },
        ports,
      );

      // Structured result — the orchestrator's verdict for this ticket.
      expect(step.kind).toBe("stop");
      if (step.kind === "stop") expect(step.reason).toBe("delivery_deferred");
      expect(result).toMatchObject({
        dir,
        outcome: "delivery_deferred",
        code: "delivery_deferred",
        strikes: 0,
        dispatch: { provider: "claude", agent: "implement" },
      });
      expect(result.verify?.verified).toBe(true);

      // The attempt contract landed in a real runs/*.jsonl — an orchestrator
      // can read started/finished pairing straight off disk.
      const rows = fs
        .readFileSync(ledger.file, "utf-8")
        .trim()
        .split("\n")
        .map(
          (l) =>
            JSON.parse(l) as {
              action: string;
              ticket?: string;
              reason?: string;
              detail?: string;
            },
        );
      const actions = rows.map((r) => r.action);
      expect(actions[0]).toBe("attempt_started");
      expect(actions).toContain("worktree");
      expect(actions).toContain("ticket_start");
      expect(actions).toContain("worker");
      expect(actions).toContain("verify");
      expect(actions).toContain("delivery");
      expect(actions.indexOf("attempt_finished")).toBeGreaterThan(
        actions.indexOf("attempt_started"),
      );
      const resultRow = rows.find((r) => r.action === "ticket_result");
      expect(resultRow?.reason).toBe("delivery_deferred:delivery_deferred");
      expect(JSON.parse(resultRow?.detail ?? "")).toEqual(result);

      // The worker really ran inside the ticket worktree.
      expect(workerCwds).toEqual([
        path.join(repo, ".trellis", ".runtime", "worktrees", dir),
      ]);
      // The worktree is always transient.
      expect(fs.existsSync(workerCwds[0] as string)).toBe(false);

      // Durable state stayed task.py-owned: nothing marked ready-for-human,
      // and a deferred ticket was not archived.
      const taskJson = JSON.parse(
        fs.readFileSync(
          path.join(repo, ".trellis", "tasks", dir, "task.json"),
          "utf-8",
        ),
      ) as { meta?: Record<string, unknown> };
      expect(taskJson.meta?.triage).toBeUndefined();
      // The work itself stands on the branch — commits exist ahead of main.
      const ahead = spawnSync(
        GIT as string,
        ["rev-list", "--count", "main..feature/alpha"],
        {
          cwd: repo,
          encoding: "utf-8",
        },
      );
      expect(parseInt(ahead.stdout.trim(), 10)).toBeGreaterThanOrEqual(1);
    });
  },
);
