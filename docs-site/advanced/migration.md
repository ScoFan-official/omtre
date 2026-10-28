---
title: 从 Trellis 迁移
description: 把 Trellis 0.6.x 项目一次性迁移到 .omtre/，理解备份、预检和失败恢复。
audience: advanced
maturity: advanced
since: 1.0.0
---

# 从 Trellis 迁移

<MaturityBadge level="advanced" />

`omtre migrate` 命令的设计职责极为单一：**专门用于将现有的 Trellis 0.6.x 历史架构项目，一次性平滑迁移至 omtre 的标准 `.omtre/` 目录规范**。

::: danger 概念解耦：迁移（Migrate）不等于升级（Upgrade/Update）
- 本命令**仅适用于**从历史旧框架向 omtre 的首次架构迁移；
- 已处于 omtre 管理下的项目，版本演进与模板同步请严格使用 [`omtre upgrade` 与 `omtre update`](../guide/upgrade-and-remove.md)；
- 绝不能将 `migrate` 当作日常解决代码冲突或升级 CLI 的通用命令。
:::

## 迁移准入前置条件

执行迁移前，当前环境与代码库必须严格满足以下条件：
1. **处于 Git 版本控制之下**，且工作树保持干净（`git status` 无未提交脏改动）；
2. **所有本地后台进程已优雅退出**，确保没有残留的 Channel Worker 或运行器占用目录句柄；
3. **版本契约匹配**：`.trellis/.version` 文件明确标注源版本属于 0.6.x 序列；
4. **项目外部已完成物理冷备份**。

### 强制外部备份步骤

在执行任何迁移命令前，必须在项目物理根目录之外打包一份独立快照：

```bash
git status --short --branch
git log -1 --oneline

# 将历史受管目录与宿主配置安全压缩至项目外部
tar -czf ../project-before-omtre-migration.tgz \
  .trellis .claude .cursor .codex .qoder AGENTS.md 2>/dev/null || true
```

## 预检与 Dry-run 审查

迁移引擎包含完备的预检流水线。必须先通过预检确认零风险：

```bash
# 交互式预检
omtre migrate --dry-run

# 非交互 CI/自动化预检（输出完整 JSON 审计报告）
omtre migrate --dry-run --json
```

**预检流水线覆盖项**：
- 确认源目录 `.trellis/` 存在且目标 `.omtre/` 尚未创建（杜绝重复迁移）；
- 校验 Git 状态与历史分支完备性；
- 扫描平台配置文件中的旧命名空间与 Hook 指针；
- 评估待迁移任务（`tasks/`）、规范（`spec/`）与开发者工作区（`workspace/`）的完整性。

## 执行正式迁移

```bash
omtre migrate
```

在无人值守或自动化脚本中，可通过 `--yes` 确认免提示执行：

```bash
omtre migrate --yes
```

::: warning 严禁在脏工作区执行迁移
若工作区存在未提交代码，系统会主动拒绝迁移。虽然提供了 `--allow-dirty` 逃生开关，但脏工作区会使迁移引起的文件变动与业务代码修改混杂在一起，一旦发生异常将极难定位差异与执行回滚。
:::

## 资产迁移与转换边界

迁移引擎对历史资产执行确定性重构与搬迁：

| 资产类型 | 历史源路径 | 迁移后目标路径 | 转换策略 |
|---|---|---|---|
| **任务工单** | `.trellis/tasks/` | `.omtre/tasks/` | 目录结构与 `task.json` 完整继承，补齐新版字段 |
| **工程规范** | `.trellis/spec/` | `.omtre/spec/` | 完整迁移规范体系，自动修正旧文档中的相对路径 |
| **工作区日志** | `.trellis/workspace/` | `.omtre/workspace/` | 完整保留开发者专属 `journal` 历史流水 |
| **领域 Board** | `.trellis/domains/` | `.omtre/domains/` | 迁移领域路由与工作协议配置 |
| **宿主适配层** | `.claude/`、`.qoder/` 等 | 同名平台目录 | 重写 Hook 脚本与命令调用，对齐新版 `omtre` 二进制 |

被本地定制过的平台文件在重写前会自动留存 `.backup` 副本；用户的任务目录名（`<MM-DD-slug>`）受严格保护，不被强行重命名。

## 迁移后自动化自检

迁移流程在落盘结束瞬间，会自动执行严格的内置自检（Self-check）：
- 验证旧 `.trellis/` 目录已安全清空并移除；
- 检查代码库中是否残留非历史记录性的旧标识符；
- 校验迁移后的任务总数与 `blocked_by` 依赖关系是否完全一致；
- 验证各平台的 SessionStart Hook 是否能正确调起 `python3 .omtre/scripts/task.py`。

::: danger 自检失败的技术事实：不会自动回滚
**自检若发现异常会直接退出并返回非 0 退出码，但系统绝对不会自动执行静默回滚。**
若自检报错：
1. 立即停止任何后续命令；
2. 保存终端输出与 JSON 审计报告；
3. **严禁直接手动使用 `rm -rf` 删除新生成的 `.omtre/` 目录**（直接删除可能连带销毁已迁移的未提交用户数据）；
4. 通过 `git checkout` 或之前打包的外部 `.tgz` 快照整体恢复基线，排查根因后重新执行。
:::

## 迁移后人工闭环验证

自检通过后，工程师需亲自验证基础工具链与编辑器会话：

```bash
git status --short
omtre platforms
python3 .omtre/scripts/task.py list
python3 .omtre/scripts/get_context.py --mode packages
```

同时在实际 IDE（如 Cursor、Claude Code）中拉起一次新会话，确认：
- 启动 Hook 能正确识别当前开发者与活跃任务；
- 规范索引能够正常打开；
- 历史任务的验证契约仍能被正常执行。

不要把迁移和卸载上游工具混为一谈。

## 完成标准

- [ ] 迁移报告成功
- [ ] `.trellis/` 已清理或无残留
- [ ] 任务数量与依赖正确
- [ ] 平台文件重新生成
- [ ] 至少一个真实会话完成闭环
- [ ] 外部引用清单已审查
- [ ] 迁移前备份仍保留到验证完成

## 下一步

- [升级、回滚与卸载](../guide/upgrade-and-remove.md)
- [平台支持矩阵](../reference/platform-matrix.md)
- [故障排查](./troubleshooting.md)
