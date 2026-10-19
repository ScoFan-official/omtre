import { spawnSync } from "node:child_process";
import chalk from "chalk";
import { VERSION } from "../constants/version.js";
import {
  GITHUB_RELEASES_HEADERS,
  RELEASES_API,
  RELEASES_REPO,
  pickLatestCliRelease,
  toCliReleaseTag,
  type GithubReleasePayload,
} from "../utils/github-releases.js";

/**
 * [oh-my] CLI releases ship as GitHub release tarballs on
 * `ScoFan-official/omtre` under `cli-v*` tags (channel A), not on
 * npm. `omtre upgrade` resolves the requested release tag to its `.tgz`
 * asset and installs it with `npm install -g <url>` — the same mechanism the
 * devin `oh-my-update` workflow uses.
 */

export interface UpgradeOptions {
  tag?: string;
  dryRun?: boolean;
}

interface SpawnResult {
  status: number | null;
  signal: NodeJS.Signals | null;
  error?: Error;
}

interface SpawnOptions {
  stdio: "inherit";
  shell: false;
}

type SpawnRunner = (
  command: string,
  args: string[],
  options: SpawnOptions,
) => SpawnResult;

export interface UpgradeCommandPlan {
  command: string;
  args: string[];
  spawnOptions: SpawnOptions;
  displayCommand: string;
  target: string;
  tag: string;
  binaryCheckCommand: string;
}

const RELEASE_TAG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Resolve the GitHub release tag to install. `latest` (the default) resolves
 * to the newest `cli-v*` release; anything else must look like a release tag
 * or version (`0.6.17-ohmy.2`, `v0.6.17-ohmy.2`, `cli-v0.6.17-ohmy.2`).
 */
export function resolveUpgradeTag(requestedTag?: string): string {
  if (!requestedTag || requestedTag === "latest") {
    return "latest";
  }
  if (!RELEASE_TAG_RE.test(requestedTag)) {
    throw new Error(
      `Invalid release tag/version "${requestedTag}". Use 'latest' or a release tag such as cli-v0.6.17-ohmy.1.`,
    );
  }
  return requestedTag;
}

interface ReleaseAssetResolution {
  tarballUrl: string;
  /** The resolved `tag_name` from the matched release. */
  tagName: string;
}

async function fetchReleasePayload(tag: string): Promise<GithubReleasePayload> {
  if (tag === "latest") {
    // `/releases/latest` cannot be used: the pack's own `vX.Y.Z` releases
    // share the same list endpoint. List and pick the newest `cli-v*` tag.
    const response = await fetch(RELEASES_API, {
      headers: GITHUB_RELEASES_HEADERS,
    });
    if (!response.ok) {
      throw new Error(
        `Could not list releases on github.com/${RELEASES_REPO} (HTTP ${response.status}).`,
      );
    }
    const releases = (await response.json()) as GithubReleasePayload[];
    const latest = pickLatestCliRelease(
      Array.isArray(releases) ? releases : [],
    );
    if (!latest) {
      throw new Error(
        `No cli-v* release found on github.com/${RELEASES_REPO}.`,
      );
    }
    return latest;
  }

  const releaseTag = toCliReleaseTag(tag);
  const response = await fetch(
    `${RELEASES_API}/tags/${encodeURIComponent(releaseTag)}`,
    {
      headers: GITHUB_RELEASES_HEADERS,
    },
  );
  if (response.ok) {
    return (await response.json()) as GithubReleasePayload;
  }
  throw new Error(
    `Could not resolve release "${releaseTag}" on github.com/${RELEASES_REPO} (HTTP ${response.status}).`,
  );
}

/** Resolve a release tag to its `.tgz` tarball asset URL. */
export async function resolveReleaseTarball(
  tag: string,
): Promise<ReleaseAssetResolution> {
  const release = await fetchReleasePayload(tag);
  const tarball = release.assets?.find(
    (a) =>
      typeof a.browser_download_url === "string" &&
      a.browser_download_url.endsWith(".tgz"),
  );
  if (!tarball?.browser_download_url) {
    throw new Error(
      `Release "${release.tag_name ?? tag}" on github.com/${RELEASES_REPO} has no .tgz asset to install.`,
    );
  }
  return {
    tarballUrl: tarball.browser_download_url,
    tagName: release.tag_name ?? tag,
  };
}

function binaryCheckCommand(
  platform: NodeJS.Platform = process.platform,
): string {
  return platform === "win32" ? "where omtre" : "which omtre";
}

export function buildUpgradeCommand(
  target: string,
  tag: string,
  platform: NodeJS.Platform = process.platform,
): UpgradeCommandPlan {
  const npmArgs = ["install", "-g", target];
  const displayCommand = `npm ${npmArgs.join(" ")}`;
  const spawnOptions: SpawnOptions = { stdio: "inherit", shell: false };

  if (platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", displayCommand],
      spawnOptions,
      displayCommand,
      target,
      tag,
      binaryCheckCommand: binaryCheckCommand(platform),
    };
  }

  return {
    command: "npm",
    args: npmArgs,
    spawnOptions,
    displayCommand,
    target,
    tag,
    binaryCheckCommand: binaryCheckCommand(platform),
  };
}

function troubleshooting(plan: UpgradeCommandPlan): string {
  return [
    "",
    "Troubleshooting:",
    `- Manual command: ${plan.displayCommand}`,
    "- Check npm global prefix and PATH: npm config get prefix",
    `- Check which Omtre binary your shell resolves: ${plan.binaryCheckCommand}`,
    "- If this is a permissions error, fix your Node/npm install or npm prefix; Omtre does not run sudo.",
    "- If npm reports an existing binary or locked file, resolve that npm error manually; Omtre does not run --force.",
  ].join("\n");
}

export async function upgrade(
  options: UpgradeOptions = {},
  runner: SpawnRunner = spawnSync,
): Promise<void> {
  const tag = resolveUpgradeTag(options.tag);
  const release = await resolveReleaseTarball(tag);
  const plan = buildUpgradeCommand(release.tarballUrl, release.tagName);

  console.log(chalk.cyan(`Upgrading Omtre CLI to ${release.tagName}`));
  console.log(chalk.gray(`Run: ${plan.displayCommand}`));

  if (options.dryRun) {
    console.log(chalk.gray("Dry run: no changes made."));
    return;
  }

  const result = runner(plan.command, plan.args, plan.spawnOptions);
  if (result.error) {
    throw new Error(
      `Failed to run npm. Install npm or run manually: ${plan.displayCommand}${troubleshooting(plan)}`,
    );
  }
  if (result.signal) {
    throw new Error(
      `npm install was interrupted by ${result.signal}.${troubleshooting(plan)}`,
    );
  }
  if (result.status === null) {
    throw new Error(
      `npm install failed without an exit status.${troubleshooting(plan)}`,
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `npm install failed with exit code ${result.status}.${troubleshooting(plan)}`,
    );
  }

  console.log(chalk.green("\n✓ Omtre CLI upgrade completed"));
  console.log(chalk.gray(`Run: omtre --version (was ${VERSION})`));
  console.log(chalk.gray(`Run: ${plan.binaryCheckCommand}`));
}
