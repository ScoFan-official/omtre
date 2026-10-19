# 答复：pstack 调研（/correct、修正阶梯、路由、许可证、对照）

详证见同目录 `research.md`。源码基于 `cursor/plugins@main` `pstack/`（commit `8838150`，版本 `0.15.27`）。

## 1. `/correct` 工作流

原文仅 32 行：[skills/correct/SKILL.md](https://github.com/cursor/plugins/blob/main/pstack/skills/correct/SKILL.md)。

- **输入**：近期 commits、reverts、评审评论、agent 指令文件、解释 workaround 的注释。
- **归类**：同一错误出现 ≥2 次才算一类（"A class counts once it has happened twice"）。
- **处理**：每类按"最高可行层级"修——架构 → 类型 → lint/CI → 测试 → 文档最后。
- **产出**：最高频的类当场修，一类一 commit；新检查必须在真实历史错误上跑红；例外放行须带原因+到期日+真人批准。
- **落点**：结构性修复进代码/CI；同时在 agent 指令文件里维护一张"规则↔执行者"配对表；规则在表但无执行者即复发，本次改动内升级到最高层级；错误绝迹则删行。
- **回复格式**：每类给出证据、所选层级、更高一层为何不行。

## 2. 修正阶梯各档落地形态

权威表述两份：poteto 2026-08-16 [原帖](https://x.com/poteto/status/2089067865098113024)（架构 > lint/测试 > skill/规则 > 人审 NGMI）与 `correct/SKILL.md` 执行版（架构 > 类型 > lint/CI > 测试 > 文档最后）。落地物：

| 档 | 仓库内形态 |
|---|---|
| 架构 | 状态单属主、一事一路、内部不可 import、单一事实源、删旧路与死代码；判据清单 [design-red-flags.md](https://github.com/cursor/plugins/blob/main/pstack/skills/architect/references/design-red-flags.md) |
| 类型 | 非法态不可表示、brand 原语、边界 parse、穷尽 variant |
| lint/CI | 报错点名替代方案；已泛滥模式只拦增量（ratchet）；本地+CI 同一命令 |
| 测试 | 只断言可观察行为；失效测试修或删；失败 repro 先入 git 历史 |
| 文档/规则 | 只管判断题，进"规则↔执行者"表；跳过不会失败 |
| 人审 | 不在落地档内（NGMI）；仅存于例外审批与操作者晨审 |

底层原则：[encode-lessons-in-structure](https://github.com/cursor/plugins/blob/main/pstack/skills/principle-encode-lessons-in-structure/SKILL.md)——能编码成 lint/check/script 的教训不许以文本规则存在（"The instruction is the symptom"）。视频佐证：删 34 条指令后评审技能反多抓 3/154 个植入问题（142 vs 139）。

## 3. playbook 路由

- 入口 = `/poteto-mode`，纯提示词路由：[SKILL.md](https://github.com/cursor/plugins/blob/main/pstack/skills/poteto-mode/SKILL.md) 内一张"任务→playbook"一句话触发表，模型语义匹配后打开 `playbooks/<kebab>.md` 把步骤**逐字**抄进 todo；跳过步骤留 `skip:` 行。
- 兜底：无匹配或大型任务 → `figure-it-out` 现造 playbook；常驻程序 → `orchestrate`。
- 步骤内再按 ~20 条"情境→skill"触发规则点名单个 skill 文件（相对路径引用，无注册表）；全部 skill `disable-model-invocation: true`，只经 `/cmd` 或被点名触发。
- **实测 23 个 playbook 文件、55 个 skill 目录**（31 常规 + 24 `principle-*`）；"50 skills" 是约数。
- 子代理 `poteto-agent` 开工前必读 poteto-mode 全文；模型按 `pstack-models.mdc` 角色行分配（默认 Grok 写码、Opus 裁决）；`interrogate` 每模型一 reviewer 四桶裁决，`architect` 强制 ≥2 个结构异构方案+异厂裁判。
- omtre 对照：我们有状态机 breadcrumb 路由 + 子代理分派，没有"意图→步骤库"的 playbook 层。

## 4. 许可证

- `pstack/LICENSE` = **MIT，Copyright (c) 2026 Lauren Tan**；`plugin.json` 与 README 同。仓库根无 LICENSE，pstack 目录自带。[LICENSE](https://github.com/cursor/plugins/blob/main/pstack/LICENSE)
- **可以原样 vendor 进 AGPL-3.0**。MIT 允许 sublicense，与 AGPL 无冲突；义务只是保留版权与许可声明。做法：vendor 目录带 LICENSE 副本 + 注明上游版本 `0.15.27`。
- 注意：多数 skill 硬编码 Cursor 设施（`/loop`、`Task`、`subagent_type`、`.cursor/`、`pstack-models.mdc`、cursor-team-kit），verbatim 照搬会产生死引用。**`/correct` 本身是 32 行纯文本、零 Cursor 依赖，是最佳的 verbatim 候选**；路由/夜班类应移植机制而非搬文件。

## 5. 重叠与空白（vs omtre）

| pstack | omtre 最近邻 | 判定 |
|---|---|---|
| `/correct` 挖矿+阶梯+红测+规则表 | `trellis-break-loop` | 形似神不同：break-loop 单 bug 事后分析、产出停在文档档、无优先级/红测/配对表 |
| 指令瘦身/规则表删行 | `rules-audit` | 互补：rules-audit 只会做减法清沉淀，不建"规则↔执行者"配对 |
| 删旧路/死代码 | `hygiene-sweep` | 互补：hygiene 按 scope 盘点存量，correct 按错误类反推 |
| autopilot/orchestrate/夜班 | `trellis run` + 三档门（`gated`/`hands-off`/`supervised-delivery`） | 同构且我们更硬：机械白名单+always-stop+delivery-gate；缺 per-PR 验证小队与常驻协调 |
| `/poteto-mode` 意图路由+23 playbook | `workflow.md` 状态机+主动任务路由表 | 空白：无步骤库、无 figure-it-out 兜底 |
| `interrogate`/`arena`/`architect` 多模型对抗 | 无（`trellis-check` 单轴/双轴同族审查） | 空白 |
| `create-verification-skill`（feature map verify 技能） | `add-verify` 命令契约 | 空白：缺项目级 verify 技能生成器 |
| `/reflect` 学习→skill 编辑路由 | `trellis-update-spec` Phase 3.3 | 部分重叠：reflect 改的是 skill 本体且带结构化关卡 |
| `show-me-your-work` 决策 TSV | journal/worklog/run ledger | 部分重叠：我们有账但无"异族 reviewer 预读"晨审流 |

**建议优先级**：① verbatim 移植 `correct/SKILL.md` + `design-red-flags.md`，接进 `trellis-break-loop` 收尾（挖矿→分级→红测→配对表落 `AGENTS.md`）；② 给 `rules-audit` 加"规则↔执行者"配对表与"能编码成检查则删规则"判据；③ playbook 机制按 omtre 语义重实现（意图→步骤清单），不照搬 Cursor 绑定部分。
