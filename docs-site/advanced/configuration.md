---
title: 配置参考
description: omtre 1.0.0 的 config.yaml 常用字段、默认值、支持语法和安全影响。
audience: advanced
maturity: advanced
since: 1.0.0
---

# 配置参考

<MaturityBadge level="advanced" />

项目配置位于：

```text
.omtre/config.yaml
```

运行时读取失败或文件缺失时，多数脚本会回退到默认值并给出警告。配置没有完整 JSON Schema 校验；未知键可能被忽略，错误写法未必立即失败。

## 支持的 YAML 子集

omtre 的项目配置解析器支持常用结构：

- `key: value`；
- 缩进映射；
- `- ` 列表；
- 引号、注释和布尔值转换；
- 简单嵌套。

不要依赖复杂 YAML 特性，例如锚点、别名、合并键、flow 集合或复杂块标量。它们可能被警告并跳过。

所有值在底层都可能先按字符串读取，再由具体消费者转换。修改后应运行真实命令验证，而不是只看文件是否能打开。

## 常用配置

### 自治模式

```yaml
autonomy: hands-off
```

| 值 | 大致含义 |
|---|---|
| `gated` | 在关键门槛询问用户 |
| `hands-off` | 自动推进，但用户可否决；也是缺省和非法值的回退 |
| `supervised-delivery` | 在交付白名单允许时，运行器可推送任务分支；远端为 GitHub 且 `gh` 可用时再创建 ready PR |

自治模式不是“所有动作都自动执行”的开关，也不会绕过验证和 Git 保护。

### 强制验证契约（verify_required）

```yaml
verify_required: true
```

**作者强烈建议**：团队试点与生产工程显式配置 `verify_required: true`。开启后，任务没有任何验证契约时会被拒绝归档；已登记契约执行失败时也会阻断。只有使用带原因的 `--skip-verify` 才能绕过本次检查。

若未显式配置，系统行为将随 `autonomy` 模式降级：除 `supervised-delivery` 会强制要求验证外，其他模式可能仅退化为警告放行，容易造成质量门禁失守。

### 会话与 journal

```yaml
session_commit_message: "chore: record journal"
max_journal_lines: 2000
session_auto_commit: true
```

- journal 超过行数上限后轮转到下一个文件；
- `session_auto_commit` 控制日志和归档是否尝试自动提交；
- 自动提交只处理簿记，不代替代码提交。

### 包与 monorepo

```yaml
packages:
  api:
    path: packages/api
  web:
    path: packages/web
    git: true
  docs:
    path: docs-site
    type: submodule

default_package: api
```

`git: true` 用于独立 Git 仓库或元仓库布局。`type: submodule` 用于子模块。

### 上下文注入上限

```yaml
context_injection:
  max_file_bytes: 32768
  max_artifact_bytes: 65536
  max_total_bytes: 131072
```

单位是字节，设为 `0` 可关闭对应限制。超过上限的材料可能被截断或退化为路径索引。

### 提示词注入逃生口

```yaml
prompt_injection:
  skip_keyword: "no-omtre"
```

用户输入包含独立关键词时，本轮可跳过 omtre 的每轮提示注入。设为空字符串可关闭这个逃生口。

### 任务生命周期 hooks

```yaml
hooks:
  after_create:
    - "./scripts/notify-team.sh"
  after_start:
    - "./scripts/check-env.sh"
  after_finish:
    - "./scripts/clear-local-state.sh"
  after_archive:
    - "./scripts/record-metric.sh"
```

生命周期 hooks 从仓库根目录执行，接收 `TASK_JSON_PATH` 环境变量，超时时间约 60 秒。失败通常只警告，不阻断主操作。

::: warning 配置位置容易混淆
1.0.0 的任务生命周期 hooks 从 `.omtre/config.yaml` 读取，不读取 `task.json.hooks`。如果你看到旧文档建议写进任务 JSON，应以当前实现和实际测试为准。
:::

### Channel worker guard

```yaml
channel:
  worker_guard:
    idle_timeout: 5m
    max_live_workers: 6
  trusted_context_dirs:
    - /work/shared/omtre-context
```

- `idle_timeout`：空闲 worker 清理时间；
- `max_live_workers`：live worker 预算；
- `trusted_context_dirs`：允许读取被包含检查之外的文件根。

优先级通常是 CLI flag > 环境变量 > 配置 > 内置默认。

### Codex dispatch

```yaml
codex:
  dispatch_mode: auto
```

`auto` 倾向于派发实现/检查子代理；`inline` 让主会话直接实现和检查。Codex 用户需根据 hooks 功能开关和团队偏好选择。

### 运行器与派发

```yaml
worker_default: implement

orchestrator:
  agent: orchestrator
  model: default
  max_parallel: 2
```

- `worker_default` 在任务未指定 worker 时使用；没有可解析 worker 时，派发可能 fail-closed。
- `orchestrator.max_parallel` 可能存在于配置结构中，但 1.0.0 的 `omtre run` 并未把并行 ticket 作为实际运行能力。不要把它当成并行执行保证。

### 交付白名单

```yaml
delivery:
  protected_refs:
    - main
    - master
  auto_push_refs:
    - "feature/*"
```

交付门会检查：

- 当前自治模式；
- 默认分支与 tag；
- `protected_refs`；
- 白名单是否为空或格式错误；
- 目标 ref 是否匹配 `auto_push_refs`。

空白名单通常等价于不自动推送。配置格式错误应视为拒绝，而不是放行。

## 一个谨慎的团队配置

```yaml
autonomy: hands-off
verify_required: true

session_auto_commit: true
max_journal_lines: 2000

channel:
  worker_guard:
    idle_timeout: 5m
    max_live_workers: 4

delivery:
  protected_refs:
    - main
  auto_push_refs: []
```

这允许普通任务推进，但保留人工 push 和合并。只有在真实试点和交付门测试后才加入自动推送白名单。

## 修改流程

1. 修改前备份；
2. 只改一个主题；
3. 运行：

```bash
omtre update --dry-run
python3 .omtre/scripts/task.py list
python3 .omtre/scripts/get_context.py --mode packages
```

4. 完成一个低风险任务验证行为；
5. 把配置变化记录到任务或运维文档。

## 没有配置 schema 的风险

- 拼写错误可能被忽略；
- 类型错误可能在消费时才暴露；
- 未知键不会统一报错；
- 嵌套结构错误可能导致回退默认。

重要配置要在真实命令中验证，而不是只相信 YAML 可解析。

## 下一步

- [自定义工作流](./custom-workflow.md)
- [Channel 多代理协作](./channel.md)
- [omtre run 无人值守运行](./unattended-run.md)
