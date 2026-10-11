/**
 * Integration tests for CLAI-10 — `task.py check-commit`, the mechanical face
 * of the commit discipline `workflow.md` states in prose (Phase 3.4:
 * "files you did not edit this session NEVER enter a commit"; board bookkeeping
 * lands in its own close-out commit).
 *
 * Why it lives in Python: `trellis run` asks the same question before staging
 * and again against what the branch actually carries. Keeping a second rule
 * list in TypeScript is the drift this removes — one authority, same answer for
 * a human, an agent and the runner. Real templates are stamped into a throwaway
 * repo and driven through the actual CLI — no internal mocks.
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

let repo = "";

function check(paths: string[], opts: { stdin?: boolean } = {}) {
  const args = [".trellis/scripts/task.py", "check-commit", "--json"];
  if (opts.stdin) args.push("--from-stdin");
  else args.push(...paths);
  const r = spawnSync(PYTHON as string, args, {
    cwd: repo,
    encoding: "utf-8",
    input: opts.stdin ? `${paths.join("\n")}\n` : undefined,
    env: { ...process.env, TRELLIS_WRITER: "qoder-TESTHOST-agent" },
  });
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(r.stdout) as Record<string, unknown>;
  } catch {
    payload = { parse_error: `${r.stdout}${r.stderr}` };
  }
  return { payload, status: r.status ?? 1, raw: r };
}

beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), "check-commit-itest-"));
  fs.mkdirSync(path.join(repo, ".trellis"), { recursive: true });
  fs.cpSync(TEMPLATE_SCRIPTS, path.join(repo, ".trellis", "scripts"), {
    recursive: true,
  });
});

afterEach(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe.skipIf(PYTHON === null)("task.py check-commit", () => {
  it("refuses board files and credential-shaped paths", () => {
    const r = check([
      ".trellis/domains/deap/README.md",
      ".env.local",
      "keys/deploy.pem",
      "config/secrets.yaml",
      "src/app.ts",
    ]);

    expect(r.status).toBe(1);
    expect(r.payload.ok).toBe(false);
    expect(r.payload.offending as string[]).toEqual([
      ".trellis/domains/deap/README.md",
      ".env.local",
      "keys/deploy.pem",
      "config/secrets.yaml",
    ]);
    expect(r.payload.checked).toBe(5);
  });

  it("matches secret shapes, not the word secret", () => {
    // This list also gates delivery, so a false positive would halt a whole
    // line: `use-secret-store.ts` is application code and must pass.
    const r = check([
      "src/use-secret-store.ts",
      ".trellis/tasks/10-09-x/prd.md",
      "a/greeting.ts",
    ]);

    expect(r.status).toBe(0);
    expect(r.payload.ok).toBe(true);
    expect(r.payload.offending).toEqual([]);
  });

  it("normalises backslash paths so Windows callers get the same answer", () => {
    const r = check([
      ".trellis\\domains\\deap\\worklog\\me.md",
      "SECRETS.YAML",
    ]);

    expect(r.status).toBe(1);
    expect(r.payload.offending as string[]).toEqual([
      ".trellis\\domains\\deap\\worklog\\me.md",
      "SECRETS.YAML",
    ]);
  });

  it("reads paths over stdin, the shape the runner uses for a wide diff", () => {
    const viaStdin = check(["src/a.ts", ".env"], { stdin: true });
    expect(viaStdin.status).toBe(1);
    expect(viaStdin.payload.offending).toEqual([".env"]);

    // Mixed: positional args plus a stdin tail both count.
    const mixed = spawnSync(
      PYTHON as string,
      [
        ".trellis/scripts/task.py",
        "check-commit",
        "--from-stdin",
        "--json",
        ".env",
      ],
      {
        cwd: repo,
        encoding: "utf-8",
        input: "src/app.ts\nkeys/id_rsa\n",
        env: { ...process.env, TRELLIS_WRITER: "qoder-TESTHOST-agent" },
      },
    );
    const payload = JSON.parse(mixed.stdout) as Record<string, unknown>;
    expect(payload.offending).toEqual([".env", "keys/id_rsa"]);
  });

  it("refuses to answer nothing, without a stack trace", () => {
    const r = spawnSync(
      PYTHON as string,
      [".trellis/scripts/task.py", "check-commit", "--json"],
      {
        cwd: repo,
        encoding: "utf-8",
        env: { ...process.env, TRELLIS_WRITER: "qoder-TESTHOST-agent" },
      },
    );

    expect(r.status).toBe(1);
    expect(r.stderr).toContain("nothing to check");
    expect(r.stderr + r.stdout).not.toContain("Traceback");
  });

  it("says the rule in words for a human asking by hand", () => {
    const r = spawnSync(
      PYTHON as string,
      [
        ".trellis/scripts/task.py",
        "check-commit",
        ".trellis/domains/deap/README.md",
      ],
      { cwd: repo, encoding: "utf-8", env: { ...process.env } },
    );

    expect(r.status).toBe(1);
    expect(r.stdout).toContain("must not enter this commit");
    expect(r.stdout).toContain("human close-out commit");
  });
});
