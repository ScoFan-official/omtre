# Firefox 提示词放置原则落地形态：答案

2026-10-19，用户对 6 个问题都选了推荐方案。依据：

- `10-19-firefox-prompt-research` 的 answer.md 和 research.md；
- `10-19-absorption-mechanism` 定下的吸收机制。

六条原则里，"指针优于正文"和"按需优于常驻"已经覆盖。session-start 只注入索引，按需加载，这次不改。剩下四条只覆盖了一部分，按下面的形态落地。

## 1. 按改动路径加载上下文

- 新增声明式规则文件 `.omtre/spec/context-rules.yaml`。每条规则写两项：
  - `when`：路径 glob，可以带 include/exclude；
  - `load`：要加载的 spec 或技能文件。
- check 阶段按 git diff 匹配规则，命中的文件自动加进子代理上下文，和手工维护的 `check.jsonl` 合并、去重。
- implement 阶段按任务声明要改的路径匹配。
- 写一个 lint 脚本，校验 glob 合法、`load` 里的路径都存在，接入 CI。
- 文件格式在施工时按现有 config 解析器定。

## 2. 目录级 AGENTS.md

- 子目录可以有自己的 AGENTS.md。第一行必须写清作用域，比如"根 AGENTS.md 仍然适用，下面只写本目录特有的"。
- `omtre update` 扫描这些文件，在根 AGENTS.md 的受管块里生成目录路由表。
- 不另外注入：各平台本来就会读嵌套的 AGENTS.md，再注入一次会重复加载。

## 3. 机械检查

新增一个检查指令文件的 lint 脚本，在 CI 和 check 阶段都跑。检查四项：

1. 根 AGENTS.md 和 CLAUDE.md 都不超过 150 行。用 ratchet：已经超过的，只拦继续增长。
2. 技能 description 不超过 500 字符，并且必须写明触发条件，比如 "Use when…" 或"触发："。
3. 指令文件和技能里引用的仓库内路径都必须存在。
4. 子目录 AGENTS.md 的第一行必须是作用域声明。

## 4. 提示词改动的评审

- 在 `context-rules.yaml` 里预置一条规则：改动命中 `AGENTS.md`、`CLAUDE.md`、`**/SKILL.md` 或 `.omtre/spec/**` 时，把 writing-for-agents 和 voice 规范加载进 check 上下文。
- 第 3 节的 lint 在 CI 里兜底。
- `rules-audit` 仍然手动跑，不排定时任务。

## 5. omtre 自己的模板

AGENTS.md 受管块里加两段：

- **工具优先**：列出 `task.py`、`get_context.py`、`omtre mem` 分别用来查什么，再加一句"能用工具查到的不要猜，查不到先问，不要盲搜"。
- **目录路由表**：第 2 节生成的那张。

## 6. 并进现有技能和规范

- **writing-for-agents / voice**：
  - 技能 description 采用 "Trigger on phrases like…" 的写法。
  - 增加一条准入规则：框架自带技能必须全仓通用；团队或领域专用的技能放进 marketplace，因为 description 每个会话都要占上下文。
- **rules-audit**：路径证据改为调用第 3 节的脚本获取；"约定是否还有人在用"仍然靠人判断。

## 出处

Firefox 的许可证是 MPL-2.0，不在 T7 定的原样拷贝允许清单里，所以只吸收思想，不拷贝原文。施工时在 `catalog/ATTRIBUTION.md` 的"改写来源"一节登记，写明来源 `mozilla-firefox/firefox@main` 的 AGENTS.md、`.agents/skills/README.md` 和 `review-context.toml`，以及本票。

## 给后续票的输入

施工项：

- `context-rules.yaml` 的规则引擎和 lint；
- 指令文件 lint 的 4 项检查；
- 受管块里新增的"工具优先"和目录路由表，路由表由 update 生成；
- writing-for-agents、voice 和 rules-audit 的修改；
- 出处登记。

这些施工项都依赖改名施工，因为要用到 `.omtre/` 路径和 `omtre` 命令。Q9-4 的预置规则依赖第 1 节的规则引擎。
