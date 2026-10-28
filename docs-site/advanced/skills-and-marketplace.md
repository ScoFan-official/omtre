---
title: Skills 与规范模板
description: 选择内置技能、市场技能和规范模板，避免把资产数量当成能力保证。
audience: advanced
maturity: mixed
since: 1.0.0
---

# Skills 与规范模板

<MaturityBadge level="mixed" />

omtre 生态中存在三类层次与职责截然不同的资产，在选型与引入前必须建立清晰的工程预期：

| 资产层级 | 典型代表 | 运行载体与生命周期 | 生产成熟度与使用建议 |
|---|---|---|---|
| **核心工作流技能** | `brainstorm`、`before-dev`、`check`、`update-spec`、`break-loop` | 由 omtre 官方受管维护，随工作流阶段调度 | **已深度验证**；属于工作流主循环的标配 |
| **运行时/引导技能** | `omtre-meta`、`spec-bootstrap`、`session-insight`、`channel` | 开发者显式唤起或排障时调用 | **已验证**；按特定排障与脚手架场景按需使用 |
| **市场技能与规范模板** | 架构设计、测试、具体框架规范（Next.js、Electron 等） | 从 Marketplace 检索并下载至本地仓库 | **社区/按需**；下载后即为本地普通文件，需人工审查 |

::: warning 破除资产数量幻觉
**“仓库包含 1,700+ 目录资产”描述的是上游收集的库存全集，绝对不等于 1,700 个已验证生产级能力。** 严禁在生产项目中全量或批量盲目安装市场资产。未经业务适配的通用技能只会成为干扰大模型决策的噪声。
:::

## 技能安装与上下文膨胀陷阱

```bash
# 推荐方式：仅为当前主力平台复制特定必需技能
npx skills add ScoFan-official/omtre --agent qoder --copy
```

### 为什么坚决不能全量安装技能？
在现代 Agent 架构中，每个已启用的技能都会将其 `name` 与 `description` 强制注入到大模型的系统提示词或工具列表中：
1. **意图争抢与调用漂移**：当安装了几十个描述相似的“审查”、“测试”技能时，大模型在推理时极易陷入工具匹配混乱，导致在不恰当的时机错误调用；
2. **上下文窗口浪费**：上百个技能的元数据会常驻占用上万 Token 的基础上下文预算，极大挤占用于阅读业务源码的宝贵窗口；
3. **安全与权限失控**：第三方市场技能正文可能包含要求运行特定终端命令的指令，未经人工审阅直接执行存在供应链安全风险。

**作者建议**：严格维护团队内部的技能准入白名单，每个项目启用的额外技能数量严格控制在 3–5 个以内。

## 规范模板（Spec Templates）的本质定位

omtre 市场提供了多个主流技术栈的初始规范模板结构：

| 规范模板 ID | 涵盖技术栈 | 核心预设规范 |
|---|---|---|
| `agent-workflow` | omtre 自研 Agent 工作流 | 代理分层契约、任务分流（Triage）、前端设计审查规范 |
| `electron-fullstack` | Electron + React + TypeScript | 主进程/渲染进程 IPC 隔离、安全沙箱、本地持久化规约 |
| `nextjs-fullstack` | Next.js (App Router) + oRPC + PostgreSQL | 路由处理边界、Server Actions 权限、数据库迁移准则 |
| `cf-workers-fullstack` | Cloudflare Workers + Hono + Turso | 边缘无状态计算、KV 缓存与分布式 SQL 限制 |

安装规范模板至当前仓库：

```bash
omtre init \
  --registry gh:ScoFan-official/omtre/marketplace \
  --template agent-workflow \
  --append
```

### 模板安装策略说明
- `--append`（强烈推荐）：仅向 `.omtre/spec/` 中增补缺失的分层文件，绝不覆盖本地已有规范；
- `--overwrite`（极度危险）：强制清空并覆写本地所有已定制规范，仅在全新项目重置时使用。

::: tip 规范模板是脚手架，不是代码事实
**模板是通用的行业模式参考，绝不自动代表当前工程的具体事实。** 安装规范模板后，必须逐个文件审查：路径是否与当前工程目录结构匹配、命名风格是否与现有代码库一致，并果断删掉当前项目未用到的空泛条目。
:::

## 搭建企业私有 Marketplace 注册表

大型研发组织可在内网 Git 仓库中维护团队专属的规范与工作流注册表，实现标准在内部多仓库间的快速复用。

创建 `marketplace.json` 索引清单：

```json
{
  "version": 1,
  "templates": [
    {
      "id": "team-backend-standard",
      "type": "spec",
      "name": "Team Backend Standard",
      "description": "企业统一后端服务架构规范与安全红线",
      "path": "specs/team-backend",
      "tags": ["backend", "go", "microservice"]
    }
  ]
}
```

团队成员通过内部 Git 地址安全检出：

```bash
omtre init \
  --registry git@gitlab.internal.corp:architecture/omtre-marketplace.git \
  --template team-backend-standard \
  --append
```

访问受限的私有仓库依赖工程师本地的 SSH 密钥或 Git 凭据管理器，严禁在注册表配置中明文内嵌任何访问 Token。

## 团队规范模板审查清单

从 Marketplace 引入任何模板后，在正式提交入库前必须核对：
- [ ] 规范中的文件路径、包名是否与当前 monorepo / 目录结构绝对吻合；
- [ ] 规范中的代码示例是否引用了真实业务中允许使用的依赖包；
- [ ] 规范是否与已有的分层规则发生概念冲突；
- [ ] 规范中提到的验证命令（如 lint/test）是否真实存在于 `package.json` 中；
- [ ] 剔除所有与当前项目业务无关的占位性教条。

## 下一步

- [自定义命令](./custom-commands.md)
- [规范系统](../guide/specs.md)
- [Skills 资源页](../resources/skills.md)
