---
title: Channel 多代理协作
description: 使用本机事件日志协调 Claude、Codex 和 ACP worker，理解能力与安全边界。
audience: advanced
maturity: advanced
since: 1.0.0
---

# Channel 多代理协作

<MaturityBadge level="advanced" />

Channel 是 omtre 的本机多 Agent 协作运行时。它用共享事件日志协调 worker，适合在同一台受信任机器上让实现、检查或研究代理并行工作。

它不是云服务，也不是带权限模型的多人协作平台。

## 能力边界

| 项目 | 1.0.0 |
|---|---|
| worker provider | Claude、Codex、ACP |
| ACP target | grok-build、codex、claude |
| 存储 | 本机文件 |
| 跨机器通信 | 不支持 |
| 用户身份与权限 | 不提供；`by` 只是别名 |
| 云端后端 | 不在当前范围 |
| 事件轮转 | 不在当前范围 |
| GUI | 不在当前范围 |

“22 个平台”指项目文件安装目标，不是 22 种 Channel worker。

## 创建和观察频道

```bash
omtre channel create review-session --type chat

omtre channel list
omtre channel messages review-session
omtre channel messages review-session --raw --follow
```

`--scope project|global` 决定本地存储桶。`global` 仍然是本机目录，不是远程共享。

Forum 类型支持 thread：

```bash
omtre channel create release-board --type forum
omtre channel post release-board opened "Release review"
omtre channel forum release-board
```

## 启动 worker

```bash
omtre channel spawn review-session \
  --agent check \
  --as standards-reviewer \
  --provider claude
```

常见参数：

| 参数 | 说明 |
|---|---|
| `--agent` | 读取 `.omtre/agents/<name>.md` 的默认 provider/model/prompt |
| `--provider` | `claude`、`codex`、`acp`，覆盖角色卡 |
| `--as` | 频道内 worker 名 |
| `--cwd` | worker 工作目录 |
| `--model` | 模型覆盖 |
| `--resume` | 恢复已有 session/thread |
| `--sandbox` | Codex sandbox 模式 |
| `--acp-target` | ACP 目标 |
| `--timeout` | worker 自动终止时间 |
| `--file` / `--jsonl` | 启动上下文 |
| `--idle-timeout` | 空闲清理 |
| `--max-live-workers` | live worker 预算 |

worker 注册后通常等待显式消息，不会自动消费所有广播。

## 发送、等待和中断

```bash
omtre channel send review-session \
  --to standards-reviewer \
  "Axis: standards. Review the current diff and run the task verification contract."

omtre channel wait review-session \
  --from standards-reviewer \
  --timeout 15m
```

`wait` 超时通常返回非零退出码，自动化脚本要据此停止，而不是无限轮询。

```bash
omtre channel interrupt review-session \
  --to standards-reviewer \
  "Stop the current turn and report findings so far."
```

## 停止和清理

```bash
omtre channel kill review-session standards-reviewer
omtre channel kill review-session standards-reviewer --force
omtre channel rm review-session
```

`rm` 会终止 worker 并删除频道目录。先确认没有需要保留的日志或上下文。

批量清理默认应使用预览：

```bash
omtre channel prune --ephemeral --dry-run
```

## 一次性运行

```bash
omtre channel run \
  --provider claude \
  --agent research \
  "Inspect the repository and summarize the order filtering path."
```

`channel run` 会创建临时频道、启动一个 worker、发送提示、等待结果并清理。它适合单次查询，不支持完整 spawn 的部分 flags。

## 存储和日志

默认根：

```text
~/.omtre/channels/
└── <project-key>/
    └── <channel>/
        ├── events.jsonl
        ├── <worker>.log
        └── .pid / .config 等
```

可通过 `OMTRE_CHANNEL_ROOT` 改变根目录。

查看原始事件：

```bash
omtre channel messages <name> --raw
omtre channel messages <name> --raw --since 20
```

## 安全

::: danger 仅用于受信任本机
Channel worker 可以执行 AI 工具允许的代码和命令。部分 Claude worker 配置可能跳过宿主权限提示。不要把不可信仓库、不可信提示或生产凭据放进 Channel。
:::

建议：

- 在隔离的测试仓库先验证；
- 使用宿主 sandbox / tool allowlist；
- 不把长期凭据注入 worker；
- 不把 Channel 当审批系统；
- 对写入型 worker 使用版本控制保护；
- 只允许明确 target 的消息。

`by`、`--as` 和 `to` 是路由/显示信息，不是认证身份。任何本机进程都可能写入频道文件。

## 上下文边界

`--file`、`--jsonl` 和 `--agent` 有路径包含检查。默认只接受 worker cwd 或受信任目录内路径。

如确需扩展：

```yaml
channel:
  trusted_context_dirs:
    - /work/shared/omtre-context
```

不要把整个 home 目录加进受信任路径。

## 并发与预算

`idle_timeout` 和 `max_live_workers` 用于防止 worker 长期占用资源。它们不是集群调度器。

1.0.0 不提供：

- 自动扩容；
- 跨机 worker；
- 多租户隔离；
- 频道事件轮转；
- 高可用后端。

高并发场景应使用专门的任务编排系统。

## 推荐用法

1. 主会话负责需求与最终提交；
2. implement worker 只写实现；
3. standards / spec worker 分别检查；
4. 研究 worker 只写 `research/`；
5. 人汇总报告并决定下一步；
6. 不把多个 worker 的自由对话当作验收证据。

## 下一步

- [omtre run 无人值守运行](./unattended-run.md)
- [自定义子代理](./custom-agents.md)
- [故障排查](./troubleshooting.md)
