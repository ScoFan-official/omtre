#!/usr/bin/env node
/**
 * Copy the repository-level README, LICENSE, and NOTICE into the CLI package
 * before packing. `pnpm pack` does not run `prepublishOnly`, so the GitHub
 * Release tarball needs this step to carry the same attribution files as the
 * npm package.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_DIR = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(CLI_DIR, "../..");

for (const file of ["README.md", "LICENSE", "NOTICE"]) {
  fs.copyFileSync(path.join(REPO_ROOT, file), path.join(CLI_DIR, file));
}
