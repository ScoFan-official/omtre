#!/usr/bin/env node
/**
 * Remove the generated LICENSE and NOTICE copies after packing. They are
 * repository-level files and must not linger as untracked files.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORE_DIR = path.resolve(__dirname, "..");

for (const file of ["LICENSE", "NOTICE"]) {
  fs.rmSync(path.join(CORE_DIR, file), { force: true });
}
