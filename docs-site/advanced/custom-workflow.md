---
title: 自定义工作流
description: 切换内置工作流模板，并通过 marketplace 提供团队自己的工作流契约。
audience: advanced
maturity: advanced
since: 1.0.0
---

# 自定义工作流

<MaturityBadge level="advanced" />

`.omtre/workflow.md` 定义开发阶段、每轮提示的状态块、必做步骤和平台分支。切换工作流会改变 Agent 的行为契约，但不会自动改写你的代码或任务。

## 内置与市场模板

```bash
omtre workflow --list
```

常见模板：

| ID | 作用 | 来源 |
|---|---|---|
| `oh-my` | 默认完整工作流 | 受管内置模板 |
| `native` | 原生 Plan / Execute / Finish 变体 | 捆绑模板 |
| `tdd` | 以红-绿-重构推进实现 | marketplace |
| `channel-driven-subagent-dispatch` | 通过 Channel 协调实现/检查 worker | marketplace |

具体列表和当前 CLI 的帮助以你的安装版本为准。

## 查看当前工作流

```bash
sed -n '1,160p' .omtre/workflow.md
```

重点检查：

- `## Phase Index`；
- `[workflow-state:<status>]` 块；
- 必做步骤；
- 平台分支；
- 提交和收尾边界。

## 切换

```bash
omtre workflow --template tdd
```

冲突处理：

```bash
# 覆盖本地修改，不保留备份
omtre workflow --template native --force

# 生成 .omtre/workflow.md.new，人工比较
omtre workflow --template native --create-new
```

安全顺序：

1. 提交或备份当前 `workflow.md`；
2. 先使用 `--create-new`；
3. 比较差异；
4. 确认后替换；
5. 完成一个真实任务验证。

直接 `--force` 会覆盖本地定制。它不是升级项目模板的通用办法。

## 市场工作流

```bash
omtre workflow \
  --template team-workflow \
  --marketplace gh:myorg/myrepo/marketplace
```

市场源需要索引，条目类型为 `workflow`，并指向一个 Markdown 文件。支持 GitHub、GitLab、Bitbucket 以及 HTTPS/SSH 源，默认 ref 通常为 `main`。

1.0.0 不支持从本地任意文件直接导入工作流，也不是简单把 `.md` 放到目录就会被识别。它必须通过可解析的 marketplace 索引或内置 ID 获得。

## 工作流契约

自定义模板必须保留运行时依赖的结构：

- `## Phase Index`；
- 步骤编号，例如 `1.1`、`2.2`；
- `[workflow-state:<status>]` 与闭合标签；
- 状态字符集 `[A-Za-z0-9_-]+`；
- 与任务状态和 hooks 一致的阶段说明。

否则：

- hooks 可能找不到状态块；
- Agent 会退化为通用提示；
- 必做步骤不会被注入；
- 某些脚本或测试可能拒绝。

## 可以改什么

- 计划阶段的提问方式；
- 哪些步骤要求人工确认；
- 检查轴的职责；
- 提交和收尾的措辞；
- 新增自定义状态及其写入者；
- 平台分支的执行方式。

## 不应只靠改文档解决的问题

以下能力需要代码或平台支持，不是在工作流里写一句话就能实现：

- 新增机械验证闸门；
- 自动加载不存在的上下文；
- 改变子代理工具权限；
- 强制 Git push 保护；
- 自动创建并合并 PR。

工作流是契约说明，不是运行时插件系统。

## 版本与更新

- `oh-my` 等受管模板可能被 `omtre update` 更新；
- 自定义工作流通常不再受模板哈希管理；
- 升级后检查 `update --dry-run` 是否会覆盖；
- 团队定制应放入自己的 marketplace，而不是直接改受管文件。

## 推荐治理

| 规则 | 做法 |
|---|---|
| 工作流变更需要评审 | 像代码一样提交和 Review |
| 不在任务中临时大改 | 用独立任务修改工作流 |
| 保留可回滚版本 | Git 历史 + 受管模板 |
| 验证状态块 | 在目标平台完成一次会话 |
| 记录平台差异 | 不只在一个宿主上验证后宣称全平台可用 |

## 下一步

- [自定义命令](./custom-commands.md)
- [自定义子代理](./custom-agents.md)
- [Hooks](./hooks.md)
