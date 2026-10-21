#!/usr/bin/env node
/**
 * Repository-wide legacy identifier gate (R8).
 *
 * Scans managed source, templates, tests, skills, marketplace, scripts, CI,
 * and docs for forbidden legacy identifiers and bare upstream product names,
 * enforcing a two-tier explicit allowlist:
 *   1. Permanent allowlist (copyright/license, upstream attribution URLs and
 *      explicit `omtre:upstream-attribution` blocks, catalog, historical
 *      changelogs, historical task records/journals, historical 0.3.x-0.6.x
 *      migration manifests + explicitly marked historical manifest test lines,
 *      this script, and `omtre migrate` implementation/tests).
 *   2. Pre-bootstrap temporary allowlist (active ONLY when `<root>/.omtre`
 *      does not yet exist; automatically deactivates once `.omtre/` is created).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_REPO_ROOT = path.resolve(__dirname, "..");

/**
 * Forbidden legacy patterns per PRD.
 * Order matters: more specific tokens appear before prefix tokens so the full
 * matched token is reported.
 */
export const FORBIDDEN_TOKEN_SOURCE = [
  "~\\/\\.trellis",
  "\\.trellis",
  "TRELLIS:COPILOT-GUIDANCE",
  "TRELLIS:START",
  "TRELLIS:END",
  "TRELLIS_[A-Za-z0-9_]*",
  "trellis-hook-injected",
  "trellis-emitted",
  "trellis-[A-Za-z0-9_-]*",
  "\\/trellis:[A-Za-z0-9_-]*",
  "oh-my-trellis",
  "@mindfoldhq\\/trellis(?:-core)?",
  // Bare product names. Specific tokens above win so the reported match is the
  // most useful one; these catch leftover prose, headings, and ASCII art.
  "\\bTrellis\\b",
  "\\bTRELLIS\\b",
  "\\btrellis\\b",
].join("|");

export const FORBIDDEN_REGEX = new RegExp(`(${FORBIDDEN_TOKEN_SOURCE})`, "g");

/**
 * Upstream attribution URL/slug pattern (`mindfold-ai/trellis`).
 * Stripped from a line copy prior to matching FORBIDDEN_REGEX so that a line
 * whose only match is part of a `mindfold-ai/trellis` attribution URL is
 * allowed, while any other forbidden token on the same line is still caught.
 */
const ATTRIBUTION_URL_REGEX =
  /https?:\/\/[^\s)"'>\]]*mindfold-ai\/trellis[^\s)"'>\]]*|\bmindfold-ai\/trellis(?:-[A-Za-z0-9_.-]+)?/gi;

/**
 * Date-prefixed historical task directory identifier (e.g. `01-22-trellis-agents-gui`).
 * Preserved by `omtre migrate` so historical task directory names and references
 * inside `.omtre/` remain resolvable without masking other forbidden tokens.
 */
export const HISTORICAL_TASK_SLUG_REGEX =
  /\b\d{2}-\d{2}-[A-Za-z0-9_-]*trellis-[A-Za-z0-9_-]*/gi;

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  "coverage",
  ".next",
  ".turbo",
]);

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".gif",
  ".jpg",
  ".jpeg",
  ".webp",
  ".ico",
  ".svg",
  ".pdf",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".zip",
  ".tgz",
  ".gz",
  ".tar",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".wasm",
  ".pyc",
]);

const PERMANENT_EXACT_FILES = new Set([
  "COPYRIGHT",
  "LICENSE",
  "NOTICE",
  "docs/upstream.md",
  "docs/changelog-fork.md",
  "docs/pack-changelog.md",
  "scripts/check-legacy-names.mjs",
  "packages/cli/test/scripts/check-legacy-names.test.ts",
  "packages/cli/src/commands/migrate.ts",
  // Generated copies of the root README/LICENSE/NOTICE during `pnpm pack`;
  // postpack removes them, but a concurrent gate scan may see them mid-pack.
  "packages/cli/README.md",
  "packages/cli/LICENSE",
  "packages/cli/NOTICE",
  // Active planning map: decisions and historical notes, not product surface.
  ".omtre/tasks/10-19-omtre-standalone/map.md",
]);

const PERMANENT_DIR_PREFIXES = [
  "docs/pending/",
  "catalog/",
  "drafts/", // Historical v0.5.0 release announcement drafts
  "packages/cli/src/commands/migrate/",
  ".omtre/tasks/archive/", // Historical task records
  ".omtre/workspace/", // Historical journals
];

