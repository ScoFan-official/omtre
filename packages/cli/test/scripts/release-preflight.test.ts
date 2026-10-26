import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
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

  it("#2 verify-packed-cli packs omtre with bundled @omtre/core and restores workspace link", () => {
    const res = runPreflight(["verify-packed-cli"], {
      GITHUB_REF: undefined,
      GITHUB_REF_NAME: undefined,
    });
    expect(res.status, `stderr:\n${res.stderr}`).toBe(0);
    expect(res.stdout).toContain("bundles @omtre/core");

    const stat = fs.lstatSync(CORE_LINK_PATH);
    expect(stat.isSymbolicLink()).toBe(true);
  }, 60_000);

  // The 1.0.0 release failed its post-publish verify because registry
  // replicas lagged. The retry only helps if the mismatch path throws
  // instead of calling fail() (which exits before the next attempt).
  it.skipIf(process.platform === "win32")(
    "#3 verify-npm retries while registry replicas catch up",
    () => {
      const cliPkg = JSON.parse(fs.readFileSync(CLI_PKG_PATH, "utf-8")) as {
        version: string;
      };
      const shimDir = fs.mkdtempSync(
        path.join(fs.realpathSync(os.tmpdir()), "npm-shim-"),
      );
      const counter = path.join(shimDir, "calls");
      const npmPath = path.join(shimDir, "npm");
      fs.writeFileSync(
        npmPath,
        [
          "#!/bin/sh",
          `count=$(cat "${counter}" 2>/dev/null || echo 0)`,
          "count=$((count + 1))",
          `echo "$count" > "${counter}"`,
          'if [ "$count" -le 2 ]; then',
          "  echo '\"0.0.0\"'",
          "  exit 0",
          "fi",
          `echo '"'${cliPkg.version}'"'`,
          "",
        ].join("\n"),
      );
      fs.chmodSync(npmPath, 0o755);
      try {
        const res = runPreflight(["verify-npm", "--package", "cli"], {
          PATH: `${shimDir}:${process.env.PATH ?? ""}`,
          OMTRE_PREFLIGHT_RETRY_MS: "0",
          GITHUB_REF: undefined,
          GITHUB_REF_NAME: undefined,
        });
        expect(res.status, `stderr:\n${res.stderr}`).toBe(0);
        expect(res.stdout).toContain(
          `omtre@${cliPkg.version} visible on npm tag "latest"`,
        );
        expect(Number(fs.readFileSync(counter, "utf-8"))).toBeGreaterThan(2);
      } finally {
        fs.rmSync(shimDir, { recursive: true, force: true });
      }
    },
    30_000,
  );
});
