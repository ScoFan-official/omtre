# pstack 调研：/correct 机制、修正阶梯、playbook 路由与许可证

Type: research
Status: resolved
Blocked by: None
Map: .trellis/tasks/10-19-omtre-standalone/map.md

## Question

用户希望把 poteto（Lauren Tan）的 pstack 优点吸收进 omtre。参考视频 BV1nVpy6QEMx 的简介要点：`/correct` 把 Agent 犯两次的错变成仓库强制规则；修正阶梯为架构 > 类型 > lint > 测试 > 人审（NGMI）；新检查必须拿历史错误跑出红才算数；一条命令路由 23 个 playbook、内置 50 个 skills；完整循环含复现、How/Why 找根因、双案设计加裁判打分、三模型拆解、夜班验证小队；指令瘦身（删 34 条指令，A/B 测试 142/154 对 139）。

来源：
- pstack 仓库 https://github.com/cursor/plugins/tree/main/pstack
- 原视频 https://www.youtube.com/watch?v=6puKyBbZEGY（B 站搬运无字幕，取 YouTube 字幕）
- /correct 发布帖 https://x.com/poteto/status/2106542593656111276

查清：
1. `/correct` 的具体流程：输入、怎么从提交和回滚历史找模式、产出什么、写到哪里；
2. 修正阶梯每一档在仓库里的落地形态；
3. playbook 路由怎么做；
4. pstack 的许可证，以及能否与 AGPL-3.0 兼容地原样拷贝；
5. 与 omtre 现有能力（`trellis-break-loop`、`rules-audit`、`hygiene-sweep`、三档闸门）的重叠和空白。

解决标准：research 文件和 answer.md 给出以上五点，每条事实附来源链接。
