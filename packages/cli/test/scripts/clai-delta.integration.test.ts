/**
 * Integration tests for the CLAI fork delta (common/clai_delta.py):
 *
 *   CLAI-1  task.py create/start --domain <slug> sugar → meta.domain write
 *   CLAI-2  task.py start flag gate — fresh foreign flag on meta.domain
 *           board refuses; stale (>24h) or own flag proceeds
 *   CLAI-3  task.py validate — domains/ dir ↔ REGISTRY.md reconciliation
 *   CLAI-4  task.py finish/archive — own flag still planted warns 旗未拔
 *           (non-blocking, flag line never auto-deleted)
 *   CLAI-5/6 get_context.py — 当前战线 section + 当前模式 line
 *           (config.yaml autonomy, default hands-off)
 *
 * The tests stamp the real templates into a fresh .omtre/ tree and
 * exercise the actual CLI paths — no internal mocks.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getOmtreTemplatePath } from "../../src/templates/extract.js";

const TEMPLATE_SCRIPTS = path.join(getOmtreTemplatePath(), "scripts");
const TEMPLATE_DOMAINS = path.join(getOmtreTemplatePath(), "domains");

const DEVELOPER = "tester";
// Deterministic writer identity for the flag protocol — mirrors the
// `devin-<hostname>` convention used by real boards.
const WRITER = "devin-TESTHOST";
const FOREIGN_WRITER = "devin-FOREIGN-HOST";

function findPython(): string | null {
  // `python3` is the CI/precedent binary; `python` covers Windows dev hosts.
  for (const bin of ["python3", "python"]) {
    try {
      execFileSync(bin, ["--version"], { stdio: "ignore" });
      return bin;
    } catch {
      // try next candidate
    }
  }
  return null;
}

const PYTHON = findPython();

function testEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    OMTRE_WRITER: WRITER,
    OMTRE_CONTEXT_ID: "clai-delta-itest",
  };
}

function setupRepo(tmp: string): void {
  fs.mkdirSync(tmp, { recursive: true });
  const scriptsDest = path.join(tmp, ".omtre", "scripts");
  fs.mkdirSync(scriptsDest, { recursive: true });
  fs.cpSync(TEMPLATE_SCRIPTS, scriptsDest, { recursive: true });

  const r = spawnSync(
    PYTHON as string,
    [".omtre/scripts/init_developer.py", DEVELOPER],
    { cwd: tmp, encoding: "utf-8", env: testEnv() },
  );
  if (r.status !== 0) {
    throw new Error(`init_developer failed: ${r.stderr}`);
  }
}

/** Stamp the shipped domains/ seed (REGISTRY + DISCIPLINE + _scaffold). */
function seedDomains(repo: string): void {
  fs.cpSync(TEMPLATE_DOMAINS, path.join(repo, ".omtre", "domains"), {
    recursive: true,
  });
}

/**
 * Create a board dir by copying _scaffold, optionally planting a flag as
 * README line 1 and optionally registering the slug in REGISTRY.md.
 */
function makeBoard(
  repo: string,
  slug: string,
  opts: { flag?: string; register?: boolean } = {},
): void {
  const domainsDir = path.join(repo, ".omtre", "domains");
  const scaffold = path.join(domainsDir, "_scaffold");
  const board = path.join(domainsDir, slug);
  fs.cpSync(scaffold, board, { recursive: true });

  if (opts.flag !== undefined) {
    const readme = path.join(board, "README.md");
    const body = fs.readFileSync(readme, "utf-8");
    fs.writeFileSync(readme, `${opts.flag}\n${body}`, "utf-8");
  }

  if (opts.register !== false) {
    const registry = path.join(domainsDir, "REGISTRY.md");
    fs.appendFileSync(registry, `${slug}/ — test board ${slug}\n`, "utf-8");
  }
}

function flagLine(writer: string, context: string, since: string): string {
  return `旗: ${writer} · ${context} · 自 ${since}`;
}

function freshTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

const STALE_TIMESTAMP = "2000-01-01 00:00";

function runTask(repo: string, ...args: string[]) {
  return spawnSync(PYTHON as string, [".omtre/scripts/task.py", ...args], {
    cwd: repo,
    encoding: "utf-8",
    env: testEnv(),
  });
}

