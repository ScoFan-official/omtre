# omtre migrate 合约：答案

用户 2026-10-19 全部按推荐确认。改名规则见 `10-19-rename-rules` 的 answer.md，事实输入见 `10-19-rename-surface` 的 answer.md。

## 1. 转换方式（分三类）

| 类别 | 范围 | 做法 |
|---|---|---|
| 受管文件 | 各平台钩子、设置、技能、命令、子代理；AGENTS.md 等指令文件的受管块 | 删掉旧文件，用 omtre 的 configurator 重新生成。用户改过的文件（和 `.template-hashes.json` 记录的哈希对不上）先另存一份 `<路径>.backup` 再替换，最后列出清单。沿用 `update` 已有的 backup-rename 机制。 |
| 用户数据 | `.trellis/` 下的 `tasks/`（包括 `archive/`）、`spec/`、`workspace/`、`domains/`、`agents/`、`config.yaml` 等 | 整个目录搬到 `.omtre/`。正文里形如 `.trellis/` 的路径改写成 `.omtre/`。品牌词 "Trellis" 不改。 |
| 运行时缓存 | `.runtime/`、`.backup-*`、`.current-task` 一类会话指针 | 不搬，直接丢弃。 |

## 2. 改写范围（收窄了 T3 的"残留由 migrate 改写"）

- **改写**：受管文件；`.omtre/` 数据；根目录的指令文件（AGENTS.md、CLAUDE.md 等），受管块以外的部分也改；`.gitignore`、`.gitattributes`。改写的对象包括 `.trellis/` 路径、`TRELLIS_*` 环境变量、`TRELLIS:*` 标记和 `/trellis:*` 命令。
- **只报告、不修改**：其它文件，比如用户的 CI 配置、脚本、`.env`。dry-run 和执行后都要列出文件和行号。

## 3. 前置条件

- 必须在 git 仓库里，工作区必须干净，否则拒绝执行。`--allow-dirty` 可以强行执行。
- 存在别的 worktree 或未合并的分支时，只警告不拒绝。警告里说明：这些分支合并时会出现改名冲突，建议先合并再迁。
- 存在正在运行的 channel 或 `omtre run` 工作进程时，拒绝执行。
- 源版本只支持当前的 oh-my-trellis 和原版 Trellis 0.6.x。更老的版本拒绝执行，并提示先用旧 CLI 升级。

## 4. 幂等

| 仓库状态 | 行为 |
|---|---|
| 只有 `.trellis/` | 执行迁移 |
| 只有 `.omtre/` | 报告"已经迁移过"，退出码 0 |
| 两者都有 | 说明上次迁到一半，拒绝执行，并提示用 git 回滚 |

迁移完成后写 `.omtre/.migrated-from`，记录源版本和时间。不支持中断后接着迁。

## 5. dry-run 和确认

- `--dry-run` 按第 1 节的三类分组列出计划：搬迁、重新生成、路径改写（共几处、分布在几个文件）、会留 `.backup` 的文件、只报告不改的文件。
- `--json` 输出同样的内容，格式为 JSON。
- 不带 `--dry-run` 时，先显示同样的计划，等用户确认。`--yes` 跳过确认。参数习惯和 `update` 一致。

## 6. 回滚

只靠 git。迁移结果不自动提交，用户看过 diff 再决定提不提交。回滚就是 `git restore` 加 `git clean`。不做 `--rollback`，也不做额外快照。

## 7. 用户主目录

`~/.trellis/channels` 不迁移，omtre 从全新的 `~/.omtre/channels` 开始。原目录不删，因为还有仓库在用旧 CLI。

## 8. 迁移后的验收

migrate 结束前自己检查下面 4 项。任何一项不通过，就以非零退出码结束，并列出问题。

1. 不再存在 `.trellis/`。
2. 在受管文件和 `.omtre/` 数据里，`.trellis/`、`TRELLIS_`、`/trellis:`、`TRELLIS:START` 的残留都是 0 处。
3. 任务数量和迁移前一致，每张票的 `blocked_by` 都能解析。
4. 会话启动钩子运行一次，能正常注入上下文。

## 给后续票的输入

- 施工顺序：先完成改名施工，让 omtre 的 configurator 能生成 `.omtre/` 版本的受管文件，再实现 migrate。第 1 节的"重新生成"依赖这一步。
- 第一个迁移对象是 omtre 仓库自己（自举）。验收标准就是第 8 节。
