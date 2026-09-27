---
name: cognitive-mindmap-dev
description: >-
  Guide and architecture reference for developing, optimizing, or extending the
  O-key full-screen Cognitive MindMap & Outliner system (js/cognitive_canvas/ and
  js/mindmap/). Activate this skill when working on mindmap layouts, associative
  lines, viewport shortcuts (1/2/3, Q/W/E, L, M, H), node rich-text/LaTeX editing,
  or adding new Math/822/English mindmap data.
---

# 思维导图与全屏认知视图开发规范 (Cognitive MindMap & Outliner)

## 1. 模块架构与文件职责

认知视图采用**「底层通用导图工具集 (`js/mindmap/`) + 顶层业务协调器 (`js/cognitive_canvas/`)」**双层解耦架构，直接集成于根目录 [`index.html`](file:///d:/tj/822/考研题库/index.html) 的 `#cognitiveModal` 容器中（**严禁修改或引用已废弃的 `mindmap-sandbox/` 目录**）：

### 1.1 底层通用工具集 (`js/mindmap/`)
- [`lib/simple-mind-map/simpleMindMap.umd.min.js`](file:///d:/tj/822/考研题库/lib/simple-mind-map/simpleMindMap.umd.min.js) & [`simpleMindMap.min.css`](file:///d:/tj/822/考研题库/lib/simple-mind-map/simpleMindMap.min.css)：核心渲染引擎。
- [`mindmap_drag_enhancer.js`](file:///d:/tj/822/考研题库/js/mindmap/mindmap_drag_enhancer.js)：节点拖拽磁吸增强（区分同级插入与子节点挂载判定）。
- [`mindmap_node_renderer.js`](file:///d:/tj/822/考研题库/js/mindmap/mindmap_node_renderer.js) & [`mindmap_node_editor.js`](file:///d:/tj/822/考研题库/js/mindmap/mindmap_node_editor.js)：支持局部文字加粗/高亮染色与 Markdown + $\LaTeX$ 双栏/内联编辑。
- [`mindmap_outliner.js`](file:///d:/tj/822/考研题库/js/mindmap/mindmap_outliner.js) & [`dual_view_controller.js`](file:///d:/tj/822/考研题库/js/mindmap/dual_view_controller.js)：纯白沉浸大纲视图与导图双视图无缝切换（`M` 键）。
- [`mindmap_bottom_toolbar.js`](file:///d:/tj/822/考研题库/js/mindmap/mindmap_bottom_toolbar.js) & [`mindmap_structure_controller.js`](file:///d:/tj/822/考研题库/js/mindmap/mindmap_structure_controller.js)：左下角合并工具条（结构切换、连线风格、画布缩放百分比）。
- [`mindmap_shortcut_manager.js`](file:///d:/tj/822/考研题库/js/mindmap/mindmap_shortcut_manager.js) & [`mindmap_shortcut_drawer.js`](file:///d:/tj/822/考研题库/js/mindmap/mindmap_shortcut_drawer.js)：导图内部编辑快捷键与 `H` 键快捷键抽屉面板（点击画布空白自动收起）。

### 1.2 顶层业务协调器与数据 (`js/cognitive_canvas/`)
- [`cognitive_view_controller.js`](file:///d:/tj/822/考研题库/js/cognitive_canvas/cognitive_view_controller.js)：
  - 根据主界面当前科目（`curSubjectId`）动态加载对应导图数据（数学加载章节导图，英语加载专项讲义导图如 `data/tangjing_translation_mindmap_data.js`）。
  - 负责数学「知识点 · 考点 · 解法」品字形 △ 混合三角扇区重排、无向关联线（Associative Lines）绘制、拓扑共鸣聚焦高亮（Focus Resonance）及视口运镜调度。
  - 管理多章注册表（`chapterRegistry`）与命名空间持久化（`kaoyan.g.mindmap_chapters.${chapterId}`）。
- [`sync_blocks_data.js`](file:///d:/tj/822/考研题库/js/cognitive_canvas/sync_blocks_data.js)：跨章同步块（Transclusion）母本注册表与管理引擎。
- [`mathviz_widget.js`](file:///d:/tj/822/考研题库/js/cognitive_canvas/mathviz_widget.js)：按需挂载的参数化数学几何动图组件。
- [`css/cognitive_mindmap.css`](file:///d:/tj/822/考研题库/css/cognitive_mindmap.css) & [`css/cognitive_view.css`](file:///d:/tj/822/考研题库/css/cognitive_view.css)：全屏画布与节点样式。

---

## 2. 核心交互与快捷键铁律

### 2.1 全屏纯净视图与键盘隔离
- `O` 键作为从题库/英语主界面进入和退出认知视图的唯一开关。
- **不设顶部控制栏，不设“返回题库”按钮**，保持 100% 纯净画布。
- **键盘流严格隔离**：`isModalOpen === true` 时，捕获并阻断一切穿透到底层题库的快捷键。
- **鼠标交互**：鼠标滚轮以光标为中心原生平滑缩放画布；**右键拖拽**平移漫游画布（严禁覆盖为灾难性的“右键+滚轮缩放”）。

### 2.2 层级与分类巡航快捷键
- `1` / `2` / `3` 键：三阶渐进层级展开并自适应居中视口（**【知识点】分支比【考点】【解法】多展开一级**）：
  - `1` 键：**分节骨架**（知识点展开至 `§1~§3`，考点/解法停留在二级分类标题）。
  - `2` 键：**核心全景**（知识点展开至 `1.1~3.3`，考点/解法展开至具体条目，实现同级对齐总览）。
  - `3` 键：**全图鸟瞰**（全图全量节点展开 + 一屏鸟瞰居中，允许缩放降至 `0.05~0.25`）。
- `Q` / `W` / `E` 键：分别一键展开并智能聚焦到 **【知识点 (`Q`)】**、**【考点 (`W`)】**、**【解法 (`E`)】** 对应扇区；**支持连按依次巡航各分节/分组**。
- `Shift + Space`（Shift + 空格）：在导图或大纲模式下，选中带 `[待确认·来源]` 胶囊的节点，瞬时转正为正式语义标签（`注` / `法` / `结` / `警`），全自动静默持久化，不新增任何额外 UI 按钮。
- `L` 键：全局显隐跨分支关联线（默认开启）；**当 `L` 键隐藏全局关联线后，若用户点击某个带有关联关系的节点，仍须单独高亮透出与该节点相连的关联线**。
- `M` 键：在「思维导图模式」与「大纲模式」之间切换。
- `H` 键：呼出/关闭快捷键面板（面板打开时点击画布任意处自动收起）。
- `Esc` 键：分级回退（优先关闭浮层/取消节点聚焦共鸣，无浮层时退出认知视图）。

### 2.3 方向性智能相机锚定法则 (Directional Camera Anchoring)
对于非对称生长的超宽树，相机聚焦**严禁**简单计算包围盒中心对称对齐（否则会导致核心标题被挤出屏幕外、中央大片留白）：
- **知识点总览 (`Q` 键)**：
  - 知识树向左生长（$\leftarrow$），展开宽度达 $3000\text{px}+$，核心节标题（`§1 函数` 等）位于最右侧；
  - 必须配置 `horizontalAnchor: 'right'`, `verticalAnchor: 'top'`，将右侧节标题安全锚定在视口右边界内（`safeRightPad: 70px`），公式与定理向左自然充盈屏幕，排版舒适；
  - 连按 `Q` 巡航各节（`sec_1_func`, `sec_2_limit`, `sec_3_cont`）均保持 `horizontalAnchor: 'right'`。
- **解法总览 (`E` 键)**：
  - 解法树向右生长（$\rightarrow$），招法主干（M01~M18）位于最左侧；
  - 必须配置 `horizontalAnchor: 'left'`, `verticalAnchor: 'top'`，将左侧招法标题安全锚定在视口左边界内（`safeLeftPad: 60px`），步骤与避坑向右平铺。
- **考点总览 (`W` 键)**：
  - 考点横向排布、向上生长（$\uparrow$）；
  - 配置 `horizontalAnchor: 'center'`, `verticalAnchor: 'top'`，顶部居中一字排开，与下方中心根自然衔接。

---

## 3. 正品字 △ 混合三角拓扑与关联线规范

### 3.1 三大扇区拓扑分配与考点向上排布
1. **正品字 △ 混合三角布局 (`applyHybridTriangleLayout`)**：
   - **上方（考点 Exam Points）**：位于画布根节点正上方，考点卡片横向一字排开；
     - **子节点向上生长（$\uparrow$）**：考点题源（真题年份）与核心要领全部向上延伸排列，彻底与下方的知识点和解法物理隔离，**从根源上杜绝考点子节点向下蔓延导致的穿心与密集交叉**；
   - **左下方（知识点 Knowledge）**：**向左生长（$\leftarrow$）**逻辑图，右侧为主干（`§1~§3`），向左铺展公式定理；
   - **右下方（解法 Methods）**：**向右生长（$\rightarrow$）**逻辑图，左侧为主干（`M01~M18`），向右铺展步骤与避坑。
2. **命名洁癖**：
   - 二级分类节点严格叫 `知识点`、`考点`、`解法`，严禁添加 Emoji 或“中枢/理论支撑/破局心法”等中二后缀。

### 3.2 跨分支无向关联线与拓扑共鸣 (Focus Resonance)
1. **无向单线原则**：
   - 考点与知识点、考点与解法之间的关联线为**无向平滑贝塞尔连接**，任意一对关联节点之间**只允许绘制一条曲线**（严禁双向重复绘制两条线，不加箭头）。
   - 关联线渲染在节点底层，节点卡片使用纯白实体底色与边框，杜绝连线压在文字表面。
2. **拓扑共鸣高亮**：
   - 点击或悬停带有关联关系的节点时，高亮该节点及其直接关联的目标节点与连接线，其余无关节点适度降低透明度（0.58，保持文字可读，不过度透明）。
   - 按 `Esc` 键分层清除高亮，不关闭弹窗。

---

## 4. 两层导图与跨章同步块基础设施

### 4.1 两层思维导图架构 (Two-Layer Architecture)
- **L1 学科全量骨架层**：
  - 避免 6,000+ 节点的单棵巨型树引发 SVG 渲染与 DOM 性能崩溃；
  - 通过 `buildSubjectMacroTree` 运行时读取各章导图，依据 `macroLevel <= 3` 标记动态裁剪至 `1.1` 小节级，全学科骨架约 250 节点，毫秒级加载与缩放；
  - 截断节点挂载 `portalTarget: { chapterId, nodeUid }`，支持一键下钻。
- **L2 章节全量详情层**：
  - 通过 `loadChapter(chapterId)` 独立挂载当前章（如第 1 章约 180~300 节点），中心根激活品字形三扇区布局与跨分支贝塞尔关联线；
  - 按章节命名空间独立读写 `localStorage`（`kaoyan.g.mindmap_chapters.${chapterId}`）。

### 4.2 跨章同步块 (Transclusion / Synced Block)
- **规范注册表与投影**：
  - 跨章总结的公共体系统一存放在 [`js/cognitive_canvas/sync_blocks_data.js`](file:///d:/tj/822/考研题库/js/cognitive_canvas/sync_blocks_data.js)；
  - 运行时通过 `SyncBlockManager.hydrateTree()` 深拷贝至当前章节渲染树，注入作用域 UID（`hostUid__syncKey`）；
- **首发母本策略**：
  - 在第 1 章中率先提炼跨章节规律（如奇偶周期性在导数/原函数/变限积分的互推，多元与一元连续/可导/可微对比网），一次性建好规范母本；
  - 后续章节（第 2/3/4/8 章等）仅需在宿主节点声明一行 `syncBlockId: "..."` 即可零成本投影挂载，天然实现跨章双向同步；
- **写穿式全静默同步**：
  - 任意编辑、拖拽或 `Shift + 空格` 转正，通过 `SyncBlockManager.syncBackToRegistry` 剥离作用域前缀写穿回母本，100% 自动写穿落盘至 `localStorage` 与 `kaoyan_tiku_data.json`。

---

## 5. 验证套件与测试规约

每次修改 `js/mindmap/*` 或 `js/cognitive_canvas/*` 后，必须执行以下验证流程：
1. **第一章认知视图 CDP E2E 测试套件**：
   ```bash
   node tests/test_chapter1_prototype.js
   ```
   - 验证规约：10 项测试全部通过（包含品字形布局、多层紧凑子节点、Focus 共鸣、MathViz 弹窗、双向键盘隔离、1/2/3 渐进层级、Q/W/E 专属配框与方向性安全边距、同步块注水、Shift+空格转正）。
2. **全库单元测试与真实浏览器 E2E 测试**：
   ```bash
   node tests/unit_tests.js
   node tests/cdp_e2e_tests.js
   ```
3. **视觉检验**：检查 `tests/artifacts/` 下生成的真机截屏，确认节点文字清晰、KaTeX 公式完整、方向性锚定边距舒适、零大片留白。
