# pstack 调研笔记：/correct、修正阶梯、playbook 路由、许可证、能力对照

调研日期：2026-10-19。分析对象：`cursor/plugins` 仓库 `main` 分支 `pstack/` 子树，克隆至本机临时目录实测；检出 commit `8838150`（2026-10-18），`plugin.json` 版本 `0.15.27`。

## 来源清单

| 来源 | 获取方式 | 状态 |
|---|---|---|
| `pstack/` 源码树（skills、playbooks、agents、docs、LICENSE、plugin.json） | `git clone --depth 1 --filter=blob:none --sparse` + `sparse-checkout pstack` | 全文已读 |
| YouTube 视频 `6puKyBbZEGY`（英文字幕） | `yt-dlp --write-sub --write-auto-sub --sub-lang en --skip-download`，字幕转纯文本 282 行 | 全文已读 |
| X 发布帖 `https://x.com/poteto/status/2106542593656111276`（2026-10-04） | webfetch | 全文已读 |
| X 原始阶梯帖 `https://x.com/poteto/status/2089067865098113024`（2026-08-16，发布帖中引用） | webfetch | 全文已读 |
| omtre 侧对照文件 | 本地读取 | 全文已读 |

---

## 1. `/correct` 的完整工作流

出处：`pstack/skills/correct/SKILL.md`（全文 32 行，即全部提示词本体）
<https://github.com/cursor/plugins/blob/main/pstack/skills/correct/SKILL.md>

frontmatter：

```yaml
name: correct
description: "Find the mistakes agents keep repeating in this repo and make each one
impossible. Try architecture first, then types, then a lint whose error names the fix,
then a test, and write docs last. Prove each check fails on a real past mistake.
Repeat this each time the operator corrects you. Use for /correct."
disable-model-invocation: true
```

`disable-model-invocation: true` 表示它不会被模型自动触发，只能由 `/correct` 斜杠命令或被其他 skill 文本点名来调用。同库所有 skill 均带此标记（抽查 `poteto-mode`、`architect`、`interrogate`、`reflect`、`automate-me` 一致）。

### 1.1 输入（历史挖掘面）

> "First, read recent commits, reverts, review comments, agent instruction files, and comments that explain workarounds. Group the mistakes into classes. **A class counts once it has happened twice.**"
> — `skills/correct/SKILL.md` "Find the mistake classes"

即输入＝**近期提交、回滚（revert）、评审评论、agent 指令文件（AGENTS.md/CLAUDE.md 之类）、解释 workaround 的代码注释**。聚类标准＝同类错误出现 ≥2 次才算一类。发布帖佐证："if you keep correcting agents for the same mistakes, it finds the pattern and fixes it with architecture, types, and checks"（X 帖，2026-10-04）。视频佐证："Twice counts as a pattern"（字幕）。

### 1.2 行为假设（决定整个设计的前提）

> "Assume every contributor is an agent that sees only the files it opened, copies the nearest example, and takes the shortest path that compiles. Design the repo so a change that looks right from one file is right for the whole repo."
> — `skills/correct/SKILL.md` 第 11 行

同一假设在 `skills/architect/references/design-red-flags.md` 逐条展开（"An agent copies whichever way it finds first" 等）。视频复述了这句原文："an agent 'that sees only the files it opened, copies the nearest example, and takes the shortest path that compiles.'"

### 1.3 处理：按"最高可行层级"修每一类

`SKILL.md` "Fix each class at the highest level that works" 给出四级（编号 1–4，原文见 §2）。之后：

> "Then fix the most frequent classes now, **one commit each. Prove each new check fails on a real past mistake.** Run the same command locally and in CI. Exceptions go on the offending line with a reason, an expiry date, and a human's approval."
> — `skills/correct/SKILL.md` "Fix and prove"

