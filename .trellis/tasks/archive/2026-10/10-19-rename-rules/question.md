# 改名规则：目录、环境变量、受管块标记、技能前缀与子命令怎么改

Type: grilling
Status: resolved
Blocked by: .trellis/tasks/10-19-rename-surface
Map: .trellis/tasks/10-19-omtre-standalone/map.md

## Question

基于改名面盘点，和用户逐类定下改名规则：

- 目录：`.trellis/` 改成 `.omtre/`，内部子目录（tasks、spec、workspace、domains、agents、scripts）是否原样保留；
- 环境变量：`TRELLIS_*` 是否全部改成 `OMTRE_*`，有无过渡期；
- 受管块标记：`TRELLIS:START` 的新写法；
- 技能和命令前缀：如 `trellis-check` 改成 `omtre-check`，斜杠命令 `/trellis:*` 的新写法；
- 子命令名（`mem`、`channel`、`run` 等）是否顺带调整；
- 哪些出现必须保留原名（版权声明、出处说明）。

已定前提：硬分叉；命令名 `omtre`（简写 `omt`），不保留 `trellis` 别名；npm 包名 `omtre`；全平台保留。
