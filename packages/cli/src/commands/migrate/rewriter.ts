import fs from "node:fs";
import path from "node:path";
import { agentsMdContent } from "../../templates/markdown/index.js";
import { writeFileAtomic } from "../../utils/atomic-write.js";
import { toPosix } from "../../utils/posix.js";
import type {
  MigrateExternalMatch,
  MigrateRewriteFileDetail,
  MigrateRewriteRuleHit,
} from "./types.js";

/**
 * Upstream attribution URL/slug pattern (`mindfold-ai/trellis`).
 * Protected during rewrites and ignored during residual/external scans.
 */
export const ATTRIBUTION_URL_REGEX =
  /https?:\/\/[^\s)"'>\]]*mindfold-ai\/trellis[^\s)"'>\]]*|\bmindfold-ai\/trellis(?:-[A-Za-z0-9_.-]+)?/gi;

/**
 * Date-prefixed historical task directory identifier (e.g. `01-22-trellis-agents-gui`).
 * Protected from `trellis-<slug> -> omtre-<slug>` rewrites so historical task
 * paths and `blocked_by` references remain intact.
 */
export const HISTORICAL_TASK_SLUG_REGEX =
  /\b\d{2}-\d{2}-[A-Za-z0-9_-]*trellis-[A-Za-z0-9_-]*/gi;

const AGENTS_LEGACY_BLOCK_REGEX =
  /<!--\s*TRELLIS:START\s*-->[\s\S]*?<!--\s*TRELLIS:END\s*-->/g;

export interface RewriteContentOptions {
  /** Historical task directory names to protect from `trellis-*` -> `omtre-*` */
  protectedTokens?: Iterable<string>;
  /** Replace `<!-- TRELLIS:START -->...<!-- TRELLIS:END -->` with Omtre root block */
  updateAgentsBlock?: boolean;
  /** Preview mode: do not write changes to disk */
  dryRun?: boolean;
  /** Explicit flag controlling disk write (defaults to `!dryRun`) */
  writeToDisk?: boolean;
}

