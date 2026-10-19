# 迁移施工 2：执行本仓 .trellis → .omtre/ 自举与门禁收口

## Goal

在本仓（`D:\AI agent Projects\omtre`）上运行 `omtre migrate` 将 `.trellis/` 迁移至 `.omtre/` 完成自举，清理自举备份文件，移除 `packages/cli/test/regression.test.ts` 中的自举前过渡垫片，并确保自举后 `pnpm check:legacy-names`（此时第二层自举前临时豁免自动失效）与全部测试门禁全绿。

## Requirements

### 1. 运行 `omtre migrate` 执行本仓自举
- 构建 CLI（`pnpm build`）后，在本仓根目录执行 `node packages/cli/dist/cli/index.js migrate --yes --allow-dirty`（或先 `git status` 确认后执行 `omtre migrate --yes`）。
- 验证 `omtre migrate` 的 4 项自检在本仓全部通过：
  1. 根目录不再存在 `.trellis/`，且 `.omtre/` 与 `.omtre/.migrated-from` 已生成；
  2. 受管文件与 `.omtre/` 数据中 `.trellis/`、`TRELLIS_`、`/trellis:`、`TRELLIS:START` 残留为 0；
  3. 任务数量与迁移前一致，所有 `blocked_by` 均可解析；
  4. 会话启动钩子可正常注入上下文。
- 核对 `.omtre/agents/{implement,check,check.standards,check.spec,orchestrator,research}.md` 与 `.omtre/config.yaml` 中的本仓派工表配置（`provider: claude`, `effort: high`, `worker_default: implement`, `max_parallel: 2`）完整保留。
- 核对无误后，清理自举过程中在工作树产生的 `.backup` 临时备份文件（包括历史遗留的 `.claude/skills/*/*.backup`、`.cursor/skills/*/*.backup`、`.opencode/skills/*/*.backup`）。

### 2. 移除 `regression.test.ts` 的自举前过渡垫片
- 在 `packages/cli/test/regression.test.ts` 的 `"Dogfooding Parity"` 测试块中：
  - 移除 `PRE_BOOTSTRAP_BRAND`、`PRE_BOOTSTRAP_BRAND_UPPER`、`PRE_BOOTSTRAP_BRAND_TITLE`、`legacyDogfoodRoot`、`isBootstrapped`、`mapDogfoodPathToTemplatePath`、`normalizePreBootstrapContent` 等自举前过渡转换逻辑；
  - 直接断言 `.omtre/scripts/` 与 `packages/cli/src/templates/omtre/scripts/` 的文件列表和文件内容严格一致。

### 3. 自举后门禁收口（`check:legacy-names` post-bootstrap 模式）
- 当根 `.omtre/` 存在时，`scripts/check-legacy-names.mjs` 自动进入 `post-bootstrap (tier-2 temporary allowlist inactive)` 模式，开始扫描 `.omtre/`、`.claude/`、`.agents/`、`.codex/`、`.cursor/`、`.devin/`、`.omp/`、`.opencode/`、`.pi/`、`AGENTS.md`、`CLAUDE.md`、`.gitignore`、`.gitattributes`、`pnpm-lock.yaml`。
- 在 `scripts/check-legacy-names.mjs` 中：
  - `.omtre/tasks/` 下历史归档任务的**目录名本身**（如 `01-22-trellis-agents-gui`）属于历史任务 ID，不应触发路径名 `trellis-*` 报错，但 `.omtre/tasks/**` 的**文件正文**仍须接受扫描（确保无 `.trellis/`、`TRELLIS_*` 等残留）；
  - 若 `pnpm-lock.yaml` 因包名切换需刷新，执行 `pnpm install --lockfile-only` 刷新锁文件；
  - 确保全仓在 `post-bootstrap` 模式下运行 `pnpm check:legacy-names` 达到 **0 违规**。

## Acceptance Criteria

- [ ] 根目录 `.trellis/` 已不存在，`.omtre/` 与 `.omtre/.migrated-from` 已就位。
- [ ] `python ./.omtre/scripts/task.py status`、`python ./.omtre/scripts/task.py frontier`、`python ./.omtre/scripts/get_context.py` 均正常工作。
- [ ] `packages/cli/test/regression.test.ts` 中不再包含 `pre-bootstrap-exempt` 标记，且 `pnpm --filter omtre test test/regression.test.ts` 全绿。
- [ ] `pnpm check:legacy-names` 输出 `mode: post-bootstrap (tier-2 temporary allowlist inactive)` 且 **0 违规**。
- [ ] `pnpm build`、`pnpm typecheck`、`pnpm lint`、`pnpm --filter omtre lint:py`、`pnpm test:core` 及 CLI 相关测试全部通过。
