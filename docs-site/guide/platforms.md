---
title: 多平台接入
description: 在 Claude Code、Codex、Qoder、Cursor、Copilot 等平台接入 omtre，并理解平台差异。
audience: team
maturity: mixed
since: 1.0.0
---

# 多平台接入

<MaturityBadge level="mixed" />

omtre 的核心状态相同，但不同平台通过不同方式加载 hooks、命令、技能和子代理。先选团队实际使用的 1–2 个平台，确认闭环，再扩展。

## 选择平台

| 平台 | flag | 主要配置目录 | 建议起点 |
|---|---|---|---|
| Claude Code | `--claude` | `.claude/` | hooks 与子代理能力较完整 |
| Codex | `--codex` | `.codex/`、`.agents/skills/` | 注意 hooks 功能开关与信任确认 |
| Qoder | `--qoder` | `.qoder/` | pull-based 子代理，按角色读取上下文 |
| Cursor | `--cursor` | `.cursor/` | 使用 hooks 与子代理，注意宿主版本 |
| GitHub Copilot | `--copilot` | `.github/` | SessionStart 行为需按当前宿主验证 |
| OpenCode | `--opencode` | `.opencode/` | JS 插件提供启动与每轮上下文 |
| Gemini CLI | `--gemini` | `.gemini/`、`.agents/skills/` | pull-based 子代理上下文 |
| Kiro | `--kiro` | `.kiro/` | agent hooks 与技能/代理文件 |

完整 22 项路径和验证深度见[平台支持矩阵](../reference/platform-matrix.md)。

## 初始化

只选择一个平台：

```bash
omtre init -u your-name --qoder
```

同时选择多个：

```bash
omtre init -u your-name --qoder --codex
```

检查：

```bash
omtre platforms
omtre platforms --json
```

在已有 omtre 项目中增加一个平台：

```bash
omtre init --cursor
```

不需要重新创建开发者身份时，可以不传 `-u`。具体行为取决于 `.developer` 是否存在。

## 各平台的第一步

### Claude Code

```bash
omtre init -u your-name --claude
```

初始化会写入 `.claude/` 下的命令、技能、子代理与 hooks 配置。启动 Claude Code 时，项目需要被信任，hooks 才会执行。

检查 `.claude/settings.json` 中生成的 hook 配置，并确认企业策略没有禁止 hooks。

### Codex

```bash
omtre init -u your-name --codex
```

Codex 使用 `.codex/` 子代理与技能文件，同时在 `.agents/skills/` 提供共享技能。它主要依赖 prompt hook / SubagentStart 路径，而不是与 Claude Code 相同的 SessionStart 结构。

如果 hooks 功能未启用或未信任，自动上下文可能不会发生。此时让 Agent 显式读取对应技能/工作流入口。

### Qoder

```bash
omtre init -u your-name --qoder
```

Qoder 使用 `.qoder/commands/omtre-*.md`、`.qoder/skills/`、`.qoder/agents/` 和 hooks。子代理采用 pull-based 方式：角色卡要求子代理自行读取活动任务和 JSONL 清单。

### Cursor

```bash
omtre init -u your-name --cursor
```

初始化 `.cursor/` 下的扁平命令、技能、代理和 hooks。不同 Cursor 版本对 hooks 与子代理支持可能存在差异；升级宿主后应重新验证。

### GitHub Copilot

```bash
omtre init -u your-name --copilot
```

Copilot 使用 `.github/` 下的 prompt、agent、skill 和 hooks 文件。SessionStart 输出在当前 Copilot 宿主中的模型可见性需要实测，不要把“文件存在”当成“上下文一定被注入”。

## 平台深度并不相同

omtre 会为 22 个平台生成配置集合，但这不等于 22 个平台都完成过同等深度的端到端验证。

| 层级 | 含义 |
|---|---|
| 文件生成已验证 | 文件路径、内容和更新幂等性有自动化测试 |
| 协议已实现 | 有对应 hooks、命令或子代理加载路径 |
| 宿主端已验证 | 在具体宿主版本中实际跑通过会话与任务闭环 |
| 团队已生产使用 | 有真实项目和长期使用证据 |

引入前至少确认第三层。对文档标注为 convention 或 partial 的平台，按 draft 处理并做小范围实测。

## hooks 关闭与排查

临时关闭 hooks：

```bash
export OMTRE_HOOKS=0
```

部分脚本也识别 `OMTRE_DISABLE_HOOKS`。关闭后，任务和规范仍然存在，但自动注入可能失效，需要 Agent 主动读取入口。

检查平台文件是否存在：

```bash
find .qoder -maxdepth 3 -type f | sort
find .claude -maxdepth 3 -type f | sort
```

只读检查，不要使用会改变工作区的命令。

## 团队加入已有项目

新成员在自己的 checkout 中运行：

```bash
omtre init -u their-name --qoder
```

如果项目已有 `.omtre/` 而当前 checkout 没有 `.developer`，初始化可能生成 joiner onboarding 任务，用于阅读工作流和规范。确认这个任务是否必要；不需要可正常归档。

`.developer` 是 gitignored 的个人身份文件，不应由团队提交一个共享身份。

## 跨平台协作

多个平台可以共享同一份 `.omtre/`：

```text
.omtre/                共享核心
├── spec/
├── tasks/
├── workspace/
├── agents/
└── scripts/

.claude/               平台适配
.qoder/
.cursor/
.codex/
```

注意：

- 任务状态和规范是共享事实；
- 命令名、hook 机制和子代理派发方式不同；
- 不同平台可能读取不同上下文文件；
- 跨平台问题应先查看平台矩阵，不要假设行为一致。

## 操作系统与运行环境

主 CI 目前以 Linux、Node.js 20、Python 3.9 为主。Windows 和 macOS 已有部分现场使用与修复，但不是完整 CI 覆盖。

关注点：

- Python 可执行文件名称和版本；
- hooks 是否使用终端同一解释器；
- 路径空格和大小写；
- 部分脚本对 `python` 与 `python3` 的硬编码；
- 宿主自身对 hooks 的安全限制。

团队试点应把实际操作系统列入验收，而不是只验证文件生成。

## 卸载某个平台

不要手工删除平台文件。omtre 管理跨多个文件和目录，手工删除容易残留。

如需永久移除项目内所有 omtre 表面：

```bash
omtre uninstall --dry-run
omtre uninstall
```

该操作会同时移除 `.omtre/`。只想临时比较时使用 [ablate / restore](../advanced/ablate-and-restore.md)。

## 下一步

- [平台支持矩阵](../reference/platform-matrix.md)
- [升级、回滚与卸载](./upgrade-and-remove.md)
- [Hooks](../advanced/hooks.md)
