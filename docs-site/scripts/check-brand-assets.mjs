import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(docsRoot, "public");
const errors = [];

function requireFile(path, label) {
  if (!existsSync(path)) {
    errors.push(`Missing ${label}: ${path}`);
    return false;
  }
  return true;
}

function checkPng(path, expectedWidth, expectedHeight, label) {
  if (!requireFile(path, label)) return;
  const buffer = readFileSync(path);
  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature) {
    errors.push(`${label} is not a valid PNG.`);
    return;
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width !== expectedWidth || height !== expectedHeight) {
    errors.push(
      `${label} must be ${expectedWidth}x${expectedHeight}, got ${width}x${height}.`,
    );
  }
}

function checkIco(path) {
  if (!requireFile(path, "favicon.ico")) return;
  const buffer = readFileSync(path);
  if (buffer.length < 6 || buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1) {
    errors.push("favicon.ico has an invalid ICONDIR header.");
    return;
  }
  const count = buffer.readUInt16LE(4);
  if (count < 3) {
    errors.push(`favicon.ico must contain at least 3 images, found ${count}.`);
  }
  const sizes = new Set();
  for (let index = 0; index < count; index += 1) {
    const offset = 6 + index * 16;
    if (offset + 16 > buffer.length) {
      errors.push("favicon.ico directory is truncated.");
      return;
    }
    sizes.add(buffer[offset] === 0 ? 256 : buffer[offset]);
  }
  for (const size of [16, 32, 48]) {
    if (!sizes.has(size)) errors.push(`favicon.ico is missing a ${size}px image.`);
  }
}

function checkSvg(path, requiredColors, label) {
  if (!requireFile(path, label)) return;
  const svg = readFileSync(path, "utf8");
  if (/<script\b|<foreignObject\b/i.test(svg)) {
    errors.push(`${label} contains executable or foreign markup.`);
  }
  if (/\b(?:href|xlink:href)=["']https?:/i.test(svg)) {
    errors.push(`${label} contains an external resource reference.`);
  }
  if (!svg.includes("<title")) errors.push(`${label} is missing an accessible title.`);
  for (const color of requiredColors) {
    if (!svg.toLowerCase().includes(color.toLowerCase())) {
      errors.push(`${label} is missing brand color ${color}.`);
    }
  }
}

function checkWebp(path, label) {
  if (!requireFile(path, label)) return;
  const buffer = readFileSync(path);
  if (
    buffer.subarray(0, 4).toString() !== "RIFF" ||
    buffer.subarray(8, 12).toString() !== "WEBP"
  ) {
    errors.push(`${label} is not a valid WebP file.`);
  }
  if (buffer.length < 5000) {
    errors.push(`${label} is unexpectedly small (${buffer.length} bytes).`);
  }
}

checkIco(join(publicDir, "favicon.ico"));
checkPng(join(publicDir, "favicon-32.png"), 32, 32, "favicon-32.png");
checkPng(join(publicDir, "apple-touch-icon.png"), 180, 180, "apple-touch-icon.png");
checkPng(join(publicDir, "brand", "og.png"), 1200, 630, "brand/og.png");
checkSvg(
  join(publicDir, "brand", "mark-light.svg"),
  ["#0d1117", "#2f81f7"],
  "brand/mark-light.svg",
);
checkSvg(
  join(publicDir, "brand", "mark-dark.svg"),
  ["#e6edf3", "#2f81f7"],
  "brand/mark-dark.svg",
);
checkWebp(join(publicDir, "brand", "wordmark-light.webp"), "brand/wordmark-light.webp");
checkWebp(join(publicDir, "brand", "wordmark-dark.webp"), "brand/wordmark-dark.webp");

for (const retired of ["omtre-mark.svg", "og.svg"]) {
  if (existsSync(join(publicDir, retired))) {
    errors.push(`Retired asset is still present: public/${retired}`);
  }
}

if (errors.length > 0) {
  console.error("Brand asset checks failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Brand asset checks passed: favicon (${statSync(join(publicDir, "favicon.ico")).size} bytes), marks, wordmarks, OG (1200x630).`,
);
