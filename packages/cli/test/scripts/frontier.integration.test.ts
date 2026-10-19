/**
 * Integration tests for the task dependency frontier (common/frontier.py):
 *
 *   R1  `blocked_by` is a formal task.json field; the inverse direction is
 *       always derived, so the graph has exactly one writable side.
 *   R2  `task.py frontier` reports startable work, names what each waiting
 *       task is blocked on, exits non-zero on a cycle, and warns (without
 *       exiting non-zero) on refs that match nothing.
 *   Compat  legacy `meta.blocked_by` still resolves until migrated; the
 *       formal field wins when both are present; `validate` prints the hint.
 *
 * Real templates are stamped into a throwaway repo and driven through the
 * actual CLI — no internal mocks.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getOmtreTemplatePath } from "../../src/templates/extract.js";

const TEMPLATE_SCRIPTS = path.join(getOmtreTemplatePath(), "scripts");

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
    OMTRE_WRITER: "qoder-TESTHOST-agent",
    OMTRE_CONTEXT_ID: "frontier-itest",
  };
}

function runTask(repo: string, ...args: string[]) {
  return spawnSync(PYTHON as string, [".omtre/scripts/task.py", ...args], {
    cwd: repo,
    encoding: "utf-8",
    env: testEnv(),
  });
}

function frontierJson(repo: string, ...extra: string[]) {
  const r = runTask(repo, "frontier", "--json", ...extra);
  return {
    result: JSON.parse(r.stdout || "{}"),
    status: r.status ?? 1,
    raw: r,
  };
}

function dirOf(repo: string, needle: string): string {
  const dir = fs
    .readdirSync(path.join(repo, ".omtre", "tasks"))
    .find((d) => d.includes(needle));
  if (!dir) throw new Error(`no task dir matching ${needle}`);
  return dir;
}

function readTaskJson(repo: string, dirName: string): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(
      path.join(repo, ".omtre", "tasks", dirName, "task.json"),
      "utf-8",
    ),
  );
}

function writeTaskJson(
  repo: string,
  dirName: string,
  data: Record<string, unknown>,
): void {
  fs.writeFileSync(
    path.join(repo, ".omtre", "tasks", dirName, "task.json"),
    JSON.stringify(data, null, 2),
    "utf-8",
  );
}

function createTask(repo: string, slug: string, ...extra: string[]): string {
  const r = runTask(
    repo,
    "create",
    `Task ${slug}`,
    "--slug",
    slug,
    "--no-start",
    "-d",
    `fixture ${slug}`,
    ...extra,
  );
  if (r.status !== 0) {
    throw new Error(`create ${slug} failed: ${r.stdout}${r.stderr}`);
  }
  return dirOf(repo, slug);
}

let repo = "";

beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), "frontier-itest-"));
  fs.mkdirSync(path.join(repo, ".omtre"), { recursive: true });
  fs.cpSync(TEMPLATE_SCRIPTS, path.join(repo, ".omtre", "scripts"), {
    recursive: true,
  });
  const init = spawnSync(
    PYTHON as string,
    [".omtre/scripts/init_developer.py", DEVELOPER],
    { cwd: repo, encoding: "utf-8", env: testEnv() },
  );
  if (init.status !== 0) {
    throw new Error(`init_developer failed: ${init.stderr}`);
  }
});

afterEach(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe("task.py frontier", () => {
  it("lists every unblocked task as ready, highest priority first", () => {
    createTask(repo, "b-two");
    createTask(repo, "a-one", "--priority", "P0");

    const { result } = frontierJson(repo);
    expect(result.ready.map((e: { dir: string }) => e.dir).sort()).toEqual([
      dirOf(repo, "a-one"),
      dirOf(repo, "b-two"),
    ]);
    expect(result.ready[0].priority).toBe("P0");
    expect(result.cycles).toEqual([]);
  });

  it("keeps a blocked task out of ready and names its blocker", () => {
    const blocker = createTask(repo, "a-one");
    createTask(repo, "b-two");

    expect(
      runTask(repo, "set-meta", dirOf(repo, "b-two"), "blocked_by", blocker)
        .status,
    ).toBe(0);
    const { result } = frontierJson(repo);
    expect(result.ready.map((e: { dir: string }) => e.dir)).toEqual([blocker]);
    expect(result.blocked).toHaveLength(1);
    expect(result.blocked[0].waiting_on).toEqual([blocker]);
  });

  it("releases the dependent once the blocker is archived", () => {
    const blocker = createTask(repo, "a-one");
    createTask(repo, "b-two");
    runTask(repo, "set-meta", dirOf(repo, "b-two"), "blocked_by", blocker);
    expect(runTask(repo, "frontier", "--json").stdout).toContain('"blocked"');

    const archived = runTask(repo, "archive", blocker, "--no-commit");
    expect(archived.status).toBe(0);

    const { result } = frontierJson(repo);
    expect(result.ready.map((e: { dir: string }) => e.dir)).toEqual([
      dirOf(repo, "b-two"),
    ]);
    expect(result.blocked).toEqual([]);
  });

  it("exits non-zero and reports the group when two tasks wait on each other", () => {
    const one = createTask(repo, "c-one");
    const two = createTask(repo, "c-two");
    runTask(repo, "set-meta", one, "blocked_by", two);
    runTask(repo, "set-meta", two, "blocked_by", one);

    const { result, status } = frontierJson(repo);
    expect(status).toBe(1);
    expect(result.cycles).toEqual([
      [one, two].sort((a, b) => a.localeCompare(b)),
    ]);

    const human = runTask(repo, "frontier");
    expect(human.status).toBe(1);
    expect(human.stdout).toContain("Dependency cycles");
  });

  it("warns on a ref matching nothing and keeps that task blocked", () => {
    createTask(repo, "d-one");
    runTask(repo, "set-meta", dirOf(repo, "d-one"), "blocked_by", "ghost-task");

    const { result, status } = frontierJson(repo);
    expect(status).toBe(0);
    expect(result.ready).toEqual([]);
    expect(result.warnings[0]).toContain("ghost-task");
  });

  it("resolves a bare slug without the date prefix", () => {
    const blocker = createTask(repo, "e-one");
    createTask(repo, "e-two");
    runTask(repo, "set-meta", dirOf(repo, "e-two"), "blocked_by", "e-one");

    const { result } = frontierJson(repo);
    expect(result.blocked[0].waiting_on).toEqual([blocker]);
  });

  it("treats a completed blocker as satisfied without archiving", () => {
    const blocker = createTask(repo, "f-one");
    createTask(repo, "f-two");
    runTask(repo, "set-meta", dirOf(repo, "f-two"), "blocked_by", blocker);

    const data = readTaskJson(repo, blocker);
    writeTaskJson(repo, blocker, { ...data, status: "completed" });

    const { result } = frontierJson(repo);
    expect(result.ready.map((e: { dir: string }) => e.dir)).toEqual([
      dirOf(repo, "f-two"),
    ]);
  });

  it("filters by domain board", () => {
    createTask(repo, "g-one", "--domain", "alpha");
    const other = createTask(repo, "g-two", "--domain", "beta");

    const { result } = frontierJson(repo, "--board", "beta");
    expect(result.ready.map((e: { dir: string }) => e.dir)).toEqual([other]);
  });
});

describe("blocked_by storage shape", () => {
  it("writes the formal field and drops any legacy meta copy", () => {
    const blocker = createTask(repo, "h-one");
    const dependent = createTask(repo, "h-two");
    const before = readTaskJson(repo, dependent);
    writeTaskJson(repo, dependent, {
      ...before,
      meta: { ...(before.meta as object), blocked_by: blocker },
    });

    const set = runTask(repo, "set-meta", dependent, "blocked_by", blocker);
    expect(set.stdout).toContain("cleared the legacy meta.blocked_by");

    const after = readTaskJson(repo, dependent);
    expect(after.blocked_by).toEqual([blocker]);
    expect((after.meta as Record<string, unknown>).blocked_by).toBeUndefined();
  });

  it("still reads a legacy meta-only blocker, and validate asks to migrate it", () => {
    const blocker = createTask(repo, "i-one");
    const dependent = createTask(repo, "i-two");
    const data = readTaskJson(repo, dependent);
    writeTaskJson(repo, dependent, {
      ...data,
      meta: { ...(data.meta as object), blocked_by: blocker },
    });

    const { result } = frontierJson(repo);
    expect(result.blocked[0].waiting_on).toEqual([blocker]);

    const validate = runTask(repo, "validate", dependent);
    expect(validate.stdout).toContain("meta.blocked_by (legacy)");
    expect(validate.stdout).toContain("set-meta");
  });

  it("lets the formal field win when both are populated", () => {
    const real = createTask(repo, "j-one");
    const stale = createTask(repo, "j-two");
    const dependent = createTask(repo, "j-three");
    runTask(repo, "set-meta", dependent, "blocked_by", real);
    const data = readTaskJson(repo, dependent);
    writeTaskJson(repo, dependent, {
      ...data,
      meta: { ...(data.meta as object), blocked_by: stale },
    });

    const { result } = frontierJson(repo);
    const entry = result.blocked.find(
      (e: { dir: string }) => e.dir === dependent,
    );
    expect(entry.waiting_on).toEqual([real]);
  });
});
