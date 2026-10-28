# omtre 品牌标识设计 · 交接文档

- 任务：为开发者工具 omtre 设计品牌标识
- 负责人：齐浩南
- 日期：2026-10-26
- 状态：**首轮交付完成**（母版 + 核心变体家族已确认并落地）
- 设计画布：`cws_59750589387053570`
- 资产落地目录：`assets/brand/`
- 过程文件目录：`.creative-design/omtre-logo/`

---

## 1. 结论速览

- 最终采用**「模块字标」方案（候选 B）**作为品牌主标识。
- 标志构成：定制小写字标 `omtre`，首字母 `o` 设计为**圆角方形外框 + 框内实心圆点**（命令行光标 / 节点语义），其余字母统一模块化笔画。
- 已交付 6 个文件：彩色主标、黑色单色版、白色反白版、彩色 favicon、透明底横版字标、透明底 favicon。
- 全部位图资产已写入设计画布并通过 `get` 回读核验。

**为什么选 B（决策依据）**：

1. 与开发者工具定位最契合——终端 / 命令行气质，工程化、克制；
2. 图形与字标一体化，结构最简洁，小尺寸识别最稳；
3. 与现有产品视觉语言（GitHub Dark 风格：深墨底 + 可信蓝）协调；
4. 风险最低：无渐变、无 3D、无细碎装饰，单色 / 反白均成立。

被淘汰方向：候选 A（几何节点开放环，图形独立但概念较常见）、候选 C（连续路径轨迹，概念独特但小尺寸有糊化风险）。两者保留在画布中备查，未进入正式家族。

---

## 2. 品牌标识说明

### 2.1 核心概念

- **圆角方形 o = 命令行光标 / 工作流节点**：传达开发者工具的「指令入口」与「节点编排」属性。
- **模块化笔画**：所有字母共享统一笔画模块、圆角半径与字重，象征 omtre 对开发流程、任务、规范的结构化组织。

### 2.2 身份不变量（任何变体必须保持）

1. 拼写：`o m t r e`，全小写，五字母，不得增删、改大小写；
2. 首字母 o 为圆角方形外框，框内中心一个实心圆点；
3. m / t / r / e 为统一模块笔画、统一圆角的几何无衬线字形；
4. 线条与字标同语言：等粗、圆头、圆角；
5. 标准配色为「墨色 + 主蓝 + 白」，不超过 3 个颜色角色。

### 2.3 标准配色

| 角色 | 色值 | 用途 |
|---|---|---|
| 品牌主色 | `#2f81f7`（可信蓝） | o 内圆点 / favicon 节点 |
| 墨色 | `#0d1117`（深墨黑） | 字标主体（主标） |
| 辅助墨色 | `#1f2937` | 深灰字标场景（部分展示稿） |
| 背景白 | `#ffffff` | 浅色 / 标准背景 |

> 配色与现有 `assets/hero.svg`、`assets/workflow.svg` 的 GitHub Dark 色板一致，便于跨触点统一。

---

## 3. 资产清单

### 3.1 正式交付文件（`assets/brand/`）

| 文件名 | 格式 | 尺寸（px） | 用途 |
|---|---|---|---|
| `logo-primary.png` | RGB / PNG | 3547×1182 | 彩色白底主标，标准母版 |
| `logo-mono-black.png` | RGB / PNG | 3547×1182 | 黑色单色版（白底黑标） |
| `logo-reverse-white.png` | RGB / PNG | 3547×1182 | 白色反白版（黑底白标） |
| `mark-favicon.png` | RGB / PNG | 2048×2048 | 彩色 favicon（白底） |
| `logo-transparent.png` | RGBA / PNG | 1866×431 | 透明底横版字标，任意背景 |
| `mark-favicon-transparent.png` | RGBA / PNG | 909×817 | 透明底 favicon，任意背景 |
| `favicon.ico` | ICO | 内嵌 16/32/48/64/128/256 | 浏览器多尺寸 favicon |
| `favicon-16.png` ~ `favicon-256.png` | PNG | 16/32/48/64/128/256 | 独立尺寸 favicon PNG |
| `apple-touch-icon.png` | PNG | 180×180 | iOS 主屏图标（白底） |
| `apple-touch-icon-dark.png` | PNG | 180×180 | iOS 主屏图标（#0d1117 深底白标） |
| `mark-favicon.svg` | SVG | viewBox 860×767 | favicon mark 矢量（手写几何：圆角矩形描边 + 蓝色圆） |

