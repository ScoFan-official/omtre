/**
 * Integration tests for `task.py list` tree rendering (#402).
 *
 * The python script lives under
 * `task.py` (+ `common/task_store.py` for
 * `set-meta`); this test stamps the real templates into a fresh git repo
 * and exercises the actual `python3 task.py list` / `list --json` /
 * `create --meta` / `set-meta` paths.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getOmtreTemplatePath } from "../../src/templates/extract.js";

const TEMPLATE_SCRIPTS = path.join(getOmtreTemplatePath(), "scripts");

function hasPython(): boolean {
  try {
    execFileSync("python3", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function setupRepo(tmp: string): void {
  fs.mkdirSync(tmp, { recursive: true });
  const scriptsDest = path.join(tmp, ".omtre", "scripts");
  fs.mkdirSync(scriptsDest, { recursive: true });
  fs.cpSync(TEMPLATE_SCRIPTS, scriptsDest, { recursive: true });
}

function makeTask(
  repo: string,
  name: string,
  overrides: Record<string, unknown> = {},
): void {
  const dir = path.join(repo, ".omtre", "tasks", name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "prd.md"), `${name} prd\n`);
  const taskJson: Record<string, unknown> = {
    id: name,
    name,
    title: name,
    status: "planning",
    priority: "P2",
    createdAt: "2026-07-22",
    assignee: "tester",
    creator: "tester",
    subtasks: [],
    children: [],
    parent: null,
    relatedFiles: [],
    meta: {},
    ...overrides,
  };
  fs.writeFileSync(
    path.join(dir, "task.json"),
    JSON.stringify(taskJson) + "\n",
  );
}

function runTask(repo: string, ...args: string[]) {
  return spawnSync("python3", [".omtre/scripts/task.py", ...args], {
    cwd: repo,
    encoding: "utf-8",
  });
}

describe.skipIf(!hasPython())("task.py list tree view (#402)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "omtre-task-list-test-"));
    setupRepo(tmp);
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("indents children under their parent", () => {
    makeTask(tmp, "07-01-parent-task", {
      status: "in_progress",
      children: ["07-02-child-a", "07-03-child-b"],
    });
    makeTask(tmp, "07-02-child-a", {
      status: "planning",
      parent: "07-01-parent-task",
    });
    makeTask(tmp, "07-03-child-b", {
      status: "completed",
      parent: "07-01-parent-task",
    });

    const r = runTask(tmp, "list");
    expect(r.status).toBe(0);
    const lines = r.stdout.split("\n").map((l) => l.trimEnd());
    const parentIdx = lines.findIndex((l) => l.includes("07-01-parent-task/"));
    const childAIdx = lines.findIndex((l) => l.includes("07-02-child-a/"));
    const childBIdx = lines.findIndex((l) => l.includes("07-03-child-b/"));
    expect(parentIdx).toBeGreaterThanOrEqual(0);
    expect(childAIdx).toBeGreaterThan(parentIdx);
    expect(childBIdx).toBeGreaterThan(parentIdx);
    // Children are indented further than the parent.
    const parentIndent = lines[parentIdx].match(/^\s*/)?.[0].length ?? 0;
    const childIndent = lines[childAIdx].match(/^\s*/)?.[0].length ?? 0;
    expect(childIndent).toBeGreaterThan(parentIndent);
  });

  it("renders a flat task with no parent/children unchanged", () => {
    makeTask(tmp, "07-05-flat-task", { status: "planning" });

    const r = runTask(tmp, "list");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("07-05-flat-task/");
  });

  it("renders a dangling parent ref flat without erroring (orphan safety)", () => {
    makeTask(tmp, "07-06-orphan", {
      status: "planning",
      parent: "does-not-exist",
    });

    const r = runTask(tmp, "list");
    expect(r.status).toBe(0);
    expect(r.stderr).toBe("");
    expect(r.stdout).toContain("07-06-orphan/");
  });

  it("--json includes parent and children fields", () => {
    makeTask(tmp, "07-01-parent-task", {
      status: "in_progress",
      children: ["07-02-child-a"],
    });
    makeTask(tmp, "07-02-child-a", {
      status: "planning",
      parent: "07-01-parent-task",
    });

    const r = runTask(tmp, "list", "--json");
    expect(r.status).toBe(0);
    const data = JSON.parse(r.stdout) as {
      tasks: { dir: string; parent: string | null; children: string[] }[];
    };
    const parent = data.tasks.find((t) => t.dir.endsWith("07-01-parent-task"));
    const child = data.tasks.find((t) => t.dir.endsWith("07-02-child-a"));
    expect(parent?.children).toEqual(["07-02-child-a"]);
    expect(child?.parent).toBe("07-01-parent-task");
  });
});
