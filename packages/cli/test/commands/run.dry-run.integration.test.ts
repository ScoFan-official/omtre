/**
 * Integration test for `omtre run --dry-run` against the REAL task system.
 *
 * The unit harness scripts the frontier JSON; this one proves the two things
 * that only show up with real `task.py` output:
 *   - the frontier snapshot the runner parses is the shape `task.py frontier
 *     --json` actually prints (priority order, `--board` filter)
 *   - a dry run writes NOTHING at all: no ledger file, no `.runtime/runs`
 *     directory, no task state change (implement.md 切片 6 AC)
 *
 * Real templates are stamped into a throwaway repo. No worker is ever spawned.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runCommand } from "../../src/commands/run.js";
import { getAllAgents, getAllScripts } from "../../src/templates/extract.js";

function findPython(): string | null {
  for (const bin of ["python3", "python"]) {
    try {
      execFileSync(bin, ["--version"], { stdio: "ignore" });
      return bin;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

const PYTHON = findPython();

function testEnv(): NodeJS.ProcessEnv {
  return { ...process.env, OMTRE_WRITER: "qoder-TESTHOST-agent" };
}

function runTask(repo: string, ...args: string[]): void {
  const r = spawnSync(PYTHON as string, [".omtre/scripts/task.py", ...args], {
    cwd: repo,
    encoding: "utf-8",
    env: testEnv(),
  });
  if (r.status !== 0) {
    throw new Error(`task.py ${args.join(" ")} failed: ${r.stdout}${r.stderr}`);
  }
}

function taskDir(repo: string, slug: string): string {
  const dir = fs
    .readdirSync(path.join(repo, ".omtre", "tasks"))
    .find((d) => d.includes(slug));
  if (!dir) throw new Error(`no task dir matching ${slug}`);
  return dir;
}

/**
 * The roster the loop resolves every ticket's dispatch from: the bundled
 * agent cards plus a config fallback card. Tickets may override the card by
 * `meta.worker`; without a roster at all, dispatch refuses fail-closed.
 */
function writeRoster(repo: string): void {
  for (const [rel, content] of getAllAgents()) {
    const dest = path.join(repo, ".omtre", "agents", rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content, "utf-8");
  }
  fs.writeFileSync(
    path.join(repo, ".omtre", "config.yaml"),
    "autonomy: hands-off\nworker_default: implement\n",
    "utf-8",
  );
}

let repo = "";
let logged: string[] = [];

beforeEach(() => {
  logged = [];
  repo = fs.mkdtempSync(path.join(os.tmpdir(), "run-dry-itest-"));
  fs.mkdirSync(path.join(repo, ".omtre"), { recursive: true });
  for (const [rel, content] of getAllScripts()) {
    const dest = path.join(repo, ".omtre", "scripts", rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content, "utf-8");
  }
  const init = spawnSync(PYTHON as string, [".omtre/scripts/init_developer.py", "tester"], {
    cwd: repo,
    encoding: "utf-8",
    env: testEnv(),
  });
  if (init.status !== 0) {
    throw new Error(`init_developer failed: ${init.stderr}`);
  }
});

afterEach(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe.skipIf(PYTHON === null)("omtre run --dry-run", () => {
  it("selects the highest-priority ready ticket from real frontier output", async () => {
    runTask(repo, "create", "Blocked later", "--slug", "zeta", "--no-start", "-d", "waits");
    runTask(repo, "create", "Head work", "--slug", "alpha", "--no-start", "-d", "ready first", "--priority", "P0");
    writeRoster(repo);

    const blocked = taskDir(repo, "zeta");
    const head = taskDir(repo, "alpha");
    runTask(repo, "set-meta", blocked, "blocked_by", head);

    const original = console.log;
    console.log = (...args: unknown[]) => logged.push(args.join(" "));
    let result;
    try {
      result = await runCommand({ dryRun: true }, repo);
    } finally {
      console.log = original;
    }

    expect(result.stopped).toBe("dry_run");
    expect(result.attempted).toBe(0);
    const printed = logged.join("\n");
    expect(printed).toContain(head);
    expect(printed).not.toContain(blocked);
    expect(printed).toContain("verify:run-verify");
    // The plan names the worker the head's roster resolved — the implement
    // card from worker_default, provider claude.
    expect(printed).toContain('"agent": "implement"');
    expect(printed).toContain('"provider": "claude"');
  });

  it("writes nothing: no ledger file, no runs directory, no state change", async () => {
    runTask(repo, "create", "Only work", "--slug", "alpha", "--no-start", "-d", "ready");
    writeRoster(repo);
    const head = taskDir(repo, "alpha");
    const before = fs.readFileSync(
      path.join(repo, ".omtre", "tasks", head, "task.json"),
      "utf-8",
    );

    const original = console.log;
    console.log = () => undefined;
    try {
      await runCommand({ dryRun: true, untilEmpty: true }, repo);
    } finally {
      console.log = original;
    }

    expect(fs.existsSync(path.join(repo, ".omtre", ".runtime", "runs"))).toBe(false);
    expect(
      fs.readFileSync(path.join(repo, ".omtre", "tasks", head, "task.json"), "utf-8"),
    ).toBe(before);
  });

  it("refuses a run-level --provider — dispatch resolves per ticket", async () => {
    // Valid or not, the flag is refused wholesale: the roster is the only
    // dispatch source in loop mode.
    for (const provider of ["gemini", "claude"]) {
      await expect(
        runCommand({ provider, dryRun: true }, repo),
      ).rejects.toThrow(/--provider is not valid/);
    }
    expect(fs.existsSync(path.join(repo, ".omtre", ".runtime", "runs"))).toBe(false);
  });

  it("names the dispatch refusal in the plan instead of inventing a worker", async () => {
    // No roster at all: the ticket cannot resolve a worker, and the plan
    // must say so — never a silent fallback to a default provider.
    runTask(repo, "create", "Roster-less", "--slug", "alpha", "--no-start", "-d", "ready");
    const head = taskDir(repo, "alpha");

    const original = console.log;
    console.log = (...args: unknown[]) => logged.push(args.join(" "));
    let result;
    try {
      result = await runCommand({ dryRun: true }, repo);
    } finally {
      console.log = original;
    }

    expect(result.stopped).toBe("dry_run");
    const printed = logged.join("\n");
    expect(printed).toContain(head);
    expect(printed).toContain("dispatch_error");
    expect(printed).toContain("dispatch_refused");
  });

  it("refuses a repo it does not drive", async () => {
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), "run-no-omtre-"));
    try {
      await expect(runCommand({ dryRun: true }, bare)).rejects.toThrow(
        /no .omtre\/scripts\/task.py/,
      );
    } finally {
      fs.rmSync(bare, { recursive: true, force: true });
    }
  });
});
