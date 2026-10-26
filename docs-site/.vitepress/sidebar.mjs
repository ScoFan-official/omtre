export const nav = [
  { text: "开始使用", link: "/start/what-is-omtre" },
  { text: "使用指南", link: "/guide/tasks" },
  { text: "进阶", link: "/advanced/architecture" },
  { text: "参考", link: "/reference/cli" },
  { text: "资源", link: "/resources/skills" },
];

export const sidebar = {
  "/start/": [
    {
      text: "开始使用",
      items: [
        { text: "认识 omtre", link: "/start/what-is-omtre" },
        { text: "安装与第一个任务", link: "/start/install-and-first-task" },
        { text: "工作原理", link: "/start/how-it-works" },
        { text: "日常使用", link: "/start/everyday-use" },
        { text: "真实场景", link: "/start/real-world-scenarios" },
      ],
    },
  ],
  "/guide/": [
    {
      text: "核心工作流",
      items: [
        { text: "任务与 PRD", link: "/guide/tasks" },
        { text: "规范系统", link: "/guide/specs" },
        { text: "项目记忆与日志", link: "/guide/workspace-memory" },
        { text: "质量检查与提交", link: "/guide/quality-and-commit" },
      ],
    },
    {
      text: "运行与维护",
      items: [
        { text: "多平台接入", link: "/guide/platforms" },
        { text: "升级、回滚与卸载", link: "/guide/upgrade-and-remove" },
      ],
    },
  ],
  "/advanced/": [
    {
      text: "理解与配置",
      items: [
        { text: "架构总览", link: "/advanced/architecture" },
        { text: "配置参考", link: "/advanced/configuration" },
      ],
    },
    {
      text: "扩展 omtre",
      items: [
        { text: "自定义工作流", link: "/advanced/custom-workflow" },
        { text: "自定义命令", link: "/advanced/custom-commands" },
        { text: "自定义子代理", link: "/advanced/custom-agents" },
        { text: "Hooks", link: "/advanced/hooks" },
        {
          text: "Skills 与规范模板",
          link: "/advanced/skills-and-marketplace",
        },
      ],
    },
    {
      text: "运行与恢复",
      items: [
        { text: "Channel 多代理协作", link: "/advanced/channel" },
        { text: "omtre run 无人值守运行", link: "/advanced/unattended-run" },
        /* omtre:upstream-attribution:start */
        { text: "从 Trellis 迁移", link: "/advanced/migration" },
        /* omtre:upstream-attribution:end */
        { text: "消融与恢复", link: "/advanced/ablate-and-restore" },
        { text: "故障排查", link: "/advanced/troubleshooting" },
      ],
    },
  ],
  "/reference/": [
    {
      text: "参考",
      items: [
        { text: "CLI 命令", link: "/reference/cli" },
        { text: "命令与技能速查", link: "/reference/commands-and-skills" },
        { text: "关键文件路径", link: "/reference/paths" },
        { text: "task.json Schema", link: "/reference/task-schema" },
        { text: "JSONL 上下文格式", link: "/reference/jsonl-context" },
        { text: "平台支持矩阵", link: "/reference/platform-matrix" },
        { text: "FAQ", link: "/reference/faq" },
      ],
    },
  ],
  "/resources/": [
    {
      text: "资源",
      items: [
        { text: "Skills", link: "/resources/skills" },
        { text: "规范模板", link: "/resources/spec-templates" },
        { text: "使用案例", link: "/resources/use-cases" },
        { text: "参与贡献", link: "/resources/contributing" },
        { text: "更新日志", link: "/resources/changelog" },
      ],
    },
  ],
};
