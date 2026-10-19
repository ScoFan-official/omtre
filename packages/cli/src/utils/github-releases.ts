import { compareOhmyVersions } from "./compare-versions.js";

/**
 * [oh-my] CLI tarballs publish as GitHub releases on
 * `ScoFan-official/omtre` under `cli-v<upstream>-ohmy.<N>` tags.
 *
 * That repo also ships its own pack releases tagged `vX.Y.Z`, and both tag
 * streams share the `/releases` list — so consumers must filter on the
 * `cli-v` prefix and pick the newest match themselves instead of calling
 * `/releases/latest` (which can resolve to a pack release).
 */
export const RELEASES_REPO = "ScoFan-official/omtre";
export const RELEASES_API = `https://api.github.com/repos/${RELEASES_REPO}/releases`;
export const CLI_TAG_PREFIX = "cli-v";

export const GITHUB_RELEASES_HEADERS = {
  Accept: "application/vnd.github+json",
  "User-Agent": "omtre",
};

export interface GithubReleasePayload {
  tag_name?: string;
  draft?: boolean;
  assets?: { name?: string; browser_download_url?: string }[];
}

export function isCliReleaseTag(
  tagName: string | undefined | null,
): tagName is string {
  return typeof tagName === "string" && tagName.startsWith(CLI_TAG_PREFIX);
}

/** `cli-v0.6.17-ohmy.2` → `0.6.17-ohmy.2`. */
export function cliReleaseVersion(tagName: string): string {
  return tagName.slice(CLI_TAG_PREFIX.length);
}

/**
 * Normalize a user-supplied tag/version to the canonical `cli-v*` release
 * tag: `0.6.17-ohmy.2`, `v0.6.17-ohmy.2` and `cli-v0.6.17-ohmy.2` all resolve
 * to `cli-v0.6.17-ohmy.2`.
 */
export function toCliReleaseTag(tag: string): string {
  if (tag.startsWith(CLI_TAG_PREFIX)) return tag;
  return `${CLI_TAG_PREFIX}${tag.startsWith("v") ? tag.slice(1) : tag}`;
}

/**
 * Pick the newest `cli-v*` release from a `/releases` list payload.
 * Non-CLI tags and drafts are ignored; the winner is chosen by fork-aware
 * version order, not list position (list order is creation date).
 */
export function pickLatestCliRelease(
  releases: GithubReleasePayload[],
): GithubReleasePayload | undefined {
  let latest: GithubReleasePayload | undefined;
  let latestVersion: string | undefined;
  for (const release of releases) {
    if (release.draft || !isCliReleaseTag(release.tag_name)) continue;
    const version = cliReleaseVersion(release.tag_name);
    if (
      latestVersion === undefined ||
      compareOhmyVersions(version, latestVersion) > 0
    ) {
      latest = release;
      latestVersion = version;
    }
  }
  return latest;
}
