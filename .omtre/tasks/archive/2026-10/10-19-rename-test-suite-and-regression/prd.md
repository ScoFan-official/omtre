# 改名施工 6：测试套件收尾与 regression.test.ts 迁移

## Goal

在核心代码、Python 运行时脚本、公共模板与 20 个平台配置器全部完成改名后，集中迁移跨模块测试文件（特别是 `packages/cli/test/regression.test.ts`、`registry-invariants.test.ts`、`cli.integration.test.ts`），清零 `packages/cli/test/` 与 `packages/core/test/` 的旧名残留。

## Scope

- `packages/cli/test/regression.test.ts`
- `packages/cli/test/registry-invariants.test.ts`
- `packages/cli/test/cli.integration.test.ts`
- `packages/cli/test/**` 与 `packages/core/test/**` 全目录复核

## Requirements

- **迁移跨层回归测试（`packages/cli/test/regression.test.ts`）**：
  - 将 1,093 处旧名夹具、路径（`.omtre`、`~/.omtre`）、环境变量（`OMTRE_*`）、标记（`OMTRE:START/END`、`omtre-hook-injected`）、技能/代理名（`omtre-*`）、斜杠命令（`/omt:*`）与 CLI 命令（`trellis`）断言全部更新为 `.omtre`、`OMTRE_*`、`omtre-*`、`/omt:*`、`omtre`。
  - **自举过渡期脚本字节对比处理**：`regression.test.ts` 中有一项对比本仓狗粮脚本目录与 `packages/cli/src/templates/.../scripts` 字节一致性的测试。在 `omtre migrate` 自举前，本仓仍使用 `.omtre/`，而模板已迁至 `.omtre/`；需将该断言更新为：当仓库根已存在 `.omtre/scripts` 时对比 `.omtre/scripts` 与模板脚本字节完全一致，自举前（仅存在 `.omtre/scripts` 时）校验两者文件集合一致且 `.omtre/scripts` 经已知改名规则映射后与模板脚本一致（或显式标注自举切换条件），杜绝假阳性或跳过检查。
- **迁移注册表不变式与 CLI 集成测试**：
  - 更新 `registry-invariants.test.ts`、`cli.integration.test.ts` 及任何在 R1～R5 中遗漏的测试文件。
- **历史迁移清单测试例外**：
  - 若测试专门验证 `packages/cli/src/migrations/manifests/*.json`（0.3.0～0.4.0 历史版本迁移清单）的解析行为，仅保留对该历史 manifest 字段的必要断言，并加明确注释说明原因。

## Acceptance Criteria

- [ ] `rg -n "trellis|TRELLIS|Trellis" packages/cli/test packages/core/test` 结果为 0 处（仅显式测试 `src/migrations/manifests/` 历史 JSON 的断言与 `mindfold-ai` 出处除外）。
- [ ] `pnpm build && pnpm typecheck && pnpm lint` 通过。
- [ ] `pnpm test:core` 通过。
- [ ] `pnpm --filter omtre test test/regression.test.ts test/registry-invariants.test.ts` 通过。

## Out of Scope

- `packages/cli/src/migrations/manifests/*.json` 历史迁移清单本身。
- 本仓自带的 `.omtre/` 数据与已安装平台目录。
- 保留清单：`COPYRIGHT`、`LICENSE`、`mindfold-ai` 出处链接、`docs/fork-sync.md`、`catalog/`。

## Blocked by

- `.omtre/tasks/10-19-rename-ts-core-and-cli`
- `.omtre/tasks/10-19-rename-python-runtime-scripts`
- `.omtre/tasks/10-19-rename-templates-common-and-hooks`
- `.omtre/tasks/10-19-rename-configurators-and-platforms`
