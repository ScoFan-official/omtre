import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildUpgradeCommand,
  resolveReleaseTarball,
  resolveUpgradeTag,
  upgrade,
} from "../../src/commands/upgrade.js";

const TARBALL_URL =
  "https://github.com/ScoFan-official/omtre/releases/download/cli-v0.6.17-ohmy.2/omtre-0.6.17-ohmy.2.tgz";

interface StubOptions {
  tagName?: string;
  withTgz?: boolean;
  /** Extra releases mixed into the list response (e.g. pack `v*` noise). */
  extraReleases?: { tag_name: string; assets?: object[] }[];
}

/**
 * Stub fetch to answer the GitHub releases API on
 * `ScoFan-official/omtre`. The list endpoint returns an ARRAY (CLI
 * `cli-v*` releases share it with the pack's own `v*` releases); the
 * `/releases/tags/<tag>` endpoint returns a single release object.
 */
function stubReleaseFetch(options: StubOptions = {}) {
  const {
    tagName = "cli-v0.6.17-ohmy.2",
    withTgz = true,
    extraReleases = [],
  } = options;
  const release = {
    tag_name: tagName,
    assets: withTgz
      ? [
          { name: "source.zip", browser_download_url: "https://x/z" },
          { name: "omtre.tgz", browser_download_url: TARBALL_URL },
        ]
      : [{ name: "source.zip", browser_download_url: "https://x/z" }],
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (!url.includes("api.github.com")) {
        return new Response("", { status: 404 });
      }
      if (/\/releases$/.test(url) || url.includes("/releases?")) {
        return new Response(
          JSON.stringify([release, ...extraReleases]),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify(release), { status: 200 });
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("upgrade command", () => {
  it("defaults to the latest GitHub release", () => {
    expect(resolveUpgradeTag()).toBe("latest");
    expect(resolveUpgradeTag(undefined)).toBe("latest");
    expect(resolveUpgradeTag("latest")).toBe("latest");
  });

  it("honors an explicit release tag or version", () => {
    expect(resolveUpgradeTag("cli-v0.6.17-ohmy.1")).toBe(
      "cli-v0.6.17-ohmy.1",
    );
    expect(resolveUpgradeTag("v0.6.17-ohmy.1")).toBe("v0.6.17-ohmy.1");
    expect(resolveUpgradeTag("0.6.17-ohmy.2")).toBe("0.6.17-ohmy.2");
  });

  it("rejects shell-shaped tags", () => {
    expect(() => resolveUpgradeTag("latest && rm -rf /")).toThrow(
      /Invalid release tag\/version/,
    );
  });

  it("resolves the .tgz asset of the latest cli-v* release", async () => {
    stubReleaseFetch({
      extraReleases: [
        // Pack release on the same list — must be ignored.
        { tag_name: "v1.0.0", assets: [] },
        // Older CLI release — must not win.
        {
          tag_name: "cli-v0.6.17-ohmy.1",
          assets: [
            {
              name: "old.tgz",
              browser_download_url: "https://x/old.tgz",
            },
          ],
        },
      ],
    });
    const release = await resolveReleaseTarball("latest");
    expect(release.tarballUrl).toBe(TARBALL_URL);
    expect(release.tagName).toBe("cli-v0.6.17-ohmy.2");
  });

  it("lists releases for latest — never the /latest shortcut (pack releases share the page)", async () => {
    stubReleaseFetch();
    const fetchMock = vi.mocked(fetch);
    await resolveReleaseTarball("latest");
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.endsWith("/releases/latest"))).toBe(false);
    expect(
      urls.some((u) =>
        u.startsWith(
          "https://api.github.com/repos/ScoFan-official/omtre/releases",
        ),
      ),
    ).toBe(true);
  });

  it("normalizes a bare or v-prefixed version to the cli-v* tag endpoint", async () => {
    stubReleaseFetch();
    const fetchMock = vi.mocked(fetch);
    await resolveReleaseTarball("0.6.17-ohmy.2");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/ScoFan-official/omtre/releases/tags/cli-v0.6.17-ohmy.2",
      expect.anything(),
    );
  });

  it("fails when the release has no tarball asset", async () => {
    stubReleaseFetch({ tagName: "cli-v9.9.9", withTgz: false });
    await expect(resolveReleaseTarball("latest")).rejects.toThrow(
      /no \.tgz asset/,
    );
  });

  it("builds POSIX npm global install command without shell", () => {
    expect(
      buildUpgradeCommand(TARBALL_URL, "cli-v0.6.17-ohmy.2", "darwin"),
    ).toMatchObject({
      command: "npm",
      args: ["install", "-g", TARBALL_URL],
      spawnOptions: { stdio: "inherit", shell: false },
      displayCommand: `npm install -g ${TARBALL_URL}`,
      target: TARBALL_URL,
      tag: "cli-v0.6.17-ohmy.2",
      binaryCheckCommand: "which omtre",
    });
  });

  it("builds Windows command through cmd.exe", () => {
    expect(
      buildUpgradeCommand(TARBALL_URL, "cli-v0.6.17-ohmy.2", "win32"),
    ).toMatchObject({
      command: "cmd.exe",
      args: ["/d", "/s", "/c", `npm install -g ${TARBALL_URL}`],
      spawnOptions: { stdio: "inherit", shell: false },
      displayCommand: `npm install -g ${TARBALL_URL}`,
      target: TARBALL_URL,
      tag: "cli-v0.6.17-ohmy.2",
      binaryCheckCommand: "where omtre",
    });
  });

  it("dry-run does not execute npm", async () => {
    stubReleaseFetch();
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const runner = vi.fn();

    await upgrade({ dryRun: true, tag: "latest" }, runner);

    expect(runner).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(`Run: npm install -g ${TARBALL_URL}`),
    );

    log.mockRestore();
  });

  it("executes npm install of the release tarball for real upgrades", async () => {
    stubReleaseFetch();
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const runner = vi.fn(() => ({ status: 0, signal: null }));

    await upgrade({ tag: "latest" }, runner);

    const isWindows = process.platform === "win32";
    expect(runner).toHaveBeenCalledWith(
      isWindows ? "cmd.exe" : "npm",
      isWindows
        ? ["/d", "/s", "/c", `npm install -g ${TARBALL_URL}`]
        : ["install", "-g", TARBALL_URL],
      { stdio: "inherit", shell: false },
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("omtre --version"),
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(isWindows ? "where omtre" : "which omtre"),
    );

    log.mockRestore();
  });

  it("fails when npm exits non-zero", async () => {
    stubReleaseFetch();
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const runner = vi.fn(() => ({ status: 1, signal: null }));

    await expect(upgrade({ tag: "latest" }, runner)).rejects.toThrow(
      /npm install failed with exit code 1/,
    );

    log.mockRestore();
  });
});
