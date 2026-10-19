/**
 * Regression test for #383 — registry spec updates never pulled.
 *
 * `downloadWithStrategy()` used to pass `preferOffline: true` to giget on
 * every call site, so giget served the stale cached tarball even when the
 * network was available and the remote registry had new content. Verify
 * none of the `downloadTemplate()` call sites request offline-preferred
 * downloads.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const downloadTemplateMock = vi.fn(async (_source: string, options: { dir: string }) => {
  fs.mkdirSync(options.dir, { recursive: true });
  fs.writeFileSync(path.join(options.dir, "marker.txt"), "content");
  return {};
});

vi.mock("giget", () => ({
  downloadTemplate: (...args: [string, { dir: string }]) =>
    downloadTemplateMock(...args),
}));

const { downloadWithStrategy } = await import("../../src/utils/template-fetcher.js");

describe("downloadWithStrategy — #383 preferOffline removed", () => {
  afterEach(() => {
    downloadTemplateMock.mockClear();
  });

  it("does not set preferOffline for a fresh directory download", async () => {
    const destDir = fs.mkdtempSync(path.join(os.tmpdir(), "omtre-dl-"));
    fs.rmSync(destDir, { recursive: true, force: true });

    await downloadWithStrategy("gh:org/repo/spec", destDir, "skip");

    expect(downloadTemplateMock).toHaveBeenCalledTimes(1);
    const options = downloadTemplateMock.mock.calls[0][1];
    expect(options).not.toHaveProperty("preferOffline");

    fs.rmSync(destDir, { recursive: true, force: true });
  });

  it("does not set preferOffline for overwrite strategy", async () => {
    const destDir = fs.mkdtempSync(path.join(os.tmpdir(), "omtre-dl-"));
    fs.writeFileSync(path.join(destDir, "existing.txt"), "old");

    await downloadWithStrategy("gh:org/repo/spec", destDir, "overwrite");

    expect(downloadTemplateMock).toHaveBeenCalledTimes(1);
    const options = downloadTemplateMock.mock.calls[0][1];
    expect(options).not.toHaveProperty("preferOffline");

    fs.rmSync(destDir, { recursive: true, force: true });
  });

  it("does not set preferOffline for append strategy", async () => {
    const destDir = fs.mkdtempSync(path.join(os.tmpdir(), "omtre-dl-"));
    fs.writeFileSync(path.join(destDir, "existing.txt"), "old");

    await downloadWithStrategy("gh:org/repo/spec", destDir, "append");

    expect(downloadTemplateMock).toHaveBeenCalledTimes(1);
    const options = downloadTemplateMock.mock.calls[0][1];
    expect(options).not.toHaveProperty("preferOffline");

    fs.rmSync(destDir, { recursive: true, force: true });
  });
});
