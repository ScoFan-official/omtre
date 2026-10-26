<script setup lang="ts">
import { useData, withBase } from "vitepress";

const { theme } = useData();
const version = theme.value.omtreVersion as string;

const paths = [
  {
    index: "01",
    eyebrow: "第一次使用",
    title: "从安装走到第一个任务",
    copy: "用真实业务小功能完成一次计划、实现、验证和归档，而不是只看功能列表。",
    link: "/start/install-and-first-task.html",
    action: "开始上手",
  },
  {
    index: "02",
    eyebrow: "已有项目",
    title: "把隐含约定变成仓库上下文",
    copy: "先识别真实模式，再选择一个低风险试点任务，避免把空泛规则写进规范库。",
    link: "/start/real-world-scenarios.html",
    action: "查看接入路径",
  },
  {
    index: "03",
    eyebrow: "团队评估",
    title: "先试点，再决定是否推广",
    copy: "看清平台差异、质量门边界、维护成本和两周试点的退出标准。",
    link: "/reference/platform-matrix.html",
    action: "查看能力边界",
  },
];

const steps = [
  {
    number: "01",
    title: "会话开始",
    copy: "注入项目规范索引、当前任务和最近工作状态。",
  },
  {
    number: "02",
    title: "计划",
    copy: "把需求写成 PRD；复杂任务再补设计、执行计划和上下文清单。",
  },
  {
    number: "03",
    title: "实现",
    copy: "在任务边界内修改代码。实现不会自动提交或推送。",
  },
  {
    number: "04",
    title: "检查",
    copy: "按规范审查，并运行仓库真实存在的 lint、类型检查和测试。",
  },
  {
    number: "05",
    title: "收尾",
    copy: "人工确认 diff，提交、归档任务，再记录本次会话。",
  },
];
</script>

