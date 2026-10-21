<p align="center">
  <img src="assets/hero.svg" alt="omtre — 面向 AI 编码代理的合约式工作流 harness" width="100%">
</p>

<h1 align="center">omtre</h1>

<p align="center">
  <strong>面向 AI 编码代理的合约式工作流 harness。</strong><br/>
  <sub>一套 <code>.omtre/</code> 主轴，承载规范、任务与项目记忆，覆盖 22 个编码代理。</sub>
</p>

<p align="center">
  <a href="https://github.com/ScoFan-official/omtre/releases"><img src="https://img.shields.io/github/v/release/ScoFan-official/omtre?style=flat-square&color=2563eb" alt="release version" /></a>
  <a href="https://www.npmjs.com/package/omtre"><img src="https://img.shields.io/npm/v/omtre?style=flat-square&color=cb3837" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/omtre"><img src="https://img.shields.io/npm/dw/omtre?style=flat-square&color=cb3837&label=downloads" alt="npm downloads" /></a>
  <a href="https://github.com/ScoFan-official/omtre/stargazers"><img src="https://img.shields.io/github/stars/ScoFan-official/omtre?style=flat-square&color=eab308" alt="stars" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-16a34a.svg?style=flat-square" alt="license" /></a>
</p>

<p align="center">
  <a href="./README.md">English</a> · 简体中文 · <a href="./docs/pack.zh-CN.md">技能与市场</a> · <a href="./docs/design.md">设计</a> · <a href="./CHANGELOG.md">更新日志</a>
</p>

## 安装

```bash
npm install -g omtre
omtre init -u your-name
```

也可以安装 GitHub Release 里的独立 tgz：

```bash
npm i -g https://github.com/ScoFan-official/omtre/releases/download/cli-v1.0.0/omtre-1.0.0.tgz
```

要求：**Node.js >= 18.17**，**Python >= 3.9**。

## 为什么是 omtre？

AI 编码代理写得很快，但每次新会话都从零开始。omtre 把项目本身变成事实来源：规范说明“应该怎么做”，任务承载“这次改什么”，日志保留“上次发生了什么”。代理读到的合约，和团队读到的是同一份。

| 原则 | 落地方式 |
| --- | --- |
| **合约，不是建议** | 规范与闸门放在 `.omtre/spec/`，工作流不能跳过。 |
| **一条主轴，任意代理** | 同一套 `.omtre/` 布局，适配 22 个编码代理与 IDE。 |
| **状态留在仓库** | 任务、决策与记忆都在仓库里；没有隐藏服务，也没有供应商锁定。 |
| **开箱即用** | 43 个一线技能、一个市场、1,700+ 目录资产。 |
| **独立节奏** | omtre 有自己的版本线与设计原则；上游变更是输入，不是路线图。 |

## 快速开始

```bash
# 1. 初始化你实际使用的平台
omtre init --claude --cursor --codex -u your-name

# 2. 让代理开始一个任务。
#    会话钩子会注入相关规范与当前任务上下文。

# 3. 任务完成时收尾。
/omt:finish-work
```

无人值守循环：

```bash
omtre run --until-empty
```

`omtre run` 取 frontier 头部，在独立工作树里实现、验证，并记录运行账本。交付默认需要显式开启。

## 工作方式

<img src="assets/workflow.svg" alt="omtre 工作流 —— 会话开始、计划、实现、检查、收尾" width="100%">

1. **会话开始** —— 钩子注入相关的 `.omtre/spec/` 合约与当前任务上下文。
2. **计划** —— 代理把需求写成 `.omtre/tasks/` 下的 `prd.md`、`design.md`、`implement.md`，一次问一个问题。
3. **实现** —— `omtre-implement` 子代理写出范围明确的 diff，不自动提交。
4. **检查** —— `omtre-check` 子代理按标准与规范审查 diff，再跑 lint、类型检查和测试。机械问题可以自修；规范问题只报告，不改写。
5. **收尾** —— 任务归档、日志更新，可复用的经验回写到 `.omtre/spec/`。

## `.omtre/` 里有什么

| 路径 | 用途 |
| --- | --- |
| `.omtre/spec/` | 团队合约：架构、约定、质量闸门、领域规则。 |
| `.omtre/tasks/` | 每个变更一个目录：PRD、设计、实现上下文、检查上下文。 |
| `.omtre/workspace/` | 每位开发者的日志与共享项目记忆。 |
| `.omtre/agents/` | implement、check、research、plan、orchestrator 的角色卡。 |
| `.omtre/domains/` | 多票交付与工作日志的看板协议。 |

## 平台

omtre 为 22 个编码代理与 IDE 提供适配，包括 Claude Code、Cursor、Codex、OpenCode、Gemini CLI、GitHub Copilot、Devin、Qoder、CodeBuddy、Kiro、Kilo、Droid、Trae、Grok、Kimi、Snow 等。完整列表与各平台设置见[支持平台](./docs/pack.zh-CN.md)。

## 技能与市场

- **43 个一线技能** —— 包括 `omtre-run`、`omtre-domains`、`dispatch-roster`、`hygiene-sweep`、`rules-audit`、`code-review`、`tdd`，以及 `omtre-meta` 指南。
- **1,700+ 目录资产** —— 以 vendored 方式引入并保留出处；见[模板市场](./marketplace/README.md)。

安装推荐技能集：

```bash
npx skills add ScoFan-official/omtre --agent <your-platform> --copy
```

安装规范合约：

```bash
omtre init --registry gh:ScoFan-official/omtre/marketplace --template agent-workflow --append
```

<!-- omtre:upstream-attribution:start -->
## 从 Trellis 迁移

omtre 可以与 Trellis 并存：命令是 `omtre`/`omt`，目录是 `.omtre/`，不会覆盖 `trellis` 二进制。已有的 Trellis 0.6.x 项目可以运行 `omtre migrate` 把受管文件迁到 `.omtre/`，保留用户数据，并为改动过的受管文件写 `.backup` 副本。
<!-- omtre:upstream-attribution:end -->

```bash
omtre migrate --dry-run
omtre migrate
```

## 临时消融

`omtre ablate` 会在项目外创建一份可验证的恢复事务，然后临时移除所有项目内的 omtre 表面。开一个新的代理会话做对比，结束后运行 `omtre restore` 恢复原状；两个操作都支持 `--dry-run` 预览。

这和 `omtre uninstall`（永久移除）以及 `OMTRE_HOOKS=0`（只关钩子）不同。消融不会启动代理、管理工作树、隐藏 Git 变更，也不会删除全局 CLI、通道日志或宿主会话记录。消融期间如果受管路径发生变化，`restore` 会拒绝写入，直到冲突被处理。

## 设计

omtre 围绕五个承诺构建：合约优先、状态留在仓库、代理无关的适配层、小核心与可吸收的边缘、独立的发布节奏。更完整的说明见[设计笔记](./docs/design.md)。

## 来源与许可证

<!-- omtre:upstream-attribution:start -->
omtre 是一个独立项目，源自 [Trellis](https://github.com/mindfold-ai/trellis)。上游项目及其版权归 Mindfold LLC 所有；omtre 的修改同样以 AGPL-3.0 发布。来源与同步策略见 [NOTICE](./NOTICE) 与[上游说明](./docs/upstream.md)。
<!-- omtre:upstream-attribution:end -->

## 社区

- [Issues](https://github.com/ScoFan-official/omtre/issues)
- [模板市场](./marketplace/README.md)
- [参与贡献](./CONTRIBUTING_CN.md)
- [更新日志](./CHANGELOG.md)