function runContext(repo: string, ...args: string[]) {
  return spawnSync(
    PYTHON as string,
    [".omtre/scripts/get_context.py", ...args],
    {
      cwd: repo,
      encoding: "utf-8",
      env: testEnv(),
    },
  );
}

function readTaskJson(repo: string, dirName: string): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(
      path.join(repo, ".omtre", "tasks", dirName, "task.json"),
      "utf-8",
    ),
  );
}

function findTaskDir(repo: string, needle: string): string {
  const dir = fs
    .readdirSync(path.join(repo, ".omtre", "tasks"))
    .find((d) => d.includes(needle));
  if (!dir) {
    throw new Error(`no task dir matching ${needle}`);
  }
  return dir;
}

function createTask(repo: string, slug: string, ...extra: string[]): string {
  const r = runTask(
    repo,
    "create",
    `task ${slug}`,
    "--description",
    "clai delta fixture",
    "--slug",
    slug,
    "--no-start",
    ...extra,
  );
  if (r.status !== 0) {
    throw new Error(`create ${slug} failed: ${r.stdout}\n${r.stderr}`);
  }
  return findTaskDir(repo, slug);
}

/** Rewrite prd.md with a single `Domain:` line atop the fixture body. */
function writePrdDomain(repo: string, dirName: string, line: string): void {
  fs.writeFileSync(
    path.join(repo, ".omtre", "tasks", dirName, "prd.md"),
    `# ${dirName}\n\n${line}\n\n## Goal\n\nfixture\n`,
    "utf-8",
  );
}

