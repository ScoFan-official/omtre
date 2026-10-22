#!/usr/bin/env node
/**
 * Copy the repository-level LICENSE and NOTICE into the core package before
 * packing so a separately published @omtre/core carries the same attribution
 * files as the CLI. `prepack` runs for both `pnpm pack` and `pnpm publish`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORE_DIR = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(CORE_DIR, "../..");

for (const file of ["LICENSE", "NOTICE"]) {
  fs.copyFileSync(path.join(REPO_ROOT, file), path.join(CORE_DIR, file));
}
