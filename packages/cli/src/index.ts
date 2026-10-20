/**
 * Omtre - AI-assisted development workflow framework
 *
 * Based on Anthropic's "Effective Harnesses for Long-Running Agents"
 * https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
 */

export { VERSION } from "./constants/version.js";
export { init } from "./commands/init.js";
export {
  migrate,
  type MigrateOptions,
  type MigrateResult,
  type MigrationPlan,
} from "./commands/migrate.js";

// Single-ticket runner + dispatch resolution — the orchestrator's embed seam.
export {
  realPorts,
  runTicket,
  type RunnerPorts,
  type RunTicketOptions,
  type TicketResult,
  type TicketRun,
  type VerifySummary,
} from "./commands/run.js";
export {
  resolveDispatch,
  type AgentCardInfo,
  type DispatchOverrides,
  type DispatchPorts,
  type TicketDispatch,
} from "./commands/run/dispatch.js";
export {
  openLedger,
  type Ledger,
  type LedgerInput,
  type LedgerLine,
} from "./commands/run/ledger.js";
