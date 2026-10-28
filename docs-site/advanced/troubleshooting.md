---
title: 故障排查
description: 按证据排查 omtre 初始化、hooks、任务、验证、升级、Channel 和运行器问题。
audience: advanced
maturity: stable
since: 1.0.0
---

# 故障排查

<MaturityBadge level="stable" />

omtre 系统的排障基于明确的**文件真实存在性、子进程退出码与审计日志证据**。排查故障时，必须遵循分层定位模型，精准确定问题发生在环境层、平台层、任务状态机还是验证契约层，**严禁在未定位根因前盲目删除 `.omtre/` 或重置全局环境**。

## 结构化分层排查链路

```text
1. 环境基线与 PATH 依赖 (Node 18.17+ / Python 3.9+ / Git)
       │
2. 宿主平台文件与受管状态 (.claude / .qoder / platforms)
       │
3. 平台 Hooks 触发与解释器解析 (SessionStart / OMTRE_HOOKS=0)
       │
4. 任务生命周期与指针 (task.py current / .developer / .runtime)
       │
5. 验证契约与退出码判据 (run-verify 退出码必须为 0)
       │
6. 业务代码提交与任务归档解耦 (git commit 必须先于 task.py archive)
```

## 基础事实收集基线

在深入排查任何疑难杂症前，在终端中连续执行以下命令采集核心状态快照：

```bash
omtre --version
node --version
python3 --version
git status --short --branch
omtre platforms
python3 .omtre/scripts/task.py current --source
```

同时记录：当前操作系统、AI 编辑器宿主精确版本、是否设置了 `OMTRE_HOOKS=0`，以及失败发生在哪一步。

## 1. 安装与全局环境故障

### 终端提示 `omtre: command not found`
- **根因定位**：全局 npm bin 目录未纳入当前操作系统的全局 `PATH` 环境变量中；
- **排查命令**：
  ```bash
  npm bin -g
  npm config get prefix
  ```
- **处置方案**：将全局 bin 目录追加至 `~/.zshrc` 或 `~/.bashrc` 中并重启终端。

### Python 脚本执行报语法错误
- **根因定位**：当前系统中的 `python3` 关联了过旧的 Python 版本（低于 3.9）；
- **处置方案**：升级至 Python 3.9 或更高版本；排查终端是否存在多个 Python 版本冲突。

## 2. 平台 Hooks 与上下文注入故障

### 会话启动后，Agent 未能自动加载任务上下文或规范
按以下优先级依次排查：
1. **项目信任授权**：确认当前 IDE 宿主是否已将当前项目标记为 Trusted；具体是否拦截 Hook 取决于宿主策略与版本；
2. **环境变量检查**：确认当前终端或系统变量中未残留 `OMTRE_HOOKS=0` 或 `OMTRE_DISABLE_HOOKS=1`；
3. **工作流状态块缺失**：检查 `.omtre/workflow.md` 中是否存在与当前任务状态对应的 `[workflow-state:<status>]` 块。若状态块被误删，Hook 将退化为通用提示；
4. **最小 PATH 导致调用错误解释器**：IDE 宿主拉起 Hook 子进程时通常使用沙箱最小 `PATH`，可能调用了系统默认的陈旧 Python（如 macOS 系统 Python），而非你终端中的 Python 3.9+。在 Hook 脚本首行打印 `which python3` 确认。

### 紧急排错逃生口
若怀疑 Hook 脚本报错阻塞了编辑器启动，可在终端临时设置 `OMTRE_HOOKS=0`，关闭 omtre 注入的 hooks；宿主自身的其它 hooks 不受这个变量控制：
```bash
export OMTRE_HOOKS=0
```

## 3. 任务状态机与当前指针故障

### 执行 `task.py current` 提示当前无活跃任务
- **根因 1：任务没有绑定到当前会话**：`task.py create` 在能解析会话标识时会直接绑定当前任务；`--no-start` 会关闭自动绑定。之后执行 `task.py start <task-dir>` 会把 `planning` 翻转为 `in_progress` 并再次尝试写入指针。
- **根因 2：当前会话没有可持久化的任务指针**：检查平台是否提供 `OMTRE_CONTEXT_ID` 或原生 session id。`.omtre/.developer` 只保存开发者名，用于日志目录和 `--mine` 过滤，不负责挂载当前任务。
- **根因 3：任务已完成收尾**：已执行过 `finish-work` 或 `task.py archive`，任务指针已按设计安全清空。

