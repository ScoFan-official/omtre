---
title: Hooks
description: 理解平台注入 hooks、任务生命周期 hooks、关闭方式与常见故障。
audience: advanced
maturity: mixed
since: 1.0.0
---

# Hooks

<MaturityBadge level="mixed" />

omtre 里有两种不同的 hooks，名称相似但职责不同：

1. **平台 hooks**：宿主在会话开始、每轮输入或子代理启动时执行；
2. **任务生命周期 hooks**：`.omtre/config.yaml` 在任务创建、启动、结束或归档后执行脚本。

先分清是哪一种，再排查或修改。

## 平台 hooks

典型时点：

| 时点 | 作用 |
|---|---|
| SessionStart | 注入开发者身份、Git 状态、活动任务与工作流索引 |
| UserPromptSubmit | 每轮注入当前 workflow-state |
| SubagentStart / 子代理注入 | 把任务产物和 JSONL 上下文交给子代理 |
| PreToolUse | 某些平台用于保护敏感路径或补充上下文 |

不是所有平台都有这些时点。Kilo、Antigravity 等可能需要主会话直接读取工作流；Codex 需要 hooks 功能开关与信任。

## 常见文件

```text
.claude/hooks/
.codex/hooks/
.qoder/hooks/
.cursor/hooks.json
.opencode/plugins/
.pi/extensions/
.snow/hooks/
```

目录和文件名由平台模板生成。不要套用其它平台的路径。

## 关闭 hooks

```bash
export OMTRE_HOOKS=0
```

部分脚本识别：

```bash
export OMTRE_DISABLE_HOOKS=1
```

Channel worker 可能在运行时自动关闭 omtre hooks，避免嵌套注入。

关闭后：

- 文件和任务仍在；
- 自动上下文可能缺失；
- Agent 需要显式读取 `.omtre/workflow.md` 和任务入口；
- 这不是卸载。

## 任务生命周期 hooks

在 `.omtre/config.yaml` 中配置：

```yaml
hooks:
  after_create:
    - "./scripts/on-task-create.sh"
  after_start:
    - "./scripts/on-task-start.sh"
  after_finish:
    - "./scripts/on-task-finish.sh"
  after_archive:
    - "./scripts/on-task-archive.sh"
```

执行条件：

- 工作目录是仓库根；
- 环境变量 `TASK_JSON_PATH` 指向任务记录；
- 默认超时约 60 秒；
- 失败通常只警告，不阻止主操作。

这既是安全边界也是可靠性边界：不要依靠生命周期 hook 做必须成功的关键校验。

## `task.json.hooks` 不是运行时入口

1.0.0 的核心任务生命周期从 `.omtre/config.yaml` 读取 hooks。不要按照旧文档把 hooks 写进 `task.json` 并期待核心脚本执行。

平台 hooks 的项目本地配置还可能存放在独立的 `hooks.local.json` 等文件，但核心脚本不会自动合并所有本地文件。以具体平台模板和脚本为准。

## 常见故障

### 上下文没有自动出现

按顺序检查：

1. 当前平台是否有 SessionStart 或等价能力；
2. hooks 文件是否存在；
3. 宿主是否信任当前项目；
4. 企业策略是否禁用 hooks；
5. Codex 是否启用 hooks 功能并完成审批；
6. 是否有 `OMTRE_HOOKS=0`；
7. hook 日志是否有 Python/路径错误。

### 终端 Python 正确，hook 却失败

Hook 子进程可能使用最小 PATH，解析到系统 Python，而不是你 shell 里的版本。

检查：

```bash
which python3
/usr/bin/python3 --version
```

在 hooks 日志中确认实际执行命令。macOS 系统 Python 可能较旧。

### 每轮提示丢失

检查 `.omtre/workflow.md` 中对应状态块：

```text
[workflow-state:planning]
...
[/workflow-state:planning]
```

状态块缺失时，hook 可能退化为通用提示。检查任务状态是否与状态块匹配。

### 子代理没有任务上下文

检查：

- 平台是否支持子代理注入；
- `implement.jsonl` / `check.jsonl` 是否存在；
- JSONL 路径是否存在；
- 子代理角色卡是否要求自行读取；
- 平台是否使用 hook-push 还是 pull-based 模式。

### 自定义 hooks 被升级覆盖

平台 hooks 属于受管模板。直接修改可能被 `omtre update` 覆盖。

推荐：

- 升级前 `update --dry-run`；
- 把团队扩展放到独立脚本；
- 用配置或平台设置调用独立脚本；
- 不直接改受管 hook 主体。

## 安全

- hooks 在项目环境中执行代码，只应信任你审查过的仓库；
- 不要在 hook 中读取或打印 secrets；
- 生命周期 hook 失败通常不阻断，因此不能当强制安全门；
- 生产操作应通过 CI/CD 权限控制；
- 关闭 hooks 是排查手段，不是长期安全策略。

## 调试清单

- [ ] 确认是哪一种 hook
- [ ] 确认平台与宿主版本支持
- [ ] 检查项目信任状态
- [ ] 检查 hooks 文件与设置
- [ ] 检查 Python 解释器与 PATH
- [ ] 检查 workflow 状态块
- [ ] 检查任务与上下文文件
- [ ] 用 `OMTRE_DEBUG=1` 或宿主日志获取细节
- [ ] 在临时项目复现，避免破坏主工作区

## 下一步

- [配置参考](./configuration.md)
- [平台支持矩阵](../reference/platform-matrix.md)
- [故障排查](./troubleshooting.md)
