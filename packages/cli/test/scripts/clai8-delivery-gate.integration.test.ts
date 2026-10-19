/**
 * Integration tests for CLAI-8 — the `supervised-delivery` tier and the
 * protected-ref gate (`task.py delivery-gate`).
 *
 * The rule from `02-e2e-delivery-gate-model.md` (定版 10-09): pushing is
 * allowed only inside the third tier, only for refs matching
 * `delivery.auto_push_refs`, and never for a protected position. Protected-ness
 * is decided by **git facts** (origin/HEAD, `remote show origin`, local
 * `refs/tags`), not by platform wording, and an unparseable whitelist fails
 * closed instead of guessing.
 *
 * Real templates are stamped into a throwaway git repo driven through the
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

function git(repo: string, ...args: string[]): void {
  const r = spawnSync("git", args, {
    cwd: repo,
    encoding: "utf-8",
    env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t",
      GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" },
  });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
}

function runTask(repo: string, ...args: string[]) {
  return spawnSync(PYTHON as string, [".omtre/scripts/task.py", ...args], {
    cwd: repo,
    encoding: "utf-8",
    env: { ...process.env, OMTRE_WRITER: "qoder-TESTHOST-agent" },
  });
}

function gate(repo: string, ref: string) {
  const r = runTask(repo, "delivery-gate", ref, "--json");
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(r.stdout) as Record<string, unknown>;
  } catch {
    payload = { parse_error: r.stdout + r.stderr };
  }
  return { payload, status: r.status ?? 1, raw: r };
}

function writeConfig(repo: string, body: string): void {
  fs.writeFileSync(path.join(repo, ".omtre", "config.yaml"), body, "utf-8");
}

let repo = "";

beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), "delivery-gate-itest-"));
  fs.mkdirSync(path.join(repo, ".omtre"), { recursive: true });
  fs.cpSync(TEMPLATE_SCRIPTS, path.join(repo, ".omtre", "scripts"), {
    recursive: true,
  });
  git(repo, "init", "-q", "-b", "main");
  fs.writeFileSync(path.join(repo, "README.md"), "gate fixture\n");
  git(repo, "add", "--", "README.md");
  git(repo, "commit", "-qm", "seed");
});

afterEach(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe.skipIf(PYTHON === null)("task.py delivery-gate", () => {
  it("refuses every push outside the third tier", () => {
    writeConfig(repo, "autonomy: hands-off\ndelivery:\n  auto_push_refs:\n    - \"feature/*\"\n");
    const g = gate(repo, "feature/ticket");

    expect(g.status).not.toBe(0);
    expect(g.payload.allow).toBe(false);
    expect(String(g.payload.reason)).toMatch(/tier\(hands-off\)/);
    expect(g.payload.code).toBe("tier");
  });

  it("uses the same default as CLAI-6 when the key is absent", () => {
    writeConfig(repo, "delivery:\n  auto_push_refs:\n    - \"feature/*\"\n");
    const g = gate(repo, "feature/ticket");

    expect(g.status).not.toBe(0);
    expect(String(g.payload.reason)).toMatch(/tier\(hands-off\)/);
  });

  it("rejects an unrecognized tier instead of treating it as supervised", () => {
    writeConfig(repo, "autonomy: supervised\ndelivery:\n  auto_push_refs:\n    - \"feature/*\"\n");
    const g = gate(repo, "feature/ticket");
    expect(String(g.payload.tier)).toBe("hands-off");
    expect(g.payload.allow).toBe(false);
  });

  it("allows a whitelisted ref inside supervised-delivery", () => {
    writeConfig(repo, "autonomy: supervised-delivery\ndelivery:\n  auto_push_refs:\n    - \"feature/*\"\n");
    const g = gate(repo, "feature/ticket");

    expect(g.status).toBe(0);
    expect(g.payload.allow).toBe(true);
    expect(String(g.payload.reason)).toMatch(/whitelist\(feature\/\*\)/);
    expect(g.payload.code).toBe("allowed");
  });

  it("does not let `*` cross a path separator", () => {
    writeConfig(repo, "autonomy: supervised-delivery\ndelivery:\n  auto_push_refs:\n    - \"feature/*\"\n");
    const g = gate(repo, "feature/nested/ticket");
    expect(g.payload.allow).toBe(false);
    expect(String(g.payload.reason)).toMatch(/outside_auto_push_refs/);
    expect(g.payload.code).toBe("whitelist");
  });

  it("fails closed when the whitelist is empty", () => {
    writeConfig(repo, "autonomy: supervised-delivery\ndelivery:\n  auto_push_refs: []\n");
    const g = gate(repo, "feature/ticket");

    expect(g.payload.allow).toBe(false);
    expect(String(g.payload.reason)).toMatch(/empty_auto_push_refs/);
    expect(g.payload.code).toBe("deferred");
  });

  it("fails closed when the whitelist shape is not a list", () => {
    writeConfig(repo, "autonomy: supervised-delivery\ndelivery:\n  auto_push_refs: \"feature/*\"\n");
    const g = gate(repo, "feature/ticket");

    expect(g.payload.allow).toBe(false);
    expect(String(g.payload.reason)).toMatch(/malformed_auto_push_refs/);
    expect(g.payload.code).toBe("config");
  });

  it("protects the default branch resolved from git facts", () => {
    writeConfig(repo, "autonomy: supervised-delivery\ndelivery:\n  auto_push_refs:\n    - \"*\"\n");
    const facts = gate(repo, "main");

    expect(facts.payload.allow).toBe(false);
    expect(String(facts.payload.reason)).toMatch(/protected_ref\(default_branch=main/);
    expect(facts.payload.code).toBe("protected");
    const f = facts.payload.facts as Record<string, unknown>;
    expect(f.default_branch).toBe("main");
    expect(f.default_source).toBeTruthy();
  });

  it("still protects the default branch when the remote cannot name it", () => {
    // A remote whose HEAD is unresolvable (`HEAD branch: (unknown)`, offline,
    // bare repo initialised to another branch) must not leave `main` looking
    // pushable. Caught on the live fixture: the ref was refused only for
    // missing the whitelist, so a `*` whitelist would have let it through.
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), "delivery-gate-remote-"));
    git(bare, "init", "-q", "--bare", "--initial-branch=elsewhere");
    git(repo, "remote", "add", "origin", bare);
    git(repo, "push", "-q", "origin", "main:main");
    writeConfig(repo, "autonomy: supervised-delivery\ndelivery:\n  auto_push_refs:\n    - \"*\"\n");

    try {
      const g = gate(repo, "main");
      expect(g.payload.allow).toBe(false);
      expect(String(g.payload.reason)).toMatch(/protected_ref\(default_branch=main;local_head/);
    } finally {
      fs.rmSync(bare, { recursive: true, force: true });
    }
  });

  it("protects an existing tag even when a glob would match it", () => {
    git(repo, "tag", "v9.9.9");
    writeConfig(repo, "autonomy: supervised-delivery\ndelivery:\n  auto_push_refs:\n    - \"v9*\"\n");
    const g = gate(repo, "v9.9.9");

    expect(g.payload.allow).toBe(false);
    expect(String(g.payload.reason)).toMatch(/protected_ref\(tag\)/);
    expect(g.payload.code).toBe("protected");
  });

  it("honours an explicit protected_refs list on top of the facts", () => {
    writeConfig(
      repo,
      [
        "autonomy: supervised-delivery",
        "delivery:",
        "  auto_push_refs:",
        "    - \"release*\"",
        "  protected_refs:",
        "    - \"release/*\"",
      ].join("\n"),
    );
    const blocked = gate(repo, "release/2026-10");
    const other = gate(repo, "release-notes");

    expect(blocked.payload.allow).toBe(false);
    expect(String(blocked.payload.reason)).toMatch(/protected_ref\(configured:release\/\*\)/);
    expect(other.payload.allow).toBe(true);
  });

  it("reports the facts it decided on, in machine-readable form", () => {
    writeConfig(repo, "autonomy: supervised-delivery\ndelivery:\n  auto_push_refs:\n    - \"feature/*\"\n");
    const f = gate(repo, "feature/ticket").payload.facts as Record<string, unknown>;

    expect(f.auto_push_refs).toEqual(["feature/*"]);
    expect(f.remote).toBe(false);
    expect(Array.isArray(f.protected_refs)).toBe(true);
    expect(typeof f.is_tag).toBe("boolean");
  });

  it("refuses a bare ref argument with a usage line, not a stack trace", () => {
    const r = runTask(repo, "delivery-gate");
    expect(r.status).not.toBe(0);
    expect(r.stdout + r.stderr).not.toMatch(/Traceback/);
  });
});
