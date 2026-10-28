---
title: Hooks
description: 理解平台注入 hooks、任务生命周期 hooks、关闭方式与常见故障。
audience: advanced
maturity: mixed
since: 1.0.0
---

# Hooks

<MaturityBadge level="mixed" />

omtre 架构中包含两类执行环境与物理职责完全解耦的 Hook 机制，排查与扩展前必须首先厘清其触发主体：

| Hook 分类 | 触发驱动主体 | 执行环境与通道 | 核心工程职责 |
|---|---|---|---|
| **平台 Hooks** | AI 编辑器 / CLI 宿主 | 宿主插件沙箱或子进程管道 | 会话启动、用户输入提交时拼装紧凑上下文并注入 Prompt |
| **任务生命周期 Hooks** | 本地 `task.py` 脚本 | 操作系统本地 Shell 子进程 | 任务创建、启动、完成、归档等状态机跃迁时的事件审计与通知 |

## 平台 Hooks：上下文动态装载

平台 Hook 依赖宿主开放的扩展点，常见生命周期时点包括：

| 时点名称 | 触发时机 | 注入数据与行为 |
|---|---|---|
| `SessionStart` | 新会话建立或重载时执行一次 | 提取 `.developer` 凭据、Git 分支状态、当前活动任务与阶段索引 |
| `UserPromptSubmit` | 开发者在聊天框发送每一轮输入时 | 提取 `.omtre/workflow.md` 中对应当前任务状态的 `[workflow-state:<status>]` 提示块 |
| `SubagentStart` | 派发独立 Worker 子代理进程时 | 将当前任务的 `prd.md` 与 `implement.jsonl` 所列规范装载给 Worker |
| `PreToolUse` | Agent 即将调用特定工具时 | 执行危险操作预拦截或向特定文件写入前注入只读保护 |

宿主生成的平台 Hook 存放于各自的适配目录中：
- Claude Code：`.claude/hooks/`、`.claude/settings.json`
- Cursor：`.cursor/hooks.json`
- Qoder：`.qoder/hooks/`
- OpenCode：`.opencode/plugins/`

::: tip 宿主能力决定 Hook 存在与否
某些轻量平台或无 Hook 机制的 CLI 环境无需生成此类文件。无自动 Hook 的平台依赖开发者显式输入斜杠命令或由模型直接读取规范入口。
:::

## 任务生命周期 Hooks：状态机事件流

当执行 `task.py create`、`task.py start` 或 `task.py archive` 等状态变更命令时，Python 脚本会在 `.omtre/config.yaml` 中检索并执行对应的生命周期钩子：

```yaml
hooks:
  after_create:
    - "./scripts/notify-slack.sh"
  after_start:
    - "./scripts/check-local-env.sh"
  after_finish:
    - "./scripts/cleanup-temp-cache.sh"
  after_archive:
    - "./scripts/sync-jira-status.sh"
```

### 运行时契约与执行边界
- **工作目录**：严格以项目仓库根目录作为 CWD（Current Working Directory）；
- **上下文透传**：脚本运行时会自动注入 `TASK_JSON_PATH` 环境变量，指向当前被操作的 `task.json` 文件绝对路径；
- **超时与容错机制**：单个 Hook 脚本超时时间通常限制为 60 秒。**生命周期 Hook 的退出码失败仅在终端打印警告，绝不阻断主状态机的流转**。因此，绝不能将生命周期 Hook 用作强制阻断任务归档的硬门禁（硬门禁应配置在验证契约 `verify` 中）。

::: danger 常见配置混淆：切勿写入 task.json
**omtre 1.0.0 的任务生命周期 Hooks 统一从 `.omtre/config.yaml` 读取。** 严禁遵循过时的文档或第三方猜测将 `hooks` 写入个别任务的 `task.json` 中，核心工具链不会读取任务 JSON 内的 hooks 字段。
:::

## 环境变量逃生口（全局禁用 Hooks）

在排查编辑器启动卡死、网络挂起或 Hook 脚本报错时，**无需修改任何配置文件**，只需在终端导出环境变量：

```bash
# 全局临时阻断所有 omtre hooks 的触发
export OMTRE_HOOKS=0
```

部分旧版本脚本同时支持 `OMTRE_DISABLE_HOOKS=1`。在自动化运行器（`omtre run`）与 Channel Worker 内部，系统也会自动置位此变量以杜绝多层子代理的递归嵌套注入。

关闭 Hook 后的系统表现：
- 仓库内的规范、任务、代码与验证脚本保持原状；
- 编辑器会话不再自动推送前置提示词，需引导 Agent 显式查阅 `.omtre/workflow.md`；
- 该动作仅为临时调试手段，不是卸载。

## 典型故障排查指南

### 1. 会话启动后没有任何上下文自动注入
排查路径：
1. 检查当前编辑器是否已信任该项目（未受信任的项目会被编辑器内核静默拦截所有 Hook 执行）；
2. 检查环境变量是否残留了 `OMTRE_HOOKS=0`；
3. 检查 `.claude/settings.json` 或平台配置中的 Hook 相对路径是否存在文件损坏；
4. 检查 Hook 执行权限是否具备可执行位（`chmod +x`）。

### 2. 终端 Python 正常，Hook 运行却报语法错误
**根因定位**：IDE 宿主启动 Hook 子进程时往往采用受限的最小 `PATH` 环境，调用的可能是系统自带的陈旧 Python（如 macOS 的系统 Python），而非你终端里生效的 Python 3.9+。
**处置方案**：在平台 Hook 脚本中将 `python3` 调用显式指定为绝对路径，或在 Hook 脚本首行打印 `which python3` 确认实际解析的解释器。

### 3. 每轮输入后未能注入当前任务状态
检查当前 `.omtre/workflow.md` 中是否存在与 `task.json.status` 完全同名的成对状态块：
```text
[workflow-state:planning]
...
[/workflow-state:planning]
```
若工作流模板被误删或自定义了非法的状态名，提取正则匹配失败，系统会自动退化为通用提示。

### 4. 平台 Hook 脚本在升级后被覆写
平台 Hook 目录（如 `.claude/hooks/`）属于 CLI 受管模板。在执行 `omtre update` 时可能会被覆盖。
**防范方案**：严禁直接在受管 Hook 文件体内堆砌业务脚本；将自定义逻辑抽离到独立脚本（如 `scripts/my-hook.sh`），在配置文件中单独引用。

## 下一步

- [配置参考](./configuration.md)
- [平台支持矩阵](../reference/platform-matrix.md)
- [故障排查](./troubleshooting.md)
