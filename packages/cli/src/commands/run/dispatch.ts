/**
 * Dispatch resolution for the single-ticket runner (`trellis run --ticket`).
 *
 * A ticket does not name a provider/model inline — it names an agent CARD
 * (`task.json meta.worker`), and the card's frontmatter carries the triple
 * (`provider` / `model` / `effort`). Resolution order is fail-closed:
 *
 *   --worker / --model flags (this invocation only)
 *     → task.json meta.worker / meta.model / meta.effort
 *       → the agent card's frontmatter (for provider/model/effort values)
 *         → config.yaml `worker_default` (repo-level card fallback)
 *           → refuse, with a fix hint. Never a silent fallback.
 *
 * The card is resolved against the ORCHESTRATING repo here — spawn re-reads
 * it inside the ticket worktree (worker cwd), so a card that is not committed
 * cannot be dispatched at all.
 */

import fs from "node:fs";
import path from "node:path";

import {
  isProvider,
  listProviders,
  type Provider,
} from "../channel/adapters/index.js";
import { DIR_NAMES } from "../../constants/paths.js";

/** The dispatch triple the runner hands to one attempt. */
export interface TicketDispatch {
  provider?: Provider;
  /** Agent card name — `.trellis/agents/<agent>.md`. */
  agent?: string;
  model?: string;
  /**
   * Resolved card/meta effort. Carried on the dispatch for the ledger and
   * for the future effort-aware adapters; the current spawn path reads
   * effort from the card itself, so nothing downstream consumes this yet.
   */
  effort?: string;
}

/** The dispatch-relevant slice of an agent card's frontmatter. */
export interface AgentCardInfo {
  /** Raw `provider:` value — un-normalized, so `acp` survives for `isProvider`. */
  provider?: string;
  model?: string;
  effort?: string;
}

/** The port slice `resolveDispatch` reads. `RunnerPorts` satisfies this. */
export interface DispatchPorts {
  /** The ticket's `meta` object from task.json; `{}` when unreadable. */
  taskMeta(dir: string): Record<string, unknown>;
  /** Card frontmatter slice; `null` when the card is missing or unreadable. */
  agentCard(name: string): AgentCardInfo | null;
  /** `.trellis/config.yaml` `worker_default`; `null` when unset. */
  workerDefault(): string | null;
}

/** CLI-flag overrides that win over every other layer for one invocation. */
export interface DispatchOverrides {
  worker?: string;
  provider?: string;
  model?: string;
}

function metaString(
  meta: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = meta[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Resolve which worker a ticket runs as. Every refusal names the layer that
 * failed and the command that fixes it — an unattended runner gets a "no",
 * never a guess.
 */
export function resolveDispatch(
  dir: string,
  overrides: DispatchOverrides,
  ports: DispatchPorts,
):
  | { ok: true; dispatch: TicketDispatch }
  | { ok: false; error: string; partial: TicketDispatch } {
  const meta = ports.taskMeta(dir);

  // What the refusal row reports as "was asked to run": the overrides plus
  // whatever deeper layers had already supplied.
  const partial: TicketDispatch = {
    agent: overrides.worker ?? metaString(meta, "worker"),
    provider:
      overrides.provider && isProvider(overrides.provider)
        ? overrides.provider
        : undefined,
    model: overrides.model ?? metaString(meta, "model"),
  };

  const worker =
    overrides.worker ??
    metaString(meta, "worker") ??
    ports.workerDefault() ??
    undefined;
  if (!worker) {
    return {
      ok: false,
      partial,
      error:
        `cannot resolve a worker for ${dir}: task.json meta.worker is unset and ` +
        `.trellis/config.yaml has no worker_default — fix: \`task.py set-meta ${dir} ` +
        `worker <card>\`, set \`worker_default: <card>\` in .trellis/config.yaml, ` +
        `or pass --worker <card>`,
    };
  }
  partial.agent = worker;

  const card = ports.agentCard(worker);
  if (!card) {
    return {
      ok: false,
      partial,
      error:
        `dispatch card '${worker}' not found — expected ` +
        `.trellis/agents/${worker}.md committed so the ticket worktree can read ` +
        `it — fix: create the card, or point meta.worker / worker_default / ` +
        `--worker at an existing one`,
    };
  }

  const provider = overrides.provider ?? card.provider;
  if (!provider) {
    return {
      ok: false,
      partial,
      error:
        `card '${worker}' has no provider frontmatter and --provider was not ` +
        `passed — fix: add \`provider: <${listProviders().join("|")}>\` to ` +
        `.trellis/agents/${worker}.md or pass --provider`,
    };
  }
  if (!isProvider(provider)) {
    return {
      ok: false,
      partial,
      error:
        `card '${worker}' names provider '${provider}', which is not a ` +
        `registered provider (known: ${listProviders().join(", ")}) — fix: ` +
        `correct the card's provider frontmatter`,
    };
  }

  return {
    ok: true,
    dispatch: {
      provider,
      agent: worker,
      model: overrides.model ?? metaString(meta, "model") ?? card.model,
      effort: metaString(meta, "effort") ?? card.effort,
    },
  };
}

/**
 * Read `.trellis/config.yaml` `worker_default:` — a top-level scalar. Line
 * scanner on purpose: config.yaml is a documented flat-ish file and pulling
 * in a YAML dependency for one key is what `parseWorkerGuardSection`
 * already refused to do.
 */
export function loadWorkerDefault(cwd: string): string | null {
  const configPath = path.join(cwd, DIR_NAMES.WORKFLOW, "config.yaml");
  let content: string;
  try {
    content = fs.readFileSync(configPath, "utf-8");
  } catch {
    return null;
  }
  return parseWorkerDefault(content);
}

/** Exposed for unit tests. */
export function parseWorkerDefault(content: string): string | null {
  for (const raw of content.split("\n")) {
    const line = raw.replace(/\r$/, "");
    // Top-level key only — an indented `worker_default:` belongs to some
    // nested section and is not the roster fallback.
    const m = /^worker_default:\s*(.*?)\s*$/.exec(line);
    if (!m) continue;
    const value = m[1]
      .replace(/\s*#.*$/, "")
      .trim()
      .replace(/^['"]|['"]$/g, "");
    return value || null;
  }
  return null;
}