const HISTORICAL_MANIFEST_TEST_FILES = new Set([
  "packages/cli/test/regression.test.ts",
  "packages/cli/test/commands/update.integration.test.ts",
]);

const PRE_BOOTSTRAP_PLATFORM_DIRS = [
  ".trellis",
  ".claude",
  ".agents",
  ".codex",
  ".cursor",
  ".devin",
  ".omp",
  ".opencode",
  ".pi",
];

const PRE_BOOTSTRAP_EXACT_FILES = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  ".gitignore",
  ".gitattributes",
  "pnpm-lock.yaml",
]);

/**
 * Normalize a relative path to POSIX forward slashes without leading `./`.
 */
export function normalizeRelPath(relPath) {
  return relPath.replace(/\\/g, "/").replace(/^\.\//, "");
}

/**
 * Tier-1 permanent path allowlist check.
 */
export function isPermanentlyAllowedPath(relPath) {
  const norm = normalizeRelPath(relPath);
  if (PERMANENT_EXACT_FILES.has(norm)) return true;

  for (const prefix of PERMANENT_DIR_PREFIXES) {
    if (norm === prefix.slice(0, -1) || norm.startsWith(prefix)) {
      return true;
    }
  }

  // packages/*/CHANGELOG.md
  if (/^packages\/[^/]+\/CHANGELOG\.md$/.test(norm)) {
    return true;
  }

  // packages/cli/src/migrations/manifests/*.json
  if (/^packages\/cli\/src\/migrations\/manifests\/[^/]+\.json$/.test(norm)) {
    return true;
  }

  // packages/cli/test/commands/migrate*
  if (/^packages\/cli\/test\/commands\/migrate/.test(norm)) {
    return true;
  }

  return false;
}

/**
 * Tier-2 pre-bootstrap temporary path allowlist check.
 * Active ONLY when `<root>/.omtre` does not exist.
 */
export function isPreBootstrapAllowedPath(relPath, isBootstrapped) {
  if (isBootstrapped) return false;
  const norm = normalizeRelPath(relPath);

  if (PRE_BOOTSTRAP_EXACT_FILES.has(norm)) return true;

  for (const dir of PRE_BOOTSTRAP_PLATFORM_DIRS) {
    if (norm === dir || norm.startsWith(`${dir}/`)) {
      return true;
    }
  }

  return false;
}

/**
 * Strip allowed `mindfold-ai/trellis` attribution URLs from a line before
 * checking for forbidden legacy tokens.
 */
export function stripAttributionUrls(line) {
  return line.replace(ATTRIBUTION_URL_REGEX, "");
}

/**
 * Scan a single file's content and return any violations found.
 */
export function scanFileContent(relPath, content, { isBootstrapped }) {
  const norm = normalizeRelPath(relPath);
  const violations = [];
  const allowHistoricalManifestMarkers =
    HISTORICAL_MANIFEST_TEST_FILES.has(norm);
  const allowPreBootstrapMarkers =
    !isBootstrapped && norm === "packages/cli/test/regression.test.ts";

  let inHistoricalManifestBlock = false;
  let inPreBootstrapBlock = false;
  let inAttributionBlock = false;

  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Explicit lineage/attribution blocks are exempt: they are the one place
    // where the upstream name is allowed to appear in an active surface.
    if (line.includes("omtre:upstream-attribution:start")) {
      inAttributionBlock = true;
      continue;
    }
    if (line.includes("omtre:upstream-attribution:end")) {
      inAttributionBlock = false;
      continue;
    }
    if (inAttributionBlock) {
      continue;
    }

    if (allowHistoricalManifestMarkers) {
      if (line.includes("historical-manifest-fixture:start")) {
        inHistoricalManifestBlock = true;
        continue;
      }
      if (line.includes("historical-manifest-fixture:end")) {
        inHistoricalManifestBlock = false;
        continue;
      }
      if (
        inHistoricalManifestBlock ||
        line.includes("historical-manifest-fixture")
      ) {
        continue;
      }
    }

    if (allowPreBootstrapMarkers) {
      if (line.includes("pre-bootstrap-exempt:start")) {
        inPreBootstrapBlock = true;
        continue;
      }
      if (line.includes("pre-bootstrap-exempt:end")) {
        inPreBootstrapBlock = false;
        continue;
      }
      if (inPreBootstrapBlock || line.includes("pre-bootstrap-exempt")) {
        continue;
      }
    }

    let sanitizedLine = stripAttributionUrls(line);
    if (norm.startsWith(".omtre/")) {
      sanitizedLine = sanitizedLine.replace(HISTORICAL_TASK_SLUG_REGEX, "");
    }
    FORBIDDEN_REGEX.lastIndex = 0;
    let match;
    while ((match = FORBIDDEN_REGEX.exec(sanitizedLine)) !== null) {
      violations.push({
        file: norm,
        line: lineNumber,
        match: match[0],
        text: line.trim(),
      });
    }
  }

  return violations;
}

