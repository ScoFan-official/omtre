---
title: 升级、回滚与卸载
description: 正确区分 CLI、项目模板、临时消融和永久卸载，安全处理升级冲突。
audience: team
maturity: stable
since: 1.0.0
---

# 升级、回滚与卸载

<MaturityBadge level="stable" />

omtre 采用生命周期严格解耦的双层演进架构：宿主全局的 CLI 工具二进制，与具体项目 Git 仓库中受版本控制的 `.omtre/` 文件及平台配置完全独立。

日常维护与运维操作中，必须严格区分五种技术动作的边界与影响范围，切忌混淆概念：

| 运维动作 | 执行命令 | 影响范围 | 是否修改仓库源码与受管文件 |
|---|---|---|---|
| **全局 CLI 升级** | `omtre upgrade` 或 `npm i -g omtre` | 仅本机操作系统全局环境 | **绝对不改**（不触碰任何项目的 `.omtre/` 或代码） |
| **项目受管文件同步** | `omtre update` | 当前项目的 `.omtre/` 与平台文件 | **修改受管文件**（按受管块合并，冲突可选择保留、跳过或生成 `.new`） |
| **临时环境消融** | `omtre ablate` | 当前项目的受管表面（移入外部备份） | **临时移除**（用于对比基准评测，可无损恢复） |
| **项目级彻底卸载** | `omtre uninstall` | 清除当前项目的 `.omtre/` 与平台配置 | **永久删除**（不影响本机全局 CLI 二进制） |
| **历史项目格式迁移** | `omtre migrate` | 针对 0.6.x 历史项目重构文件拓扑 | **仅用于历史架构升级**（与常规升级无关） |

## 版本演进与数据流

```text
GitHub cli-v* Release / npm 分发包
    │
    ▼ omtre upgrade / npm i -g omtre
本机全局 CLI (~/.nvm/..., /usr/local/bin/...)
    │
    ▼ omtre update [--dry-run]
项目仓库内的 .omtre/ 核心与平台适配文件
```

全局 CLI 的升级不会直接修改现有代码仓库。团队成员即使本地 CLI 版本不同，Agent 读取的仍是项目内已提交的同一份 `.omtre/` 文件；但 hooks、命令语法和宿主行为仍可能随平台版本变化，不能把“文件同源”理解为运行时完全一致。

## 升级前置检查

在对项目执行模板更新前，在终端运行预检：

```bash
omtre --version
npm view omtre version
git status --short
omtre update --dry-run
```

`omtre upgrade` 解析的是 GitHub `cli-v*` Release；`npm view omtre version` 只用于核对 npm 包版本，两者可能因发布时序短暂不同。

**前置准入准则**：
- 工作区必须保持干净（`git status` 无未提交修改），确保任何模板更新引发的变动在 `git diff` 中一目了然；
- 运行 `update --dry-run` 预览文件变动清单，确认是否有团队手工定制过的规范或平台规则会被覆盖；
- 明确回滚路径（通过 Git 直接丢弃未暂存变动或回退 commit）。

## 1. 升级全局 CLI（本机环境）

```bash
# 预览全局更新
omtre upgrade --dry-run

# 执行全局包升级
omtre upgrade
omtre --version
```

`upgrade` 通过 GitHub `cli-v*` release 找到对应 tgz，再安装到本机全局环境；它不会修改当前项目。若使用内部镜像或离线包，应按团队包管理流程升级。

## 2. 同步项目受管文件（项目维度）

在需要应用新版本工作流、平台适配修复或新脚本的项目根目录执行：

```bash
# 强烈推荐：先做 dry-run 审查即将改动的文件列表
omtre update --dry-run

# 执行同步
omtre update
```

`update` 引擎会精准识别三类文件：
1. **未修改的受管文件**：安全升级到新模板；
2. **被项目二次定制过的文件**：触发冲突保护机制，默认不直接静默覆写；
3. **已废弃需重命名或清理的历史路径**：标记在迁移清单中。

### 冲突处理策略

在更新过程中遇到本地自定义与新模板冲突时，提供确定性策略：

| 参数 | 行为模式 | 适用场景与工程风险 |
|---|---|---|
| **默认交互模式** | 终端提示逐项确认覆盖或保留 | **最推荐**；透明度高，杜绝意外丢失改动 |
| `--create-new` | 保留本地旧文件，将新模板写入 `.new` 后缀文件 | 适合定制极深的核心规范，后续由人工执行 diff 合并 |
| `--skip-all` | 遇到冲突一律跳过，保持本地文件不动 | 风险：可能导致老旧脚本无法兼容新 CLI 行为 |
| `--force` | 强制使用官方模板无条件覆盖本地变动 | **高危**；仅在彻底放弃本地自定义、重置基线时使用 |

