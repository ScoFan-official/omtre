---
title: CLI 命令
description: omtre 1.0.0 顶层命令与可用参数的自动生成参考。
audience: advanced
maturity: stable
since: 1.0.0
---

# CLI 命令

<MaturityBadge level="stable" />

omtre 安装后提供两个等价命令：

```bash
omtre --help
omt --help
```

`omt` 是短别名，不是另一套运行时。

## 命令分组

| 分组 | 命令 | 用途 |
|---|---|---|
| 初始化与维护 | `init`、`update`、`upgrade` | 安装平台文件、同步项目模板、升级全局 CLI |
| 移除与恢复 | `uninstall`、`ablate`、`restore` | 永久移除或临时消融后恢复 |
| 项目状态 | `platforms`、`workflow` | 查看已配置平台、切换工作流 |
| 任务运行 | `run` | 无人值守处理 frontier 任务 |
| 多代理 | `channel` | 本机多 Agent 协作运行时 |
| 历史检索 | `mem` | 搜索受支持的宿主会话 |
| 迁移 | `migrate` | 把旧上游 0.6.x 项目迁移到 `.omtre/` |

日常研发工作流主要通过 AI 宿主命令及本地原生脚本 `.omtre/scripts/task.py` 驱动，全局 CLI 聚焦于项目初始化、受管文件同步、环境运维与自动化运行。

## 参数生成说明

下方参数参考由当前版本的 CLI `--help` 输出自动编译生成。严禁手工篡改生成的文本块；CLI 命令参数发生变更时，必须通过 `pnpm build && node docs-site/scripts/generate-cli-reference.mjs` 重新生成并通过 CI 校验。

<!--@include: ./_cli.generated.md-->

## 常用示例

### 初始化一个平台

```bash
omtre init -u your-name --qoder
```

### 增加一个平台

```bash
omtre init --claude
```

### 查看配置平台

```bash
omtre platforms --json
```

### 预览项目更新

```bash
omtre update --dry-run
```

### 查看工作流模板

```bash
omtre workflow --list
```

### 预览一次无人值守运行

```bash
omtre run --until-empty --dry-run
```

`--dry-run` 只打印计划，不创建 ledger、worktree 或任务状态。

## 参数变更检查

```bash
node docs-site/scripts/generate-cli-reference.mjs --check
```

如果失败，表示 CLI 帮助输出与提交的参考不一致。先在仓库根目录构建 CLI，再重新生成：

```bash
pnpm build
node docs-site/scripts/generate-cli-reference.mjs
```

## 下一步

- [命令与技能速查](./commands-and-skills.md)
- [关键文件路径](./paths.md)
- [配置参考](../advanced/configuration.md)
