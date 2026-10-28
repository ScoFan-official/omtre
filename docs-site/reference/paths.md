---
title: 关键文件路径
description: 查询 omtre 项目、平台与用户级运行数据的真实路径和提交边界。
audience: advanced
maturity: stable
since: 1.0.0
---

# 关键文件路径

<MaturityBadge level="stable" />

omtre 将项目仓库、宿主平台配置与本地运行时状态严格划分为不同的文件拓扑层级。清晰区分“版本控制受管文件”与“本地临时状态”是保障多开发者并行协作与 CI 安全交付的前提。

## 仓库受管核心（.omtre/）

`.omtre/` 目录位于项目根节点，是所有编码代理与团队成员共享的事实中心：

```text
your-project/
├── .omtre/
│   ├── workflow.md               # [受管/提交] 阶段转换规则与核心工作流契约
│   ├── config.yaml               # [受管/提交] 项目级全局配置（分支策略、门禁开关）
│   ├── .developer                # [本地/忽略] 当前 checkout 的开发者名；非鉴权凭据
│   ├── .runtime/                 # [本地/忽略] 会话活跃任务指针、运行态与 worktree
│   ├── spec/                     # [受管/提交] 团队分层架构规范与编码约束
│   ├── tasks/                    # [受管/提交] 活动任务与分类归档（含 PRD 与设计）
│   ├── workspace/                # [受管/提交] 团队工作区索引与个人会话日志
│   ├── agents/                   # [受管/提交] 运行时子代理角色卡
│   ├── domains/                  # [受管/提交] 领域 Board、协议与任务流转规则
│   └── scripts/                  # [受管/提交] task.py 等状态机与验证原生脚本
└── <platform dirs>               # [受管/提交] .claude/、.qoder/ 等平台薄适配层
```

### Git 提交边界矩阵

| 文件 / 路径 | Git 跟踪策略 | 工程职责与约束 | 冲突与泄漏风险 |
|---|---|---|---|
| `.omtre/workflow.md` | **必须提交** | 定义各阶段输入输出契约与 Hook 索引 | 极低；由团队架构师统一演进 |
| `.omtre/config.yaml` | **必须提交** | 存储项目全局策略（如 `verify_required: true`） | 低；项目初始化后极少频繁修改 |
| `.omtre/.developer` | **严禁提交** | 本机开发者名，供日志目录与 `--mine` 过滤使用；不参与鉴权 | **若误提会让不同机器共享同一显示身份** |
| `.omtre/.runtime/` | **严禁提交** | 本地临时进程状态、活跃会话指针与 worktree | **若误提会把机器相关状态带入仓库** |
| `.omtre/spec/` | **必须提交** | 团队共享的技术规范与架构约束 | 随 PR 审查与业务代码一同迭代 |
| `.omtre/tasks/` | **必须提交** | 任务需求 PRD、设计、上下文索引与归档证据 | 每个任务独立目录；同任务并行修改仍可能冲突 |
| `.omtre/workspace/` | **推荐提交** | 开发者个人日志（`workspace/<name>/journal-N.md`） | 目录按开发者分隔；`index.md` 仍可能冲突 |
| `.omtre/agents/` | **必须提交** | 定义各 Worker 角色的系统提示词与能力边界 | 帮助不同开发者使用同一套派发定义 |
| `.omtre/scripts/` | **必须提交** | Python 原生任务与验证状态机驱动脚本 | 确保 CI/本地验证环境行为与代码同源 |

## 任务目录拓扑（.omtre/tasks/）

单次业务变更的所有上下文资产均落盘于独立任务目录中：

```text
.omtre/tasks/<MM-DD-slug>/
├── task.json                     # 核心元数据（状态机、验证契约、依赖、分支）
├── prd.md                        # 需求目标、范围边界（In/Out scope）与验收条件
├── design.md                     # 技术方案、跨层接口契约与回滚预案（复杂任务推荐）
├── implement.md                  # 实施分步切片与局部自测清单（复杂任务推荐）
├── implement.jsonl               # 子代理实现阶段物理上下文清单（只指向 spec/research）
├── check.jsonl                   # 子代理审查阶段物理上下文清单
└── research/                     # 任务专属的技术调研报告与探针脚本
    └── *.md
```

