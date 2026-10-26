---
title: Skills
description: 选择适合 omtre 的工程、规划、研究、设计和运维技能，控制安装范围。
audience: team
maturity: mixed
since: 1.0.0
---

# Skills

<MaturityBadge level="mixed" />

omtre 仓库维护一套技能包，覆盖需求澄清、任务拆分、TDD、诊断、设计、研究和规划。技能是 Agent 的可选能力，不是安装 omtre 后全部自动启用的运行时。

## 推荐起点

第一次使用只需要工作流内置能力：

- brainstorm
- before-dev
- check
- update-spec
- break-loop

不要一开始安装全部市场技能。等团队遇到明确场景，再增加一个技能并观察效果。

## 按任务选择

| 任务 | 推荐技能 |
|---|---|
| 模糊需求澄清 | grilling、grill-with-docs |
| 把讨论固化成需求 | to-spec |
| 拆分 ticket | to-tickets |
| 实现一个任务 | implement、tdd |
| 难 bug | diagnosing-bugs |
| 模块设计 | codebase-design |
| 行动前研究 | research |
| 审查变更 | code-review |
| 前端设计 | impeccable |
| 生成交接 | handoff |
| 写 PR | pr |

可用技能会随仓库版本变化，以安装目录和技能 frontmatter 为准。

## 安装

```bash
npx skills add ScoFan-official/omtre --agent qoder --copy
```

安装前：

1. 确认目标平台；
2. 固定 tag 或提交；
3. 在非关键仓库先试；
4. 阅读技能内容；
5. 只保留团队需要的集合。

如果宿主支持按名称安装，优先选择明确技能，而不是一次复制全部。

## 技能如何触发

通常有两种方式：

- **语义触发**：宿主把技能名称和 description 放入可用列表，任务匹配时加载；
- **显式调用**：用户点名技能或调用生成的命令。

技能数量过多会稀释匹配。团队应维护：

- 推荐集合；
- 禁止集合；
- 需要安全审查的集合；
- 版本更新节奏。

## 三类技能的区别

| 类别 | 例子 | 维护者 |
|---|---|---|
| 工作流内置 | brainstorm、check | omtre |
| omtre 运行时/引导 | omtre-meta、spec-bootstrap | omtre |
| 第三方 vendored | 研究、设计、测试等 | 上游 + omtre 同步 |

第三方技能保留来源和许可证，但不因为被收录就代表经过与核心 CLI 同等测试。

## 技能与规范的关系

技能教 Agent **怎么做**，规范约束项目**应该怎样**。

例如：

- “如何做 TDD”可以是一个技能；
- “本仓库测试目录、fixture 和命名约定”应该写进 `.omtre/spec/`；
- “验证命令必须通过”由任务验证契约执行。

不要把项目专属规则埋在通用技能中，否则升级会丢失，其它仓库也无法复用。

## 平台差异

- 有的平台原生命令和技能是两种目录；
- 没有命令原语的平台会把命令包装为技能；
- 子代理能力缺失的平台不会因为技能存在就获得子代理；
- 调用名称可能带平台前缀。

安装后检查实际目录，不要只相信 README 的通用示例。

## 安全审查清单

- [ ] 技能来源和版本
- [ ] LICENSE 与 attribution
- [ ] 是否会执行 shell
- [ ] 需要哪些凭证
- [ ] 是否调用外部网络
- [ ] 是否会修改生产配置
- [ ] 是否包含 MCP/server
- [ ] 能否在沙箱中运行
- [ ] 是否可移除

## 移除

技能是项目文件。移除前确认：

- 没有任务或规范引用它；
- 宿主的可用技能列表会同步变化；
- 团队文档已更新；
- 不是 omtre 受管核心文件。

不要用“删掉一个目录”来代替评估依赖。

## 下一步

- [规范模板](./spec-templates.md)
- [Skills 与规范模板](../advanced/skills-and-marketplace.md)
- [参与贡献](./contributing.md)
