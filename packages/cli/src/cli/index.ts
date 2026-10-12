import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { init } from "../commands/init.js";
import { update } from "../commands/update.js";
import { upgrade } from "../commands/upgrade.js";
import { uninstall } from "../commands/uninstall.js";
import { ablate, restore } from "../commands/ablate.js";
import { runMem } from "../commands/mem.js";
import {
  runWorkflowCommand,
  WorkflowCommandError,
} from "../commands/workflow.js";
import {
  runCommand as runLoopCommand,
  runTicketCommand,
} from "../commands/run.js";
import { listProviders } from "../commands/channel/adapters/index.js";
import { registerChannelCommand } from "../commands/channel/index.js";
import { DIR_NAMES } from "../constants/paths.js";
import { PACKAGE_NAME, VERSION } from "../constants/version.js";
import { compareOhmyVersions } from "../utils/compare-versions.js";
import { getConfiguredPlatforms } from "../configurators/index.js";
import { AI_TOOLS } from "../types/ai-tools.js";

// Re-export for backwards compatibility (consumers should prefer constants/version.js)
export { VERSION, PACKAGE_NAME };

/**
 * Check if a Trellis update is available (compare project version with CLI version)
 */
function checkForUpdates(cwd: string): void {
  const versionFile = path.join(cwd, DIR_NAMES.WORKFLOW, ".version");

  if (!fs.existsSync(versionFile)) return;

  const projectVersion = fs.readFileSync(versionFile, "utf-8").trim();
  const cliVersion = VERSION;
  // [oh-my] fork-aware comparison: `X.Y.Z-ohmy.N` builds rank >= `X.Y.Z`.
  const comparison = compareOhmyVersions(cliVersion, projectVersion);

  if (comparison > 0) {
    // CLI is newer than project - update available
    console.log(
      chalk.yellow(
        `\n⚠️  Trellis update available: ${projectVersion} → ${cliVersion}`,
      ),
    );
    console.log(chalk.gray(`   Run: trellis update\n`));
  } else if (comparison < 0) {
    // CLI is older than project - CLI needs updating
    console.log(
      chalk.yellow(
        `\n⚠️  Your CLI (${cliVersion}) is older than project (${projectVersion})`,
      ),
    );
    console.log(chalk.gray(`   Run: trellis upgrade\n`));
  }
}

// Check for updates at CLI startup (only if .trellis exists)
const cwd = process.cwd();
if (fs.existsSync(path.join(cwd, DIR_NAMES.WORKFLOW))) {
  checkForUpdates(cwd);
}

const program = new Command();

program
  .name("trellis")
  .description(
    "AI-assisted development workflow framework for Cursor, Claude Code and more",
  )
  .version(VERSION, "-v, --version", "output the version number");

