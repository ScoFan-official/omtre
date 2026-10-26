---
title: JSONL 上下文格式
description: 正确编写 implement.jsonl 与 check.jsonl，把稳定规范和研究文件交给子代理。
audience: advanced
maturity: mixed
since: 1.0.0
---

# JSONL 上下文格式

<MaturityBadge level="mixed" />

`implement.jsonl` 和 `check.jsonl` 是任务级上下文清单，每行一个 JSON 对象。它们帮助支持的平台把稳定规范和研究材料交给对应角色。

它们不是：

- 源码索引；
- 任务计划；
- 所有项目规范的合集；
- 在所有平台都必然存在的文件。

## 格式

```jsonl
{"file":".omtre/spec/backend/index.md","reason":"Backend development conventions"}
{"file":".omtre/spec/backend/api-conventions.md","reason":"API contract and error shape"}
{"file":".omtre/tasks/10-26-order-filter/research/status-values.md","reason":"Existing status values and edge cases"}
```

字段：

| 字段 | 必填 | 说明 |
|---|---|---|
| `file` | 是 | 仓库根相对路径 |
| `reason` | 建议 | 为什么这个角色需要读取 |
| `type` | 目录时可能需要 | `directory` |

种子说明行或空文件并不等于“已配置上下文”。支持的平台可能在清单为空时阻止 `start`。

## 两个清单的分工

| 文件 | 给谁 | 应包含 |
|---|---|---|
| `implement.jsonl` | 实现角色 | 规范、研究、接口约定、已知约束 |
| `check.jsonl` | 检查角色 | 验收标准、质量规范、测试约定、风险清单 |

同一个规范文件可以同时出现在两边；同一份研究也可能同时服务实现和检查。

## 适合放什么

- `.omtre/spec/**/index.md`
- 具体规范文件
- 任务 `research/*.md`
- 外部接口契约的本地副本
- 已验证的迁移或兼容说明

## 不适合放什么

- 即将修改的源码；
- 整个仓库目录；
- 生成产物和依赖目录；
- secrets；
- 与任务无关的全量规范；
- 依赖本机绝对路径且不可移植的文件。

源码应在实现阶段按需阅读，不需要预先登记为上下文清单。

## 添加

```bash
python3 .omtre/scripts/task.py add-context \
  .omtre/tasks/<task-dir> \
  implement \
  ".omtre/spec/backend/index.md" \
  "Backend conventions"
```

参数顺序是：

```text
task.py add-context <dir> <implement|check> <path> [reason]
```

## 校验

```bash
python3 .omtre/scripts/task.py validate .omtre/tasks/<task-dir>
```

可能检查：

- JSON 是否能解析；
- 每行是否为对象；
- `file` 是否为字符串；
- 路径是否存在；
- 是否只有示例行；
- 是否有不适合注入的源码或超大文件。

具体哪些是错误、哪些是警告，以当前脚本输出为准。

## 查看

```bash
python3 .omtre/scripts/task.py list-context .omtre/tasks/<task-dir>
python3 .omtre/scripts/task.py list-context .omtre/tasks/<task-dir> check
```

## 平台差异

| 模式 | 清单如何被消费 |
|---|---|
| hook-push 子代理 | 平台 hook 在子代理启动前注入 |
| pull-based 子代理 | 子代理根据角色卡自行读取 |
| inline 主会话 | 由技能或主会话加载相关规范 |
| 不生成清单的平台 | 依赖规范索引和技能路径 |

因此：

- 清单是给支持平台的优化，不是所有平台的硬依赖；
- 路径必须真实；
- `start` 的空清单检查只在文件存在时触发。

## 任务目录怎么写进清单

任务路径通常是仓库相对路径：

```text
.omtre/tasks/10-26-order-filter/research/status-values.md
```

不要写绝对路径。任务归档后，旧清单可能仍引用原路径；归档任务通常作为历史记录保留，不应再作为活动上下文使用。

## 注入上限

项目配置可以限制单文件、任务产物和总注入量。超限时，上下文可能截断或退化为路径索引。

查看当前配置中的：

```yaml
context_injection:
  max_file_bytes: 32768
  max_artifact_bytes: 65536
  max_total_bytes: 131072
```

规则文件越长，不代表注入越完整。优先写短、可定位、可验证的规范。

## 下一步

- [任务与 PRD](../guide/tasks.md)
- [规范系统](../guide/specs.md)
- [配置参考](../advanced/configuration.md)
