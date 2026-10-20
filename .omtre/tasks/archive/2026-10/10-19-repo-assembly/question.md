# 新仓库组装：并入技能包历史、切断 upstream、建 GitHub 仓库并推送

Type: task
Status: resolved
Blocked by: None
Map: .omtre/tasks/10-19-omtre-standalone/map.md

## Question

本地仓库 `D:\AI agent Projects\omtre` 已从 omtre-fork 克隆（保留完整历史）。完成余下的组装，让 omtre 成为单仓框架的权威家：

1. 把技能包仓（`ScoFan-official/omtre`，本机副本 `D:\AI agent Projects\Laber\tools\mp-omtre-pack`）连同 git 历史并进本仓的一个子目录（如 `git subtree add`）。子目录名在本票内定，并在 answer.md 记录。
2. 处理 fork 现有的 `marketplace` gitlink（它指向技能包仓），避免与并入的子目录重复。
3. 确认 `omtre-fork-wt-*` 几个 worktree 分支是否已合入 omtre-fork main；未合入的列出来，不在本票合并。
4. 切断 `upstream`（mindfold-ai/trellis）远程，这标志正式硬分叉。
5. 建 GitHub 仓库 `ScoFan-official/omtre`，设为 origin 并推送。**建仓和推送前必须向用户确认。**

解决标准：answer.md 记录子目录名、gitlink 处理方式、未合入的 worktree 分支清单、远程 URL、推送的 SHA。