<template>
  <div class="home-shell">
    <section class="hero-section">
      <div class="hero-copy">
        <a
          class="release-pill"
          :href="`https://github.com/ScoFan-official/omtre/releases/tag/cli-v${version}`"
          target="_blank"
          rel="noreferrer"
        >
          <span class="release-dot" />
          v{{ version }} · 中文文档
          <span aria-hidden="true">↗</span>
        </a>
        <h1>
          让每一次 AI 编码<br />
          <span class="accent">都沿着项目约定进行。</span>
        </h1>
        <p class="hero-lead">
          omtre 把规范、任务和项目记忆留在仓库里。换一个会话、换一个代理，
          它仍然知道该怎么做、这次在做什么、上次留下了什么。
        </p>
        <div class="hero-actions">
          <a class="action-primary" :href="withBase('/start/install-and-first-task.html')">
            从第一个任务开始
            <span aria-hidden="true">→</span>
          </a>
          <a class="action-secondary" :href="withBase('/start/how-it-works.html')">
            先理解工作方式
          </a>
        </div>
        <p class="hero-note">
          需要 Node.js 18.17+ 与 Python 3.9+，并已安装一个可用的编码代理。
        </p>
      </div>

      <div class="terminal-card" aria-label="omtre 安装和初始化示意">
        <div class="terminal-bar">
          <span class="terminal-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>your-project — bash</span>
          <span class="terminal-status">本地</span>
        </div>
        <div class="terminal-body">
          <p><span class="prompt">$</span> npm install -g omtre</p>
          <p><span class="prompt">$</span> omtre init -u your-name --qoder</p>
          <div class="terminal-output">
            <p><span class="check">✓</span> 工作流与项目脚本已写入</p>
            <p><span class="check">✓</span> Qoder 平台文件已生成</p>
            <p><span class="check">✓</span> 个人工作区已创建</p>
          </div>
          <p class="comment"># 打开代理，描述你要完成的业务小功能</p>
          <p><span class="prompt">›</span> 先不要改代码，帮我评估这个需求…<span class="cursor" /></p>
        </div>
        <div class="terminal-caption">
          <span>.omtre/ spine</span>
          <span>repo-native</span>
          <span>human delivery</span>
        </div>
      </div>
    </section>

    <section class="start-paths">
      <div class="section-heading">
        <p class="eyebrow">Choose your route</p>
        <h2>从你现在的位置开始</h2>
        <p>文档按任务组织，而不是按内部模块名组织。</p>
      </div>
      <div class="path-grid">
        <a
          v-for="path in paths"
          :key="path.index"
          class="path-card"
          :href="withBase(path.link)"
        >
          <span class="path-index">{{ path.index }}</span>
          <span class="path-eyebrow">{{ path.eyebrow }}</span>
          <h3>{{ path.title }}</h3>
          <p>{{ path.copy }}</p>
          <span class="path-action">{{ path.action }} <span aria-hidden="true">→</span></span>
        </a>
      </div>
    </section>

    <section class="workflow-section">
      <div class="section-heading section-heading-compact">
        <p class="eyebrow">One durable loop</p>
        <h2>一次任务，留下五类可复查证据</h2>
      </div>
      <div class="workflow-steps">
        <article v-for="step in steps" :key="step.number" class="workflow-step">
          <span>{{ step.number }}</span>
          <h3>{{ step.title }}</h3>
          <p>{{ step.copy }}</p>
        </article>
      </div>
    </section>

    <section class="spine-section">
      <div class="spine-copy">
        <p class="eyebrow">Repo-native state</p>
        <h2>事实留在仓库里，不藏在聊天记录里</h2>
        <p>
          omtre 用一个 <code>.omtre/</code> 主轴承载团队规范、任务产物、个人日志和运行脚本。
          审查者看到的材料，与代理工作时读取的材料是同一份。
        </p>
        <a :href="withBase('/guide/specs.html')">了解规范系统 <span aria-hidden="true">→</span></a>
      </div>
      <div class="file-tree" aria-label=".omtre 目录结构示意">
        <p class="file-tree-title">your-project/</p>
        <ul>
          <li><span class="folder">.omtre/</span></li>
          <li class="level-2"><span class="folder">spec/</span><span>团队规范与领域规则</span></li>
          <li class="level-2"><span class="folder">tasks/</span><span>PRD、设计、计划与上下文</span></li>
          <li class="level-2"><span class="folder">workspace/</span><span>开发者日志与项目记忆</span></li>
          <li class="level-2"><span class="folder">agents/</span><span>实现、检查、研究角色卡</span></li>
          <li class="level-2"><span class="folder">scripts/</span><span>任务、验证与上下文脚本</span></li>
          <li><span class="folder">.qoder/</span><span class="muted">按所选平台生成</span></li>
          <li><span class="folder">AGENTS.md</span><span class="muted">代理入口约定</span></li>
        </ul>
      </div>
    </section>

    <section class="boundary-section">
      <div class="boundary-card boundary-stable">
        <MaturityBadge level="stable" />
        <h3>仓库内工作流</h3>
        <p>规范、任务、日志、验证脚本和归档都有真实文件与自动化测试。</p>
        <a :href="withBase('/start/how-it-works.html')">工作原理</a>
      </div>
      <div class="boundary-card boundary-mixed">
        <MaturityBadge level="mixed" />
        <h3>22 个平台适配</h3>
        <p>同一套核心布局，但 hooks、命令与子代理由宿主决定，深度并不相同。</p>
        <a :href="withBase('/reference/platform-matrix.html')">平台矩阵</a>
      </div>
      <div class="boundary-card boundary-advanced">
        <MaturityBadge level="advanced" />
        <h3>无人值守运行</h3>
        <p>worktree、验证和交付门已实现，真实长期无人运行仍需试点与人工把关。</p>
        <a :href="withBase('/advanced/unattended-run.html')">运行边界</a>
      </div>
    </section>

    <section class="platform-section">
      <div>
        <p class="eyebrow">Bring your own agent</p>
        <h2>不绑定模型，也不要求更换编辑器</h2>
        <p>
          omtre 为 22 个编码代理生成平台文件。建议从你的团队实际使用的 1–2 个宿主开始，
          不要把“生成配置文件”当成“所有平台已完成端到端验证”。
        </p>
        <a :href="withBase('/guide/platforms.html')">选择你的平台 <span aria-hidden="true">→</span></a>
      </div>
      <div class="platform-list" aria-label="部分支持平台">
        <span>Claude Code</span>
        <span>Codex</span>
        <span>Qoder</span>
        <span>Cursor</span>
        <span>Copilot</span>
        <span>OpenCode</span>
        <span>Gemini CLI</span>
        <span>Kiro</span>
        <span class="platform-more">另有 14 个适配目标</span>
      </div>
    </section>

    <section class="closing-section">
      <p class="eyebrow">Start with one real task</p>
      <h2>不要先配置一套完美规范。<br />先完成一个值得复查的任务。</h2>
      <div class="hero-actions closing-actions">
        <a class="action-primary" :href="withBase('/start/install-and-first-task.html')">
          安装 omtre
          <span aria-hidden="true">→</span>
        </a>
        <a class="action-secondary" href="https://github.com/ScoFan-official/omtre" target="_blank" rel="noreferrer">
          查看 GitHub
        </a>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-shell {
  width: 100%;
  overflow: hidden;
}

