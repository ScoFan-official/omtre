---
title: 安装与第一个任务
description: 从安装 omtre 到完成一个真实业务小功能、通过验证并完成归档的完整路径。
audience: first-time
maturity: mixed
since: 1.0.0
---

# 安装与第一个任务

<MaturityBadge level="mixed" />

这一页只做一件事：让你在自己的项目中完成第一次 omtre 任务。

第一个任务不是“让 AI 随便改点东西”。你需要选一个**低风险、能用现有测试验证、可以单独回滚**的真实业务小功能。完成后，你应该能看到计划、代码、验证结果、任务归档和会话日志。

目标时间约为 15–20 分钟，从你选定业务功能后开始计时，不包含安装 Node.js、Python、克隆仓库或等待大型依赖下载。

## 你将完成什么

```text
安装 CLI
  -> 初始化项目和平台
  -> 让 Agent 评估候选业务功能
  -> 创建任务与 PRD
  -> 实现并验证
  -> 人工检查 diff
  -> 提交代码
  -> 归档任务 + 记录日志
```

## 1. 检查前置条件

需要：

- Node.js **18.17 或更高**；
- Python **3.9 或更高**；
- Git；
- 一个可用的 AI 编码代理；
- 一个工作区干净的现有项目。

```bash
node --version
python3 --version
git --version
```

Windows 上如果 `python3` 不存在，使用 `python --version`。如果项目本身没有可靠的测试或检查命令，先不要继续首个业务任务；可以先选择一个练习仓库。

检查 Git 状态：

```bash
git status --short --branch
```

只要存在与本任务无关的未提交改动，就先处理它们。否则后面很难判断哪些文件属于本次任务。

## 2. 安装 omtre

```bash
npm install -g omtre
omtre --version
```

版本应输出 `1.0.0` 或当前稳定版本。无法使用 npm 时，可以安装 GitHub Release 中的 tgz，但团队使用时更建议固定版本并记录升级方式。

## 3. 初始化项目和平台

先只选择你实际使用的平台。下面选择一个执行：

::: code-group

```bash [Qoder]
omtre init -u <your-name> --qoder
```

```bash [Claude Code]
omtre init -u <your-name> --claude
```

```bash [Codex]
omtre init -u <your-name> --codex
```

```bash [Cursor]
omtre init -u <your-name> --cursor
```

```bash [GitHub Copilot]
omtre init -u <your-name> --copilot
```

:::

把 `<your-name>` 换成你的开发者名。它会创建 `.omtre/.developer` 和个人工作区 `.omtre/workspace/<your-name>/`。

也可以一次初始化多个平台：

```bash
omtre init -u your-name --qoder --claude
```

查看当前项目实际配置了哪些平台：

```bash
omtre platforms
```

::: tip 平台不是等价的
不同平台对命令、技能、子代理和 hooks 的支持程度不同。上面的 5 个平台有独立模板，不代表其余 17 个平台都在你的宿主版本上完成过端到端验证。完整差异见[平台支持矩阵](../reference/platform-matrix.md)。
:::

## 4. 确认初始化成功

初始化后至少应看到：

```text
your-project/
├── .omtre/
│   ├── workflow.md
│   ├── config.yaml
│   ├── spec/
│   ├── tasks/
│   ├── workspace/
│   │   └── <your-name>/
│   ├── agents/
│   └── scripts/
│       ├── task.py
│       └── get_context.py
├── .qoder/                  # 或你选择的其他平台目录
└── AGENTS.md                # 部分平台会生成或更新
```

还可以运行：

```bash
python3 .omtre/scripts/task.py list
omtre platforms --json
```

此时任务列表为空是正常的。

## 5. 选择一个安全的业务功能

第一个任务使用你真实 backlog 中的一个业务小功能，不要使用数据库迁移、鉴权、支付、账单、隐私或生产配置作为试验。

让 Agent 先做影响面评估，明确要求它**不要改代码**：