即：最高频的类当场修；**每类一个 commit**；每个新检查必须在一个真实历史错误上跑出红（prove-by-regression）；同一命令本地与 CI 都跑；例外用行内注释放行，必须带原因 + 到期日 + 真人批准。

### 1.4 产出与落点

> "Last, keep a table in the agent instruction file that pairs each rule with what enforces it. When the operator corrects you, fix the mistake and add the rule. If the rule was already there and nothing enforces it, that's a repeat, so fix it at the highest level in the same change. Drop a rule once its mistake can't happen."
> — `skills/correct/SKILL.md` "Keep the rule table"

产出物有三类：

1. **结构性修复**（架构/类型/lint/测试本体，分散在各源码文件与 CI 配置）；
2. **agent 指令文件中的"规则↔执行者"配对表**——写在仓库的 agent instruction file（对 Cursor 即 `AGENTS.md`/rules 类文件；pstack 未限定具体文件名）；
3. **回复格式**："each class with its evidence, the level you picked, and why a higher level didn't work."（每类给出证据、所选层级、以及更高一层为何不可行）。

表的生命周期也被定义：操作者纠正 → 修错 + 加行；规则在表但无执行者 → 视为复发，本次改动内升到最高层级；错误不可能再发生 → 删行。

### 1.5 配套机制（不在 correct/SKILL.md 内，但同一体系）

- `skills/principle-encode-lessons-in-structure/SKILL.md`："Apply when you catch yourself writing the same instruction a second time… Encode the rule as a lint, metadata flag, runtime check, or script instead of more text." 附则："If the fix is structural, only use the structural fix. **The instruction is the symptom.**"
- `skills/reflect/SKILL.md` step 4 "Structural enforcement check"：评审 Accepted 学习项时，"Move any Accepted item that a lint rule, script, metadata flag, or runtime check would enforce more reliably to Backlog"——能被结构化的教训不许以纯文本规则落地。
- 视频佐证指令瘦身实验："In September Lauren cut 34 instructions that Opus 5.5 follows without being told, and she A/B tested the second batch. Her review skill caught 142 of 154 planted problems without those lines, and 139 with them."（142/154 删掉指令后 vs 139/154 保留——删掉反而更好）其规则："if a lesson can be a lint rule, a check or a script, encode it and delete the instruction."

---

## 2. 修正阶梯各档的仓库落地形态

注意有两份阶梯文本，需区分：

**A. poteto 本人 2026-08-16 X 帖**（/correct 的思想原型，四级）：
<https://x.com/poteto/status/2089067865098113024>

> "every time you intervene and correct your agent, you should think about how to eliminate it entirely. in order of value:
> 1. categorically eliminate the problem through better architecture or choice of data structures
> 2. turn it into a lint rule or test so CI catches it
> 3. turn it into a skill or rule
> 4. have humans review the code to catch it (ngmi)"

视频旁白与此一致："The best one is architecture… Next comes a lint rule or a test, so CI catches it. Third, a skill or a rule the agent reads. And dead last, a human reviewing the code to catch it, which she labels NGMI. Not gonna make it."

**B. `skills/correct/SKILL.md` 内的执行版**（架构、类型、lint/CI、测试、文档 五步）：

> 1. "**Eliminate it with architecture.** Give each piece of state one owner and each task one supported way. Hide internals so the wrong import fails. Replace hand-synced lists with one source of truth. Delete old ways and dead code an agent would copy."
> 2. "**Enforce it with types** so the bad state can't be written. If bad code still compiles, add a lint or CI check whose error names the file, type, or function to use instead. If the pattern is already common, fail only when a change adds more."
> 3. "**Test the behavior.** Fix or delete any test that still passes when the behavior it checks breaks, or that fails when only the internals change."
> 4. "**Write docs or agent rules last, only for judgment calls.** Nothing fails when an agent skips them."

