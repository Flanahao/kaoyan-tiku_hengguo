# 考研题库 (kaoyan-tiku) 全局架构与工程规范 (AGENTS.md)

## 1. 系统顶层架构与三大模式定位

### 1.1 单一入口铁律 (Single Entry Point)
- 全系统**唯一合法入口为根目录 [`index.html`](file:///d:/tj/822/考研题库/index.html)**。
- 严禁新建或引导用户访问任何独立 HTML 页面。所有子系统通过顶层科目切换、视图模式切换或 `O` 键全屏认知画布在单页应用 (SPA) 内无感调度。

### 1.2 三大科目与核心视图分层（引擎复用、业务解耦）

1. **考研数学一 (`math`) & 822 控制工程基础 (`822`) —— 三大平级核心模式闭环**：
   - **模式 A：单题刷题模式（主视图默认）**
     - 按习题册/章节逐题沉浸推进，负责熟练度状态流转（`gold` / `green` / `yellow` / `orange` / `red` / `none`）、SM-2 复习调度、图片标注与单题笔记。
   - **模式 B：多题对比复盘模式（由 [`js/topics.js`](file:///d:/tj/822/考研题库/js/topics.js) 演进）**
     - 独立于单题刷题的总结复盘工作台，解决“单题视图无法同屏找规律”的痛点。
     - **探索态**：支持自由挑选跨书本、跨年份的不同题目加入同屏并列/网格展示，对比题眼与设问变式以发现规律。
     - **沉淀态**：展示已总结沉淀的「考点」或「解法」题群；通过**自定义题目排序 + 题群总结/单题简短注释**体现题目间的递进或异同（注重高 ROI 与可行性，不搞复杂的题目演进连线图）。
   - **模式 C：`O` 键全屏思维导图/大纲模式（[`js/cognitive_canvas/`](file:///d:/tj/822/考研题库/js/cognitive_canvas) + [`js/mindmap/`](file:///d:/tj/822/考研题库/js/mindmap)）**
     - 在**正品字 △ 混合三角布局**下组织章节**「知识点 · 考点 · 解法」**三大二级分类扇区：**上方考点横向排布且子节点向上生长（$\uparrow$）**彻底避免穿心与交叉、**左下知识点向左生长（$\leftarrow$）**、**右下解法向右生长（$\rightarrow$）**；使用**无向平滑贝塞尔关联线**连接跨分支关联节点，并支持按需呼出 `MathViz` 几何动图。
     - **L1 全量层与 L2 章节层无缝切换（`S` 键 / `A·D` 键）**：L1 全量层与 L2 章节层保持**同构正品字 △ 布局**（上方考点、左下知识点、右下解法，内部按第 0~9 章分组），通过 `S` 键在全量层与章节层间双向切换（在全量层选中或定焦某章节点按 `S` 直接下钻至该章），通过 `A / D` 键在 10 个章节间循环切换或定焦；全量层同样支持 `Q / W / E` 扇区聚焦与逐章巡航，且在全量层的任何编辑、染色与待确认转正均通过 `syncMacroTreeChangesToChapters` **双向写穿保存**回对应章节。
     - **`O` 键跨刷新状态保留（`kaoyan.g.cognitive_state`）**：不同于普通弹窗，在 `O` 键开启态下刷新页面（F5）必须保持停留在 `O` 键视图内，并 100% 恢复刷新前的 `layerMode`（全量层/章节层）、`currentChapterId`、导图/大纲模式、`L` 键关联线显隐、节点展开态与相机视口坐标。
     - **跨章同步块 (Transclusion)**：跨章综合体系通过 `SyncBlockManager` 单源母本注册与写穿式静默同步，支持选中后按 `Shift + 空格` 瞬时转正待确认标签。
     - **与多题模式互通**：导图中的「考点」与「解法」节点直接对应多题模式中沉淀的题群。

2. **考研英语一 (`english`) —— 独立精读主视图 + 复用导图引擎**：
   - **主视图**：保持独立的历年真题（1998~2026）精读引擎（[`js/english_app.js`](file:///d:/tj/822/考研题库/js/english_app.js)）与 Canonical Lexicon v2 划词词典/生词本系统（`js/lexicon_*.js`、`js/user_word.js`）。
   - **`O` 键视图**：底层直接复用 `O` 键思维导图/大纲引擎挂载各题型专项讲义（如《唐静翻译讲义导图》[`data/tangjing_translation_mindmap_data.js`](file:///d:/tj/822/考研题库/data/tangjing_translation_mindmap_data.js) 及后续阅读/完形讲义），不强行套用数学的“知识点·考点·解法三扇区”或图片多题对比模式。

---

## 2. 目录结构与历史只读禁区

### 2.1 活跃生产目录
- `index.html`：全局唯一入口。
- `js/app.js`, `js/chapters.js`, `js/topics.js`, `js/storage.js`, `js/storage_sync.js`, `js/sm2_review.js`, `js/dashboard.js`, `js/annotator.js`, `js/math_palette.js`：数学与 822 题库核心引擎。
- `js/english_app.js`, `js/lexicon_*.js`, `js/user_word.js`, `题库/英语/data_1998~2026.js`：英语精读与词汇系统。
- `js/mindmap/*`：通用思维导图与大纲双视图底层工具集（拖拽磁吸、富文本/LaTeX 节点编辑、大纲视图、底部工具栏、结构切换、快捷键管理）。
- `js/cognitive_canvas/*`：`O` 键全屏认知视图协调器（`cognitive_view_controller.js`）、`MathViz` 动图组件与章节导图数据。
- `lib/*`：本地离线第三方库（`katex`、`marked`、`dompurify`、`markerjs3`、`simple-mind-map`）。
- `kaoyan_tiku_data.json`：用户学习状态主数据库（Single Source of Truth）。
- `题库/*`：21 个独立 Git 子模块（见 `.gitmodules`），存放各习题册切图、讲义笔记、研砖、大观园、Semantic 与词典数据。

### 2.2 历史只读/废弃禁区（严禁修改或新增引用）
> [!CAUTION]
> 以下目录/文件属于历史过渡产物或未清理备份，保留在磁盘仅防本地文件丢失，**任何新开发严禁修改或引用它们**：
> - `mindmap-sandbox/`（核心生产脚本已迁入 `js/mindmap/` 与 `lib/simple-mind-map/`，严禁再去沙盒目录开发）
> - `exam_workbench.html`, `js/exam_workbench.js`, `css/exam_workbench.css`（已废弃的旧工作台）
> - `最终笔记/`, `讲义对照/`（正式讲义资产统一在 Git 子模块 `题库/讲义和笔记/` 中）
> - `rebuilt_data/`, `handoff/`, `scratch/`（历史跑批中间产物）

---

## 3. 多源数据资产职责分工

在构建数学各章导图与多题题群时，严格遵循**「主次分明、各司其职」**：
1. **【知识点】分支主干**：以 `题库/讲义和笔记/`（《最终笔记》+《李范复习全书整理》+《老姚高数源码》）为唯一主干，按需内嵌 `题库/研砖/kaogang_figures.json` 几何动图。
2. **【考点 & 解法】分支骨架**：以 `题库/研砖/` 的考纲考点与破题诀/招法谱系（`pojue_lectures.json` / `methods_outline`）为骨架，结合讲义题型归纳融合。
3. **【多题模式的题群挂载】**：将 `题库/大观园/` + `题库/kaoyan-semantic-data/` + `题库/研砖/` 作为**幕后对齐索引**，将本地切图习题册（30讲/36讲/1000题/880/李范/老姚）的具体题号（QID）精准关联到对应考点/解法下。

---

## 4. 全局防摩擦铁律（38 个历史对话经验沉淀）

1. **命名与文案洁癖**：
   - **严禁中二/浮夸造词**：知识点就叫`知识点`，考点就叫`考点`，解法就叫`解法`，严禁自行编造“考点中枢”、“理论支撑”、“破局心法”等浮夸前缀或后缀。
   - **严禁 Emoji 与外部品牌词**：UI 界面与导图节点中**不得出现任何表情符号 (Emoji)**；代码变量、类名与 UI 文案中**严禁出现 `feishu`、`飞书经典` 等品牌词**。
2. **算法改动先搜成熟方案**：
   - 涉及节点拖拽磁吸、无向关联线防密集交叉/防穿心、视口自适应聚焦缩放（`1/2/3` 与 `Q/W/E`）等几何布局算法时，**必须先搜索并参考成熟开源方案或工业界通用实现并说明依据**，严禁拍脑袋硬写魔数或简单粗暴的限制分支。
3. **复用现有依赖与彻底清理遗留代码**：
   - 优先复用 `lib/` 中已有的 KaTeX、marked、DOMPurify 与 `js/mindmap/` 原生能力，不重复造轮子。
   - 重构交互时必须彻底清理废旧 DOM、遗留虚线图层与旧事件监听器。
4. **严格的双向键盘流隔离**：
   - 当 `O` 键认知画布（`#cognitiveModal`）、各类弹窗或文本输入框处于激活状态时，必须在捕获阶段拦截键盘事件，严禁触发后台题库的切题/打标快捷键。
5. **数据安全与零盲猜对齐**：
   - 任何修改 `kaoyan_tiku_data.json` 或 `js/chapters.js` 的操作前，必须确认备份并遵守两阶段重命名规范，绝不丢失用户的熟练度与笔记。
   - 跨源对齐习题册题号时，**必须写脚本从标签与题干核验确认，严禁盲目猜测映射**（如误将研砖强化 A/B/C 当作 1000 题）。
6. **分阶段推进、充分验证与 Git 管理**：
   - 复杂改动分阶段实施，每阶段跑通 `tests/` 下对应测试套件并及时分类 `git commit`；涉及 `题库/*` 子模块变动时，先提交推送子模块，再提交推送主仓库。
7. **方向性相机锚定与非对称视口配框**：
   - 对于非对称生长的超宽树，相机聚焦严禁简单计算包围盒中心对称对齐：向左生长的知识树全量总览必须使用 `horizontalAnchor: 'right'`，向右生长的解法树使用 `horizontalAnchor: 'left'`，顶部排布的考点使用 `horizontalAnchor: 'center'`，防止核心标题被顶出视口导致大片留白。

---

## 5. 按需加载专项技能 (.agents/skills/)

执行特定复杂任务时，请先调用 `view_file` 读取对应 Skill 的 `SKILL.md`：
- **思维导图与认知视图开发**：[`.agents/skills/cognitive-mindmap-dev/SKILL.md`](file:///d:/tj/822/考研题库/.agents/skills/cognitive-mindmap-dev/SKILL.md)
- **题目拆分、合并与重裁切 SOP**：[`.agents/skills/tiku-question-split-merge/SKILL.md`](file:///d:/tj/822/考研题库/.agents/skills/tiku-question-split-merge/SKILL.md)
- **CDP 自动化与视觉验证工作流**：[`.agents/skills/cdp-e2e-verification/SKILL.md`](file:///d:/tj/822/考研题库/.agents/skills/cdp-e2e-verification/SKILL.md)
- **多源数据合成与题库对齐管道**：[`.agents/skills/kaoyan-data-pipeline/SKILL.md`](file:///d:/tj/822/考研题库/.agents/skills/kaoyan-data-pipeline/SKILL.md)
