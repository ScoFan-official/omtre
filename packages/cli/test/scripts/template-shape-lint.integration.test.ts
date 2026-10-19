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
 *    Banned across every template script, for the three spellings that wait
 *    internally (`run` / `check_output` / `call`). `Popen` is deliberately not
 *    in the set: with a bounded `communicate` plus a tree kill it IS the fix,
 *    and both live `shell=True` sites use it that way. String literals and `#`
 *    comments are masked before scanning, so prose quoting the Wrong example
 *    cannot turn CI red and a paren inside a literal cannot cut the scan short.
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
import { getOmtreTemplatePath } from "../../src/templates/extract.js";

const CLI_ROOT = path.resolve(__dirname, "../..");
const TEMPLATES = path.join(CLI_ROOT, "src/templates");
const OMTRE_TEMPLATES = getOmtreTemplatePath();
const SCRIPTS = path.join(OMTRE_TEMPLATES, "scripts");
const CONFIG_YAML = path.join(OMTRE_TEMPLATES, "config.yaml");
const RUNNER_SRC = path.join(CLI_ROOT, "src/commands");

const read = (p: string): string => fs.readFileSync(p, "utf-8");

function walk(dir: string, ext: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p, ext));
    else if (entry.name.endsWith(ext)) out.push(p);
  }
  return out;
}

/** The runner is `run.ts` plus its `run/` helpers; a verb called from any of
 *  them has to be registered, so all of them are read. */
function runnerSources(): string[] {
  const files = [path.join(RUNNER_SRC, "run.ts")];
  const sub = path.join(RUNNER_SRC, "run");
  if (fs.existsSync(sub)) files.push(...walk(sub, ".ts"));
  return files;
}

/**
 * Blank the contents of string literals and `#` comments, positions preserved.
 * Scanning raw text reads prose as code: `verify.py` and `task_utils.py` both
 * document the Wrong example in prose, so an unmasked check goes red on a
 * comment (and gets "fixed" by deleting the comment, which is how a guard dies).
 * Masking also stops a paren inside a literal from ending the argument scan.
 */
function maskLiterals(src: string): string {
  const out = src.split("");
  const blank = (from: number, to: number): void => {
    for (let j = Math.max(from, 0); j < to; j += 1) if (out[j] !== "\n") out[j] = " ";
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "#") {
      let j = i;
      while (j < src.length && src[j] !== "\n") j += 1;
      blank(i, j);
      i = j;
      continue;
    }
    const triple = src.slice(i, i + 3);
    if (triple === '"""' || triple === "'''") {
      const end = src.indexOf(triple, i + 3);
      const stop = end < 0 ? src.length : end + 3;
      blank(i + 3, stop - 3);
      i = stop;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c && src[j] !== "\n") {
        if (src[j] === "\\") j += 1;
        j += 1;
      }
      blank(i + 1, j);
      i = j + 1;
      continue;
    }
    i += 1;
  }
  return out.join("");
}

/**
 * Argument text of each `call` occurrence, by balancing parentheses from the open
 * paren instead of guessing where the call ends: the real call sites are both
 * black-formatted (closing paren on its own line) and inline one-liners, and a
 * pattern that matches only one layout reports green on the other.
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

/**
 * Shell-mediated calls that capture output AND set a timeout — the hang shape.
 * The set is the three entry points that wait internally; `Popen` returns at
 * once and its timeout lives in `communicate`, which is the shape the fix uses.
 * Limit worth naming: arguments built through a `**spec` splat are invisible to
 * a textual rule, as is `from subprocess import run`.
 */
const SHELL_WAIT_CALLS = ["subprocess.run(", "subprocess.check_output(", "subprocess.call("];

