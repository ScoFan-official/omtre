/**
 * `fork-release-carries` is the command that answers "does the ref I am about to
 * tag actually carry this work?" — so its own failure modes matter more than its
 * output format. Two things are pinned here: it reports every unreachable SHA
 * (a partial list is a green light for a release that ships without the work),
 * and it fails CLOSED on input git cannot resolve. The second one is not
 * hypothetical: the first version interpolated the ref into a shell string, so
 * `--ref "origin/main || echo x"` reported success for a SHA that was never on
 * main, and the release gate lied in the dangerous direction.
 */

import { describe, expect, it } from "vitest";

import { unreachable } from "../../scripts/fork-release-carries.js";

describe("fork-release-carries", () => {
  it("reports every unreachable sha, and fails closed on missing arguments", () => {
    const known = new Set(["aaa", "bbb"]);
    const fake = (ref: string, sha: string): boolean => ref === "origin/main" && known.has(sha);

    expect(unreachable({ ref: "origin/main", shas: ["aaa", "bbb"], run: fake })).toEqual({
      ok: true,
      missing: [],
    });
    expect(unreachable({ ref: "origin/main", shas: ["aaa", "zzz"], run: fake }).missing).toEqual([
      "zzz",
    ]);
    expect(unreachable({ ref: "", shas: ["aaa"], run: fake }).usage).toBe(true);
    expect(unreachable({ ref: "origin/main", shas: [], run: fake }).usage).toBe(true);
  });

  it("refuses a ref git cannot resolve instead of running it as a shell", () => {
    // `HEAD` is reachable from `HEAD` for real, so the only way this returns ok
    // is a shell splitting the argument and discarding the `|| echo x` tail.
    expect(unreachable({ ref: "HEAD || echo x", shas: ["HEAD"] }).ok).toBe(false);
    expect(unreachable({ ref: "HEAD; echo x", shas: ["HEAD"] }).ok).toBe(false);
    expect(unreachable({ ref: "HEAD", shas: ["HEAD"] }).ok).toBe(true);
  });
});
