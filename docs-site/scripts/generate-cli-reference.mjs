import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(docsRoot, "..");
const cliBin = join(repoRoot, "packages", "cli", "bin", "omtre.js");
const outputPath = join(docsRoot, "reference", "_cli.generated.md");
const check = process.argv.includes("--check");

if (!existsSync(join(repoRoot, "packages", "cli", "dist", "cli", "index.js"))) {
  console.error("CLI build is missing. Run `pnpm build` at the repository root first.");
  process.exit(1);
}

const commands = [
  { label: "顶层命令", args: ["--help"] },
  { label: "init", args: ["init", "--help"] },
  { label: "update", args: ["update", "--help"] },
  { label: "upgrade", args: ["upgrade", "--help"] },
  { label: "uninstall", args: ["uninstall", "--help"] },
  { label: "ablate", args: ["ablate", "--help"] },
  { label: "restore", args: ["restore", "--help"] },
  { label: "migrate", args: ["migrate", "--help"] },
  { label: "platforms", args: ["platforms", "--help"] },
  { label: "workflow", args: ["workflow", "--help"] },
  { label: "run", args: ["run", "--help"] },
  { label: "mem", args: ["mem", "--help"] },
  { label: "channel", args: ["channel", "--help"] },
  { label: "channel create", args: ["channel", "create", "--help"] },
  { label: "channel spawn", args: ["channel", "spawn", "--help"] },
  { label: "channel send", args: ["channel", "send", "--help"] },
  { label: "channel wait", args: ["channel", "wait", "--help"] },
  { label: "channel messages", args: ["channel", "messages", "--help"] },
  { label: "channel run", args: ["channel", "run", "--help"] },
  { label: "channel kill", args: ["channel", "kill", "--help"] },
  { label: "channel rm", args: ["channel", "rm", "--help"] },
];

function helpFor(args) {
  try {
    return execFileSync(process.execPath, [cliBin, ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        NO_COLOR: "1",
        FORCE_COLOR: "0",
        CI: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    }).trimEnd();
  } catch (error) {
    console.error(`Failed to generate help for: omtre ${args.join(" ")}`);
    if (error.stderr) console.error(String(error.stderr).trim());
    process.exit(1);
  }
}

const cliPackage = JSON.parse(
  readFileSync(join(repoRoot, "packages", "cli", "package.json"), "utf8"),
);

const lines = [
  "## 自动生成的参数参考",
  "",
  `适用版本：omtre ${cliPackage.version}`,
  "",
  "> 本段由 `docs-site/scripts/generate-cli-reference.mjs` 从当前 CLI 帮助输出生成。",
  "> 不要手工编辑；修改命令参数后请重新生成并在 CI 中校验。",
  "",
];

for (const command of commands) {
  const help = helpFor(command.args);
  lines.push(`### ${command.label}`, "", "```text", help, "```", "");
}

const output = `${lines.join("\n").trimEnd()}\n`;

if (check) {
  const current = existsSync(outputPath) ? readFileSync(outputPath, "utf8") : "";
  if (current !== output) {
    console.error(
      "Generated CLI reference is stale. Run `node docs-site/scripts/generate-cli-reference.mjs` after rebuilding the CLI.",
    );
    process.exit(1);
  }
  console.log("CLI reference is up to date.");
} else {
  writeFileSync(outputPath, output, "utf8");
  console.log(`Generated ${outputPath}`);
}
