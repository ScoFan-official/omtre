# 改名面盘点结论

统计口径：排除 `node_modules/`、`dist/`、`.git/`、`__pycache__/`。
`marketplace/` 与 `docs-site/` 是 gitlink 子模块，本地未检出，内容在上游仓库。
注意 `.trellis` 有两个根：仓库级 `<repo>/.trellis/` 和用户级 `~/.trellis/`（channel 状态存储，`packages/core/src/channel/internal/store/paths.ts:15`），改名时要分开决策。

## 分类表

| 类别 | 出现次数 | 文件数 | 现状 | 建议 |
|---|---:|---:|---|---|
| `.trellis` 路径字面量（仓库级） | 10,107 | 1,405 | TS 有常量 `DIR_NAMES.WORKFLOW`（`packages/cli/src/constants/paths.ts:11`），但仅 ~13 个文件使用，`cli/src` 内仍有 ~116 行裸字面量；Py 有 `DIR_WORKFLOW`（`.trellis/scripts/common/paths.py:28`）但被复制进 ~10 个自足脚本 | 常量收拢 + 补齐迁移；字面量靠 codemod |
| `~/.trellis`（home 状态目录） | 少量 | ~4 | 无常量，`os.homedir()/.trellis` 直写 | 新增独立常量，勿与仓库级混改 |
| `TRELLIS_*` 环境变量 | ~1,040 | 236 | ~39 个真实变量名，仅 3 处导出名常量，其余全是字面量 | codemod 统一改前缀 `TRELLIS_→OMTRE_`；另票定向后兼容别名 |
| `TRELLIS:START/END` 受管块标记 | 40 | ~20 | TS 已有常量 `TRELLIS_BLOCK_START/END`（`utils/managed-paths.ts:6-7`）；copilot 用独立字面量（`templates/copilot/index.ts:23`）；其余在模板正文/`AGENTS.md` 数据里 | 代码侧已收拢；模板与已安装文件正文靠 codemod |
| `trellis-*` 技能/命令/子代理名 | 6,474 | 868 | 无常量。13 个技能目录、`trellis-{implement,check,research}` × ~15 平台、`SKILL.md` 的 `name:` 字段、`removeprefix("trellis-")` 解析 | codemod：改文件名/目录名 + 内容 + ~15 个 configurator 路径模板 |
| `/trellis:*` 斜杠命令 | 525 | 137 | 命名空间由 configurator 字面量生成：`commands/trellis/${n}.md`（claude 系）与 `trellis-${n}.md`（cursor 系）两种布局 | 可抽一个 `COMMAND_NAMESPACE` 常量；存量文档与技能正文仍要 codemod |
| bin 名 `trellis`/`tl`/`oh-my-trellis` | `oh-my-trellis` 86；`trellis <子命令>` 用法串数千 | ~30（bin 定义）；用法串遍布 | `package.json:9-11` bin 表 + `cli/index.ts:71` `.name("trellis")`；帮助文本随程序名自动变 | bin 表和 `.name()` 手工改；文档/模板里的用法串 codemod |
| npm 包名 `@mindfoldhq/trellis`、`@mindfoldhq/trellis-core` | 712 | ~228 | 仅 `check-manifest-continuity.js:34` 有 `PACKAGE_NAME` 常量 | codemod + `publish.yml`/`pnpm-lock` 重建；改名即换 scope，需单独决策 |
| 配置文件名 `config.yaml`/`.template-hashes.json`/`.version` 等 | 见下 | — | `FILE_NAMES` 只覆盖 `.developer`/`.current-task`/`task.json`；`config.yaml`、`.version`、`.template-hashes.json` 仍是裸字面量（`context-trust.ts:108`、`cli/index.ts:34`、`template-hash.ts:265`） | 扩 `FILE_NAMES`/Py `FILE_*` 常量再迁移；这些文件名本身不含 trellis，可不改名 |
| 品牌词 `Trellis`（散文/注释/UI 文案） | ~4,675 | 1,025 | 纯文本，无常量可收 | 纯 codemod |
| 小写 hook 标记 `trellis-hook-injected`/`trellis-emitted` | ~77 | ~30 | `shared-hooks` 模板里的字面量注释标记 | 随模板 codemod + 重新生成已安装 hooks |
| 必须保留（上游出处） | `mindfold-ai` 178 / `AGPL` 18 / `Mindfold` 14 | ~90 | `COPYRIGHT:2` Mindfold LLC、`LICENSE` AGPL-3.0、`docs/fork-sync.md`、README 徽章、`.gitmodules` URL | 全部保留；codemod 加排除清单 |

## 收拢建议（按类别）

1. **已是常量形态**：`.trellis` 目录名（`DIR_NAMES.WORKFLOW` / `DIR_WORKFLOW`）、块标记、workflow id（`NATIVE_WORKFLOW_ID`/`OH_MY_WORKFLOW_ID`）、`.developer`/`.current-task`/`task.json`。剩余工作是把绕行常量的字面量调用点迁回常量，并同步改 ~10 份 Python 自足副本（`shared-hooks/inject-*.py`、`common/active_task.py` 及模板副本）。
2. **扩常量再迁移**：`config.yaml`、`.version`、`.template-hashes.json`、`hooks.local.json`、`.runtime/`、`.ralph-state.json` → 补进 `FILE_NAMES` 与 Py `FILE_*`；`~/.trellis` home 目录单设常量。
3. **只能 codemod**：`TRELLIS_*` 环境变量（41 个名、236 文件）、`trellis-*` 技能/命令/子代理名与 `/trellis:` 命名空间（文件名+内容+configurator 模板+前缀解析逻辑）、bin 名与 `trellis <子命令>` 用法串、`@mindfoldhq/*` npm scope、品牌词 `Trellis`、小写 hook 标记。
4. **排除清单**：`COPYRIGHT`、`LICENSE`、AGPL 文本、`mindfold-ai` 出处与 `.gitmodules` URL；同时注意 `release.js:145` 的 git pathspec `':!.trellis'`、`.gitignore`/`.gitattributes`/`pyrightconfig.json` 里的路径项要按字面路径同步改。
5. **重新生成优于改写**：仓库根的已安装平台目录（`.claude`/`.codex`/`.cursor`/`.omp`/`.opencode`/`.pi`/`.agents`，~2,900 处）与本仓自有 `.trellis/` 数据（4,115 处）都是派生面；走 `omtre update` 式再生或整目录一次性替换即可，不做逐点收拢。
6. **出仓部分**：`docs-site`、`marketplace` 两个上游子模块各含自己的改名面（含 `docs/pending/` 里待打上游的 patch），不在本仓 codemod 范围内。

**解决标准核对**：分类表 + 每类收拢建议已给出；未做任何改名。
