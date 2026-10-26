---
title: 规范模板
description: 使用 omtre marketplace 的规范模板启动项目，并知道模板之后必须自己维护。
audience: team
maturity: stable
since: 1.0.0
---

# 规范模板

<MaturityBadge level="stable" />

规范模板提供目录结构和起始规则，减少从空文件开始的工作。它们不是项目事实，也不是一次安装后永久正确的契约。

## 可用模板

| ID | 内容 |
|---|---|
| `agent-workflow` | issue tracker 约定、triage、领域文档、frontend craft 与设计审查契约 |
| `electron-fullstack` | Electron + React + TypeScript + SQLite 的全栈规范 |
| `nextjs-fullstack` | Next.js + oRPC + Drizzle + PostgreSQL |
| `cf-workers-fullstack` | Cloudflare Workers + Hono + Drizzle + Turso |

模板内容会随仓库演进。安装前查看 marketplace 索引和当前目录。

## 查看市场

```bash
omtre init --registry gh:ScoFan-official/omtre/marketplace
```

交互环境会显示可选模板。非交互环境应明确传入模板和策略。

## 安装到新项目

```bash
omtre init -u your-name --qoder \
  --registry gh:ScoFan-official/omtre/marketplace \
  --template nextjs-fullstack
```

## 追加到已有规范

```bash
omtre init \
  --registry gh:ScoFan-official/omtre/marketplace \
  --template agent-workflow \
  --append
```

`--append` 只补充缺失文件，不覆盖已有文件。适合已有自己的规范库、只想引入代理工作流合约的项目。

## 覆盖现有规范

```bash
omtre init \
  --registry gh:ScoFan-official/omtre/marketplace \
  --template agent-workflow \
  --overwrite
```

::: danger 覆盖会删除现有 spec 目录
`--overwrite` 是高影响操作。先提交或备份 `.omtre/spec/`，并确认模板与当前代码事实一致。
:::

## 自定义 registry

```bash
omtre init \
  --registry gh:myorg/myrepo/team-specs \
  --template backend-api \
  --append
```

直接目录模式和 marketplace 模式不同：

- 直接目录：下载目标目录作为规范；
- marketplace：仓库包含索引，选择一个 template id。

私有仓库需要访问凭据，由下载层处理。不要将 token 提交到项目。

## 安装后的第一件事

逐文件审查：

1. 路径是否符合本仓库；
2. 规则是否与真实代码一致；
3. 是否有过时命令；
4. 是否与已有规范冲突；
5. 是否包含平台绝对承诺；
6. 是否需要删除。

删除错误规则比保留“看起来完整”的模板更重要。

## 推荐的团队流程

```text
选择最接近的模板
  -> 安装到试点仓库
  -> 对照真实代码删改
  -> 在一个任务中使用
  -> 根据检查结果修订
  -> 再推广到其它仓库
```

## 规范模板与工作流模板的区别

| 类型 | 安装方式 | 内容 |
|---|---|---|
| spec 模板 | `omtre init --template` | `.omtre/spec/` 规则 |
| workflow 模板 | `omtre workflow --template` | `.omtre/workflow.md` 阶段契约 |

spec 模板不会自动切换工作流；工作流切换也不会安装规范。

## 与升级的关系

安装后的模板是项目文件，由项目拥有和修改。升级 omtre:

- 不会自动覆盖有本地修改的规范；
- 不保证上游模板变化自动合并；
- 需要人工决定是否同步新版本。

## 下一步

- [规范系统](../guide/specs.md)
- [Skills](./skills.md)
- [使用案例](./use-cases.md)
