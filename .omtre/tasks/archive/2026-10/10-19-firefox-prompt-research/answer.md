# 答案：Firefox 六原则 × omtre 机制对照

来源仓库：`mozilla-firefox/firefox`（GitHub `main` 分支，即 mozilla-central 镜像）。逐条原文见 `research.md`。

## 核实到的文件

- `AGENTS.md`：73 行，与视频一致。第一条规则即"几乎不写注释"。`CLAUDE.md` 只有一行 `@AGENTS.md`。
- 模块级 `AGENTS.md` 共 5 个：`js/`、`layout/`、`gfx/wr/`、`browser/extensions/newtab/`、`browser/extensions/webcompat/`；`security/nss/` 用上游 `CLAUDE.md`。
- `.agents/skills/`：24 个技能 + `README.md`；`.claude/skills/` 是同名镜像副本，`review-context.toml` 从这里加载。
- `review-context.toml`：3 条 `[[rules]]`，按补丁改动路径的 glob/ext 谓词触发，把指定 SKILL.md 注入 review 上下文。

## 原则对照表

| 原则 | Firefox 做法 | omtre 对应机制 | 判定 |
|---|---|---|---|
| Scope > Prompts | 根 `AGENTS.md` L10–16 是目录路由表：进入 `js/`、`gfx/` 等目录才读子 `AGENTS.md`；`review-context.toml` 按改动路径注入 | `.omtre/spec/<pkg>/<layer>/index.md` 按包分层；`session-start.py` 用 `spec_scope`/`active_task` 过滤索引（L608–664）；无按目录的子 `AGENTS.md` 约定 | 部分覆盖：有作用域但维度是包/任务，不是目录 |
| Pointers > Prose | 根文件 73 行只做指路；`js/AGENTS.md` 文档节是纯指针列表；技能 `description` 即常驻指针 | 根 `AGENTS.md` 是纯指针块；`session-start.py` 只注入索引路径（"read on demand"）；`writing-for-agents` 有完整的 context pointer 理论 | 已覆盖 |
| Tools > Prompts | "MUST use `searchfox-cli`"；`treeherder-cli`、`moz` MCP、`./mach`；技能包装 CLI（`find-reviewer` → `mach file-info reviewers`） | hook 直接运行 `task.py`/`get_context.py` 算好状态注入；根 `AGENTS.md` 无"优先用工具查"的明文规则 | 部分覆盖：机制在用，缺一条显式工具优先指令 |
| Lazy > Always | 子 `AGENTS.md`、技能正文、`review-context.toml` 全部按需加载；常驻的只有 73 行 + 技能 `description` | `session-start.py` 结尾 `<ready>` 明示"Load details only when needed"；面包屑每轮仅 3 行；技能分 bundled/marketplace | 已覆盖 |
| Triggers > Memory | 触发条件写在三处常驻物里：技能 `description`（"Trigger on phrases like…"）、根路由表、TOML `when` 谓词 | `voice.md` I4 要求每条写触发条件；`inject-workflow-state.py` 每轮按任务状态注入 `<workflow-state>`；无路径匹配触发器 | 部分覆盖：有状态触发，缺文件路径触发的注入规则 |
| Prompts rot | `AGENTS.md` 每月有修正提交，全部经 `ai4dev-reviewers` 评审；L57 明文讲链接会 rot | `rules-audit` 技能做逐条取证 prune/annotate；`writing-for-agents` 定义 sediment/no-op/cache 判据；`trellis update` 重写托管块 | 部分覆盖：有修剪机制，无常态化评审流程，靠人主动调用 |
| 何时该写（附加节） | `README.md` 门槛：只收 tree-wide 通用技能，团队级去 marketplace；"description 是每会话的常驻成本" | `SKILL-MECHANICS.md` 的 model/user-invoked 成本模型 + router skill；`writing-for-agents` 的两种 load | 已覆盖，理论更完整 |

## 要点

- Firefox 的核心结构是三层：常驻薄层（73 行路由 + 工具口令）→ 目录级延迟层 → `when` 谓词驱动的按需注入。omtre 已有前两层和状态触发注入。
- 最大缺口是 `review-context.toml` 类机制：把"补丁/文件路径 → 加载哪份规范"写成可 lint 的声明式规则。omtre 的 `spec` 目录按包组织，但没有按改动路径自动选载的触发器。
- 第二缺口是评审常态化：Firefox 给提示词改动设了 `ai4dev-reviewers` 评审组，`rules-audit` 目前需要人记得调用。可考虑把审计挂到 `trellis update` 或 check 阶段。
- 可借鉴的小条目：根 `AGENTS.md` 加一条"工具缺失先跑 bootstrap / 查不到先问而不是盲搜"；技能 `description` 写"Trigger on phrases like…"式触发短语（`voice.md` I4 已兼容此写法）。
