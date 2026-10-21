#!/usr/bin/env node
/**
 * Remove the generated package assets after packing. They are copies of the
 * repository-level files and must not linger as untracked files in the
 * workspace.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_DIR = path.resolve(__dirname, "..");

for (const file of ["README.md", "LICENSE", "NOTICE"]) {
  fs.rmSync(path.join(CLI_DIR, file), { force: true });
}
fs.rmSync(path.join(CLI_DIR, "assets"), { recursive: true, force: true });
