/**
 * Integration tests for CLAI-2's writer identity (D8): `own_writer_id()` used
 * to hard-code `devin-<hostname>`, so on a Qoder / Claude / Codex session the
 * CLI computed a Devin identity. Flag ownership — the only mechanical part of
 * the concurrency protocol, and the ground `supervised-delivery` builds on —
 * then mis-reads every flag: a Qoder agent believes a Devin agent's fresh flag
 * is its own and starts work over it.
 *
 * Now: `OMTRE_WRITER` still wins, otherwise `{platform}-{machine}` with the
 * platform read from the repo's own config dirs.
 *
 * Real templates are stamped into a throwaway repo; the identity is read
 * straight out of the module the same way `task.py start` does.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { spawnSync, execFileSync } from "node:child_process";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { getOmtreTemplatePath } from "../../src/templates/extract.js";

const TEMPLATE_SCRIPTS = path.join(getOmtreTemplatePath(), "scripts");

const HOSTNAME = os.hostname();

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

function runTask(repo: string, args: string[], env: Record<string, string>) {
  return spawnSync(PYTHON as string, [".omtre/scripts/task.py", ...args], {
    cwd: repo,
    encoding: "utf-8",
    env: { ...process.env, ...env },
  });
}

function probeIdentity(repo: string, env: Record<string, string>): string {
  const r = spawnSync(
    PYTHON as string,
    [
      "-c",
      "import sys;sys.path.insert(0,'.omtre/scripts');" +
        "from common.clai_delta import own_writer_id;print(own_writer_id())",
    ],
    { cwd: repo, encoding: "utf-8", env: { ...process.env, ...env } },
  );
  if (r.status !== 0) throw new Error(`identity probe failed: ${r.stderr}`);
  return r.stdout.trim();
}

function createTask(repo: string, slug: string, domain?: string): string {
  const args = ["create", `Task ${slug}`, "--slug", slug, "--no-start", "-d", `fixture ${slug}`];
  if (domain) args.push("--domain", domain);
  const r = runTask(repo, args, { OMTRE_WRITER: "probe" });
  if (r.status !== 0) throw new Error(`create failed: ${r.stdout}${r.stderr}`);
  const dir = fs
    .readdirSync(path.join(repo, ".omtre", "tasks"))
    .find((d) => d.includes(slug)) as string;
  if (domain) {
    // A routed task must carry the well-formed `Domain:` line (CLAI-7), or
    // `start` refuses for artifact reasons before the flag gate is interesting.
    const prd = path.join(repo, ".omtre", "tasks", dir, "prd.md");
    fs.writeFileSync(prd, `Domain: .omtre/domains/${domain}/\n\n${fs.readFileSync(prd, "utf-8")}`, "utf-8");
  }
  return dir;
}

/**
 * Flag ages are parsed against local wall-clock time, so build the stamp from
 * local parts and always relative to now: an absolute date here turns this
 * suite red 24h later, when the planted flag crosses STALE_FLAG_AGE.
 */
function flagStamp(minutesAgo = 0): string {
  const d = new Date(Date.now() - minutesAgo * 60_000);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function seedBoard(repo: string, slug: string, flagWriter: string | null, minutesAgo = 0): string {
  const board = path.join(repo, ".omtre", "domains", slug);
  fs.mkdirSync(path.join(board, "worklog"), { recursive: true });
  const registry = path.join(repo, ".omtre", "domains", "REGISTRY.md");
  const line = `| ${slug}/ — fixture board |\n`;
  fs.writeFileSync(
    registry,
    fs.existsSync(registry) ? fs.readFileSync(registry, "utf-8") + line : `# REGISTRY\n${line}`,
    "utf-8",
  );
  const flag = flagWriter
    ? `旗: ${flagWriter} · 10-09-probe · 自 ${flagStamp(minutesAgo)}\n`
    : "";
  fs.writeFileSync(path.join(board, "README.md"), `${flag}# ${slug}\n`, "utf-8");
  return board;
}

let repo = "";

beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), "writer-id-itest-"));
  fs.mkdirSync(path.join(repo, ".omtre"), { recursive: true });
  fs.cpSync(TEMPLATE_SCRIPTS, path.join(repo, ".omtre", "scripts"), { recursive: true });
  const init = spawnSync(PYTHON as string, [".omtre/scripts/init_developer.py", "tester"], {
    cwd: repo,
    encoding: "utf-8",
    env: { ...process.env, OMTRE_WRITER: "probe" },
  });
  if (init.status !== 0) throw new Error(`init_developer failed: ${init.stderr}`);
});

