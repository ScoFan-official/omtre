---
title: 自定义子代理
description: 创建运行时角色卡，理解它和平台原生子代理文件的区别与安全边界。
audience: advanced
maturity: advanced
since: 1.0.0
---

# 自定义子代理

<MaturityBadge level="advanced" />

omtre 有两类与“子代理”相关的文件：

| 类型 | 位置 | 谁读取 |
|---|---|---|
| 运行时角色卡 | `.omtre/agents/<name>.md` | Channel、`omtre run`、部分主会话流程 |
| 平台原生子代理 | `.claude/agents/`、`.qoder/agents/` 等 | 宿主自己的子代理系统 |

它们不是同一层。修改平台文件不会自动改变运行时角色卡，反之亦然。

## 内置角色卡

常见角色：

| 角色 | 责任 | 不应做 |
|---|---|---|
| `implement` | 按任务产物实现代码 | 决定最终需求、自动提交 |
| `check` | 审查规范与验收，运行验证 | 擅自改写需求 |
| `research` | 只读调查并写研究产物 | 修改产品代码 |
| `orchestrator` | 协调运行与派发 | 代替 worker 实现全部任务 |

一些项目还使用 `check.standards.md` 和 `check.spec.md` 把检查分成两个轴。

## 角色卡结构

```markdown
---
provider: qoder
model: default
---

# Implement

You are the implementation worker for one active Omtre task.

## Read

1. The active task's `prd.md`
2. `design.md` if present
3. `implement.md` if present
4. Files listed in `implement.jsonl`
5. Relevant source and tests

## Write

- Implement only the task scope.
- Add or update tests.
- Do not commit, push, merge, or modify task status.
- Report changed files, validation results, and remaining risks.
```

实际 frontmatter 字段取决于运行时。常见字段包括：

- `provider`
- `model`
- `effort`
- `acp_target`
- `acp_effort`

未知字段通常被忽略。名称应使用字母、数字、点、下划线或连字符。

## 运行时如何找到角色卡

`omtre run` 和 Channel 的 `--agent <name>` 会从 `.omtre/agents/` 解析角色卡。支持两种常见布局：

```text
.omtre/agents/reviewer.md
.omtre/agents/reviewer/AGENT.md
```

找不到角色卡时，派发应失败，而不是用一个任意代理替代。

## 检查轴的解析

如果存在：

```text
.omtre/agents/check.standards.md
.omtre/agents/check.spec.md
```

运行时可以按轴选择更具体的卡；否则回退到 `.omtre/agents/check.md`。

不要创建空文件来“占位”。空角色卡比没有角色卡更危险，因为它让系统以为有明确边界。

## 平台原生子代理

初始化会在支持平台生成实现、检查、研究子代理。它们用于宿主主会话派发，通常包含：

- 角色职责；
- 读取任务的顺序；
- JSONL 上下文要求；
- 是否允许写文件；
- 禁止再派生子代理等约束。

修改这些文件需要同时考虑：

- `omtre update` 是否会覆盖；
- 平台是否支持该 frontmatter；
- 工具权限是否真的被限制；
- 上下文是由 hook 注入还是子代理自读。

## 添加一个自定义角色

1. 明确职责和不做的事；
2. 选择是否有写权限；
3. 指定读取顺序；
4. 定义输出格式；
5. 定义失败和升级路径；
6. 在测试仓库实际派发；
7. 记录支持的平台与 provider。

示例：

```markdown
---
provider: acp
acp_target: codex
acp_effort: medium
---

# Release reviewer

Review the current task for release readiness. Read-only.

## Checks

- Run the task verification contract.
- Confirm no secrets, generated artifacts, or unrelated files are staged.
- Confirm the PR description states rollout and rollback.
- Report blockers with file paths and exact commands.

## Forbidden

- Editing files.
- Committing or pushing.
- Approving its own changes.
```

## 安全边界

角色卡中的“只读”或“禁止 push”是提示词约束。真正的工具权限取决于宿主。

要做到机械限制：

- 使用宿主的 sandbox / tool allowlist；
- 限制 worker 的 Git 权限；
- 在 CI 和远端仓库使用分支保护；
- Channel 只在受信任本机使用；
- 不把生产凭据注入 worker。

## 什么时候值得自定义

适合：

- 团队有专门的安全、性能、可访问性检查；
- 需要固定输出格式；
- 需要把某个 provider 的模型与任务类型绑定；
- 需要多个检查轴。

不适合：

- 只是想多一个“专家”名称；
- 没有明确输入输出；
- 角色会修改文件但没有版本化验证；
- 同一职责已有平台原生机制。

## 下一步

- [Hooks](./hooks.md)
- [Channel 多代理协作](./channel.md)
- [omtre run 无人值守运行](./unattended-run.md)
