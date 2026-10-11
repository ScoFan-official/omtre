/**
 * Shape lint for the fork's own surfaces — deterministic checks for the mistake
 * classes this line actually hit, written instead of leaving them as rules for a
 * reviewer to remember.
 *
 * 1. The runner shells out to `task.py` verbs. A missing registration does not
 *    fail in the fork: it fails in a consumer repo, mid-run, in code already
 *    released. The verb list is read out of `run.ts`, not restated here, and
 *    registration is proven by the parser line that creates the subcommand
 *    (a verb mentioned in help text proves nothing).
 * 2. `subprocess.run(shell=True, capture_output=True, timeout=…)` kills only the
 *    shell: the orphan keeps the pipes and the post-kill collect blocks forever
 *    (`script-conventions.md` → "Wrong — timeout that kills only the shell").
 *    `run-verify` shipped in that shape, blocking `archive`, then the loop.
 *    Banned across every template script — the predicate tests `shell=True` and
 *    either capture style, so list-form calls (which kill their own child) stay
 *    clean and nothing has to be excluded.
 * 3. A config key that is not documented is a key users route around:
 *    `verify_required` flipped `archive` from warning to refusal while missing
 *    from `config.yaml` entirely. Checked in the documented shape (a commented
 *    example line), not as a substring anywhere in the file.
 * 4. Test fixtures that plant a flag with an absolute date silently change
 *    meaning 24h later, when `STALE_FLAG_AGE` passes — that red was a fixture
 *    telling time, not a regression.
 * 5. The protected-path rule must live in one language; the runner keeping a
 *    private copy is how a worker's own `.env` commit reached a PR.
 *
 * Every check that could pass vacuously carries a self-check on a planted
 * sample, because a guard that cannot fail is worse than none (`platform-
 * integration.md` → "cannot pass vacuously").
 */

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { unreachable } from "../../scripts/fork-release-carries.js";

const CLI_ROOT = path.resolve(__dirname, "../..");
const SCRIPTS = path.join(CLI_ROOT, "src/templates/trellis/scripts");
const CONFIG_YAML = path.join(CLI_ROOT, "src/templates/trellis/config.yaml");
const RUN_TS = path.join(CLI_ROOT, "src/commands/run.ts");

const read = (p: string): string => fs.readFileSync(p, "utf-8");

function walkPy(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkPy(p));
    else if (entry.name.endsWith(".py")) out.push(p);
  }
  return out;
}

/**
 * Argument text of each `call` occurrence, by balancing parentheses from the open
 * paren instead of guessing where the call ends: the real call sites are both
 * black-formatted (closing paren on its own line) and inline one-liners, and a
 * pattern that matches only one layout reports green on the other. Known limit:
 * a paren inside a string literal ends the scan early — it can only shrink what
 * a call reports, never invent a flag.
 */
function callArguments(src: string, call: string): string[] {
  const out: string[] = [];
  for (let at = src.indexOf(call); at >= 0; at = src.indexOf(call, at + call.length)) {
    const open = at + call.length - 1;
    let depth = 0;
    for (let j = open; j < src.length; j += 1) {
      if (src[j] === "(") depth += 1;
      else if (src[j] === ")") {
        depth -= 1;
        if (depth === 0) {
          out.push(src.slice(open + 1, j));
          break;
        }
      }
    }
  }
  return out;
}

