# omtre

<!-- omtre:upstream-attribution:start -->
omtre 是一个独立的 agent workflow harness，源自 [Trellis](https://github.com/mindfold-ai/Trellis) 的二次开发。
<!-- omtre:upstream-attribution:end -->

它使用自己的 `.omtre/` 目录、CLI（`omtre` / `omt`）、版本线与发布节奏演进。

## 框架身份

**omtre**:
独立的 agent workflow harness，基于上游项目的二次开发。它有自己的代码库、CLI、规范目录与设计原则；不是上游的插件、扩展或包装层。
_Avoid_: 上游插件、上游扩展、旧发行版

**上游（upstream）**:
omtre 的来源项目。它作为可选的同步输入存在，不定义 omtre 的产品身份、版本号或路线图。
_Avoid_: 把上游版本号当作 omtre 版本号

**吸收（absorption）**:
把外部框架的一项优点评估后改写为 omtre 原生能力（CLI 动词、闸门、规范或技能）并留出处的过程；原样拷贝外部文件是它的例外形态。
_Avoid_: 集成、vendor、移植（移植专指把 omtre 自身能力搬到别的仓库）

**独立版本线（independent version line）**:
omtre 自己的语义化版本序列。首个独立版本是 `1.0.0`；发布 tag 形如 `cli-v1.0.0`。`cli-` 前缀标识发布通道，数字属于 omtre。
_Avoid_: 用上游版本号给 omtre 发版