两版关系：B 把 A 的第 2 档拆成"类型 → lint/CI"，把测试独立成档，把 A 的第 3 档（skill/rule）明确为"文档/agent 规则最后写"。人审在 B 中不作为落地档位出现，只在"例外需 human approval"与视频的"Lauren 早上读提交历史抽查"里存在。

### 各档在仓库里的具体形态

| 档位 | 仓库内落地物 | 出处 |
|---|---|---|
| 架构 | 单一状态属主；一个任务只留一条受支持路径；内部实现不可被外部 import（import 即编译失败）；手工同步列表改为单一事实源+派生；删除旧路径与 agent 会照抄的死代码 | `skills/correct/SKILL.md` 档 1；红旗清单 `skills/architect/references/design-red-flags.md`（8 条：shallow module / information leakage / temporal decomposition / pass-through method / split ownership / **two ways to do one task** / **importable internals** / **hand-synced list**） |
| 类型 | 非法状态不可表示、brand 语义原语、边界处 parse 外部数据、穷尽 variant、从权威 schema 派生类型 | `skills/principle-type-system-discipline/SKILL.md`（README principles 表第 239 行归纳） |
| lint / CI | 报错信息**点名替代物**（该用哪个文件/类型/函数）；已泛滥模式用 ratchet——"fail only when a change adds more"（只拦增量）；同一命令本地+CI 双跑 | `skills/correct/SKILL.md` 档 2 |
| 测试 | 只测行为："assert what the code's users can observe, so the test fails when that behavior breaks and keeps passing when only the internals change"；行为坏了还通过、或只动内部就失败的测试要修或删；Bug fix playbook 要求失败 repro 先于修复进 git 历史 | `skills/principle-test-behavior-not-implementation/SKILL.md`；`skills/poteto-mode/playbooks/bug-fix.md` 步骤 5 |
| 文档 / agent 规则 | 只给判断题；写在 agent instruction file 的"规则↔执行者"配对表中；跳过它不会有任何东西失败 | `skills/correct/SKILL.md` 档 4 + "Keep the rule table" |
| 人审（NGMI） | 不在 `/correct` 落地档位里；体系内对应物是例外审批（reason+expiry+human approval）与操作者晨审提交历史 | 视频字幕；`skills/correct/SKILL.md` "Fix and prove" |

补充证据——"一次只留一条路"在 poteto 自家框架的实践（视频）："every feature gets its own folder, lint rules block the wrong imports, and code comments are banned, because agents kept using them to excuse their workarounds."

---

## 3. playbook 路由（"poteto mode"）

出处：`pstack/skills/poteto-mode/SKILL.md`（149 行，路由中枢）、`skills/poteto-mode/playbooks/*.md`（实测 **23 个文件**）、`docs/guide/02-poteto-mode.md`、README。

### 3.1 机制是纯提示词路由，无注册表

- 全部 skill 都是 `skills/<name>/SKILL.md` 静态 markdown；`poteto-mode` 用相对路径引用同侪："Bundled skills live at `../<name>/SKILL.md` from this file, so put this file's absolute path in every `poteto-agent` prompt."（SKILL.md 第 11 行）
- `disable-model-invocation: true`：skill 不自动触发，靠 `/poteto-mode` 命令显式加载后，由文件内的文本指令驱动下一步读取哪个文件。
- 匹配逻辑 = SKILL.md "Playbooks" 节的逐条一句话触发描述（如 "Bug fix. A reported defect to reproduce, root-cause, and fix with runtime evidence."），模型按语义把任务对上号；对上后 "open its full steps at `playbooks/<title>.md`… **Copy its steps in verbatim**" 进 todo 列表，未执行的步骤保留为 `skip: <reason>` 一行（SKILL.md 第 123 行）。
- 路由失败兜底："A large or cross-cutting effort… or work the user steps away from to trust later, routes to the **figure-it-out** skill… It designs a bespoke, rigorous playbook for the task."（第 125 行）项目级常驻程序走 **Orchestrate**。
- 会话内切换：说 "new task" 让 poteto-mode 重新匹配而不是续跑上一 playbook（`docs/guide/02-poteto-mode.md` "Switch tasks with 'new task'"）。
- 步骤内再路由：SKILL.md "Non-negotiables / Remaining triggers" 节约 20 条 `情境 → skill` 规则（如 "Code crossing a function boundary → the **architect** skill"；""before review → the **no-comments** skill"）。技能之间互相按名字点名，形成文件路径路由网。
- 持久化：`/poteto-mode` 可用 Cursor 的 Custom Mode（菜单里 alt/option+enter）每轮保持在 context；`docs/guide/02` 称 "Short works because the playbook holds the structure, and a Custom Mode keeps `/poteto-mode` in context on every turn."
- 自定义模式：`/automate-me` 挖掘用户最近 transcript（分片并行子代理、跨片 ≥2 次才算模式），用 create-skill 起草 `<handle>-mode` 个人路由 skill（`skills/automate-me/SKILL.md`）。

