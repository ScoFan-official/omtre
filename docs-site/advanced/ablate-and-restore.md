---
title: 消融与恢复
description: 临时移除项目内 omtre 表面，理解恢复事务、冲突预检和与卸载的区别。
audience: advanced
maturity: advanced
since: 1.0.0
---

# 消融与恢复

<MaturityBadge level="advanced" />

`omtre ablate` 用于临时移除项目内的 omtre 表面，之后可通过 `omtre restore` 恢复到消融前状态。它适合做“有 omtre / 无 omtre”的工程对比或隔离故障。

它不是卸载，也不是备份系统。

## 操作对照

| 操作 | 项目内 omtre | 恢复 | 全局 CLI | 运行数据 |
|---|---|---|---|---|
| `OMTRE_HOOKS=0` | 保留 | 取消变量 | 保留 | 保留 |
| `ablate` | 临时移除 | `restore` | 保留 | 保留 |
| `uninstall` | 永久移除 | 不提供 | 保留 | 保留 |
| `npm uninstall -g omtre` | 不影响 | 重装 | 删除 | 保留 |

## 预检

```bash
omtre ablate --dry-run
```

预检会显示：

- 将被移除的受管文件；
- 混合文件中的 omtre 内容；
- `.omtre/`；
- 恢复事务位置；
- 预测的空目录。

在非交互环境执行实际消融需要 `--yes`。

## 执行

```bash
omtre ablate
```

它会：

1. 读取项目 manifest；
2. 在项目外创建恢复事务；
3. 备份受管文件与 `.omtre/`；
4. 移除受管文件和 omtre 内容；
5. 清理预测为空的受管目录；
6. 写入事务状态。

不会：

- 删除全局 CLI；
- 删除 `~/.omtre/channels`；
- 删除宿主 transcript；
- stage 或 commit Git；
- 隐藏 Git 改动；
- 自动启动 agent 或 worktree；
- 执行 benchmark。

## 恢复事务在哪里

默认在用户级目录：

```text
~/.omtre/ablations/v1/<project-hash>/
├── state.json
└── backup/
```

事务根必须在项目外：

```bash
export OMTRE_ABLATION_STATE_ROOT=/safe/external/path
```

如果设置到项目内部，操作应被拒绝。

## 恢复

```bash
omtre restore --dry-run
omtre restore
```

恢复流程先做全量预检，再写入。预检失败时，项目应保持零写入。

### 冲突

如果消融期间某路径被修改，恢复可能进入冲突状态。处理原则：

1. 读取报告中的冲突路径；
2. 人工保存当前修改；
3. 把路径恢复到“消融后应有状态”；
4. 重新运行 `restore --dry-run`；
5. 确认后恢复。

不要在冲突时强制覆盖。restore 不做三方合并，也不会聪明地保留两边改动。

## 崩溃状态

事务可能记录准备中、已消融、恢复中等状态。崩溃后重新运行工具应先检查状态，而不是重复执行。

如果事务缺失，恢复无法凭空重建被删内容。外部备份仍然必要。

## 安全

::: warning 事务可能包含敏感内容
恢复备份包含 `.omtre/` 精确字节，可能含任务、日志和配置。恢复成功后应确认事务被删除，并按团队数据策略处理残留。
:::

- 不要手工修改备份内容；
- 不要共享恢复事务目录；
- 不要在不确定状态时删除 `.omtre/`；
- 消融前确保工作区已提交。

## 验证恢复

```bash
git status --short
python3 .omtre/scripts/task.py current
python3 .omtre/scripts/task.py list
```

再打开一个 Agent 会话，确认：

- 工作流和 hooks 恢复；
- 任务指针可用；
- 规范与 workspace 未丢；
- 平台文件存在；
- 自定义内容未被错误覆盖。

## 适用场景

- 排查 hooks 是否导致问题；
- 对比有无 omtre 的仓库行为；
- 临时移除项目内文件做实验；
- 安全地测试“重新安装”流程。

不适合：

- 永久移除；
- 清理磁盘；
- 多用户共享项目；
- 替代版本控制；
- 自动性能 benchmark。

## 与迁移的区别

`migrate` 是上游 0.6.x 项目到 omtre 的一次性结构转换。

`ablate` 是同一 omtre 项目内的临时表面移除。

`update` 是 omtre 版本之间的项目文件同步。

三者不可互换。

## 下一步

- [升级、回滚与卸载](../guide/upgrade-and-remove.md)
- [故障排查](./troubleshooting.md)
- [关键文件路径](../reference/paths.md)
