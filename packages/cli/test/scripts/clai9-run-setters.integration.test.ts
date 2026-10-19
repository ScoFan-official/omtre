/**
 * Integration tests for the CLAI-9 run setters — the two formal task.json
 * fields the D5 loop runner writes:
 *
 *   `worktree_path` and `pr_url` have always been declared by the schema and
 *   seeded null, but nothing wrote them, so a ticket's worktree and its review
 *   pointer were undiscoverable outside the session that made them.
 *   `set-worktree` takes a directory that exists (`-` clears it once the
 *   worktree is removed); `set-pr` takes an http(s) URL.
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

function runTask(repo: string, ...args: string[]) {
  return spawnSync(PYTHON as string, [".omtre/scripts/task.py", ...args], {
    cwd: repo,
    encoding: "utf-8",
    env: { ...process.env, OMTRE_WRITER: "qoder-TESTHOST-agent" },
  });
}

function createTask(repo: string, slug: string): string {
  const r = runTask(
    repo,
    "create",
    `Task ${slug}`,
    "--slug",
    slug,
    "--no-start",
    "-d",
    `fixture ${slug}`,
  );
  if (r.status !== 0) {
    throw new Error(`create ${slug} failed: ${r.stdout}${r.stderr}`);
  }
  const dir = fs
    .readdirSync(path.join(repo, ".omtre", "tasks"))
    .find((d) => d.includes(slug));
  if (!dir) throw new Error(`no task dir matching ${slug}`);
  return dir;
}

function readField(
  repo: string,
  dirName: string,
  field: string,
): unknown {
  const data = JSON.parse(
    fs.readFileSync(
      path.join(repo, ".omtre", "tasks", dirName, "task.json"),
      "utf-8",
    ),
  ) as Record<string, unknown>;
  return data[field];
}

function taskJsonPath(repo: string, dirName: string): string {
  return path.join(repo, ".omtre", "tasks", dirName, "task.json");
}

let repo = "";
let worktree = "";

beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), "set-worktree-itest-"));
  fs.mkdirSync(path.join(repo, ".omtre"), { recursive: true });
  fs.cpSync(TEMPLATE_SCRIPTS, path.join(repo, ".omtre", "scripts"), {
    recursive: true,
  });
  const init = spawnSync(PYTHON as string, [".omtre/scripts/init_developer.py", "tester"], {
    cwd: repo,
    encoding: "utf-8",
    env: { ...process.env, OMTRE_WRITER: "qoder-TESTHOST-agent" },
  });
  if (init.status !== 0) {
    throw new Error(`init_developer failed: ${init.stderr}`);
  }
  // The runner creates the worktree before recording it, so fixtures point at
  // a directory that actually exists.
  worktree = path.join(repo, ".omtre", ".runtime", "worktrees", "demo");
  fs.mkdirSync(worktree, { recursive: true });
});

afterEach(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe.skipIf(PYTHON === null)("task.py set-worktree", () => {
  it("records an existing directory in worktree_path", () => {
    const dir = createTask(repo, "a-one");
    const r = runTask(repo, "set-worktree", dir, worktree);
    expect(r.status).toBe(0);
    expect(readField(repo, dir, "worktree_path")).toBe(worktree);
  });

  it("overwrites an earlier pointer (re-claim after a failed run)", () => {
    const dir = createTask(repo, "a-one");
    const other = path.join(repo, ".omtre", ".runtime", "worktrees", "demo2");
    fs.mkdirSync(other, { recursive: true });

    expect(runTask(repo, "set-worktree", dir, worktree).status).toBe(0);
    expect(runTask(repo, "set-worktree", dir, other).status).toBe(0);
    expect(readField(repo, dir, "worktree_path")).toBe(other);
  });

  it("`-` clears the pointer back to null", () => {
    const dir = createTask(repo, "a-one");
    expect(runTask(repo, "set-worktree", dir, worktree).status).toBe(0);

    const r = runTask(repo, "set-worktree", dir, "-");
    expect(r.status).toBe(0);
    expect(readField(repo, dir, "worktree_path")).toBeNull();
  });

  it("refuses a path that is not an existing directory", () => {
    const dir = createTask(repo, "a-one");
    const ghost = path.join(repo, ".omtre", ".runtime", "worktrees", "ghost");
    const r = runTask(repo, "set-worktree", dir, ghost);

    expect(r.status).not.toBe(0);
    expect(r.stdout + r.stderr).toMatch(/not a directory/);
    expect(readField(repo, dir, "worktree_path")).toBeNull();
  });

  it("reports a task dir that does not exist without creating one", () => {
    const r = runTask(repo, "set-worktree", "01-01-nope", worktree);
    expect(r.status).not.toBe(0);
    expect(fs.existsSync(path.join(repo, ".omtre", "tasks", "01-01-nope"))).toBe(
      false,
    );
  });

  it("leaves a malformed task.json untouched and exits non-zero", () => {
    const dir = createTask(repo, "a-one");
    fs.writeFileSync(taskJsonPath(repo, dir), "{ not json", "utf-8");

    const r = runTask(repo, "set-worktree", dir, worktree);
    expect(r.status).not.toBe(0);
    expect(fs.readFileSync(taskJsonPath(repo, dir), "utf-8")).toBe("{ not json");
  });

  it("accepts a bare task name, not only a directory", () => {
    const dir = createTask(repo, "a-one");
    const r = runTask(repo, "set-worktree", "a-one", worktree);
    expect(r.status).toBe(0);
    expect(readField(repo, dir, "worktree_path")).toBe(worktree);
  });
});

describe.skipIf(PYTHON === null)("task.py set-pr", () => {
  const PR_URL = "https://github.com/acme/repo/pull/42";

  it("records an https URL in the formal pr_url field", () => {
    const dir = createTask(repo, "b-two");
    const r = runTask(repo, "set-pr", dir, PR_URL);
    expect(r.status).toBe(0);
    expect(readField(repo, dir, "pr_url")).toBe(PR_URL);
  });

  it("accepts http too", () => {
    const dir = createTask(repo, "b-two");
    expect(
      runTask(repo, "set-pr", dir, "http://gitea.local/acme/repo/pulls/7").status,
    ).toBe(0);
    expect(readField(repo, dir, "pr_url")).toBe("http://gitea.local/acme/repo/pulls/7");
  });

  it("refuses a value that is not a URL and leaves the field null", () => {
    const dir = createTask(repo, "b-two");
    const r = runTask(repo, "set-pr", dir, "see slack for the link");
    expect(r.status).not.toBe(0);
    expect(r.stdout + r.stderr).toMatch(/not a url/i);
    expect(readField(repo, dir, "pr_url")).toBeNull();
  });

  it("leaves a malformed task.json untouched and exits non-zero", () => {
    const dir = createTask(repo, "b-two");
    fs.writeFileSync(taskJsonPath(repo, dir), "{ not json", "utf-8");

    const r = runTask(repo, "set-pr", dir, PR_URL);
    expect(r.status).not.toBe(0);
    expect(fs.readFileSync(taskJsonPath(repo, dir), "utf-8")).toBe("{ not json");
  });

  it("does not disturb the worktree pointer it is not writing", () => {
    const dir = createTask(repo, "b-two");
    expect(runTask(repo, "set-worktree", dir, worktree).status).toBe(0);
    expect(runTask(repo, "set-pr", dir, PR_URL).status).toBe(0);

    expect(readField(repo, dir, "worktree_path")).toBe(worktree);
    expect(readField(repo, dir, "pr_url")).toBe(PR_URL);
  });
});