.hero-section {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(360px, 0.92fr);
  gap: clamp(2.5rem, 6vw, 6rem);
  align-items: center;
  max-width: 1240px;
  margin: 0 auto;
  padding: clamp(4.25rem, 8vw, 7.5rem) 2rem clamp(4rem, 8vw, 7rem);
}

.hero-section::before {
  position: absolute;
  z-index: -1;
  top: -6rem;
  left: 8%;
  width: 36rem;
  height: 36rem;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(47, 129, 247, 0.13), transparent 66%);
  content: "";
  pointer-events: none;
}

.release-pill {
  display: inline-flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.34rem 0.72rem;
  border: 1px solid var(--home-line);
  border-radius: 999px;
  color: var(--vp-c-text-2);
  background: var(--home-panel);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-decoration: none;
  transition: border-color 0.2s ease, color 0.2s ease;
}

.release-pill:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.release-dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 50%;
  background: #2da44e;
  box-shadow: 0 0 0 4px rgba(45, 164, 78, 0.12);
}

.hero-copy h1 {
  max-width: 770px;
  margin: 1.35rem 0 1.25rem;
  color: var(--vp-c-text-1);
  font-size: clamp(2.55rem, 4.1vw, 3.55rem);
  font-weight: 780;
  letter-spacing: -0.055em;
  line-height: 1.08;
  text-wrap: balance;
}

.accent {
  display: inline-block;
  color: var(--vp-c-brand-1);
}

.hero-lead {
  max-width: 620px;
  color: var(--vp-c-text-2);
  font-size: clamp(1rem, 1.7vw, 1.18rem);
  line-height: 1.8;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  margin-top: 1.9rem;
}

.action-primary,
.action-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  min-height: 2.8rem;
  padding: 0.65rem 1.15rem;
  border-radius: 0.6rem;
  font-size: 0.92rem;
  font-weight: 650;
  text-decoration: none;
  transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.action-primary {
  color: #fff;
  background: #1f6feb;
  box-shadow: 0 8px 24px rgba(31, 111, 235, 0.2);
}

.action-primary:hover {
  background: #1a63d1;
  transform: translateY(-1px);
}

.action-secondary {
  border: 1px solid var(--home-line-strong);
  color: var(--vp-c-text-1);
  background: var(--home-panel);
}

.action-secondary:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.hero-note {
  margin-top: 1.15rem;
  color: var(--vp-c-text-3);
  font-size: 0.8rem;
}

.terminal-card {
  overflow: hidden;
  border: 1px solid #30363d;
  border-radius: 0.9rem;
  background: #0d1117;
  box-shadow: 0 30px 90px rgba(11, 15, 20, 0.22);
  transform: rotate(0.35deg);
}

.terminal-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.72rem 0.9rem;
  border-bottom: 1px solid #21262d;
  color: #8b949e;
  background: #161b22;
  font-family: var(--vp-font-family-mono);
  font-size: 0.7rem;
}

.terminal-dots {
  display: inline-flex;
  gap: 0.32rem;
}

.terminal-dots i {
  width: 0.52rem;
  height: 0.52rem;
  border-radius: 50%;
  background: #30363d;
}

.terminal-dots i:first-child {
  background: #ff7b72;
}

.terminal-dots i:nth-child(2) {
  background: #d29922;
}

.terminal-dots i:nth-child(3) {
  background: #3fb950;
}

.terminal-status {
  color: #7ee787;
}

.terminal-body {
  min-height: 330px;
  padding: 1.5rem 1.35rem;
  color: #c9d1d9;
  font-family: var(--vp-font-family-mono);
  font-size: clamp(0.68rem, 1.25vw, 0.78rem);
  line-height: 1.65;
}

.terminal-body p {
  margin: 0 0 0.45rem;
  white-space: nowrap;
}

.prompt {
  color: #7ee787;
}

