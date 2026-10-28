---
title: 更新日志
description: omtre 独立版本线与当前文档对应的版本。详细发布历史以仓库 CHANGELOG 为准。
audience: team
maturity: stable
since: 1.0.0
---

# 更新日志

<MaturityBadge level="stable" />

本文档站内容与 omtre CLI **1.0.0** 严格绑定。当前版本号来源于代码仓库 `packages/cli/package.json`，在静态构建时由脚本自动注入，不在文档正文中维护易失步的第二份版本真源。

## 1.0.0

omtre 独立产品线的首个正式发布版本。

### 核心特性与架构变更
- **独立品牌与主轴**：建立独立的 `omtre` / `omt` CLI 二进制与 `.omtre/` 统一仓库事实主轴；
- **双通道分发**：以 npm 官方注册表为主发布通道，提供 GitHub Releases 独立 `.tgz` 离线部署包；
- **独立语义化发布线**：发布 Git Tag 采用 `cli-v<version>` 规范，与上游历史版本彻底解耦；
- **内置核心 SDK**：核心库 `@omtre/core` 随 CLI 安装包一体化捆绑发布，免除额外依赖配置；
- **平滑历史迁移**：内置 `omtre migrate` 迁移引擎，支持从上游 0.6.x 历史项目迁移；
- **官方中文文档站**：建立基于 VitePress 的独立中文工程文档与自动化断言校验体系；
- **工程资产统一治理**：将规范体系（spec）、任务生命周期（tasks）、开发者工作区（workspace）、角色卡（agents）与 22 个平台适配统一纳入同一生命周期管理。

## 版本真源与定义矩阵

| 版本载体 | 版本真源位置 | 职责定位与约束 |
|---|---|---|
| **CLI / npm 包** | `packages/cli/package.json` | 宿主全局 CLI 二进制的权威版本号 |
| **Core SDK** | `packages/core/package.json` | 捆绑的核心领域原语版本号 |
| **Git Release Tag** | `cli-v<version>` | GitHub Releases 与 CI 发布流水线权威标识 |
| **根目录 `VERSION`** | `VERSION` | 历史预置技能包版本（非 CLI 运行版本） |
| **文档站版本** | `packages/cli/package.json` | 静态编译时自动提取并注入页眉与 LLM 文本 |

## 推荐升级闭环流程

升级过程严格解耦为本机全局二进制更新与项目内模板受管同步两步：

```bash
# 1. 升级本机全局 CLI
omtre upgrade
omtre --version

# 2. 检查当前项目内的受管文件变更（强烈建议先执行 dry-run）
omtre update --dry-run

# 3. 确认无误后执行项目受管资产同步
omtre update
```

关于版本冲突处理、多环境消融与安全回滚方案，查阅[升级、回滚与卸载](../guide/upgrade-and-remove.md)。

## 完整历史发布记录

完整详细的代码变更记录、Bug 修复列表与历史提交保留于代码仓库中：
- 权威变更日志：[CHANGELOG.md](https://github.com/ScoFan-official/omtre/blob/main/CHANGELOG.md)
- 历史架构演变：[Fork 演进记录](https://github.com/ScoFan-official/omtre/blob/main/docs/changelog-fork.md)
- 源码发布归档：[GitHub Releases](https://github.com/ScoFan-official/omtre/releases)

本站不冗余转储完整的历史 Release Notes，确保版本事实在仓库中有且仅有一个真源。

## 文档与版本一致性保证

- 文档站仅覆盖当前最新发布的稳定版本，不设置历史版本的冗余切换；
- CLI 参数参考页面由当前代码的 `--help` 动态编译生成，严禁手工修改；
- 每次发版前必须通过 `pnpm docs:verify`（包含内容规则、死链检测与 Quickstart 端到端测试）；
- 当文档文字描述与代码实现发生任何分歧时，**严格以可执行源码、单元测试用例与 CLI 实际运行表现为准**。

## 下一步

- [参与贡献](./contributing.md)
- [CLI 命令](../reference/cli.md)
- [FAQ](../reference/faq.md)