### 3.2 playbook 本体形态（以 bug-fix 为例）

`playbooks/bug-fix.md` 仅 15 行：开头一句角色宣言（"You own this task. Plan, review, verify."），随后编号步骤：1 亲自在匹配 surface 复现（control skill）→ 2 二分定位（how + why 喂假设，runtime 证据逐个淘汰）→ 3 跨函数边界先 architect，按配置模型委托实现 → 4 同一 surface 验证（"Inconclusive" 不算过）→ 5 失败 repro 先入 git 历史再上修复 → 6 跑 Opening a PR playbook。结尾 "**Reply:**" 行规定回复骨架。23 个 playbook 同构。

### 3.3 规模口径核对

- **23 playbooks**：README 明确 "twenty-three playbooks"，实测 `skills/poteto-mode/playbooks/` 目录 23 个 `.md` 文件，README 表 23 行，一一对应。✅
- **"50 skills"**：视频口径 "a free plugin for Cursor with 50 skills"。实测 `skills/` 下 **55 个 skill 目录**（31 个常规 + 24 个 `principle-*` 单原则叶 skill），另有 `automations/benny/skills/` 3 个未注册为 slash skill 的休眠自动化技能。"50" 为约数；视频也称 "About half the skills are single rules"（24/55 ≈ 一半）。README "all skills" 表列 31 个常规 skill。

### 3.4 子代理与多模型

- `agents/poteto-agent.md`：委托子代理 `subagent_type: "poteto-agent"`，干活前必须**全文读 poteto-mode SKILL.md（含内联 Principles 索引）**；换 `generalPurpose` 会跳过该读而漂移。主会话保留 playbook/todo/所有 Task 调度的所有权。
- 模型分配由 `/setup-pstack` 写入规则文件 `pstack-models.mdc`（Claude Code 下落 `~/.claude/rules/pstack-models.md`），按角色行读取；默认 code→`grok-4.7-xhigh-fast`、judgment/prose→`claude-opus-5-5-xhigh`；fast/standard 按紧急度、reasoning 档位按难度±1 级调节（SKILL.md "Subagents" 节）。
- 多模型对抗：`/interrogate` 为每个配置模型各起一个 reviewer（默认 Opus+Grok 两家），"The adversarial signal comes from model diversity, not assigned personas"，lead 把发现归并到 Act on / Consider / Noted / Dismissed 四桶（`skills/interrogate/SKILL.md`）。`arena` 做同题并行设计；`architect` Phase B 强制 "at least two structurally distinct candidates"，红旗清单先筛后综合（`skills/architect/SKILL.md`）。视频佐证："Two agents design the fix in separate copies of the repo… A judge from a different AI lab scores them"；"three models try to break it"。
- 夜班验证小队：autopilot-full 每 PR 一个 owner 代理从 build 带到 merge，"no owner merges on its own verdict"，fresh verifier swarm 验 code-ready head；autopilot-stack 交付一条线性栈让人落地（`docs/guide/07-overnight.md`、对应 playbook）。晨审靠 `/show-me-your-work` 的 `decisions.tsv` 决策流水 + 不同模型家族的 reviewer 预读。