export interface RewriteContentResult {
  content: string;
  replacements: number;
  rules: MigrateRewriteRuleHit[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Rewrite legacy Trellis technical identifiers to Omtre equivalents while
 * preserving:
 * - `mindfold-ai/trellis*` attribution URLs
 * - Standalone brand word "Trellis"
 * - Historical task directory names (e.g. `01-22-trellis-agents-gui`)
 */
export function rewriteTextContent(
  input: string,
  options: RewriteContentOptions = {},
): RewriteContentResult {
  let work = input;
  const ruleCounts = new Map<string, number>();

  const addHits = (rule: string, count: number): void => {
    if (count <= 0) return;
    ruleCounts.set(rule, (ruleCounts.get(rule) ?? 0) + count);
  };

  // 1. Optional full replacement of `<!-- TRELLIS:START -->...<!-- TRELLIS:END -->`
  if (options.updateAgentsBlock && AGENTS_LEGACY_BLOCK_REGEX.test(work)) {
    AGENTS_LEGACY_BLOCK_REGEX.lastIndex = 0;
    let blockMatches = 0;
    const replacementBlock = agentsMdContent.trim();
    work = work.replace(AGENTS_LEGACY_BLOCK_REGEX, () => {
      blockMatches += 1;
      return replacementBlock;
    });
    addHits("TRELLIS:START..END -> OMTRE:START..END", blockMatches);
  }

  // 2. Protect attribution URLs first
  const placeholders: string[] = [];
  const protect = (raw: string): string => {
    const idx = placeholders.length;
    placeholders.push(raw);
    return `\u0000OMTRE_PROTECT_${idx}\u0000`;
  };

  work = work.replace(ATTRIBUTION_URL_REGEX, (matched) => protect(matched));

  // 3. Apply path, marker, env, slash-command, and package rules
  const applyRule = (
    ruleName: string,
    regex: RegExp,
    replacer: string | ((substring: string, ...args: string[]) => string),
  ): void => {
    let count = 0;
    work = work.replace(regex, (...args) => {
      count += 1;
      if (typeof replacer === "function") {
        return replacer(args[0] as string, ...(args.slice(1) as string[]));
      }
      return replacer;
    });
    addHits(ruleName, count);
  };

  applyRule("~/.trellis -> ~/.omtre", /~\/\.trellis/g, "~/.omtre");
  applyRule(".trellis -> .omtre", /\.trellis/g, ".omtre");
  applyRule(
    "TRELLIS:COPILOT-GUIDANCE -> OMTRE:COPILOT-GUIDANCE",
    /TRELLIS:COPILOT-GUIDANCE/g,
    "OMTRE:COPILOT-GUIDANCE",
  );
  applyRule("TRELLIS:START -> OMTRE:START", /TRELLIS:START/g, "OMTRE:START");
  applyRule("TRELLIS:END -> OMTRE:END", /TRELLIS:END/g, "OMTRE:END");
  applyRule(
    "TRELLIS_* -> OMTRE_*",
    /TRELLIS_([A-Za-z0-9_]*)/g,
    (_m, suffix: string) => `OMTRE_${suffix}`,
  );
  applyRule(
    "trellis-hook-injected -> omtre-hook-injected",
    /\btrellis-hook-injected\b/g,
    "omtre-hook-injected",
  );
  applyRule(
    "trellis-emitted -> omtre-emitted",
    /\btrellis-emitted\b/g,
    "omtre-emitted",
  );
  applyRule(
    "/trellis:* -> /omt:*",
    /\/trellis:([A-Za-z0-9_-]*)/g,
    (_m, cmd: string) => `/omt:${cmd}`,
  );
  applyRule(
    "@mindfoldhq/trellis-core -> @omtre/core",
    /@mindfoldhq\/trellis-core\b/g,
    "@omtre/core",
  );
  applyRule("@mindfoldhq/trellis -> omtre", /@mindfoldhq\/trellis\b/g, "omtre");
  applyRule("oh-my-trellis -> omtre", /\boh-my-trellis\b/g, "omtre");

  // 4. Protect historical task directory names before `trellis-* -> omtre-*`
  if (options.protectedTokens) {
    const sortedTokens = Array.from(options.protectedTokens)
      .filter((t) => t.length > 0 && t.toLowerCase().includes("trellis"))
      .sort((a, b) => b.length - a.length);
    for (const token of sortedTokens) {
      const tokenRegex = new RegExp(escapeRegExp(token), "g");
      work = work.replace(tokenRegex, (matched) => protect(matched));
    }
  }
  work = work.replace(HISTORICAL_TASK_SLUG_REGEX, (matched) =>
    protect(matched),
  );

  // 5. Rewrite remaining `trellis-<slug>` -> `omtre-<slug>`
  applyRule(
    "trellis-* -> omtre-*",
    /trellis-([A-Za-z0-9_-]*)/g,
    (_m, slug: string) => `omtre-${slug}`,
  );

  // 6. Restore protected tokens
  for (let i = placeholders.length - 1; i >= 0; i--) {
    const token = `\u0000OMTRE_PROTECT_${i}\u0000`;
    work = work.split(token).join(placeholders[i] ?? "");
  }

  const rules: MigrateRewriteRuleHit[] = [];
  let totalReplacements = 0;
  for (const [rule, count] of ruleCounts.entries()) {
    rules.push({ rule, count });
    totalReplacements += count;
  }

  return {
    content: work,
    replacements: totalReplacements,
    rules,
  };
}

/**
 * Built-in Omtre agent role names under `.omtre/agents/<name>.md`.
 */
export const BUILTIN_WORKFLOW_AGENTS = new Set([
  "check",
  "debug",
  "implement",
  "orchestrator",
  "plan",
  "research",
]);

/**
 * Built-in Omtre slash command names.
 */
export const BUILTIN_COMMANDS = new Set(["start", "continue", "finish-work"]);

/**
 * Built-in Omtre skill slugs (`omtre-<slug>`).
 */
export const BUILTIN_SKILL_SLUGS = new Set([
  "before-dev",
  "brainstorm",
  "break-loop",
  "channel",
  "check",
  "continue",
  "finish-work",
  "meta",
  "session-insight",
  "spec-bootstrap",
  "start",
  "update-spec",
]);

/**
 * Frontmatter keys that users customize in `.trellis/agents/*.md` and that
 * must be carried over when regenerating `.omtre/agents/*.md`.
 */
const PRESERVED_AGENT_FRONTMATTER_KEYS = [
  "provider",
  "model",
  "effort",
  "acp_target",
  "acp_command",
  "acp_args",
] as const;

/**
 * Extract user-configured frontmatter lines (`provider`, `model`, `effort`,
 * `acp_target`, `acp_command`, `acp_args`) from an existing `.trellis/agents/*.md`.
 * Only uncommented `key: value` lines are extracted.
 */
export function extractAgentFrontmatterCustomizations(
  content: string,
): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match?.[1]) return {};