### 执行 `task.py start` 抛出错误并拒绝执行
常见原因：
- `implement.jsonl` / `check.jsonl` 已存在，但没有任何有效条目；
- 任务所在的领域存在他人的活动施工旗；
- PRD 缺少必需的 Domain 行；
- 配置要求验证契约，但任务尚未登记任何命令。

`start` 只在 `planning` 状态翻转；任务已经是 `in_progress` 或 `completed` 时不会因状态本身报错。没有会话标识时它会进入降级模式，可能成功翻转状态但不持久化当前任务指针。

::: danger 严禁手工篡改 task.json.status
当状态转换被脚本拦截时，**绝对禁止直接打开 `task.json` 手工改写 `status` 字段**。手工强改会绕过依赖检查与验证绑定，导致后续归档或批处理运行器引发不可逆的状态崩溃。
:::

## 4. 验证契约（Verify Contract）与退出码故障

### 执行 `run-verify` 报没有登记任何契约
通过以下命令在任务中持久化绑定验证命令：
```bash
python3 .omtre/scripts/task.py add-verify .omtre/tasks/<task-dir> "pnpm test"
```

### 命令在普通终端跑通，但在 `run-verify` 或归档时报错挂起
- **必须为单次执行命令**：**严禁传入 `vitest`、`jest --watch`、`cargo watch` 等带有持续监听模式的命令**。监听模式会导致子进程永不退出，使归档脚本无限期挂死；
- **退出码严格要求为 0**：本地脚本机械根据命令进程的 Exit Code 进行断言。任何警告、类型报错或断言失败导致的非 0 退出码，都会直接触发 `sys.exit(1)` 机械阻断归档；
- **排查非零退出码**：单独在终端根目录下执行该命令，查看详细标准输出与错误流，修复测试用例直至退出码为 0。

## 5. 提交、归档与收尾故障

### 归档因验证失败被拒绝
**处置原则**：先修复代码或测试。若本次改动确实不需要执行该验证契约，可用非空原因显式跳过：
```bash
python3 .omtre/scripts/task.py archive <task-dir> \
  --skip-verify "纯文档排版修正，无业务代码改动"
```
跳过原因会写入 `task.json` 的 `verify_skipped`，供团队 Code Review 审计。

### 归档成功移动了目录，但业务代码依然未入库
**致命认知误区纠偏**：
- `task.py archive` 仅仅负责将 `.omtre/tasks/<task-dir>/` 移入 `archive/` 目录并更新状态机，**绝对不负责提交业务源码**；
- 必须补齐正确的提交闭环：
  ```bash
  git add src/
  git commit -m "feat: 明确的业务提交说明"
  ```
- **核心顺序铁律**：必须遵循 `业务代码提交 -> 任务归档 -> 会话日志`，绝不可颠倒。

### 收尾过程中发生越权代码推送（Git Push）
原生脚本 `task.py archive` 绝对不会调用 `git push`。若宿主中的复合自定义命令带有推送行为，请在向 Agent 发出收尾指令时明确追加：“先不要 push”。生产环境必须通过远端分支保护（Branch Protection Rules）杜绝非授权推送。

## 6. 临时消融（Ablate）与版本升级冲突

### 执行 `omtre restore` 提示路径冲突（Conflict）
- **原因**：在消融期间，某个原本由 omtre 管理的受管路径被外部编辑或新建；
- **处置方案**：先运行 `omtre restore --dry-run` 找出具体的冲突路径列表，将外部修改移出工作区后，重新执行还原。严禁强行删除恢复事务备份。

### 执行 `omtre update` 覆盖了本地自定义规范
- **处置方案**：立即通过 `git checkout -- .omtre/spec/` 从版本控制中找回本地定制；
- **防范机制**：以后在升级时，务必先执行 `omtre update --dry-run` 预览变更，并使用 `--create-new` 参数输出 `.new` 差异文件由人工审查合并，避免日常使用 `--force`。

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
