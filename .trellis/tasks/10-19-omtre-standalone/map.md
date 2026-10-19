# omtre 独立框架

## Destination

omtre 首版可从 GitHub Release（`ScoFan-official/omtre`）安装：`.omtre/` 目录与 `omtre` 命令在全平台可用；`omtre migrate` 已把 omtre 仓自己从 `.trellis/` 迁到 `.omtre/`（自举）；吸收机制已定版，pstack `/correct` 与 Firefox 提示词放置原则两个试点已落地。

## Notes

- **本图带施工**：推翻 wayfinder 默认的“只规划”，地图一直推进到首版可发布。决策票之后，按决策拆出施工票挂在本图下。
- **硬分叉**：从 trellis-fork 完整历史起步，切断 mindfold 上游。许可证继承 AGPL-3.0，保留 Mindfold LLC 版权声明。原样拷贝外部代码前，必须先确认许可证与 AGPL-3.0 兼容。
- **单仓**：CLI（`packages/`）与技能包（skills、marketplace、catalog）合在本仓。旧仓 `ScoFan-official/trellis`、`ScoFan-official/oh-my-trellis` 进入维护期，只修阻断性问题。
- **已定命名**：命令 `omtre`（简写 `omt`），不保留 `trellis` 别名；npm 包名 `omtre`；发布走 GitHub Release tgz，不发公开 npm。全平台保留。
- **迁移**：一次性动词 `omtre migrate`，不做 `.trellis/` 与 `.omtre/` 并行读取。
- **吸收**：外部框架的优点以改写为原生能力为主（CLI 动词、闸门、规范、技能），原样拷贝是例外。
- **过渡期追踪**：`.omtre/` 就绪前，本图住在本仓 `.trellis/tasks/`，遵循 Trellis 任务追踪约定（`question.md` / `answer.md`、`blocked_by` meta、`task.py frontier`）。
- **会话纪律**：每个会话只解决一张票（research 票除外）。解题时调用 grilling + domain-modeling；research 票调用 research；写技能和提示词文本时调用 writing-for-agents；中文文本遵循 voice.md 的 STC 规范。
- **参考输入**：B 站 BV1nVpy6QEMx（pstack）、BV1Wrp76mEsW（Firefox 提示词放置原则）。两个视频无字幕，原文在对应 research 票里取。

## Decisions so far

<!-- 每张已关闭票一行：[<票名>](<child-dir>): 一句话要点 -->

- [改名面盘点](10-19-rename-surface): `.trellis` 全仓 10,107 处 / 1,405 文件，含 `~/.trellis/` 第二个根；`TRELLIS_*` 约 39 个变量；`trellis-*` 前缀承重；集中常量存在但覆盖不全；`marketplace`、`docs-site` 是指向 mindfold-ai 的 gitlink。
- [pstack 调研](10-19-pstack-research): `/correct` 为 ≥2 次同类错误按阶梯取最高档修复、新检查须在历史错误上跑红；23 个 playbook 纯提示词路由；MIT 许可，可兼容 AGPL 原样拷贝，但多数文件绑定 Cursor API；omtre 缺 `/correct` 等价物与 playbook 层。
- [Firefox 原则调研](10-19-firefox-prompt-research): 根 `AGENTS.md` 73 行、5 个模块级 `AGENTS.md`、24 个技能、`review-context.toml` 按路径注入；omtre 已覆盖 Pointers/Lazy，缺按路径触发注入和规则文件定期复审。
- [改名规则](10-19-rename-rules): 只改根目录（`.omtre/`、`~/.omtre/`）；`TRELLIS_*`→`OMTRE_*` 无过渡；标记→`OMTRE:*`；前缀→`omtre-*`；斜杠命令→`/omt:*`；子命令与内部子目录不变；保留版权、许可证与出处。
- [新仓库组装](10-19-repo-assembly): 技能包带历史并入根目录；marketplace 由子模块改成带历史的目录，docs-site 删除；`ScoFan-official/omtre` 公开仓已推送 main `713509c9`；发布流水线和 `TEMPLATE_INDEX_URL` 留给后续票。
- [migrate 合约](10-19-migrate-contract): 受管文件重新生成（改过的留 `.backup`），用户数据整搬并改写路径，运行时缓存丢弃；仓库外文件只报告不改；工作区须干净；迁到一半拒绝执行；回滚只靠 git；`~/.trellis/channels` 不迁；结束时自检 4 项。
- [吸收机制](10-19-absorption-mechanism): 每个候选开 research 票（挂在"吸收"父任务下），按 5 条标准判为原样拷贝、改写吸收或拒绝；落地形态按修正阶梯取最高可行档；原样拷贝先过许可证闸并由 CI 检查；出处统一登记在 `ATTRIBUTION.md`；流程做成技能 `skills/absorb/`，检查写成脚本；改写吸收的不跟踪上游。
- [/correct 落地](10-19-correct-landing): 改写成原生技能 `omtre-correct`（`/omt:correct`），另加一个配对表检查脚本接入 CI；读 git fix/revert、check 结论、mem 纠正对话、PR 评审、注释；配对表放在 `.omtre/spec/rules.md`，按需加载；新检查要在历史出错提交上跑红；与 break-loop、rules-audit 并存分工；手动或用户纠正时触发；按三档自主权限执行，默认 gated。
- [Firefox 原则落地](10-19-firefox-landing): 新增 `.omtre/spec/context-rules.yaml`，按改动路径给 check 和 implement 加载上下文，配 lint；子目录 AGENTS.md 只定作用域约定，由 update 生成路由表；指令文件 lint 检查 4 项：根文件不超过 150 行（ratchet）、description 不超过 500 字符且写明触发条件、引用路径存在、子目录文件首行写作用域；改动指令文件时自动把 writing-for-agents 和 voice 加载进 check；受管块加"工具优先"段和路由表；session-start 不改；Firefox 的许可证是 MPL-2.0，只吸收思想。

