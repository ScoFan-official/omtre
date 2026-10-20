# 改名施工 1：集中常量、包名与二进制入口收拢

## Goal

在替换全仓裸字面量之前，先在 TS 常量层收拢所有与目录名、文件名、受管块标记、技能前缀、斜杠命令命名空间相关的定义，把值切换为 `.omtre` / `OMTRE_*` / `omtre` / `omt`，并同步更新 monorepo 包名与 CLI 二进制入口。

## Scope

- `package.json`
- `packages/cli/package.json`
- `packages/core/package.json`
- `packages/cli/bin/trellis.js`（重命名为 `packages/cli/bin/omtre.js`）
- `packages/cli/src/constants/paths.ts`
- `packages/cli/src/constants/version.ts`
- `packages/cli/src/utils/managed-paths.ts`
- `packages/cli/src/types/ai-tools.ts`
- `packages/cli/test/constants/paths.test.ts`

## Requirements

- **路径与文件常量（`packages/cli/src/constants/paths.ts`）**：
  - `DIR_NAMES.WORKFLOW` 改为 `".omtre"`；内部子目录名（`workspace`、`tasks`、`archive`、`spec`、`scripts`、`agents`、`domains`）保持不变。
  - 新增用户主目录状态根常量 `HOME_DIR_NAME = ".omtre"`（供 channel store、ablation store 等拼接 `os.homedir()` 使用）。
  - 在 `FILE_NAMES` 中补齐：`CONFIG_YAML: "config.yaml"`、`VERSION: ".version"`、`TEMPLATE_HASHES: ".template-hashes.json"`、`HOOKS_LOCAL: "hooks.local.json"`、`RUNTIME_DIR: ".runtime"`、`RALPH_STATE: ".ralph-state.json"`、`MIGRATED_FROM: ".migrated-from"`。
  - 新增命令与前缀常量：`CLI_BIN_NAME = "omtre"`、`CLI_SHORT_BIN_NAME = "omt"`、`SKILL_PREFIX = "omtre-"`、`SLASH_COMMAND_NS = "omt"`。
- **标记常量（`packages/cli/src/utils/managed-paths.ts` 或集中常量模块）**：
  - 受管块标记改为 `OMTRE_BLOCK_START = "<!-- OMTRE:START -->"`、`OMTRE_BLOCK_END = "<!-- OMTRE:END -->"`。
  - 收拢 Copilot 标记常量 `OMTRE_COPILOT_GUIDANCE_START = "<!-- OMTRE:COPILOT-GUIDANCE:START -->"`、`OMTRE_COPILOT_GUIDANCE_END = "<!-- OMTRE:COPILOT-GUIDANCE:END -->"`。
  - 收拢钩子与事件标记常量 `OMTRE_HOOK_INJECTED_MARKER = "omtre-hook-injected"`、`OMTRE_EMITTED_MARKER = "omtre-emitted"`。
- **平台命令前缀注册表（`packages/cli/src/types/ai-tools.ts`）**：
  - `TemplateContext.cmdRefPrefix` 类型与 `AI_TOOLS` 各平台项从 `"/omt:"`、`"/omtre-"`、`"/skill omtre-"`、`"/skill:omtre-"`、`"omtre-"` 改为 `"/omt:"`、`"/omt-"`、`"/skill omtre-"`、`"/skill:omtre-"`、`"omtre-"`。
- **包身份与二进制入口**：
  - `packages/cli/package.json`：`name` 改为 `"omtre"`；`bin` 改为 `{ "omtre": "./bin/omtre.js", "omt": "./bin/omtre.js" }`（不保留 `trellis`、`tl`、`omtre` 别名）；`repository.url` 改为 `"https://github.com/ScoFan-official/omtre.git"`；`packages/cli/bin/trellis.js` 改名为 `packages/cli/bin/omtre.js`。
  - `packages/core/package.json`：`name` 改为 `"@omtre/core"`（同步更新 `packages/cli/package.json` 的依赖声明与根 `package.json` 的 `--filter` 脚本）。
- **测试策略**：
  - 模块单测随实现票同步改写：更新 `packages/cli/test/constants/paths.test.ts` 的断言与夹具。

## Acceptance Criteria

- [ ] `rg -n "trellis|TRELLIS|Trellis" package.json packages/cli/package.json packages/core/package.json packages/cli/bin packages/cli/src/constants packages/cli/src/utils/managed-paths.ts packages/cli/src/types/ai-tools.ts packages/cli/test/constants` 结果为 0 处（保留项如 `mindfold-ai` 出处链接除外）。
- [ ] `pnpm install --no-frozen-lockfile`（更新 workspace 包名绑定后）与 `pnpm --filter @omtre/core build` 通过。
- [ ] `pnpm --filter omtre test test/constants/paths.test.ts` 通过。

## Out of Scope

- 消费这些常量的其它 TS 裸字面量文件（归 `10-19-rename-ts-core-and-cli` 与 `10-19-rename-configurators-and-platforms`）。
- Python 脚本与各平台模板正文（归后续施工票）。
- 本仓自带的 `.omtre/` 数据（约 4,100 处，等 `omtre migrate` 迁移）与已安装的平台目录 `.claude/`、`.agents/`、`.codex/` 等（约 2,900 处，由 configurator 重新生成）。
- 保留清单：`COPYRIGHT`、`LICENSE`（AGPL-3.0）、`mindfold-ai` 出处链接、`docs/fork-sync.md`、`catalog/`。

## Blocked by

None — can start immediately.
