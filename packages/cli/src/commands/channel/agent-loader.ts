/**
 * Load an Omtre agent definition from `.omtre/agents/<name>.md`.
 *
 * Format: YAML frontmatter (between `---` fences) + markdown body.
 *   The body becomes the system prompt injected into the worker.
 *
 *   ---
 *   name: architect
 *   description: System architect ...
 *   provider: claude       # registered provider (claude | codex | acp)
 *   model: claude-opus-4-7 # CLI-specific model id; optional
 *   labels: [design]       # optional metadata
 *   ---
 *
 *   You are a senior system architect ...
 *
 * Unknown frontmatter fields are preserved as metadata but ignored by
 * channel runtime (they may be consumed by other Omtre layers).
 */

import fs from "node:fs";
import path from "node:path";

import { PATHS } from "../../constants/paths.js";
import { isProvider, type Provider } from "./adapters/index.js";

export interface AgentDefinition {
  name: string;
  description?: string;
  provider?: Provider;
  model?: string;
  /** ACP effort/thinking level (e.g. `low|medium|high|xhigh`); provider-agnostic key. */
  effort?: string;
  labels?: string[];
  systemPrompt: string;
  /** All raw frontmatter keys — ACP target/override fields
   *  (`acp_target`, `acp_command`, `acp_args`) are read from here. */
  raw: Record<string, string>;
  filePath: string;
}

const FRONTMATTER_FENCE = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;

const SAFE_AGENT_NAME = /^[A-Za-z0-9._-]+$/;