## Tickets

| 票 | 标题 | 类型 | `blocked_by` | 状态 |
|---|---|---|---|---|
| [10-19-rename-constants-and-pkg](../archive/2026-10/10-19-rename-constants-and-pkg) | 改名施工 1：集中常量、包名与二进制入口收拢 | task | — | done |
| [10-19-rename-ts-core-and-cli](../archive/2026-10/10-19-rename-ts-core-and-cli) | 改名施工 2：TS 核心库与 CLI 命令、工具层改名 | task | `10-19-rename-constants-and-pkg` | done |
| [10-19-rename-python-runtime-scripts](../archive/2026-10/10-19-rename-python-runtime-scripts) | 改名施工 3：Python 工作流脚本与核心骨架模板改名 | task | `10-19-rename-constants-and-pkg` | done |
| [10-19-rename-templates-common-and-hooks](../archive/2026-10/10-19-rename-templates-common-and-hooks) | 改名施工 4：公共命令/技能模板（common）与 shared-hooks 改名 | task | `10-19-rename-constants-and-pkg` | done |
| [10-19-rename-configurators-and-platforms](../archive/2026-10/10-19-rename-configurators-and-platforms) | 改名施工 5：全平台 Configurators 与 20 个平台专属模板改名 | task | `10-19-rename-constants-and-pkg`, `10-19-rename-python-runtime-scripts`, `10-19-rename-templates-common-and-hooks` | done |
| [10-19-rename-test-suite-and-regression](../archive/2026-10/10-19-rename-test-suite-and-regression) | 改名施工 6：测试套件收尾与 regression.test.ts 迁移 | task | `10-19-rename-ts-core-and-cli`, `10-19-rename-python-runtime-scripts`, `10-19-rename-templates-common-and-hooks`, `10-19-rename-configurators-and-platforms` | done |
| [10-19-rename-skills-marketplace-docs](../archive/2026-10/10-19-rename-skills-marketplace-docs) | 改名施工 7：技能包（skills/）、marketplace/、CI 与文档改名 | task | `10-19-rename-constants-and-pkg` | done |
| [10-19-rename-residual-gate](../archive/2026-10/10-19-rename-residual-gate) | 改名施工 8：全仓旧名残留检查脚本与 CI 门禁 | task | `10-19-rename-test-suite-and-regression`, `10-19-rename-skills-marketplace-docs` | done |
| [10-20-migrate-command](../10-20-migrate-command) | 迁移施工 1：实现 omtre migrate 命令与测试 | task | `10-19-rename-residual-gate` | ready |
| [10-20-self-bootstrap](../10-20-self-bootstrap) | 迁移施工 2：执行本仓 .trellis → .omtre/ 自举与门禁收口 | task | `10-20-migrate-command` | blocked |

## Not yet specified

- 发布流水线：本仓 CI、tag 方案、tgz 资产、一句话安装提示词改写。
- 后续施工票拆分：两个试点实施（`/correct` 与 Firefox 原则）。
- 硬分叉后是否、以及怎样从 mindfold 上游手工挑提交移植。
- fork 继承的上游旧任务（06-17、07-23、08-05、08-06、09-09 等）怎么处理。
- 品牌改写：README、GLOSSARY（Laber 中“oh-my-trellis 是叠在 Trellis 之上的中间件”这条定义废止）、AGENTS.md 受管块文本。

## Out of scope

- 已有消费仓（Laber、Rakazo）的迁移：本图只做好 omtre 本身。
- 吸收 pstack 与 Firefox 以外的框架：吸收机制定版后另开地图。
- 发布到公开 npm。
- 冻结旧仓：本图只做到维护期开始。
