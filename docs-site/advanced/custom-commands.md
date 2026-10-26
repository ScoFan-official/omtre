---
title: 自定义命令
description: 理解 omtre 如何生成会话命令，以及如何添加不会在升级中丢失的平台自定义命令。
audience: advanced
maturity: advanced
since: 1.0.0
---

# 自定义命令

<MaturityBadge level="advanced" />

omtre 1.0.0 没有 `omtre command create` 之类的脚手架。自定义命令通过**平台原生文件**实现，omtre 负责内置命令的生成和更新。

## 内置会话命令

核心命令通常包括：

| 命令 | 作用 |
|---|---|
| start | 打开会话或重载上下文 |
| continue | 继续当前任务 |
| finish-work | 提交后归档并记录会话 |

不同平台的落点不同：

```text
.claude/commands/...
.qoder/commands/omtre-continue.md
.opencode/commands/...
.github/prompts/...
```

部分平台没有原生命令原语，会把命令包装成技能或 prompt。不要用 Qoder 的文件路径去推断 Claude Code 的目录。

## 命令与技能的区别

| 类型 | 触发 | 适合 |
|---|---|---|
| 命令 | 用户显式调用 | 会话边界、固定动作、需要参数的入口 |
| 技能 | 语义触发或显式点名 | 可复用的工作流知识 |
| 子代理 | 主会话派发 | 隔离上下文的实现、研究或检查 |
| 生命周期 hook | 脚本事件 | 创建、启动、归档等机械时点 |

如果一段内容只是告诉 Agent “遇到某类任务应该怎样做”，优先写技能；如果它必须由人明确触发，写命令。

## 添加自定义命令

### 1. 选择平台原生格式

先查看初始化后的实际命令文件：

```bash
find .qoder/commands -maxdepth 1 -type f | sort
find .claude/commands -maxdepth 2 -type f | sort
```

以现有文件的 frontmatter、名称和目录为准。

### 2. 使用独立名称

示例（Qoder 风格，具体字段请按当前宿主验证）：

```markdown
---
name: omtre-team-review
description: "Run the team's release readiness review"
---

# Team release review

1. Read `.omtre/spec/release/checklist.md`.
2. Run `pnpm lint && pnpm typecheck && pnpm test`.
3. Report blockers without changing production configuration.
4. Do not push or deploy.
```

Claude Code 等平台不使用相同 frontmatter；应复制其现有命令结构。

### 3. 避免与受管命令冲突

不要覆盖：

- `omtre-start`
- `omtre-continue`
- `omtre-finish-work`
- 平台为 omtre 生成的核心命令

自定义命令使用自己的前缀，例如 `team-*`。

### 4. 验证调用

在宿主中：

- 能发现命令；
- `description` 正确显示；
- 参数解析符合预期；
- 不会自动触发危险操作；
- 升级后仍然存在。

## 升级时会发生什么

`omtre update` 只处理受管文件与模板。自定义命令如果不在受管清单中，通常不会被删除。

但不保证：

- 同名路径不会被新模板使用；
- 大版本升级不会改变命令格式；
- 宿主升级不会改变 frontmatter 要求。

升级前：

```bash
omtre update --dry-run
```

升级后直接测试自定义命令。

## 跨平台命令

同一个团队命令若要支持多个平台，需要分别生成各平台文件：

```text
.qoder/commands/team-review.md
.claude/commands/team-review.md
.github/prompts/team-review.prompt.md
```

不要写一个 Omtre 独有的“抽象命令文件”，期待所有平台自动转换。1.0.0 的安装器转换的是内置模板，并不提供通用的自定义命令编译器。

## 命令中的安全边界

命令可以要求 Agent 运行 shell 命令。写自定义命令时：

- 默认不要包含 push、merge、deploy；
- 使用 `--dry-run` 作为预览；
- 不在正文中写 secrets；
- 明确哪些命令需要人工确认；
- 对生产环境操作使用平台权限，而不是提示词。

## 测试

对一个新命令至少检查：

- [ ] 文件被正确发现
- [ ] frontmatter 合法
- [ ] 描述准确
- [ ] 无破坏性默认行为
- [ ] 参数有说明
- [ ] 升级后仍可用
- [ ] 至少一个目标平台真实调用成功

## 下一步

- [自定义子代理](./custom-agents.md)
- [Hooks](./hooks.md)
- [升级、回滚与卸载](../guide/upgrade-and-remove.md)