program
  .command("init")
  .description("Initialize trellis in the current project")
  .option("--cursor", "Include Cursor commands")
  .option("--claude", "Include Claude Code commands")
  .option("--opencode", "Include OpenCode commands")
  .option("--codex", "Include Codex skills")
  .option("--kilo", "Include Kilo CLI commands")
  .option("--kiro", "Include Kiro Code skills")
  .option("--gemini", "Include Gemini CLI commands")
  .option("--antigravity", "Include Antigravity workflows")
  .option("--devin", "Include Devin workflows")
  .option("--windsurf", "Deprecated alias for --devin (Windsurf was renamed)")
  .option("--qoder", "Include Qoder commands")
  .option("--codebuddy", "Include CodeBuddy commands")
  .option("--copilot", "Include GitHub Copilot hooks")
  .option("--droid", "Include Factory Droid commands")
  .option("--dsh", "Include DeepSeek Harness (dsh) skills")
  .option("--pi", "Include Pi Agent extension assets")
  .option("--reasonix", "Include Reasonix skills")
  .option("--zcode", "Include ZCode commands")
  .option("--omp", "Include Oh My Pi extension assets")
  .option("--trae", "Include Trae IDE commands")
  .option("--grok", "Include Grok Build skills and agents")
  .option("--kimi", "Include Kimi Code skills")
  .option("--snow", "Include Snow CLI skills and commands")
  .option(
    "--with-statusline",
    "Install the Trellis statusLine for Claude Code (off by default)",
  )
  .option("-y, --yes", "Skip prompts and use defaults")
  .option(
    "-u, --user <name>",
    "Initialize developer identity with specified name",
  )
  .option("-f, --force", "Overwrite existing files without asking")
  .option("-s, --skip-existing", "Skip existing files without asking")
  .option("--monorepo", "Force monorepo mode")
  .option("--no-monorepo", "Skip monorepo detection")
  .option(
    "-t, --template <name>",
    "Use a remote spec template (e.g., electron-fullstack)",
  )
  .option(
    "--overwrite",
    "Overwrite existing spec directory when using template",
  )
  .option("--append", "Only add missing files when using template")
  .option(
    "-r, --registry <source>",
    "Use a custom template registry (e.g., gh:myorg/myrepo/specs)",
  )
  .option(
    "--workflow <id>",
    "Workflow template id for .trellis/workflow.md (default: oh-my; e.g., native, tdd, channel-driven-subagent-dispatch)",
  )
  .option(
    "--workflow-source <source>",
    "Custom marketplace source for the --workflow lookup (e.g., gh:myorg/myrepo/marketplace)",
  )
  .action(async (options: Record<string, unknown>) => {
    try {
      // Deprecated alias: --windsurf → --devin (Windsurf was renamed to Devin).
      if (options.windsurf) {
        console.log(
          chalk.yellow(
            "⚠ --windsurf is deprecated (Windsurf was renamed to Devin). Use --devin instead.",
          ),
        );
        options.devin = true;
        delete options.windsurf;
      }
      await init(options);
    } catch (error) {
      console.error(
        chalk.red("Error:"),
        error instanceof Error ? error.message : error,
      );
      if (process.env.DEBUG || process.env.TRELLIS_DEBUG) {
        console.error(error instanceof Error ? error.stack : error);
      }
      process.exit(1);
    }
  });

program
  .command("update")
  .description("Update trellis configuration and commands to latest version")
  .option("--dry-run", "Preview changes without applying them")
  .option("-f, --force", "Overwrite all changed files without asking")
  .option("-s, --skip-all", "Skip all changed files without asking")
  .option("-n, --create-new", "Create .new copies for all changed files")
  .option("--allow-downgrade", "Allow downgrading to an older version")
  .option("--migrate", "Apply pending file migrations (renames/deletions)")
  .action(async (options: Record<string, unknown>) => {
    try {
      await update({
        dryRun: options.dryRun as boolean,
        force: options.force as boolean,
        skipAll: options.skipAll as boolean,
        createNew: options.createNew as boolean,
        allowDowngrade: options.allowDowngrade as boolean,
        migrate: options.migrate as boolean,
      });
    } catch (error) {
      console.error(
        chalk.red("Error:"),
        error instanceof Error ? error.message : error,
      );
      if (process.env.DEBUG || process.env.TRELLIS_DEBUG) {
        console.error(error instanceof Error ? error.stack : error);
      }
      process.exit(1);
    }
  });

program
  .command("upgrade")
  .description("Upgrade the global Trellis CLI package")
  .option(
    "--tag <tag>",
    "GitHub release tag to install (default: latest)",
  )
  .option("--dry-run", "Print the install command without running it")
  .action(async (options: Record<string, unknown>) => {
    try {
      await upgrade({
        tag: options.tag as string | undefined,
        dryRun: options.dryRun as boolean,
      });
    } catch (error) {
      console.error(
        chalk.red("Error:"),
        error instanceof Error ? error.message : error,
      );
      if (process.env.DEBUG || process.env.TRELLIS_DEBUG) {
        console.error(error instanceof Error ? error.stack : error);
      }
      process.exit(1);
    }
  });