describe.skipIf(PYTHON === null)("clai-delta (domains layer CLI)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "omtre-clai-delta-test-"));
    setupRepo(tmp);
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  // ── CLAI-1: --domain sugar → meta.domain ─────────────────────────────

  it("create --domain writes meta.domain to task.json", () => {
    const r = runTask(
      tmp,
      "create",
      "domain sugar task",
      "--description",
      "regression fixture",
      "--slug",
      "domain-sugar",
      "--no-start",
      "--domain",
      "deap",
    );
    expect(r.status).toBe(0);

    const dir = findTaskDir(tmp, "domain-sugar");
    const data = readTaskJson(tmp, dir);
    expect(data.meta).toMatchObject({ domain: "deap" });
  });

  it("start --domain writes meta.domain before starting", () => {
    const dir = createTask(tmp, "start-domain-task");

    const r = runTask(tmp, "start", dir, "--domain", "deap");
    expect(r.status).toBe(0);

    const data = readTaskJson(tmp, dir);
    expect(data.meta).toMatchObject({ domain: "deap" });
  });

  // ── CLAI-2: start flag gate ──────────────────────────────────────────

  it("start refuses a fresh foreign construction flag", () => {
    seedDomains(tmp);
    makeBoard(tmp, "deap", {
      flag: flagLine(FOREIGN_WRITER, "other-task", freshTimestamp()),
    });
    const dir = createTask(tmp, "flagged-task", "--domain", "deap");

    const r = runTask(tmp, "start", dir);

    expect(r.status).not.toBe(0);
    // The refusal must name the flag + writer so the conflict is identifiable.
    expect(r.stderr + r.stdout).toContain(FOREIGN_WRITER);
    expect(r.stderr + r.stdout).toContain("旗");
  });

  it("start proceeds past a stale (>24h) foreign flag", () => {
    seedDomains(tmp);
    makeBoard(tmp, "deap", {
      flag: flagLine(FOREIGN_WRITER, "old-task", STALE_TIMESTAMP),
    });
    const dir = createTask(tmp, "stale-flag-task", "--domain", "deap");
    writePrdDomain(tmp, dir, "Domain: .omtre/domains/deap/");

    const r = runTask(tmp, "start", dir);
    expect(r.status).toBe(0);
  });

  it("start proceeds past our own flag", () => {
    seedDomains(tmp);
    makeBoard(tmp, "deap", {
      flag: flagLine(WRITER, "self-task", freshTimestamp()),
    });
    const dir = createTask(tmp, "own-flag-task", "--domain", "deap");
    writePrdDomain(tmp, dir, "Domain: .omtre/domains/deap/");

    const r = runTask(tmp, "start", dir);
    expect(r.status).toBe(0);
  });

  it("start proceeds when the board carries no flag", () => {
    seedDomains(tmp);
    makeBoard(tmp, "deap");
    const dir = createTask(tmp, "no-flag-task", "--domain", "deap");
    writePrdDomain(tmp, dir, "Domain: .omtre/domains/deap/");

    const r = runTask(tmp, "start", dir);
    expect(r.status).toBe(0);
  });

  // ── CLAI-3: validate dir ↔ REGISTRY reconciliation ───────────────────

  it("validate fails when a board dir has no REGISTRY line", () => {
    seedDomains(tmp);
    makeBoard(tmp, "unregistered", { register: false });
    const dir = createTask(tmp, "validate-unregistered");

    const r = runTask(tmp, "validate", dir);

    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).toContain("unregistered");
  });

  it("validate fails when a REGISTRY line has no board dir", () => {
    seedDomains(tmp);
    fs.appendFileSync(
      path.join(tmp, ".omtre", "domains", "REGISTRY.md"),
      "ghost/ — board without a directory\n",
      "utf-8",
    );
    const dir = createTask(tmp, "validate-ghost");

    const r = runTask(tmp, "validate", dir);

    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).toContain("ghost");
  });

  it("validate passes when dirs and REGISTRY reconcile", () => {
    seedDomains(tmp);
    makeBoard(tmp, "deap");
    const dir = createTask(tmp, "validate-ok");

    const r = runTask(tmp, "validate", dir);
    expect(r.status).toBe(0);
  });

  it("validate fails on worklog heading-anchor vs 状态 mismatch", () => {
    seedDomains(tmp);
    makeBoard(tmp, "deap");
    fs.writeFileSync(
      path.join(tmp, ".omtre", "domains", "deap", "worklog", "w.md"),
      "# w\n\n## [t-1]-devin-TESTHOST-20261007-1915 [~]\n\n- **状态**：[x] 收工\n",
      "utf-8",
    );
    const dir = createTask(tmp, "wl-anchor-bad");

    const r = runTask(tmp, "validate", dir);
    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).toContain("heading");
  });

  it("validate passes when worklog anchors agree (or are absent)", () => {
    seedDomains(tmp);
    makeBoard(tmp, "deap");
    fs.writeFileSync(
      path.join(tmp, ".omtre", "domains", "deap", "worklog", "w.md"),
      "# w\n\n## [t-1]-devin-TESTHOST-20261007-1915 [x]\n\n- **状态**：[x] 收工\n\n## [t-2]-devin-TESTHOST-20261007-2000\n\n- **状态**：✅\n",
      "utf-8",
    );
    const dir = createTask(tmp, "wl-anchor-ok");

    const r = runTask(tmp, "validate", dir);
    expect(r.status).toBe(0);
  });

  // ── CLAI-4: finish/archive warn 旗未拔 (non-blocking, never deletes) ──

  it("finish warns when our own flag is still planted", () => {
    seedDomains(tmp);
    const flag = flagLine(WRITER, "self-task", freshTimestamp());
    makeBoard(tmp, "deap", { flag });
    const dir = createTask(tmp, "finish-flag-task", "--domain", "deap");
    writePrdDomain(tmp, dir, "Domain: .omtre/domains/deap/");
    expect(runTask(tmp, "start", dir).status).toBe(0);

    const r = runTask(tmp, "finish");

    expect(r.status).toBe(0);
    expect(r.stderr + r.stdout).toContain("旗未拔");
    // The flag line is never auto-deleted — removal is the human's job.
    const readme = fs.readFileSync(
      path.join(tmp, ".omtre", "domains", "deap", "README.md"),
      "utf-8",
    );
    expect(readme.startsWith(flag)).toBe(true);
  });

  it("archive warns when our own flag is still planted", () => {
    seedDomains(tmp);
    const flag = flagLine(WRITER, "self-task", freshTimestamp());
    makeBoard(tmp, "deap", { flag });
    const dir = createTask(tmp, "archive-flag-task", "--domain", "deap");

    const r = runTask(tmp, "archive", dir, "--no-commit");

    expect(r.status).toBe(0);
    expect(r.stderr + r.stdout).toContain("旗未拔");
    const readme = fs.readFileSync(
      path.join(tmp, ".omtre", "domains", "deap", "README.md"),
      "utf-8",
    );
    expect(readme.startsWith(flag)).toBe(true);
  });

  // ── CLAI-5/6: get_context 当前战线 section + 当前模式 line ───────────

  it("get_context prints the battle-line section and mode line", () => {
    seedDomains(tmp);
    makeBoard(tmp, "deap", {
      flag: flagLine(FOREIGN_WRITER, "ctx-task", freshTimestamp()),
    });
    // Give the board a progress table with two data rows.
    const readme = path.join(tmp, ".omtre", "domains", "deap", "README.md");
    fs.appendFileSync(
      readme,
      "\n## 进度\n\n| 条目 | 状态 | 备注 |\n|---|---|---|\n" +
        "| NN-01 foo | [~] | 施工中 |\n| NN-02 bar | [x] | done |\n",
      "utf-8",
    );

    const r = runContext(tmp);

    expect(r.status).toBe(0);
    expect(r.stdout).toContain("当前战线");
    expect(r.stdout).toContain("deap");
    // Flag status shows the foreign writer; progress count is rendered.
    expect(r.stdout).toContain(FOREIGN_WRITER);
    expect(r.stdout).toMatch(/进度:\s*2\s*项/);
    // No config.yaml in this fixture → default autonomy mode.
    expect(r.stdout).toContain("当前模式");
    expect(r.stdout).toContain("hands-off");
  });

  it("get_context mode line reflects config.yaml autonomy", () => {
    fs.writeFileSync(
      path.join(tmp, ".omtre", "config.yaml"),
      "autonomy: gated\n",
      "utf-8",
    );

    const r = runContext(tmp);

    expect(r.status).toBe(0);
    expect(r.stdout).toContain("当前模式");
    expect(r.stdout).toContain("gated");
    expect(r.stdout).not.toMatch(/当前模式[^\n]*hands-off/);
  });

  // ── D2: get_context 下一票 (NEXT UP) section ─────────────────────────

  it("get_context prints the frontier head as 下一票 when a ticket is ready", () => {
    seedDomains(tmp);
    makeBoard(tmp, "deap");
    const dir = createTask(tmp, "next-head", "--domain", "deap");

    const r = runContext(tmp);

    expect(r.status).toBe(0);
    expect(r.stdout).toContain("下一票");
    expect(r.stdout).toContain(`${dir}/ (planning)`);
    // The counts line pins the frontier view the head was picked from.
    expect(r.stdout).toMatch(/ready\s*1\s*·\s*blocked\s*0/);
  });

  it("get_context 下一票 names the blocked state when nothing is ready", () => {
    seedDomains(tmp);
    makeBoard(tmp, "deap");
    const a = createTask(tmp, "cyc-a", "--domain", "deap");
    const b = createTask(tmp, "cyc-b", "--domain", "deap");
    // task.py has no blocked_by sugar yet — patch the formal field directly.
    const patch = (dirName: string, blockedBy: string) => {
      const data = readTaskJson(tmp, dirName);
      fs.writeFileSync(
        path.join(tmp, ".omtre", "tasks", dirName, "task.json"),
        JSON.stringify({ ...data, blocked_by: [blockedBy] }, null, 2),
        "utf-8",
      );
    };
    patch(a, b);
    patch(b, a);

    const r = runContext(tmp);

    expect(r.status).toBe(0);
    expect(r.stdout).toContain("无可开工票");
    expect(r.stdout).toMatch(/ready\s*0\s*·\s*blocked\s*2/);
  });

  it("get_context omits 下一票 when no ticket is active", () => {
    seedDomains(tmp);
    makeBoard(tmp, "deap");

    const r = runContext(tmp);

    expect(r.status).toBe(0);
    expect(r.stdout).toContain("当前战线");
    expect(r.stdout).not.toContain("下一票");
  });

  it("get_context omits 下一票 without the domains layer (gated section)", () => {
    createTask(tmp, "no-domains-next");

    const r = runContext(tmp);

    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain("下一票");
  });
});
