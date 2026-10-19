# 新仓库组装：答案

2026-10-19 完成。用户确认了这几项：技能包并入根目录、marketplace 去子模块、docs-site 删除、仓库公开、合入 `oh-my/run-worker-supervisor-events`。

## 结果

| 项 | 结论 |
|---|---|
| 技能包落点 | **仓库根目录**（不用子目录）。以 unrelated-history merge 并入 `oh-my-trellis` main `821348e6`，30 个提交的历史保留。 |
| 根目录冲突 | `README.md`、`CHANGELOG.md` 用 CLI 版本；技能包版本改名为 `README.pack.md`、`CHANGELOG.pack.md`，等品牌改写时处理。`.gitignore` 取两边并集。 |
| `marketplace` gitlink | 去掉子模块，用 `git subtree add` 把 `mindfold-ai/marketplace@sco/voice-gate-wire` 连同历史并成普通目录。树哈希和原 gitlink `2c41c026` 一致。 |
| `marketplace/index.json` | 两边合并，共 10 条。spec 和 skill 的路径相对仓库根（template-fetcher 的约定），workflow 的路径相对 `marketplace/`（workflow-resolver 的约定）。 |
| `docs-site` gitlink | 删除；`.gitmodules` 删除；`.trellis/config.yaml` 去掉 `docs-site` 包。 |
| worktree 分支 | `oh-my/acp-adapter`、`roster-schema`、`run-ticket`、`until-empty` 都已在 trellis-fork main 里。唯一没合入的 `oh-my/run-worker-supervisor-events`（`068ff590`）按用户要求在本票合入。 |
| upstream | omtre 没有 `upstream` 远程，`origin` 只指向 omtre，硬分叉已断开。 |
| 远程 | `https://github.com/ScoFan-official/omtre`（public，默认分支 main） |
| 推送的 SHA | `713509c98666ec034c8d91bc4cdccf1c132152f2`（只推 main，没推继承来的 `v*-ohmy.*` tag） |

## 配套改动

- CI 的 Python 3.9 语法检查跳过 `catalog/`。`catalog/` 是原样拷贝的上游，里面有 3.10 语法，还有两个文件编不过。
- CI 的路径过滤 `marketplace` 改成 `marketplace/**`。
- pre-commit 去掉 `git submodule update --init marketplace`。

## 验证

- install、typecheck、lint 通过。core 398 个测试全部通过。
- CLI 有 17 个测试失败，和 trellis-fork 基线的数量相同，都是 Windows 环境问题。两边相差的 2 个用例单独重跑后通过，属于不稳定用例。
- GitNexus 闸门没有跑：本机没有索引，本票也没有改任何符号。

## 给后续票的输入

- 发布流水线已经坏了，归"发布流水线"迷雾：`packages/cli/scripts/release.js` 还在把 docs-site 和 marketplace 当子模块排除；`check-docs-changelog.js` 要求 docs-site 存在；`.github/workflows/cli-release.yml` 会去克隆 `ScoFan-official/trellis`。
- `template-fetcher.ts` 的 `TEMPLATE_INDEX_URL` 还指向 `ScoFan-official/oh-my-trellis`，归改名施工票。
- `assets/trellis-demo-zh.gif` 有 58 MB，超过 GitHub 建议的 50 MB 上限。
- 首次推送没有触发 CI，`ci.yml` 也没有 `workflow_dispatch`。下一次改到 CI 过滤路径的推送才会第一次跑 CI。
