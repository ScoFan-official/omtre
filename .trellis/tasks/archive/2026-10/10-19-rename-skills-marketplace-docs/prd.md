# 改名施工 7：技能包（skills/）、marketplace/、CI 与文档改名

## Goal

将并入仓库根目录的技能包（`skills/`、根 `scripts/`）、`marketplace/` 目录、`.github/` 工作流以及仓库级文档中的 `.trellis/`、`TRELLIS_*`、`trellis-*`、`/trellis:*`、`oh-my-trellis` 全部迁移到 omtre 命名体系。

## Scope

- `skills/**`（13 个文件，含 `skills/mp-trellis-bridge/` 重命名为 `skills/mp-omtre-bridge/`）
- `scripts/{install.py,build_manifest.py,platforms.py}`
- `marketplace/**`（81 个文件，含 `marketplace/index.json`、`marketplace/skills/trellis-meta/` 重命名为 `marketplace/skills/omtre-meta/`、`marketplace/specs/**`、`marketplace/workflows/**`）
- `.github/**`（`workflows/ci.yml`、`workflows/cli-release.yml`、`workflows/publish.yml`、`ISSUE_TEMPLATE/**`）
- 根目录文档与配置：`README.md`、`README.zh.md`、`README.pack.md`、`CHANGELOG.pack.md`、`GLOSSARY.md`、`pyrightconfig.json`

## Requirements

- **技能包（`skills/**` 与 `scripts/**`）**：
  - `skills/mp-trellis-bridge/` 目录重命名为 `skills/mp-omtre-bridge/`，`SKILL.md` 的 `name:` 改为 `mp-omtre-bridge`。
  - `skills/` 下全部 13 个文件中的 `.trellis/`、`TRELLIS:START/END`、`trellis-*`、`/trellis:*`、`trellis init/update/run`、`gh:ScoFan-official/oh-my-trellis` 全部改为 `.omtre/`、`OMTRE:START/END`、`omtre-*`、`/omt:*`、`omtre init/update/run`、`gh:ScoFan-official/omtre`。
  - `scripts/install.py`、`scripts/build_manifest.py`、`scripts/platforms.py` 中的 `mp-trellis-bridge`、`ScoFan-official/oh-my-trellis` 等全部改为 `mp-omtre-bridge`、`ScoFan-official/omtre`。
- **官方模板市场（`marketplace/**`）**：
  - `marketplace/skills/trellis-meta/` 重命名为 `marketplace/skills/omtre-meta/`，同步更新 `marketplace/index.json` 中的 id、name、path 与描述。
  - `marketplace/specs/**`、`marketplace/workflows/**`、`marketplace/skills/**`、`marketplace/README.md`、`marketplace/CONTRIBUTING.md` 中的 449 处 `.trellis`、5 处 `TRELLIS_`、245 处 `trellis-`、30 处 `/trellis:` 及命令名全部改为 `.omtre`、`OMTRE_`、`omtre-`、`/omt:`、`omtre`。
- **CI 工作流与仓库级文档（`.github/**`、`README*.md`、`GLOSSARY.md`、`pyrightconfig.json`）**：
  - `.github/` 下的工作流与 issue 模板：包过滤器改为 `@omtre/core` 与 `omtre`，二进制路径改为 `bin/omtre.js`，仓库引用改为 `ScoFan-official/omtre`。
  - `README.md`、`README.zh.md`、`README.pack.md`、`GLOSSARY.md` 中的命令、目录、环境变量与包名改为 `omtre` / `.omtre`（保留上游 Mindfold / `mindfold-ai` 出处致谢链接）。
  - `pyrightconfig.json`：保留对模板 Python 脚本的检查路径，同时兼容自举前后的脚本目录。

## Acceptance Criteria

- [ ] `rg -n "trellis|TRELLIS|Trellis" skills scripts marketplace .github README.md README.zh.md README.pack.md GLOSSARY.md` 结果为 0 处（`mindfold-ai` 上游出处链接与硬分叉来源说明除外）。
- [ ] `python -m py_compile scripts/install.py scripts/build_manifest.py scripts/platforms.py` 通过。
- [ ] `pnpm --filter omtre lint:py` 通过。

## Out of Scope

- `catalog/`：原样拷贝的上游内容，sync 时会被覆盖，不改。
- `COPYRIGHT`、`LICENSE`（AGPL-3.0）、`docs/fork-sync.md`、`docs/pending/`。
- 本仓根 `.trellis/` 数据、已安装平台目录（`.claude/`、`.agents/`、`.codex/` 等），以及根 `AGENTS.md`、`CLAUDE.md`、`.gitignore`、`.gitattributes`（这四项随 `omtre migrate` 自举本仓时一并改写）。

## Blocked by

- `.trellis/tasks/10-19-rename-constants-and-pkg`
