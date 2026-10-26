import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sidebar } from "../.vitepress/sidebar.mjs";

const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(docsRoot, "..");
const outputPath = join(docsRoot, "public", "llms.txt");
const check = process.argv.includes("--check");
const siteUrl = "https://scofan-official.github.io/omtre";
const cliPackage = JSON.parse(
  readFileSync(join(repoRoot, "packages", "cli", "package.json"), "utf8"),
);

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!field) continue;
    data[field[1]] = field[2].replace(/^["']|["']$/g, "").trim();
  }
  return data;
}

const lines = [
  "# omtre 文档",
  "",
  `> 面向 AI 编码代理的仓库内工作流。中文文档，对应 omtre ${cliPackage.version}。`,
  "> 完整页面以 Markdown 描述，并链接到 GitHub Pages 上的 HTML 版本。",
  "",
  "## 首页",
  "",
  `- [omtre 文档](${siteUrl}/): 从第一个任务开始理解规范、任务、检查和项目记忆。`,
];

for (const items of Object.values(sidebar)) {
  const group = items[0]?.text ?? "文档";
  lines.push("", `## ${group}`, "");
  for (const section of items) {
    if (items.length > 1) {
      lines.push(`### ${section.text}`, "");
    }
    for (const item of section.items ?? []) {
      const filePath = join(docsRoot, `${item.link.slice(1)}.md`);
      if (!existsSync(filePath)) {
        console.error(`Missing page for llms.txt: ${item.link}`);
        process.exit(1);
      }
      const meta = parseFrontmatter(readFileSync(filePath, "utf8"));
      const description = meta.description || meta.title || item.text;
      lines.push(
        `- [${meta.title || item.text}](${siteUrl}${item.link}.html): ${description}`,
      );
    }
    if (items.length > 1) lines.push("");
  }
}

const output = `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;

if (check) {
  const current = existsSync(outputPath) ? readFileSync(outputPath, "utf8") : "";
  if (current !== output) {
    console.error(
      "llms.txt is stale. Run `node docs-site/scripts/generate-llms.mjs`.",
    );
    process.exit(1);
  }
  console.log("llms.txt is up to date.");
} else {
  writeFileSync(outputPath, output, "utf8");
  console.log(`Generated ${outputPath}`);
}