  const out: Record<string, string> = {};
  for (const rawLine of match[1].split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const kv = trimmed.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.+)$/);
    if (!kv) continue;
    const key = kv[1] ?? "";
    const val = (kv[2] ?? "").trim();
    if (
      (PRESERVED_AGENT_FRONTMATTER_KEYS as readonly string[]).includes(key) &&
      val.length > 0
    ) {
      out[key] = val;
    }
  }
  return out;
}

/**
 * Apply preserved frontmatter key-values onto a newly rendered `.omtre/agents/*.md`.
 */
export function applyAgentFrontmatterCustomizations(
  templateContent: string,
  customizations: Record<string, string>,
): string {
  const keys = Object.keys(customizations);
  if (keys.length === 0) return templateContent;

  const fmMatch = templateContent.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);
  if (!fmMatch) return templateContent;

  const lines = (fmMatch[2] ?? "").split(/\r?\n/);
  const applied = new Set<string>();

  const updatedLines = lines.map((line) => {
    for (const key of keys) {
      const commentedRe = new RegExp(`^#\\s*${escapeRegExp(key)}\\s*:.*$`);
      const activeRe = new RegExp(`^${escapeRegExp(key)}\\s*:.*$`);
      if (
        (commentedRe.test(line.trim()) || activeRe.test(line.trim())) &&
        !applied.has(key)
      ) {
        applied.add(key);
        return `${key}: ${customizations[key]}`;
      }
    }
    return line;
  });

  for (const key of keys) {
    if (!applied.has(key)) {
      updatedLines.push(`${key}: ${customizations[key]}`);
    }
  }

  return (
    fmMatch[1] +
    updatedLines.join("\n") +
    fmMatch[3] +
    templateContent.slice(fmMatch[0].length)
  );
}

/**
 * Strip legacy `# Added by Trellis` comments from `.codex/config.toml` and
 * rewrite any `.trellis` / `TRELLIS_` references.
 */