.check {
  color: #3fb950;
}

.terminal-output {
  margin: 0.75rem 0 1rem;
  padding-left: 0.7rem;
  border-left: 1px solid #30363d;
  color: #8b949e;
}

.comment {
  margin-top: 1.5rem !important;
  color: #6e7681;
}

.cursor {
  display: inline-block;
  width: 0.55em;
  height: 1.05em;
  margin-left: 0.25rem;
  background: #7ee787;
  vertical-align: -0.13em;
  animation: blink 1.2s step-end infinite;
}

.terminal-caption {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.8rem 1rem;
  border-top: 1px solid #21262d;
  color: #8b949e;
  background: #0b0f14;
  font-family: var(--vp-font-family-mono);
  font-size: 0.65rem;
}

.terminal-caption span {
  padding: 0.15rem 0.42rem;
  border: 1px solid #21262d;
  border-radius: 0.3rem;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

.start-paths,
.workflow-section,
.spine-section,
.boundary-section,
.platform-section,
.closing-section {
  max-width: 1240px;
  margin: 0 auto;
  padding: 4.5rem 2rem;
}

.start-paths {
  border-top: 1px solid var(--home-line);
}

.section-heading {
  max-width: 720px;
  margin-bottom: 2.2rem;
}

.eyebrow {
  margin: 0 0 0.55rem;
  color: var(--vp-c-brand-1);
  font-family: var(--vp-font-family-mono);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.section-heading h2,
.spine-copy h2,
.platform-section h2,
.closing-section h2 {
  margin: 0;
  color: var(--vp-c-text-1);
  font-size: clamp(1.55rem, 3vw, 2.25rem);
  letter-spacing: -0.035em;
  line-height: 1.22;
}

.section-heading > p:last-child,
.spine-copy > p,
.platform-section > div > p {
  margin-top: 0.8rem;
  color: var(--vp-c-text-2);
  line-height: 1.75;
}

.path-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.path-card {
  display: flex;
  flex-direction: column;
  min-height: 280px;
  padding: 1.4rem;
  border: 1px solid var(--home-line);
  border-radius: 0.8rem;
  color: inherit;
  background: var(--home-panel);
  text-decoration: none;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.path-card:hover {
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 45%, var(--home-line));
  box-shadow: 0 12px 36px rgba(11, 15, 20, 0.07);
  transform: translateY(-3px);
}

.path-card:hover .path-action {
  color: var(--vp-c-brand-1);
}

.path-index {
  color: var(--vp-c-text-3);
  font-family: var(--vp-font-family-mono);
  font-size: 0.7rem;
}

.path-eyebrow {
  margin-top: 2.2rem;
  color: var(--vp-c-brand-1);
  font-size: 0.73rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.path-card h3 {
  margin: 0.42rem 0 0.65rem;
  font-size: 1.2rem;
  letter-spacing: -0.02em;
  line-height: 1.4;
}

.path-card p {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
  line-height: 1.65;
}

.path-action {
  margin-top: auto;
  padding-top: 1.3rem;
  color: var(--vp-c-text-2);
  font-size: 0.82rem;
  font-weight: 650;
}

.workflow-section {
  border-top: 1px solid var(--home-line);
}

.section-heading-compact {
  margin-bottom: 1.8rem;
}

.workflow-steps {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  border: 1px solid var(--home-line);
  border-radius: 0.8rem;
  background: var(--home-panel);
}

.workflow-step {
  position: relative;
  padding: 1.35rem;
  border-left: 1px solid var(--home-line);
}

.workflow-step:first-child {
  border-left: 0;
}

.workflow-step > span {
  color: var(--vp-c-brand-1);
  font-family: var(--vp-font-family-mono);
  font-size: 0.7rem;
}

.workflow-step h3 {
  margin: 0.9rem 0 0.5rem;
  font-size: 1rem;
}

.workflow-step p {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.82rem;
  line-height: 1.65;
}

.spine-section {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(340px, 1.05fr);
  gap: clamp(2rem, 7vw, 6rem);
  align-items: center;
}

.spine-copy a,
.platform-section a {
  display: inline-flex;
  gap: 0.4rem;
  margin-top: 1.1rem;
  color: var(--vp-c-brand-1);
  font-size: 0.9rem;
  font-weight: 650;
  text-decoration: none;
}

.spine-copy code {
  padding: 0.1rem 0.32rem;
  border: 1px solid var(--home-line);
  border-radius: 0.25rem;
  background: var(--home-panel);
  font-size: 0.87em;
}

.file-tree {
  padding: 1.5rem;
  border: 1px solid #30363d;
  border-radius: 0.8rem;
  color: #c9d1d9;
  background: #0d1117;
  font-family: var(--vp-font-family-mono);
  font-size: 0.8rem;
  box-shadow: 0 20px 60px rgba(11, 15, 20, 0.14);
}

.file-tree-title {
  margin: 0 0 0.8rem;
  color: #e6edf3;
  font-weight: 650;
}

.file-tree ul {
  margin: 0;
  padding: 0;
  list-style: none;
  line-height: 1.9;
}

.file-tree li {
  display: flex;
  gap: 0.6rem;
  justify-content: space-between;
}

.file-tree .level-2 {
  padding-left: 1.2rem;
}

.folder {
  color: #7ee787;
}

.file-tree .muted {
  color: #8b949e;
}

.boundary-section {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.boundary-card {
  padding: 1.35rem;
  border: 1px solid var(--home-line);
  border-radius: 0.8rem;
  background: var(--home-panel);
}

.boundary-card h3 {
  margin: 1rem 0 0.55rem;
  font-size: 1.02rem;
}

.boundary-card p {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.86rem;
  line-height: 1.65;
}

.boundary-card a {
  display: inline-block;
  margin-top: 0.9rem;
  color: var(--vp-c-brand-1);
  font-size: 0.8rem;
  font-weight: 650;
  text-decoration: none;
}

.platform-section {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(320px, 1.05fr);
  gap: clamp(2rem, 7vw, 6rem);
  align-items: center;
  border-top: 1px solid var(--home-line);
}

.platform-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.platform-list span {
  padding: 0.48rem 0.72rem;
  border: 1px solid var(--home-line);
  border-radius: 0.5rem;
  color: var(--vp-c-text-2);
  background: var(--home-panel);
  font-family: var(--vp-font-family-mono);
  font-size: 0.76rem;
}

.platform-list .platform-more {
  color: var(--vp-c-brand-1);
  border-style: dashed;
}

.closing-section {
  margin-bottom: 4rem;
  border: 1px solid #30363d;
  border-radius: 1rem;
  background:
    radial-gradient(circle at 88% 15%, rgba(47, 129, 247, 0.28), transparent 36%),
    #0d1117;
}

.closing-section .eyebrow {
  color: #7ee787;
}

.closing-section h2 {
  color: #f0f6fc;
}

.closing-actions {
  margin-top: 1.6rem;
}

@media (max-width: 960px) {
  .hero-section,
  .spine-section,
  .platform-section {
    grid-template-columns: 1fr;
  }

  .terminal-card {
    max-width: 620px;
    transform: none;
  }

  .path-grid,
  .boundary-section {
    grid-template-columns: 1fr;
  }

  .path-card {
    min-height: 230px;
  }

  .workflow-steps {
    grid-template-columns: 1fr;
  }

  .workflow-step {
    border-top: 1px solid var(--home-line);
    border-left: 0;
  }

  .workflow-step:first-child {
    border-top: 0;
  }
}

@media (max-width: 640px) {
  .hero-section,
  .start-paths,
  .workflow-section,
  .spine-section,
  .boundary-section,
  .platform-section {
    padding-right: 1.15rem;
    padding-left: 1.15rem;
  }

  .hero-section {
    padding-top: 3.1rem;
  }

  .hero-copy h1 {
    font-size: clamp(2.2rem, 12vw, 3.1rem);
  }

  .terminal-body {
    min-height: auto;
    padding: 1.15rem;
    font-size: 0.66rem;
  }

  .terminal-body p {
    overflow-x: auto;
  }

  .file-tree {
    padding: 1.1rem;
    font-size: 0.7rem;
  }

  .file-tree li {
    align-items: flex-start;
    flex-direction: column;
    gap: 0;
    padding: 0.18rem 0;
  }

  .file-tree .level-2 {
    padding-left: 0.8rem;
  }

  .closing-section {
    margin-right: 1rem;
    margin-left: 1rem;
    padding-right: 1.3rem;
    padding-left: 1.3rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .action-primary,
  .path-card {
    transition: none;
  }

  .cursor {
    animation: none;
  }
}
</style>
