---
title: 项目记忆与日志
description: 理解 omtre 的开发者身份、workspace journal、跨会话恢复和隐私边界。
audience: team
maturity: stable
since: 1.0.0
---

# 项目记忆与日志

<MaturityBadge level="stable" />

omtre 的项目记忆不是模型内部的长期记忆，而是仓库中的日志和工作状态。它让下一次会话不必从零开始，也让团队可以审查“上次到底做了什么”。

## 目录结构

```text
.omtre/
├── .developer                    # 当前 checkout 的开发者身份，gitignored
├── .runtime/                     # 会话与运行状态，gitignored
└── workspace/
    ├── index.md                  # 工作区入口
    └── <developer>/
        ├── index.md              # 该开发者的会话索引
        └── journal-N.md          # 会话日志
```

| 文件 | 是否提交 | 说明 |
|---|---|---|
| `.omtre/.developer` | 否 | 当前机器上的开发者身份 |
| `.omtre/.runtime/` | 否 | 会话指针、worktree、run ledger 等本机状态 |
| `.omtre/workspace/**` | 是 | 开发者日志和项目记忆 |
| `.omtre/tasks/**` | 是 | 任务产物与上下文 |

## 开发者身份

初始化时通过 `-u` 创建：

```bash
omtre init -u your-name --qoder
```

新成员加入已有项目时，也应使用自己的名字初始化。生成的 joiner onboarding 任务用于引导阅读工作流和规范，不需要时可以归档。

不要共用同一个开发者名。否则日志归属和并行 session 都会变得混乱。

## 一次收尾产生什么

推荐顺序：

```text
代码提交
  -> 任务归档
  -> journal 记录
```

收尾流程通常调用 `add_session.py`：

```bash
python3 .omtre/scripts/add_session.py \
  --title "Add order status filter" \
  --commit <commit-hash> \
  --summary "Added a read-only status filter and regression tests."
```

Agent 的 finish-work 流程应自动完成这些步骤。你检查最终结果即可，不必每次手写命令。

### journal 内容

一条有用的会话记录应包含：

- 本次完成了什么；
- 对应的提交；
- 关键取舍或风险；
- 验证结果；
- 下次需要注意的事项；
- 相关任务路径。

避免把完整聊天记录倾倒进 journal。日志应该帮助下一个人快速定位，而不是把上下文再复制一遍。

## 跨会话恢复

新会话可能读取：

- 开发者 workspace 索引；
- 最近的 journal；
- 当前活动任务；
- Git 状态和最近提交。

因此恢复质量取决于三项：

1. journal 是否写明实际结果；
2. 任务产物是否完整；
3. 当前任务指针是否准确。

### 当前任务

```bash
python3 .omtre/scripts/task.py current --source
```

在多 session 环境中，活动任务通常按会话身份隔离。若没有可用的会话标识，当前任务指针可能无法持久化。

```bash
# 只清除当前会话的任务指针
python3 .omtre/scripts/task.py finish
```

`finish` 不归档，也不表示任务完成。

## journal 轮转

journal 达到配置上限时自动进入下一个文件：

```yaml
max_journal_lines: 2000
```

结果形如：

```text
journal-1.md
journal-2.md
journal-3.md
```

旧日志不要随手删除；它们是项目记忆链的一部分。

## 多人协作

初始化通常会在 `.gitattributes` 中为 journal 配置合并策略，减少多人并行追加时的冲突。

但合并策略不等于无冲突：

- journal 可能以联合合并方式保留双方内容；
- `index.md` 仍可能冲突，需要人工选择或重建；
- 任务目录不应由多人同时修改同一状态；
- 并行开发更适合独立任务和独立分支。

发生冲突时，优先保留双方的事实记录，再修正索引。不要直接删除对方日志。

## 隐私和敏感信息

::: danger workspace 默认会进入 Git
journal 不自动脱敏。不要在会话日志中粘贴：

- API Key、Token、Cookie；
- 私钥、证书、数据库密码；
- 客户隐私数据；
- 生产环境配置；
- 未公开的安全漏洞细节。
:::

如果团队决定不提交 workspace：

- 明确修改 `.gitignore` 和提交策略；
- 接受新机器无法获得历史 journal；
- 同步调整 onboarding 文档；
- 不要只在本机隐藏文件却仍让收尾流程自动提交。

## 自动提交边界

配置项控制 journal 和任务归档是否自动提交：

```yaml
session_auto_commit: true
```

即使开启自动提交，也应理解它只处理簿记文件，不代替工作代码提交。

关闭后：

- 文件仍会写到磁盘；
- 需要你手工审查并提交；
- `finish-work` 的自动提交步骤可能不再产生提交。

团队应在试点前决定采用哪种策略，并把结论写进贡献指南。

## 日志是否真的有用

一段时间后回看：

- 新会话是否更快找到上次工作？
- 关键决策是否有出处？
- 失败和回滚是否能从日志定位？
- 日志是否变成没有人读的流水账？

如果答案不理想，先改日志模板和 Review 习惯，不要盲目增加更多记录。

## 下一步

- [质量检查与提交](./quality-and-commit.md)
- [关键文件路径](../reference/paths.md)
- [故障排查](../advanced/troubleshooting.md)
