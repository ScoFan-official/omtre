# 改名施工 2：TS 核心库与 CLI 命令、工具层改名

## Goal

把 `packages/core` 与 `packages/cli`（命令层、工具层、CLI 入口、模板提取器、构建脚本）中的所有裸字面量接入 `10-19-rename-constants-and-pkg` 定义的常量，并将旧名（`.omtre`、`~/.omtre`、`OMTRE_*`、`omtre-*`、`/omt:*`、命令名 `trellis`、`omtre`）全部切换为 omtre 命名规范。

## Scope

- `packages/core/src/**`
- `packages/core/test/**`
- `packages/cli/src/index.ts`
- `packages/cli/src/cli/index.ts`
- `packages/cli/src/commands/**`
- `packages/cli/src/utils/**`（`managed-paths.ts` 已在 R1 处理，本票处理其余文件）
- `packages/cli/src/templates/extract.ts`
- `packages/cli/scripts/**`
- `packages/cli/test/commands/**`
- `packages/cli/test/utils/**`

## Requirements

- **核心库（`packages/core/src/**`）**：
  - `channel/internal/store/paths.ts`：用户主目录状态根 `~/.omtre/channels` 改为 `~/.omtre/channels`；环境变量 `OMTRE_CHANNEL_*` 全部改为 `OMTRE_CHANNEL_*`，不双读旧变量。
  - `task/**` 与 `mem/**`：所有 `.omtre/` 路径、注释与报错信息改为 `.omtre/` 与 `omtre`。
- **CLI 入口与命令层（`packages/cli/src/cli/index.ts`、`packages/cli/src/commands/**`）**：
  - `program.name("omtre")`；升级/更新提示改为 `omtre update`、`omtre upgrade`。
  - `init.ts`、`update.ts`、`upgrade.ts`、`uninstall.ts`、`workflow.ts`、`run.ts`、`run/**`、`mem.ts`、`ablate.ts`、`channel/**` 中的 `.omtre` 裸字面量统一接入 `DIR_NAMES.WORKFLOW` / `PATHS.*` / `FILE_NAMES.*`。
  - `OMTRE_*` 环境变量（如 `OMTRE_SHOW_THOUGHTS`、`OMTRE_EXEC_PATH`、`OMTRE_TICKET_ID`、`OMTRE_PHASE`、`OMTRE_CHANNEL_*` 等）全部改为 `OMTRE_*`。
  - `omtre-*` 子代理名与技能名引用改为 `omtre-*`。
- **工具层与远程注册表（`packages/cli/src/utils/**`）**：
  - `template-fetcher.ts`：`TEMPLATE_INDEX_URL` 改为 `"https://raw.githubusercontent.com/ScoFan-official/omtre/main/marketplace/index.json"`，`TEMPLATE_REPO` 改为 `"gh:ScoFan-official/omtre"`，`INSTALL_PATHS.spec` 接入 `PATHS.SPEC`（`".omtre/spec"`）。
  - `ablation-store.ts`：`path.join(os.homedir(), ".omtre", ...)` 接入 `HOME_DIR_NAME`（`".omtre"`）。
  - `github-releases.ts`、`template-hash.ts`、`workflow-resolver.ts`、`manifest-pruning.ts`、`uninstall-scrubber.ts`、`agent-Reference.ts` 等全部改为 `omtre` / `.omtre` / `ScoFan-official/omtre`。
- **模板提取与构建脚本（`packages/cli/src/templates/extract.ts`、`packages/cli/scripts/**`）**：
  - 更新 `extract.ts` 的说明与路径引用；更新 `packages/cli/scripts/` 下各脚本的包名、`.omtre` 路径与仓库引用。
- **测试策略**：
  - 同步更新 `packages/core/test/**`、`packages/cli/test/commands/**`、`packages/cli/test/utils/**` 中的夹具路径、环境变量名与断言。

## Acceptance Criteria

- [ ] `rg -n "trellis|TRELLIS|Trellis" packages/core/src packages/core/test packages/cli/src/index.ts packages/cli/src/cli packages/cli/src/commands packages/cli/src/utils packages/cli/src/templates/extract.ts packages/cli/scripts packages/cli/test/commands packages/cli/test/utils` 结果为 0 处（`mindfold-ai` 出处链接除外）。
- [ ] `pnpm build:core && pnpm typecheck && pnpm lint` 通过。
- [ ] `pnpm test:core` 全部通过。
- [ ] `pnpm --filter omtre test test/commands test/utils` 通过（Windows 基线已知环境问题除外）。

## Out of Scope

- `packages/cli/src/configurators/**` 及 20 个平台专属模板（归 `10-19-rename-configurators-and-platforms`）。
- `packages/cli/src/templates/trellis/**`、`markdown/**`、`common/**`、`shared-hooks/**`（归 R3、R4）。
- 历史迁移清单 `packages/cli/src/migrations/manifests/*.json`（保留历史版本快照不改）。
- 本仓自带的 `.omtre/` 数据与已安装平台目录 `.claude/`、`.agents/`、`.codex/` 等。
- 保留清单：`COPYRIGHT`、`LICENSE`、`mindfold-ai` 出处链接、`docs/fork-sync.md`、`catalog/`。

## Blocked by

- `.omtre/tasks/10-19-rename-constants-and-pkg`
