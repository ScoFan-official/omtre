/**
 * Integration tests for the CLAI-7 mechanical gates (common/clai_delta.py):
 *
 *   start   a routed task (meta.domain resolving to an existing board) must
 *           carry a well-formed `Domain:` line atop prd.md; in a
 *           `verify_required: true` repo it also needs a verification
 *           contract. Tasks with no routing intent (no meta.domain, no
 *           line) pass — pre-domain-layer tickets are never retro-locked.
 *   archive a frontend task (meta.frontend override, else best-effort
 *           branch-diff detection) must record a `## Design review` section
 *           in implement.md.
 *
 * Real templates are stamped into a throwaway repo and driven through the
 * CLI — no internal mocks.
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
const FOREIGN_WRITER = "devin-FOREIGN-HOST";

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
    OMTRE_CONTEXT_ID: "clai7-itest",
  };
}

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf-8" });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${r.stderr}`);
  }
  return r.stdout.trim();
}

let repo = "";

function runTask(...args: string[]) {
  return spawnSync(PYTHON as string, [".omtre/scripts/task.py", ...args], {
    cwd: repo,
    encoding: "utf-8",
    env: testEnv(),
  });
}

function dirOf(needle: string): string {
  const dir = fs
    .readdirSync(path.join(repo, ".omtre", "tasks"))
    .find((d) => d.includes(needle));
  if (!dir) throw new Error(`no task dir matching ${needle}`);
  return dir;
}

function taskDir(dirName: string): string {
  return path.join(repo, ".omtre", "tasks", dirName);
}

function readTaskJson(dirName: string): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(path.join(taskDir(dirName), "task.json"), "utf-8"),
  );
}

function writeTaskJson(dirName: string, data: Record<string, unknown>): void {
  fs.writeFileSync(
    path.join(taskDir(dirName), "task.json"),
    JSON.stringify(data, null, 2),
    "utf-8",
  );
}

function createTask(slug: string, ...extra: string[]): string {
  const r = runTask(
    "create",
    `Task ${slug}`,
    "--slug",
    slug,
    "--no-start",
    "-d",
    `fixture ${slug}`,
    ...extra,
  );
  if (r.status !== 0) throw new Error(`create failed: ${r.stdout}${r.stderr}`);
  return dirOf(slug);
}

/** Rewrite prd.md with the given `Domain:` line (null = no line at all). */
function writePrd(dirName: string, domainLine: string | null): void {
  const lines = [`# ${dirName}`, ""];
  if (domainLine !== null) lines.push(domainLine, "");
  lines.push("## Goal", "", "fixture", "");
  fs.writeFileSync(
    path.join(taskDir(dirName), "prd.md"),
    lines.join("\n"),
    "utf-8",
  );
}

function writeImplement(dirName: string, withDesignReview: boolean): void {
  const body = withDesignReview
    ? "# Implement\n\n## Design review\n\nNo findings — audit ran (degraded); nothing material.\n"
    : "# Implement\n\n- step 1\n";
  fs.writeFileSync(path.join(taskDir(dirName), "implement.md"), body, "utf-8");
}

function writeConfig(text: string): void {
  fs.writeFileSync(path.join(repo, ".omtre", "config.yaml"), text, "utf-8");
}

/** Stamp the shipped domains/ seed and register a bare board. */
function seedBoard(slug: string): void {
  const domainsDir = path.join(repo, ".omtre", "domains");
  fs.cpSync(TEMPLATE_DOMAINS, domainsDir, { recursive: true });
  const board = path.join(domainsDir, slug);
  fs.cpSync(path.join(domainsDir, "_scaffold"), board, { recursive: true });
  fs.appendFileSync(
    path.join(domainsDir, "REGISTRY.md"),
    `${slug}/ — test board ${slug}\n`,
    "utf-8",
  );
}

function isActive(dirName: string): boolean {
  return fs.existsSync(path.join(taskDir(dirName), "task.json"));
}

beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), "clai7-itest-"));
  fs.mkdirSync(path.join(repo, ".omtre"), { recursive: true });
  fs.cpSync(TEMPLATE_SCRIPTS, path.join(repo, ".omtre", "scripts"), {
    recursive: true,
  });
  const init = spawnSync(
    PYTHON as string,
    [".omtre/scripts/init_developer.py", DEVELOPER],
    { cwd: repo, encoding: "utf-8", env: testEnv() },
  );
  if (init.status !== 0)
    throw new Error(`init_developer failed: ${init.stderr}`);
});