program
  .command("uninstall")
  .description(
    "Remove all trellis files (managed platform files + .trellis/) from this project",
  )
  .option("-y, --yes", "Skip confirmation prompt")
  .option("--dry-run", "List what would be removed without changing anything")
  .action(async (options: Record<string, unknown>) => {
    try {
      await uninstall({
        yes: options.yes as boolean,
        dryRun: options.dryRun as boolean,
      });
    } catch (error) {
      console.error(
        chalk.red("Error:"),
        error instanceof Error ? error.message : error,
      );
      if (process.env.DEBUG || process.env.TRELLIS_DEBUG) {
        console.error(error instanceof Error ? error.stack : error);
      }
      process.exit(1);
    }
  });

program
  .command("ablate")
  .description(
    "Temporarily remove all project Trellis surfaces with an external recovery transaction",
  )
  .option("-y, --yes", "Skip confirmation prompt")
  .option("--dry-run", "Preview full ablation without changing files or state")
  .action(async (options: Record<string, unknown>) => {
    try {
      await ablate({
        yes: options.yes as boolean,
        dryRun: options.dryRun as boolean,
      });
    } catch (error) {
      console.error(
        chalk.red("Error:"),
        error instanceof Error ? error.message : error,
      );
      if (process.env.DEBUG || process.env.TRELLIS_DEBUG) {
        console.error(error instanceof Error ? error.stack : error);
      }
      process.exit(1);
    }
  });

program
  .command("restore")
  .description("Restore the exact project state saved by `trellis ablate`")
  .option("-y, --yes", "Skip confirmation prompt")
  .option("--dry-run", "Preview restoration and check conflicts")
  .action(async (options: Record<string, unknown>) => {
    try {
      await restore({
        yes: options.yes as boolean,
        dryRun: options.dryRun as boolean,
      });
    } catch (error) {
      console.error(
        chalk.red("Error:"),
        error instanceof Error ? error.message : error,
      );
      if (process.env.DEBUG || process.env.TRELLIS_DEBUG) {
        console.error(error instanceof Error ? error.stack : error);
      }
      process.exit(1);
    }
  });

program
  .command("mem")
  .description(
    "Search/recall AI conversation history across Claude Code, Codex, OpenCode, Pi (run 'trellis mem help' for subcommands and flags)",
  )
  .allowUnknownOption(true)
  .helpOption(false)
  .argument(
    "[args...]",
    "subcommand and arguments (list|search|context|extract|projects|help)",
  )
  .action((args: string[] = []) => {
    try {
      runMem(args);
    } catch (error) {
      console.error(
        chalk.red("Error:"),
        error instanceof Error ? error.message : error,
      );
      if (process.env.DEBUG || process.env.TRELLIS_DEBUG) {
        console.error(error instanceof Error ? error.stack : error);
      }
      process.exit(1);
    }
  });

program
  .command("workflow")
  .description(
    "List or switch the project's .trellis/workflow.md template (oh-my, native, tdd, channel-driven-subagent-dispatch, or marketplace)",
  )
  .option(
    "-t, --template <id>",
    "Workflow template id (e.g., oh-my, native, tdd, channel-driven-subagent-dispatch)",
  )
  .option(
    "-m, --marketplace <source>",
    "Custom marketplace source (e.g., gh:myorg/myrepo/marketplace)",
  )
  .option("--list", "List available workflow templates and exit")
  .option("-f, --force", "Overwrite a modified workflow.md without asking")
  .option(
    "-n, --create-new",
    "Write .trellis/workflow.md.new instead of replacing the active workflow",
  )
  .action(async (options: Record<string, unknown>) => {
    try {
      await runWorkflowCommand({
        template: options.template as string | undefined,
        marketplace: options.marketplace as string | undefined,
        list: options.list as boolean | undefined,
        force: options.force as boolean | undefined,
        createNew: options.createNew as boolean | undefined,
      });
    } catch (error) {
      if (error instanceof WorkflowCommandError) {
        console.error(chalk.red("Error:"), error.message);
        process.exit(1);
      }
      console.error(
        chalk.red("Error:"),
        error instanceof Error ? error.message : error,
      );
      if (process.env.DEBUG || process.env.TRELLIS_DEBUG) {
        console.error(error instanceof Error ? error.stack : error);
      }
      process.exit(1);
    }
  });

