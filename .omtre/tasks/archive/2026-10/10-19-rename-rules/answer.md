# 改名规则：答案

用户 2026-10-19 全部按推荐确认。事实输入见 `10-19-rename-surface` 的 answer.md。

## 规则

| 类别 | 旧 | 新 | 说明 |
|---|---|---|---|
| 项目根目录 | `.omtre/` | `.omtre/` | 只改根目录名 |
| 用户主目录根 | `~/.omtre/` | `~/.omtre/` | channel store 等（`packages/core/src/channel/internal/store/paths.ts`） |
| 内部子目录 | `tasks`、`spec`、`workspace`、`domains`、`agents`、`scripts` 等 | 原样保留 | 与脚本、任务合约、文档咬合，改名无收益 |
| 环境变量 | `OMTRE_*` | `OMTRE_*` | 全部改，无过渡期，代码不双读；残留由 `omtre migrate` 改写 |
| 受管块标记 | `OMTRE:START` / `OMTRE:END` | `OMTRE:START` / `OMTRE:END` | 收进已有常量 `OMTRE_BLOCK_START/END`（同步改名） |
| 其它标记 | `OMTRE:COPILOT-GUIDANCE`、`omtre-hook-injected`、`omtre-emitted` | `OMTRE:COPILOT-GUIDANCE`、`omtre-hook-injected`、`omtre-emitted` | 全部收进常量 |
| 技能、agent 前缀 | `omtre-*` | `omtre-*` | 承重点（如 `removeprefix("omtre-")`）同步改 |
| 斜杠命令 | `/omt:*` | `/omt:*` | 与简写 `omt` 一致；各平台 configurator 的子目录 `trellis/` 改 `omt/` |
| 命令名 | `trellis`、`tl`、`omtre` | `omtre`、`omt` | 不保留任何旧别名 |
| 子命令 | `mem`、`channel`、`run` 等 | 原样保留 | 本身不含 trellis 字样 |

## 保留原名

- `COPYRIGHT`（Mindfold LLC）、`LICENSE`（AGPL-3.0）。
- `mindfold-ai` 出处链接、`docs/fork-sync.md`。
- `marketplace`、`docs-site` 两个 gitlink 子模块的内部内容不在本仓改名范围；子模块指向何处由 `10-19-repo-assembly` 处理。

## 给后续票的输入

- 集中常量已存在但覆盖不全（TS `DIR_NAMES.WORKFLOW` 约 13 个文件在用，约 116 行裸字面量；Python `DIR_WORKFLOW` 在约 10 个自包含脚本里各自复制）。改名实施宜先收拢常量，再改常量值，最后 codemod 余下字面量。
- `migrate-contract` 需覆盖：根目录搬迁、`~/.omtre/`、`OMTRE_*` 环境变量引用、受管块标记、`omtre-*` 技能目录和 `/omt:*` 命令文件在各平台的改写。
