---
title: 平台支持矩阵
description: 22 个平台的文件路径、hooks、命令、子代理与验证深度对照。
audience: team
maturity: mixed
since: 1.0.0
---

# 平台支持矩阵

<MaturityBadge level="mixed" />

omtre 可以为 22 个编码代理和 IDE 生成平台文件。**生成文件不等于宿主端全链路验证。**下表区分文件交付方式与已知验证证据。

## 先看结论

- 团队应从实际使用的 1–2 个平台开始。
- 文档标为“已验证”通常指路径、模板和更新幂等性有测试；宿主真实行为仍取决于你的版本。
- 标为“约定”表示目录布局按平台惯例生成，可能需要人工核对。
- `partial` 表示部分能力已知不完整。
- 主 CI 以 Linux 为主；Windows/macOS 需要团队自行覆盖关键路径。

## 22 平台矩阵

| 平台 | flag | 配置目录 | 命令 | 子代理 | Hooks | 验证深度 |
|---|---|---|---|---|---|---|
| Claude Code | `--claude` | `.claude/` | 集合式命令 | 支持 | SessionStart / prompt / pre-tool | 已验证；主要路径有实际使用 |
| Cursor | `--cursor` | `.cursor/` | flat 命令 | 支持 | hooks | 已验证；注意宿主版本 |
| OpenCode | `--opencode` | `.opencode/` | 集合命令 | 支持 | JS 插件 | 已验证 |
| Codex | `--codex` | `.codex/` + `.agents/skills/` | 命令转技能 | 支持 | prompt / SubagentStart | 已验证；需启用 hooks 并信任 |
| Kilo | `--kilo` | `.kilocode/` | workflows | 无 | 无 | 已验证文件面；inline |
| Kiro | `--kiro` | `.kiro/` | 技能 | 支持 | agent hooks | 已验证 |
| Gemini CLI | `--gemini` | `.gemini/` + `.agents/skills/` | TOML 命令 | pull-based | SessionStart / prompt | 已验证 |
| Antigravity | `--antigravity` | `.agent/` | workflows | 无 | 无 | 约定路径 |
| Devin | `--devin` | `.devin/` | workflows | workflow 调 `run_subagent` | 无项目级 | 已验证文件面；无代理定义 |
| Qoder | `--qoder` | `.qoder/` | flat 命令 | pull-based | SessionStart / prompt | 已验证文件面 |
| CodeBuddy | `--codebuddy` | `.codebuddy/` | 集合命令 | 支持 | SessionStart / prompt / pre-tool | 已验证 |
| GitHub Copilot | `--copilot` | `.github/` | prompts | 支持 | hooks 文件 | 文件已验证；SessionStart 模型可见性未完全确认 |
| Droid | `--droid` | `.factory/` | 集合命令 | 支持 | SessionStart / prompt / pre-tool | 已验证 |
| DeepSeek Harness | `--dsh` | `.dsh/` + `.agents/skills/` | 命令转技能 | 无 agent 面 | 无 | 约定 + inline |
| Pi Agent | `--pi` | `.pi/` + `.agents/skills/` | prompts | 支持 | 扩展 | 已验证 |
| Reasonix | `--reasonix` | `.reasonix/` | 技能 | 子代理循环 | 无 | 约定 |
| ZCode | `--zcode` | `.zcode/` | 集合命令 | 支持 | SessionStart / prompt / pre-tool | **partial**：命令与 MCP 路径部分为约定 |
| Trae | `--trae` | `.trae/` | flat 命令 | pull-based | hooks | 约定路径 |
| Oh My Pi | `--omp` | `.omp/` + `.agents/skills/` | flat 命令 | 支持 | 扩展 | 约定路径 |
| Grok Build | `--grok` | `.grok/` | flat 命令 | pull-based | 已知不消费 hook stdout | 约定路径 |
| Kimi Code | `--kimi` | `.kimi-code/` + `.agents/skills/` | 命令转技能 | pull-based | 无项目级 hook | 约定路径 |
| Snow CLI | `--snow` | `.snow/` | JSON 命令 | 支持 | SessionStart / prompt / subagent | 约定路径；hooks 可能硬编码 `python` |

表格描述的是当前实现和文档证据，不是对宿主未来版本的承诺。

## 验证深度定义

| 层级 | 含义 | 你能据此判断什么 |
|---|---|---|
| 文件已验证 | 测试验证生成路径、内容一致性和更新幂等性 | omtre 能写对文件 |
| 协议已实现 | 有 hooks、命令或子代理加载代码 | 理论上能接入 |
| 宿主已验证 | 在具体版本上跑通过任务闭环 | 可以在该版本试用 |
| 团队生产使用 | 长期真实项目运行 | 最适合复制 |

omtre 仓库的自动化测试大量覆盖第一层，部分覆盖第二层，不能替你的宿主版本完成第三层验证。

## 主要平台接入要点

### Claude Code

- 初始化：`omtre init -u <name> --claude`
- 目录：`.claude/commands/`、`.claude/agents/`、`.claude/skills/`、`.claude/hooks/`
- 启动：SessionStart hook
- 子代理注入：由 hook 推送任务上下文
- 要确认：项目信任、企业 hooks 策略

### Codex

- 初始化：`omtre init -u <name> --codex`
- 目录：`.codex/agents/`、`.agents/skills/`、AGENTS.md
- 启动：prompt hook / SubagentStart
- 要确认：hooks 功能开关、信任审批
- 不同于 Claude 的 SessionStart 结构，不能照搬其排障步骤

### Qoder

- 初始化：`omtre init -u <name> --qoder`
- 目录：`.qoder/commands/omtre-*.md`、`.qoder/skills/`、`.qoder/agents/`
- 子代理：pull-based，自行读取活动任务和 JSONL
- 要确认：子代理角色卡路径和当前会话加载行为

### Cursor

- 初始化：`omtre init -u <name> --cursor`
- 目录：`.cursor/commands/`、`.cursor/agents/`、`.cursor/skills/`、`.cursor/hooks/`
- 子代理上下文：hook-push
- 要确认：Cursor 版本对 hooks 和 Task 行为的支持

### GitHub Copilot

- 初始化：`omtre init -u <name> --copilot`
- 目录：`.github/prompts/`、`.github/agents/`、`.github/skills/`
- 已知：SessionStart 输出在当前宿主中的模型可见性未被完全确认
- 结论：需要用实际版本验证任务闭环，不能只看 hooks 文件

## 操作系统

| 系统 | 覆盖情况 | 注意 |
|---|---|---|
| Linux | 主 CI，覆盖最完整 | 以 Ubuntu + Node 20 + Python 3.9 为主 |
| Windows | 有部分测试和现场使用 | 缺完整 CI；路径、Python 名称需验证 |
| macOS | 有开发和现场使用 | 缺完整 CI；系统 Python 3.9 与 PATH 常见问题 |

平台 hooks 使用最小 PATH 时，终端里的 Python 版本可能与 hook 子进程不同。排查时同时检查 `which python3` 和 hook 日志。

## 选择建议

1. 选团队已有用户最多的平台；
2. 在一个低风险仓库完成完整任务闭环；
3. 记录宿主版本、OS、hooks 状态和失败点；
4. 第二个平台只复用同一套 `.omtre/` 核心；
5. 对 partial/约定平台按草案处理，不直接全组推广。

## 下一步

- [多平台接入](../guide/platforms.md)
- [Hooks](../advanced/hooks.md)
- [FAQ](./faq.md)
