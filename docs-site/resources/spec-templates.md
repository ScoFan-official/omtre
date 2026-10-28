---
title: 规范模板
description: 使用 omtre marketplace 的规范模板启动项目，并知道模板之后必须自己维护。
audience: team
maturity: stable
since: 1.0.0
---

# 规范模板

<MaturityBadge level="stable" />

规范模板（Spec Template）是针对特定技术栈预先提炼的“架构约定与目录脚手架”，用于加速新工程在接入 omtre 时的冷启动过程，避免开发者面对空白目录无从下手。

::: danger 模板不是代码事实
规范模板代表的是行业通用模式，**绝不自动代表当前工程的具体事实**。安装模板后的第一要务是根据当前业务代码的真实调用链逐一核对，果断删除不适用的规则。**保留错误或泛化的空泛教条，远比没有规范更具破坏性。**
:::

## 官方内置模板清单

| 模板 ID | 适配技术栈与核心定位 | 涵盖的核心规范与契约 |
|---|---|---|
| `agent-workflow` | omtre 自研 Agent 工程工作流 | 任务分级（Triage）、Issue 追踪约定、前端设计审查契约 |
| `electron-fullstack` | Electron + React + TypeScript + SQLite | 主进程 / 渲染进程安全 IPC、本地 SQLite 迁移与打包规约 |
| `nextjs-fullstack` | Next.js (App Router) + oRPC + Drizzle + PostgreSQL | 服务端动作权限校验、类型安全 RPC 契约、数据库迁移规则 |
| `cf-workers-fullstack` | Cloudflare Workers + Hono + Drizzle + Turso | 边缘无状态计算、KV 缓存策略与分布式 SQL 限制 |

模板结构随官方发布版本演进，可通过 Marketplace 索引实时查阅最新变动。

## 安装策略与命令

通过 `omtre init` 的 `--template` 参数引入目标技术栈的规范骨架：

```bash
# 在新项目初始化时同步安装 Next.js 全栈规范
omtre init -u <your-name> --qoder \
  --registry gh:ScoFan-official/omtre/marketplace \
  --template nextjs-fullstack
```

若项目已存在受管的 `.omtre/spec/` 目录，安装引擎提供明确的策略控制：

```bash
# 推荐策略：仅追加缺失的分层文件，绝不覆盖本地已有规范
omtre init \
  --registry gh:ScoFan-official/omtre/marketplace \
  --template agent-workflow \
  --append
```

| 安装参数 | 行为模式 | 工程风险与使用建议 |
|---|---|---|
| `--append` | 仅向 `.omtre/spec/` 中增补缺失的文件 | **最推荐**；保护已有定制，仅导入未覆盖的分层 |
| `--overwrite` | 强制删除当前项目所有已有规范并全新覆写 | **极高危**；本地所有已沉淀的架构经验将被彻底抹杀 |
| （缺省） | 遇到同名文件时终端弹出交互确认 | 适合本地人工单步审查 |

## 引入企业私有规范注册表

大型团队可在内网 Git 仓库中维护组织级的统一技术规范库：

```bash
omtre init \
  --registry git@gitlab.internal.corp:architecture/omtre-specs.git \
  --template microservice-go \
  --append
```

访问受限的私有仓库依赖工程师本地已配置的 SSH 密钥或 Git 凭证，严禁将私有 Token 硬编码写入项目文件。

## 规范模板与工作流模板的严格区别

初学者极易混淆两类模板，其物理定位与控制面完全正交：

| 维度 | 规范模板（Spec Template） | 工作流模板（Workflow Template） |
|---|---|---|
| **文件落盘位置** | `.omtre/spec/**` | `.omtre/workflow.md` |
| **安装驱动命令** | `omtre init --template <id>` | `omtre workflow --template <id>` |
| **本质作用** | 定义静态的架构约定、目录布局与设计契约 | 定义动态的任务生命周期状态机与 Prompt 注入块 |
| **互斥关系** | 仅操作规范文件，**绝不自动更改工作流** | 仅操作工作流文件，**绝不自动修改或覆盖规范** |

## 安装后的第一件事：删改而非盲信

从 Marketplace 引入任何模板后，必须对照本地仓库完成闭环审查：
1. **核对相对路径**：确认模板中的包名与目录结构是否与当前 monorepo / 项目完全一致；
2. **核验命令真源**：检查模板中列出的 lint、typecheck、test 命令是否真实存在于本地 `package.json` 中；
3. **剔除无用教条**：项目未用到的边缘组件规范直接整文件删除，保持规范高信噪比；
4. **验证 Git 追踪**：将精修后的规范提交至 Git 版本控制，作为团队 Code Review 的同源依据。

升级 omtre CLI 绝不会自动覆写项目内已修改的规范文件，业务规范的演进完全由项目自身主导。

## 下一步

- [规范系统](../guide/specs.md)
- [Skills](./skills.md)
- [使用案例](./use-cases.md)
