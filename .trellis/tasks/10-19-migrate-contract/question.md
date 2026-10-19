# omtre migrate 合约：转换范围、幂等、dry-run、回滚与保护

Type: grilling
Status: open
Blocked by: .trellis/tasks/10-19-rename-rules
Map: .trellis/tasks/10-19-omtre-standalone/map.md

## Question

已定：提供一次性迁移动词 `omtre migrate`，把一个 Trellis（或 oh-my-trellis）管理的仓库从 `.trellis/` 转成 `.omtre/`，不做两套目录并行读取。第一个迁移对象是 omtre 仓自己（自举）。

和用户定下合约：

- 转换范围：目录搬迁、各平台钩子和设置、技能目录与技能名、AGENTS.md 受管块、配置文件、`.gitattributes` 等；
- 幂等性：重复运行的行为；
- dry-run 输出什么；
- 回滚方式；
- 遇到未提交改动、活跃任务、domains 旗位和 worklog 时怎么处理；
- 迁移后的验收检查。
