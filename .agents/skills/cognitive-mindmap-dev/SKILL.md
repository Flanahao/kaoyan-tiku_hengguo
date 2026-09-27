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
  - 负责数学「知识点 · 考点 · 解法」混合三角扇区重排、无向关联线（Associative Lines）绘制、拓扑共鸣聚焦高亮（Focus Resonance）及视口运镜调度。
- [`mathviz_widget.js`](file:///d:/tj/822/考研题库/js/cognitive_canvas/mathviz_widget.js)：按需挂载的参数化数学几何动图组件。
- [`css/cognitive_mindmap.css`](file:///d:/tj/822/考研题库/css/cognitive_mindmap.css) & [`css/cognitive_view.css`](file:///d:/tj/822/考研题库/css/cognitive_view.css)：全屏画布与节点样式。

---

## 2. 核心交互与快捷键铁律

1. **全屏纯净视图**：
   - `O` 键作为从题库/英语主界面进入和退出认知视图的唯一开关。
   - **不设顶部控制栏，不设“返回题库”按钮**，保持 100% 纯净画布。
   - **键盘流严格隔离**：`isModalOpen === true` 时，捕获并阻断一切穿透到底层题库的快捷键。
2. **层级与分类巡航快捷键（注意：`~` 键已废除，统一使用单键 `1 / 2 / 3` 与 `Q / W / E`）**：
   - `1` / `2` / `3` 键：三阶渐进层级展开并自适应居中视口（**【知识点】分支比【考点】【解法】多展开一级**）：
     - `1` 键：**分节骨架**（知识点展开至 `§1~§3`，考点/解法停留在二级分类标题）。
     - `2` 键：**核心全景**（知识点展开至 `1.1~3.3`，考点/解法展开至具体条目，实现同级对齐总览）。
     - `3` 键：**全图鸟瞰**（全图全量节点展开 + 一屏鸟瞰居中）。
   - `Q` / `W` / `E` 键：分别一键展开并智能聚焦到 **【知识点 (`Q`)】**、**【考点 (`W`)】**、**【解法 (`E`)】** 对应扇区的包围盒中心与合适缩放比；**支持连按依次巡航各分节/分组**。
   - `L` 键：全局显隐跨分支关联线（默认开启）；**当 `L` 键隐藏全局关联线后，若用户点击某个带有关联关系的节点，仍须单独高亮透出与该节点相连的关联线**。
   - `M` 键：在「思维导图模式」与「大纲模式」之间切换。
   - `H` 键：呼出/关闭快捷键面板（面板打开时点击画布任意处自动收起）。
   - `Esc` 键：分级回退（优先关闭浮层/取消节点聚焦共鸣，无浮层时退出认知视图）。
   - **鼠标滚轮**：以光标为中心原生平滑缩放画布；**右键拖拽**：平移漫游画布（严禁覆盖为灾难性的“右键+滚轮缩放”）。

---

## 3. 跨分支无向关联线与混合扇区规范

1. **无向单线原则**：
   - 考点与知识点、考点与解法之间的关联线为**无向连接**，任意一对关联节点之间**只允许绘制一条曲线**（严禁双向重复绘制两条线，不加箭头）。
2. **混合扇区与防穿心/防交点集中**：
   - 数学章节导图在根节点下分为三个二级分类节点：`知识点`、`考点`、`解法`（**严禁添加 Emoji 或“中枢/理论支撑”等中二后缀**）。
   - 布局采用正品字 △ 混合扇区（上方目录组织图承载考点、左下方承载知识点、右下方承载解法）及分流控制点，避免关联线在同一区域集中相交。
3. **拓扑共鸣高亮 (Focus Resonance)**：
   - 点击或悬停带有 `associativeLinks` 的节点时，仅高亮该节点及其直接关联的目标节点与连接线，其余无关节点适度降低透明度（保持文字可读，不过度透明）。

---

## 4. 验证步骤

每次修改 `js/mindmap/*` 或 `js/cognitive_canvas/*` 后：
1. 运行自动化测试：
   `node tests/test_chapter1_prototype.js`
2. 启动 Chrome 并通过 CDP 触发 `O`、`1/2/3`、`Q/W/E`、`L`、`M` 键，截取 PNG 并调用 `view_file` 目视检查连线走线、节点清晰度与视口居中效果。
