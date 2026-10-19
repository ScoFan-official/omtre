# 迁移施工 1：实现 omtre migrate 命令与测试

## Goal

按 T4 决策票（`.trellis/tasks/archive/2026-10/10-19-migrate-contract/answer.md`）与 T3 改名规则（`.trellis/tasks/archive/2026-10/10-19-rename-rules/answer.md`），在 `packages/cli` 中完整实现一次性迁移动词 `omtre migrate`，并补齐单元与集成测试（`packages/cli/test/commands/migrate.test.ts`）。

## Requirements

### 1. CLI 入口与参数（对齐 T4 第 5 节）
- 新增 `packages/cli/src/commands/migrate.ts`（需要拆分子模块时放在 `packages/cli/src/commands/migrate/` 下，均已在 `scripts/check-legacy-names.mjs` 永久白名单内）。
- 在 `packages/cli/src/cli/index.ts` 注册 `omtre migrate` 子命令，并在 `packages/cli/src/index.ts` 导出 `migrate`。
- 支持参数：
  - `--dry-run`：只计算并输出三类分组迁移计划，不改动任何文件。
  - `--json`：以 JSON 结构输出迁移计划（或迁移结果与计划），字段覆盖搬迁项、重新生成项、路径改写统计（总处数、文件数及明细）、`.backup` 备份文件列表、只报告不改的外部文件（含文件与行号）、警告与自检结果。
  - `-y, --yes`（兼容 `--force`）：跳过交互确认直接执行。
  - `--allow-dirty`：允许在 git 工作区存在未提交改动时执行。

### 2. 前置条件与幂等检查（对齐 T4 第 3、4、7 节）
- **幂等状态机（优先于 git 脏检查或紧随仓库检查）**：
  - **只有 `.omtre/`（无 `.trellis/`）**：报告“已经迁移过”（Already migrated），退出码 `0`。
  - **`.trellis/` 与 `.omtre/` 同时存在**：说明上次迁到一半，拒绝执行（退出码非 `0`），提示使用 `git restore . && git clean -fd` 回滚。
  - **两者都不存在**：拒绝执行（退出码非 `0`），提示当前目录未找到 `.trellis/`。
- **Git 仓库与干净工作区检查**：
  - 必须在 git 仓库内（`git rev-parse --is-inside-work-tree`），否则拒绝执行（退出码非 `0`）。
  - 检查 `git status --porcelain`：若非空且未传 `--allow-dirty`（且非 `--dry-run`），拒绝执行并提示先提交/清理或传 `--allow-dirty`。
- **Worktree 与未合并分支警告（只警告不拒绝）**：
  - 若 `git worktree list --porcelain` 存在多个 worktree，或 `git branch --no-merged HEAD` 存在未合并分支，打印警告（说明合并时可能出现改名冲突，建议先合并再迁），但不阻断执行。
- **活跃进程检查**：
  - 检查 `~/.trellis/channels` 或 `~/.omtre/channels` 下是否存在存活的 channel daemon 进程（如 `daemon.pid` 对应 PID 仍在运行），以及 `.trellis/.runtime/` 下是否有正在运行的 `run` 进程；若有则拒绝执行。
- **源版本检查**：
  - 读取 `.trellis/.version`（去除空白）：仅支持 `0.6.x`（例如 `0.6.0`、`0.6.0-beta.*` 等以 `0.6.` 开头的版本）。若版本低于 `0.6.0`（如 `0.3.*`、`0.4.*`、`0.5.*`），拒绝执行并提示先用旧 CLI 升级到 `0.6.x`。
- **用户主目录边界**：
  - `~/.trellis/channels` 不迁移、不删除。

