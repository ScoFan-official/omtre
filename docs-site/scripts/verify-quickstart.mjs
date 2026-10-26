import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(docsRoot, "..");
const cliBin = join(repoRoot, "packages", "cli", "bin", "omtre.js");

function findPython() {
  for (const candidate of ["python3", "python"]) {
    const result = spawnSync(candidate, ["--version"], {
      encoding: "utf8",
      stdio: "ignore",
    });
    if (result.status === 0) return candidate;
  }
  throw new Error("Python 3.9+ is required to verify the quickstart scripts.");
}

function run(command, args, cwd, env = {}) {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    if (error.stdout) process.stderr.write(String(error.stdout));
    if (error.stderr) process.stderr.write(String(error.stderr));
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

if (!existsSync(join(repoRoot, "packages", "cli", "dist", "cli", "index.js"))) {
  console.error("CLI build is missing. Run `pnpm build` first.");
  process.exit(1);
}

const python = findPython();
const temp = mkdtempSync(join(tmpdir(), "omtre-docs-quickstart-"));
const env = {
  OMTRE_HOOKS: "0",
  OMTRE_WRITER: "docs-verifier",
  NO_COLOR: "1",
};

try {
  run("git", ["init", "-b", "main"], temp);
  run("git", ["config", "user.email", "docs-verifier@example.com"], temp);
  run("git", ["config", "user.name", "Docs Verifier"], temp);

  run(
    process.execPath,
    [cliBin, "init", "-u", "docs-verifier", "--claude", "--yes"],
    temp,
    env,
  );

  for (const path of [
    ".omtre/workflow.md",
    ".omtre/scripts/task.py",
    ".omtre/scripts/get_context.py",
    ".omtre/workspace/docs-verifier",
    ".claude",
  ]) {
    if (!existsSync(join(temp, path))) {
      throw new Error(`Initialization did not create ${path}`);
    }
  }

  run("git", ["add", "-A"], temp);
  run("git", ["commit", "-m", "chore: seed initialized project"], temp);

  run(
    python,
    [
      ".omtre/scripts/task.py",
      "create",
      "Docs smoke task",
      "--slug",
      "docs-smoke",
      "--description",
      "Verify docs quickstart task lifecycle",
      "--no-start",
    ],
    temp,
    env,
  );

  const tasks = readdirSync(join(temp, ".omtre", "tasks")).filter((entry) =>
    entry.includes("docs-smoke"),
  );
  if (tasks.length !== 1) throw new Error("Expected exactly one docs-smoke task.");
  const taskDir = `.omtre/tasks/${tasks[0]}`;

  run(
    python,
    [".omtre/scripts/task.py", "add-verify", taskDir, 'node -e "process.exit(0)"'],
    temp,
    env,
  );
  run(
    python,
    [".omtre/scripts/task.py", "run-verify", taskDir],
    temp,
    env,
  );
  run(
    python,
    [
      ".omtre/scripts/task.py",
      "archive",
      taskDir,
      "--no-commit",
      "--skip-branch-validation",
    ],
    temp,
    env,
  );

  const archiveRoot = join(temp, ".omtre", "tasks", "archive");
  if (!existsSync(archiveRoot)) {
    throw new Error("Archive directory was not created.");
  }
  const archives = readdirSync(archiveRoot, { recursive: true });
  if (!archives.some((entry) => String(entry).includes("docs-smoke"))) {
    throw new Error("docs-smoke task was not moved into the archive.");
  }

  console.log("Quickstart verification passed: init, task, verify, and archive.");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
