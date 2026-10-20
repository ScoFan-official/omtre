import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const SCRIPT_PATH = path.join(REPO_ROOT, "scripts", "check-legacy-names.mjs");

// Construct legacy tokens dynamically so even if this test file were scanned
// without exemption, it does not embed literal pre-rename tokens.
const LEGACY = ["trel", "lis"].join("");
const LEGACY_UPPER = ["TREL", "LIS"].join("");
const DOT_LEGACY = `.${LEGACY}`;
const HOME_DOT_LEGACY = `~/${DOT_LEGACY}`;
const ENV_LEGACY = `${LEGACY_UPPER}_CONTEXT_ID`;
const BLOCK_START = `${LEGACY_UPPER}:START`;
const BLOCK_END = `${LEGACY_UPPER}:END`;
const COPILOT_GUIDANCE = `${LEGACY_UPPER}:COPILOT-GUIDANCE`;
const HOOK_INJECTED = `${LEGACY}-hook-injected`;
const EMITTED = `${LEGACY}-emitted`;
const SKILL_PREFIX = `${LEGACY}-check`;
const SLASH_CMD = `/${LEGACY}:continue`;
const OH_MY_LEGACY = `oh-my-${LEGACY}`;
const NPM_SCOPE_LEGACY = `@mindfoldhq/${LEGACY}`;

function runGate(
  rootDir: string,
  extraArgs: string[] = [],
): SpawnSyncReturns<string> {
  return spawnSync(
    process.execPath,
    [SCRIPT_PATH, "--root", rootDir, ...extraArgs],
    {
      cwd: REPO_ROOT,
      encoding: "utf-8",
    },
  );
}

