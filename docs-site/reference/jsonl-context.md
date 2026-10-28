---
title: JSONL 上下文格式
description: 正确编写 implement.jsonl 与 check.jsonl，把稳定规范和研究文件交给子代理。
audience: advanced
maturity: mixed
since: 1.0.0
---

# JSONL 上下文格式

<MaturityBadge level="mixed" />

`implement.jsonl` 与 `check.jsonl` 是任务维度的轻量上下文清单文件，存放于任务目录中。清单采用标准 JSON Lines 格式（每行一个独立的 JSON 序列化对象），为支持子代理架构的平台提供**确定性、可审查、按需读取**的规则与前置材料索引。

::: warning 注入边界：默认只放规范与调研产物
JSONL 清单通常应指向项目规范（`.omtre/spec/**`）或任务专属调研文档（`{TASK_DIR}/research/**`）。不建议把业务源码或源码目录写入清单：
- **子代理具备按需代码检索能力**：Worker 进程自带文件搜索与代码阅读工具，能根据需求自主探索调用链；
- **避免上下文膨胀与 Token 浪费**：将业务源码强行注入前置 Prompt，会导致每轮对话重复消耗成千上万无效 Token；
- **防止死链与上下文腐化**：业务代码在重构中频繁变动，一旦文件重命名或移动，硬编码的 JSONL 路径立即失效；
- **避免过早固化实现细节**：把未定型的源码作为上下文注入，容易让模型把旧实现当成唯一正确答案，降低重新设计架构的空间。

`task.py validate` 会对不适合注入的源码条目给出警告；要把它当作团队约定，而不是脚本已经强制封死的边界。
:::

## 格式规范

```jsonl
{"file": ".omtre/workflow.md", "reason": "Workflow contract"}
{"file": ".omtre/spec/backend/api-module.md", "reason": "API module conventions"}
{"file": ".omtre/tasks/10-26-user-login/research/token-expiry.md", "reason": "Upstream research findings"}
```

字段契约：

| 字段 | 类型 | 是否必填 | 约束说明 |
|---|---|---|---|
| `file` | string | **是** | 必须是相对于仓库根目录的相对路径，**严禁使用本机绝对路径** |
| `reason` | string | **推荐** | 阐明该材料对当前角色的决策价值，作为模型的引导线索 |
| `type` | string | 否 | 当引用整个技术调研目录时声明为 `"directory"`，普通文件留空 |

注：任务生成时的说明注释行或空文件不代表已配置上下文。在启用了子代理规范校验的平台上，空的 `implement.jsonl` 会在执行 `task.py start` 时被脚本机械阻断。

## 两个清单的职责边界

| 清单文件 | 消费角色 | 核心承载内容 |
|---|---|---|
| `implement.jsonl` | `implement` 子代理 | 架构约束、API 响应契约、数据库迁移规则、技术调研结论 |
| `check.jsonl` | `check` 审查子代理 | PRD 验收标准、质量红线、测试用例编写规范、安全防护规则 |

同一份领域规范（如 API 契约）可以同时出现在两份清单中，让编码与审查使用同一套评判基准。

## 允许与禁止注入清单对照

| 允许注入的内容（规则与背景） | 严禁注入的内容（源码与动态状态） |
|---|---|
| `.omtre/spec/**/index.md` 规范入口 | 项目业务源代码（`src/**/*.ts`、`lib/`） |
| 具体分层规范文件（如 `error-handling.md`） | 整个工程源码树或根目录（`./`） |
| 当前任务内的调研分析（`research/*.md`） | 依赖构建产物与缓存（`node_modules/`、`dist/`） |
| 第三方 API 协议或外部 Schema 的本地备份 | 密码、私钥、Token 或未脱敏数据 |
| 跨版本数据库字段兼容性备忘 | 与当前任务毫无关联的跨域规范 |

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
