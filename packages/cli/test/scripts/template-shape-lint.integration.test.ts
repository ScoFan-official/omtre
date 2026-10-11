/**
 * Shape lint for the shipped templates — deterministic checks for the mistake
 * classes this line actually hit, added instead of writing them down as rules
 * for a reviewer to remember.
 *
 * 1. The runner shells out to `task.py` verbs. A missing registration does not
 *    fail in the fork: it fails in a consumer repo, mid-run, in code that is
 *    already released. The verb list is read out of `run.ts`, not restated here.
 * 2. `subprocess.run(shell=True, capture_output=True, timeout=…)` kills only the
 *    shell; the orphan keeps the pipes and the post-kill collect blocks forever
 *    (`script-conventions.md` → "Wrong — timeout that kills only the shell").
 *    `run-verify` sat in that shape, and it blocks `archive`, then the loop.
 *    Scoped to the scripts this fork owns: two upstream files still hold the
 *    shape, and a check that fails on inherited code is one people learn to
 *    ignore, so those get reported upstream instead. The lint carries a
 *    self-check, because a pattern that quietly matches nothing also passes.
 * 3. A config key nobody documented is a key nobody can find, so users invent
 *    workarounds — `verify_required` (which flips `archive` from warning to
 *    refusal) shipped without existing in `config.yaml` at all.
 * 4. The protected-path rule must live in exactly one language. The runner kept
 *    a private copy, which is how "the worker committed `.env` itself" slipped
 *    through: two authorities, one of them unenforced.
 *
 * Template files are read as shipped, so this catches drift without needing a
 * stamped fixture repo.
 */

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const CLI_ROOT = path.resolve(__dirname, "../..");
const SCRIPTS = path.join(CLI_ROOT, "src/templates/trellis/scripts");
const CONFIG_YAML = path.join(CLI_ROOT, "src/templates/trellis/config.yaml");
const RUN_TS = path.join(CLI_ROOT, "src/commands/run.ts");

const read = (p: string): string => fs.readFileSync(p, "utf-8");

/**
 * Every `subprocess.run(...)` call in `src` that asks for captured output AND a
 * timeout - the shape that kills only the shell. Scan up to the call's own
 * closing paren at line start: the real call spans several lines, and a
 * pattern that only matches one-liners reports green on the sick case, which
 * is worse than having no check at all.
 */
function shellTimeoutRuns(src: string): string[] {
  const found: string[] = [];
  const re = /subprocess\.run\(([\s\S]{0,800}?)\n\s*\)/g;
  for (const m of src.matchAll(re)) {
    if (m[1].includes("capture_output=True") && m[1].includes("timeout=")) found.push(m[1]);
  }
  return found;
}

describe("template shape lint", () => {
  const taskPy = read(path.join(SCRIPTS, "task.py"));
  const runTs = read(RUN_TS);

  it("catches the shape it bans (self-check, so a vacuous lint cannot pass)", () => {
    const sick = [
      "        completed = subprocess.run(  # noqa: S602",
      "            spec[\"cmd\"],",
      "            shell=True,",
      "            cwd=repo_root,",
      "            capture_output=True,",
      "            timeout=spec[\"timeout\"],",
      "        )",
      "        exit_code = completed.returncode",
    ].join("\n");

    expect(shellTimeoutRuns(sick)).toHaveLength(1);
    expect(shellTimeoutRuns("x = subprocess.run(cmd, shell=True)")).toHaveLength(0);
  });

  it("registers every task.py verb the runner calls", () => {
    const called = new Set<string>();
    for (const m of runTs.matchAll(/ports\.task\(\s*\["([a-z][a-z-]*)"/g)) called.add(m[1]);
    for (const m of runTs.matchAll(/\[\s*"([a-z][a-z-]*)",?\s*(?:"--json"|opts\.)/g)) called.add(m[1]);
    for (const m of runTs.matchAll(/\[taskPy,\s*"([a-z][a-z-]*)"/g)) called.add(m[1]);

    // The runner must actually use these; an empty set means the extraction
    // broke, and a passing test would mean nothing.
    expect(called.size).toBeGreaterThanOrEqual(7);
    expect(called.has("frontier")).toBe(true);
    expect(called.has("check-commit")).toBe(true);
    expect(called.has("delivery-gate")).toBe(true);

    const missing = [...called].filter((verb) => !taskPy.includes(`"${verb}"`));
    expect(missing, `task.py never registers: ${missing.join(", ")}`).toEqual([]);
  });

  it("keeps the fork-owned scripts free of the shell-only timeout shape", () => {
    // Scoped to the surface this fork writes: upstream `common/git.py` and
    // `common/session_context.py` still hold the same call shape, and a check
    // that fails on inherited code teaches everyone to ignore it. Those two are
    // reported upstream instead; the list below is the part we own.
    const FORK_OWNED = [
      path.join(SCRIPTS, "task.py"),
      path.join(SCRIPTS, "common", "clai_delta.py"),
      path.join(SCRIPTS, "common", "frontier.py"),
      path.join(SCRIPTS, "common", "verify.py"),
    ];
    const offenders = FORK_OWNED.filter((f) => shellTimeoutRuns(read(f)).length > 0).map((f) =>
      path.relative(CLI_ROOT, f),
    );
    expect(
      offenders,
      "use Popen + tree kill + bounded collect (see verify._run_bounded); " +
        `offenders: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("documents every fork-owned config key in the shipped config.yaml", () => {
    const yaml = read(CONFIG_YAML);
    // Keys the fork's scripts read out of .trellis/config.yaml. A key that is
    // only findable in source is a key users route around.
    const FORK_CONFIG_KEYS = [
      "autonomy",
      "verify_required",
      "delivery",
      "auto_push_refs",
      "protected_refs",
    ];
    for (const key of FORK_CONFIG_KEYS) {
      expect(yaml, `config.yaml never mentions "${key}"`).toContain(key);
    }
  });

  it("keeps the protected-path rule in one language", () => {
    expect(runTs).not.toMatch(/PROTECTED_FRAGMENTS|isProtectedPath/);
    expect(taskPy).toContain('"check-commit"');
    const clai = read(path.join(SCRIPTS, "common/clai_delta.py"));
    expect(clai).toContain("PROTECTED_PATH_FRAGMENTS");
  });
});