export function cleanTomlLegacyComments(rawToml: string): string {
  const filtered = rawToml
    .split(/\r?\n/)
    .filter((line) => !/^\s*#\s*Added by Trellis\s*$/i.test(line))
    .join("\n");
  return rewriteTextContent(filtered).content;
}

/**
 * Shared platform settings files from which legacy `.trellis` / `trellis`
 * hook and extension entries must be stripped while preserving user settings.
 */
export const SHARED_SETTINGS_FILES = [
  ".claude/settings.json",
  ".cursor/hooks.json",
  ".codex/hooks.json",
  ".gemini/settings.json",
  ".qoder/settings.json",
  ".opencode/opencode.json",
  ".pi/settings.json",
  ".trae/hooks.json",
  ".factory/settings.json",
  ".codebuddy/hooks.json",
  ".snow/hooks.json",
  ".zcode/hooks.json",
  ".github/hooks/hooks.json",
] as const;

const LEGACY_MANAGED_HOOK_OR_EXT_REGEX =
  /(?:\.trellis\b|\/trellis\/|\btrellis-|write-trellis-context|trellis-context|extensions\/trellis\b|hooks\/(?:session-start|inject-subagent-context|inject-workflow-state|inject-shell-session-context|statusline|auto-Context)\.py)/i;

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function rewriteStringsInJsonValue(
  value: unknown,
  protectedTokens?: Iterable<string>,
): { value: unknown; changed: boolean } {
  if (typeof value === "string") {
    const res = rewriteTextContent(value, { protectedTokens });
    return { value: res.content, changed: res.replacements > 0 };
  }
  if (Array.isArray(value)) {
    let anyChanged = false;
    const next = value.map((item) => {
      const r = rewriteStringsInJsonValue(item, protectedTokens);
      if (r.changed) anyChanged = true;
      return r.value;
    });
    return { value: next, changed: anyChanged };
  }
  if (isPlainObject(value)) {
    let anyChanged = false;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const rk = rewriteTextContent(k, { protectedTokens });
      const rv = rewriteStringsInJsonValue(v, protectedTokens);
      if (rk.replacements > 0 || rv.changed) anyChanged = true;
      out[rk.content] = rv.value;
    }
    return { value: out, changed: anyChanged };
  }
  return { value, changed: false };
}

/**
 * Strip legacy Trellis hooks/extensions from a shared JSON settings object,
 * returning the remaining user-owned settings so they can be merged back after
 * the platform configurator writes the fresh Omtre settings file.
 */
export function cleanLegacyEntriesFromSettingsObject(
  rawObj: Record<string, unknown>,
  protectedTokens?: Iterable<string>,
): {
  cleaned: Record<string, unknown>;
  cleanedObj: Record<string, unknown>;
  hadLegacyEntries: boolean;
  hadClaudeStatusLine: boolean;
} {
  const clone = JSON.parse(JSON.stringify(rawObj)) as Record<string, unknown>;
  let hadLegacyEntries = false;
  let hadClaudeStatusLine = false;

  // Check Claude built-in statusline.py opt-in
  if (isPlainObject(clone.statusLine)) {
    const serialized = JSON.stringify(clone.statusLine);
    if (serialized.includes("statusline.py")) {
      hadClaudeStatusLine = true;
      hadLegacyEntries = true;
      delete clone.statusLine;
    }
  }

  // Strip managed hooks from `hooks` map while preserving user hooks even if
  // they share the same matcher object (e.g. `{ matcher: "startup", hooks: [...] }`).
  if (isPlainObject(clone.hooks)) {
    const hooksObj = clone.hooks as Record<string, unknown>;
    for (const [eventKey, eventVal] of Object.entries(hooksObj)) {
      if (!Array.isArray(eventVal)) continue;
      const keptEntries: unknown[] = [];
      for (const entry of eventVal) {
        if (isPlainObject(entry) && Array.isArray(entry.hooks)) {
          const innerHooks = entry.hooks as unknown[];
          const keptInner = innerHooks.filter((h) => {
            if (LEGACY_MANAGED_HOOK_OR_EXT_REGEX.test(JSON.stringify(h))) {
              hadLegacyEntries = true;
              return false;
            }
            return true;
          });
          if (keptInner.length > 0) {
            keptEntries.push({ ...entry, hooks: keptInner });
          }
          continue;
        }
        const serialized = JSON.stringify(entry);
        if (LEGACY_MANAGED_HOOK_OR_EXT_REGEX.test(serialized)) {
          hadLegacyEntries = true;
          continue;
        }
        keptEntries.push(entry);
      }
      if (keptEntries.length === 0) {
        Reflect.deleteProperty(hooksObj, eventKey);
      } else {
        hooksObj[eventKey] = keptEntries;
      }
    }
    if (Object.keys(hooksObj).length === 0) {
      delete clone.hooks;
    }
  }

  // Strip legacy Pi extension `.pi/extensions/trellis/index.ts` or `./extensions/trellis/index.ts`
  if (Array.isArray(clone.extensions)) {
    const kept = clone.extensions.filter((item) => {
      const serialized = typeof item === "string" ? item : JSON.stringify(item);
      if (LEGACY_MANAGED_HOOK_OR_EXT_REGEX.test(serialized)) {
        hadLegacyEntries = true;
        return false;
      }
      return true;
    });
    if (kept.length !== clone.extensions.length) {
      clone.extensions = kept;
    }
  }

  // Strip legacy plugins array entries in opencode.json if present
  for (const arrayKey of ["plugins", "plugin", "instructions"]) {
    if (Array.isArray(clone[arrayKey])) {
      const arr = clone[arrayKey] as unknown[];
      const kept = arr.filter((item) => {
        const serialized =
          typeof item === "string" ? item : JSON.stringify(item);
        if (LEGACY_MANAGED_HOOK_OR_EXT_REGEX.test(serialized)) {
          hadLegacyEntries = true;
          return false;
        }
        return true;
      });
      if (kept.length === 0) {
        Reflect.deleteProperty(clone, arrayKey);
      } else {
        clone[arrayKey] = kept;
      }
    }
  }

  // Rewrite any remaining `.trellis` or `TRELLIS_` strings in user-defined keys
  const rewritten = rewriteStringsInJsonValue(clone, protectedTokens);
  if (rewritten.changed) {
    hadLegacyEntries = true;
  }

  const cleanedObj = rewritten.value as Record<string, unknown>;
  return {
    cleaned: cleanedObj,
    cleanedObj,
    hadLegacyEntries,
    hadClaudeStatusLine,
  };
}

