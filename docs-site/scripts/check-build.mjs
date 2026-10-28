import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sidebar } from "../.vitepress/sidebar.mjs";

const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(docsRoot, ".vitepress", "dist");
const errors = [];

function requireFile(path, label) {
  if (!existsSync(path)) {
    errors.push(`Missing ${label}: ${path}`);
    return false;
  }
  return true;
}

function assertPage(route, label) {
  const path = join(dist, `${route}.html`);
  if (!requireFile(path, label)) return;
  const html = readFileSync(path, "utf8");
  if (html.length < 2500) {
    errors.push(`${label} looks too short (${html.length} bytes).`);
  }
  if (html.includes("__OMTRE_VERSION__")) {
    errors.push(`${label} contains an unresolved __OMTRE_VERSION__ token.`);
  }
  if (html.includes("Internal Server Error")) {
    errors.push(`${label} contains an internal server error page.`);
  }
}

const homePath = join(dist, "index.html");
if (requireFile(homePath, "homepage")) {
  const home = readFileSync(homePath, "utf8");
  for (const text of ["让每一次 AI 编码", "从第一个任务开始", "omtre"]) {
    if (!home.includes(text)) {
      errors.push(`Homepage does not contain expected rendered text: ${text}`);
    }
  }
}

const pageRoutes = new Set();
for (const sections of Object.values(sidebar)) {
  for (const section of sections) {
    for (const item of section.items ?? []) {
      pageRoutes.add(item.link.slice(1));
      assertPage(item.link.slice(1), item.link);
    }
  }
}

const cliPath = join(dist, "reference", "cli.html");
if (existsSync(cliPath)) {
  const cli = readFileSync(cliPath, "utf8");
  if (!cli.includes("Usage: omtre")) {
    errors.push("CLI reference page is missing generated help output.");
  }
  if (cli.includes("<!--@include:")) {
    errors.push("CLI reference page contains an unresolved include directive.");
  }
}

for (const [file, label] of [
  ["favicon.ico", "favicon"],
  ["favicon-32.png", "favicon PNG"],
  ["apple-touch-icon.png", "Apple touch icon"],
  ["brand/mark-light.svg", "light brand mark"],
  ["brand/mark-dark.svg", "dark brand mark"],
  ["brand/wordmark-light.webp", "light wordmark"],
  ["brand/wordmark-dark.webp", "dark wordmark"],
  ["brand/og.png", "social image"],
  ["llms.txt", "llms.txt"],
  ["sitemap.xml", "sitemap"],
]) {
  requireFile(join(dist, file), label);
}

const notFound = join(dist, "404.html");
if (existsSync(notFound) && statSync(notFound).size < 1000) {
  errors.push("404.html looks empty.");
}

if (existsSync(dist)) {
  const expectedHtml = new Set([
    "index.html",
    "404.html",
    ...[...pageRoutes].map((route) => `${route}.html`),
  ]);
  const actualHtml = readdirSync(dist, { recursive: true })
    .map((entry) => String(entry).replaceAll("\\", "/"))
    .filter((entry) => entry.endsWith(".html"))
    .sort();
  for (const file of actualHtml) {
    if (!expectedHtml.has(file)) {
      errors.push(`Unexpected HTML page in build output: ${file}`);
    }
  }
  for (const file of expectedHtml) {
    if (!actualHtml.includes(file)) {
      errors.push(`Expected HTML page is missing from build output: ${file}`);
    }
  }

  const sitemapPath = join(dist, "sitemap.xml");
  if (existsSync(sitemapPath)) {
    const sitemap = readFileSync(sitemapPath, "utf8");
    const sitemapRoutes = new Set(
      [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => {
        const pathname = new URL(match[1]).pathname;
        const relative = pathname.replace(/^\/omtre\/?/, "");
        return relative === "" ? "index.html" : relative;
      }),
    );
    const expectedSitemap = new Set([
      "index.html",
      ...[...pageRoutes].map((route) => `${route}.html`),
    ]);
    for (const route of sitemapRoutes) {
      if (!expectedSitemap.has(route)) {
        errors.push(`Unexpected route in sitemap.xml: ${route}`);
      }
    }
    for (const route of expectedSitemap) {
      if (!sitemapRoutes.has(route)) {
        errors.push(`Expected route is missing from sitemap.xml: ${route}`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error("Built documentation checks failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Built documentation checks passed: homepage, ${Object.values(sidebar).flat().reduce((count, section) => count + (section.items?.length ?? 0), 0)} pages, assets, sitemap.`,
);
