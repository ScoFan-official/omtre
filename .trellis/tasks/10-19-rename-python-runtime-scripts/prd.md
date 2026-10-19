# 改名施工 3：Python 工作流脚本与核心骨架模板改名

## Goal

将 CLI 分发给用户项目的 `.omtre/` 核心骨架模板（`packages/cli/src/templates/trellis/` 与 `packages/cli/src/templates/markdown/`）中的 Python 运行时脚本、工作流指南、配置文件、领域层脚手架与角色卡全面迁移到 `.omtre/`、`OMTRE_*`、`omtre-*`、`/omt:*` 与 `omtre` 命令。

## Scope

- `packages/cli/src/templates/trellis/**`（含 `scripts/**/*.py`、`workflow.md`、`workflow-oh-my.md`、`config.yaml`、`gitattributes.txt`、`gitignore.txt`、`agents/*.md`、`domains/**`、`index.ts`）
- `packages/cli/src/templates/markdown/**`（`agents.md`、`workspace-index.md`、`worktree.yaml.txt`、`gitignore.txt`、`spec/guides/*.md.txt`、`index.ts`）
- `packages/cli/test/scripts/**`
- `packages/cli/test/templates/**`

## Requirements

- **Python 运行时脚本（`packages/cli/src/templates/trellis/scripts/**`）**：
  - `common/paths.py` 与自包含脚本 `common/active_task.py` 中的 `DIR_WORKFLOW` 改为 `".omtre"`。
  - `common/trellis_config.py`（及 `templates/trellis/index.ts` 中的导出引用）里的配置说明、环境变量与路径改为 `.omtre` / `OMTRE_*`。
  - `common/cli_adapter.py`：平台命令前缀 `/trellis:xxx` 改为 `/omt:xxx`，子代理前缀 `trellis-` 改为 `omtre-`。
  - `common/clai_delta.py`、`common/safe_commit.py`、`common/config.py`、`common/task_store.py`、`common/task_context.py`、`common/task_utils.py`、`common/session_context.py`、`common/roster.py`、`common/verify.py`、`hooks/linear_sync.py`、`task.py`、`add_session.py`、`init_developer.py`、`get_context.py`、`get_developer.py` 中的所有 `.trellis`、`TRELLIS_*`（如 `TRELLIS_ACTIVE_TASK`、`TRELLIS_DEV_ROOT`、`TRELLIS_TASK_TICKS` 等）、`trellis-*`、`trellis` CLI 调用全部改为 `.omtre`、`OMTRE_*`、`omtre-*`、`omtre`。
- **核心骨架文件与 Markdown 模板**：
  - `workflow.md`、`workflow-oh-my.md`、`config.yaml`、`gitattributes.txt`、`agents/{implement,check,research,orchestrator}.md`、`domains/**` 中的路径、命令、技能名、环境变量全部改为 `.omtre` 体系。
  - `templates/markdown/agents.md` 中的受管块标记改为 `<!-- OMTRE:START -->` / `<!-- OMTRE:END -->`，正文改为 `.omtre/`、`/omt:finish-work`、`/omt:continue`、`omtre update`。
  - `templates/markdown/spec/guides/*.md.txt`、`workspace-index.md`、`worktree.yaml.txt` 中的 `.trellis` 与 `Trellis` 改为 `.omtre` 与 `omtre`。
- **测试策略**：
  - 同步更新 `packages/cli/test/scripts/**` 与 `packages/cli/test/templates/**` 中的夹具和断言，确保针对模板内 Python 脚本的集成测试通过。

## Acceptance Criteria

- [ ] `rg -n "trellis|TRELLIS|Trellis" packages/cli/src/templates/trellis packages/cli/src/templates/markdown packages/cli/test/scripts packages/cli/test/templates` 结果为 0 处（`mindfold-ai` 出处链接除外）。
- [ ] `pnpm --filter omtre lint:py` 通过。
- [ ] `pnpm typecheck` 通过。
- [ ] `pnpm --filter omtre test test/scripts test/templates` 通过。

## Out of Scope

- 本仓根 `.trellis/scripts/` 狗粮目录：在 `omtre migrate` 自举前，本仓仍用 `.trellis/tasks/` 管票，不直接把根 `.trellis/scripts/` 的 `DIR_WORKFLOW` 改成 `.omtre`（二者一致性测试的过渡处理归 `10-19-rename-test-suite-and-regression`，最终由 `omtre migrate` 自举统一）。
- `packages/cli/src/templates/common/**` 与 `shared-hooks/**`（归 `10-19-rename-templates-common-and-hooks`）。
- 20 个平台专属模板目录（归 `10-19-rename-configurators-and-platforms`）。
- 保留清单：`COPYRIGHT`、`LICENSE`、`mindfold-ai` 出处链接、`docs/fork-sync.md`、`catalog/`。

## Blocked by

- `.trellis/tasks/10-19-rename-constants-and-pkg`
