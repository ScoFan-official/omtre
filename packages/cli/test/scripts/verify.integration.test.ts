/**
 * Integration tests for the task verification contract (common/verify.py):
 *
 *   R4  `verify` is a formal task.json field holding re-runnable commands;
 *       `add-verify` / `run-verify` / `clear-verify` maintain and execute it.
 *   Gate  `archive` runs the contract instead of trusting a stored result, so
 *       nothing lands on evidence that went stale. Missing contract refuses
 *       outside `gated` autonomy; `--skip-verify` needs a reason and records it.
 *   Shape  a malformed entry is a validation error, because silently dropping
 *       it would switch the gate off.
 *
 * Real templates are stamped into a throwaway repo and driven through the CLI.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEMPLATE_SCRIPTS = path.resolve(
  __dirname,
  "../../src/templates/trellis/scripts",
);

const DEVELOPER = "tester";

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
  return {
    ...process.env,
    TRELLIS_WRITER: "qoder-TESTHOST-agent",
    TRELLIS_CONTEXT_ID: "verify-itest",
  };
}

let repo = "";
let env: NodeJS.ProcessEnv = testEnv();

function runTask(...args: string[]) {
  return spawnSync(PYTHON as string, [".trellis/scripts/task.py", ...args], {
    cwd: repo,
    encoding: "utf-8",
    env,
  });
}

function dirOf(needle: string): string {
  const dir = fs
    .readdirSync(path.join(repo, ".trellis", "tasks"))
    .find((d) => d.includes(needle));
  if (!dir) throw new Error(`no task dir matching ${needle}`);
  return dir;
}

function readTaskJson(dirName: string): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(
      path.join(repo, ".trellis", "tasks", dirName, "task.json"),
      "utf-8",
    ),
  );
}

function writeTaskJson(dirName: string, data: Record<string, unknown>): void {
  fs.writeFileSync(
    path.join(repo, ".trellis", "tasks", dirName, "task.json"),
    JSON.stringify(data, null, 2),
    "utf-8",
  );
}

function createTask(slug: string): string {
  const r = runTask(
    "create",
    `Task ${slug}`,
    "--slug",
    slug,
    "--no-start",
    "-d",
    `fixture ${slug}`,
  );
  if (r.status !== 0) throw new Error(`create failed: ${r.stdout}${r.stderr}`);
  return dirOf(slug);
}

function isActive(dirName: string): boolean {
  return fs.existsSync(
    path.join(repo, ".trellis", "tasks", dirName, "task.json"),
  );
}

function setAutonomy(mode: string | null): void {
  const configPath = path.join(repo, ".trellis", "config.yaml");
  if (mode === null) {
    if (fs.existsSync(configPath)) fs.rmSync(configPath);
    return;
  }
  fs.writeFileSync(configPath, `autonomy: ${mode}\n`, "utf-8");
}

beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), "verify-itest-"));
  fs.mkdirSync(path.join(repo, ".trellis"), { recursive: true });
  fs.cpSync(TEMPLATE_SCRIPTS, path.join(repo, ".trellis", "scripts"), {
    recursive: true,
  });
  const init = spawnSync(
    PYTHON as string,
    [".trellis/scripts/init_developer.py", DEVELOPER],
    { cwd: repo, encoding: "utf-8", env: testEnv() },
  );
  if (init.status !== 0)
    throw new Error(`init_developer failed: ${init.stderr}`);
  env = testEnv();
  // No remote and no branch metadata: archive's branch gate stays out of the
  // way so these tests measure the verification gate alone.
  setAutonomy(null);
});

afterEach(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe("verify contract storage", () => {
  it("records the formal field with defaults", () => {
    const dir = createTask("v-one");
    expect(runTask("add-verify", dir, "python --version").status).toBe(0);

    const data = readTaskJson(dir);
    expect(data.verify).toEqual([
      { cmd: "python --version", expect_exit: 0, timeout: 600 },
    ]);
  });

  it("keeps explicit expect_exit and timeout, and does not duplicate a command", () => {
    const dir = createTask("v-two");
    runTask(
      "add-verify",
      dir,
      "git --help",
      "--expect-exit",
      "0",
      "--timeout",
      "30",
    );
    const repeat = runTask("add-verify", dir, "git --help");
    expect(repeat.stdout).toContain("Already recorded");
    expect(readTaskJson(dir).verify).toHaveLength(1);

    runTask("add-verify", dir, "exit 3", "--expect-exit", "3");
    const specs = readTaskJson(dir).verify as Record<string, unknown>[];
    expect(specs[1]).toEqual({ cmd: "exit 3", expect_exit: 3, timeout: 600 });
  });

  it("clears the contract", () => {
    const dir = createTask("v-three");
    runTask("add-verify", dir, "python --version");
    expect(runTask("clear-verify", dir).status).toBe(0);
    expect(readTaskJson(dir).verify).toEqual([]);
  });
});

describe("run-verify", () => {
  it("passes when every command exits as expected", () => {
    const dir = createTask("r-one");
    runTask("add-verify", dir, 'python -c "import sys; sys.exit(0)"');
    const r = runTask("run-verify", dir, "--json");
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.verified).toBe(true);
    expect(out.results[0].exit_code).toBe(0);
    expect(out.results[0].passed).toBe(true);
  });

  it("fails when a command exits unexpectedly, and honours a non-zero expectation", () => {
    const dir = createTask("r-two");
    runTask("add-verify", dir, 'python -c "import sys; sys.exit(2)"');
    expect(runTask("run-verify", dir).status).toBe(1);

    runTask(
      "add-verify",
      dir,
      'python -c "import sys; sys.exit(7)"',
      "--expect-exit",
      "7",
    );
    const r = runTask("run-verify", dir, "--json");
    expect(r.status).toBe(1);
    const results = JSON.parse(r.stdout).results as Record<string, unknown>[];
    expect(results[0].passed).toBe(false);
    expect(results[1].passed).toBe(true);
  });

  it("reports a missing contract instead of pretending it passed", () => {
    const dir = createTask("r-three");
    const r = runTask("run-verify", dir);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("No verification contract");
  });

  it("kills a hung command's whole tree instead of blocking on the orphan", () => {
    // The hazard `subprocess.run(shell=True, timeout=…)` leaves behind: the
    // timeout kills the SHELL, the grandchild survives holding the captured
    // pipes open, and the post-kill collect then waits for it — so `archive`
    // hangs on the very command the timeout exists to bound. The orphan sleeps
    // 120s here; this must come back in seconds, not after the orphan exits.
    fs.writeFileSync(
      path.join(repo, "sleeper.py"),
      "import time\ntime.sleep(120)\n",
      "utf-8",
    );
    fs.writeFileSync(
      path.join(repo, "hang.py"),
      'import subprocess, sys, time\nsubprocess.Popen([sys.executable, "sleeper.py"])\ntime.sleep(120)\n',
      "utf-8",
    );
    const dir = createTask("r-four");
    expect(runTask("add-verify", dir, "python hang.py", "--timeout", "2").status).toBe(0);

    const started = Date.now();
    const r = spawnSync(PYTHON as string, [".trellis/scripts/task.py", "run-verify", dir, "--json"], {
      cwd: repo,
      encoding: "utf-8",
      env,
      timeout: 60_000, // a regression must fail this test, not hang the suite
    });
    const elapsed = Date.now() - started;

    expect(r.status).toBe(1);
    const out = JSON.parse(r.stdout);
    expect(out.verified).toBe(false);
    expect(out.results[0].exit_code).toBeNull();
    expect(out.results[0].passed).toBe(false);
    expect(elapsed).toBeLessThan(45_000);
  });
});

describe("archive gate", () => {
  it("refuses to archive when the contract fails, leaving the task active", () => {
    const dir = createTask("g-one");
    runTask("add-verify", dir, 'python -c "import sys; sys.exit(1)"');

    const r = runTask("archive", dir, "--no-commit");
    expect(r.status).toBe(1);
    expect(r.stderr + r.stdout).toContain("verification failed");
    expect(isActive(dir)).toBe(true);
  });

  it("archives when the contract passes", () => {
    const dir = createTask("g-two");
    runTask("add-verify", dir, 'python -c "import sys; sys.exit(0)"');

    const r = runTask("archive", dir, "--no-commit");
    expect(r.status).toBe(0);
    expect(isActive(dir)).toBe(false);
  });

  it("warns and archives when no contract is recorded (opt-out default)", () => {
    const dir = createTask("g-three");
    const r = runTask("archive", dir, "--no-commit");
    expect(r.status).toBe(0);
    expect(r.stdout + r.stderr).toContain("archiving without evidence");
    expect(isActive(dir)).toBe(false);
  });

  it("refuses a task with no contract once the repo opts in", () => {
    // The inline-comment form is the one that silently breaks a config reader,
    // so the accessor's fixture has to cover it.
    fs.writeFileSync(
      path.join(repo, ".trellis", "config.yaml"),
      "verify_required: true   # archive needs a contract\n",
      "utf-8",
    );
    const dir = createTask("g-four");
    const r = runTask("archive", dir, "--no-commit");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("verify_required");
    expect(isActive(dir)).toBe(true);
  });

  it("refuses by default under supervised-delivery, and `no` still opts out", () => {
    // The third tier promised this: an unattended run must not archive on
    // prose. The key overrides in both directions.
    fs.writeFileSync(
      path.join(repo, ".trellis", "config.yaml"),
      "autonomy: supervised-delivery\n",
      "utf-8",
    );
    const dir = createTask("g-four-b");
    const refused = runTask("archive", dir, "--no-commit");
    expect(refused.status).toBe(1);
    expect(isActive(dir)).toBe(true);

    fs.writeFileSync(
      path.join(repo, ".trellis", "config.yaml"),
      "autonomy: supervised-delivery\nverify_required: no\n",
      "utf-8",
    );
    const warned = runTask("archive", dir, "--no-commit");
    expect(warned.status).toBe(0);
    expect(warned.stdout + warned.stderr).toContain("archiving without evidence");
  });

  it("accepts --skip-verify with a reason and records it", () => {
    const dir = createTask("g-five");
    runTask("add-verify", dir, 'python -c "import sys; sys.exit(1)"');

    const r = runTask(
      "archive",
      dir,
      "--no-commit",
      "--skip-verify",
      "docs-only change",
    );
    expect(r.status).toBe(0);
    expect(isActive(dir)).toBe(false);
  });

  it("demands a non-empty reason for --skip-verify", () => {
    const dir = createTask("g-six");
    runTask("add-verify", dir, 'python -c "import sys; sys.exit(0)"');
    const r = runTask("archive", dir, "--no-commit", "--skip-verify", "   ");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("non-empty reason");
    expect(isActive(dir)).toBe(true);
  });

  it("writes verify_skipped into task.json when the gate is bypassed", () => {
    const dir = createTask("g-seven");
    runTask("add-verify", dir, 'python -c "import sys; sys.exit(0)"');
    // Archive moves the dir, so read the record from the archive instead.
    const r = runTask(
      "archive",
      dir,
      "--no-commit",
      "--skip-verify",
      "spot check",
    );
    expect(r.status).toBe(0);

    const months = fs.readdirSync(
      path.join(repo, ".trellis", "tasks", "archive"),
    );
    const archived = path.join(
      repo,
      ".trellis",
      "tasks",
      "archive",
      months[0],
      dir,
    );
    const data = JSON.parse(
      fs.readFileSync(path.join(archived, "task.json"), "utf-8"),
    );
    expect(data.verify_skipped.reason).toBe("spot check");
    expect(data.verify_skipped.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("validate shape checks", () => {
  it("counts a malformed verify entry as an error", () => {
    const dir = createTask("s-one");
    writeTaskJson(dir, { ...readTaskJson(dir), verify: [{ expect_exit: 0 }] });

    const r = runTask("validate", dir);
    expect(r.stdout).toContain("missing a non-empty 'cmd'");
  });

  it("stays silent about a missing contract unless verify_required is on", () => {
    // Upstream contract: a clean manifest validates warning-free. The
    // missing-contract note must be opt-in, matching the archive gate.
    const dir = createTask("s-two");
    const r = runTask("validate", dir);
    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain("no verification contract");
  });

  it("warns about a missing contract when verify_required is on", () => {
    const dir = createTask("s-three");
    fs.writeFileSync(
      path.join(repo, ".trellis", "config.yaml"),
      "verify_required: true\n",
      "utf-8",
    );
    const r = runTask("validate", dir);
    expect(r.stdout).toContain("no verification contract");
    expect(r.stdout).toContain("verify_required: true");
  });
});