function writeFile(rootDir: string, relPath: string, content: string): void {
  const fullPath = path.join(rootDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf-8");
}

describe("scripts/check-legacy-names.mjs", () => {
  const tempDirs: string[] = [];

  function makeTempRoot(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omtre-legacy-gate-"));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("passes repo-wide scan on the repository with exit code 0", () => {
    const res = runGate(REPO_ROOT);
    expect(res.status, `stderr:\n${res.stderr}`).toBe(0);
    expect(res.stdout).toContain("Legacy name check passed: 0 violations");
    expect(res.stdout).toContain(
      "mode: post-bootstrap (tier-2 temporary allowlist inactive)",
    );
  });

  it("fails with exit code 1 and prints <file>:<line>: <match> when forbidden tokens are injected into scanned directories", () => {
    const root = makeTempRoot();
    writeFile(
      root,
      "packages/cli/src/sample.ts",
      [
        "export const ok = '.omtre';",
        `export const badDir = '${DOT_LEGACY}';`,
        `export const badHome = '${HOME_DOT_LEGACY}';`,
        `export const badEnv = '${ENV_LEGACY}';`,
        `// <!-- ${BLOCK_START} -->`,
        `// <!-- ${BLOCK_END} -->`,
        `// <!-- ${COPILOT_GUIDANCE} -->`,
        `// ${HOOK_INJECTED}`,
        `// ${EMITTED}`,
        `export const badSkill = '${SKILL_PREFIX}';`,
        `export const badCmd = '${SLASH_CMD}';`,
        `export const badBin = '${OH_MY_LEGACY}';`,
        `export const badPkg = '${NPM_SCOPE_LEGACY}';`,
      ].join("\n") + "\n",
    );

    const res = runGate(root);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(`packages/cli/src/sample.ts:2: ${DOT_LEGACY}`);
    expect(res.stderr).toContain(
      `packages/cli/src/sample.ts:3: ${HOME_DOT_LEGACY}`,
    );
    expect(res.stderr).toContain(`packages/cli/src/sample.ts:4: ${ENV_LEGACY}`);
    expect(res.stderr).toContain(
      `packages/cli/src/sample.ts:5: ${BLOCK_START}`,
    );
    expect(res.stderr).toContain(`packages/cli/src/sample.ts:6: ${BLOCK_END}`);
    expect(res.stderr).toContain(
      `packages/cli/src/sample.ts:7: ${COPILOT_GUIDANCE}`,
    );
    expect(res.stderr).toContain(
      `packages/cli/src/sample.ts:8: ${HOOK_INJECTED}`,
    );
    expect(res.stderr).toContain(`packages/cli/src/sample.ts:9: ${EMITTED}`);
    expect(res.stderr).toContain(
      `packages/cli/src/sample.ts:10: ${SKILL_PREFIX}`,
    );
    expect(res.stderr).toContain(
      `packages/cli/src/sample.ts:11: ${SLASH_CMD}`,
    );
    expect(res.stderr).toContain(
      `packages/cli/src/sample.ts:12: ${OH_MY_LEGACY}`,
    );
    expect(res.stderr).toContain(
      `packages/cli/src/sample.ts:13: ${NPM_SCOPE_LEGACY}`,
    );
  });

  it("auto-expires tier-2 pre-bootstrap exemptions as soon as .omtre/ exists at root", () => {
    const root = makeTempRoot();
    writeFile(root, "AGENTS.md", `<!-- ${BLOCK_START} -->\n${DOT_LEGACY}/\n`);
    writeFile(
      root,
      ".claude/commands/legacy.md",
      `Run ${SLASH_CMD} with ${ENV_LEGACY}\n`,
    );
    writeFile(root, `${DOT_LEGACY}/config.yaml`, `dir: ${DOT_LEGACY}\n`);
    writeFile(
      root,
      "packages/cli/test/regression.test.ts",
      `const x = "${DOT_LEGACY}"; // pre-bootstrap-exempt\n`,
    );

    // Pre-bootstrap (no .omtre/ directory): tier-2 exemptions are active
    const preRes = runGate(root);
    expect(preRes.status, `stderr:\n${preRes.stderr}`).toBe(0);

    // Post-bootstrap (.omtre/ directory exists): tier-2 exemptions deactivate
    fs.mkdirSync(path.join(root, ".omtre"), { recursive: true });
    const postRes = runGate(root);
    expect(postRes.status).toBe(1);
    expect(postRes.stderr).toContain(`AGENTS.md:1: ${BLOCK_START}`);
    expect(postRes.stderr).toContain(`AGENTS.md:2: ${DOT_LEGACY}`);
    expect(postRes.stderr).toContain(
      `.claude/commands/legacy.md:1: ${ENV_LEGACY}`,
    );
    expect(postRes.stderr).toContain(
      `${DOT_LEGACY}/config.yaml:1: ${DOT_LEGACY}`,
    );
    expect(postRes.stderr).toContain(
      `packages/cli/test/regression.test.ts:1: ${DOT_LEGACY}`,
    );
  });

  it("preserves tier-1 permanent exemptions even when .omtre/ exists, while catching mixed lines", () => {
    const root = makeTempRoot();
    fs.mkdirSync(path.join(root, ".omtre"), { recursive: true });

    writeFile(root, "COPYRIGHT", `Original ${DOT_LEGACY} copyright\n`);
    writeFile(root, "LICENSE", `AGPL ${DOT_LEGACY}\n`);
    writeFile(root, "docs/fork-sync.md", `Upstream uses ${DOT_LEGACY}\n`);
    writeFile(root, "docs/pending/sample.patch", `+ ${DOT_LEGACY}/config.yaml\n`);
    writeFile(root, "catalog/pack/SKILL.md", `name: ${SKILL_PREFIX}\n`);
    writeFile(root, "CHANGELOG.md", `- Renamed ${DOT_LEGACY}\n`);
    writeFile(root, "CHANGELOG.pack.md", `- Released ${OH_MY_LEGACY}\n`);
    writeFile(
      root,
      "packages/cli/src/migrations/manifests/0.5.0.json",
      `{"from": "${DOT_LEGACY}/scripts/a.sh"}\n`,
    );
    writeFile(
      root,
      "packages/cli/src/commands/migrate/index.ts",
      `export const SOURCE_DIR = "${DOT_LEGACY}";\n`,
    );
    writeFile(
      root,
      "packages/cli/test/regression.test.ts",
      `expect(m.from).toBe("${DOT_LEGACY}/config.yaml"); // historical-manifest-fixture\n`,
    );
    writeFile(
      root,
      "README.md",
      `Forked from [mindfold-ai/${LEGACY}](https://github.com/mindfold-ai/${LEGACY}).\n`,
    );

    const passRes = runGate(root);
    expect(passRes.status, `stderr:\n${passRes.stderr}`).toBe(0);

    // If a line mixes a mindfold-ai/trellis URL with another forbidden token,
    // the non-URL token on that line must still be caught!
    writeFile(
      root,
      "README.md",
      `Forked from https://github.com/mindfold-ai/${LEGACY} using ${DOT_LEGACY}/config.yaml\n`,
    );
    const failRes = runGate(root);
    expect(failRes.status).toBe(1);
    expect(failRes.stderr).toContain(`README.md:1: ${DOT_LEGACY}`);
  });

  it("allows historical task directory slugs under .omtre/tasks/ while still scanning their file contents", () => {
    const root = makeTempRoot();
    const histSlug = `01-22-${LEGACY}-agents-gui`;
    writeFile(
      root,
      `.omtre/tasks/archive/2026-01/${histSlug}/prd.md`,
      `# Historical task ${histSlug}\nClean content under .omtre/\n`,
    );

    const passRes = runGate(root);
    expect(passRes.status, `stderr:\n${passRes.stderr}`).toBe(0);

    // Forbidden tokens inside .omtre/tasks/ file content must still be caught
    writeFile(
      root,
      `.omtre/tasks/archive/2026-01/${histSlug}/prd.md`,
      `# Historical task ${histSlug}\nLeaked ${DOT_LEGACY}/config.yaml and ${ENV_LEGACY}\n`,
    );
    const failRes = runGate(root);
    expect(failRes.status).toBe(1);
    expect(failRes.stderr).toContain(
      `.omtre/tasks/archive/2026-01/${histSlug}/prd.md:2: ${DOT_LEGACY}`,
    );
    expect(failRes.stderr).toContain(
      `.omtre/tasks/archive/2026-01/${histSlug}/prd.md:2: ${ENV_LEGACY}`,
    );
  });
});
