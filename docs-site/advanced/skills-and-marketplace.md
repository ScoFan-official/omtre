---
title: Skills 与规范模板
description: 选择内置技能、市场技能和规范模板，避免把资产数量当成能力保证。
audience: advanced
maturity: mixed
since: 1.0.0
---

# Skills 与规范模板

<MaturityBadge level="mixed" />

omtre 周边有三类容易混淆的资产：

| 类型 | 例子 | 运行时由谁加载 |
|---|---|---|
| 内置工作流技能 | brainstorm、before-dev、check、update-spec、break-loop | Agent 宿主 |
| 运行时/引导技能 | omtre-meta、spec-bootstrap、session-insight、channel | Agent 宿主或用户显式调用 |
| 市场技能与规范模板 | 设计、研究、测试、技术栈规范 | 安装后成为普通项目文件 |

资产多不等于全部经过同等验证。先选当前任务需要的，再扩展。

## 推荐技能集

仓库提供技能清单，可通过外部 `skills` CLI 安装：

```bash
npx skills add ScoFan-official/omtre --agent qoder --copy
```

安装前：

- 确认目标平台；
- 固定仓库版本或 tag；
- 检查许可证和来源；
- 不要在生产仓库直接全量安装；
- 不在团队范围推广未经审查的第三方内容。

## 内置技能

| 技能 | 何时使用 |
|---|---|
| omtre-brainstorm | 计划阶段澄清需求、推进 PRD |
| omtre-before-dev | inline 工作流读取规范 |
| omtre-check | 完成后审查与验证 |
| omtre-update-spec | 把可复用经验回写规范 |
| omtre-break-loop | 重复 bug 后的根因与预防分析 |
| omtre-meta | 理解和定制本地 omtre 架构 |
| omtre-spec-bootstrap | 从真实代码库生成首版规范 |
| omtre-session-insight | 检索历史 AI 会话 |
| omtre-channel | 操作本机多代理协作 |

这些名称在不同宿主中可能有前缀或包装方式，以安装后的实际文件为准。

## 规范模板

omtre marketplace 提供可直接安装的规范结构：

| 模板 | 技术栈 |
|---|---|
| `agent-workflow` | omtre 自身的代理工作流规范、issue tracker、triage、frontend contract |
| `electron-fullstack` | Electron + React + TypeScript |
| `nextjs-fullstack` | Next.js + oRPC + PostgreSQL |
| `cf-workers-fullstack` | Cloudflare Workers + Hono + Turso |

安装：

```bash
omtre init \
  --registry gh:ScoFan-official/omtre/marketplace \
  --template agent-workflow \
  --append
```

`--append` 只添加缺失文件，适合已有 `.omtre/spec/` 的项目。

## 模板安装策略

| 参数 | 行为 | 使用建议 |
|---|---|---|
| 无策略参数 | 交互询问 | 首次使用 |
| `--append` | 只补缺失文件 | 已有规范时首选 |
| `--overwrite` | 删除现有 spec 后安装 | 高风险，先备份 |

模板生成的是项目文件，之后由项目维护。不要把模板内容当作已经符合你的代码事实。

## 自定义 marketplace

团队可以维护自己的 registry：

```json
{
  "version": 1,
  "templates": [
    {
      "id": "team-backend-spec",
      "type": "spec",
      "name": "Team Backend Spec",
      "description": "Backend conventions for our services",
      "path": "specs/team-backend",
      "tags": ["backend", "typescript"]
    }
  ]
}
```

1.0.0 中 `init --template` 主要支持 `type: "spec"`。工作流通过 `omtre workflow` 的 marketplace 机制处理。

安装自定义模板：

```bash
omtre init \
  --registry gh:myorg/myrepo/marketplace \
  --template team-backend-spec \
  --append
```

私有仓库需要相应的访问凭据，由底层下载器提供，不要把 token 写进仓库。

## 目录资产的数量边界

仓库包含大量 vendored 技能、代理、命令与 MCP 配置。它们：

- 可以按需安装；
- 保留上游出处；
- 不保证适用于你的平台；
- 不保证与你当前模型和工具权限兼容；
- 不构成安全审计结论。

“有 1,700+ 资产”描述的是库存，不是 1,700 个已验证能力。

## 技能安装后的噪声

每个可被语义触发的技能都会把名称和描述加入宿主可用列表。安装过多会造成：

- 匹配漂移；
- 上下文膨胀；
- 多个技能争抢同一意图；
- 用户难以知道哪个规则生效。

建议维护一个小型团队白名单，按任务类型逐步增加。

## 规范模板质量检查

安装后逐项检查：

- 文件路径是否符合当前仓库；
- 规则是否引用真实代码；
- 是否与已有规范冲突；
- 是否错误描述平台能力；
- 是否包含过时命令；
- 是否需要删除。

模板是起点，不是团队约定本身。

## 安全

- 安装前审查来源与许可证；
- MCP 配置通常需要凭证，不要提交 secrets；
- 第三方技能可能要求运行 shell 命令；
- 不要把市场资产当作可信代码；
- 只从固定 tag 或内部镜像安装。

## 下一步

- [自定义命令](./custom-commands.md)
- [规范系统](../guide/specs.md)
- [Skills 资源页](../resources/skills.md)