const shellTrue = (args: string): boolean => /(^|[\s(])shell\s*=\s*True/.test(args);
const withTimeout = (args: string): boolean => /(^|[\s(])timeout\s*=/.test(args);
const capturesOutput = (args: string): boolean =>
  /capture_output\s*=\s*True/.test(args) ||
  (/(^|[\s(])stdout\s*=\s*subprocess\.PIPE/.test(args) &&
    /(^|[\s(])stderr\s*=\s*subprocess\.PIPE/.test(args));

function shellTimeoutCaptures(src: string): string[] {
  const code = maskLiterals(src);
  return SHELL_WAIT_CALLS.flatMap((call) =>
    callArguments(code, call).filter(
      (args) =>
        shellTrue(args) &&
        // `check_output` returns the captured stdout by definition; it needs no
        // capture kwarg to be holding the orphan's pipe.
        (call === "subprocess.check_output(" || capturesOutput(args)) &&
        withTimeout(args),
    ),
  );
}

describe("template shape lint", () => {
  const taskPy = read(path.join(SCRIPTS, "task.py"));
  const runnerSrc = runnerSources()
    .map((f) => read(f))
    .join("\n");

  it("catches every layout of the shape it bans, and nothing benign (self-check)", () => {
    // Verbatim from `9246fabc~1` — the shipped `run-verify` before the bounded
    // tree kill. The replay evidence is this fixture, not an ad-hoc shell run.
    const blackFormatted = [
      '        completed = subprocess.run(  # noqa: S602 - repo-local contract, mirrors CI',
      '            spec["cmd"],',
      "            shell=True,",
      "            cwd=repo_root,",
      "            capture_output=True,",
      "            text=True,",
      '            encoding="utf-8",',
      '            errors="replace",',
      '            timeout=spec["timeout"],',
      "        )",
    ].join("\n");
    const inline = "subprocess.run(cmd, shell=True, capture_output=True, timeout=60)";
    const pipesVariant =
      "subprocess.run(\n  cmd,\n  shell=True,\n  stdout=subprocess.PIPE,\n  stderr=subprocess.PIPE,\n  timeout=30,\n)";
    const checkOutput = "subprocess.check_output(cmd, shell=True, timeout=30)";
    const callForm =
      "subprocess.call(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)";
    const listForm = "subprocess.run(args, capture_output=True, timeout=20)";
    const noTimeout = "subprocess.run(cmd, shell=True, capture_output=True)";
    // The fix, and the only two live `shell=True` sites in the templates.
    const popenFix =
      "proc = subprocess.Popen(\n  cmd,\n  shell=True,\n  stdout=subprocess.PIPE,\n  stderr=subprocess.PIPE,\n)\nstdout, stderr = proc.communicate(timeout=30)";
    // A guard that reads prose goes red on documentation, and then gets deleted.
    const inComment = `# Wrong: ${inline}`;
    const inDocstring = ['"""Counter-example kept for documentation:', "", inline, '"""'].join(
      "\n",
    );

    expect(shellTimeoutCaptures(blackFormatted)).toHaveLength(1);
    expect(shellTimeoutCaptures(inline)).toHaveLength(1);
    expect(shellTimeoutCaptures(pipesVariant)).toHaveLength(1);
    expect(shellTimeoutCaptures(checkOutput)).toHaveLength(1);
    expect(shellTimeoutCaptures(callForm)).toHaveLength(1);
    expect(shellTimeoutCaptures(listForm)).toHaveLength(0);
    expect(shellTimeoutCaptures(noTimeout)).toHaveLength(0);
    expect(shellTimeoutCaptures(popenFix)).toHaveLength(0);
    expect(shellTimeoutCaptures(inComment)).toHaveLength(0);
    expect(shellTimeoutCaptures(inDocstring)).toHaveLength(0);
  });

  it("bans the shell-only timeout shape in every template script", () => {
    const files = walk(TEMPLATES, ".py");
    // Scripts, shared hooks and the platform hook copies — a shape ban with an
    // exemption list is a shape ban that nobody reads.
    expect(files.length).toBeGreaterThanOrEqual(35);

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
    // Verbs are read out of real task invocations only. Scanning every
    // array-shaped literal in the runner would demand a subparser for the
    // `git`/`gh` argv too, i.e. a check that turns red for the wrong reason.
    // Out of reach: a verb assembled into a variable before the call.
    for (const args of callArguments(runnerSrc, "ports.task(")) {
      for (const m of args.matchAll(/\[\s*"([a-z][a-z-]*)"/g)) called.add(m[1]);
    }
    for (const m of runnerSrc.matchAll(/\[\s*taskPy,\s*"([a-z][a-z-]*)"/g)) called.add(m[1]);

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
    // A commented MAPPING line (`#   key:`), not the key mentioned in any
    // sentence: prose already contains "`delivery.auto_push_refs`" inside the
    // tier description, so a substring test passes with the example block gone.
    const documented = (src: string, key: string): boolean =>
      new RegExp(`^\\s*#\\s+${key}\\s*:`, "m").test(src);

    const prose = "# the delivery gate is orthogonal to autonomy\n";
    expect(documented(prose, "delivery"), "prose mention is not documentation").toBe(false);
    expect(documented("#   delivery:\n", "delivery")).toBe(true);

    for (const key of ["autonomy", "verify_required", "delivery", "auto_push_refs", "protected_refs"]) {
      expect(documented(yaml, key), `config.yaml has no documented example for "${key}"`).toBe(true);
    }
  });

  it("flags no test fixture that plants a flag with an absolute date", () => {
    const files = walk(path.join(CLI_ROOT, "test"), ".test.ts");
    expect(files.length).toBeGreaterThanOrEqual(12);

    // Both colon widths, because `_FLAG_PREFIXES` in clai_delta.py accepts both.
    const absolute = (src: string): boolean =>
      /旗[:：][^\n]*自\s*20\d\d-\d\d-\d\d[ T]\d\d:\d\d/.test(src);
    expect(absolute("旗: devin-H · 10-09-p · 自 2026-10-09 10:00")).toBe(true);
    expect(absolute("旗：devin-H · 10-09-p · 自 2026-10-09T10:00")).toBe(true);
    expect(absolute("flagStamp(minutesAgo)")).toBe(false);
    // Limit worth naming: a fixture that builds the date in a helper and injects
    // it is invisible here — that is the shape a textual rule cannot reach.

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
    expect(runnerSrc).not.toMatch(/PROTECTED_FRAGMENTS|isProtectedPath/);
    expect(read(path.join(SCRIPTS, "common/clai_delta.py"))).toContain("PROTECTED_PATH_FRAGMENTS");
    expect(taskPy).toMatch(/add_parser\(\s*\n?\s*"check-commit"/);
  });
});
