# pstack /correct 落地形态：答案

2026-10-19，用户对 7 个问题都选了推荐方案。依据：

- `10-19-pstack-research` 的 answer.md 和 research.md；
- `10-19-absorption-mechanism` 定下的吸收机制；
- 现有技能 `omtre-break-loop`、`skills/rules-audit`。

## 1. 落地形态

- 改写成原生技能 **`omtre-correct`**，作为框架自带技能发到全平台，斜杠命令是 `/omt:correct`。
- 另写一个**配对表检查脚本**，确认每行的执行者存在而且能跑，并报告已经过期的例外。脚本由 CI 调用。
- 不原样拷贝，也不做 CLI 动词：错误归类是判断题，能机械化的部分只有配对表校验。
- 出处登记在 `catalog/ATTRIBUTION.md`"改写来源"一节，来源是 `cursor/plugins` 的 `pstack/skills/correct/SKILL.md`，版本 0.15.27（commit `8838150`），许可证 MIT。

## 2. 读哪些历史

默认范围：最近 30 天，或者最近 200 个提交。可以用参数调整。

1. git log 里标着 fix 的提交和 revert；
2. 已归档任务的 check 结论；
3. `omtre mem` 里用户纠正 agent 的对话；
4. 能用 `gh` 时，读 PR 评审评论；
5. 指令文件、spec，以及解释 workaround 的代码注释。

同一种错出现两次才算一类。

## 3. 配对表

- 放在 `.omtre/spec/rules.md`，从 spec 索引按需加载。AGENTS.md 里只留一行指针，不常驻。
- 每行的列：规则、执行者（路径或命令，没有就写"无，需判断"）、档位、两次出错的证据、加入日期。
- 表里有规则但没有执行者，就算复发，在同一次改动里升到能做到的最高档。错误已经不可能再发生时，删掉这一行。

## 4. 新检查怎么证明有效

- 在临时 worktree 里检出出错时的提交（修复之前的父提交），跑新检查，结果必须是红的。
- 在 HEAD 上跑，结果必须是绿的。
- 把红的那次运行的证据写进 commit message。
- 本地和 CI 跑同一个命令。
- 例外写在出问题的那一行，带原因、到期日和批准人。第 1 节的脚本报告已经过期的例外。

## 5. 和 break-loop、rules-audit 的关系

三者并存，各管一段：

- **break-loop**（改名后叫 `omtre-break-loop`）：修完一个 bug 当场做分析。要改两处：
  - 预防手段改成按修正阶梯排序；
  - 收尾时在配对表里加一行。同一类错如果已经在表里，就算第二次出现，交给 correct 升档。
- **correct**：跨很多次错误挖历史，按类修。
- **rules-audit**：增加两条判据：
  - 能写成检查的规则，删掉文字；
  - 审计配对表：执行者失效的行标出来，错误已经不可能发生的行删掉。

## 6. 什么时候触发

- 手动运行 `/omt:correct`。
- 用户纠正 agent 时触发：技能 description 里写触发短语，比如"又错了""说过多少次""same mistake again"。这时先修，再查配对表；已经在表里的，当场升档。
- 不排定时任务。

## 7. 自主权限

和 `rules-audit` 一样分三档：

- `gated`：只出报告，等用户裁决；
- `hands-off` 和 `supervised-delivery`：直接修，一类一个 commit，但不推送；
- 没有配置档位时，默认 `gated`。

## 给后续票的输入

施工项：

- `omtre-correct` 技能模板，覆盖全平台；
- 配对表检查脚本，接入 CI；
- `.omtre/spec/rules.md` 的模板，以及 spec 索引里的入口；
- `break-loop` 的两处修改；
- `rules-audit` 新增的两条判据；
- 在 ATTRIBUTION.md 登记出处。

这些都依赖改名施工（`omtre-*` 前缀、`/omt:*`、`.omtre/`），要排在改名施工之后。
