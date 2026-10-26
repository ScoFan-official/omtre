---
title: 从 Trellis 迁移
description: 把 Trellis 0.6.x 项目一次性迁移到 .omtre/，理解备份、预检和失败恢复。
audience: advanced
maturity: advanced
since: 1.0.0
---

# 从 Trellis 迁移

<MaturityBadge level="advanced" />

`omtre migrate` 只处理一种情况：

> 把现有 **Trellis 0.6.x** 项目的 `.trellis/` 迁移为 omtre 的 `.omtre/`。

它不是 omtre 版本升级。omtre 项目升级请使用 [`upgrade` / `update`](../guide/upgrade-and-remove.md)。

## 迁移前

必须具备：

- Git 仓库；
- 干净工作区；
- 没有正在运行的 omtre/Trellis channel 或 run 进程；
- `.trellis/.version` 表明源版本为 0.6.x；
- 项目外有可恢复备份。

先做外部备份：

```bash
git status --short --branch
git log -1 --oneline
tar -czf ../project-before-omtre-migration.tgz \
  .trellis .claude .cursor .codex AGENTS.md 2>/dev/null || true
```

实际备份范围取决于项目使用的平台目录。不要把命令当成通用保险，先确认清单。

## 预检

```bash
omtre migrate --dry-run
```

预检会检查：

- 源目录与版本；
- 是否已经迁移；
- `.trellis/` 与 `.omtre/` 是否同时存在；
- Git 状态；
- 活动进程；
- 受管文件、用户数据和平台配置；
- 潜在冲突和外部引用。

机器可读报告：

```bash
omtre migrate --dry-run --json
```

`--json` 输出报告并进入非交互模式，但安全检查仍然生效。

## 执行迁移

```bash
omtre migrate
```

在自动化环境中：

```bash
omtre migrate --yes
```

如果工作区有已知且已备份的改动：

```bash
omtre migrate --allow-dirty
```

这不是推荐默认。脏工作区会让失败恢复和差异审查更难。

## 会迁移什么

- `.trellis/tasks/` 中的任务；
- `.trellis/spec/` 中的规范；
- workspace 和 journal；
- domains；
- config 中的可迁移内容；
- 自定义 commands / skills / agents；
- 受管平台文件；
- 必要的标识和路径重命名。

受管文件被本地修改时，迁移可能写入 `.backup` 副本。任务目录名等用户数据受到保护，不会被无条件重命名。

## 会改写什么

迁移会更新项目内的旧命名、目录和受管文件，并写入：

- `.omtre/.version`
- `.omtre/.migrated-from`
- 模板哈希/manifest
- 平台配置中的 omtre 入口

仓库外的引用（shell rc、全局 agent 配置、服务文件、环境变量）通常只报告，不自动修改。

## 自检

迁移末尾会检查：

- `.trellis/` 是否清理；
- 是否残留旧标识；
- 任务数量和 `blocked_by`；
- session-start 路径；
- 任务脚本；
- 平台文件与 manifest。

自检失败会返回非零，但**不会自动回滚**。

## 失败恢复

推荐的恢复方式：

1. 停止操作；
2. 保存迁移 JSON 报告和终端输出；
3. 查看 Git 状态与 `.backup`；
4. 用迁移前提交或外部备份恢复；
5. 修复根因后再预检。

不要直接删除新目录来“重试”，这可能同时丢失迁移中产生的用户数据。

## 迁移后验证

```bash
git status --short
omtre platforms
python3 .omtre/scripts/task.py list
python3 .omtre/scripts/get_context.py --mode packages
```

然后在目标平台打开新会话：

- 工作流是否加载；
- 活动任务是否可识别；
- 规范路径是否可读；
- 子代理是否能读取任务；
- 验证命令是否仍运行。

## 外部引用

迁移后搜索旧路径：

```bash
rg -n "\.trellis|trellis" \
  --glob '!node_modules/**' \
  --glob '!.git/**'
```

排除明确的历史记录和 attribution 后，再决定是否改写。不要用全局 find-and-replace 替代人工判断。

## 与 omtre 共存

安装器不会覆盖独立安装的 `trellis` 二进制。迁移后：

- CLI 命令变为 `omtre` / `omt`；
- 项目目录变为 `.omtre/`；
- 旧 Trellis 项目仍可能存在其它 checkout。

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
