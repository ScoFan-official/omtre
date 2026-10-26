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
pnpm docs:dev
```

默认本地地址由 VitePress 输出。构建：

```bash
pnpm docs:build
```

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
description: 用于搜索和分享的一句话
audience: first-time | team | advanced | contributor
maturity: stable | mixed | advanced | out-of-scope
since: 1.0.0
---
```

## 写作规则

- 中文正文使用第二人称“你”；
- 先写用户要完成的事，再解释机制；
- 命令可复制，变量使用 `<your-name>`；
- 说明预期结果和验证方式；
- 明确区分机械阻断与提示词约束；
- 平台差异必须写条件；
- 不写“完全自动”“保证跳过不了”“所有平台一致”等绝对表述；
- 不复制上游文档措辞；
- 安全操作先给 `--dry-run`；
- 每页结尾给出下一步。

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
```

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
