---
title: 自定义工作流
description: 切换内置工作流模板，并通过 marketplace 提供团队自己的工作流契约。
audience: advanced
maturity: advanced
since: 1.0.0
---

# 自定义工作流

<MaturityBadge level="advanced" />

`.omtre/workflow.md` 是 omtre 定义任务阶段状态机、每轮交互 Prompt 注入块、必执行步骤与多平台分支的权威契约文件。切换或定制工作流会改变 Agent 遵循的执行协议，但**绝不修改业务源码，也无法绕过系统底层的脚本安全门禁**。

## 内置与市场模板

查看当前 CLI 支持的工作流模板列表：

```bash
omtre workflow --list
```

核心模板选型：

| 模板 ID | 核心机制与定位 | 适用工程场景 |
|---|---|---|
| `oh-my` | 官方默认工作流，按 Plan / Execute / Finish 三阶段推进 | 绝大多数通用业务研发与复杂任务 |
| `native` | 极简 Plan / Execute / Finish 变体 | 追求极简流程的小型原型或快速脚本 |
| `tdd` | 严格以“红 - 绿 - 重构”驱动实现与测试 | 核心算法库、基础工具库与高单测覆盖率模块 |
| `channel-driven-subagent-dispatch` | 通过 Channel 状态总线协同实现与审查 Worker | 多 Agent 协作与后台异步任务调度 |

## 当前工作流结构审查

在对现有工作流动刀前，检查本地文件前部的状态机定义：

```bash
sed -n '1,160p' .omtre/workflow.md
```

**核心语法结构必须保留**：
- `## Phase Index`（阶段索引总览）；
- `[workflow-state:<status>]` 与配套闭合标签 `[/workflow-state:<status>]`；
- 步骤标识编号（如 `1.1`、`2.2`）；
- 平台条件块，例如 `[Claude Code, Cursor, OpenCode, …]`；条件块内的内容只向列出的平台注入。

## 模板切换与冲突策略

```bash
# 切换为测试驱动开发工作流
omtre workflow --template tdd
```

若本地曾手工修改过 `.omtre/workflow.md`，切换引擎会触发冲突保护机制：

| 参数 | 行为模式 | 风险评估与建议 |
|---|---|---|
| `--create-new` | 将新模板输出为 `.omtre/workflow.md.new` | **最推荐**；保留本地定制，供人工比对差异后合并 |
| `--force` | 无条件用新模板强行覆盖本地文件 | **高危**；本地专属步骤与卡点规则将被永久抹杀 |

安全操作路径：
1. 确认当前 Git 工作区干净（`git status`）；
2. 执行 `omtre workflow --template <name> --create-new`；
3. 使用 `git diff` 比对新旧模板结构；
4. 确认无误后替换正式文件并提交。

## 团队私有市场（Marketplace）工作流

大型工程团队可在私有仓库中集中分发企业标准化工作流：

```bash
omtre workflow \
  --template team-workflow \
  --marketplace gh:myorg/myrepo/marketplace
```

市场源通过 JSON 索引声明 `type: "workflow"` 并指向对应 Markdown 文件，支持 GitHub、GitLab、Bitbucket 与私有 Git 源。

::: tip 物理导入约束
omtre 1.0.0 不支持从任意本地路径临时加载工作流。所有有效工作流必须来自受管内置模板或可解析的 Marketplace 注册表。
:::

## 工作流契约的技术底层限制

自定义工作流时，模板内容必须严格满足底层 Hook 脚本的解析契约：
- **状态名命名空间**：状态字符集严格限制为 `[A-Za-z0-9_-]+`；
- **成对闭合标签**：必须包含成对的 `[workflow-state:<status>]` 与 `[/workflow-state:<status>]` 块。

若破坏上述结构：
- 平台的 `UserPromptSubmit` Hook 将无法提取对应的状态注入块；
- Agent 会静默退化为通用提示词，导致步骤执行失控与规范索引断链。

## 能力边界：文档约定 vs 真实系统支持

必须清楚认识工作流契约的能力边界：

| 适合在 workflow.md 中约定的内容（软性约束） | 坚决不能仅靠修改文档实现的能力（需底层代码/CI） |
|---|---|
| 计划阶段必须询问的业务维度清单 | 新增退出码为非 0 时强行拦截的机械闸门（需修改 `task.py`） |
| 哪些关键阶段必须要求人工核验后才能继续 | 限制大模型工具调用权限或操作系统沙箱隔离（需宿主支持） |
| 代码审查时重点关注的架构分层约定 | 强制保护 Git 分支不被直接推送（需 Git 服务端分支保护） |
| 任务收尾与日志记录的标准说明 | 自动拉起 PR、运行复杂流水线并自动合并代码（需 CI/CD 支持） |

`workflow.md` 是向大模型阐述工程契约的文本标准，绝不是系统级安全沙箱或二进制拦截插件。

## 推荐团队治理方式

- **工作流视为架构代码**：对 `workflow.md` 的任何调整必须通过 Git 提交并走 PR Code Review；
- **独立任务验证**：修改工作流应当创建独立任务，在一个低风险分支上走通完整会话与归档后方可向主干合并；
- **平台实测闭环**：多平台混用团队在调整工作流后，必须在团队主力使用的所有宿主中完成会话实测，切忌“单端跑通即全员推广”。

## 下一步

- [自定义命令](./custom-commands.md)
- [自定义子代理](./custom-agents.md)
- [Hooks](./hooks.md)
