---
title: 升级、回滚与卸载
description: 正确区分 CLI、项目模板、临时消融和永久卸载，安全处理升级冲突。
audience: team
maturity: stable
since: 1.0.0
---

# 升级、回滚与卸载

<MaturityBadge level="stable" />

omtre 的“升级”不是一条命令完成的事。全局 CLI 与项目内受管文件是两层版本，临时停用和永久卸载又是两种不同操作。

## 三层版本与生命周期

```text
npm 稳定版本
    │ omtre upgrade
    ▼
本机全局 CLI
    │ omtre update
    ▼
项目 .omtre/ 与平台文件
```

另外，项目中的 `workflow.md` 也可能被切换为其它模板；它不是“最新 CLI”的同义词。

## 升级前检查

```bash
omtre --version
npm view omtre version
git status --short
omtre update --dry-run
```

要求：

- Git 工作区干净，或至少确认哪些改动属于项目定制；
- 知道项目是否修改过受管文件；
- 已备份关键自定义规范、命令、技能和代理；
- 团队知道升级窗口和回滚方式。

## 升级全局 CLI

```bash
omtre upgrade --dry-run
omtre upgrade
omtre --version
```

`upgrade` 只更新全局 CLI 包，不修改当前项目。

如果使用固定内部镜像或离线安装，应按团队包管理流程升级，不要依赖默认 npm tag。

## 同步项目文件

```bash
omtre update --dry-run
omtre update
```

`update` 把项目中的模板、平台文件和受管资源同步到当前本地 CLI 的版本。

它会区分：

- 未修改的受管文件；
- 被本地修改的文件；
- 迁移需要删除或移动的旧路径。

### 冲突处理

常见选项：

| 选项 | 行为 | 风险 |
|---|---|---|
| 交互选择 | 逐项决定保留/覆盖 | 最安全，需要人工 |
| `--create-new` | 为冲突生成 `.new` | 不会覆盖，但需要人工合并 |
| `--skip-all` | 跳过所有冲突 | 项目可能与 CLI 版本不一致 |
| `--force` | 覆盖所有改动 | 可能丢失项目定制 |

优先使用 dry-run 和 `.new`。不要习惯性使用 `--force`。

### 文件迁移

如果升级包含路径重命名或删除：

```bash
omtre update --dry-run --migrate
omtre update --migrate
```

`--migrate` 会应用待处理文件迁移。先预览，再执行。

### 降级

```bash
omtre update --allow-downgrade
```

只应在明确知道目标版本和兼容性的情况下使用。项目模板可能已经写入新字段，旧 CLI 未必能安全处理。

## 升级后的验证

至少检查：

```bash
omtre --version
omtre platforms
python3 .omtre/scripts/task.py list
python3 .omtre/scripts/get_context.py --mode packages
```

再打开一次真实 Agent 会话，确认：

- hooks 正常加载；
- 当前任务能被识别；
- 规范入口可读；
- 子代理能读取任务上下文；
- 验证命令可执行。

如果平台目录被更新，团队应重新检查宿主设置和项目信任状态。

## `migrate` 不是升级

`omtre migrate` 只用于把旧上游 0.6.x 项目迁移为 `.omtre/`：

```bash
omtre migrate --dry-run
omtre migrate
```

它不负责 omtre 自身版本升级。已有 omtre 项目应使用 `upgrade` + `update`。

迁移流程支持外部备份、冲突预检和恢复；详见[旧项目迁移](../advanced/migration.md)。

## 临时停用：ablate

如果目的只是比较“有 omtre 与没有 omtre”的差异：

```bash
omtre ablate --dry-run
omtre ablate
```

ablate 会：

- 在项目外创建恢复事务；
- 备份受管文件和 `.omtre/`；
- 移除项目内 omtre 表面；
- 保留全局 CLI、channel 日志和宿主会话。

恢复：

```bash
omtre restore --dry-run
omtre restore
```

### 冲突规则

restore 会先做全量预检。如果消融期间有受管路径被修改，它可能拒绝写入，直到冲突被处理。

ablate 不是：

- `uninstall`；
- 只关闭 hooks；
- 自动 benchmark；
- 自动 commit；
- Git 历史清理。

恢复事务可能包含敏感项目文本。恢复成功后应按团队安全要求处理。

## 只关 hooks

```bash
export OMTRE_HOOKS=0
```

这只影响 hook 执行，不移除文件，不改变任务状态。适合排查“是否是 hook 导致的问题”。

相关变量可能因平台/脚本略有差异，但 `OMTRE_HOOKS=0` 是主要逃生口。

## 永久卸载项目内 omtre

```bash
omtre uninstall --dry-run
omtre uninstall
```

它会删除：

- `.omtre/`；
- omtre 管理的平台文件；
- 相关受管路径。

它不会：

- 删除全局 `omtre` CLI；
- 清理 `~/.omtre/channels` 等全局运行数据；
- 清理宿主自己的 transcript；
- 恢复被项目修改过的 Git 历史。

先看 dry-run 清单，再确认。对含有任务历史或未提交日志的项目，先备份。

## 卸载全局 CLI

```bash
npm uninstall -g omtre
```

这不会修改任何项目文件。仅当所有项目都不再使用该 CLI 时执行。

## 回滚策略

| 场景 | 推荐回滚 |
|---|---|
| 升级后 hooks 异常 | 重装旧 CLI，再按兼容性同步项目 |
| `update` 覆盖了定制 | 从 Git diff 恢复；优先使用 `.new` 流程 |
| ablate 后要恢复 | `omtre restore` |
| 迁移失败 | 使用迁移前的外部备份，不要只依赖删除新目录 |
| 不再使用 omtre | `uninstall --dry-run` 后永久卸载 |

## 团队升级清单

- [ ] 固定允许使用的 CLI 版本范围；
- [ ] 升级前运行 `update --dry-run`；
- [ ] 升级后完成一个真实任务闭环；
- [ ] 验证至少一个实际使用的平台；
- [ ] 检查 hooks、命令、技能和子代理；
- [ ] 记录升级在 journal 或运维文档中；
- [ ] 保留可回滚的旧版本与项目备份。

## 下一步

- [旧项目迁移](../advanced/migration.md)
- [消融与恢复](../advanced/ablate-and-restore.md)
- [故障排查](../advanced/troubleshooting.md)
