# 贡献指南

感谢你对 omtre 的关注！本文档提供参与项目贡献的指南。

## 贡献方式

### 报告 Bug

提交 Bug 前，请先查看 [已有 Issues](https://github.com/ScoFan-official/omtre/issues) 避免重复。

报告 Bug 时请包含：
- omtre 版本 (`omtre --version`)
- Node.js 版本 (`node --version`)
- 操作系统
- 复现步骤
- 预期行为 vs 实际行为
- 相关日志或截图

### 功能建议

欢迎提交功能请求！请开一个 Issue 并包含：
- 功能的清晰描述
- 使用场景 / 解决的问题
- 实现思路（可选）

### 改进文档

文档改进永远受欢迎：

- 修复错别字或表述不清的地方
- 添加示例
- 改进 README 或指南文档
- 改进 `docs-site/` 下的中文文档站

新增或重组页面前，请先阅读[文档贡献指南](https://scofan-official.github.io/omtre/resources/contributing.html)。

### 贡献代码

欢迎以下类型的代码贡献：
- Bug 修复
- 新功能（请先在 Issue 中讨论）
- 性能优化
- 测试覆盖

## 开发环境设置

### 前置要求

- Node.js 18.17.0+
- pnpm
- Python 3.9+（用于 hooks）
- Bash（用于脚本）

### 开始开发

1. **Fork 仓库** 到你的 GitHub 账号

2. **克隆你的 Fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/omtre.git
   cd omtre
   ```

3. **安装依赖**
   ```bash
   pnpm install
   ```

4. **构建项目**
   ```bash
   pnpm build
   ```

### 运行检查

```bash
pnpm lint               # TypeScript ESLint 检查 + 旧名门禁
pnpm --filter omtre lint:py # Python 类型检查 (basedpyright)
pnpm typecheck          # TypeScript 类型检查
pnpm check:legacy-names # 品牌/旧名门禁
pnpm docs:verify        # 文档内容、CLI 参考、快速上手与站点构建检查
```

> **注意：** 提交时 pre-commit hook 会自动对暂存的 `.ts` 文件运行 `eslint --fix` 和 `prettier --write`。

## 项目结构

```
omtre/
├── packages/
│   ├── cli/                # CLI 二进制、命令、配置器与模板
│   └── core/               # 打包进 CLI 的 channel/task/memory SDK
├── skills/                 # 一线技能
├── marketplace/            # 技能、Spec 模板、工作流与注册表
├── catalog/                # vendored 目录资产（不要原地修改）
├── .claude/                # Claude Code 配置（项目自用）←
├── .omtre/                 # omtre 工作流（项目自用）←
├── docs-site/              # 中文用户文档站（VitePress）
├── docs/                   # 产品与维护者文档
└── scripts/                # 仓库工具
```

> **重要：** 修改 `.claude/`、`.omtre/` 或 `.cursor/` 时，请检查是否需要同步更新 `src/templates/`。项目使用自己的配置文件，但模板才是安装到用户项目的内容。

## 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
type(scope): description
```

**类型：**
- `feat` - 新功能
- `fix` - Bug 修复
- `docs` - 文档变更
- `refactor` - 代码重构
- `test` - 添加或更新测试
- `chore` - 维护任务

**示例：**
```
feat(cli): add --dry-run flag to init command
fix(hooks): resolve context injection for nested tasks
docs(readme): update quick start instructions
```

## Pull Request 流程

1. **从 `main` 创建分支**
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **进行修改**，遵循提交规范

3. **确保检查通过**
   ```bash
   pnpm lint && pnpm typecheck
   ```

4. **推送到你的 Fork**
   ```bash
   git push origin feat/your-feature-name
   ```

5. **向 `main` 分支发起 Pull Request**
   - 提供清晰的变更描述
   - 关联相关 Issue
   - UI 变更请附截图

6. **根据反馈进行修改**

## 发布

维护者请见 [docs/release.md](./docs/release.md)：npm 与 GitHub Release 的发布流程、版本策略与 token 配置。

## 感谢

每一份贡献都让 omtre 变得更好。感谢你的付出！