/**
 * Merge preserved user settings from `cleanedUserObj` into the freshly generated
 * Omtre settings JSON on disk (or write `cleanedUserObj` directly if the
 * configurator did not create the file).
 */
export function mergePreservedSettingsIntoJson(
  freshObj: Record<string, unknown>,
  cleanedUserObj: Record<string, unknown>,
): Record<string, unknown> {
  const merged = JSON.parse(JSON.stringify(freshObj)) as Record<
    string,
    unknown
  >;

  for (const [key, userVal] of Object.entries(cleanedUserObj)) {
    if (key === "hooks" && isPlainObject(userVal)) {
      if (!isPlainObject(merged.hooks)) {
        merged.hooks = {};
      }
      const targetHooks = merged.hooks as Record<string, unknown>;
      for (const [eventKey, eventArr] of Object.entries(userVal)) {
        if (!Array.isArray(eventArr) || eventArr.length === 0) continue;
        const existingArr = Array.isArray(targetHooks[eventKey])
          ? (targetHooks[eventKey] as unknown[])
          : [];
        const existingSerialized = new Set(
          existingArr.map((item) => JSON.stringify(item)),
        );
        for (const entry of eventArr) {
          const s = JSON.stringify(entry);
          if (!existingSerialized.has(s)) {
            existingArr.push(entry);
            existingSerialized.add(s);
          }
        }
        targetHooks[eventKey] = existingArr;
      }
      continue;
    }

    if (
      (key === "extensions" || key === "prompts") &&
      Array.isArray(userVal) &&
      Array.isArray(merged[key])
    ) {
      const targetArr = merged[key] as unknown[];
      const existingSet = new Set(targetArr.map((x) => JSON.stringify(x)));
      for (const item of userVal) {
        const s = JSON.stringify(item);
        if (!existingSet.has(s)) {
          targetArr.push(item);
          existingSet.add(s);
        }
      }
      continue;
    }

    if (key === "env" && isPlainObject(userVal) && isPlainObject(merged.env)) {
      merged.env = {
        ...userVal,
        ...(merged.env as Record<string, unknown>),
      };
      continue;
    }

    if (!(key in merged)) {
      merged[key] = userVal;
    }
  }

  return merged;
}

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".gif",
  ".jpg",
  ".jpeg",
  ".webp",
  ".ico",
  ".svg",
  ".pdf",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".zip",
  ".tgz",
  ".gz",
  ".tar",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".wasm",
  ".pyc",
]);