::: warning 拒绝滥用 --force
严禁将 `--force` 作为日常升级的默认参数。若项目中在 `.omtre/spec/` 或 `.omtre/workflow.md` 中补充过团队专属门禁，`--force` 会直接抹杀这些工程资产。优先使用 `--dry-run` 与 `--create-new` 审阅差异。
:::

### 路径迁移与降级控制

当 omtre 发行版涉及文件结构变更时：

```bash
omtre update --dry-run --migrate
omtre update --migrate
```

若需将项目文件回退至更旧版本模板：

```bash
omtre update --allow-downgrade
```

项目降级属于非推荐操作。新版模板中可能已持久化新数据结构，降级至旧版 CLI 时需人工核对 `task.json` 的字段兼容性。

## 升级后闭环核验

项目受管文件更新后，必须在终端执行基础命令自检：

```bash
omtre --version
omtre platforms
python3 .omtre/scripts/task.py list
python3 .omtre/scripts/get_context.py --mode packages
```

同时在实际 IDE 中拉起一次真实 Agent 会话，确认以下技术事实：
1. 会话启动时 SessionStart hooks 正常输出紧凑上下文；
2. 当前活跃任务能被正确识别；
3. 规范索引与子代理 JSONL 清单路径无断链；
4. 验证契约命令（`run-verify`）能正常被 Python 子进程重放。

## 历史旧项目迁移（omtre migrate）

`omtre migrate` **并非日常升级命令**，其唯一职责是将 0.6.x 历史项目拓扑一次性迁移为标准 `.omtre/` 结构：

```bash
omtre migrate --dry-run
omtre migrate
```

迁移引擎会在项目外部建立独立事务备份，在全量预检通过后才执行迁移。详见[旧项目迁移](../advanced/migration.md)。

## 临时环境消融（omtre ablate）

在评估引入 omtre 对模型编码效率的实际提升、或排查外部依赖干扰时，可使用消融功能：

```bash
# 预览消融清单
omtre ablate --dry-run

# 执行消融
omtre ablate
```

**ablate 的底层技术实现**：
- 在操作系统临时工作区创建外部恢复事务包，将 `.omtre/` 及所有受管平台配置文件整体移出；
- 保留全局 CLI、宿主运行历史与 Git 代码；
- 使项目瞬间恢复为“未安装任何 omtre”的原生干净状态。

对比测试完成后，无损恢复：

```bash
omtre restore --dry-run
omtre restore
```

`restore` 在恢复前会执行工作区文件哈希比对。若消融期间受管路径被外部修改，它会主动拒绝写入以防覆盖脏数据。消融绝不是卸载，不要把临时性能实验与永久移除混淆。

## 故障排障逃生口（仅禁用 Hooks）

如果怀疑某次更新后 Hook 脚本报错导致编辑器会话启动挂起，**无需消融或卸载任何文件**，仅需在终端临时导出环境变量：

```bash
export OMTRE_HOOKS=0
```

此时 Hook 进程将被完全旁路，项目文件与任务契约保持原样，可正常进行排错与调试。

## 永久卸载项目级 omtre

当团队决议彻底停用并从仓库中移除 omtre 时，执行安全卸载：

```bash
# 必须先执行 dry-run 核对受影响路径
omtre uninstall --dry-run

# 确认无误后执行清除
omtre uninstall
```

**卸载边界事实**：
- **清理项**：移除 `.omtre/`、受管平台配置（`.claude/`、`.qoder/` 等对应受管条目）及配置项；
- **保留项**：不会删除本机全局 `omtre` CLI 二进制，不会清理宿主本地的 Chat 会话历史，更不会篡改任何业务代码 Git 历史。

若需从本机操作系统中彻底清除全局 CLI 二进制：

```bash
npm uninstall -g omtre
```

## 团队升级与回滚速查表

| 故障场景 | 处置与回滚路径 |
|---|---|
| 更新全局 CLI 后发现 bug | 使用 `npm i -g omtre@<previous-version>` 重装指定稳定版本 |
| `update` 覆盖了团队定制规范 | 执行 `git checkout -- .omtre/spec/` 还原，或使用 `--create-new` 重新合并 |
| 临时消融后需要恢复 | 运行 `omtre restore`；若有冲突先处理冲突文件再重放 |
| 架构迁移异常 | 依赖迁移前生成的外部独立备份快照还原，切勿直接手动删改 |

## 下一步

- [旧项目迁移](../advanced/migration.md)
- [消融与恢复](../advanced/ablate-and-restore.md)
- [故障排查](../advanced/troubleshooting.md)
