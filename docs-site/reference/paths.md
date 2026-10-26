---
title: 关键文件路径
description: 查询 omtre 项目、平台与用户级运行数据的真实路径和提交边界。
audience: advanced
maturity: stable
since: 1.0.0
---

# 关键文件路径

<MaturityBadge level="stable" />

## 项目核心

```text
your-project/
├── .omtre/
│   ├── workflow.md
│   ├── config.yaml
│   ├── .developer                 # gitignored
│   ├── .runtime/                  # gitignored
│   ├── spec/
│   ├── tasks/
│   ├── workspace/
│   ├── agents/
│   ├── domains/
│   └── scripts/
└── <platform dirs>
```

| 路径 | 是否提交 | 说明 |
|---|---|---|
| `.omtre/workflow.md` | 是 | 工作流阶段与步骤 |
| `.omtre/config.yaml` | 是 | 项目配置 |
| `.omtre/.developer` | 否 | 当前 checkout 的开发者身份 |
| `.omtre/.runtime/` | 否 | 活动任务指针、运行态、worktree、ledger |
| `.omtre/spec/` | 是 | 团队规范 |
| `.omtre/tasks/` | 是 | 活动任务与归档 |
| `.omtre/workspace/` | 是 | 开发者 journal 与索引 |
| `.omtre/agents/` | 是 | 运行时角色卡 |
| `.omtre/domains/` | 是 | 领域 board 与工作协议 |
| `.omtre/scripts/` | 是 | 任务、验证与上下文脚本 |

## 任务目录

```text
.omtre/tasks/<MM-DD-slug>/
├── task.json
├── prd.md
├── design.md
├── implement.md
├── implement.jsonl
├── check.jsonl
└── research/
```

归档路径：

```text
.omtre/tasks/archive/<YYYY-MM>/<MM-DD-slug>/
```

## 运行时路径

```text
.omtre/.runtime/
├── sessions/                       # 按会话识别的活动任务
├── worktrees/<task-dir>/           # omtre run 的工作树
└── runs/run-<UTC>.jsonl            # run ledger
```

这些都不应提交。worktree 是临时 Git 工作目录，不要手工把它当主仓库使用。

## 平台目录

| 平台 | 主要目录 |
|---|---|
| Claude Code | `.claude/` |
| Cursor | `.cursor/` |
| OpenCode | `.opencode/` |
| Codex | `.codex/` + `.agents/skills/` |
| Kilo | `.kilocode/` |
| Kiro | `.kiro/` |
| Gemini CLI | `.gemini/` + `.agents/skills/` |
| Antigravity | `.agent/` |
| Devin | `.devin/` |
| Qoder | `.qoder/` |
| CodeBuddy | `.codebuddy/` |
| GitHub Copilot | `.github/` |
| Droid | `.factory/` |
| DeepSeek Harness | `.dsh/` + `.agents/skills/` |
| Pi Agent | `.pi/` + `.agents/skills/` |
| Reasonix | `.reasonix/` |
| ZCode | `.zcode/` |
| Trae | `.trae/` |
| Oh My Pi | `.omp/` |
| Grok Build | `.grok/` |
| Kimi Code | `.kimi-code/` |
| Snow CLI | `.snow/` |

根目录的 `AGENTS.md` 也可能是 omtre 与其他代理共享的入口。不要手工改写整个文件；保留非 omtre 内容。

## 用户级路径

| 路径 | 用途 |
|---|---|
| `~/.omtre/channels/` | Channel 事件、worker 日志和锁 |
| `~/.omtre/ablations/` | ablate/restore 的恢复事务 |
| 宿主自身会话目录 | `omtre mem` 读取的历史来源 |

Channel 是本地文件运行时，不等于远端服务。

## 哪些文件不应手工编辑

- `.omtre/.runtime/**`
- `worktree` 内部的 `.omtre/` 指针
- 生成的 CLI 参数参考
- `task.json.status`
- 平台受管文件中由 `omtre update` 维护的区块

需要修改项目行为时，优先使用：

- `.omtre/config.yaml`
- `.omtre/spec/`
- `.omtre/agents/`
- 工作流模板
- 平台自定义文件

## 平台生成文件与自定义文件

`omtre update` 只处理受管文件和模板。未跟踪的自定义文件通常不会被删除，但升级冲突仍可能影响同名路径。

升级前：

```bash
omtre update --dry-run
```

检查计划中的覆盖、删除和迁移。

## `.gitignore` 建议

至少保证本地开发身份和运行时状态不会进入提交：

```text
.omtre/.developer
.omtre/.runtime/
```

workspace 是否提交是团队决策。默认模型倾向于提交日志用于跨会话记忆，但这会带来隐私和合并成本。

## 下一步

- [task.json Schema](./task-schema.md)
- [平台支持矩阵](./platform-matrix.md)
- [升级、回滚与卸载](../guide/upgrade-and-remove.md)
