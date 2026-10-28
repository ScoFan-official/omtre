---
title: 命令与技能速查
description: 快速查找 omtre 的用户入口、内置技能、子代理和常见平台差异。
audience: team
maturity: mixed
since: 1.0.0
---

# 命令与技能速查

<MaturityBadge level="mixed" />

omtre 的能力由“交互入口命令”、“阶段驱动技能”、“进程隔离子代理”与“底层状态驱动脚本”四层协同构成。清晰界定不同命名对象在系统中的物理执行层级，是避免人机协作指令混乱的关键。

## 用户会话入口命令

宿主中的斜杠命令是引导模型进入特定工作流阶段的交互入口：

| 命令语义 | 触发时机 | 核心动作 | 平台差异与技术事实 |
|---|---|---|---|
| `start` | 新会话开始，或需显式重载任务与规范上下文 | 读取 `.omtre/workflow.md`、索引与当前活动任务 | 有 SessionStart 等自动入口的平台通常不生成；无自动入口的平台才保留显式 start |
| `continue` | 任务中途恢复会话或进入下一个工作流切片 | 读取当前任务最新产物（PRD/设计）并推进实施 | 各宿主语法不同（如 Qoder 采用 `omtre-continue`） |
| `finish-work` | 业务代码提交后，执行生命周期收尾 | 运行 `task.py archive` 重放验证，移入归档区并追加 journal | 底层调用 Python 脚本；若宿主不支持命令，直接在终端执行原生脚本 |

在日常交互中，若宿主未配置命令快捷方式，直接使用自然语言陈述意图是完全等价的：

```text
继续当前任务。
```

```text
业务代码已完成 commit，请按 finish-work 流程归档任务并记录会话 journal。先不要 push。
```

## 核心工作流技能（Skills）

技能是按意图动态挂载的一段结构化工程指引，既支持模型基于语义自动匹配（Semantic Trigger），也可由开发者在对话中显式指定：

| 技能标识 | 介入阶段 | 工程职责与输出 |
|---|---|---|
| `omtre-brainstorm` | 需求确认与计划阶段 | 对话式挖掘需求盲区，协助编写 `prd.md`、`design.md` 与验证命令 |
| `omtre-before-dev` | 实现开始前（尤其在 inline 平台） | 根据需求检索匹配相关领域规范（`.omtre/spec/**`）并装载入上下文 |
| `omtre-check` | 代码改动完成后 | 对照 PRD 验收标准进行多维度审查，并驱动本地命令验证重放 |
| `omtre-update-spec` | 任务归档前 | 提炼本次任务中沉淀的高价值架构模式与排障规则，反哺至规范库 |
| `omtre-break-loop` | 陷入连续调试失败或复杂死循环时 | 强制中断试错，启动根因分析（Root Cause Analysis）并重置思路 |

## 角色化子代理（Sub-agents）

在具备独立 Worker 进程派发原语的平台上（如 Claude Code、Qoder），系统通过不同角色卡约束其权限与上下文：

| 子代理标识 | 权限边界 | 核心工程职责 | 上下文获取机制 |
|---|---|---|---|
| `implement` | **写权限**；禁止越权执行提交或推送 | 严格在 PRD 范围内编写业务代码与测试用例 | 读取 `implement.jsonl` 所列规范与调研路径 |
| `research` | **严格只读**；禁止修改任何项目源码 | 深入调研架构依赖、现有调用链与排查异常 | 读取任务 `research/` 目录与相关规范索引 |
| `check` | **读权限**；仅允许就地修正机械格式问题 | 审查变更范围合规性，执行验证契约脚本 | 读取 `check.jsonl` 与 PRD 验收条件 |

::: tip 内联模式（Inline）与子代理模式等价性
无独立 Worker 机制的宿主无需派发独立进程，主会话直接按阶段加载对应的 `omtre-*` 技能，执行相同的工程约束。
:::

## 内置技能与市场扩展资产（Marketplace）

omtre 核心包仅内置工作流生命周期必需的最小运行时技能集。技能市场（Skills Marketplace）提供跨领域工程资产扩展：

```bash
# 按需安装特定平台的官方技能扩展
npx skills add ScoFan-official/omtre --agent qoder --copy
```

::: warning 避免无节制全量安装
每个安装的技能都会向 Agent 系统提示词注入名称与描述（description）。全量无脑安装会导致模型可用工具空间膨胀，引发工具误调用并浪费基础 Token。仅安装当前项目真正需要的领域技能。
:::

## 原生任务脚本（底层确定性接口）

当 AI 宿主命令失效或需要在自动化流水线中直接驱动任务时，直接调用本地 Python 原生脚本：

| 运维目的 | 确定性终端命令 | 退出码保证 |
|---|---|---|
| 查看当前活跃任务 | `python3 .omtre/scripts/task.py current --source` | 0（有任务）/ 1（无指针） |
| 列出活跃任务 | `python3 .omtre/scripts/task.py list` | 0 |
| 查询就绪 Frontier | `python3 .omtre/scripts/task.py frontier` | 0（拓扑就绪任务） |
| 校验任务上下文清单 | `python3 .omtre/scripts/task.py validate <task-dir>` | 非 0 标明 JSONL 错误 |
| 绑定验证命令 | `python3 .omtre/scripts/task.py add-verify <task-dir> "<cmd>"` | 0 |
| 本地重放验证契约 | `python3 .omtre/scripts/task.py run-verify <task-dir>` | 非 0 标明测试未过 |
| 执行任务归档 | `python3 .omtre/scripts/task.py archive <task-dir>` | **验证失败强行退出 1** |
| 查看历史归档 | `python3 .omtre/scripts/task.py list-archive` | 0 |

## 同名但物理层级不同的概念对照

初学者极易混淆同名术语，以下矩阵澄清其在物理层上的本质差异：

| 混淆概念 A | 混淆概念 B | 本质差异与边界 |
|---|---|---|
| 宿主命令 `start` | 原生脚本 `task.py start` | 宿主命令用于加载会话与上下文；`task.py start` 是状态机跃迁，将状态从 `planning` 变为 `in_progress` |
| 原生脚本 `task.py finish` | 收尾工作流 `finish-work` | `finish` 仅清空当前会话指针；`finish-work` 触发全套验证重放、归档迁移与日志沉淀 |
| 平台代理文件（`.qoder/agents/`） | 仓库运行角色卡（`.omtre/agents/`） | 平台文件供特定宿主识别派发指令；`.omtre/agents/` 是团队共享的角色契约真源 |
| 技能（Skill） | 宿主斜杠命令（Command） | 技能支持大模型语义自触发或工具调用；斜杠命令必须由开发者显式敲入调用 |
| 内置运行时技能 | 市场扩展资产 | 内置技能随 CLI 初始化写入；市场资产需显式安装，不可视为默认环境 |

## 下一步

- [CLI 命令](./cli.md)
- [平台支持矩阵](./platform-matrix.md)
- [Skills 与规范模板](../advanced/skills-and-marketplace.md)