### 3.2 画布对象映射（`cws_59750589387053570`）

| 画布对象 | Item ID | 路径 |
|---|---|---|
| 候选 A（备查） | `nvdUqPCJ-4Oxm0KIa9K-0201` | `/generated-assets/logo-candidates` |
| **候选 B / 主母版** | `LmCvAgis-4PR7VCkr6A-0201` | `/generated-assets/logo-candidates` |
| 候选 C（备查） | `qrsZ1Awp-4PfYrQkQCY-0201` | `/generated-assets/logo-candidates` |
| 黑色单色版 | `6i27wbhm-4Pi50CoN0s-0201` | `/core-assets/omtre-logo` |
| 白色反白版 | `5jVpKrOH-4Pi50CoOg6-0201` | `/core-assets/omtre-logo` |
| 彩色 favicon | `7pGdtKil-4PgrV9SzfG-0201` | `/core-assets/omtre-logo` |
| 透明底字标 | `CCcqG8Pe-4PfQ2JpFYo-0201` | `/core-assets/omtre-logo` |
| 透明底 favicon | `8oUlbzkP-4Pg1hmtpT8-0201` | `/core-assets/omtre-logo` |
| favicon-256 预览 | `mpYo2AL5-4PnsbyJ7xK-0201` | `/core-assets/omtre-logo` |
| apple-touch-icon 180 | `QGW7UV5j-4PoGDqhbXe-0201` | `/core-assets/omtre-logo` |

### 3.3 过程文件（`.creative-design/omtre-logo/`）

| 文件 | 内容 |
|---|---|
| `brief.md` | 设计 Brief：品牌事实、视觉主张、三候选方向、验收标准、母版确认记录 |
| `candidate-a/b/c.xml` | 三候选写入画布的 XML 载荷 |
| `mono-black.xml` / `reverse-white.xml` / `favicon.xml` | 变体画布载荷 |
| `transparent-logo.xml` / `transparent-favicon.xml` | 透明资产画布载荷 |
| `alpha-bounds.js` | Node 脚本：解析 PNG Alpha 输出非透明边界（用于紧凑裁剪） |
| `make-favicon.py` | Pillow 脚本：生成多尺寸 favicon PNG / ico / apple-touch-icon |
| `vectorize.py` | OpenCV 脚本：透明字标分层矢量化为 SVG |
| `omtre-logo-transparent.png` / `omtre-favicon-transparent.png` | 透明资产中间稿 |
| `HANDOFF.md` | 本文档 |

---

## 4. 使用规范

### 4.1 按场景选择版本

| 场景 | 推荐版本 |
|---|---|
| 浅色网页 / 文档 / README | `logo-primary` 或 `logo-transparent` |
| 深色界面 / 深色 Banner | `logo-reverse-white` 或 `logo-transparent` |
| 单色印刷 / 黑白文档 / 传真 | `logo-mono-black` |
| 浏览器标签 / App 图标 / 头像 | `mark-favicon` 或 `mark-favicon-transparent` |
| 图片 / 视频等未知或复杂背景 | `logo-transparent` / `mark-favicon-transparent` |

### 4.2 安全区与最小尺寸

- 标志四周预留不小于「o 外框高度 1/4」的净空，区内不得放置文字、图形或贴边。
- 横版字标建议最小显示高度 ≥ 24px（屏幕）；favicon 建议 ≥ 16px。
- 小尺寸下优先使用 favicon / 单色版，避免缩横版字标。

### 4.3 背景与对比

- 浅色背景：使用墨色字标；深色背景：使用反白字标。
- 背景复杂或对比不足时：使用透明底版本，必要时加承托净区。
- 禁止将主蓝直接用于大面积背景导致蓝色圆点失去焦点。

### 4.4 禁用项