### 3. 三类转换与改写范围（对齐 T4 第 1、2 节）
- **第一类：受管文件（Managed files）**：
  - 识别项目已配置的平台（从 `.trellis/.template-hashes.json` 记录的路径前缀及磁盘上含 `trellis` 受管产物的平台目录如 `.claude`、`.agents`、`.codex`、`.cursor`、`.devin`、`.omp`、`.opencode`、`.pi`、`.gemini`、`.grok`、`.kimi`、`.kiro`、`.droid`、`.dsh`、`.qoder`、`.codebuddy`、`.trae`、`.reasonix`、`.zcode`、`.snow`、`.github/copilot-instructions.md` 检测）。
  - 对比 `.trellis/.template-hashes.json` 中记录的受管文件哈希与磁盘当前内容哈希（LF 归一化 SHA-256）：
    - 若某受管文件已被用户修改（哈希不一致），在替换/删除前先另存一份 `<新路径>.backup`（若旧文件被废弃无对应新路径则存为 `<旧路径>.backup`），并在计划与完成报告中列出。
  - 清理各平台旧版受管文件与设置：
    - 从共享设置文件（`.claude/settings.json`、`.cursor/hooks.json`、`.codex/hooks.json`、`.gemini/settings.json`、`.qoder/settings.json`、`.opencode/opencode.json`、`.pi/settings.json`）中剥离指向 `.trellis/` 或旧 `trellis` 扩展/钩子的条目，保留用户自定义其它配置。
    - 删除旧平台受管文件（`.trellis/.template-hashes.json` 中记录的平台文件，以及 `<platform>/commands/trellis/`、`<platform>/skills/trellis-*/`、`<platform>/agents/trellis-*`、`<platform>/extensions/trellis/`、`<platform>/workflows/trellis-start.md`、`<platform>/hooks/write-trellis-context.py`、`<platform>/lib/trellis-context.js`、`<platform>/prompts/trellis-*` 中的受管文件）。
    - 若 `<platform>/commands/trellis/` 下存在不在模板哈希表且非内置模板名的用户自定义命令（如 `create-manifest.md`、`improve-ut.md`、`publish-skill.md`），将其搬迁至 `<platform>/commands/omt/` 并改写内部旧名引用；同理若 `<cursor>/commands/trellis-*.md` 存在用户自定义命令，搬迁为 `<cursor>/commands/omt-*.md` 并改写；若平台 `skills/` 下存在非 `trellis-*` 的项目自定义技能（如 `contribute`、`python-design`、`first-principles-thinking`、`create-manifest`），保留文件并改写其中的 `.trellis/`、`TRELLIS_*`、`TRELLIS:*`、`/trellis:*`、`trellis-*`。
  - 重新生成受管文件：
    - 在 `.omtre/` 下重新生成 `scripts/**`、`workflow.md`（使用 `ohMyWorkflowMdTemplate` 渲染）、`.gitignore`、`.version`、`agents/**`（对内置角色卡若用户在原 `.trellis/agents/*.md` 中自定义了 frontmatter 如 `provider`/`model`/`effort`/`acp_target`，保留其 frontmatter 配置并更新正文为 `.omtre` 模板；对非内置自定义角色卡如 `check.standards.md`、`check.spec.md`，保留文件并改写内部旧名引用）。
    - 调用各已配置平台的 configurator 重新生成 `.omtre` 版平台受管文件。
    - 更新 `AGENTS.md`（与 `.github/copilot-instructions.md` 如存在）的受管块为 `<!-- OMTRE:START -->...<!-- OMTRE:END -->`（及 `OMTRE:COPILOT-GUIDANCE`）。
    - 重新计算并写入 `.omtre/.template-hashes.json`。
- **第二类：用户数据与根级指令/配置文件改写（User data & root instructions）**：
  - 将 `.trellis/` 搬迁至 `.omtre/`（保留 `tasks/`、`spec/`、`workspace/`、`domains/`、`agents/`、`config.yaml`、`hooks.local.json`、`.developer` 等用户数据）。
  - 在 `.omtre/` 下的用户数据文件（`tasks/**`、`spec/**`、`workspace/**`、`domains/**`、`agents/**`、`config.yaml`、`hooks.local.json`）、根目录指令文件（`AGENTS.md`、`CLAUDE.md` 受管块内外全文）以及 `.gitignore`、`.gitattributes` 中，改写以下技术标识（保护 `mindfold-ai/trellis*` 出处 URL 不被改写，品牌词 "Trellis" 不改）：
    - `~/.trellis` → `~/.omtre`
    - `.trellis` → `.omtre`
    - `TRELLIS:COPILOT-GUIDANCE` → `OMTRE:COPILOT-GUIDANCE`
    - `TRELLIS:START` → `OMTRE:START`、`TRELLIS:END` → `OMTRE:END`
    - `TRELLIS_<VAR>` → `OMTRE_<VAR>`
    - `trellis-hook-injected` → `omtre-hook-injected`、`trellis-emitted` → `omtre-emitted`
    - `/trellis:<cmd>` → `/omt:<cmd>`
    - `@mindfoldhq/trellis-core` → `@omtre/core`、`@mindfoldhq/trellis` → `omtre`、`oh-my-trellis` → `omtre`
    - `trellis-<slug>` → `omtre-<slug>`（注意：**不得**把 `.omtre/tasks/` 下已有历史任务目录名如 `01-22-trellis-agents-gui` 的路径引用改坏；对任务目录路径引用只把前缀 `.trellis/tasks/` 改为 `.omtre/tasks/`，如果 `.omtre/spec/` 下有文件名含 `trellis-` 如 `trellis-core-sdk.md` 则同步重命名文件为 `omtre-core-sdk.md`）。
