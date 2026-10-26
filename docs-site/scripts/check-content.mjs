import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sidebar } from "../.vitepress/sidebar.mjs";

const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(docsRoot, "..");
const cliVersion = JSON.parse(
  readFileSync(join(repoRoot, "packages", "cli", "package.json"), "utf8"),
).version;
const errors = [];
const allowedAudiences = new Set(["first-time", "team", "advanced", "contributor"]);
const allowedMaturity = new Set(["stable", "mixed", "advanced", "out-of-scope"]);
const pagePaths = new Set();

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!field) continue;
    data[field[1]] = field[2].replace(/^["']|["']$/g, "").trim();
  }
  return data;
}

for (const sections of Object.values(sidebar)) {
  for (const section of sections) {
    for (const item of section.items ?? []) {
      pagePaths.add(item.link);
    }
  }
}

if (pagePaths.size !== 35) {
  errors.push(`Expected 35 sidebar pages, found ${pagePaths.size}.`);
}

for (const link of pagePaths) {
  const rel = `${link.slice(1)}.md`;
  const full = join(docsRoot, rel);
  if (!existsSync(full)) {
    errors.push(`Sidebar page does not exist: ${rel}`);
    continue;
  }

  const text = readFileSync(full, "utf8");
  const meta = parseFrontmatter(text);
  if (!meta) {
    errors.push(`${rel}: missing frontmatter.`);
    continue;
  }

  for (const field of ["title", "description", "audience", "maturity", "since"]) {
    if (!meta[field]) errors.push(`${rel}: missing frontmatter field "${field}".`);
  }
  if (meta.audience && !allowedAudiences.has(meta.audience)) {
    errors.push(`${rel}: invalid audience "${meta.audience}".`);
  }
  if (meta.maturity && !allowedMaturity.has(meta.maturity)) {
    errors.push(`${rel}: invalid maturity "${meta.maturity}".`);
  }
  if (text.replace(/^---[\s\S]*?---/, "").trim().length < 500) {
    errors.push(`${rel}: page body is too short to be substantive.`);
  }
  if (!/^## 下一步$/m.test(text)) {
    errors.push(`${rel}: missing "## 下一步" section.`);
  }
  const h1Matches = [];
  let inFence = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && /^# /.test(line)) h1Matches.push(line);
  }
  if (h1Matches.length !== 1) {
    errors.push(`${rel}: expected exactly one H1, found ${h1Matches.length}.`);
  } else if (meta.title && h1Matches[0].slice(2).trim() !== meta.title) {
    errors.push(`${rel}: H1 does not match frontmatter title.`);
  }
  if (/\b(TODO|TBD|FIXME)\b|待补充|占位页/.test(text)) {
    errors.push(`${rel}: contains an unfinished placeholder marker.`);
  }

  for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const clean = target.split("#")[0];
    if (!clean.endsWith(".md")) continue;
    const resolved = clean.startsWith("/")
      ? join(docsRoot, `${clean.slice(1)}.md`)
      : resolve(dirname(full), clean);
    if (!existsSync(resolved)) {
      errors.push(`${rel}: relative link target does not exist: ${target}`);
    }
  }
}

const home = join(docsRoot, "index.md");
if (!existsSync(home)) {
  errors.push("Missing docs-site/index.md.");
}

const changelog = join(docsRoot, "resources", "changelog.md");
if (existsSync(changelog)) {
  const text = readFileSync(changelog, "utf8");
  if (!new RegExp(`^## ${cliVersion.replace(/\./g, "\\.")}$`, "m").test(text)) {
    errors.push(
      `resources/changelog.md does not document the current CLI version ${cliVersion}.`,
    );
  }
}

if (errors.length > 0) {
  console.error("Documentation content checks failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Documentation content checks passed: ${pagePaths.size} sidebar pages plus homepage.`,
);