---

## 4. 许可证与 AGPL-3.0 兼容性

- `pstack/LICENSE`：**MIT License，Copyright (c) 2026 Lauren Tan**。`plugin.json` 与 `.cursor-plugin/plugin.json` 均 `"license": "MIT"`；README 末尾 "## license — MIT"。<https://github.com/cursor/plugins/blob/main/pstack/LICENSE>
- `cursor/plugins` 仓库根目录**无 LICENSE**（`git ls-tree HEAD` 无 license/copying 条目），全仓库仅 `pstack/LICENSE` 一份；即 pstack 以自带 MIT 文本分发。
- 兼容性判断：MIT 是宽容许可证，允许 use/copy/modify/merge/publish/distribute/**sublicense**，唯一义务是 "The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software."。把 MIT 文件原样收进 AGPL-3.0 项目属常规操作：整体作品按 AGPL-3.0 发布，被收录文件本身仍带 MIT 声明即可，**不存在 copyleft 冲突**（AGPL 只约束整体与衍生；MIT 不阻止再授权）。
- 结论：**可以原样 vendor**。落地要求：保留 `LICENSE` 原文与版权头（建议在 vendor 目录放 `LICENSE` 副本 + README 注明出处与上游 commit `8838150`/版本 `0.15.27`）；改动部分亦建议注明。注意 pstack 文本大量硬编码 Cursor/Claude Code 设施名（`/loop`、`Task` 工具、`subagent_type`、`.cursor/`、`agent-transcripts/`、`pstack-models.mdc`、`bugbot`、cursor-team-kit 的 `/deslop`、control-cli/control-ui），**verbatim vendor 后在非 Cursor 平台上有大片死引用**——更适合"移植机制"而非"原样照搬"。
- 作者态度佐证：README "fork it. improve it. make it yours. PRs are welcome!"

---

## 5. 与 omtre 现有能力的重叠与空白

对照文件：`omtre/.agents/skills/trellis-break-loop/SKILL.md`、`Laber/tools/mp-trellis-pack/skills/{rules-audit,hygiene-sweep,trellis-run}/SKILL.md`、`omtre/.trellis/workflow.md`、`Laber/.trellis/domains/DISCIPLINE.md` §4（三档自主度）。

### 5.1 逐项对照

| pstack 能力 | omtre 最近邻 | 重叠 | 关键差异 |
|---|---|---|---|
| `/correct` 历史挖掘 + 阶梯修复 + 红测证明 + 规则表 | `trellis-break-loop`（修完 bug 后 5 维分析：根因类目/为何修失败/预防机制/系统外推/知识沉淀） | 目标同族："让这类 bug 不再发生"；预防机制菜单同样含 architecture/compile-time/runtime/test/docs/review | break-loop 是**单 bug 事后分析**，不读 commits/reverts/review 历史找"犯两次"的类；预防机制是**平铺菜单无优先级**；产出落到 `.trellis/spec/guides/` 思维指南＝阶梯第 4 档（文档），无"先架构后文档"强制、无"新检查须对历史错误跑红"、无规则↔执行者配对表 |
| 指令瘦身（encode-lessons-in-structure、A/B 删 34 条、规则表删行） | `rules-audit`（对 AGENTS.md/CLAUDE.md 逐条取证 keep/prune/annotate，证据三选一：命令存在/路径存在/约定仍活跃） | 都是"规则文件对账现实" | rules-audit 只做**减法**（清沉淀），不做"规则↔执行者"配对、不从纠正历史新增规则；pstack 侧删指令的判据是"能编码成 lint/check/script 就删"，rules-audit 的判据是"无证据则 prune"，互补可拼接 |
| 架构档的"删旧路、删 agent 会照抄的死代码" | `hygiene-sweep`（scope 前缀内只读盘点 dead code/重复逻辑/超大文件→findings list→另开 cleanup 票按 simplify 纪律执行） | 都是先盘点再批准的删除流 | hygiene-sweep 按范围盘点存量，不追"哪类错误在复制"；/correct 按错误类反推要删的样板 |
| autopilot-full/-stack、babysit、shipping、orchestrate、overnight loop | `trellis run` frontier runner + DISCIPLINE §4 三档（`gated`/`hands-off`/`supervised-delivery`） | 都是"队列→隔离 worktree→验证→停在可评审 PR→人 merge"；都有硬性停止线 | omtre 的门是**机械的**：`delivery.auto_push_refs` 白名单、`task.py delivery-gate` 对默认分支/tag/release/部署/生产迁移/外部写入机械拒绝、always-stop 清单三档通拦、PR≠交付写死；pstack 的门是**提示词级**（Autonomy 节 "Always pause for irreversible writes"），验证靠 swarm verifier。pstack 有 per-PR owner + 验证小队 + orchestrate 常驻协调员；omtre 有工单 ledger、blocked_by frontier、triage=ready-for-human 升级线 |
| `/poteto-mode` 意图→playbook 路由 | `workflow.md` 阶段状态机 + 每轮 breadcrumb 钩子注入 + "Active Task Routing" 表（repeated debugging → trellis-break-loop 等）+ `implement.jsonl`/`check.jsonl` 子代理上下文清单 | 都解决"这个任务走哪条流程" | omtre 路由是**确定性状态机**（planning→in_progress，由 `task.py` 状态 + hook 注入驱动），pstack 是**意图分类**（一段自然语言对上 23 playbook 之一）。omtre 没有 playbook 步骤库、没有"verbatim 步骤进 todo"、没有 figure-it-out 兜底设计器 |
| interrogate/arena/architect 多模型对抗与双案设计 | 无（`trellis-check` 是单子代理标准检查；Laber 有 Devin 双轴 check：standards/spec 两 worker 并行，但都同族标准审查非异模型对抗） | 局部形似 | omtre 无"每个配置模型一个 reviewer + 四桶裁决"、无"≥2 结构不同方案 + 异厂裁判打分"的 arena 机制 |
| create-verification-skill / maintain-verification-skill（feature map + 项目本地 verify skill） | `trellis-check` + 各票 verification contract（`add-verify`） | 都要"可复跑的验证" | omtre 的验证是每票命令契约，pstack 生成的是带 feature map 的项目级 verify 技能 + 源波/实跑一次维护流 |
| show-me-your-work `decisions.tsv` | `.trellis/workspace/` journal + worklog + run ledger `.trellis/.runtime/runs/*.jsonl` | 都要求事后可审 | omtre 侧 ledger 定位是 runtime trace"永不对账源"；pstack 的 decisions.tsv 是给晨审的逐决策证据行，并配异族 reviewer 预读 |
| `/why`（多源证据根因挖掘：git/issue/文档/聊天/可观测/错误追踪/数仓） | `trellis-break-loop` 的根因分类 + journal/mem | 部分形似 | pstack `/why` 是并行多源 MCP 取证管线，omtre 靠单会话推理 |
| `/reflect`（transcript→学习项→skill 编辑路由，含"能结构化就降级到 Backlog"关卡） | workflow Phase 3.3 `trellis-update-spec`（把知识写回 spec） | 都是"事后沉淀" | reflect 产出是**对现有 skill 文件的定向编辑**并过结构化关卡；update-spec 写回的是编码指南 spec |
| `/unslop` 反 AI 腔 + 回复写作纪律 | `.trellis/spec/agents/voice.md`（STC 中文/ASD-STE100） | 都管文风 | voice.md 是规范文档；unslop 是可执行 skill 且 poteto-mode 把"任何散文面含回复本身"都路由进去 |
| `/recall`（chat 历史重建上下文） | `trellis mem`（可选补充源） | 功能同类 | DISCIPLINE 明确 mem 不得替代读档链、不得当事实源；recall 是常规入口 |
| benny 自动化包（Slack 报告 triage→复现→修复） | `.scratch/inbox/` + `/triage` → `ready-for-agent` 上票 | 都有"外部来件→分诊→成票" | benny 是事件驱动无人值守自动化（Cursor-only）；omtre inbox 是人工/agent 分诊 |

### 5.2 omtre 有而 pstack 没有

- 持久化工单/板块系统：`task.json`+`blocked_by` frontier+归档、triage 五标签、domain/NN-*/BOUNDARY/worklog 文档链（pstack 完全无任务管理层，靠 Cursor Projects/PR 状态）。
- spec 注入体系：`.trellis/spec/<package>/<layer>/` 按层注入 + workflow-state breadcrumb 钩子（pstack 的"注入"是读文件式路由）。
- 机械交付门：ref 白名单、always-stop、`delivery-gate` 拒绝即落账（pstack 全部靠提示词自律 + Always-pause 清单）。
- 多平台：workflow.md 列 ~20 个平台的 dispatch 协议；pstack 仅 Cursor + Claude Code 适配器。
- 接手协议/对账裁决（git 历史 > worklog > 进度）写死；pstack 用 session-pickup playbook 文本约定。