- **第三类：运行时缓存（Runtime cache）**：
  - `.trellis/.runtime/`、`.trellis/.backup-*`、`.trellis/.current-task`、`.trellis/.ralph-state.json`、`.trellis/.session-id`、`.trellis/.agent-log`、`.trellis/.plan-log` 及 `__pycache__` 不搬迁，直接丢弃。
- **只报告、不修改的仓库其它文件**：
  - 扫描仓库内除上述改写范围及永久白名单外的其它文本文件（如用户脚本、CI、`.env` 等），若包含 `.trellis/`、`TRELLIS_`、`TRELLIS:*`、`/trellis:`，在 `--dry-run` 和迁移完成后列出文件路径与行号，不修改其内容。
- **写入 `.omtre/.migrated-from`**：
  - 迁移完成后写入 `.omtre/.migrated-from`（JSON 格式记录 `sourceVersion`、`migratedAt` 时间戳；注意文件内容不要出现 `.trellis/` 字面量，以免触发第 8 节自检残留）。

### 4. 迁移后 4 项自检（对齐 T4 第 8 节）
`omtre migrate` 在结束前必须自动执行以下 4 项自检；任何一项不通过，必须输出问题详情并以非零退出码（`process.exitCode = 1`）结束：
1. **不再存在 `.trellis/` 目录**。
2. **在受管文件和 `.omtre/` 数据里（不含 `.backup` 备份文件），`.trellis/`、`TRELLIS_`、`/trellis:`、`TRELLIS:START` 的残留都是 0 处**（排除 `mindfold-ai/trellis` 出处链接）。
3. **任务数量和迁移前一致，每张票的 `blocked_by` 都能解析**（对比迁移前后 `tasks/` 下的活跃与归档任务总数；遍历所有 JSON 合法的 `task.json`，验证其 `blocked_by` / `meta.blocked_by` 引用的目标任务在活跃或 `archive/` 任务中存在；对历史归档中原本 JSON 语法损坏的 `task.json` 容错跳过，不因陈旧损坏 JSON 崩溃）。
4. **会话启动钩子运行一次，能正常注入上下文**（在仓库根目录执行 `python ./.omtre/scripts/get_context.py` 或已安装平台的 `session-start.py`，验证退出码为 0 且输出非空）。

## Acceptance Criteria

- [ ] `omtre migrate --help` 显示 `--dry-run`、`--json`、`-y, --yes`、`--allow-dirty` 选项。
- [ ] 新增 `packages/cli/test/commands/migrate.test.ts`，覆盖：
  - `--dry-run` 与 `--json` 输出计划且不改动磁盘；
  - 完整迁移 `.trellis/` → `.omtre/`（三类文件处理、运行时缓存丢弃、`config.yaml`/`.gitignore`/`.gitattributes`/`AGENTS.md` 改写、`.migrated-from` 生成、4 项自检全部通过）；
  - 用户修改过的受管文件生成 `.backup` 并列出清单；
  - 幂等性（只有 `.omtre/` 时退出码 0 报告已迁移；两者并存时非零退出拒绝执行并提示回滚）；
  - 脏工作区默认拒绝、`--allow-dirty` 放行；
  - 低版本（如 `0.5.0`）拒绝执行；
  - 仓库外围文件（如自定义 `.env` 或脚本）只报告行号不修改。
- [ ] `pnpm check:legacy-names`、`pnpm build`、`pnpm typecheck`、`pnpm lint`、`pnpm --filter omtre test test/commands/migrate.test.ts` 全部通过。
