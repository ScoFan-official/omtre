---
title: 更新日志
description: omtre 独立版本线与当前文档对应的版本。详细发布历史以仓库 CHANGELOG 为准。
audience: team
maturity: stable
since: 1.0.0
---

# 更新日志

<MaturityBadge level="stable" />

本文档站对应 omtre **1.0.0**。版本号来自 `packages/cli/package.json`，构建时注入页面，不在文档中维护第二份版本真源。

## 1.0.0

独立产品线的首个版本。

主要内容：

- 使用独立的 `omtre` / `omt` CLI 与 `.omtre/` 目录；
- npm 主发布通道与 GitHub Release tgz 备用通道；
- 发布 tag 使用 `cli-v<version>`；
- 核心库 `@omtre/core` 捆绑进 CLI；
- 保留上游 0.6.x 迁移能力；
- 建立中文文档站；
- 将规范、任务、workspace、agents 和平台适配统一到独立产品面。

## 版本线说明

| 项目 | 版本来源 |
|---|---|
| CLI / npm | `packages/cli/package.json` |
| Core | `packages/core/package.json` |
| 发布 tag | `cli-v<version>` |
| 根 `VERSION` | 旧技能包版本，不是 CLI 版本 |
| 文档页头 | 从 CLI package 注入 |

## 如何升级

```bash
omtre upgrade
omtre --version
omtre update --dry-run
omtre update
```

两个版本层与冲突处理见[升级、回滚与卸载](../guide/upgrade-and-remove.md)。

## 详细历史

完整发布说明、修复和上游历史保留在仓库：

- [CHANGELOG.md](https://github.com/ScoFan-official/omtre/blob/main/CHANGELOG.md)
- [Fork 历史](https://github.com/ScoFan-official/omtre/blob/main/docs/changelog-fork.md)
- [GitHub Releases](https://github.com/ScoFan-official/omtre/releases)

本站不复制全部历史正文，避免两个真源。

## 文档与版本

- 首版只覆盖当前稳定版本；
- 不提供历史版本文档切换；
- CLI 参考由构建时帮助输出生成；
- 发布前必须通过文档完整校验；
- 文档声明如果与代码不一致，以可执行代码、CLI 输出和测试为准。

## 下一步

- [参与贡献](./contributing.md)
- [CLI 命令](../reference/cli.md)
- [FAQ](../reference/faq.md)
