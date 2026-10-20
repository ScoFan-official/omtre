# Firefox 提示词放置六原则调研：原文与 omtre 现有规范的差距

Type: research
Status: resolved
Blocked by: None
Map: .omtre/tasks/10-19-omtre-standalone/map.md

## Question

参考视频 BV1Wrp76mEsW 以 Firefox 仓库为例，讲六条原则：Scope > Prompts、Pointers > Prose、Tools > Prompts、Lazy > Always、Triggers > Memory、Prompts rot，另有一节讲什么时候该写。Firefox 根目录的 AGENTS.md 只有 73 行。

查清：
1. Firefox 源码仓库（mozilla-central / gecko-dev）中根目录 AGENTS.md、各模块子 AGENTS.md、`.agents/skills`、`review-context.toml` 的原文结构和关键条目；
2. 六条原则各自的具体做法和例子；
3. 对照 omtre 现有的 `rules-audit` 技能、voice 规范（`spec/agents/voice.md`）、`writing-for-agents` 技能、session-start 注入机制，找出已覆盖、部分覆盖、未覆盖的原则。

解决标准：research 文件和 answer.md 给出原则对照表，每条事实附来源链接。
