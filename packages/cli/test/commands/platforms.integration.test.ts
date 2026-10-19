/**
 * Integration test for #396 — `omtre platforms [--json]`.
 *
 * Exposes which platforms are configured in a repo in a machine-readable
 * way, so downstream tooling doesn't have to hand-maintain marker-file
 * tables per platform. Spawns the real built CLI binary (`bin/omtre.js`)
 * since the subcommand is wired up in `src/cli/index.ts`, which has
 * import-time side effects that make direct unit import brittle.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CLI_BIN = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../bin/omtre.js",
);

function runCli(cwd: string, args: string[]) {
  return spawnSync(process.execPath, [CLI_BIN, ...args], {
    cwd,
    encoding: "utf-8",
  });
}

function writeTrackedPlatforms(
  cwd: string,
  relativePaths: string[],
): void {
  const omtreDir = path.join(cwd, ".omtre");
  fs.mkdirSync(omtreDir, { recursive: true });
  fs.writeFileSync(
    path.join(omtreDir, ".template-hashes.json"),
    JSON.stringify({
      __version: 2,
      hashes: Object.fromEntries(relativePaths.map((item) => [item, "hash"])),
    }),
  );
}

describe("omtre platforms (#396)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "omtre-platforms-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("--json reports configured platforms with id, displayName, configDir", () => {
    fs.mkdirSync(path.join(tmpDir, ".claude"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, ".cursor"), { recursive: true });
    writeTrackedPlatforms(tmpDir, [
      ".claude/commands/omt/continue.md",
      ".claude/settings.json",
      ".cursor/commands/omtre-continue.md",
      ".cursor/hooks.json",
    ]);

    const result = runCli(tmpDir, ["platforms", "--json"]);

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      platforms: { id: string; displayName: string; configDir: string }[];
    };
    const ids = parsed.platforms.map((p) => p.id).sort();
    expect(ids).toEqual(["claude-code", "cursor"]);

    const claude = parsed.platforms.find((p) => p.id === "claude-code");
    expect(claude).toEqual({
      id: "claude-code",
      displayName: "Claude Code",
      configDir: ".claude",
    });
  });

  it("--json reports an empty list when no platform is configured", () => {
    const result = runCli(tmpDir, ["platforms", "--json"]);

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as { platforms: unknown[] };
    expect(parsed.platforms).toEqual([]);
  });

  it("human output lists configured platforms without --json", () => {
    fs.mkdirSync(path.join(tmpDir, ".claude"), { recursive: true });
    writeTrackedPlatforms(tmpDir, [
      ".claude/commands/omt/continue.md",
      ".claude/settings.json",
    ]);

    const result = runCli(tmpDir, ["platforms"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Claude Code");
    expect(result.stdout).toContain(".claude");
  });
});
