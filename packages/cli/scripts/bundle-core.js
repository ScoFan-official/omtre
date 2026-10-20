#!/usr/bin/env node
/**
 * Bundle @omtre/core into packages/cli/node_modules/@omtre/core during `pnpm pack`
 * so the resulting omtre-*.tgz is self-contained and can be installed via
 * `npm install -g omtre-<ver>.tgz` without publishing @omtre/core to public npm.
 *
 * Usage:
 *   node scripts/bundle-core.js prepack
 *   node scripts/bundle-core.js postpack
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_DIR = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(CLI_DIR, "../..");
const CORE_DIR = path.join(REPO_ROOT, "packages/core");
const CORE_DIST = path.join(CORE_DIR, "dist");
const CORE_PKG_PATH = path.join(CORE_DIR, "package.json");
const TARGET_DIR = path.join(CLI_DIR, "node_modules/@omtre/core");

const PRESERVED_PKG_FIELDS = [
  "name",
  "version",
  "description",
  "type",
  "main",
  "types",
  "exports",
  "files",
  "sideEffects",
  "author",
  "license",
  "engines",
  "repository",
];

function fail(msg) {
  console.error(`bundle-core: ${msg}`);
  process.exit(1);
}

function prepack() {
  const entry = path.join(CORE_DIST, "index.js");
  if (!fs.existsSync(entry)) {
    fail(
      `missing ${entry}. Run "pnpm --filter @omtre/core build" (or "pnpm build") before packing.`,
    );
  }

  const rawCorePkg = JSON.parse(fs.readFileSync(CORE_PKG_PATH, "utf-8"));
  const sanitizedPkg = {};
  for (const key of PRESERVED_PKG_FIELDS) {
    if (rawCorePkg[key] !== undefined) {
      sanitizedPkg[key] = rawCorePkg[key];
    }
  }

  fs.rmSync(TARGET_DIR, { recursive: true, force: true });
  fs.mkdirSync(TARGET_DIR, { recursive: true });
  fs.cpSync(CORE_DIST, path.join(TARGET_DIR, "dist"), { recursive: true });

  const coreLicense = path.join(CORE_DIR, "LICENSE");
  const rootLicense = path.join(REPO_ROOT, "LICENSE");
  if (fs.existsSync(coreLicense)) {
    fs.copyFileSync(coreLicense, path.join(TARGET_DIR, "LICENSE"));
  } else if (fs.existsSync(rootLicense)) {
    fs.copyFileSync(rootLicense, path.join(TARGET_DIR, "LICENSE"));
  }

  fs.writeFileSync(
    path.join(TARGET_DIR, "package.json"),
    JSON.stringify(sanitizedPkg, null, 2) + "\n",
    "utf-8",
  );
}

function postpack() {
  fs.rmSync(TARGET_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(TARGET_DIR), { recursive: true });
  fs.symlinkSync(
    CORE_DIR,
    TARGET_DIR,
    process.platform === "win32" ? "junction" : "dir",
  );
}

const [mode] = process.argv.slice(2);
if (mode === "prepack") {
  prepack();
} else if (mode === "postpack") {
  postpack();
} else {
  fail(`expected "prepack" or "postpack", got "${mode ?? ""}"`);
}
