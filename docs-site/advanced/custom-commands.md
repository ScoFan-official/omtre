---
title: 自定义命令
description: 理解 omtre 如何生成会话命令，以及如何添加不会在升级中丢失的平台自定义命令。
audience: advanced
maturity: advanced
since: 1.0.0
---

# 自定义命令

<MaturityBadge level="advanced" />

omtre 1.0.0 未提供抽象的“跨平台命令编译器”脚手架。所有的会话交互命令在物理上完全由**各 AI 宿主原生的配置文件**定义与承载。omtre 负责内置受管命令的生成与版本同步，团队的业务扩展命令则直接遵循对应编辑器的原生格式编写。

## 平台原生文件与命令映射

内置会话入口由 `omtre init` 按宿主能力生成：

| 交互意图 | 语义动作 | 典型宿主落点 |
|---|---|---|
| `start` | 初始化会话并注入活跃任务与阶段上下文 | 有 SessionStart 等入口的平台通常不生成；无自动入口的平台才生成命令或技能 |
| `continue` | 任务中途恢复或进入下一阶段切片 | `.claude/commands/omt/continue.md`、`.qoder/commands/omtre-continue.md` |
| `finish-work` | 驱动退出码验证、任务归档与日志沉淀 | `.claude/commands/omt/finish-work.md`、`.qoder/commands/omtre-finish-work.md` |

部分宿主（如 GitHub Copilot）无直接命令原语，映射为 `.github/prompts/*.prompt.md`；Codex 则映射为共享技能。不要使用某一平台的目录去推断其他宿主的物理结构。

## 命令与技能的边界界定

| 机制类型 | 物理形态 | 触发主体 | 适用场景 |
|---|---|---|---|
| **命令（Commands）** | 宿主原生快捷指令文件 | 开发者显式在输入框调用 | 明确的会话边界控制、固定管理流程入口 |
| **技能（Skills）** | 结构化 Markdown 指南 | 大模型语义自动匹配或显式调用 | 领域知识、编码模式、特定架构规范指南 |
| **子代理（Sub-agents）** | 进程隔离的角色定义卡 | 主会话运行时动态派发 | 需深度物理隔离的任务实现、技术调研与审查 |
| **生命周期 Hooks** | 本地 Shell / 脚本触发点 | 任务状态机底层机械事件 | 创建、启动、归档等状态跃迁时的审计与通知 |

若一段逻辑的目的是告诉 Agent“如何处理某类特定技术”，应编写技能或规范；若目的是要求 Agent“立即执行一个固定、有输入参数的工程流程”，应编写命令。

## 编写团队自定义命令

### 1. 严格使用独立的命名空间

::: danger 命名空间冲突防护
**严禁占用或覆盖 `omtre-*` 前缀。** 所有以 `omtre-*` 命名的文件均属于 CLI 受管清单。在执行 `omtre update` 时，受管文件会被官方模板重新检出同步，本地直接修改随时可能被覆写。
团队自定义命令必须使用自定义命名空间（例如 `team-*`、`ops-*`）。
:::

### 2. 编写宿主原生命令示例

以 Qoder 原生命令为例（存放于 `.qoder/commands/team-release-review.md`）：

```markdown
---
name: team-release-review
description: "执行发布就绪度审查并运行全量测试"
---

# 团队发布审查工作流

1. 读取 `.omtre/spec/release/checklist.md` 规范。
2. 运行 `pnpm lint && pnpm typecheck && pnpm test`。
3. 检查是否有未提交的脏文件或本地配置。
4. 仅产出阻断项报告，严禁修改任何生产环境代码。
5. 严禁执行 git push 或发布上线动作。
```

而在 Claude Code 下，应遵循其 `.claude/commands/` 目录规范，避免生搬硬套 frontmatter。

## 升级过程中的冲突与受管状态

执行 `omtre update` 时，更新引擎遵循明确的边界：
- **仅同步受管清单中的文件**：团队自建的 `team-*.md` 只要未与新版本模板同名，绝不会被静默删除；
- **排查建议**：在升级全局包后，先运行 `omtre update --dry-run` 查看变更树，确保无误后再执行正式同步。

## 跨平台多宿主支持

若团队内成员混用不同编辑器，同一个自定义命令必须分别向各宿主目录输出对应的原生文件：

```text
.qoder/commands/team-review.md              # 供 Qoder 宿主解析
.claude/commands/team-review.md             # 供 Claude Code 宿主解析
.github/prompts/team-review.prompt.md       # 供 GitHub Copilot 宿主解析
```

不存在某种由 omtre 中转解析的“万能命令语法糖”，各宿主的原生扩展格式由各平台独立解析。

## 命令内部的安全红线

命令赋予了开发者快速唤起 Agent 执行复合操作的能力，编写时必须遵守工程安全底线：
- **禁止硬编码静默推送与部署**：命令正文中严禁包含无条件的 `git push`、`git merge` 或发布脚本，关键动作必须留有人工 Review 缝隙；
- **禁止在命令中硬编码敏感凭证**：API Key、数据库密码与 Token 绝不能写入任何命令正文中；
- **遵循退出码与 Dry-run 准则**：在涉及破坏性操作的命令中，优先强制使用 `--dry-run` 预览变更，以机器可复现的退出码验证结果。
- [ ] 至少一个目标平台真实调用成功

## 下一步

- [自定义子代理](./custom-agents.md)
- [Hooks](./hooks.md)
- [升级、回滚与卸载](../guide/upgrade-and-remove.md)
