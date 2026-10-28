---
title: task.json Schema
description: omtre 1.0.0 任务元数据的字段、写入者和状态边界。
audience: advanced
maturity: stable
since: 1.0.0
---

# task.json Schema

<MaturityBadge level="stable" />

`task.json` 是单次任务生命周期状态的机器可读真源（Source of Truth），存放于任务目录根节点 `.omtre/tasks/<task-dir>/task.json`。该文件由 `.omtre/scripts/task.py` 工具链严格读写维护。

**核心红线**：严禁工程师或 Agent 直接手工编辑 `task.json` 的状态机字段（`status`）与验证契约（`verify`），所有状态跃迁必须经由原生脚本执行硬性校验后自动变更。

## 数据结构示例

```json
{
  "id": "10-26-order-status-filter",
  "name": "order-status-filter",
  "title": "Add order status filter",
  "description": "Filter orders by an existing status value",
  "status": "planning",
  "dev_type": null,
  "scope": null,
  "package": "web",
  "priority": "P1",
  "creator": "alice",
  "assignee": "alice",
  "createdAt": "2026-10-26",
  "completedAt": null,
  "branch": null,
  "base_branch": "main",
  "worktree_path": null,
  "commit": null,
  "pr_url": null,
  "subtasks": [],
  "children": [],
  "parent": null,
  "relatedFiles": [],
  "notes": "",
  "meta": {}
}
```

## 字段

| 字段 | 类型 | 主要写入者 | 说明 |
|---|---|---|---|
| `id` | string | create / rename | 任务目录标识 |
| `name` | string | create / rename | 通常与 `id` 相同 |
| `title` | string | create | 人类可读标题 |
| `description` | string | create | 非空描述 |
| `status` | string | create / start / archive | `planning`、`in_progress`、`completed` |
| `dev_type` | string \| null | 创建时为 null | 预留字段，1.0.0 无专门 setter |
| `scope` | string \| null | set-scope | 提交或任务范围 |
| `package` | string \| null | create / set-scope | monorepo 包名 |
| `priority` | string | create | 默认通常为 `P2`，可传 P0–P3 |
| `creator` | string | create | 创建者身份 |
| `assignee` | string \| null | create | 负责人 |
| `createdAt` | date | create | 创建日期 |
| `completedAt` | datetime \| null | archive | 完成时间 |
| `branch` | string \| null | start / set-branch | 任务分支 |
| `base_branch` | string \| null | create / set-base-branch | PR 目标分支 |
| `worktree_path` | string \| null | set-worktree | `omtre run` / 运行器记录 |
| `commit` | string \| null | 无自动写入 | 预留；哈希通常记录在 journal |
| `pr_url` | string \| null | set-pr | 审查 PR 地址 |
| `subtasks` | array | create / hooks | 任务内检查项，和父子任务不同 |
| `children` | array | add/remove-subtask | 子任务目录 |
| `parent` | string \| null | create --parent / add-subtask | 父任务目录 |
| `relatedFiles` | array | 创建后无自动写入 | 预留 |
| `notes` | string | 创建后无自动写入 | 备注 |
| `meta` | object | create / set-meta | 扩展元数据 |

## 关键扩展字段

### `verify`

由 `add-verify` 写入：

```json
{
  "verify": [
    {
      "cmd": "pnpm test",
      "expect_exit": 0,
      "timeout": 600
    }
  ]
}
```

归档时每条命令都会执行。任一失败即阻止归档。

### `verify_skipped`

显式跳过验证时写入：

```json
{
  "verify_skipped": {
    "reason": "Docs-only typo; tests are unaffected.",
    "at": "2026-10-26T10:00:00Z"
  }
}
```

原因必须非空。这是审计记录，不是推荐路径。

### `blocked_by`

由 `set-meta` 写入，用于任务依赖：

```json
{
  "blocked_by": ["10-25-orders-api", "10-25-orders-ui"]
}
```

`task.py frontier` 只把 blocker 都已满足的任务列入 ready。

### `meta.domain`

领域 board 标识：

```json
{
  "meta": {
    "domain": "orders"
  }
}
```

也可通过 `--domain orders` 写入。

## 状态

| 状态 | 写入时机 | 允许进入条件 |
|---|---|---|
| `planning` | create | 已创建任务记录 |
| `in_progress` | start | 计划产物与上下文条件通过 |
| `completed` | archive | 验证、分支与归档检查通过 |

`task.py finish` 只清理会话指针，不改 `status`。

## 父子字段与 subtasks 的区别

- `parent` / `children`：独立任务目录之间的包含关系；
- `subtasks`：一个任务内部的待办清单；
- `blocked_by`：硬依赖，决定 frontier 是否 ready。

不要把三者混用。

## 手工修改的风险

不建议手改：

- `status`
- `completedAt`
- `verify`
- `children` / `parent`
- `blocked_by`

直接修改会绕过验证、归档和依赖解析。任务记录损坏时，先备份，再根据任务目录和历史重建，并记录原因。

## 下一步

- [JSONL 上下文格式](./jsonl-context.md)
- [任务与 PRD](../guide/tasks.md)
- [质量检查与提交](../guide/quality-and-commit.md)
