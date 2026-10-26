---
title: 命令与技能速查
description: 快速查找 omtre 的用户入口、内置技能、子代理和常见平台差异。
audience: team
maturity: mixed
since: 1.0.0
---

# 命令与技能速查

<MaturityBadge level="mixed" />

omtre 的大多数能力由宿主加载技能或派发子代理完成。不要把所有名称都当成人必须手动调用的命令。

## 用户会话入口

| 名称 | 什么时候用 | 平台差异 |
|---|---|---|
| start | 平台没有自动会话入口，或需要显式重载上下文 | 部分平台不生成 |
| continue | 当前任务中途继续 | 平台命令名或调用语法不同 |
| finish-work | 代码已提交，归档并记录会话 | 部分平台不生成，可让 Agent 执行同名技能 |

实际命令名称取决于初始化生成的平台文件。例如 Qoder 使用 `.qoder/commands/omtre-*.md` 格式；Claude Code 可能生成集合式命令目录。以仓库中的文件为准。

最稳妥的调用方式是自然语言说明意图：

```text
继续当前任务。
```

```text
代码已提交，请按 finish-work 流程归档任务并记录 journal。
```

## 核心技能

| 技能 | 触发时机 | 作用 |
|---|---|---|
| `omtre-brainstorm` | 任务计划阶段 | 澄清需求，推进 PRD、设计和执行计划 |
| `omtre-before-dev` | inline 平台开始编码前 | 加载相关规范和任务上下文 |
| `omtre-check` | 实现完成后 | 按规范和任务验收检查，并运行验证 |
| `omtre-update-spec` | 收尾前 | 把可复用知识回写到 `.omtre/spec/` |
| `omtre-break-loop` | 重复调试或复杂缺陷后 | 分析根因、失败修复和预防机制 |

这些是工作流技能，名称通常带平台安装时的前缀。宿主支持语义触发时会自动匹配，也可以显式点名。

## 子代理

| 子代理 | 权限边界 | 典型任务 |
|---|---|---|
| implement | 写代码，不负责最终提交 | 按 PRD 和计划实现 |
| research | 只读 | 调查代码、文档和方案 |
| check | 审查并修复机械问题 | 规范检查与真实命令验证 |

子代理只在宿主提供子代理原语时可用。inline 平台由主会话加载技能完成同样阶段。

## 内置技能与市场技能

omtre 自带少量运行时技能和规范引导技能。市场中的技能、代理、命令和 MCP 是额外资产，不是全部安装后才算完整使用。

```bash
# 推荐技能集；安装前确认目标平台和版本
npx skills add ScoFan-official/omtre --agent qoder --copy
```

不要默认全量安装市场资产。每个技能的 description 都会进入 Agent 可用列表，过多会增加噪声。

## 常用任务脚本

| 目的 | 命令 |
|---|---|
| 查看当前任务 | `python3 .omtre/scripts/task.py current --source` |
| 列出任务 | `python3 .omtre/scripts/task.py list` |
| 查看可执行 frontier | `python3 .omtre/scripts/task.py frontier` |
| 校验任务上下文 | `python3 .omtre/scripts/task.py validate <task-dir>` |
| 登记验证命令 | `python3 .omtre/scripts/task.py add-verify <task-dir> "<cmd>"` |
| 执行验证 | `python3 .omtre/scripts/task.py run-verify <task-dir>` |
| 归档 | `python3 .omtre/scripts/task.py archive <task-dir>` |
| 查看归档 | `python3 .omtre/scripts/task.py list-archive` |

完整参数见[任务与 PRD](../guide/tasks.md)。

## 常用 CLI

| 目的 | 命令 |
|---|---|
| 初始化 | `omtre init -u <name> --<platform>` |
| 查看平台 | `omtre platforms` |
| 升级 CLI | `omtre upgrade` |
| 同步项目 | `omtre update --dry-run` |
| 切换工作流 | `omtre workflow --list` |
| 临时消融 | `omtre ablate --dry-run` |
| 恢复 | `omtre restore --dry-run` |
| 无人值守 | `omtre run --ticket <task-dir>` |
| 本地多代理 | `omtre channel --help` |

## 同名但不同层的东西

| 容易混淆 | 区别 |
|---|---|
| `start` 命令 vs `task.py start` | 前者加载会话；后者把任务状态改为 `in_progress` |
| `finish` vs `finish-work` | `finish` 清当前指针；`finish-work` 归档并记录 |
| 平台子代理文件 vs `.omtre/agents/` | 角色卡用于运行时；平台代理文件用于宿主派发 |
| 技能 vs 命令 | 技能通常语义触发；命令需要显式调用 |
| 市场资产 vs 内置技能 | 市场是可选安装内容，不是默认运行时 |

## 下一步

- [CLI 命令](./cli.md)
- [平台支持矩阵](./platform-matrix.md)
- [Skills 与规范模板](../advanced/skills-and-marketplace.md)