afterEach(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe.skipIf(PYTHON === null)("CLAI-7 start artifact gate", () => {
  it("refuses a routed task whose prd has no Domain line, and leaves it planning", () => {
    seedBoard("deap");
    const dir = createTask("no-domain-line", "--domain", "deap");

    const r = runTask("start", dir);
    expect(r.status).not.toBe(0);
    expect(r.stdout + r.stderr).toContain("Domain:");
    expect(r.stdout + r.stderr).toContain("prd.md");
    expect(readTaskJson(dir).status).toBe("planning");
  });

  it("passes a routed task once prd carries the board-path line", () => {
    seedBoard("deap");
    const dir = createTask("with-domain-line", "--domain", "deap");
    writePrd(dir, "Domain: .omtre/domains/deap/");

    expect(runTask("start", dir).status).toBe(0);
    expect(readTaskJson(dir).status).toBe("in_progress");
  });

  it("accepts a `Domain: none（reason）` line", () => {
    seedBoard("deap");
    const dir = createTask("none-form", "--domain", "deap");
    writePrd(dir, "Domain: none（纯文档改动，无板块可挂）");

    expect(runTask("start", dir).status).toBe(0);
  });

  it("refuses a bare slug (neither accepted form)", () => {
    seedBoard("deap");
    const dir = createTask("bare-slug", "--domain", "deap");
    writePrd(dir, "Domain: deap");

    const r = runTask("start", dir);
    expect(r.status).not.toBe(0);
    expect(r.stdout + r.stderr).toContain("malformed");
  });

  it("refuses `Domain: none` without a reason", () => {
    seedBoard("deap");
    const dir = createTask("none-no-reason", "--domain", "deap");
    writePrd(dir, "Domain: none");

    const r = runTask("start", dir);
    expect(r.status).not.toBe(0);
    expect(r.stdout + r.stderr).toContain("malformed");
  });

  it("passes a pre-domain-layer task with no routing intent on either side", () => {
    seedBoard("deap");
    const dir = createTask("legacy-unrouted");

    expect(runTask("start", dir).status).toBe(0);
  });

  it("reports a foreign flag before the artifact problem (flag gate precedes)", () => {
    seedBoard("deap");
    fs.writeFileSync(
      path.join(repo, ".omtre", "domains", "deap", "README.md"),
      `旗: ${FOREIGN_WRITER} · other-task · 自 ${new Date()
        .toISOString()
        .slice(0, 16)
        .replace("T", " ")}\n`,
      "utf-8",
    );
    const dir = createTask("flag-first", "--domain", "deap");

    const r = runTask("start", dir);
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toContain(FOREIGN_WRITER);
    expect(r.stderr + r.stdout).not.toContain("planning artifacts incomplete");
  });

  it("refuses a missing verification contract when verify_required is on", () => {
    seedBoard("deap");
    writeConfig("verify_required: true\n");
    const dir = createTask("vr-routed", "--domain", "deap");
    writePrd(dir, "Domain: .omtre/domains/deap/");
    writeImplement(dir, false);

    const r = runTask("start", dir);
    expect(r.status).not.toBe(0);
    expect(r.stdout + r.stderr).toContain("verification contract");

    // Repo-wide opt-in: an unrouted task is held to it too.
    const unrouted = createTask("vr-unrouted");
    expect(runTask("start", unrouted).status).not.toBe(0);
  });

  it("passes once a verification contract is recorded", () => {
    seedBoard("deap");
    writeConfig("verify_required: true\n");
    const dir = createTask("vr-fixed", "--domain", "deap");
    writePrd(dir, "Domain: .omtre/domains/deap/");

    expect(runTask("add-verify", dir, "python --version").status).toBe(0);
    expect(runTask("start", dir).status).toBe(0);
  });
});

describe.skipIf(PYTHON === null)("CLAI-7 archive design-review gate", () => {
  it("refuses a frontend-marked task without a Design review section", () => {
    const dir = createTask("fe-missing");
    expect(runTask("set-meta", dir, "frontend", "true").status).toBe(0);
    writeImplement(dir, false);

    const r = runTask("archive", dir, "--no-commit");
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toContain("Design review");
    expect(isActive(dir)).toBe(true);
  });

  it("archives once implement.md carries the section", () => {
    const dir = createTask("fe-recorded");
    runTask("set-meta", dir, "frontend", "true");
    writeImplement(dir, true);

    expect(runTask("archive", dir, "--no-commit").status).toBe(0);
    expect(isActive(dir)).toBe(false);
  });

  it("lets meta.frontend=false skip the gate", () => {
    const dir = createTask("fe-override-off");
    runTask("set-meta", dir, "frontend", "false");
    writeImplement(dir, false);

    expect(runTask("archive", dir, "--no-commit").status).toBe(0);
  });

  it("archives an unmarked task with no branch metadata (undetectable → skip)", () => {
    const dir = createTask("fe-undetectable");
    writeImplement(dir, false);

    expect(runTask("archive", dir, "--no-commit").status).toBe(0);
  });

  it("detects frontend via the task branch diff and refuses", () => {
    git(repo, "init", "-q", "-b", "main");
    git(repo, "config", "user.email", "test@example.com");
    git(repo, "config", "user.name", "Test");
    fs.writeFileSync(path.join(repo, "README.md"), "base\n");
    git(repo, "add", "README.md");
    git(repo, "commit", "-q", "-m", "base");
    git(repo, "checkout", "-q", "-b", "feature/x");
    fs.writeFileSync(path.join(repo, "app.tsx"), "export {};\n");
    git(repo, "add", "app.tsx");
    git(repo, "commit", "-q", "-m", "feat");
    git(repo, "checkout", "-q", "main");

    const dir = createTask("fe-branch-diff");
    const data = readTaskJson(dir);
    data.branch = "feature/x";
    data.base_branch = "main";
    writeTaskJson(dir, data);
    writeImplement(dir, false);

    const r = runTask("archive", dir, "--no-commit");
    expect(r.status).not.toBe(0);
    expect(r.stderr + r.stdout).toContain("Design review");
  });

  it("archives the branch-diff task once the section is added", () => {
    git(repo, "init", "-q", "-b", "main");
    git(repo, "config", "user.email", "test@example.com");
    git(repo, "config", "user.name", "Test");
    fs.writeFileSync(path.join(repo, "README.md"), "base\n");
    git(repo, "add", "README.md");
    git(repo, "commit", "-q", "-m", "base");
    git(repo, "checkout", "-q", "-b", "feature/y");
    fs.writeFileSync(path.join(repo, "styles.css"), "body {}\n");
    git(repo, "add", "styles.css");
    git(repo, "commit", "-q", "-m", "feat");
    git(repo, "checkout", "-q", "main");

    const dir = createTask("fe-branch-fixed");
    const data = readTaskJson(dir);
    data.branch = "feature/y";
    data.base_branch = "main";
    writeTaskJson(dir, data);
    writeImplement(dir, true);

    expect(runTask("archive", dir, "--no-commit").status).toBe(0);
  });
});
