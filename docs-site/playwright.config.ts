import { defineConfig } from "@playwright/test";

const port = 4175;
const baseURL = `http://127.0.0.1:${port}/omtre/`;

export default defineConfig({
  testDir: "./test/e2e",
  outputDir: "./.vitepress/test-results",
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [
        ["github"],
        ["html", { open: "never", outputFolder: ".vitepress/playwright-report" }],
      ]
    : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: {
    command: `pnpm exec vitepress preview --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
