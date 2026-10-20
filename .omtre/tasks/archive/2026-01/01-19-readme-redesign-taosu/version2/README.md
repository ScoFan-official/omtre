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
  <strong>Workflow templates for AI coding assistants</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/omtre"><img src="https://img.shields.io/npm/v/omtre" alt="npm"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
</p>

<p align="center">
  <a href="#install">Install</a> •
  <a href="./docs/README.md">Docs</a> •
  <a href="./README-zh.md">中文</a>
</p>

---

## Install

```bash
npm install -g omtre@latest
cd your-project && trellis init -u your-name
```

## Use

```
/start                    # Begin session
/parallel                 # Multi-agent pipeline
/record-agent-flow        # Save progress
```

## What's Inside

```
.omtre/
├── structure/       → Development guidelines
├── agent-traces/    → Session history
└── scripts/         → Automation
```

## Works With

- [Claude Code](https://claude.ai/code) — Full support
- [Cursor](https://cursor.sh) — Commands only

## Links

- [Documentation](./docs/README.md)
- [GitHub Issues](https://github.com/mindfoldhq/trellis/issues)

---

<p align="center">
  <sub>MIT License • <a href="https://mindfold.com">Mindfold</a></sub>
</p>
