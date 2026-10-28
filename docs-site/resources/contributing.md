---
title: 参与贡献
description: 编写、验证和提交 omtre 文档，以及从哪里开始参与产品贡献。
audience: contributor
maturity: stable
since: 1.0.0
---

# 参与贡献

<MaturityBadge level="stable" />

## 文档站开发

```bash
pnpm install
pnpm build
pnpm docs:dev
```

首次构建 CLI 后，`pnpm docs:dev` 可用于日常写作。需要检查真实构建产物时使用：

```bash
pnpm docs:preview
```

`docs:preview` 会先重新构建站点再启动预览，避免继续使用重建前的旧页面。

运行完整文档校验：

```bash
pnpm docs:verify
```

它会检查生成内容、页面结构、快速上手脚本，并执行 VitePress 构建。

## 新增页面

1. 选择页面类型：教程、概念、指南或参考；
2. 复制同类页面的结构；
3. 添加 frontmatter；
4. 更新 `.vitepress/sidebar.mjs`；
5. 从至少一个相关页面链接到新页；
6. 添加“下一步”；
7. 运行构建。

Frontmatter：

```yaml
---
title: 页面标题
description: 用于检索与社交分享的页面简要摘要（严格限制在 150 字以内）
audience: first-time | team | advanced | contributor
maturity: stable | mixed | advanced | out-of-scope
since: 1.0.0
---
```

## 技术写作与表达红线

所有面向开发者的文档编写必须严格遵守以下工程表达标准：
- **基调定位**：成熟工程师面对另一个工程师说话，客观、沉稳、直接，杜绝任何公关宣传腔与说教式口吻；
- **开门见山陈述事实**：**严禁使用套路化开场白**（如宣称“本页仅做某事”、“本篇不是……而是……”等套路式模板）；直接陈述技术事实、工程目的与操作路径；
- **拒绝居高临下的教学腔**：严禁出现口号式总结标头，或带有说教色彩的自问自答式评判过渡句；
- **严格区分机械阻断与提示词建议**：
  - 由本地脚本抛出错误码阻断的操作（如验证命令退出码非 0 拒绝归档、缺少 `.developer` 拒绝记录会话）明确标注为“机械硬闸门”；
  - 依赖大模型遵循的工作流指令（如“先写 PRD 再编码”、“控制单次修改文件数”）明确标注为“上下文引导（Soft Guidance）”，严禁将其虚假包装为安全沙箱；
- **平台差异必须明确前置条件**：严禁空泛承诺“全平台一致支持”；涉及特定平台特性的描述必须注明宿主依赖；
- **先给出可复现命令与 Dry-run**：涉及具有破坏性或写操作的命令，优先提供 `--dry-run` 预览示例，并说明预期控制台输出。

## 状态标签

在正文中使用：

```md
<MaturityBadge level="stable" />
<MaturityBadge level="mixed" />
<MaturityBadge level="advanced" />
<MaturityBadge level="out-of-scope" />
```

同时用正文解释为什么是该状态，不能只放标签。

## 命令与参数

CLI 参考由脚本生成，不要手工修改 `_cli.generated.md`。

修改 CLI 后：

```bash
pnpm build
node docs-site/scripts/generate-cli-reference.mjs
```

CI 会拒绝帮助输出与提交参考不一致的变更。

## 示例和截图

- 优先使用真实命令输出；
- 截图需去掉 secrets、用户名、内部路径和客户数据；
- 图表必须有等价文字；
- 不添加虚构案例或 Logo；
- 图片放在 `docs-site/public/` 并使用 base-aware 引用。

## 链接

- 内部链接指向真实页面；
- 不创建“即将推出”的空页面；
- 外部链接确认来源可信；
- 升级/迁移/消融等高风险页必须互链差异说明。

构建会检查死链。

## 本地验收

```bash
pnpm docs:verify
pnpm --dir docs-site exec playwright install chromium # 首次运行
pnpm docs:e2e
```

`docs:e2e` 会构建站点、启动本地预览，并验证桌面导航、搜索、全部 sitemap 页面、Mermaid、移动菜单和横向溢出。

再手工检查：

- 390px 手机宽度；
- 桌面宽度；
- 浅色/深色；
- 搜索；
- 键盘打开移动导航；
- 深链直接访问；
- 代码块复制。

## 产品与代码贡献

产品贡献先看仓库：

- [CONTRIBUTING.md](https://github.com/ScoFan-official/omtre/blob/main/CONTRIBUTING.md)
- [设计说明](https://github.com/ScoFan-official/omtre/blob/main/docs/design.md)
- [上游与发布策略](https://github.com/ScoFan-official/omtre/blob/main/docs/upstream.md)

新增技能、模板或市场资产前，先确认：

- 许可证；
- 来源与固定版本；
- 对目标平台的支持；
- 是否与现有资产重复；
- 是否真的需要在默认集合中出现。

## 文档变更 Review

Reviewer 应检查：

- 说的事实能否从代码/测试验证；
- 是否把 Roadmap 写成现状；
- 首次用户能否完成目标；
- 平台差异是否明确；
- 是否新增维护负担；
- 是否有更短、更直接的写法。

## 提交

按仓库已有约定：

```bash
git status --short
git diff
git add docs-site/<changed-files>
git commit -m "docs: ..."
```

不要提交构建产物、缓存、secrets 或无关文件。

## 下一步

- [使用案例](./use-cases.md)
- [更新日志](./changelog.md)
- [Skills](./skills.md)