export function findAgentFile(
  name: string,
  cwd: string,
  trustedRoots: string[] = [],
): string | null {
  // Reject path-traversal attempts (`..`, `/`, etc.) — agent names must be
  // a single safe identifier. Without this, `--agent ../../etc/passwd`
  // would read arbitrary host files into the worker system prompt.
  if (!SAFE_AGENT_NAME.test(name)) {
    throw new Error(
      `Agent name '${name}' is not allowed (must match ${SAFE_AGENT_NAME.source})`,
    );
  }
  // Resolve ancestor symlinks on the comparison root, not on the candidates:
  // a cwd reached through a symlinked prefix (macOS `/var -> /private/var`,
  // or a checkout behind a symlink) otherwise never prefix-matches its own
  // cards. `.omtre/agents` itself stays lexical on purpose — resolving it
  // would auto-trust an agents-dir symlink, which remains a trusted-roots
  // decision.
  const agentsRoot = path.resolve(cwd, PATHS.AGENTS);
  let agentsRootReal: string;
  try {
    agentsRootReal = path.join(fs.realpathSync(cwd), PATHS.AGENTS);
  } catch {
    agentsRootReal = agentsRoot;
  }
  const candidates = [
    path.join(agentsRoot, `${name}.md`),
    path.join(agentsRoot, name, "AGENT.md"),
  ];
  for (const p of candidates) {
    // Defense in depth: confirm the resolved path stays under agentsRoot,
    // or one of the trusted roots (see context-trust.ts) — accommodates
    // `.omtre/agents` reached through a trusted `.omtre` symlink.
    const real = fs.existsSync(p) ? fs.realpathSync(p) : p;
    const inAgentsRoot =
      real === agentsRootReal || real.startsWith(agentsRootReal + path.sep);
    const inTrustedRoot = trustedRoots.some(
      (root) => real === root || real.startsWith(root + path.sep),
    );
    if (!inAgentsRoot && !inTrustedRoot) {
      continue;
    }
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Dispatch-roster check specialization: the `check` role is the one role with
 * OPTIONAL axis sub-cards. `check.standards` / `check.spec` (when present in
 * `.omtre/agents/`) take precedence over the generic `check` card, so the
 * two axes can be dispatched to different executors. An absent sub-card falls
 * back to `check` — the card then runs both axes serially per its own rules.
 * No other fallback exists: an unresolvable card name still fails loudly at
 * spawn time via {@link loadAgent}.
 */
export const CHECK_AXES = ["standards", "spec"] as const;
export type CheckAxis = (typeof CHECK_AXES)[number];

export function resolveCheckAxisCard(
  axis: CheckAxis,
  cwd: string,
  trustedRoots: string[] = [],
): string {
  const name = `check.${axis}`;
  return findAgentFile(name, cwd, trustedRoots) !== null ? name : "check";
}

export function loadAgent(
  name: string,
  cwd: string = process.cwd(),
  trustedRoots: string[] = [],
): AgentDefinition {
  const file = findAgentFile(name, cwd, trustedRoots);
  if (!file) {
    throw new Error(
      `Agent '${name}' not found. Looked in:\n  ${[
        path.join(cwd, PATHS.AGENTS, `${name}.md`),
        path.join(cwd, PATHS.AGENTS, name, "AGENT.md"),
      ].join("\n  ")}`,
    );
  }

  const raw = fs.readFileSync(file, "utf-8");
  const m = FRONTMATTER_FENCE.exec(raw);
  if (!m) {
    throw new Error(
      `Agent '${name}' at ${file} has no YAML frontmatter (expected --- ... --- block at top)`,
    );
  }

  const fm = parseFrontmatter(m[1] ?? "");
  const body = (m[2] ?? "").trim();

  const provider = normalizeProvider(fm.provider);
  const labels = fm.labels
    ? fm.labels
        .replace(/[[\]]/g, "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  return {
    name: fm.name?.trim() || name,
    description: fm.description?.trim() || undefined,
    provider,
    model: fm.model?.trim() || undefined,
    effort: fm.effort?.trim() || undefined,
    labels,
    systemPrompt: body,
    raw: fm,
    filePath: file,
  };
}

/**
 * Provider validation is registry-aware: any adapter registered in
 * `adapters/index.js` (claude, codex, acp, future providers) is accepted
 * without a parallel whitelist here.
 */
function normalizeProvider(v: string | undefined): Provider | undefined {
  if (!v) return undefined;
  const t = v.trim().toLowerCase();
  if (isProvider(t)) return t;
  return undefined;
}

/**
 * Very small flat-YAML parser for the frontmatter dialect we expect:
 *   key: value
 *   multiline_key: |
 *     line one
 *     line two
 *
 * Lists / nested objects beyond this are returned as their raw string form.
 */
// Dangerous keys that would corrupt Object.prototype if assigned naïvely.
// We use Object.create(null) as the bag, but also reject these to keep
// callers safe when they iterate / spread the result.
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function parseFrontmatter(text: string): Record<string, string> {
  // Prototype-less object: assignment to `__proto__` etc. won't traverse
  // up to Object.prototype.
  const out: Record<string, string> = Object.create(null) as Record<
    string,
    string
  >;
  // CRLF-tolerant: worktree checkouts under `core.autocrlf` deliver \r\n
  // files, and `key: value\r` must still parse (`.*` cannot cross \r).
  const lines = text.split("\n").map((l) => l.replace(/\r$/, ""));
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) {
      i++;
      continue;
    }
    const m = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) {
      i++;
      continue;
    }
    const key = m[1];
    const inline = m[2];

    if (FORBIDDEN_KEYS.has(key)) {
      process.stderr.write(
        `[channel agent-loader] refusing dangerous frontmatter key '${key}'\n`,
      );
      // Still need to consume any block scalar continuation lines.
      if (inline === "|" || inline === ">") {
        i++;
        while (i < lines.length && !lines[i].match(/^\S/)) i++;
      } else {
        i++;
      }
      continue;
    }

    if (inline === "|" || inline === ">") {
      // Block scalar — collect indented continuation lines
      const block: string[] = [];
      i++;
      while (i < lines.length) {
        const cont = lines[i];
        if (cont.match(/^\S/)) break;
        block.push(cont.replace(/^ {2}/, ""));
        i++;
      }
      out[key] = block.join("\n").trim();
    } else {
      out[key] = inline.trim();
      i++;
    }
  }
  return out;
}
