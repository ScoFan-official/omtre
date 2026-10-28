---
title: Channel 多代理协作
description: 使用本机事件日志协调 Claude、Codex 和 ACP worker，理解能力与安全边界。
audience: advanced
maturity: advanced
since: 1.0.0
---

# Channel 多代理协作

<MaturityBadge level="advanced" />

Channel 是 omtre 提供的本机多 Agent 协同总线与事件驱动运行时。它通过在本地磁盘维护结构化的 JSON Lines 事件日志（`events.jsonl`），在受信任的单台开发机上协调多个实现、审查或技术调研 Worker 进程并行运作。

::: danger 物理边界：本机进程间通信，绝非云端协同服务
Channel 的物理实现完全基于本机文件系统与子进程调度。系统**不提供跨机器网络同步、不提供中心化用户鉴权与访问控制，也不具备多租户资源隔离能力**。`by`、`--as` 与 `--to` 仅用于消息路由分发与日志展示，不代表任何密码学身份凭据。
:::

## 核心能力与架构边界

| 架构维度 | 1.0.0 实现事实 | 明确不提供的能力（Out of Scope） |
|---|---|---|
| **支持的 Worker Provider** | Claude、Codex、ACP（可挂载不同模型） | 尚未适配 22 个平台中的全部 IDE 宿主 |
| **ACP Target** | 支持调起 `grok-build`、`codex`、`claude` 等后端 | 不支持非标准 ACP 协议的私有模型 |
| **数据持久化** | 本地 `~/.omtre/channels/` 目录下的文本事件 | 暂无云端数据库、无事件自动归档压缩 |
| **网络边界** | **严格限于单台本地开发机** | 不支持跨机器分布式 RPC 或局域网多端同步 |
| **安全沙箱** | 依赖宿主本身的工具白名单与环境隔离 | Channel 自身不提供内核级容器沙箱 |

“omtre 支持 22 个平台”指的是能为 22 个编辑器生成项目适配文件，绝对不代表 22 个平台均具备 Channel Worker 调度能力。

## 创建与查看频道

Channel 提供了 `chat`（线性交互流）与 `forum`（结构化主题贴）两类频道：

```bash
# 创建代码审查频道
omtre channel create review-session --type chat

# 观察频道的实时消息流（类似 tail -f）
omtre channel messages review-session --raw --follow
```

若需组织多轮深度推演或长程任务讨论，使用 `forum` 模式支持 Thread 线程组织：

```bash
omtre channel create release-board --type forum
omtre channel post release-board opened "版本发布完整性审查"
```

## 派发与绑定 Worker 进程

```bash
# 启动一个标准审查子代理进程挂载至频道
omtre channel spawn review-session \
  --agent check \
  --as standards-reviewer \
  --provider claude \
  --timeout 30m
```

关键调度参数：

| 参数 | 默认行为 | 工程考量与约束 |
|---|---|---|
| `--agent` | 必选或从配置解析 | 读取 `.omtre/agents/<name>.md` 定义的角色卡，确立提示词基线 |
| `--provider` | 角色卡默认 | 强制覆盖底层模型执行器（`claude`、`codex`、`acp`） |
| `--as` | 必须唯一 | 该 Worker 在频道内部的逻辑寻址标识 |
| `--timeout` | 无限制 | Worker 进程的最大生命周期，超时强制退出（防死循环挂起） |
| `--idle-timeout` | 5m | 处于等待无消息状态的空闲清理阈值 |
| `--max-live-workers` | 配置限制 | 当前频道内允许并发存活的 Worker 进程上限（防系统资源耗尽） |

Worker 启动后处于事件监听状态，仅当接收到指向其 `--as` 标识的显式消息时才会唤醒执行，不会盲目消费广播消息。

## 消息收发、同步等待与中断

```bash
# 向指定 Worker 定向下发审查任务
omtre channel send review-session \
  --to standards-reviewer \
  "开始审查：运行当前任务的验证契约，核验所有修改文件的范围是否符合 PRD。"

# 阻塞式等待 Worker 产出回复（设置超时上限）
omtre channel wait review-session \
  --from standards-reviewer \
  --timeout 15m
```

::: warning 退出码处理准则
当 `channel wait` 达到超时限制未收到回复时，命令会立即返回**非 0 退出码**。调用 Channel 的外部脚本必须捕获该退出码并执行错误分支，严禁无脑继续后续步骤。
:::

若发现 Worker 出现思考偏航或陷入死循环调试，可强制中断当前回合：

```bash
omtre channel interrupt review-session \
  --to standards-reviewer \
  "立即停止当前实现，直接输出当前已定位到的问题清单。"
```

## 资源回收与频道清理

```bash
# 优雅终止特定 Worker 进程
omtre channel kill --as standards-reviewer review-session

# 彻底销毁频道并清理本地事件文件
omtre channel rm review-session

# 批量清理过期的临时频道（先用 dry-run 预览）
omtre channel prune --ephemeral --dry-run
```

`rm` 操作会连带删除 `events.jsonl` 与 Worker 的 `.log` 文件。在执行销毁前，确认关键技术结论已沉淀进任务的 `research/` 目录或个人 `journal` 中。

## 本机数据拓扑

Channel 的事件数据存放在当前用户家目录下：

```text
~/.omtre/channels/
└── <project-dir-name>/
    └── <channel-name>/
        ├── events.jsonl          # 权威事件追加流（JSON Lines）
        ├── <worker>.log          # 各 Worker 进程标准输出与错误日志
        └── .pid / .lock          # 进程运行锁与生命周期状态
```

可以通过环境变量 `OMTRE_CHANNEL_ROOT` 将存储目录重定向到专用测试分区或高速缓存盘。

## 安全与防护底线

::: danger 严禁将不可信输入引入 Channel
Channel Worker 继承了宿主环境的命令执行与文件改写权限。特别是在自动化派发 Claude Worker 时，部分配置可能会旁路宿主的确认弹窗：
- **切勿在包含敏感生产凭据的机器上无干预运行 Worker**；
- **切勿通过 Channel 处理未审阅的第三方 Pull Request 代码**；
- **严格在独立的 Git 任务分支上运行写权限 Worker**，确保任意越界代码可通过 `git reset` 彻底丢弃；
- **严格限制上下文路径**：默认仅允许读取当前项目 CWD 内的文件，如需跨目录访问必须在 `.omtre/config.yaml` 的 `trusted_context_dirs` 中显式登记绝对路径。
:::
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