### 归档迁移路径

任务完成并校验通过后，通过 `task.py archive` 原子移入归档区：

```text
.omtre/tasks/archive/<YYYY-MM>/<MM-DD-slug>/
```

归档目录按年月归类，保持活跃任务根目录轻量整洁。

## 运行时状态拓扑（.omtre/.runtime/，严禁提交）

```text
.omtre/.runtime/
├── sessions/                     # 各终端与会话关联的当前活跃任务软链接指针
├── worktrees/<task-dir>/         # omtre run 自动化运行器创建的独立 Git 工作树
└── runs/run-<UTC>.jsonl          # 自动化运行器执行账本与指令审计流水
```

::: danger 严禁将 .runtime 纳入版本控制
`.runtime/` 是动态运行时的私有工作空间。例如 `worktrees/` 包含独立的 Git 分支检出，若误暂存提交将导致 Git 仓库嵌套混乱或体积膨胀。必须在 `.gitignore` 中显式排除。
:::

## 宿主平台适配目录

omtre 会为目标平台生成特定的薄适配层，用于引导各编辑器挂载 Hook 与命令：

| 平台 | 适配目录 / 文件 | 宿主交互机制 |
|---|---|---|
| Claude Code | `.claude/` | 读取 `settings.json`、`commands/`、`skills/` 与 hooks |
| Qoder | `.qoder/` | 读取 `commands/`、`skills/` 与 Pull-based 子代理角色卡 |
| Codex | `.codex/` + `.agents/skills/` | 读取 SubagentStart 派发配置与共享技能 |
| Cursor | `.cursor/` | 读取扁平命令、代理规则与 hooks |
| GitHub Copilot | `.github/` | 读取 `prompts/`、`agents/` 与 hooks 配置 |
| OpenCode | `.opencode/` | 读取会话拦截 JS 插件 |
| Gemini CLI | `.gemini/` + `.agents/skills/` | 读取 TOML 命令与 Pull-based 角色卡 |
| Trae | `.trae/` | 读取平铺命令与 hooks 规则 |
| CodeBuddy | `.codebuddy/` | 读取集合命令、子代理与 hooks |
| Droid | `.factory/` | 读取集合命令与生命周期 hooks |
| Kiro | `.kiro/` | 读取 Agent hooks 与技能定义 |
| 根目录入口 | `AGENTS.md` | 跨平台全局基础指令锚点（保留外部定制内容） |

## 用户全局环境路径

位于用户操作系统家目录下，属于本机跨仓库共享状态：

| 绝对路径 | 技术职责与数据性质 |
|---|---|
| `~/.omtre/channels/` | Channel 进程间通信事件总线、本地 worker 状态与并发锁文件 |
| `~/.omtre/ablations/` | `omtre ablate` 执行时生成的外部恢复事务备份（用于无损还原） |

## 严禁手工编辑的文件清单

以下文件由 omtre 脚本或构建系统机械维护，**手工直接修改极易引发状态脱节或运行死锁**：

- `.omtre/.runtime/**`（任何运行时指针与临时流水）；
- 处于 `worktrees/` 目录内部的临时配置文件；
- `task.json` 中的 `status`、`completedAt` 与 `verify` 核心字段（必须通过 `task.py` 驱动命令变更）；
- 平台配置文件中带有 `OMTRE:START` ... `OMTRE:END` 受管注释保护的块（由 `omtre update` 负责同步，外部手改会在下次更新时发生冲突）。

## 推荐的 .gitignore 配置基线

在项目根目录的 `.gitignore` 中，必须包含以下基线规约：

```text
# omtre 运行时与本地开发者标识（必须排除）
.omtre/.developer
.omtre/.runtime/
```

## 下一步

- [task.json Schema](./task-schema.md)
- [平台支持矩阵](./platform-matrix.md)
- [升级、回滚与卸载](../guide/upgrade-and-remove.md)
