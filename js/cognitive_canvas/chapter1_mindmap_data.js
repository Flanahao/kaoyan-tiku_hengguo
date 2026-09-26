/**
 * 考研数学认知视图 · 第1章 函数与极限 紧凑树状导图数据模型
 * 整合来源：
 * 1. 最终笔记/data/第1章_函数与极限.md (§1 函数、§2 极限、§3 连续 全量核心概念、定理、公式与同步块)
 * 2. 题库/研砖/pojue_lectures.json (GS01 核心考点题源与解法招法 M01~M16)
 * 3. 题库/研砖/kaogang_figures.json (MathViz 几何图解微部件挂载点)
 *
 * 核心设计（一屏一览全局 + 渐进展开子项）：
 * - 摒弃大段多行大卡片，将具体定义、定理、公式、要领、步骤、避坑、同步块全部下沉为紧凑单行树状子节点；
 * - 默认展开至第 2 层（一览全局态）：一屏同时清晰呈现左侧“最终笔记知识底座”与右侧“核心考点 + 解法招法”；
 * - 按需展开第 3 层（详情态）：通过节点折叠手柄、快捷键 Alt+. 或顶部层级按钮（一览全局 / 展开详情）随时展开子项。
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Chapter1MindMapData = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var examPointsMeta = [
    {
      uid: "kp_gs01_01",
      text: "0/0 型未定式极限求值",
      importance: 5,
      trend: "高频必考",
      questionCount: 32,
      questionRefIds: ["2024_math1_01", "2023_math3_15", "2022_math2_02"],
      associativeLineTargets: ["m_gs01_03", "m_gs01_04", "m_gs01_05", "k_equiv_table", "k_taylor_table"]
    },
    {
      uid: "kp_gs01_02",
      text: "极限反求参数与展开定阶",
      importance: 4,
      trend: "经典常考",
      questionCount: 18,
      questionRefIds: ["2023_math1_11", "2021_math2_10"],
      associativeLineTargets: ["m_gs01_16", "m_gs01_01", "k_taylor_table"]
    },
    {
      uid: "kp_gs01_03",
      text: "分段点与单侧极限存在性",
      importance: 4,
      trend: "上升趋势",
      questionCount: 14,
      questionRefIds: ["2022_math1_01", "2020_math3_03"],
      associativeLineTargets: ["m_gs01_02", "k_fn_properties", "k_discontinuity_types"]
    },
    {
      uid: "kp_gs01_04",
      text: "函数间断点类型判定与分类",
      importance: 4,
      trend: "基础常考",
      questionCount: 21,
      questionRefIds: ["2024_math2_03", "2021_math1_02"],
      associativeLineTargets: ["m_gs01_13", "k_discontinuity_types"]
    },
    {
      uid: "kp_gs01_05",
      text: "闭区间连续性与零点介值应用",
      importance: 3,
      trend: "综合大题常用",
      questionCount: 9,
      questionRefIds: ["2020_math1_16"],
      associativeLineTargets: ["m_gs01_02", "k_closed_interval_thm"]
    }
  ];

  var data = {
    data: {
      text: "第1章 函数与极限",
      uid: "root_chapter_1",
      role: "root",
      expand: true,
      examPoints: examPointsMeta
    },
    children: [
      // ═══════════════════════════════════════════════════════════════════════
      // 右侧分支 1：核心考点与题源 (dir: 'right')
      // ═══════════════════════════════════════════════════════════════════════
      {
        data: {
          text: "核心考点与题源",
          uid: "branch_exam_points",
          tag: "考点",
          tagType: "exam",
          dir: "right",
          expand: true
        },
        children: [
          {
            data: {
              text: "0/0 型未定式极限求值",
              uid: "kp_gs01_01",
              tag: "5★ 必考",
              tagType: "exam",
              questionCount: 32,
              resonanceLinks: ["m_gs01_03", "m_gs01_04", "m_gs01_05", "k_equiv_table", "k_taylor_table"],
              associativeLineTargets: ["m_gs01_03", "m_gs01_04", "m_gs01_05", "k_equiv_table", "k_taylor_table"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "历年真题 32 题（代表题：2024数一01 / 2023数三15 / 2022数二02）",
                  uid: "kp_gs01_01_ref",
                  tag: "题源",
                  tagType: "section"
                },
                children: []
              },
              {
                data: {
                  text: "破题路径：非零因式先提出 $\\to$ 乘除等价代换 $\\to$ 加减相消用泰勒 $\\to$ 洛必达兜底",
                  uid: "kp_gs01_01_path",
                  tag: "要领",
                  tagType: "method"
                },
                children: []
              }
            ]
          },
          {
            data: {
              text: "极限反求参数与展开定阶",
              uid: "kp_gs01_02",
              tag: "4★ 常考",
              tagType: "exam",
              questionCount: 18,
              resonanceLinks: ["m_gs01_16", "m_gs01_01", "k_taylor_table"],
              associativeLineTargets: ["m_gs01_16", "m_gs01_01", "k_taylor_table"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "历年真题 18 题（代表题：2023数一11 / 2021数二10）",
                  uid: "kp_gs01_02_ref",
                  tag: "题源",
                  tagType: "section"
                },
                children: []
              },
              {
                data: {
                  text: "破题路径：通分或取对数 $\\to$ 泰勒展开同变量幂 $\\to$ 发散低阶系数归零、首项配比",
                  uid: "kp_gs01_02_path",
                  tag: "要领",
                  tagType: "method"
                },
                children: []
              }
            ]
          },
          {
            data: {
              text: "分段点与单侧极限存在性",
              uid: "kp_gs01_03",
              tag: "4★ 上升",
              tagType: "exam",
              questionCount: 14,
              resonanceLinks: ["m_gs01_02", "k_fn_properties", "k_discontinuity_types"],
              associativeLineTargets: ["m_gs01_02", "k_fn_properties", "k_discontinuity_types"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "历年真题 14 题（代表题：2022数一01 / 2020数三03）",
                  uid: "kp_gs01_03_ref",
                  tag: "题源",
                  tagType: "section"
                },
                children: []
              },
              {
                data: {
                  text: "破题路径：识别 $|x|$、$e^{1/x}$、$\\arctan(1/x)$ 与分段交界 $\\to$ 严格分算 $x\\to x_0^\\pm$",
                  uid: "kp_gs01_03_path",
                  tag: "要领",
                  tagType: "method"
                },
                children: []
              }
            ]
          },
          {
            data: {
              text: "函数间断点类型判定与分类",
              uid: "kp_gs01_04",
              tag: "4★ 基础",
              tagType: "exam",
              questionCount: 21,
              resonanceLinks: ["m_gs01_13", "k_discontinuity_types"],
              associativeLineTargets: ["m_gs01_13", "k_discontinuity_types"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "历年真题 21 题（代表题：2024数二03 / 2021数一02）",
                  uid: "kp_gs01_04_ref",
                  tag: "题源",
                  tagType: "section"
                },
                children: []
              },
              {
                data: {
                  text: "破题路径：扫全分母零点与无定义点 $\\to$ 逐点算左右极限 $\\to$ 按第一/二类判据归类",
                  uid: "kp_gs01_04_path",
                  tag: "要领",
                  tagType: "method"
                },
                children: []
              }
            ]
          },
          {
            data: {
              text: "闭区间连续性与零点介值应用",
              uid: "kp_gs01_05",
              tag: "3★ 综合",
              tagType: "exam",
              questionCount: 9,
              resonanceLinks: ["m_gs01_02", "k_closed_interval_thm"],
              associativeLineTargets: ["m_gs01_02", "k_closed_interval_thm"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "历年真题 9 题（代表题：2020数一16）",
                  uid: "kp_gs01_05_ref",
                  tag: "题源",
                  tagType: "section"
                },
                children: []
              },
              {
                data: {
                  text: "破题路径：验证闭区间连续 $\\to$ 端点异号用零点定理 / 函数值组合用介值定理",
                  uid: "kp_gs01_05_path",
                  tag: "要领",
                  tagType: "method"
                },
                children: []
              }
            ]
          }
        ]
      },

      // ═══════════════════════════════════════════════════════════════════════
      // 右侧分支 2：解法流程与招法 (dir: 'right')
      // ═══════════════════════════════════════════════════════════════════════
      {
        data: {
          text: "解法流程与招法",
          uid: "branch_methods",
          tag: "招法",
          tagType: "method",
          dir: "right",
          expand: true
        },
        children: [
          {
            data: {
              text: "乘除因子局部等价代换法",
              uid: "m_gs01_03",
              tag: "M03 首选",
              tagType: "method",
              resonanceLinks: ["kp_gs01_01", "k_equiv_table"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "乘除因子放心换，加减位置一相消就退泰勒",
                  uid: "m_gs01_03_ol",
                  tag: "要领",
                  tagType: "method"
                },
                children: []
              },
              {
                data: {
                  text: "识别分子分母中的非零乘除因式，优先提出极限确定的非零常数因子",
                  uid: "m_gs01_03_s1",
                  tag: "步骤 1",
                  tagType: "step"
                },
                children: []
              },
              {
                data: {
                  text: "严格核对 $\\square\\to 0$ 条件，应用一阶/二阶/三阶主部公式直接代换",
                  uid: "m_gs01_03_s2",
                  tag: "步骤 2",
                  tagType: "step"
                },
                children: []
              },
              {
                data: {
                  text: "切勿在加减结构中草率替换局部单项，主部相消为零时必导致失真",
                  uid: "m_gs01_03_pf",
                  tag: "避坑",
                  tagType: "pitfall"
                },
                children: []
              }
            ]
          },
          {
            data: {
              text: "泰勒（麦克劳林）展开取主部法",
              uid: "m_gs01_04",
              tag: "M04 核心",
              tagType: "method",
              resonanceLinks: ["kp_gs01_01", "k_taylor_table"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "展到分子出现首个非零项就停，少了得 $0/0$，多了纯浪费",
                  uid: "m_gs01_04_ol",
                  tag: "要领",
                  tagType: "method"
                },
                children: []
              },
              {
                data: {
                  text: "确定分母（或已知阶一侧）整体的等价无穷小阶数 $x^k$",
                  uid: "m_gs01_04_s1",
                  tag: "步骤 1",
                  tagType: "step"
                },
                children: []
              },
              {
                data: {
                  text: "将分子所有复合项统一展开至 $x^k$ 阶，合并同类项直接读取首项系数比",
                  uid: "m_gs01_04_s2",
                  tag: "步骤 2",
                  tagType: "step"
                },
                children: []
              },
              {
                data: {
                  text: "各复合项必须展开到相同阶数 $x^k$，切勿提前截断内层高阶项",
                  uid: "m_gs01_04_pf",
                  tag: "避坑",
                  tagType: "pitfall"
                },
                children: []
              }
            ]
          },
          {
            data: {
              text: "洛必达法则（兜底与联合使用）",
              uid: "m_gs01_05",
              tag: "M05 兜底",
              tagType: "method",
              resonanceLinks: ["kp_gs01_01"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "先提非零因式、先做等价代换，求导后若仍复杂优先切换泰勒",
                  uid: "m_gs01_05_ol",
                  tag: "要领",
                  tagType: "method"
                },
                children: []
              },
              {
                data: {
                  text: "严格验证分子分母同时趋于 $0$ 或同时趋于 $\\infty$，且去心邻域内可导",
                  uid: "m_gs01_05_s1",
                  tag: "步骤 1",
                  tagType: "step"
                },
                children: []
              },
              {
                data: {
                  text: "上下分别求导（含变限积分时用求导公式），立即化简新分式",
                  uid: "m_gs01_05_s2",
                  tag: "步骤 2",
                  tagType: "step"
                },
                children: []
              },
              {
                data: {
                  text: "未验证未定式直接求导必错；导数比极限振荡不存在（如含 $\\cos\\frac{1}{x}$）时禁用",
                  uid: "m_gs01_05_pf",
                  tag: "避坑",
                  tagType: "pitfall"
                },
                children: []
              }
            ]
          },
          {
            data: {
              text: "由极限值反推分子分母行为",
              uid: "m_gs01_01",
              tag: "M01 反推",
              tagType: "method",
              resonanceLinks: ["kp_gs01_02"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "分母趋于 $0$ 而整体极限有限，分子必趋于 $0$；趋于 $0$ 不等于函数值是 $0$",
                  uid: "m_gs01_01_ol",
                  tag: "要领",
                  tagType: "method"
                },
                children: []
              },
              {
                data: {
                  text: "分式极限为有限数 $A$：若分母 $\\to 0$，则分子必 $\\to 0$；若 $A\\ne 0$ 且分子 $\\to 0$，则分母必 $\\to 0$",
                  uid: "m_gs01_01_s1",
                  tag: "步骤",
                  tagType: "step"
                },
                children: []
              },
              {
                data: {
                  text: "未指明函数在该点连续时，切勿将 $\\lim_{x\\to x_0}f(x)=0$ 直接当作 $f(x_0)=0$",
                  uid: "m_gs01_01_pf",
                  tag: "避坑",
                  tagType: "pitfall"
                },
                children: []
              }
            ]
          },
          {
            data: {
              text: "分左右极限判存在性与求值",
              uid: "m_gs01_02",
              tag: "M02 单侧",
              tagType: "method",
              resonanceLinks: ["kp_gs01_03", "kp_gs01_05"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "识别信号为含 $e^{1/x}$、$\\arctan\\frac{1}{x}$、$|x|$ 或分段点，逐侧计算左右极限",
                  uid: "m_gs01_02_ol",
                  tag: "要领",
                  tagType: "method"
                },
                children: []
              },
              {
                data: {
                  text: "定位敏感点，分别计算左极限 $A_- = f(x_0-0)$ 与右极限 $A_+ = f(x_0+0)$",
                  uid: "m_gs01_02_s1",
                  tag: "步骤",
                  tagType: "step"
                },
                children: []
              },
              {
                data: {
                  text: "$e^{1/x}$ 在 $x\\to 0^+$ 时为 $+\\infty$，在 $x\\to 0^-$ 时为 $0$，切勿两侧合并计算",
                  uid: "m_gs01_02_pf",
                  tag: "避坑",
                  tagType: "pitfall"
                },
                children: []
              }
            ]
          },
          {
            data: {
              text: "展开定阶与逐阶匹配系数",
              uid: "m_gs01_16",
              tag: "M16 定阶",
              tagType: "method",
              resonanceLinks: ["kp_gs01_02", "k_taylor_table"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "两边展成同一变量的幂，从最低阶往上逐阶配，发散阶系数必须归零",
                  uid: "m_gs01_16_ol",
                  tag: "要领",
                  tagType: "method"
                },
                children: []
              },
              {
                data: {
                  text: "化为单分式 $P(x)/x^k = A$，令低于 $x^k$ 的各项系数全为 $0$，$x^k$ 系数比为 $A$",
                  uid: "m_gs01_16_s1",
                  tag: "步骤",
                  tagType: "step"
                },
                children: []
              },
              {
                data: {
                  text: "未知参数位于分母或幂指内部时，须先同乘或取对数化为 $e^{g\\ln f}$ 再配系数",
                  uid: "m_gs01_16_pf",
                  tag: "避坑",
                  tagType: "pitfall"
                },
                children: []
              }
            ]
          },
          {
            data: {
              text: "间断点的判定与分类流程",
              uid: "m_gs01_13",
              tag: "M13 排查",
              tagType: "method",
              resonanceLinks: ["kp_gs01_04", "k_discontinuity_types"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "漏点比判错更常见，先把无定义点与分段点扫全，再逐点分算左右极限",
                  uid: "m_gs01_13_ol",
                  tag: "要领",
                  tagType: "method"
                },
                children: []
              },
              {
                data: {
                  text: "排查全部分母零点、对数真数非正点及分段交界点，逐点比较 $f(x_0\\pm 0)$",
                  uid: "m_gs01_13_s1",
                  tag: "步骤",
                  tagType: "step"
                },
                children: []
              },
              {
                data: {
                  text: "切勿先约去分子分母公因式再找间断点，否则必遗漏可去间断点",
                  uid: "m_gs01_13_pf",
                  tag: "避坑",
                  tagType: "pitfall"
                },
                children: []
              }
            ]
          }
        ]
      },

      // ═══════════════════════════════════════════════════════════════════════
      // 左侧主分支：核心知识点体系 (dir: 'left')
      // ═══════════════════════════════════════════════════════════════════════
      {
        data: {
          text: "核心知识点体系",
          uid: "branch_knowledge",
          tag: "知识",
          tagType: "knowledge",
          role: "knowledge_sec",
          dir: "left",
          expand: true
        },
        children: [
          // §1 函数 (来自 最终笔记/data/第1章_函数与极限.md, dir: 'left')
          {
            data: {
              text: "函数",
              uid: "sec_1_func",
              tag: "§1",
              tagType: "section",
              role: "section",
              dir: "left",
              expand: true
            },
        children: [
          {
            data: {
              text: "1.1 函数概念与两要素",
              uid: "k_fn_concept",
              expand: false
            },
            children: [
              {
                data: {
                  text: "对应法则 $y=f(x), x\\in D$；考研主要研究单值函数（每个 $x$ 唯一对应 $y$）",
                  uid: "k_fn_concept_1",
                  tag: "定义",
                  tagType: "def"
                },
                children: []
              },
              {
                data: {
                  text: "两要素：定义域 $D_f$ 与对应法则 $f$（两者均相同才为同一函数）",
                  uid: "k_fn_concept_2",
                  tag: "要领",
                  tagType: "prop"
                },
                children: []
              }
            ]
          },
          {
            data: {
              text: "1.2 函数的四种基本性质",
              uid: "k_fn_properties",
              resonanceLinks: ["kp_gs01_03"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "有界性：$\\exists M>0, \\forall x\\in X, |f(x)|\\le M$（等价于既有上界又有下界）",
                  uid: "k_fn_prop_bound",
                  tag: "有界",
                  tagType: "def"
                },
                children: []
              },
              {
                data: {
                  text: "单调性：$x_1<x_2 \\Rightarrow f(x_1)<f(x_2)$ 为严格增；$\\le$ 为单调不减",
                  uid: "k_fn_prop_mono",
                  tag: "单调",
                  tagType: "def"
                },
                children: []
              },
              {
                data: {
                  text: "奇偶性：定义域对称，$f(-x)=f(x)$ 偶，$f(-x)=-f(x)$ 奇；奇函数若 $0\\in D$ 则 $f(0)=0$",
                  uid: "k_fn_prop_parity",
                  tag: "奇偶",
                  tagType: "prop"
                },
                children: []
              },
              {
                data: {
                  text: "周期性：$f(x+T)=f(x)$；连续周期函数 $\\int_0^x f(t)dt$ 仍以 $T$ 为周期 $\\iff \\int_0^T f(t)dt=0$",
                  uid: "k_fn_prop_period",
                  tag: "周期",
                  tagType: "thm"
                },
                children: []
              },
              {
                data: {
                  text: "导函数奇偶互换；连续奇函数原函数皆偶，连续偶函数原函数仅 $\\int_0^x f(t)dt$ 为奇（详见第2/3章）",
                  uid: "k_fn_prop_sync",
                  tag: "同步块",
                  tagType: "sync"
                },
                children: []
              }
            ]
          },
          {
            data: {
              text: "1.3 复合函数与反函数",
              uid: "k_fn_comp_inv",
              expand: false
            },
            children: [
              {
                data: {
                  text: "复合函数 $y=f[\\varphi(x)]$：须内层值域落在外层定义域内；链式法则 $\\frac{dy}{dx}=f'[\\varphi(x)]\\varphi'(x)$",
                  uid: "k_fn_comp_1",
                  tag: "复合",
                  tagType: "formula"
                },
                children: []
              },
              {
                data: {
                  text: "反函数 $x=f^{-1}(y)$：严格单调必有反函数且单调性相同，图形关于 $y=x$ 对称",
                  uid: "k_fn_inv_1",
                  tag: "反函数",
                  tagType: "prop"
                },
                children: []
              },
              {
                data: {
                  text: "一阶微分形式不变性 $dy=f'(u)du$；反函数导数 $x'_y=\\frac{1}{f'(x)}, x''_{yy}=-\\frac{f''(x)}{[f'(x)]^3}$（第2章）",
                  uid: "k_fn_comp_sync",
                  tag: "同步块",
                  tagType: "sync"
                },
                children: []
              }
            ]
          },
          {
            data: {
              text: "1.4 常见函数形式与初等函数",
              uid: "k_deriv_geom",
              hasWidget: true,
              widgetType: "derivative_tangent",
              widgetTitle: "导数几何意义与割线逼近切线微部件",
              expand: false
            },
            children: [
              {
                data: {
                  text: "六类形式：初等函数、分段函数、隐函数 $F(x,y)=0$、参数方程、变限积分 $\\int_a^x f$、级数和",
                  uid: "k_fn_forms_1",
                  tag: "分类",
                  tagType: "def"
                },
                children: []
              },
              {
                data: {
                  text: "双曲与反三角：$\\sinh x=\\frac{e^x-e^{-x}}{2}, \\cosh^2 x-\\sinh^2 x=1$；$\\arcsin x+\\arccos x=\\frac{\\pi}{2}$",
                  uid: "k_fn_forms_2",
                  tag: "恒等式",
                  tagType: "formula"
                },
                children: []
              },
              {
                data: {
                  text: "隐函数求导、参数方程 $\\frac{dy}{dx}=\\frac{\\psi'(t)}{\\varphi'(t)}$、变限积分求导与割线逼近切线（详见第2/3章）",
                  uid: "k_fn_forms_sync",
                  tag: "同步块",
                  tagType: "sync"
                },
                children: []
              }
            ]
          }
        ]
      },

      // §2 极限 (来自 最终笔记/data/第1章_函数与极限.md, dir: 'left')
      {
        data: {
          text: "极限",
          uid: "sec_2_limit",
          tag: "§2",
          tagType: "section",
          role: "section",
          dir: "left",
          expand: true
        },
        children: [
          {
            data: {
              text: "2.1 极限的概念与基本性质",
              uid: "k_lim_def_prop",
              expand: false
            },
            children: [
              {
                data: {
                  text: "定义：数列 $\\forall\\varepsilon>0,\\exists N$；函数 $0<|x-x_0|<\\delta \\Rightarrow |f(x)-A|<\\varepsilon$（与 $f(x_0)$ 无关）",
                  uid: "k_lim_def_1",
                  tag: "定义1.1~1.3",
                  tagType: "def"
                },
                children: []
              },
              {
                data: {
                  text: "单侧充要条件：$\\lim_{x\\to x_0}f(x)=A \\iff f(x_0-0)=f(x_0+0)=A$",
                  uid: "k_lim_def_2",
                  tag: "定理1.8",
                  tagType: "thm"
                },
                children: []
              },
              {
                data: {
                  text: "不等式与保号性：$A>0 \\Rightarrow$ 去心邻域内 $f(x)>0$；若去心邻域 $f(x)>0$ 则 $A\\ge 0$（等号可激活）",
                  uid: "k_lim_prop_sign",
                  tag: "定理1.3",
                  tagType: "thm"
                },
                children: []
              },
              {
                data: {
                  text: "有界性：收敛数列必有界【定理1.2】；函数极限存在则在某去心邻域内局部有界【定理1.4】",
                  uid: "k_lim_prop_bound",
                  tag: "定理1.2/1.4",
                  tagType: "thm"
                },
                children: []
              }
            ]
          },
          {
            data: {
              text: "2.2 极限存在判别与重要极限",
              uid: "k_two_limits",
              expand: false
            },
            children: [
              {
                data: {
                  text: "夹逼准则：若 $h(x)\\le f(x)\\le g(x)$ 且 $\\lim h=\\lim g=A$，则 $\\lim f=A$（常用于 $n$ 项和放缩）",
                  uid: "k_lim_crit_squeeze",
                  tag: "定理1.5/1.6",
                  tagType: "thm"
                },
                children: []
              },
              {
                data: {
                  text: "单调有界准则：单调上升有上界或单调下降有下界的数列必收敛（递推数列 $x_{n+1}=f(x_n)$ 首选）",
                  uid: "k_lim_crit_mono",
                  tag: "定理1.7",
                  tagType: "thm"
                },
                children: []
              },
              {
                data: {
                  text: "两个重要极限：$\\lim_{\\square\\to 0}\\frac{\\sin\\square}{\\square}=1$，$\\lim_{x\\to\\infty}(1+\\frac{1}{x})^x=e$（$1^\\infty$ 型 $\\to e^{\\lim g(f-1)}$）",
                  uid: "k_lim_imp_two",
                  tag: "公式",
                  tagType: "formula"
                },
                children: []
              },
              {
                data: {
                  text: "Heine 归结原则：$\\lim_{x\\to x_0}f(x)=A \\iff$ 对任意 $x_n\\to x_0(x_n\\ne x_0)$ 有 $\\lim f(x_n)=A$",
                  uid: "k_lim_heine",
                  tag: "归结原则",
                  tagType: "thm"
                },
                children: []
              }
            ]
          },
          {
            data: {
              text: "2.3 常用等价无穷小代换公式",
              uid: "k_equiv_table",
              resonanceLinks: ["kp_gs01_01", "m_gs01_03"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "一阶主部 ($x\\to 0$)：$\\sin x\\sim\\tan x\\sim\\arcsin x\\sim\\arctan x\\sim e^x-1\\sim\\ln(1+x)\\sim x$",
                  uid: "k_equiv_1",
                  tag: "一阶",
                  tagType: "formula"
                },
                children: []
              },
              {
                data: {
                  text: "二阶与幂指：$1-\\cos x\\sim\\frac{1}{2}x^2$，$(1+\\beta x)^\\alpha-1\\sim\\alpha\\beta x$，$a^x-1\\sim x\\ln a$",
                  uid: "k_equiv_2",
                  tag: "二阶/幂",
                  tagType: "formula"
                },
                children: []
              },
              {
                data: {
                  text: "三阶差式：$x-\\sin x\\sim\\frac{x^3}{6}$，$\\tan x-x\\sim\\frac{x^3}{3}$，$x-\\arctan x\\sim\\frac{x^3}{3}$，$\\tan x-\\sin x\\sim\\frac{x^3}{2}$",
                  uid: "k_equiv_3",
                  tag: "三阶差",
                  tagType: "formula"
                },
                children: []
              }
            ]
          },
          {
            data: {
              text: "2.4 泰勒展开与无穷小阶的比较",
              uid: "k_taylor_table",
              resonanceLinks: ["kp_gs01_01", "kp_gs01_02", "m_gs01_04", "m_gs01_16"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "$\\sin x = x-\\frac{x^3}{6}+o(x^3)$，$\\cos x = 1-\\frac{x^2}{2}+\\frac{x^4}{24}+o(x^4)$",
                  uid: "k_taylor_1",
                  tag: "展开I",
                  tagType: "formula"
                },
                children: []
              },
              {
                data: {
                  text: "$e^x = 1+x+\\frac{x^2}{2}+\\frac{x^3}{6}+o(x^3)$，$\\ln(1+x) = x-\\frac{x^2}{2}+\\frac{x^3}{3}+o(x^3)$",
                  uid: "k_taylor_2",
                  tag: "展开II",
                  tagType: "formula"
                },
                children: []
              },
              {
                data: {
                  text: "阶的判定【定义1.6/1.7】：$\\lim\\frac{\\beta}{\\alpha^k}=l\\ne 0$ 为 $k$ 阶；积的阶相加，和的阶由最低阶项主导",
                  uid: "k_taylor_order",
                  tag: "定阶",
                  tagType: "def"
                },
                children: []
              },
              {
                data: {
                  text: "利用导数定义求极限、利用定积分定义求 $n$ 项和极限 $\\lim_{n\\to\\infty}\\frac{1}{n}\\sum_{i=1}^n f(\\frac{i}{n})=\\int_0^1 f(x)dx$（第2/3章）",
                  uid: "k_taylor_sync",
                  tag: "同步块",
                  tagType: "sync"
                },
                children: []
              }
            ]
          }
        ]
      },

      // §3 连续 (来自 最终笔记/data/第1章_函数与极限.md, dir: 'left')
      {
        data: {
          text: "连续",
          uid: "sec_3_cont",
          tag: "§3",
          tagType: "section",
          role: "section",
          dir: "left",
          expand: true
        },
        children: [
          {
            data: {
              text: "3.1 连续性定义与间断点分类",
              uid: "k_discontinuity_types",
              hasWidget: true,
              widgetType: "discontinuity_trio",
              widgetTitle: "间断点分类参数化几何图解",
              resonanceLinks: ["kp_gs01_03", "kp_gs01_04", "m_gs01_13"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "连续充要条件【定义1.8/定理1.13】：$\\lim_{x\\to x_0}f(x)=f(x_0) \\iff f(x_0-0)=f(x_0+0)=f(x_0)$",
                  uid: "k_cont_def_1",
                  tag: "定义1.8",
                  tagType: "def"
                },
                children: []
              },
              {
                data: {
                  text: "第一类间断点（左右极限均存在）：相等但 $\\ne f(x_0)$ 为可去间断点；不相等为跳跃间断点",
                  uid: "k_cont_disc_1",
                  tag: "第一类",
                  tagType: "prop"
                },
                children: []
              },
              {
                data: {
                  text: "第二类间断点（至少一侧极限不存在）：趋于 $\\infty$ 为无穷间断点；震荡无极限为振荡间断点",
                  uid: "k_cont_disc_2",
                  tag: "第二类",
                  tagType: "prop"
                },
                children: []
              }
            ]
          },
          {
            data: {
              text: "3.2 闭区间连续函数的四大性质",
              uid: "k_closed_interval_thm",
              resonanceLinks: ["kp_gs01_05"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "有界性与最值定理【定理1.16/1.17】：$f\\in C[a,b] \\Rightarrow$ 在 $[a,b]$ 上必有界且能取到最大、最小值",
                  uid: "k_cont_thm_bound",
                  tag: "定理1.16/17",
                  tagType: "thm"
                },
                children: []
              },
              {
                data: {
                  text: "零点定理：$f\\in C[a,b]$ 且 $f(a)f(b)<0 \\Rightarrow \\exists c\\in(a,b)$ 使 $f(c)=0$（方程根存在性首选）",
                  uid: "k_cont_thm_zero",
                  tag: "零点定理",
                  tagType: "thm"
                },
                children: []
              },
              {
                data: {
                  text: "介值定理【定理1.18】：$f\\in C[a,b]$，对介于 $f(a),f(b)$ 间的任意 $\\eta$，$\\exists c\\in(a,b)$ 使 $f(c)=\\eta$",
                  uid: "k_cont_thm_inter",
                  tag: "定理1.18",
                  tagType: "thm"
                },
                children: []
              }
            ]
          },
          {
            data: {
              text: "3.3 连续与可微、可导的对照阶梯",
              uid: "k_cont_diff_ladder",
              expand: false
            },
            children: [
              {
                data: {
                  text: "一元性态阶梯：有定义 $\\Leftarrow$ 极限存在 $\\Leftarrow$ 连续 $\\Leftarrow$ 可导 $\\iff$ 可微 $\\Leftarrow C^1$（逆命题不成立）",
                  uid: "k_cont_ladder_1",
                  tag: "阶梯",
                  tagType: "prop"
                },
                children: []
              },
              {
                data: {
                  text: "典型反例：连续但不可导 $y=|x|$；可导但导函数不连续 $f(x)=x^2\\sin\\frac{1}{x}\\ (x\\ne 0), f(0)=0$",
                  uid: "k_cont_ladder_2",
                  tag: "反例",
                  tagType: "pitfall"
                },
                children: []
              },
              {
                data: {
                  text: "达布定理（导函数介值性）：导函数若有间断点，必为第二类间断点，绝无第一类间断点（详见第2章）",
                  uid: "k_cont_ladder_sync",
                  tag: "同步块",
                  tagType: "sync"
                },
                children: []
              }
            ]
          }
        ]
      }
    ]
  }
]
};

  return data;
});