program
  .command("platforms")
  .description(
    "Show which AI platforms are configured (active) in the current project",
  )
  .option("--json", "Output machine-readable JSON")
  .action((options: Record<string, unknown>) => {
    try {
      const configured = getConfiguredPlatforms(cwd);
      const platforms = [...configured].map((id) => ({
        id,
        displayName: AI_TOOLS[id].name,
        configDir: AI_TOOLS[id].configDir,
      }));

      if (options.json) {
        console.log(JSON.stringify({ platforms }, null, 2));
        return;
      }

      if (platforms.length === 0) {
        console.log(chalk.gray("No platforms configured in this project."));
        return;
      }

      console.log(chalk.bold("Configured platforms:"));
      for (const p of platforms) {
        console.log(`  ${p.displayName} (${p.id}) — ${p.configDir}`);
      }
    } catch (error) {
      console.error(
        chalk.red("Error:"),
        error instanceof Error ? error.message : error,
      );
      if (process.env.DEBUG || process.env.TRELLIS_DEBUG) {
        console.error(error instanceof Error ? error.stack : error);
      }
      process.exit(1);
    }
  });

// [oh-my] D5 — unattended loop runner. Distinct verb from `channel run`
// (one-shot worker); this one drives the frontier ticket by ticket.
program
  .command("run")
  .description(
    "Unattended loop: take the frontier head, implement it in its own worktree, verify, and record a run ledger. Delivery is opt-in.",
  )
  .option("--until-empty", "Keep taking tickets until the frontier has nothing ready (loop mode only)")
  .option("--board <slug>", "Restrict the loop to one domain board (meta.domain)")
  .option("--ticket <dir>", "Run exactly one ticket (dispatch resolved from meta.worker → agent card → worker_default)")
  .option("--worker <name>", "With --ticket: agent card to run as, overriding meta.worker for this invocation")
  .option("--max-tickets <n>", "Ticket attempts per run (default 5)")
  .option("--max-failures <n>", "Consecutive failures on one ticket before the line halts (default 3)")
  .option("--dry-run", "Print the selected ticket and the planned actions; write nothing at all")
  .option(
    "--provider <name>",
    `With --ticket: provider override (${listProviders().join(", ")}); the loop resolves providers per ticket from each card`,
  )
  .option("--agent <name>", "Refused in both modes — dispatch comes from each ticket's roster (or --worker with --ticket)")
  .option("--model <name>", "With --ticket: model override; the loop resolves models per ticket from the roster")
  .option("--timeout <duration>", "Per-worker timeout, e.g. 20m (default 30m)")
  .action(async (options: Record<string, unknown>) => {
    try {
      if (typeof options.ticket === "string" && options.ticket) {
        // Single-ticket mode: one attempt, one JSON result line as the last
        // stdout emission — orchestrators parse that line, not the summary.
        const ticket = await runTicketCommand(options, cwd);
        if (ticket.result) {
          console.log(JSON.stringify(ticket.result));
          if (ticket.result.outcome === "failed" || ticket.result.outcome === "stop-line") {
            process.exitCode = 1;
          }
        }
        return;
      }
      const result = await runLoopCommand(options, cwd);
      console.log(
        `stopped=${result.stopped} attempted=${result.attempted} ` +
          `archived=${result.archived} failed=${result.failed}` +
          (result.ledgerFile ? ` ledger=${result.ledgerFile}` : ""),
      );
      if (
        result.stopped === "cycle" ||
        result.stopped === "frontier_error" ||
        result.stopped === "fail_threshold" ||
        result.stopped === "push_refused"
      ) {
        process.exitCode = 1;
      }
    } catch (error) {
      console.error(
        chalk.red("Error:"),
        error instanceof Error ? error.message : error,
      );
      if (process.env.DEBUG || process.env.TRELLIS_DEBUG) {
        console.error(error instanceof Error ? error.stack : error);
      }
      process.exit(1);
    }
  });

registerChannelCommand(program);

program.parse();
