# 框架收尾：单 tgz 内嵌 @omtre/core 打包、单仓 Release 流水线与旧票清理

## Goal

完成 `omtre` 首版独立框架的最后三项收尾基建（将两个吸收机制试点 `/correct` 与 Firefox 原则移出首版阻塞项）：
1. **单 `.tgz` 独立安装闭环**：将 `@omtre/core` 内嵌进 `omtre-*.tgz`（`bundledDependencies` + 打包前拷贝构建产物到 `packages/cli/node_modules/@omtre/core` 并在打包后清理恢复），使不发公开 npm 的情况下，用户执行 `npm i -g <omtre-*.tgz>` 即可零外部私有包依赖完成安装，且 `omtre --version`、`omt --version`、`omtre migrate --help` 均可正常运行。
2. **单仓 GitHub Release 流水线修正**：修正 `.github/workflows/cli-release.yml` 与 `.github/workflows/release.yml`，去掉旧双仓分叉时代的“剥去 `cli-` 前缀再去 clone 另一个 `v*` tag”逻辑，改为直接 `actions/checkout@v4` 检出当前 tag，执行 `pnpm install --frozen-lockfile && pnpm build` 并打包发布 `omtre-*.tgz`。
3. **安装/升级说明对齐与上游遗留活跃票归档**：更新 `.devin/workflows/oh-my-update.md`、`packages/cli/src/templates/devin/workflows/oh-my-update.md`、`README.md`、`README.pack.md`、`README.zh-CN.md`、`.omtre/tasks/10-19-omtre-standalone/map.md`，并将从上游继承来的 12 张陈旧未完结票（`06-17`～`09-09`）归档，使活跃任务面板只保留 `omtre` 自身任务。

## Requirements

### 1. `omtre-*.tgz` 内嵌 `@omtre/core` 独立安装闭环
- 在 `packages/cli/package.json` 中配置 `"bundleDependencies": ["@omtre/core"]`（或 `"bundledDependencies": ["@omtre/core"]`），并新增 `prepack` / `postpack` 脚本（通过 `packages/cli/scripts/bundle-core.mjs` 或等价脚本）：
  - `prepack`：确保 `packages/core/dist` 已构建，将 `packages/core/package.json`（移除 `devDependencies`/`scripts`）与 `packages/core/dist` 作为实体目录写入 `packages/cli/node_modules/@omtre/core`（若原本是 workspace 软链则先暂存/移除软链，写入实体目录供 `pnpm pack` / `npm-packlist` 打入 tarball `package/node_modules/@omtre/core/`）。
  - `postpack`：恢复 `packages/cli/node_modules/@omtre/core` 原本的 workspace 软链状态，不污染本地开发环境。
- 更新 `packages/cli/scripts/release-preflight.js`（以及 `packages/core/package.json` 版本号对齐或 `verify-packed-cli` 校验），校验打包出的 `.tgz` 内同时包含 `package/node_modules/@omtre/core/dist/index.js` 与 `bundleDependencies`。
- 新增或更新单测，并在临时目录实测 `npm install -g <packed.tgz> --prefix <tmpDir>`，验证 `omtre --version`、`omt --version`、`omtre migrate --help` 退出码为 `0`。

### 2. 单仓 GitHub Release 流水线（`.github/workflows/cli-release.yml` & `release.yml`）
- `.github/workflows/cli-release.yml`：
  - 触发器保持 `tags: ["cli-v*"]`（与 `omtre upgrade` 及 `oh-my-update` 的 `cli-v*` 检索合约一致）。
  - 移除 `Derive fork tag` 与 `git clone --branch v*` 步骤，改为 `uses: actions/checkout@v4`。
  - 执行 `pnpm install --frozen-lockfile`、`pnpm build`、`pnpm --filter omtre pack --pack-destination "$GITHUB_WORKSPACE"`，再用 `gh release create "$GITHUB_REF_NAME" omtre-*.tgz --generate-notes --repo "${{ github.repository }}"` 发布。
- `.github/workflows/release.yml`：
  - 将构建命令统一为 `pnpm build`（先构建 `@omtre/core` 再构建 `omtre`），确保 `workflow_dispatch` 测试打包产物完整。

### 3. 文档/工作流对齐与上游旧票归档
- 更新 `packages/cli/src/templates/devin/workflows/oh-my-update.md` 与 `.devin/workflows/oh-my-update.md` 中关于“双 tag（`cli-v<ver>` 与 `v<ver>`）”的旧维护者说明，改为单仓直接打 `cli-v<ver>` tag 推送即可触发构建发布。
- 归档从旧上游继承的 12 张陈旧活跃任务（`06-17-architecture-diagram`、`06-17-benchmark-showcase`、`07-23-codex-inline-default-agent-model`、`08-05-session-identity-propagation` 及其 4 张子票、`08-06-converge-platform-templates`、`08-06-mem-full-recall`、`08-06-purge-stale-references`、`09-09-codex-session-fallback-isolation`）。
- 更新 `.omtre/tasks/10-19-omtre-standalone/map.md`：将本票记入 `Tickets`，将 `Not yet specified` 中已完成的项划除，并将两个吸收机制试点标注为非阻塞后续演进项。

## Acceptance Criteria

- [ ] `pnpm --filter omtre pack` 产出的 `omtre-*.tgz` 内含 `package/node_modules/@omtre/core/dist/index.js`，且在隔离临时目录执行 `npm i -g <tgz> --prefix <tmp>` 成功（不访问 npm 拉取 `@omtre/core`），安装的 `omtre --version` 与 `omt --version` 正常输出版本号。
- [ ] `.github/workflows/cli-release.yml` 已改为单仓直接 `actions/checkout@v4` + `pnpm build` + `pnpm pack`。
- [ ] 12 张上游遗留活跃票已全部归档，`python ./.omtre/scripts/task.py list` 仅展示 `10-19-omtre-standalone` 及其子任务。
- [ ] `pnpm check:legacy-names`（`post-bootstrap` 模式）、`pnpm build`、`pnpm typecheck`、`pnpm lint`、`pnpm --filter omtre lint:py`、`pnpm test:core` 全部通过。