### 5.3 结论性判断

- **直接可搬（MIT 允许 verbatim vendor）**：`skills/correct/SKILL.md` 全文仅 32 行、无 Cursor 私有依赖（只要求读 commits/reverts/review comments/agent instruction files），是移植成本最低、价值最高的一件；`design-red-flags.md` 与 `principle-*` 系列同为纯文本。
- **搬思想而非搬文件**：playbook 路由（Cursor Skill/Task/`subagent_type`/`pstack-models.mdc` 深度耦合）与 autopilot/orchestrate（依赖 `/loop`、cloud subagent、Cursor Project）应重写为 omtre 语义——omtre 已有更强的等价骨架（frontier runner + 三档机械门），缺的是**意图→playbook 的步骤库**和**per-PR 验证小队**两层。
- **结构性差异**：omtre 的优势在"机械门 + 工单账本"（pstack 靠自律），pstack 的优势在"错误→结构的强制转换管线"（omtre 的同类产出停在文档档）。两者互补方向明确：把 `/correct` 的"挖矿—分级—红测—配对表"接进 `trellis-break-loop`/`rules-audit`，把 omtre 的 mechanical gate 思想反补到移植后的 autopilot。

---

## 附：关键原文摘录索引

| 断言 | 出处 |
|---|---|
| "A class counts once it has happened twice." | `skills/correct/SKILL.md` L15 |
| "Prove each new check fails on a real past mistake." | `skills/correct/SKILL.md` L26 |
| "keep a table in the agent instruction file that pairs each rule with what enforces it" | `skills/correct/SKILL.md` L30 |
| "Write docs or agent rules last, only for judgment calls. Nothing fails when an agent skips them." | `skills/correct/SKILL.md` L22 |
| "in order of value: 1. categorically eliminate… 4. have humans review the code to catch it (ngmi)" | X 帖 2089067865098113024（2026-08-16） |
| "pstack 0.15.9 now ships a new /correct skill" | X 帖 2106542593656111276（2026-10-04） |
| "caught 142 of 154 planted problems without those lines, and 139 with them" | YouTube 字幕 |
| "Copy its steps in verbatim" / `skip: <reason>` | `skills/poteto-mode/SKILL.md` L123 |
| "no owner merges on its own verdict" | `docs/guide/07-overnight.md` L76 |
| "PR ≠ 交付" | `Laber/.trellis/domains/DISCIPLINE.md` §4 L72 |
