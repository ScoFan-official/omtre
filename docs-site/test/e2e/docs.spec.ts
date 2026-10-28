import { test, expect, type Page } from "@playwright/test";

function collectRuntimeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console: ${message.text()}`);
    }
  });
  return errors;
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow, "page must not scroll horizontally").toBe(false);
}

test.describe("desktop documentation", () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test("homepage navigation and local search work", async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.goto("./", { waitUntil: "networkidle" });

    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toContainText("让每一次 AI 编码");

    const wordmark = page.locator(".brand-wordmark-light");
    await expect(wordmark).toBeVisible();
    await expect(page.locator(".brand-wordmark:visible")).toHaveCount(1);
    expect(
      await wordmark.evaluate((image: HTMLImageElement) => image.naturalWidth),
    ).toBeGreaterThan(0);
    const headerLogo = page.locator(".VPNavBarTitle img:visible").first();
    await expect(headerLogo).toBeVisible();
    expect(
      await headerLogo.evaluate((image: HTMLImageElement) => image.naturalWidth),
    ).toBeGreaterThan(0);

    for (const label of ["开始使用", "使用指南", "进阶", "参考", "资源"]) {
      await expect(
        page.locator(".VPNavBarMenuLink", { hasText: label }),
      ).toBeVisible();
    }

    await page.getByRole("button", { name: "搜索文档" }).click();
    const search = page.locator('.VPLocalSearchBox input[type="search"]');
    await expect(search).toBeVisible();
    await search.fill("任务");

    const results = page.locator('[role="listbox"] a');
    await expect(results.first()).toBeVisible();
    expect(await results.count()).toBeGreaterThan(0);
    await page.keyboard.press("Escape");

    await expectNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test("every sitemap page renders and diagrams are valid", async ({
    page,
    request,
    baseURL,
  }) => {
    const errors = collectRuntimeErrors(page);
    const sitemapResponse = await request.get(
      new URL("sitemap.xml", baseURL).href,
    );
    expect(sitemapResponse.status()).toBe(200);

    const sitemap = await sitemapResponse.text();
    const routes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => new URL(match[1]).pathname,
    );
    expect(routes.length).toBeGreaterThanOrEqual(36);

    const origin = new URL(baseURL).origin;
    for (const route of routes) {
      const response = await page.goto(new URL(route, origin).href, {
        waitUntil: "networkidle",
      });
      expect(response?.status(), route).toBe(200);
      await expect(page.locator("h1"), route).toHaveCount(1);
      expect((await page.locator("body").innerText()).length, route).toBeGreaterThan(
        500,
      );
      await expectNoHorizontalOverflow(page);
    }

    await page.goto("start/how-it-works.html", {
      waitUntil: "networkidle",
    });
    await expect(page.locator(".mermaid svg")).toHaveCount(1);

    expect(errors).toEqual([]);
  });
});

test.describe("dark documentation theme", () => {
  test.use({ colorScheme: "dark", viewport: { width: 1440, height: 1000 } });

  test("dark logo and wordmark load without falling back to the light mark", async ({
    page,
  }) => {
    const errors = collectRuntimeErrors(page);
    await page.goto("./", { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveClass(/dark/);

    const wordmark = page.locator(".brand-wordmark-dark");
    await expect(wordmark).toBeVisible();
    await expect(page.locator(".brand-wordmark:visible")).toHaveCount(1);
    expect(
      await wordmark.evaluate((image: HTMLImageElement) => image.naturalWidth),
    ).toBeGreaterThan(0);

    const headerLogo = page.locator(".VPNavBarTitle img:visible").first();
    await expect(headerLogo).toBeVisible();
    expect(await headerLogo.getAttribute("src")).toContain("mark-dark.svg");
    expect(errors).toEqual([]);
  });
});

test.describe("mobile documentation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("menu opens and core pages fit the viewport", async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.goto("./", { waitUntil: "networkidle" });

    await page.locator(".VPNavBarHamburger").click();
    await expect(page.locator(".VPNavScreen")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("start/install-and-first-task.html", {
      waitUntil: "networkidle",
    });
    await expect(page.locator("h1")).toContainText("安装与第一个任务");
    await expectNoHorizontalOverflow(page);

    expect(errors).toEqual([]);
  });
});
