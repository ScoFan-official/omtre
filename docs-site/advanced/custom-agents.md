---
title: 自定义子代理
description: 创建运行时角色卡，理解它和平台原生子代理文件的区别与安全边界。
audience: advanced
maturity: advanced
since: 1.0.0
---

# 自定义子代理

<MaturityBadge level="advanced" />

omtre 系统中存在两类名称相近但物理层级与消费者完全不同的“子代理”文件：

| 代理类型 | 存放物理路径 | 消费与解析主体 | 技术职责与定位 |
|---|---|---|---|
| **仓库运行时角色卡** | `.omtre/agents/<name>.md` | `omtre run`、Channel 总线、本地状态机 | 团队共享的角色契约真源，定义 Worker 行为边界 |
| **宿主原生子代理文件** | `.claude/agents/`、`.qoder/agents/` 等 | 具体 AI 编辑器或 CLI 宿主 | 供宿主主会话识别并启动进程隔离子代理 |

修改平台原生目录下的文件绝不会自动同步给 `.omtre/agents/`，反之亦然。二者是“底层契约真源”与“上层宿主适配”的映射关系。

## 核心内置角色与权限边界

| 角色标识 | 核心工程职责 | 工具权限红线（坚决不可做） |
|---|---|---|
| `implement` | 在 PRD 严格划定的范围内编写业务源码与测试 | 擅自扩大需求边界、自动执行 `git commit` 或 `git push` |
| `check` | 审查规范符合性与验收条件，执行命令验证重放 | 擅自静默修改业务代码、掩盖测试失败输出 |
| `research` | 只读调研现有架构、依赖调用链并产出分析文档 | **绝对禁止修改任何产品代码**，仅允许产出 `research/*.md` |
| `orchestrator` | 协调任务派发、检查 Worker 状态并汇报账本 | 越俎代庖直接编写业务代码 |

针对复杂工程审查，系统支持将单一的 `check` 拆分为双轴检查：`check.standards.md`（编码风格与架构规约轴）与 `check.spec.md`（PRD 功能验收轴）。

## 角色卡的数据结构与字段

角色卡采用 Markdown + YAML Frontmatter 格式存储：

```markdown
---
provider: claude
model: claude-opus-4-7
effort: high
---

# Implement Worker

你是本次 omtre 活动任务的实施子代理。

## 必读上下文清单
1. 当前任务的 `prd.md`（需求范围与验收标准）
2. 当前任务的 `design.md` 与 `implement.md`（若存在）
3. `implement.jsonl` 中索引的项目规范与调研文件
4. 任务相关的业务源码与测试用例

## 动作红线
- 仅修改 PRD 明确列为 In Scope 的文件；
- 编码同时必须补齐对应单元测试；
- 严禁执行 git commit、git push，严禁私自修改 task.json 状态；
- 完成后必须运行任务绑定的验证契约命令并报告退出码。
```

Frontmatter 中的常用调度字段：
- `provider`：当前运行时注册的接入方式，可选 `claude`、`codex`、`acp`；
- `model`：Provider 能识别的模型代号；
- `effort`：Provider 使用的推理强度，具体取值由对应 Provider 决定；
- `acp_target`：使用 ACP 时要调用的目标，如 `codex`、`claude` 或 `grok-build`。

未知字段会被忽略；未知 `provider` 不会自动变成可用执行器。

## 运行时角色卡解析拓扑

当 `omtre run` 或 Channel 总线调度 `--agent <name>` 时，解析引擎在 `.omtre/agents/` 下按以下优先级定位：

```text
1. .omtre/agents/<name>.md
2. .omtre/agents/<name>/AGENT.md
```

对于审查角色，若存在 `check.standards.md` 和 `check.spec.md`，引擎优先按具体轴派发；若不存在则自动回退至 `check.md`。

::: danger 严禁创建空角色卡占位
**绝对不要创建空文件或仅写标题的角色卡来“占位”。** 空白角色卡会导致调度系统误认为该任务已有完整边界约束，从而抹除默认的安全守卫行为，导致 Agent 在缺乏提示词约束的裸状态下直接跑飞。
:::

## 宿主原生子代理文件的管理

`omtre init` 为支持平台生成的子代理文件位于各平台目录内部（如 `.claude/agents/`）。定制这些文件时必须注意：
1. **防止升级覆写**：平台生成的代理文件属于受管资产，`omtre update` 时可能会被官方新版本模板覆盖。若有团队特定定制，建议在 `update` 时使用 `--create-new` 进行差异对比；
2. **上下文注入通道差异**：确认当前宿主是通过 Hook 自动推送上下文（如 Claude Code），还是依赖子代理自行通过工具读取任务目录（如 Qoder 的 Pull-based 模式）。

## 真正的安全隔离依赖系统权限

必须认识到：角色卡正文中写下的“只读”、“严禁执行 push”本质上是语言模型的**提示词约束（Soft Guidance）**。
要实现物理级别的安全阻断：
- **依赖宿主工具白名单**：在宿主配置中限制该子代理仅挂载只读工具（如仅允许 `Read`、`Grep`，禁用 `Write`、`Edit`、`Bash`）；
- **依靠 Git 平台权限**：生产级分支必须在 GitHub/GitLab 远端开启受保护分支规则与强制 CI 检查；
- **凭据最小化**：禁止向非必要 Worker 进程注入任何写权限的 Token 或部署密钥。

## 下一步

- [Hooks](./hooks.md)
- [Channel 多代理协作](./channel.md)
- [omtre run 无人值守运行](./unattended-run.md)