```text
我要在 omtre 管理的项目里完成第一个业务任务。先不要改代码。

请阅读当前项目，从以下维度给我 3 个候选功能：
1. 影响不超过 3 个现有源文件；
2. 不新增数据库迁移，不修改鉴权、支付、账单和生产配置；
3. 不引入新的外部服务或凭证；
4. 能用仓库现有测试框架验证；
5. 可以只通过一个任务分支回滚。

每个候选请说明：
- 用户可见行为；
- 预计影响的文件和调用链；
- 现有测试覆盖；
- 需要的验证命令；
- 最大风险。
```

如果没有候选满足条件，停止首个任务。这不是文档流程失败，而是当前仓库不适合用高风险改动做试点。

### 一个合格的候选示例

假设项目已经有一个“订单列表”，但只能显示全部订单。可以选择：

> 为现有订单列表增加一个只读的状态筛选条件。筛选字段已经存在，不修改数据库，不改变权限；只更新查询参数处理、一个列表组件和对应测试。

它是有用户价值的业务功能，同时边界足够小。具体文件取决于你的技术栈，不要照抄到结构不同的项目。

## 6. 让 Agent 创建任务和 PRD

选定一个候选后，再给出第二个提示：

```text
选择候选 1。现在请按 omtre 工作流创建任务，并先完成 PRD。

要求：
- 明确 Goal、In scope、Out of scope 和 Acceptance criteria；
- 把刚才确认的验证命令写进任务验证契约；
- 复杂任务再补 design.md 和 implement.md；
- 在 PRD 写清 Domain；
- 先不要实现，也不要提交。
```

检查三个地方：

1. **任务目录存在**：`.omtre/tasks/<MM-DD-slug>/`
2. **状态正确**：`task.json` 中 `status` 从 `planning` 开始
3. **PRD 有边界**：至少包含目标、范围内、范围外和验收条件

```bash
python3 .omtre/scripts/task.py current
python3 .omtre/scripts/task.py list
```

如果 Agent 没有创建任务就开始改代码，停下来，让它先回到计划阶段。

### PRD 最小示例

```markdown
# 订单列表状态筛选

## Goal

让用户可以在订单列表中只查看指定状态的订单。

## In scope

- 增加状态筛选参数
- 保持默认“全部订单”行为
- 补充筛选结果测试

## Out of scope

- 修改订单数据结构
- 改变权限规则
- 新增导出或批量操作

## Acceptance criteria

- 未选择状态时行为与现在一致
- 选择“已支付”时只返回对应状态
- 无效状态返回可理解的空结果或错误
- 现有列表测试和新增测试通过
```

## 7. 进入实现并保留边界

确认 PRD 后，让 Agent 继续当前任务：

```text
PRD 边界确认。现在继续当前任务，先完成剩余计划，再进入实现。

实现要求：
- 只修改 PRD 范围内的文件；
- 先补测试或至少同步补测试；
- 不自动 commit、不 push；
- 完成后运行任务验证契约中的命令。
```

omtre 的 `implement` 角色会读取任务产物和相关规范。不同平台可能通过 hooks 注入上下文，也可能由子代理自行读取；具体路径见[工作原理](./how-it-works.md)。

## 8. 检查实现，而不是只看总结

至少运行一次：

```bash
git status --short
git diff --stat
git diff
```

确认：

- 改动文件都在 PRD 范围内；
- 没有无关格式化、锁文件漂移或生成文件；
- 测试覆盖了新增行为；
- 没有 `.env`、密钥、构建产物或本地状态被纳入；
- Agent 没有自行 commit 或 push。

验证契约应保存为任务的一部分：

```bash
python3 .omtre/scripts/task.py add-verify \
  .omtre/tasks/<task-dir> \
  "pnpm test"
```

把 `pnpm test` 换成项目真实命令。复杂项目可以登记多条：

```bash
python3 .omtre/scripts/task.py add-verify .omtre/tasks/<task-dir> "pnpm lint"
python3 .omtre/scripts/task.py add-verify .omtre/tasks/<task-dir> "pnpm typecheck"
python3 .omtre/scripts/task.py add-verify .omtre/tasks/<task-dir> "pnpm test"
```

