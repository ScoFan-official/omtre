# 改名施工 4：公共命令/技能模板（common）与 shared-hooks 改名

## Goal

将跨平台单点真相源 `packages/cli/src/templates/common/`（公共斜杠命令、技能、多文件内置技能包）与 `packages/cli/src/templates/shared-hooks/`（跨平台会话与子代理注入钩子）全部迁移到 `.omtre/`、`OMTRE_*`、`omtre-*`、`/omt:*` 与 `omtre-hook-injected` / `omtre-emitted`。

## Scope

- `packages/cli/src/templates/common/**`
  - `commands/*.md`
  - `skills/*.md`
  - `bundled-skills/trellis-meta/**` → 重命名目录为 `bundled-skills/omtre-meta/**`
  - `bundled-skills/trellis-channel/**` → 重命名目录为 `bundled-skills/omtre-channel/**`
  - `bundled-skills/trellis-session-insight/**` → 重命名目录为 `bundled-skills/omtre-session-insight/**`
  - `bundled-skills/trellis-spec-bootstrap/**` → 重命名目录为 `bundled-skills/omtre-spec-bootstrap/**`
  - `index.ts`
- `packages/cli/src/templates/shared-hooks/**`
  - `session-start.py`
  - `inject-workflow-state.py`
  - `inject-subagent-context.py`
  - `inject-shell-session-context.py`
  - `index.ts`

## Requirements

- **公共模板（`packages/cli/src/templates/common/**`）**：
  - 将 `bundled-skills/` 下的 4 个内置技能目录从 `trellis-*` 重命名为 `omtre-*`（`omtre-meta`、`omtre-channel`、`omtre-session-insight`、`omtre-spec-bootstrap`），并把各 `SKILL.md` frontmatter 的 `name:` 字段及内部 `references/**/*.md` 的所有 `.trellis`、`TRELLIS_*`、`trellis-*`、`/trellis:*`、`trellis <子命令>` 全部改为 `.omtre`、`OMTRE_*`、`omtre-*`、`/omt:*`、`omtre <子命令>`。
  - 将 `commands/*.md`（`start.md`、`continue.md`、`finish-work.md` 等）与 `skills/*.md`（`before-dev.md`、`brainstorm.md`、`break-loop.md`、`check.md`、`update-spec.md` 等）中的 `.trellis/`、`trellis-*`、`/trellis:*` 全部改为 `.omtre/`、`omtre-*`、`/omt:*`。
- **跨平台共享钩子（`packages/cli/src/templates/shared-hooks/**`）**：
  - 4 个自包含 Python 脚本（`session-start.py`、`inject-workflow-state.py`、`inject-subagent-context.py`、`inject-shell-session-context.py`）顶部的 `DIR_WORKFLOW` 副本全部改为 `".omtre"`。
  - 所有 `TRELLIS_*` 环境变量（`TRELLIS_HOOKS`、`TRELLIS_DISABLE_HOOKS`、`TRELLIS_CONTEXT_ID`、`TRELLIS_SESSION_ID` 等）全部改为 `OMTRE_*`，不读取旧变量名。
  - 子代理名称匹配与 `removeprefix("trellis-")` 承重点改为 `omtre-*` 与 `removeprefix("omtre-")`；`trellis-{implement,check,research,plan,debug}` 全部改为 `omtre-{implement,check,research,plan,debug}`。
  - 钩子注入标记 `trellis-hook-injected`、`trellis-emitted` 全部改为 `omtre-hook-injected`、`omtre-emitted`。

## Acceptance Criteria

- [ ] `rg -n "trellis|TRELLIS|Trellis" packages/cli/src/templates/common packages/cli/src/templates/shared-hooks` 结果为 0 处（`mindfold-ai` 出处链接除外）。
- [ ] `packages/cli/src/templates/common/bundled-skills/` 下不存在 `trellis-*` 目录，且 `omtre-{meta,channel,session-insight,spec-bootstrap}` 目录结构完整。
- [ ] `pnpm --filter omtre lint:py` 与 `pnpm typecheck` 通过。

## Out of Scope

- 各平台专属模板目录与 `packages/cli/src/configurators/**`（归 `10-19-rename-configurators-and-platforms`）。
- 本仓自带的 `.trellis/` 数据与已安装平台目录 `.claude/`、`.agents/`、`.codex/` 等。
- 保留清单：`COPYRIGHT`、`LICENSE`、`mindfold-ai` 出处链接、`docs/fork-sync.md`、`catalog/`。

## Blocked by

- `.trellis/tasks/10-19-rename-constants-and-pkg`
