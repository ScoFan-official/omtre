/**
 * Integration tests for a non-list `children` field in a parent task.json.
 *
 * `common/task_store.py` reads it with `.get("children", [])`, which returns
 * the default only when the key is *absent*. A parent carrying
 * `"children": null` — older format, or hand-edited — yielded None, and the
 * `not in` test below it raised `TypeError`.
 *
 * The severity was in the ordering: in `create` that raise lands *after* the
 * new task.json is written, leaving a task on disk that its parent does not
 * reference. All three link sites (`create --parent`, `add-subtask`,
 * `remove-subtask`) read the field the same way and are covered here.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
  fs.mkdirSync(path.join(tmp, ".omtre", "scripts"), { recursive: true });
  fs.cpSync(TEMPLATE_SCRIPTS, path.join(tmp, ".omtre", "scripts"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(tmp, ".omtre", "config.yaml"),
    "session_auto_commit: false\n",
  );
  // `task.py create` refuses to run without a developer identity. Write the
  // `.developer` file rather than exporting an env var, so this fixture does
  // not depend on which identity sources the runtime happens to support.
  fs.writeFileSync(path.join(tmp, ".omtre", ".developer"), "name=tester\n");
}

function makeTask(
  repo: string,
  name: string,
  overrides: Record<string, unknown> = {},
): string {
  const dir = path.join(repo, ".omtre", "tasks", name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "prd.md"), `${name} prd\n`);
  fs.writeFileSync(
    path.join(dir, "task.json"),
    JSON.stringify({
      id: name,
      name,
      title: name,
      status: "planning",
      priority: "P2",
      createdAt: "2026-08-19",
      assignee: "tester",
      creator: "tester",
      subtasks: [],
      children: [],
      parent: null,
      relatedFiles: [],
      meta: {},
      ...overrides,
    }) + "\n",
  );
  return dir;
}

function runTask(repo: string, ...args: string[]) {
  return spawnSync("python3", [".omtre/scripts/task.py", ...args], {
    cwd: repo,
    encoding: "utf-8",
    env: { ...process.env, OMTRE_DEVELOPER: "tester" },
  });
}

function readChildren(repo: string, name: string): unknown {
  return JSON.parse(
    fs.readFileSync(
      path.join(repo, ".omtre", "tasks", name, "task.json"),
      "utf-8",
    ),
  ).children;
}

function setChildren(repo: string, name: string, value: unknown): void {
  const file = path.join(repo, ".omtre", "tasks", name, "task.json");
  const data = JSON.parse(fs.readFileSync(file, "utf-8"));
  data.children = value;
  fs.writeFileSync(file, JSON.stringify(data) + "\n");
}

const PARENT = "08-19-parent";

describe.skipIf(!hasPython())("non-list `children` in a parent task.json", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "omtre-children-test-"));
    setupRepo(tmp);
    makeTask(tmp, PARENT, { children: null });
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("`create --parent` links, rather than writing a task the parent never references", () => {
    const r = runTask(
      tmp,
      "create",
      "Child",
      "--description",
      "d",
      "--slug",
      "kid",
      "--parent",
      `.omtre/tasks/${PARENT}`,
      "--no-start",
    );
    expect(r.stderr).not.toContain("TypeError");
    expect(r.status).toBe(0);

    const created = fs
      .readdirSync(path.join(tmp, ".omtre", "tasks"))
      .filter((d) => d.endsWith("-kid"));
    expect(created).toHaveLength(1);

    // The whole point: the task on disk and the parent's list agree.
    expect(readChildren(tmp, PARENT)).toEqual(created);
    expect(
      JSON.parse(
        fs.readFileSync(
          path.join(tmp, ".omtre", "tasks", created[0], "task.json"),
          "utf-8",
        ),
      ).parent,
    ).toBe(PARENT);
  });

  it.each([
    ["null", null],
    ["a string", "08-19-not-a-list"],
    ["a number", 42],
    ["an object", { "08-19-kid": true }],
  ])("`add-subtask` normalizes %s instead of crashing", (_label, value) => {
    const child = "08-19-standalone";
    makeTask(tmp, child);
    setChildren(tmp, PARENT, value);

    const r = runTask(
      tmp,
      "add-subtask",
      `.omtre/tasks/${PARENT}`,
      `.omtre/tasks/${child}`,
    );
    expect(r.stderr).not.toContain("TypeError");
    expect(r.status).toBe(0);
    expect(readChildren(tmp, PARENT)).toEqual([child]);
  });

  it("`remove-subtask` leaves a valid empty list when the field was null", () => {
    const child = "08-19-standalone";
    makeTask(tmp, child, { parent: PARENT });
    setChildren(tmp, PARENT, null);

    const r = runTask(
      tmp,
      "remove-subtask",
      `.omtre/tasks/${PARENT}`,
      `.omtre/tasks/${child}`,
    );
    expect(r.stderr).not.toContain("TypeError");
    expect(r.status).toBe(0);
    expect(readChildren(tmp, PARENT)).toEqual([]);
  });
});
