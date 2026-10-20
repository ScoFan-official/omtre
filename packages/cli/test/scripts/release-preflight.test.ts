import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const PREFLIGHT_SCRIPT = path.join(
  REPO_ROOT,
  "packages",
  "cli",
  "scripts",
  "release-preflight.js",
);
const CLI_PKG_PATH = path.join(REPO_ROOT, "packages", "cli", "package.json");
const CORE_LINK_PATH = path.join(
  REPO_ROOT,
  "packages",
  "cli",
  "node_modules",
  "@omtre",
  "core",
);

function runPreflight(
  args: string[],
  envOverrides: Record<string, string | undefined> = {},
): SpawnSyncReturns<string> {
  const env: NodeJS.ProcessEnv = Object.fromEntries(
    Object.entries({ ...process.env, ...envOverrides }).filter(
      ([, v]) => v !== undefined,
    ),
  );
  return spawnSync(process.execPath, [PREFLIGHT_SCRIPT, ...args], {
    cwd: REPO_ROOT,
    env,
    encoding: "utf-8",
  });
}

describe("packages/cli/scripts/release-preflight.js", () => {
  it("#1 check-versions passes and accepts both v<ver> and cli-v<ver> tags", () => {
    const cliPkg = JSON.parse(fs.readFileSync(CLI_PKG_PATH, "utf-8")) as {
      version: string;
    };

    const baseRes = runPreflight(["check-versions"], {
      GITHUB_REF: undefined,
      GITHUB_REF_NAME: undefined,
    });
    expect(baseRes.status, `stderr:\n${baseRes.stderr}`).toBe(0);
    expect(baseRes.stdout).toContain(
      `@omtre/core@${cliPkg.version} = omtre@${cliPkg.version}`,
    );

    const cliTagRes = runPreflight(["check-versions", "--require-tag"], {
      GITHUB_REF_NAME: `cli-v${cliPkg.version}`,
      GITHUB_REF: undefined,
    });
    expect(cliTagRes.status, `stderr:\n${cliTagRes.stderr}`).toBe(0);

    const vTagRes = runPreflight(["check-versions", "--require-tag"], {
      GITHUB_REF_NAME: `v${cliPkg.version}`,
      GITHUB_REF: undefined,
    });
    expect(vTagRes.status, `stderr:\n${vTagRes.stderr}`).toBe(0);

    const mismatchRes = runPreflight(["check-versions", "--require-tag"], {
      GITHUB_REF_NAME: "cli-v0.0.0-mismatch.1",
      GITHUB_REF: undefined,
    });
    expect(mismatchRes.status).toBe(1);
  });

  it(
    "#2 verify-packed-cli packs omtre with bundled @omtre/core and restores workspace link",
    () => {
      const res = runPreflight(["verify-packed-cli"], {
        GITHUB_REF: undefined,
        GITHUB_REF_NAME: undefined,
      });
      expect(res.status, `stderr:\n${res.stderr}`).toBe(0);
      expect(res.stdout).toContain("bundles @omtre/core");

      const stat = fs.lstatSync(CORE_LINK_PATH);
      expect(stat.isSymbolicLink()).toBe(true);
    },
    60_000,
  );
});
