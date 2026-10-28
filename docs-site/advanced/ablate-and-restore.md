---
title: 消融与恢复
description: 临时移除项目内 omtre 表面，理解恢复事务、冲突预检和与卸载的区别。
audience: advanced
maturity: advanced
since: 1.0.0
---

# 消融与恢复

<MaturityBadge level="advanced" />

`omtre ablate`（消融）用于临时将项目内部的所有 omtre 受管文件和平台配置完整移出至外部事务存储中，使项目迅速恢复至未引入 omtre 前的原生基线状态；测试或排障完成后，再通过 `omtre restore`（恢复）无损还原至消融前状态。

该能力用于临时移除项目内 omtre 表面、隔离与宿主或构建工具的冲突，或做“有 omtre / 无 omtre”的工程对比。它不负责性能 benchmark，也不会启动或代理模型。

::: danger 概念澄清：消融绝非卸载
消融是带有物理事务支持的**临时状态切换机制**，绝不是卸载（Uninstall），也不是替代常规备份（Backup）的工具。
:::

## 核心操作与影响边界对照

| 操作方式 | 项目内的 .omtre/ 与配置 | 恢复机制 | 全局 CLI 二进制 | 本机 Channel 与运行数据 |
|---|---|---|---|---|
| **环境变量阻断（`OMTRE_HOOKS=0`）** | 原样保留在代码库中 | 取消环境变量立即恢复 | 保持安装 | 保持原样 |
| **临时环境消融（`omtre ablate`）** | 物理移出至外部事务区 | 执行 `omtre restore` 原样恢复 | 保持安装 | 保持原样 |
| **项目级卸载（`omtre uninstall`）** | 永久删除受管文件 | **不提供恢复机制** | 保持安装 | 保持原样 |
| **全局 CLI 卸载（`npm rm -g omtre`）** | 不受任何影响 | 重新执行全局 npm 安装 | 永久删除 | 保持原样 |

## 1. 消融前 Dry-run 预检

在实际移出任何文件前，在终端审查消融引擎的执行计划：

```bash
omtre ablate --dry-run
```

预检引擎会严格计算并输出：
- 即将被整体打包备份并移出的 `.omtre/` 目录结构；
- 混合配置文件（如带有 `OMTRE:START` ... `OMTRE:END` 注释块的平台规则）中待剥离的受管片段；
- 外部恢复事务的落盘路径；
- 消融后即将成为空目录、会被自动清理的受管平台路径。

在 CI 或非交互式脚本环境中执行正式消融需显式传入 `--yes` 参数。

## 2. 执行正式消融

```bash
omtre ablate
```

**底层执行原子流程**：
1. 建议先确认 Git 工作区状态；`ablate` 本身不执行 Git 检查或自动提交；
2. 在项目目录外部创建专有恢复事务存储包（Transaction Package）；
3. 将受管文件与 `.omtre/` 内的所有规范、任务与日志物理移动进备份包；
4. 移除各宿主中的 omtre 专用命令与 Hook 配置，保持项目代码完全原生；
5. 将事务状态原子翻转为 `ablated`。

::: warning 消融不会改动的事项
消融操作：
- 绝对不删除本机全局 `omtre` 可执行二进制；
- 绝对不清理 `~/.omtre/channels` 等系统级运行总线数据；
- 绝对不删除各 AI 编辑器本地的会话聊天记录（Transcript）；
- 绝对不会在 Git 中自动执行暂存（stage）或提交（commit）；
- 绝对不会隐匿当前未跟踪的业务代码。
:::

## 外部恢复事务（Transaction）存储拓扑

恢复事务默认存放于当前用户家目录下，**严格位于被测试的代码仓库外部**：

```text
~/.omtre/ablations/v1/<project-hash>/
├── state.json                    # 事务元数据（原始路径拓扑、文件 SHA256 哈希）
└── backup/                       # 原始 .omtre/ 目录与受管平台文件的完整字节镜像
```

可以通过环境变量重定向事务根路径：

```bash
export OMTRE_ABLATION_STATE_ROOT=/path/to/secure/external/storage
```

::: danger 路径安全约束
`OMTRE_ABLATION_STATE_ROOT` 必须指向被消融项目外部的绝对路径。若尝试将其指向项目自身子目录下，消融引擎会主动报错拒绝执行，防止出现“将备份写在即将被清理的目录中”的致命死锁。
:::

## 3. 执行无损恢复（Restore）

完成性能对比或外部测试后，将项目完整还原至消融前状态：

```bash
# 必须先执行恢复预检
omtre restore --dry-run

# 确认无冲突后执行正式还原
omtre restore
```

### 恢复冲突处理原则

`restore` 引擎在写回文件前，会重新比对当前工作区的文件状态。若在消融期间，某个原本由 omtre 管理的路径被外部手动创建或修改：
1. 预检会立即报告冲突（Conflict），**项目保持零写入状态，绝对不强行覆写**；
2. 开发者必须人工核对报告中提示的冲突文件路径，将其移出或还原；
3. `restore` 绝不执行复杂的三向自动合并，避免将未知改动与历史规范强行掺杂。

## 恢复后闭环验证

还原完成后，在终端验证状态机指针与工具链可用性：

```bash
git status --short
python3 .omtre/scripts/task.py current
python3 .omtre/scripts/task.py list
```

重新在 IDE 中打开会话，核验：
- 启动 Hook 恢复正常识别；
- 活动任务指针重新就位；
- `.omtre/spec/` 与个人 `workspace/` 完整归位且无损坏。
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
