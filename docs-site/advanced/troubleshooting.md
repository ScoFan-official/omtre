---
title: 故障排查
description: 按证据排查 omtre 初始化、hooks、任务、验证、升级、Channel 和运行器问题。
audience: advanced
maturity: stable
since: 1.0.0
---

# 故障排查

<MaturityBadge level="stable" />

1.0.0 没有统一的 `omtre doctor`。排障依赖文件、命令输出、ledger、hook 日志和宿主状态。

先确认问题属于哪一层，再收集对应证据。

## 排障顺序

```text
版本与依赖
  -> 初始化和平台文件
  -> hooks 是否执行
  -> 任务状态与产物
  -> 上下文与验证
  -> Git / 提交 / 归档
  -> 高级运行器
```

不要一开始就删除 `.omtre/` 或重装全部环境。

## 收集基础信息

```bash
omtre --version
node --version
python3 --version
git status --short --branch
omtre platforms
python3 .omtre/scripts/task.py current --source
```

再记录：

- 操作系统；
- 宿主名称和版本；
- 是否启用 hooks；
- 使用的是哪个 provider/model；
- 失败发生在哪个阶段；
- 是否有可复现的最小任务。

## 安装和初始化

### `omtre` 命令不存在

- 检查 npm 全局 bin 是否在 PATH；
- 重新打开 terminal；
- 确认 Node 版本；
- 检查是否有多个 Node 版本管理器。

### `init` 生成的平台文件不符合预期

```bash
omtre platforms --json
```

检查：

- 传入的平台 flag；
- 是否已有 `.omtre/`；
- 当前用户身份；
- 是否需要追加而不是重写。

不要手工创建同名受管文件来修补，先运行 `update --dry-run` 看差异。

### Python 脚本报错

- 确认 Python 3.9+；
- 确认 hook 子进程和终端使用的是同一解释器；
- 查看脚本错误栈；
- 用 `OMTRE_DEBUG=1` 获取更多细节（支持的位置）。

macOS 常见问题是系统 Python 被 hook 的 PATH 选中。

## Hooks

### Agent 没有加载任务或规范

依次检查：

1. 平台是否有自动注入能力；
2. hooks 文件是否生成；
3. 项目是否被宿主信任；
4. 企业策略是否禁止 hooks；
5. 是否有 `OMTRE_HOOKS=0`；
6. `.omtre/workflow.md` 是否有匹配状态块；
7. hook 日志是否有错误。

临时关闭：

```bash
export OMTRE_HOOKS=0
```

关闭只用于判断问题是否来自 hooks，不是长期方案。

### 每轮提示只有通用回退

可能缺少：

```text
[workflow-state:planning]
...
[/workflow-state:planning]
```

检查任务状态与状态块名称是否一致。

## 任务

### 创建失败

- 标题或描述为空；
- slug 非法；
- 同名任务已存在；
- 当前开发者身份缺失；
- 父任务路径不存在。

```bash
python3 .omtre/scripts/task.py list
python3 .omtre/scripts/task.py validate .omtre/tasks/<task-dir>
```

### 当前任务为空

```bash
python3 .omtre/scripts/task.py current --source
```

可能原因：

- 没有创建任务；
- 没有执行 `start`；
- 当前会话身份无法持久化；
- 收尾流程已清除指针；
- 任务已归档。

### `start` 被拒绝

可能检查：

- PRD Domain 行；
- 新领域注册；
- 已存在但空的上下文清单；
- 配置要求验证契约；
- 任务状态不是 `planning`。

看具体错误，不要手改状态绕过。

## 上下文清单

### JSONL 校验失败

- 是否为一行一个 JSON 对象；
- 是否有非法 JSON；
- `file` 是否为字符串；
- 路径是否存在；
- 是否只剩示例行；
- 是否包含不适当的源码或目录。

### 子代理没有读取上下文

区分平台模式：

- hook-push：检查 hooks；
- pull-based：检查角色卡是否要求读取；
- inline：检查技能是否加载。

## 验证

### `run-verify` 报没有契约

```bash
python3 .omtre/scripts/task.py add-verify .omtre/tasks/<task-dir> "pnpm test"
```

命令必须能从仓库根执行。

### 验证命令在 shell 里通过，脚本失败

检查：

- 工作目录；
- PATH；
- shell；
- 环境变量；
- 子进程超时；
- 交互式命令；
- 输出编码和 locale。

验证命令不要依赖人工输入。

### 归档因验证失败被拒绝

先修复问题。只有验证对该改动确实不适用时，才使用带理由的跳过：

```bash
python3 .omtre/scripts/task.py archive <task-dir> \
  --skip-verify "Reason recorded for review."
```

## 提交与归档

### 归档说分支元数据错误

检查 `task.json` 中的：

- `branch`
- `base_branch`

从未 PR-backed 的任务可以使用：

```bash
python3 .omtre/scripts/task.py archive <task-dir> --skip-branch-validation
```

先确认不是实际分支错误。

### 归档移动了，但自动提交失败

任务可能已进入 archive 目录，只是簿记提交失败。检查：

```bash
git status --short
python3 .omtre/scripts/task.py list-archive
```

人工补交任务簿记，不要重新创建任务。

### 收尾出现 push

某些 finish-work 实现会在有 remote 时 push。若不应推送，给 Agent 明确指令：

```text
现在只归档和记录 journal，不要 push。
```

团队应通过分支保护和凭据管理控制真实风险。

## Channel

证据位置：

```text
~/.omtre/channels/<project>/<channel>/
```

查看：

```bash
omtre channel list --json
omtre channel messages <channel> --raw --since 20 --follow
```

常见原因：

- worker 未启动；
- 消息 target 不匹配；
- 超时；
- provider 凭证错误；
- sandbox 阻止操作；
- 事件日志锁；
- live worker 达到预算。

失败的单次 `channel run` 可能保留频道和 stderr 路径。

## omtre run

先看 ledger：

```text
.omtre/.runtime/runs/run-<UTC>.jsonl
```

关注：

- `ticket_result`
- `stop`
- `blocked`
- `verify`
- `delivery`

常见原因：

- 没有验证契约；
- worker 无法解析；
- provider 不可用；
- worktree 创建失败；
- 任务脚本未提交到基线；
- 验证失败；
- 交付门拒绝；
- 命中 always-stop 路径。

先运行：

```bash
omtre run --ticket <task-dir> --dry-run
```

## 迁移、消融和升级

### 迁移

```bash
omtre migrate --dry-run --json
```

保留报告；失败时不要直接删除新目录。使用 Git 或迁移前备份恢复。

### restore 冲突

运行：

```bash
omtre restore --dry-run
```

按报告处理冲突路径，再重试。不要强行删除恢复事务。

### update 覆盖定制

从 Git 恢复；今后使用：

```bash
omtre update --dry-run
omtre update --create-new
```

并避免 `--force`。

## 历史会话

```bash
omtre mem projects
omtre mem search "keyword" --global
omtre mem context <session-id>
omtre mem extract <session-id>
```

它不是当前任务的状态源，只用于回溯对话证据。

## 何时寻求帮助

报告问题时提供：

- omtre、Node、Python、OS、宿主版本；
- 最小复现任务；
- `--dry-run` 或 JSON 输出；
- 无 secrets 的相关日志；
- 预期行为和实际行为；
- 是否在干净临时仓库复现。

## 下一步

- [FAQ](../reference/faq.md)
- [关键文件路径](../reference/paths.md)
- [平台支持矩阵](../reference/platform-matrix.md)
