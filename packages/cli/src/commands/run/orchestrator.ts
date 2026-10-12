/**
 * `orchestrator:` section of `.trellis/config.yaml` (dispatch-roster schema).
 *
 * The orchestrator is itself an agent card — the config only names which one
 * drives the unattended loop, plus the model override and how many tickets it
 * may run in parallel:
 *
 *   orchestrator:
 *     agent: orchestrator
 *     model: claude-opus-4-7
 *     max_parallel: 1
 *
 * Precedence: CLI flag > config value > built-in default. `max_parallel`
 * defaults to 1 — fail-closed to serial dispatch when the key is absent.
 *
 * The parser mirrors `channel.worker_guard` (channel/guard.ts): the same
 * line-scanner subset of YAML, no dependency, same failure modes. A malformed
 * `max_parallel` throws — a silently ignored cap is worse than a crash.
 */

import fs from "node:fs";
import path from "node:path";

/** `max_parallel` default when the key is absent: serial dispatch. */
export const ORCHESTRATOR_MAX_PARALLEL_DEFAULT = 1;

export interface OrchestratorConfig {
  /** Agent card name under `.trellis/agents/` (e.g. `orchestrator`). */
  agent?: string;
  /** Model override applied at dispatch (card value wins over absent). */
  model?: string;
  /** Parallel ticket cap. Defaults to {@link ORCHESTRATOR_MAX_PARALLEL_DEFAULT}. */
  maxParallel: number;
}

/**
 * Strip a ` #…` inline comment — ` #` (whitespace + hash) opens a comment,
 * a `#` mid-token does not. Matches trellis_config.py's rule so the TS and
 * Python readers accept the same config dialect.
 */
function stripInlineComment(value: string): string {
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "#" && (i === 0 || /\s/.test(value[i - 1]))) {
      return value.slice(0, i).trimEnd();
    }
  }
  return value;
}

/** One layer of matching surrounding quotes, mirroring trellis_config._unquote. */
function unquote(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if (first === last && (first === '"' || first === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

/**
 * Parse just the `orchestrator:` section out of config.yaml content.
 * Returns `undefined` when the file has no `orchestrator:` section;
 * an empty section still yields the `max_parallel` default of 1.
 */
export function parseOrchestratorSection(
  content: string,
): OrchestratorConfig | undefined {
  let inside = false;
  let agent: string | undefined;
  let model: string | undefined;
  let maxParallel = ORCHESTRATOR_MAX_PARALLEL_DEFAULT;
  let sawSection = false;
  for (const raw of content.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    if (/^\S/.test(line)) {
      // A column-0 key ends the section (or starts it, when it is `orchestrator:`).
      inside = /^orchestrator\s*:\s*(#.*)?$/.test(line);
      if (inside) sawSection = true;
      continue;
    }
    if (!inside) continue;
    const m = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*?)\s*$/.exec(line.trim());
    if (!m) continue;
    const key = m[1];
    const value = unquote(stripInlineComment(m[2]));
    if (key === "agent") {
      agent = value;
    } else if (key === "model") {
      model = value;
    } else if (key === "max_parallel") {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || String(parsed) !== value || parsed < 1) {
        throw new Error(
          `orchestrator.max_parallel must be a positive integer, got "${value}"`,
        );
      }
      maxParallel = parsed;
    }
    // Unknown keys are ignored — forward-compat for richer orchestrator blocks.
  }
  return sawSection ? { agent, model, maxParallel } : undefined;
}

/**
 * Load the orchestrator config from `<cwd>/.trellis/config.yaml`.
 * Returns `undefined` when the file or section is missing.
 */
export function loadOrchestratorConfig(
  cwd: string,
): OrchestratorConfig | undefined {
  const configPath = path.join(cwd, ".trellis", "config.yaml");
  let content: string;
  try {
    content = fs.readFileSync(configPath, "utf-8");
  } catch {
    return undefined;
  }
  return parseOrchestratorSection(content);
}

/**
 * Repo-level worker fallback: the `worker_default:` top-level scalar names
 * the agent card dispatched when a ticket's `meta.worker` and the role card
 * do not resolve. Returns `undefined` when absent — the roster then fails
 * closed instead of guessing a worker.
 */
export function readWorkerDefault(cwd: string): string | undefined {
  const configPath = path.join(cwd, ".trellis", "config.yaml");
  let content: string;
  try {
    content = fs.readFileSync(configPath, "utf-8");
  } catch {
    return undefined;
  }
  for (const raw of content.split("\n")) {
    const line = raw.trimEnd();
    // Top-level scalar only — an indented match belongs to another section.
    const m = /^worker_default\s*:\s*(.*?)\s*$/.exec(line);
    if (!m) continue;
    const value = unquote(stripInlineComment(m[1]));
    return value.length > 0 ? value : undefined;
  }
  return undefined;
}
