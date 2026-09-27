---
name: kaoyan-data-pipeline
description: >-
  Guide and data dictionary for organizing, aligning, and synthesizing multi-source
  data assets (题库/讲义和笔记, 题库/研砖, 题库/大观园, 题库/kaoyan-semantic-data,
  题库/kaoyan-ecdict-data) into MindMap chapters (知识点·考点·解法), Multi-Question
  Review groups, and English Lexicon modules. Activate this skill when working on
  data extraction, cross-source question alignment, or chapter data compilation.
---

# 多源数据资产字典、职责分工与对齐规范 (Data Pipeline & Alignment)

## 1. 核心数据资产位置全景

所有核心源数据均作为独立 Git 子模块挂载于 `题库/` 目录下（配置见 [`.gitmodules`](file:///d:/tj/822/考研题库/.gitmodules)）：

| 资产域 | 标准子模块路径 | 核心内容与用途 |
| :--- | :--- | :--- |
| **名师讲义与笔记** | `题库/讲义和笔记/` | • `最终笔记/`：高纯度章节核心笔记 Markdown<br>• `李范复习全书整理/`：高数/线代/概率全章节 Markdown 整理稿<br>• `老姚高数_源码题库/chapters_tex/`：老姚 1~12 章 LaTeX 源码<br>• `零基础通关讲义整理/`：基础概念讲义 |
| **研砖结构化数据** | `题库/研砖/` | • `pojue_lectures.json`：196 招破题诀/招法讲义（题眼/步骤/避坑）<br>• `kaogang_figures.json`：85 个核心考点 2D/3D 几何可视化 DSL<br>• `syllabus.json` & `formulas.json`：考纲树与公式库<br>• `solutions` / `consolidation`：深度多维解析与巩固题 |
| **大观园题库索引** | `题库/大观园/` | 从 `cxyonly.fans/math` 抓取的真题与名师习题册文字版、来源标签与掌握度映射树 |
| **Semantic 语义层** | `题库/kaoyan-semantic-data/` | 本地题库 OCR 语义结构化清单（`semantic_manifest.json`）、640 规范节点、题眼信号与解法骨架标注 |
| **英语精读与词典** | `题库/英语/`<br>`题库/英语精读PDF/`<br>`题库/kaoyan-ecdict-data/` | • `题库/英语/data_1998.js` ~ `data_2026.js`：前端真题精读数据<br>• `题库/kaoyan-ecdict-data/`：Canonical Lexicon v2 词典底座 |
| **本地外部原始 PDF** | `D:\tj\822\数一\`<br>`D:\tj\822\822\`<br>`D:\tj\822\英一\` | 数学一各习题册原始 PDF、822 教材与习题解 PDF、英语唐静翻译等讲义原始 PDF |

> [!WARNING]
> 根目录下的 `data/`、`最终笔记/`、`讲义对照/`、`rebuilt_data/` 存在历史重复拷贝。进行新章节的数据整合时，优先以 `题库/` 下的标准 Git 子模块为权威源。

---

## 2. 数学「三大模式」的数据合成法则（各司其职）

在开发数学各章的 `O` 键思维导图与「多题对比复盘模式」题群时，严禁大水漫灌，严格按以下管道分工合成：

1. **【知识点】分支（概念/定理/推导/动图）**：
   - **唯一主干**：`题库/讲义和笔记/`（优先使用《最终笔记》与《李范复习全书整理》/《老姚高数源码》的章节逻辑树）。
   - **动图内嵌**：按知识点匹配 `题库/研砖/kaogang_figures.json`，挂载为 `MathViz` 几何可视化小部件。
2. **【考点】与【解法】分支（考纲目标/题眼/标准步骤）**：
   - **核心骨架**：以 `题库/研砖/` 的考纲考点与破题诀/招法谱系（`pojue_lectures.json`）为骨架，结合本地讲义中的题型归纳进行去重精简。
   - **关联连接**：在章节导图数据中建立【考点】与【知识点】、【考点】与【解法】之间的无向关联关系（`associativeLinks`）。
3. **【多题对比复盘模式】的题群挂载**：
   - **幕后对齐工具**：利用 `题库/大观园/`、`题库/kaoyan-semantic-data/` 与 `题库/研砖/` 的文字题干和出处标签，将本地切图题库（`30讲`、`36讲`、`1000题`、`880`、`李范`、`老姚`）中的规范题目 ID（`Canonical QID`）精准归集到对应的「考点」或「解法」题群下。

---

## 3. 跨源题目对齐铁律（零盲猜原则）

在将外部数据（研砖 / 大观园 / Semantic）与本地 `js/chapters.js` 中的习题册题号进行对齐映射时，必须遵守以下铁律：

1. **严禁凭书名缩写盲猜**：
   - 历史教训：研砖中的“强化 A/B/C”**不是**《张宇1000题》，必须通过提取源数据中的原始标签（Tag）与题干文本进行脚本比对确认。
2. **对齐率与一致率双重校验**：
   - 编写对齐脚本时，不能只看题号数量是否接近（对齐率），必须通过 LaTeX 归一化或关键词指纹抽检题干内容是否真正同一道题（一致率），应对不同年份版次导致的题号偏移。
3. **以单书/单章为样本先验确认**：
   - 批量生成映射表前，先以单个章节或单本习题册（如《基础30讲》第 1 章）为样本输出对照报告，确认每道题映射无误后再推广到全书。