function isBinaryFile(filePath, buffer) {
  const ext = path.extname(filePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return true;
  const sampleLen = Math.min(buffer.length, 4096);
  for (let i = 0; i < sampleLen; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

/**
 * Walk and scan a repository root (or specific target paths under it).
 */
export function checkLegacyNames({
  rootDir = DEFAULT_REPO_ROOT,
  targets = [],
} = {}) {
  const resolvedRoot = path.resolve(rootDir);
  const isBootstrapped = fs.existsSync(path.join(resolvedRoot, ".omtre"));
  const violations = [];
  let scannedFiles = 0;

  function visit(absPath, relPath) {
    const normRel = normalizeRelPath(relPath);

    if (normRel) {
      if (normRel.split("/").some((part) => IGNORED_DIRS.has(part))) return;
      if (isPermanentlyAllowedPath(normRel)) return;
      if (isPreBootstrapAllowedPath(normRel, isBootstrapped)) return;
    }

    let stat;
    try {
      stat = fs.lstatSync(absPath);
    } catch {
      return;
    }

    if (stat.isSymbolicLink()) return;

    if (stat.isDirectory()) {
      const entries = fs.readdirSync(absPath, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        const childRel = normRel ? `${normRel}/${entry.name}` : entry.name;
        visit(path.join(absPath, entry.name), childRel);
      }
      return;
    }

    if (!stat.isFile()) return;

    const buffer = fs.readFileSync(absPath);
    if (isBinaryFile(absPath, buffer)) return;

    scannedFiles += 1;
    const content = buffer.toString("utf-8");
    const fileViolations = scanFileContent(normRel, content, {
      isBootstrapped,
    });
    const pathForCheck = normRel.startsWith(".omtre/tasks/")
      ? normRel.replace(HISTORICAL_TASK_SLUG_REGEX, "")
      : normRel;
    FORBIDDEN_REGEX.lastIndex = 0;
    const pathMatch = FORBIDDEN_REGEX.exec(pathForCheck);
    if (pathMatch) {
      fileViolations.push({
        file: normRel,
        line: 1,
        match: pathMatch[0],
        text: `(legacy path: ${normRel})`,
      });
    }
    violations.push(...fileViolations);
  }

  if (targets.length > 0) {
    for (const target of targets) {
      const absTarget = path.resolve(resolvedRoot, target);
      const relTarget = path.relative(resolvedRoot, absTarget);
      visit(absTarget, relTarget);
    }
  } else {
    visit(resolvedRoot, "");
  }

  return {
    ok: violations.length === 0,
    isBootstrapped,
    scannedFiles,
    violations,
  };
}

function parseCliArgs(argv) {
  let rootDir = DEFAULT_REPO_ROOT;
  const targets = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--root" && i + 1 < argv.length) {
      rootDir = argv[++i];
    } else if (arg.startsWith("--root=")) {
      rootDir = arg.slice("--root=".length);
    } else {
      targets.push(arg);
    }
  }

  return { rootDir, targets };
}

function main() {
  const { rootDir, targets } = parseCliArgs(process.argv.slice(2));
  const result = checkLegacyNames({ rootDir, targets });

  if (!result.ok) {
    for (const v of result.violations) {
      console.error(`${v.file}:${v.line}: ${v.match} (${v.text})`);
    }
    console.error(
      `\nLegacy name check failed: ${result.violations.length} violation(s) found across ${result.scannedFiles} scanned file(s).`,
    );
    process.exit(1);
  }

  const modeLabel = result.isBootstrapped
    ? "post-bootstrap (tier-2 temporary allowlist inactive)"
    : "pre-bootstrap (tier-2 temporary allowlist active until .omtre/ exists)";
  console.log(
    `Legacy name check passed: 0 violations in ${result.scannedFiles} scanned file(s) [mode: ${modeLabel}].`,
  );
}

if (path.resolve(process.argv[1] ?? "") === __filename) {
  main();
}
