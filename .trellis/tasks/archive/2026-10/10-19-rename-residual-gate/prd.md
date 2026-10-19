# 改名施工 8：全仓旧名残留检查脚本与 CI 门禁

## Goal

作为改名施工的最后一张收口票，实现全仓旧名残留检查脚本并接入 `package.json` 与 GitHub Actions CI（修正阶梯上最硬的一档），确保今后任何新提交一旦引入旧名即自动失败。

## Scope

- `scripts/check-legacy-names.mjs`（或 `.py`，新增）
- `package.json`（新增 `check:legacy-names` 脚本并串入 `lint` 或 CI）
- `.github/workflows/ci.yml`（新增门禁步骤）

## Requirements

- **拦截模式清单**：
  - 扫描受管源码、模板、测试、技能、市场与文档中的旧标识符：
    - `.trellis`（含 `~/.trellis`）
    - `TRELLIS_`（环境变量前缀）
    - `TRELLIS:START`、`TRELLIS:END`、`TRELLIS:COPILOT-GUIDANCE`
    - `trellis-hook-injected`、`trellis-emitted`
    - `trellis-`（技能与子代理前缀）
    - `/trellis:`（斜杠命令命名空间）
    - `oh-my-trellis`、`@mindfoldhq/trellis`
- **两层显式白名单设计**：
  1. **永久保留白名单**（任何时候都允许包含旧名）：
     - `COPYRIGHT`、`LICENSE`
     - `docs/fork-sync.md`、`docs/pending/**`
     - `catalog/**`（上游原样拷贝）
     - `CHANGELOG.md`、`CHANGELOG.pack.md`（历史版本变更记录）
     - `packages/cli/src/migrations/manifests/*.json`（0.3.0～0.4.0 历史版本迁移清单）及测试中显式标注测试该历史 manifest 的行
     - 匹配 `mindfold-ai/trellis` 出处 URL 的行
     - 检查脚本自身（`scripts/check-legacy-names.*`）以及未来 `omtre migrate` 的实现与测试文件（迁移器本身必须读取 `.trellis/` 源目录）
  2. **自举前临时豁免白名单（带自动失效条件）**：
     - 当且仅当仓库根尚不存在 `.omtre/`（即 `omtre migrate` 自举尚未在本仓执行）时，临时豁免：
       - 根 `.trellis/**`（本仓任务与规范数据）
       - 根已安装平台目录（`.claude/**`、`.agents/**`、`.codex/**`、`.cursor/**`、`.devin/**`、`.omp/**`、`.opencode/**`、`.pi/**`）
       - 根 `AGENTS.md`、`CLAUDE.md`、`.gitignore`、`.gitattributes`、`pnpm-lock.yaml`
     - 一旦本仓执行 `omtre migrate` 生成 `.omtre/` 后，上述临时豁免自动失效，立即对全仓生效。
- **输出与退出码**：
  - 发现违规残留时，按 `<文件路径>:<行号>: <匹配内容>` 打印全部违规项，并以非零退出码（`1`）退出；无违规时打印通过摘要并以 `0` 退出。

## Acceptance Criteria

- [ ] 运行 `pnpm check:legacy-names` 退出码为 `0`，且当前已完成的 `packages/`、`skills/`、`marketplace/`、`scripts/`、`.github/`、`README*.md`、`GLOSSARY.md` 均在扫描覆盖下无任何违规。
- [ ] 在受检目录（如 `packages/cli/src/`）临时注入含 `.trellis` 或 `TRELLIS_FOO` 的行时，`pnpm check:legacy-names` 退出码为 `1` 并准确报告文件名与行号（验证后还原）。
- [ ] `.github/workflows/ci.yml` 已接入 `pnpm check:legacy-names`。

## Out of Scope

- `omtre migrate` 命令本身的实现（本票完成后，改名施工全部收口，`omtre migrate` 实现票即可开始）。

## Blocked by

- `.trellis/tasks/10-19-rename-test-suite-and-regression`
- `.trellis/tasks/10-19-rename-skills-marketplace-docs`