/** Shell-mediated calls that capture output AND set a timeout — the hang shape. */
function shellTimeoutCaptures(src: string): string[] {
  return callArguments(src, "subprocess.run(").filter(
    (args) =>
      /(^|[\s(])shell\s*=\s*True/.test(args) &&
      (/capture_output\s*=\s*True/.test(args) ||
        (/stdout\s*=\s*subprocess\.PIPE/.test(args) &&
          /stderr\s*=\s*subprocess\.PIPE/.test(args))) &&
      /(^|[\s(])timeout\s*=/.test(args),
  );
}

describe("template shape lint", () => {
  const taskPy = read(path.join(SCRIPTS, "task.py"));
  const runTs = read(RUN_TS);

  it("catches both layouts of the shape it bans, and nothing benign (self-check)", () => {
    const blackFormatted = [
      '        completed = subprocess.run(  # noqa: S602',
      '            spec["cmd"],',
      "            shell=True,",
      "            cwd=repo_root,",
      "            capture_output=True,",
      '            encoding="utf-8",',
      '            errors="replace",',
      '            timeout=spec["timeout"],',
      "        )",
    ].join("\n");
    const inline = "subprocess.run(cmd, shell=True, capture_output=True, timeout=60)";
    const pipesVariant =
      "subprocess.run(\n  cmd,\n  shell=True,\n  stdout=subprocess.PIPE,\n  stderr=subprocess.PIPE,\n  timeout=30,\n)";
    const listForm = "subprocess.run(args, capture_output=True, timeout=20)";
    const noTimeout = "subprocess.run(cmd, shell=True, capture_output=True)";

    expect(shellTimeoutCaptures(blackFormatted)).toHaveLength(1);
    expect(shellTimeoutCaptures(inline)).toHaveLength(1);
    expect(shellTimeoutCaptures(pipesVariant)).toHaveLength(1);
    expect(shellTimeoutCaptures(listForm)).toHaveLength(0);
    expect(shellTimeoutCaptures(noTimeout)).toHaveLength(0);
  });

  it("bans the shell-only timeout shape in every template script", () => {
    const files = walkPy(SCRIPTS);
    expect(files.length).toBeGreaterThanOrEqual(20); // the scan has to actually scan

    const offenders = files
      .filter((f) => shellTimeoutCaptures(read(f)).length > 0)
      .map((f) => path.relative(CLI_ROOT, f));
    expect(
      offenders,
      "use Popen + tree kill + bounded collect (see verify._run_bounded); " +
        `offenders: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("registers every task.py verb the runner calls, as a real subcommand", () => {
    const called = new Set<string>();
    for (const m of runTs.matchAll(/ports\.task\(\s*\["([a-z][a-z-]*)"/g)) called.add(m[1]);
    for (const m of runTs.matchAll(/\[\s*"([a-z][a-z-]*)",?\s*(?:"--json"|opts\.)/g)) called.add(m[1]);
    for (const m of runTs.matchAll(/\[taskPy,\s*"([a-z][a-z-]*)"/g)) called.add(m[1]);

    // Extraction must be working: an empty or tiny set would make the loop below
    // pass by checking nothing.
    expect(called.size).toBeGreaterThanOrEqual(10);
    for (const verb of ["frontier", "delivery-gate", "check-commit", "run-verify"]) {
      expect(called.has(verb)).toBe(true);
    }

    const missing = [...called].filter(
      (verb) => !new RegExp(`add_parser\\(\\s*\\n?\\s*"${verb}"`).test(taskPy),
    );
    expect(missing, `task.py never builds a subparser for: ${missing.join(", ")}`).toEqual([]);
  });

  it("documents each fork-owned config key as a commented example", () => {
    const yaml = read(CONFIG_YAML);
    const documented = (key: string): boolean =>
      new RegExp(`^\\s*#.*\\b${key}\\b`, "m").test(yaml);

    for (const key of ["autonomy", "verify_required", "delivery", "auto_push_refs", "protected_refs"]) {
      expect(documented(key), `config.yaml has no documented example for "${key}"`).toBe(true);
    }
  });

  it("flags no test fixture that plants a flag with an absolute date", () => {
    const dir = path.join(CLI_ROOT, "test");
    const files: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        for (const f of fs.readdirSync(p)) if (f.endsWith(".test.ts")) files.push(path.join(p, f));
      }
    }
    expect(files.length).toBeGreaterThanOrEqual(10);

    const absolute = (src: string): boolean => /旗: [^"\n]*自 20\d\d-\d\d-\d\d \d\d:\d\d/.test(src);
    expect(absolute('const flag = `旗: devin-H · 10-09-p · 自 2026-10-09 10:00\\n`;')).toBe(true);
    expect(absolute("flagStamp(minutesAgo)")).toBe(false);

    const here = path.join(__dirname, path.basename(__filename));
    const offenders = files
      // This file carries the planted absolute-date sample its own self-check
      // needs, so it must not be swept by the rule it documents.
      .filter((f) => f !== here)
      .filter((f) => absolute(read(f)))
      .map((f) => path.relative(CLI_ROOT, f));
    expect(
      offenders,
      "plant flag ages relative to now (an absolute date flips the test when " +
        `STALE_FLAG_AGE passes): ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("keeps the protected-path rule in one language", () => {
    expect(runTs).not.toMatch(/PROTECTED_FRAGMENTS|isProtectedPath/);
    expect(read(path.join(SCRIPTS, "common/clai_delta.py"))).toContain("PROTECTED_PATH_FRAGMENTS");
    expect(taskPy).toMatch(/add_parser\(\s*\n?\s*"check-commit"/);
  });
});

describe("fork-release-carries", () => {
  it("reports every unreachable sha, and fails closed on missing arguments", () => {
    const known = new Set(["aaa", "bbb"]);
    const fake = (ref: string, sha: string): boolean => ref === "origin/main" && known.has(sha);

    expect(unreachable({ ref: "origin/main", shas: ["aaa", "bbb"], run: fake })).toEqual({
      ok: true,
      missing: [],
    });
    expect(unreachable({ ref: "origin/main", shas: ["aaa", "zzz"], run: fake }).missing).toEqual(["zzz"]);
    expect(unreachable({ ref: "", shas: ["aaa"], run: fake }).usage).toBe(true);
    expect(unreachable({ ref: "origin/main", shas: [], run: fake }).usage).toBe(true);
  });
});
