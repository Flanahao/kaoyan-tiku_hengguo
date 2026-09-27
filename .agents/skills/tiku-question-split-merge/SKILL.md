---
name: tiku-question-split-merge
description: >-
  Standard operating procedure (SOP) for splitting, merging, re-cropping, or
  replacing question/solution PNG images across Math 1 (8 workbooks) and 822 Control
  Engineering (4 workbooks), updating js/chapters.js routing, migrating user study
  records in kaoyan_tiku_data.json, and dual-committing Git submodules. Activate
  this skill whenever modifying question numbers, splitting/merging sub-questions,
  or cropping question images from PDFs.
---

# 题库题目拆分、合并与重裁切标准作业程序 (Split / Merge / Re-crop SOP)

当执行任何涉及**题目拆分 ($1 \to N$)、多题合并 ($N \to 1$)、坏图重裁替换、题号顺延平移**的任务时，**必须**首先调用 `view_file` 阅读本技能的完整参考手册：
- **完整各题本差异化规范与 6 步 SOP**：[references/workbook_rules_and_sop.md](./references/workbook_rules_and_sop.md)

---

## 核心红线速览（执行前必检）

1. **各题本特殊耦合机制**：
   - **《老姚高数》**：采用 `labels`（小节题号如 `"12.2-5"`）+ `imgLabels`（全章连续流水号如 `"12-13"`，对应 `pb_12-13`）**双轨制**！在章节中间拆合会引发直到本章末尾的**全章顺延平移（Domino Shift）**，且必须核对 `sections` 中的 `exampleCount`（正文例题 vs 补充练习边界）。
   - **《基础30讲》《强化36讲》《1000题》《夜雨强化》**：强耦合 `js/chapters.js` 中的三级微观知识树 `MATH_KNOWLEDGE_DATA[chId]`（`sections`、`subSections`、`itemDescs`），拆合题目时**必须同步更新 `itemDescs` 数组长度与各节 `start/count`**。
   - **《822教材》**：画布宽度恒为 `2005 px`，三分区顺序固定为 `['习题', '例题', '章末例题']`（拆合习题须后移例题与章末例题的 `start`）；第 9 章课后习题编号特例为 `10-1` ~ `10-23`。
   - **《夜雨强化》**：画布宽度恒为 `1536 px`，题干图必须在最后一行文字下沿 `15~20 px` 处干净截断，严禁裁入大面积手写空白。
2. **图片裁切四大视觉标准（「同章等宽、原位还原、纯白无痕、拼接自然」）**：
   - 动手前先测同章相邻正常图片的基准宽度 $W$，从原书 PDF（300 DPI）整栏等比缩放至宽度 $W$，**严禁局部窄框裁切**。
   - 纯白遮盖（`#FFFFFF`）无关小问时，**必须连同残留的逗号、分号、句号、括号或底部混入的栏目头一并抹除**；产出后必须用 `view_file` 逐张目视检查。
3. **两阶段防覆盖重命名与用户数据零丢失**：
   - 顺延重命名磁盘 PNG 与 `kaoyan_tiku_data.json` 键名时，**严禁原地循环覆盖**，必须先迁入临时命名空间（`__tmp_` / `newQuestions`），校验无误后再原子替换。
   - 合并题目时按保守熟练度聚合 `level`、求和 `errorCount`、拼接全部非空 `note`、取 `topics` 并集；拆分题目时深拷贝原题记录并删除旧孤儿键。
4. **验证与 Git 子模块双提交**：
   - 运行 `node tests/unit_tests.js` 与 `node tests/storage_test.js` 确保 100% 通过。
   - **先提交并推送 `题库/<子模块>`，再提交并推送主仓库**。
