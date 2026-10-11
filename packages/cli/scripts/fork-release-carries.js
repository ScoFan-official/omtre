#!/usr/bin/env node
/**
 * Fork-only release check: does the ref being released from actually carry the
 * commits the ticket says it must?
 *
 * Lives in its own file rather than inside `release-preflight.js` on purpose:
 * `docs/fork-sync.md` counts an edit to upstream tooling as the fork delta
 * leaking, and new files are the zero-conflict surface this fork already uses
 * for its divergence (`common/frontier.py`, `common/verify.py`).
 *
 * Why the check exists: this fork cuts releases by hand (channel A), so nothing
 * verifies "cli-v<version> ships CLAI-8 / D5 / D8". The reconciliation is
 * reachability, which merge commits give for free and squash merges destroy —
 * a squash rewrites the branch SHAs away and the claim silently loses its ground.
 *
 * Usage:
 *   node packages/cli/scripts/fork-release-carries.js --ref origin/main --sha a,b,c
 * Exit 0 when every SHA is reachable from the ref, 1 otherwise (CI-failable).
 */
import { execFileSync } from "node:child_process";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

function fail(msg) {
  console.error(`${RED}x ${msg}${RESET}`);
  process.exit(1);
}

function flagValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

export function unreachable({ ref, shas, run = defaultRun }) {
  if (!ref || shas.length === 0) {
    return { ok: false, usage: true, missing: shas };
  }
  const missing = shas.filter((sha) => !run(ref, sha));
  return { ok: missing.length === 0, missing };
}

function defaultRun(ref, sha) {
  try {
    // No shell: an interpolating `git … ${ref}` answers "yes" to
    // `--ref "origin/main || echo x"` for a SHA that is not on main, which turns
    // a release gate that is supposed to fail closed into one that lies.
    execFileSync("git", ["merge-base", "--is-ancestor", sha, ref], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const argv = process.argv.slice(2);
const invokedDirectly = process.argv[1] && process.argv[1].includes("fork-release-carries");

if (invokedDirectly) {
  const ref = flagValue(argv, "--ref") ?? "";
  const shas = (flagValue(argv, "--sha") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const result = unreachable({ ref, shas });
  if (result.usage) fail("usage: fork-release-carries.js --ref <ref> --sha <sha>[,<sha>…]");
  if (!result.ok) {
    fail(
      `${result.missing.length} commit(s) not reachable from ${ref}:\n  ${result.missing.join(
        "\n  ",
      )}\nReleasing now would ship without them.`,
    );
  }
  console.log(`${GREEN}✓ ${shas.length} commit(s) reachable from ${ref}${RESET}`);
}
