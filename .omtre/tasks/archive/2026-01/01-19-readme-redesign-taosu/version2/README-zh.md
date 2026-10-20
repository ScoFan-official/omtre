<!-- 🖼️ [IMAGE] Logo: 居中显示的品牌 Logo
     尺寸: 120x120 (已设置)
     文件: trellis.png
     注意: 极简风格只需要 Logo，不需要其他图片
-->
<p align="center">
  <img src="./trellis.png" alt="Trellis" width="120" />
</p>

<h1 align="center">Trellis</h1>

<p align="center">
  <strong>AI 编程助手的工作流模板</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/omtre"><img src="https://img.shields.io/npm/v/omtre" alt="npm"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

<p align="center">
  <a href="#安装">安装</a> •
  <a href="./docs/README.md">文档</a> •
  <a href="./README.md">English</a>
</p>

---

## 安装

```bash
npm install -g omtre@latest
cd your-project && trellis init -u your-name
```

## 使用

```
/start                    # 开始会话
/parallel                 # 多 Agent 流水线
/record-agent-flow        # 保存进度
```

## 目录结构

```
.omtre/
├── structure/       → 开发规范
├── agent-traces/    → 会话历史
└── scripts/         → 自动化脚本
```

## 支持工具

- [Claude Code](https://claude.ai/code) — 完整支持
- [Cursor](https://cursor.sh) — 仅命令

## 链接

- [文档](./docs/README.md)
- [GitHub Issues](https://github.com/mindfoldhq/trellis/issues)

---

<p align="center">
  <sub>MIT 许可证 • <a href="https://mindfold.com">Mindfold</a></sub>
</p>
