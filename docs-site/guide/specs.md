---
title: 规范系统
description: 写出 Agent 能执行、团队能审查的规范，而不是一库空泛口号。
audience: team
maturity: mixed
since: 1.0.0
---

# 规范系统

<MaturityBadge level="mixed" />

规范（spec）是项目希望 Agent 在写代码前读取的规则。它放在 `.omtre/spec/`，随 Git 提交、审查和演进。

规范不是“写得越多越好”。一条无法判断是否违反的规则，只会增加上下文和 Review 噪声。

## 目录组织

推荐按包和层组织，并以 `index.md` 作为入口：

```text
.omtre/spec/
├── guides/
│   └── index.md
├── backend/
│   ├── index.md
│   ├── api-conventions.md
│   ├── error-handling.md
│   └── testing.md
└── frontend/
    ├── index.md
    ├── components.md
    └── async-state.md
```

单包仓库可以直接按主题分目录；monorepo 可以按包名分层：

```text
.omtre/spec/
├── api/
│   └── backend/
│       ├── index.md
│       └── ...
└── web/
    └── frontend/
        ├── index.md
        └── ...
```

会话通常先看到索引路径，再按任务加载具体规范。不要把全部规则塞进一个巨大文件。

## 一条好规范的结构

```markdown
## API input validation

All POST and PATCH handlers validate input with the schema helper in
`src/api/schemas.ts` before calling service code.

Why: invalid payloads previously produced inconsistent 500s instead of
structured 400 responses.

Example:

```ts
// Good
const input = CreateOrderSchema.parse(req.body)
const order = await orderService.create(input)
```

Verification:

- Add a Zod schema next to the route.
- Include one invalid-payload test.
```

一条可执行规范通常包含：

1. **触发条件**：什么时候适用；
2. **具体要求**：允许什么、禁止什么；
3. **原因**：为什么存在，避免被误删；
4. **真实示例**：Good / Bad；
5. **验证方式**：测试、lint、类型或 Review checklist；
6. **证据**：真实文件路径、Issue、事故或决策。

## 先写有证据的规范

### 从已有代码提取

```text
扫描 <包或目录> 的真实代码，只提取已经稳定存在的模式：
- API 输入校验与错误返回；
- 鉴权和权限检查；
- 日志与敏感信息处理；
- 数据访问和事务边界；
- 测试组织和 fixture 使用。

每条规则引用至少一个真实文件。
无法确认是否为团队约定的内容，标记为“待确认”，不要写成规则。
```

### 从 Review 反馈提取

把重复 Review 意见转成规则前，先检查：

- 有真实 PR 或代码证据？
- 能明确判断违反？
- 有修复方式？
- 能被测试、lint 或 Review 检查？
- 是否与现有规则重复或冲突？

不能执行的建议，继续留在 Review 习惯里，不要写进规范。

## 从空模板到第一版规范

安装或引导流程可能生成规范模板。模板只是结构，不是项目事实。

一个最小启动顺序：

1. 列出当前任务涉及的 1–3 个工程问题；
2. 阅读对应真实调用链；
3. 为每个问题写一条短规则；
4. 在任务中实际使用；
5. 观察它是否减少错误或 Review 往返；
6. 没有效果或无法验证的规则删除。

不要一次填满所有模板。空泛的“代码应清晰、安全、可维护”没有执行价值。

## 规范的三种强度

| 强度 | 例子 | 如何保证 |
|---|---|---|
| 机械 | 验证命令必须通过；JSONL 路径必须存在 | 脚本拒绝 |
| 可检查 | 新 API 必须有 schema 和错误测试 | Review checklist、测试约定 |
|  judgment | 优先使用现有 helper，不新增重复工具 | 人或 Agent 审查 |

写规范时明确它属于哪一种。不要用“必须”描述一个实际上只能靠自觉执行的规则。

## 规范如何进入任务

### 索引驱动

会话启动入口通常提供规范索引路径，Agent 再按任务选择具体文件。

### 任务上下文清单

使用 `implement.jsonl` / `check.jsonl` 把稳定规范绑定到任务：

```bash
python3 .omtre/scripts/task.py add-context \
  .omtre/tasks/<task-dir> \
  implement \
  ".omtre/spec/backend/api-conventions.md" \
  "API shape and error format for this change"
```

只加入真正相关的文件。把所有规范都塞进去会稀释重点。

### 子代理直接读取

一些平台由 hook 注入清单，一些平台要求子代理自行读取。无论哪种方式，任务产物中的路径必须准确。

## 任务结束后的知识回写

收尾前问三个问题：

1. 这次任务是否出现了新的、可复用的规则？
2. 规则是否能被未来任务验证？
3. 它应该放在哪个最小规范文件中？

如果答案都是“是”，写入 `.omtre/spec/` 并随任务提交。否则，把任务细节留在研究或 journal 中即可。

不要把所有调试记录都变成规范。任务细节和团队规则应分开：

- 只对本次任务成立 → `research/`、`implement.md` 或 journal；
- 对以后同类任务成立 → `.omtre/spec/`。

## 规范治理

| 问题 | 建议 |
|---|---|
| 规范太长 | 按主题拆分，index 只保留入口和检查清单 |
| 规则互相矛盾 | 指定优先级或删除过时规则 |
| 规则没人遵守 | 检查是否有验证方式；没有则降级或删除 |
| 平台差异大 | 在规则中写清条件，不要写成所有平台一致 |
| Agent 误读 | 增加真实示例、文件路径和反例 |
| 规范过时 | 任务中引用真实代码，Review 时同步更新 |

规范也要像代码一样 Review。允许删除无效规则，是保持规范可信的必要条件。

## 反模式

- “所有代码必须优雅”；
- “遵循最佳实践”；
- “不要写 bug”；
- 只写禁止项，没有正确示例；
- 把目标架构写成当前事实；
- 将 1,741 个市场资产全部安装后当成项目规范；
- 引用不存在的文件或命令。

## 下一步

- [项目记忆与日志](./workspace-memory.md)
- [质量检查与提交](./quality-and-commit.md)
- [JSONL 上下文格式](../reference/jsonl-context.md)