afterEach(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe.skipIf(PYTHON === null)("own_writer_id()", () => {
  it("lets OMTRE_WRITER win over any detection", () => {
    fs.mkdirSync(path.join(repo, ".claude"), { recursive: true });
    const id = probeIdentity(repo, { OMTRE_WRITER: "qoder-BOX-agent", OMTRE_PLATFORM: "codex" });
    expect(id).toBe("qoder-BOX-agent");
  });

  it("uses the declared platform instead of claiming Devin", () => {
    const id = probeIdentity(repo, { OMTRE_WRITER: "", OMTRE_PLATFORM: "qoder" });
    expect(id).toBe(`qoder-${HOSTNAME}`);
  });

  it("keeps Devin's historical shape when the platform really is Devin", () => {
    const id = probeIdentity(repo, { OMTRE_WRITER: "", OMTRE_PLATFORM: "devin" });
    expect(id).toBe(`devin-${HOSTNAME}`);
  });

  it("reads the platform from the repo's own config dirs when unset", () => {
    fs.mkdirSync(path.join(repo, ".codex"), { recursive: true });
    const id = probeIdentity(repo, { OMTRE_WRITER: "", OMTRE_PLATFORM: "" });
    expect(id).toBe(`codex-${HOSTNAME}`);
  });
});

describe.skipIf(PYTHON === null)("flag ownership under the real platform", () => {
  it("refuses to treat another platform's flag as its own", () => {
    // The bug D8 fixes: a Qoder session used to compute `devin-<host>`, so this
    // Devin flag looked like its own and `start` walked over a live claim.
    seedBoard(repo, "probe", `devin-${HOSTNAME}`);
    const dir = createTask(repo, "a-one", "probe");

    const r = runTask(repo, ["start", dir], { OMTRE_WRITER: "", OMTRE_PLATFORM: "qoder" });
    expect(r.status).not.toBe(0);
    expect(r.stdout + r.stderr).toMatch(/旗|foreign|blocked/i);
  });

  it("accepts a flag the same platform and machine wrote", () => {
    seedBoard(repo, "probe", `qoder-${HOSTNAME}`);
    const dir = createTask(repo, "b-two", "probe");

    const r = runTask(repo, ["start", dir, "--allow-empty-context"], {
      OMTRE_WRITER: "",
      OMTRE_PLATFORM: "qoder",
      OMTRE_CONTEXT_ID: "writer-id-own",
    });
    expect(r.status).toBe(0);
  });

  it("proceeds once a foreign flag has gone stale, and says so on stderr", () => {
    // 腐旗 (>24h) deliberately does not lock a board forever — but it must stay
    // visible, because "stale" is also what a crashed session leaves behind.
    seedBoard(repo, "probe", `devin-${HOSTNAME}`, 25 * 60);
    const dir = createTask(repo, "d-four", "probe");

    const r = runTask(repo, ["start", dir, "--allow-empty-context"], {
      OMTRE_WRITER: "",
      OMTRE_PLATFORM: "qoder",
      OMTRE_CONTEXT_ID: "writer-id-stale",
    });
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/旗已腐/);
  });

  it("still honors an explicit identity that carries a writer suffix", () => {
    // Agents that name themselves `…-agent` keep working by setting the env var;
    // the docs say to set it, and the escape must stay exact.
    seedBoard(repo, "probe", `qoder-${HOSTNAME}-agent`);
    const dir = createTask(repo, "c-three", "probe");

    const r = runTask(repo, ["start", dir, "--allow-empty-context"], {
      OMTRE_WRITER: `qoder-${HOSTNAME}-agent`,
      OMTRE_PLATFORM: "codex",
      OMTRE_CONTEXT_ID: "writer-id-explicit",
    });
    expect(r.status).toBe(0);
  });
});
