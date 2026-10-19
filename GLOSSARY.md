# omtre

omtre 是从 Trellis 硬分叉出来的独立 Agent 协作框架：用自己的 `.omtre/` 目录承载任务、规范与闸门，并持续吸收其它框架的优点。

## 框架身份

**omtre**:
独立的 Agent 协作框架，由 oh-my-trellis 硬分叉而来，不再跟随上游 Trellis。
_Avoid_: oh-my-trellis（旧名，仅指硬分叉前叠在 Trellis 之上的那一层）、Trellis 插件、Trellis 扩展

**吸收（absorption）**:
把外部框架的一项优点评估后改写为 omtre 原生能力（CLI 动词、闸门、规范或技能）并留出处的过程；原样拷贝外部文件是它的例外形态。
_Avoid_: 集成、vendor、移植（移植专指把 omtre 自身能力搬到别的仓库）