export function isBinaryBuffer(filePath: string, buffer: Buffer): boolean {
  const ext = path.extname(filePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return true;
  const sampleLen = Math.min(buffer.length, 4096);
  for (let i = 0; i < sampleLen; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

/**
 * Regex used for scanning external repository files (report-only).
 * Per PRD 3.4: reports `.trellis/`, `TRELLIS_`, `TRELLIS:*`, `/trellis:`.
 */
const EXTERNAL_REPORT_REGEX =
  /(~\/\.trellis\b|\.trellis\/|\.trellis\b|TRELLIS_[A-Za-z0-9_]*|TRELLIS:[A-Za-z0-9_-]+|\/trellis:[A-Za-z0-9_-]*)/g;

export function scanExternalFileContent(
  relPath: string,
  content: string,
): MigrateExternalMatch[] {
  const norm = toPosix(relPath);
  const matches: MigrateExternalMatch[] = [];
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? "";
    const sanitized = rawLine.replace(ATTRIBUTION_URL_REGEX, "");
    EXTERNAL_REPORT_REGEX.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = EXTERNAL_REPORT_REGEX.exec(sanitized)) !== null) {
      matches.push({
        file: norm,
        line: i + 1,
        match: m[0],
        text: rawLine.trim(),
      });
    }
  }

  return matches;
}

/**
 * Walk a directory recursively and return all file paths (relative to `baseDir` in POSIX).
 */
export function walkFilesRecursive(
  baseDir: string,
  ignoreNames = new Set<string>(["__pycache__", "node_modules", ".git"]),
): string[] {
  if (!fs.existsSync(baseDir)) return [];
  const results: string[] = [];

  function visit(currentAbs: string, currentRel: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentAbs, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (ignoreNames.has(entry.name)) continue;
      const nextAbs = path.join(currentAbs, entry.name);
      const nextRel = currentRel ? `${currentRel}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        visit(nextAbs, nextRel);
      } else if (entry.isFile()) {
        results.push(toPosix(nextRel));
      }
    }
  }

  visit(baseDir, "");
  return results;
}

/**
 * Helper to compute or apply `rewriteTextContent` on a file if it is a text file.
 */
export function processFileRewrite(
  absPath: string,
  targetRelPath: string,
  sourceRelPathOrOptions?: string | RewriteContentOptions,
  maybeOptions?: RewriteContentOptions,
): MigrateRewriteFileDetail | null {
  const sourceRelPath =
    typeof sourceRelPathOrOptions === "string"
      ? sourceRelPathOrOptions
      : targetRelPath;
  const options: RewriteContentOptions =
    typeof sourceRelPathOrOptions === "object" &&
    sourceRelPathOrOptions !== null
      ? sourceRelPathOrOptions
      : (maybeOptions ?? {});

  let buffer: Buffer;
  try {
    buffer = fs.readFileSync(absPath);
  } catch {
    return null;
  }
  if (isBinaryBuffer(absPath, buffer)) return null;

  const original = buffer.toString("utf-8");
  const result = rewriteTextContent(original, options);
  if (result.replacements === 0 && result.content === original) {
    return null;
  }

  const shouldWrite = options.writeToDisk ?? !options.dryRun;
  if (shouldWrite) {
    writeFileAtomic(absPath, result.content);
  }

  return {
    file: toPosix(targetRelPath),
    sourceFile: toPosix(sourceRelPath),
    replacements: result.replacements,
    rules: result.rules,
  };
}
