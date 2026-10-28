import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";
import { nav, sidebar } from "./sidebar.mjs";

const cliPackage = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../packages/cli/package.json", import.meta.url)),
    "utf8",
  ),
);
const version = cliPackage.version;
const siteUrl = "https://scofan-official.github.io/omtre/";

export default withMermaid(
  defineConfig({
    lang: "zh-CN",
    title: "omtre 文档",
    titleTemplate: ":title · omtre",
    description:
      "面向 AI 编码代理的仓库内工作流：用规范、任务和项目记忆让每次会话沿着团队约定推进。",
    base: "/omtre/",
    cleanUrls: false,
    srcExclude: [
      "reference/_cli.generated.md",
      "test-results/**",
      "playwright-report/**",
    ],
    lastUpdated: true,
    ignoreDeadLinks: false,
    appearance: true,
    sitemap: {
      hostname: siteUrl,
    },
    head: [
      [
        "link",
        {
          rel: "icon",
          href: "/omtre/favicon.ico",
          sizes: "16x16 32x32 48x48",
        },
      ],
      [
        "link",
        {
          rel: "icon",
          type: "image/svg+xml",
          href: "/omtre/brand/mark-light.svg",
          media: "(prefers-color-scheme: light)",
        },
      ],
      [
        "link",
        {
          rel: "icon",
          type: "image/svg+xml",
          href: "/omtre/brand/mark-dark.svg",
          media: "(prefers-color-scheme: dark)",
        },
      ],
      [
        "link",
        {
          rel: "icon",
          type: "image/png",
          sizes: "32x32",
          href: "/omtre/favicon-32.png",
        },
      ],
      [
        "link",
        {
          rel: "apple-touch-icon",
          sizes: "180x180",
          href: "/omtre/apple-touch-icon.png",
        },
      ],
      [
        "meta",
        {
          name: "theme-color",
          content: "#ffffff",
          media: "(prefers-color-scheme: light)",
        },
      ],
      [
        "meta",
        {
          name: "theme-color",
          content: "#0b0f14",
          media: "(prefers-color-scheme: dark)",
        },
      ],
      ["meta", { property: "og:type", content: "website" }],
      ["meta", { property: "og:locale", content: "zh_CN" }],
      ["meta", { property: "og:title", content: "omtre 文档" }],
      [
        "meta",
        {
          property: "og:description",
          content:
            "从第一个任务开始，理解并正确使用面向 AI 编码代理的 omtre 工作流。",
        },
      ],
      ["meta", { property: "og:image", content: `${siteUrl}brand/og.png` }],
      ["meta", { property: "og:image:width", content: "1200" }],
      ["meta", { property: "og:image:height", content: "630" }],
      ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ],
    define: {},
    markdown: {
      theme: {
        light: "github-light",
        dark: "github-dark",
      },
    },
    vite: {
      optimizeDeps: {
        include: ["mermaid", "vitepress-plugin-mermaid"],
      },
    },
    themeConfig: {
      omtreVersion: version,
      logo: {
        light: "/brand/mark-light.svg",
        dark: "/brand/mark-dark.svg",
        alt: "",
      },
      siteTitle: "omtre 文档",
      nav,
      sidebar,
      outline: {
        level: [2, 3],
        label: "本页目录",
      },
      search: {
        provider: "local",
        options: {
          detailedView: true,
          translations: {
            button: {
              buttonText: "搜索文档",
              buttonAriaLabel: "搜索文档",
            },
            modal: {
              displayDetails: "显示详情",
              resetButtonTitle: "清除查询",
              backButtonTitle: "关闭搜索",
              noResultsText: "没有找到相关结果",
              footer: {
                selectText: "选择",
                selectKeyAriaLabel: "Enter",
                navigateText: "切换",
                navigateUpKeyAriaLabel: "向上箭头",
                navigateDownKeyAriaLabel: "向下箭头",
                closeText: "关闭",
                closeKeyAriaLabel: "Escape",
              },
            },
          },
        },
      },
      editLink: {
        pattern:
          "https://github.com/ScoFan-official/omtre/edit/main/docs-site/:path",
        text: "在 GitHub 上编辑此页",
      },
      lastUpdated: {
        text: "最后更新于",
        formatOptions: {
          dateStyle: "medium",
          timeStyle: "short",
        },
      },
      docFooter: {
        prev: "上一页",
        next: "下一页",
      },
      returnToTopLabel: "回到顶部",
      sidebarMenuLabel: "文档目录",
      darkModeSwitchLabel: "切换主题",
      lightModeSwitchTitle: "切换到浅色模式",
      darkModeSwitchTitle: "切换到深色模式",
      externalLinkIcon: true,
      notFound: {
        title: "页面不存在",
        quote: "这个地址没有对应页面，也可能是文档刚刚迁移。",
        linkLabel: "返回首页",
        linkText: "回到文档首页",
      },
      footer: {
        message:
          "omtre 以 AGPL-3.0 发布。文档对应 1.0.0，内容以真实行为和可验证边界为准。",
        copyright: "Copyright © 2026 ScoFan-official",
      },
      socialLinks: [
        {
          icon: "github",
          link: "https://github.com/ScoFan-official/omtre",
          ariaLabel: "omtre GitHub 仓库",
        },
      ],
    },
    mermaid: {
      theme: "base",
      themeVariables: {
        primaryColor: "#eef5ff",
        primaryTextColor: "#0b0f14",
        primaryBorderColor: "#2f81f7",
        lineColor: "#57606a",
        secondaryColor: "#e8f7ee",
        tertiaryColor: "#f6f8fa",
        fontFamily:
          "Inter, SF Pro Text, PingFang SC, Microsoft YaHei, sans-serif",
        fontSize: "14px",
      },
    },
    mermaidPlugin: {
      class: "mermaid",
    },
  }),
);