手动重放：

```bash
python3 .omtre/scripts/task.py run-verify .omtre/tasks/<task-dir>
```

这里没有“AI 说它测过了”这种证据。验证命令本身必须真实存在并返回预期退出码。

## 9. 人工验收

对照 PRD 的 Acceptance criteria 逐条检查。你至少要亲自确认：

- 用户可见行为符合需求；
- Out of scope 没有被偷偷扩大；
- 测试失败时确实能发现问题；
- 失败情况和边界条件有处理；
- diff 不包含你无法解释的改动。

如果实现正确但 PRD 本身有缺陷，回到 PRD 修正，再重新检查实现。不要让归档掩盖需求问题。

## 10. 提交代码

使用仓库已有的提交风格，只添加你确认过的文件：

```bash
git add src/your-file.ts src/your-file.test.ts
git commit -m "feat(orders): add status filter"
```

不要使用 `git add -A` 作为捷径。提交完成后检查：

```bash
git status --short
git log -1 --oneline
```

工作区应为干净状态，或只剩明确不属于本任务的本地文件。

## 11. 归档任务并记录会话

优先让 Agent 执行 omtre 的收尾流程：

```text
代码已经提交。请按 omtre 工作流完成 finish-work：
归档当前任务，更新我的 workspace journal，并报告结果。
先不要 push。
```

如果宿主提供了已生成的收尾命令，也可以使用该平台的 command。命令名称和调用方式因平台而异，以 `.qoder/commands/`、`.claude/commands/` 等实际文件为准。

归档后任务应从：

```text
.omtre/tasks/<task-dir>/
```

移动到：

```text
.omtre/tasks/archive/<YYYY-MM>/<task-dir>/
```

会话日志写入：

```text
.omtre/workspace/<your-name>/journal-N.md
```

::: warning 归档不等于提交
归档脚本只做任务和日志的簿记，不是代码提交工具。正确顺序是“工作代码提交 → 任务归档 → 会话日志”。如果代码还没提交，收尾流程应拒绝继续或要求你先返回提交步骤。
:::

## 12. 确认你真正完成了闭环

- [ ] `.omtre/tasks/<task-dir>/task.json` 中状态为 `completed`
- [ ] 任务已移动到归档目录
- [ ] 代码提交存在，工作区干净
- [ ] 验证命令有真实通过记录
- [ ] journal 记录了本次任务和提交
- [ ] 没有执行 push、merge 或部署

到这里，你完成了一次完整的 omtre 任务，而不是只验证了安装命令。

## 常见失败

| 现象 | 常见原因 | 处理 |
|---|---|---|
| `omtre: command not found` | 全局 npm bin 不在 PATH | 检查 npm 全局目录，重新打开终端 |
| Python 脚本语法或版本错误 | `python3` 指向过旧版本 | 安装 Python 3.9+，确认 hooks 使用同一解释器 |
| 初始化生成了不想要的平台目录 | 命令行传入了多个平台 flag | 用 `omtre platforms` 查看；不要手工删除受管文件 |
| Agent 直接开始改代码 | 没有停留在计划阶段 | 停止改动，要求先创建任务和 PRD |
| 没有创建 `implement.jsonl` / `check.jsonl` | 平台不使用子代理上下文清单 | 不是所有平台都生成这两个文件，按平台行为处理 |
| 任务无法归档 | 代码未提交、验证失败或分支元数据不合规 | 先看具体错误；不要直接删除任务目录 |
| 归档后代码仍未提交 | 把归档误当成 commit | 回到代码提交步骤，检查 `git status` |

## 下一步

- [工作原理](./how-it-works.md)：理解刚才每个阶段实际读了什么、写了什么。
- [日常使用](./everyday-use.md)：把首次流程变成每天可用的工作方式。
- [质量检查与提交](../guide/quality-and-commit.md)：了解验证、归档和提交的硬边界。
