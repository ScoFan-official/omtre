---
title: 质量检查与提交
description: 分清 Agent 审查、验证契约和人工 Review，正确完成提交与归档。
audience: team
maturity: mixed
since: 1.0.0
---

# 质量检查与提交

<MaturityBadge level="mixed" />

“检查通过”可以指很多不同的事。omtre 把几层质量证据分开，避免用一句 Agent 总结代替真实验证。

## 四个层次

| 层次 | 证据 | 能否机械保证 |
|---|---|---|
| 规范审查 | 改动是否符合团队规则 | 部分，主要靠 Agent + 人 |
| 任务符合性 | 是否满足 PRD、设计和执行计划 | 部分，靠检查角色与人 |
| 命令验证 | lint、类型检查、测试的真实退出码 | 是，由验证契约重放 |
| 交付审查 | 是否允许 push/PR/合并 | 分支保护、CI、人工 Review |

omtre 不能自动证明需求正确。它只能让需求、改动和验证证据更容易被检查。

## 任务验证契约

一条验证记录包含：

- 命令；
- 期望退出码；
- 超时时间。

默认期望退出码为 `0`，默认超时为 600 秒。

```bash
python3 .omtre/scripts/task.py add-verify \
  .omtre/tasks/<task-dir> \
  "pnpm lint"

python3 .omtre/scripts/task.py add-verify \
  .omtre/tasks/<task-dir> \
  "pnpm test" \
  --timeout 900
```

查看或清空：

```bash
python3 .omtre/scripts/task.py run-verify .omtre/tasks/<task-dir>
python3 .omtre/scripts/task.py clear-verify .omtre/tasks/<task-dir>
```

命令从仓库根目录执行，可以按项目需要登记多条。

### 验证契约适合放什么

- 仓库已有的 lint、typecheck、test；
- 特定包的测试命令；
- 一个任务的回归测试；
- 可重复的静态检查。

不要放：

- 依赖生产凭证的命令；
- 会修改外部状态的部署命令；
- 需要人工判断的“发布前检查”；
- 没有稳定退出码的交互程序。

## 无契约时会发生什么

| 条件 | 归档行为 |
|---|---|
| 有契约且全部通过 | 允许归档 |
| 有契约但任一失败 | 拒绝归档 |
| 无契约，`verify_required: false` | 警告后允许 |
| 无契约，`verify_required: true` | 拒绝归档 |

默认值取决于 `autonomy` 模式。团队试点建议显式配置：

```yaml
verify_required: true
```

这样“没有验证证据”不会被悄悄当成成功。

## 显式跳过验证

```bash
python3 .omtre/scripts/task.py archive <task-dir> \
  --skip-verify "The only change is a documentation typo; tests are unchanged."
```

- 原因必须非空；
- 原因会写入任务的 `verify_skipped`；
- 这不是无记录绕过；
- 不应成为日常路径。

如果 Agent 因为验证失败而建议跳过，停下来检查失败本身。跳过只适合“验证对该改动确实不适用”的情况。

## 检查角色与两轴审查

支持子代理的平台通常把检查分成两轴：

- **规范轴（standards）**：对照项目规范，可修复机械问题；
- **任务轴（spec）**：对照 PRD、设计和实现计划，只报告，不直接改写需求。

收集两份报告后，人应看到：

- 各自发现了什么；
- 哪些已修复；
- 哪些需要产品/架构判断；
- 哪些验证命令通过或失败。

不同平台的子代理能力和命名不同。若宿主不支持子代理，主轴应使用检查技能完成同样的审查范围。

## 人工 Review 仍然必要

自动化检查无法判断：

- 需求是否真的解决了用户问题；
- 可访问性、产品文案和交互是否合理；
- 数据模型是否会在半年后造成不可逆问题；
- 安全边界是否完整；
- 复杂状态机是否有遗漏；
- 代码是否值得维护。

Review 应从证据出发：

```bash
git status --short
git diff --stat
git diff
python3 .omtre/scripts/task.py run-verify .omtre/tasks/<task-dir>
```

## 提交边界

omtre 的原则是：只提交本次任务中你理解并确认的文件。

### 提交前

```bash
git status --short
git diff --cached
git diff
```

分析两类文件：

- **本次任务编辑**：可以按逻辑分组提交；
- **未识别的脏文件**：不要用 `git add -A` 一起带走。

### 推荐提交方式

```bash
git add src/orders/filter.ts src/orders/filter.test.ts
git commit -m "feat(orders): add status filter"
```

多个独立逻辑可以分成多个提交，但不要把簿记文件和代码混在一起。

### 禁止或需要确认的操作

- `git commit --amend` 修改已共享提交；
- `git push --force`；
- 未确认就 push；
- 把 secrets 或环境文件加入提交；
- 使用 `--no-verify` 跳过仓库 hooks。

## 归档会做什么

`task.py archive` 会再次运行验证契约，并尝试创建一个只包含任务簿记的自动提交。

正确顺序是：

```text
工作代码提交
  -> task archive 提交
  -> add_session journal 提交
```

如果归档移动成功但自动提交失败，任务可能已经在 archive 目录，需要人工补一次提交。不要把这种情况误判为任务丢失。

## 前端任务的特殊门槛

如果团队使用带前端设计审查契约的规范包，任务可能要求 `implement.md` 中存在设计审查段落后才允许归档。是否启用取决于项目安装的规范，不是所有 omtre 项目默认都有。

## CI 仍是最终防线

omtre 的本地验证契约不能替代：

- CI 的干净环境测试；
- 分支保护；
- 代码所有者审查；
- 安全扫描；
- 发布流程检查。

团队应把 omtre 视为本地反馈和证据层，而不是 CI 的替代。

## 下一步

- [多平台接入](./platforms.md)
- [omtre run 无人值守运行](../advanced/unattended-run.md)
- [故障排查](../advanced/troubleshooting.md)
