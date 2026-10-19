# 改名施工 5：全平台 Configurators 与 20 个平台专属模板改名

## Goal

将 `packages/cli/src/configurators/` 全平台配置器与 20 个平台专属模板目录（`claude`、`codex`、`copilot`、`cursor`、`devin`、`opencode`、`pi`、`omp`、`snow`、`gemini`、`grok`、`kimi`、`kiro`、`droid`、`dsh`、`qoder`、`codebuddy`、`trae`、`reasonix`、`zcode`）全部改名为 omtre 规范，使 configurator 生成的受管文件完全产出 `.omtre/`、`OMTRE_*`、`omtre-*` 与 `/omt:*`。

## Scope

- `packages/cli/src/configurators/**`
- `packages/cli/src/templates/{claude,codex,copilot,cursor,devin,opencode,pi,omp,snow,gemini,grok,kimi,kiro,droid,dsh,qoder,codebuddy,trae,reasonix,zcode}/**`
- `packages/cli/test/configurators/**`

## Requirements

- **配置器层（`packages/cli/src/configurators/**`）**：
  - `shared.ts`、`index.ts` 及全部 20 个平台配置器：
    - 命令子目录从 `commands/trellis/` 改为 `commands/omt/`（Claude、Cursor、Gemini、Qoder、CodeBuddy、Trae、ZCode 等）；
    - 技能目录前缀从 `skills/trellis-${name}` 改为 `skills/omtre-${name}`；
    - 子代理文件名从 `trellis-{research,implement,check}` 改为 `omtre-{research,implement,check}`；
    - Devin 工作流名从 `trellis-start.md` 改为 `omtre-start.md`；
    - Pi / OMP 扩展目录从 `extensions/trellis/` 改为 `extensions/omtre/`；
    - Kiro 钩子与代理文件从 `trellis-workflow-state.kiro.hook`、`trellis.json` 改为 `omtre-workflow-state.kiro.hook`、`omtre.json`；
    - Snow 钩子脚本从 `write-trellis-context.py` 改为 `write-omtre-context.py`；
    - OpenCode 库文件从 `lib/trellis-context.js` 改为 `lib/omtre-context.js`；
    - Copilot 指导块标记接入 `OMTRE_COPILOT_GUIDANCE_START` / `END`（`<!-- OMTRE:COPILOT-GUIDANCE:START -->`）。
- **20 个平台专属模板目录**：
  - 将各平台 `agents/trellis-*.{md,toml,json}`、`droids/trellis-*.md`、`workflows/trellis-start.md`、`extensions/trellis/`、`hooks/trellis-*`、`hooks/write-trellis-context.py`、`lib/trellis-context.js` 等文件/目录重命名为 `omtre-*` / `omtre`。
  - 改写平台专属自包含脚本与插件（`claude/hooks/statusline.py`、`codex/hooks/session-start.py`、`copilot/hooks/session-start.py`、`snow/hooks/write-omtre-context.py`、`opencode/lib/*.js`、`opencode/plugins/*.js`、`pi/extensions/omtre/index.ts.txt`、`omp/extensions/omtre/index.ts.txt`）中的 `DIR_WORKFLOW = ".omtre"`、`OMTRE_*`、`omtre-*`、`/omt:*`、`omtre-hook-injected`。
  - 改写所有平台模板正文与 `index.ts` 导出中的 `.trellis`、`TRELLIS_*`、`trellis-*`、`/trellis:*`、`Trellis`。
- **测试策略**：
  - 同步更新 `packages/cli/test/configurators/**`（`shared.test.ts`、`platforms.test.ts`、`index.test.ts`、`codex.test.ts`、`python-rewrite-parity.test.ts`）中的路径、文件名与内容断言。

## Acceptance Criteria

- [ ] `rg -n "trellis|TRELLIS|Trellis" packages/cli/src/configurators packages/cli/src/templates packages/cli/test/configurators` 结果为 0 处（`mindfold-ai` 出处链接除外）。
- [ ] `pnpm typecheck && pnpm lint && pnpm --filter omtre lint:py` 通过。
- [ ] `pnpm --filter omtre test test/configurators` 全部通过。

## Out of Scope

- 仓库根已安装的平台目录（`.claude/`、`.agents/`、`.codex/`、`.cursor/`、`.devin/`、`.omp/`、`.opencode/`、`.pi/` 等）：属于派生文件，不在本票直接改写，后续由 `omtre migrate` 调用本票改好的 configurator 重新生成。
- 本仓自带的 `.trellis/` 数据。
- 保留清单：`COPYRIGHT`、`LICENSE`、`mindfold-ai` 出处链接、`docs/fork-sync.md`、`catalog/`。

## Blocked by

- `.trellis/tasks/10-19-rename-constants-and-pkg`
- `.trellis/tasks/10-19-rename-python-runtime-scripts`
- `.trellis/tasks/10-19-rename-templates-common-and-hooks`