- 禁止改变拼写、大小写、字母间距或拉伸 / 挤压标志；
- 禁止旋转、倾斜、加投影 / 发光 / 描边（未经定义的变体）；
- 禁止替换主蓝与墨色、给各字母随机换色；
- 禁止在标准母版上使用渐变、3D、金属、玻璃、毛绒等材质；
- 禁止无依据添加 `TM` / `®` / `©` / 年份 / 口号 / 域名；
- 禁止把候选 A / C 与正式家族混用。

---

## 5. 已知限制

1. **横版字标没有可直接发布的矢量源**：自动描边版本会把 `o` 的内部识别成实体，已移入 `.creative-design/omtre-logo/` 留档，正式网页使用从透明 PNG 派生的 WebP。若后续需要印刷级矢量，必须以母版 PNG 为准重新人工描边。
2. 字标由 AI 图像模型生成，字形为定制矢量路径，无对应可安装字体文件。
3. 透明底为「确定性抠图 + 几何裁剪」得到，已核验真实 Alpha；边缘如在高对比异色背景下使用，建议放大检查。
4. favicon 网页版本从图形 mark 重建为 16/32/48 三档 ICO；macOS `.icns` 未提供。
5. 横版字标原始画幅较大（3547×1182），透明版已紧凑裁剪为 1866×431，使用时以 `assets/brand/` 中文件为准。
6. 文档站实际使用的最小 Web 资产位于 `docs-site/public/brand/`，包含浅/深 mark、浅/深 wordmark 和 1200×630 OG 图；这些文件由本文档中的 PNG 母版派生。

---

## 6. 后续待办（建议）

| 优先级 | 事项 | 说明 |
|---|---|---|
| ~~高~~ | ~~生成 favicon 多尺寸包~~ | ✅ 已完成：`favicon.ico` + 6 档 PNG + apple-touch-icon 两版 |
| 中 | 横版字标矢量重绘 | 自动描边版本不可用于生产；当前网页使用 PNG 母版派生的 WebP，印刷级矢量需人工重绘 |
| 中 | macOS `.icns` | 从 favicon 生成 `.icns` 供 dock/安装包使用 |
| 中 | 应用预览 | 登录页、导航栏、名片、社交封面、GitHub 社交预览图 |
| 中 | Logo 规范页 | 网格、比例、安全区、色值、正误用法对照页 |
| 低 | 品牌辅助图形 | 由 o 节点 / 模块笔画延展的纹样、图标容器体系 |

---

## 7. 时间线（审计轨迹）

1. 2026-10-26 · 任务启动，读取创意设计流程与 Logo 规范；
2. 2026-10-26 · 创建设计画布 `cws_59750589387053570`，交付画布卡片；
3. 2026-10-26 · 编写 Brief，确定 3 个候选方向（几何节点开放环 / 模块字标 / 连续路径轨迹）；
4. 2026-10-26 · 并行生成 3 候选，逐字核验拼写，画布持久化 + 卡片交付；
5. 2026-10-26 · 用户选定**候选 B** 为唯一母版，登记核心资产；
6. 2026-10-26 · 派生单色版、反白版、favicon，画布持久化并回读；
7. 2026-10-26 · 专用抠图去底，Alpha 核验，紧凑裁剪，透明资产画布持久化；
8. 2026-10-26 · 全部资产落地 `assets/brand/`，统一为 PNG，生成交接文档；
9. 2026-10-26 · Pillow 生成多尺寸 favicon 包（`.ico` + 6 档 PNG + apple-touch-icon 两版）；手写 favicon 几何 SVG，OpenCV 分层矢量化横版字标 SVG，渲染验证。

---

## 8. 接手方式

- 先读本文件与 `brief.md`，再到画布 `cws_59750589387053570` 回读全部资产；
- 任何新增变体必须基于**主母版（B）**派生，保持第 2.2 节身份不变量；
- 新增资产先写入画布 `/core-assets/omtre-logo`，再落地 `assets/brand/`，并回填本文件清单；
- 设计或返工遵循 `.creative-design/omtre-logo/brief.md` 中的验收标准。
