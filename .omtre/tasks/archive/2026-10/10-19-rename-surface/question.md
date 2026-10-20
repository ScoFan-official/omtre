# 改名面盘点：.omtre 及 trellis 品牌在代码、模板、技能中的全部出现

Type: research
Status: resolved
Blocked by: None
Map: .omtre/tasks/10-19-omtre-standalone/map.md

## Question

硬分叉要把 `.omtre/` 改成 `.omtre/`、命令 `trellis` 改成 `omtre`。改名规则票需要事实输入：改名面有多大、分成哪几类。

在本仓（`packages/cli`、`packages/core`、`marketplace`、`.agents`、各平台模板、Python 脚本、测试夹具、文档）里盘点以下几类出现，每类给出文件数、出现次数和代表性样例：

- `.omtre` 路径字面量（已知 `packages/` 里约 324 个文件、2785 处）；
- `OMTRE_*` 环境变量；
- `OMTRE:START` / `OMTRE:END` 等受管块标记；
- `omtre-*` 技能名、命令名、斜杠命令（`/omt:*`）；
- 命令名 `trellis` / `tl` / `omtre`；
- 配置文件名和键（`config.yaml`、`.template-hashes.json`、`.version` 等）；
- 必须保留的出现（AGPL 版权声明、上游出处）。

再回答：路径是否已有集中常量；哪些类别可以收拢成单一常量，哪些只能靠 codemod 批量改写。

解决标准：answer.md 给出分类表和每类的收拢建议。不做任何改名。
