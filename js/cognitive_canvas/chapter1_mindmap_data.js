/**
 * 考研数学认知视图 · 第1章 函数与极限 全量无损重整数据模型
 * 整合来源：
 * 1. 题库/讲义和笔记/ (《数学笔记 讲01-02》+《李范复习全书整理 ch1 全文》+《老姚高数源码》)
 * 2. 题库/研砖/ (GS01 全部 16 招破题诀 + 核心公式 + 几何动图 kaogang_figures.json)
 * 3. 题库/kaoyan-semantic-data/ (考点体系与方法归纳)
 * 4. 张宇基础30讲/强化36讲 ch1-2 (精髓口诀与特例补充，以 [待确认·30讲] 待转正形式就近挂载)
 *
 * 核心架构规范：
 * - 顶层二级分类严格命名为：考点 (正上方目录组织图)、知识点 (左下方逻辑图)、解法 (右下方逻辑图)；
 * - 零 Emoji、零外部品牌命名；
 * - 预设 macroLevel: 0 (章), 1 (二级分类), 2 (节/招法级), 3 (1.1小节/招法步骤级，即 L1 学科有限层级截断点)；
 * - 挂载 4 个跨章同步块 (sync_parity_period, sync_boundedness, sync_cont_diff_1vN, sync_limit_cross_tools)；
 * - 保持 19 条经典无向拓扑关联线，完全兼容 Focus Resonance 与端到端自动化测试。
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Chapter1MindMapData = factory();
    if (typeof window !== 'undefined' && window.CognitiveViewController && typeof window.CognitiveViewController.registerChapterMindMap === 'function') {
      window.CognitiveViewController.registerChapterMindMap('math_ch1', root.Chapter1MindMapData);
    }
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
      chapterId: "math_ch1",
      subjectId: "math",
      chapterIndex: 1,
      macroLevel: 0,
      expand: true,
      examPoints: examPointsMeta
    },
    children: [
      // ═══════════════════════════════════════════════════════════════════════
      // 考点分支 (正上方目录组织图，dir: 'right' 挂载)
      // ═══════════════════════════════════════════════════════════════════════
      {
        data: {
          text: "考点",
          uid: "branch_exam_points",
          tag: "考点",
          tagType: "exam",
          dir: "right",
          macroLevel: 1,
          expand: true
        },
        children: [
          {
            data: {
              text: "0/0 型未定式极限求值",
              uid: "kp_gs01_01",
              tag: "5★ 必考",
              tagType: "exam",
              macroLevel: 2,
              questionCount: 32,
              resonanceLinks: ["m_gs01_03", "m_gs01_04", "m_gs01_05", "k_equiv_table", "k_taylor_table"],
              expand: true
            },
            children: [
              {
                data: {
                  text: "题源：2024数一T1、2023数三T15、2022数二T2",
                  uid: "kp_gs01_01_ref",
                  tag: "题源",
                  tagType: "key",
                  macroLevel: 3,
                  role: "ref"
                }
              },
              {
                data: {
                  text: "要领：非零因子先提出 $\\to$ 乘除等价代换 $\\to$ 泰勒展开同阶截断 $\\to$ 洛必达辅助",
                  uid: "kp_gs01_01_path",
                  tag: "要领",
                  tagType: "step",
                  macroLevel: 3,
                  role: "path"
                }
              }
            ]
          },
          {
            data: {
              text: "极限反求参数与展开定阶",
              uid: "kp_gs01_02",
              tag: "4★ 经典",
              tagType: "exam",
              macroLevel: 2,
              questionCount: 18,
              resonanceLinks: ["m_gs01_16", "m_gs01_01", "k_taylor_table"],
              expand: true
            },
            children: [
              {
                data: {
                  text: "题源：2023数一T11、2021数二T10",
                  uid: "kp_gs01_02_ref",
                  tag: "题源",
                  tagType: "key",
                  macroLevel: 3,
                  role: "ref"
                }
              },
              {
                data: {
                  text: "要领：麦克劳林展开至分母同阶 $\\to$ 逐阶系数归零列线性方程组求解",
                  uid: "kp_gs01_02_path",
                  tag: "要领",
                  tagType: "step",
                  macroLevel: 3,
                  role: "path"
                }
              }
            ]
          },
          {
            data: {
              text: "分段点与单侧极限存在性",
              uid: "kp_gs01_03",
              tag: "4★ 趋势",
              tagType: "exam",
              macroLevel: 2,
              questionCount: 14,
              resonanceLinks: ["m_gs01_02", "k_fn_properties", "k_discontinuity_types"],
              expand: true
            },
            children: [
              {
                data: {
                  text: "题源：2022数一T1、2020数三T3",
                  uid: "kp_gs01_03_ref",
                  tag: "题源",
                  tagType: "key",
                  macroLevel: 3,
                  role: "ref"
                }
              },
              {
                data: {
                  text: "要领：定位分段点 $\\to$ 分别计算左右单侧极限 $\\to$ 核验左右相等性与函数值",
                  uid: "kp_gs01_03_path",
                  tag: "要领",
                  tagType: "step",
                  macroLevel: 3,
                  role: "path"
                }
              }
            ]
          },
          {
            data: {
              text: "函数间断点类型判定与分类",
              uid: "kp_gs01_04",
              tag: "4★ 基础",
              tagType: "exam",
              macroLevel: 2,
              questionCount: 21,
              resonanceLinks: ["m_gs01_13", "k_discontinuity_types"],
              expand: true
            },
            children: [
              {
                data: {
                  text: "题源：2024数二T3、2021数一T2",
                  uid: "kp_gs01_04_ref",
                  tag: "题源",
                  tagType: "key",
                  macroLevel: 3,
                  role: "ref"
                }
              },
              {
                data: {
                  text: "要领：排查无定义点与分段点 $\\to$ 求单侧极限 $\\to$ 第一类(可去/跳跃) vs 第二类(无穷/振荡)",
                  uid: "kp_gs01_04_path",
                  tag: "要领",
                  tagType: "step",
                  macroLevel: 3,
                  role: "path"
                }
              }
            ]
          },
          {
            data: {
              text: "闭区间连续性与零点介值应用",
              uid: "kp_gs01_05",
              tag: "3★ 综合",
              tagType: "exam",
              macroLevel: 2,
              questionCount: 9,
              resonanceLinks: ["m_gs01_02", "k_closed_interval_thm"],
              expand: true
            },
            children: [
              {
                data: {
                  text: "题源：2020数一T16综合大题",
                  uid: "kp_gs01_05_ref",
                  tag: "题源",
                  tagType: "key",
                  macroLevel: 3,
                  role: "ref"
                }
              },
              {
                data: {
                  text: "要领：构造连续辅助函数 $F(x)$ $\\to$ 端点异号用零点定理，最值介值构造双侧夹逼",
                  uid: "kp_gs01_05_path",
                  tag: "要领",
                  tagType: "step",
                  macroLevel: 3,
                  role: "path"
                }
              }
            ]
          }
        ]
      },

      // ═══════════════════════════════════════════════════════════════════════
      // 知识点分支 (左下方逻辑图，dir: 'left' 挂载)
      // ═══════════════════════════════════════════════════════════════════════
      {
        data: {
          text: "知识点",
          uid: "branch_knowledge",
          tag: "知识点",
          tagType: "knowledge",
          dir: "left",
          macroLevel: 1,
          expand: true
        },
        children: [
          // §1 函数
          {
            data: {
              text: "§1 函数",
              uid: "sec_1_func",
              dir: "left",
              role: "section",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "1.1 函数概念与两要素",
                  uid: "k_fn_concept",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "单值对应法则：数集 $D\\subset\\mathbb{R}$，$\\forall x\\in D$，有唯一确定的 $y\\in\\mathbb{R}$ 与之对应，记作 $y=f(x)$",
                      uid: "k_fn_concept_1",
                      tag: "定义",
                      tagType: "def"
                    }
                  },
                  {
                    data: {
                      text: "函数两要素：定义域 $D_f$ 与对应法则 $f$；两要素完全相同即为同一函数（值域由定义域与法则唯一确定）",
                      uid: "k_fn_concept_2",
                      tag: "概念",
                      tagType: "def"
                    }
                  },
                  {
                    data: {
                      text: "六大表现形式：显函数、隐函数 $F(x,y)=0$、分段函数、参数方程、变限积分函数 $\\int_a^x f(t)dt$、初等函数",
                      uid: "k_fn_concept_forms",
                      tag: "分类",
                      tagType: "prop"
                    }
                  },
                  {
                    data: {
                      text: "复合函数自然定义域嵌套求交法：内层值域包含在外层定义域内 $R_g \\cap D_f \\neq \\emptyset$",
                      uid: "k_pending_comp_dom",
                      tag: "待确认·30讲",
                      tagType: "pending",
                      formalTag: "法",
                      formalTagType: "method"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "1.2 函数的四大基本性质",
                  uid: "k_fn_properties",
                  macroLevel: 3,
                  resonanceLinks: ["kp_gs01_03"],
                  expand: false
                },
                children: [
                  // 挂载跨章同步块：奇偶性与周期性互转
                  {
                    data: {
                      text: "函数、导函数、原函数与变限积分的奇偶性/周期性互转规律",
                      uid: "k_fn_prop_sync_parity",
                      syncBlockId: "sync_parity_period",
                      role: "sync_block"
                    },
                    children: []
                  },
                  // 挂载跨章同步块：有界性四大判定准则与反例族
                  {
                    data: {
                      text: "函数有界性的四大判定准则与典型反例对比",
                      uid: "k_fn_prop_sync_bound",
                      syncBlockId: "sync_boundedness",
                      role: "sync_block"
                    },
                    children: []
                  },
                  {
                    data: {
                      text: "单调性判定定理：导数非负/非正与严格单调（$f'(x)>0$ 且零点不构成区间）",
                      uid: "k_fn_prop_mono",
                      tag: "性质",
                      tagType: "prop"
                    }
                  },
                  {
                    data: {
                      text: "奇函数核心性质：若 $f(x)$ 为奇函数且在 $x=0$ 有定义，则必有 $f(0)=0$；若可导则必有 $f'(0)$ 为极值或鞍点",
                      uid: "k_fn_prop_parity",
                      tag: "性质",
                      tagType: "prop"
                    }
                  },
                  {
                    data: {
                      text: "区间对称定积分简化定理：对称区间上奇函数积分为零，偶函数积分为半区间两倍",
                      uid: "k_pending_symm_int",
                      tag: "待确认·李范",
                      tagType: "pending",
                      formalTag: "结",
                      formalTagType: "conclusion"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "1.3 复合函数与反函数",
                  uid: "k_fn_comp_inv",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "反函数存在充要条件：自变量与因变量形成一一单射（严格单调函数必有反函数且单调性相同）",
                      uid: "k_fn_inv_1",
                      tag: "充要",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "反函数几何特征：图像关于直线 $y=x$ 对称",
                      uid: "k_fn_comp_1",
                      tag: "性质",
                      tagType: "prop"
                    }
                  },
                  {
                    data: {
                      text: "反函数求导法则：一阶导数 $f'(y)=\\frac{1}{x'(y)}$，二阶导数 $f''(y)=-\\frac{x''(y)}{[x'(y)]^3}$",
                      uid: "k_fn_inv_deriv",
                      tag: "公式",
                      tagType: "formula"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "1.4 三角、反三角、双曲与反双曲函数体系",
                  uid: "k_fn_trig_hyper",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "六大反三角主值区间与互补恒等式：$\\arcsin x + \\arccos x = \\frac{\\pi}{2}$，$\\arctan x + \\text{arcctg } x = \\frac{\\pi}{2}$",
                      uid: "k_fn_inv_trig_ident",
                      tag: "恒等式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "双曲函数与平方关系：$\\sinh x=\\frac{e^x-e^{-x}}{2}$，$\\cosh x=\\frac{e^x+e^{-x}}{2}$，$\\cosh^2 x - \\sinh^2 x = 1$",
                      uid: "k_fn_hyperbolic_def",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "反双曲函数对数显式：$\\text{arsh } x = \\ln(x+\\sqrt{x^2+1})$，$\\text{arch } x = \\ln(x+\\sqrt{x^2-1})$",
                      uid: "k_fn_arsh_log",
                      tag: "公式",
                      tagType: "formula"
                    }
                  }
                ]
              }
            ]
          },

          // §2 极限
          {
            data: {
              text: "§2 极限",
              uid: "sec_2_limit",
              dir: "left",
              role: "section",
              macroLevel: 2,
              hasWidget: true,
              widgetType: "important_limit_sinx_x",
              expand: true
            },
            children: [
              {
                data: {
                  text: "2.1 数列极限与函数极限的定义及基本性质",
                  uid: "k_lim_def_prop",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "数列极限 $\\varepsilon-N$ 严格定义：$\\forall \\varepsilon>0, \\exists N, \\forall n>N, |x_n-a|<\\varepsilon$（几何上邻域外只有有限项）",
                      uid: "k_lim_def_1",
                      tag: "定义",
                      tagType: "def"
                    }
                  },
                  {
                    data: {
                      text: "函数极限 $\\varepsilon-\\delta$ 严格定义：$\\forall \\varepsilon>0, \\exists \\delta>0, \\forall 0<|x-x_0|<\\delta, |f(x)-A|<\\varepsilon$",
                      uid: "k_lim_def_2",
                      tag: "定义",
                      tagType: "def"
                    }
                  },
                  {
                    data: {
                      text: "极限三大基本性质：唯一性、局部有界性、局部保号性（严格不等号脱帽强推强，戴帽弱推弱）",
                      uid: "k_lim_prop_sign",
                      tag: "性质",
                      tagType: "prop"
                    }
                  },
                  {
                    data: {
                      text: "不等号取极限等号激活警示：若 $f(x)>0$，当 $x\\to x_0$ 取极限后只能得到 $\\lim f(x) \\ge 0$，不能保证大于0",
                      uid: "k_lim_prop_bound",
                      tag: "避坑",
                      tagType: "warn"
                    }
                  },
                  {
                    data: {
                      text: "海涅定理判断函数极限不存在的交错子列选取招法",
                      uid: "k_pending_heine_alt",
                      tag: "待确认·研砖",
                      tagType: "pending",
                      formalTag: "招法",
                      formalTagType: "method"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "2.2 极限存在准则与两个重要极限",
                  uid: "k_two_limits",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "夹逼准则 (Squeeze Theorem)：$g(x) \\le f(x) \\le h(x)$ 且两端极限为 $A$，则中间极限必存在且为 $A$",
                      uid: "k_lim_crit_squeeze",
                      tag: "准则",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "单调有界收敛准则：单调有界数列必有极限（单调递增有上界 / 单调递减有下界）",
                      uid: "k_lim_crit_mono",
                      tag: "准则",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "重要极限一：$\\lim_{x\\to 0} \\frac{\\sin x}{x} = 1$（内含 $x\\in(0,\\frac{\\pi}{2})$ 时 $\\sin x < x < \\tan x$ 几何放缩不等式）",
                      uid: "k_lim_imp_two",
                      tag: "重要极限",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "海涅归结原则：$\\lim_{x\\to x_0} f(x) = A \\iff$ 对任一满足 $x_n \\neq x_0, x_n\\to x_0$ 的数列 $\\{x_n\\}$，均有 $\\lim_{n\\to\\infty} f(x_n) = A$",
                      uid: "k_lim_heine",
                      tag: "重要极限",
                      tagType: "thm"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "2.3 常用等价无穷小代换体系",
                  uid: "k_equiv_table",
                  macroLevel: 3,
                  resonanceLinks: ["kp_gs01_01", "m_gs01_03"],
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "核心一阶差式等价：$x-\\sin x \\sim \\frac{1}{6}x^3,\\ \\tan x - x \\sim \\frac{1}{3}x^3,\\ \\arcsin x - x \\sim \\frac{1}{6}x^3$",
                      uid: "k_equiv_core_f1",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "三角差式二阶等价：$\\tan x - \\sin x \\sim \\frac{1}{2}x^3,\\ x-\\ln(1+x) \\sim \\frac{1}{2}x^2$",
                      uid: "k_equiv_2",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "指数对数幂式等价：$e^x-1\\sim x,\\ a^x-1\\sim x\\ln a,\\ (1+x)^\\alpha - 1 \\sim \\alpha x$",
                      uid: "k_equiv_3",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "等价代换红线：乘除因子直接代换；加减项仅当比值极限不等于 1 时可分别代换，否则严禁简单代换",
                      uid: "k_equiv_rule_warn",
                      tag: "避坑",
                      tagType: "warn"
                    }
                  },
                  {
                    data: {
                      text: "广义化商代换口诀：$A-B = B\\left(\\frac{A}{B}-1\\right)$ 消除非零加减项",
                      uid: "k_pending_factor_out",
                      tag: "待确认·30讲",
                      tagType: "pending",
                      formalTag: "法",
                      formalTagType: "method"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "2.4 麦克劳林展开公式全表与定阶准则",
                  uid: "k_taylor_table",
                  macroLevel: 3,
                  resonanceLinks: ["kp_gs01_01", "kp_gs01_02", "m_gs01_04", "m_gs01_16"],
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "奇函数展开表：$\\sin x = x - \\frac{x^3}{6} + \\frac{x^5}{120} + o(x^5)$，$\\tan x = x + \\frac{x^3}{3} + o(x^3)$",
                      uid: "k_taylor_1",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "偶函数展开表：$\\cos x = 1 - \\frac{x^2}{2} + \\frac{x^4}{24} + o(x^4)$",
                      uid: "k_taylor_2",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "展开定阶铁律：上下同阶原则（分母为 $x^k$，分子必展开到第一个非零系数且同阶于 $x^k$）",
                      uid: "k_taylor_order",
                      tag: "要领",
                      tagType: "key"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "2.5 无穷小与无穷大增长阶梯比较",
                  uid: "k_inf_hierarchy",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "无穷大增长速度阶梯：$\\ln^\\alpha x \\ll x^\\beta \\ll a^x \\ll x! \\ll x^x$（$x\\to+\\infty, a>1, \\alpha,\\beta>0$）",
                      uid: "k_inf_hierarchy_ladder",
                      tag: "结论",
                      tagType: "conclusion"
                    }
                  },
                  {
                    data: {
                      text: "抓大头原则：在加和式中，无穷大只保留最高阶项，无穷小只保留最低阶项",
                      uid: "k_inf_capture_head",
                      tag: "要领",
                      tagType: "key"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "2.6 曲线渐近线的三大判定法则",
                  uid: "k_asymptotes",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "铅直渐近线：找无定义点 $x_0$，若 $\\lim_{x\\to x_0^\\pm} f(x) = \\infty$，则 $x=x_0$ 为铅直渐近线",
                      uid: "k_asymp_vert",
                      tag: "准则",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "水平渐近线：若 $\\lim_{x\\to+\\infty(-\\infty)} f(x) = b$，则 $y=b$ 为水平渐近线",
                      uid: "k_asymp_horiz",
                      tag: "准则",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "斜渐近线：若 $a=\\lim_{x\\to\\infty} \\frac{f(x)}{x} \\neq 0$ 且 $b=\\lim_{x\\to\\infty} [f(x)-ax]$ 存在，则 $y=ax+b$ 为斜渐近线",
                      uid: "k_asymp_oblique",
                      tag: "准则",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "渐近线互斥定理：同一侧（$+\\infty$ 或 $-\\infty$）水平渐近线与斜渐近线互斥，有水平则必无斜",
                      uid: "k_asymp_mutual_excl",
                      tag: "避坑",
                      tagType: "warn"
                    }
                  }
                ]
              }
            ]
          },

          // §3 连续与间断
          {
            data: {
              text: "§3 连续与间断",
              uid: "sec_3_cont",
              dir: "left",
              role: "section",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "3.1 连续性与间断点四类判别体系",
                  uid: "k_discontinuity_types",
                  macroLevel: 3,
                  resonanceLinks: ["kp_gs01_03", "kp_gs01_04", "m_gs01_13"],
                  expand: false
                },
                children: [
                  // 挂载跨章同步块：连续可导可微多元对比
                  {
                    data: {
                      text: "连续、可导(偏导)、可微与导函数连续 ($C^1$) 关系网与反例族（一元 vs 多元对比）",
                      uid: "k_cont_sync_cd",
                      syncBlockId: "sync_cont_diff_1vN",
                      role: "sync_block"
                    },
                    children: []
                  },
                  {
                    data: {
                      text: "第一类间断点（左右极限均存在）：可去间断点（左右极限相等但 $\\neq f(x_0)$）与跳跃间断点（左右极限不相等）",
                      uid: "k_cont_disc_1",
                      tag: "分类",
                      tagType: "prop"
                    }
                  },
                  {
                    data: {
                      text: "第二类间断点（至少一侧极限不存在）：无穷间断点（至少一侧为 $\\infty$）与振荡间断点（如 $\\sin\\frac{1}{x}$）",
                      uid: "k_cont_disc_2",
                      tag: "分类",
                      tagType: "prop"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "3.2 闭区间上连续函数的四大性质",
                  uid: "k_closed_interval_thm",
                  macroLevel: 3,
                  resonanceLinks: ["kp_gs01_05"],
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "有界性与最值定理：$f(x)\\in C[a,b] \\implies f(x)$ 有界且必能取到最小值 $m$ 与最大值 $M$",
                      uid: "k_cont_thm_bound",
                      tag: "定理",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "介值定理：若 $\\mu$ 介于最值之间 $m \\le \\mu \\le M$，则 $\\exists \\xi\\in[a,b], f(\\xi)=\\mu$",
                      uid: "k_cont_thm_inter",
                      tag: "定理",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "零点定理：若 $f(a)f(b)<0$，则 $\\exists \\xi\\in(a,b), f(\\xi)=0$（证明根存在的核心工具）",
                      uid: "k_cont_thm_zero",
                      tag: "定理",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "介值定理与平均值公式的离散点构造套路：$\\frac{1}{n}\\sum_{i=1}^n f(x_i) = f(\\xi)$",
                      uid: "k_pending_ivt_mean",
                      tag: "待确认·李范",
                      tagType: "pending",
                      formalTag: "法",
                      formalTagType: "method"
                    }
                  }
                ]
              }
            ]
          }
        ]
      },

      // ═══════════════════════════════════════════════════════════════════════
      // 解法分支 (右下方逻辑图，直接以具体招法为二级节点挂载，保证 Level 2 核心全景可见)
      // ═══════════════════════════════════════════════════════════════════════
      {
        data: {
          text: "解法",
          uid: "branch_methods",
          tag: "解法",
          tagType: "method",
          dir: "right",
          macroLevel: 1,
          expand: true
        },
        children: [
          // M03 (关联 kp_gs01_01, k_equiv_table)
          {
            data: {
              text: "乘除因子局部等价代换法",
              uid: "m_gs01_03",
              tag: "M03",
              tagType: "method",
              macroLevel: 2,
              resonanceLinks: ["kp_gs01_01", "k_equiv_table"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "要领：乘除因式优先代换；若遇加减项，先提公因式转为乘积后再代换",
                  uid: "m_gs01_03_ol",
                  tag: "要领",
                  tagType: "key"
                }
              },
              {
                data: {
                  text: "步骤1：非零极限因子优先拆分提出计算",
                  uid: "m_gs01_03_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              },
              {
                data: {
                  text: "步骤2：使用常用等价公式替换复合内层无穷小",
                  uid: "m_gs01_03_s2",
                  tag: "步骤",
                  tagType: "step"
                }
              },
              {
                data: {
                  text: "避坑：加减抵消项代换后等于0时严禁简单替换",
                  uid: "m_gs01_03_pf",
                  tag: "避坑",
                  tagType: "warn"
                }
              }
            ]
          },

          // M04 (关联 kp_gs01_01, k_taylor_table)
          {
            data: {
              text: "泰勒展开同阶截断法",
              uid: "m_gs01_04",
              tag: "M04",
              tagType: "method",
              macroLevel: 2,
              resonanceLinks: ["kp_gs01_01", "k_taylor_table"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "要领：观察分母最低阶为 $x^n$，将分子所有展开式整齐写出并展开到 $x^n$ 阶，抵消低阶项后留主部",
                  uid: "m_gs01_04_ol",
                  tag: "要领",
                  tagType: "key"
                }
              },
              {
                data: {
                  text: "步骤1：确定展开阶数 $n$ 与基准变量",
                  uid: "m_gs01_04_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              },
              {
                data: {
                  text: "步骤2：逐项展开并合并同类项",
                  uid: "m_gs01_04_s2",
                  tag: "步骤",
                  tagType: "step"
                }
              },
              {
                data: {
                  text: "避坑：不可多展或少展导致首项抵消后精度不足",
                  uid: "m_gs01_04_pf",
                  tag: "避坑",
                  tagType: "warn"
                }
              }
            ]
          },

          // M05 (关联 kp_gs01_01)
          {
            data: {
              text: "洛必达法则前置化简法",
              uid: "m_gs01_05",
              tag: "M05",
              tagType: "method",
              macroLevel: 2,
              resonanceLinks: ["kp_gs01_01"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "要领：每次使用前核验 $\\frac{0}{0}$ 或 $\\frac{\\infty}{\\infty}$ 型，求导前务必先把非零因子与等价无穷小提出化简",
                  uid: "m_gs01_05_ol",
                  tag: "要领",
                  tagType: "key"
                }
              },
              {
                data: {
                  text: "步骤1：验证未定式条件与可导性",
                  uid: "m_gs01_05_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              },
              {
                data: {
                  text: "步骤2：分子分母分别求导后重新定型",
                  uid: "m_gs01_05_s2",
                  tag: "步骤",
                  tagType: "step"
                }
              },
              {
                data: {
                  text: "避坑：求导后若极限振荡不存在，洛必达失效，需改用其他方法",
                  uid: "m_gs01_05_pf",
                  tag: "避坑",
                  tagType: "warn"
                }
              }
            ]
          },

          // M01 (关联 kp_gs01_02)
          {
            data: {
              text: "有理化与抓大头化简",
              uid: "m_gs01_01",
              tag: "M01",
              tagType: "method",
              macroLevel: 2,
              resonanceLinks: ["kp_gs01_02"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "根式差式分子有理化：$\\sqrt{A}-\\sqrt{B}=\\frac{A-B}{\\sqrt{A}+\\sqrt{B}}$，立方差有理化",
                  uid: "m_gs01_01_ol",
                  tag: "要领",
                  tagType: "key"
                }
              },
              {
                data: {
                  text: "步骤1：寻找共轭因式消除根号差",
                  uid: "m_gs01_01_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              },
              {
                data: {
                  text: "避坑：$\\infty-\\infty$ 型不可简单分开求极限",
                  uid: "m_gs01_01_pf",
                  tag: "避坑",
                  tagType: "warn"
                }
              }
            ]
          },

          // M16 (关联 kp_gs01_02, k_taylor_table)
          {
            data: {
              text: "展开定阶与方程求解法",
              uid: "m_gs01_16",
              tag: "M16",
              tagType: "method",
              macroLevel: 2,
              resonanceLinks: ["kp_gs01_02", "k_taylor_table"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "要领：将已知含待定参数的函数用麦克劳林展开，使低阶项系数为 0，主项系数等于极限值，联立求解",
                  uid: "m_gs01_16_ol",
                  tag: "要领",
                  tagType: "key"
                }
              },
              {
                data: {
                  text: "步骤1：将分子展开至分母同阶",
                  uid: "m_gs01_16_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              },
              {
                data: {
                  text: "避坑：不可漏掉抵消方程中的常数项",
                  uid: "m_gs01_16_pf",
                  tag: "避坑",
                  tagType: "warn"
                }
              }
            ]
          },

          // M02 (关联 kp_gs01_03, kp_gs01_05)
          {
            data: {
              text: "分左右单侧极限求值三步法",
              uid: "m_gs01_02",
              tag: "M02",
              tagType: "method",
              macroLevel: 2,
              resonanceLinks: ["kp_gs01_03", "kp_gs01_05"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "三大必分结构：分段函数分段点、$e^{1/x}$ 型结构、$\\arctan\\frac{1}{x}$ 型结构",
                  uid: "m_gs01_02_ol",
                  tag: "要领",
                  tagType: "key"
                }
              },
              {
                data: {
                  text: "步骤1：计算左极限与右极限",
                  uid: "m_gs01_02_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              },
              {
                data: {
                  text: "避坑：若左右极限不相等，则双侧极限不存在",
                  uid: "m_gs01_02_pf",
                  tag: "避坑",
                  tagType: "warn"
                }
              }
            ]
          },

          // M13 (关联 kp_gs01_04, k_discontinuity_types)
          {
            data: {
              text: "间断点全面排查与四类定性流程",
              uid: "m_gs01_13",
              tag: "M13",
              tagType: "method",
              macroLevel: 2,
              resonanceLinks: ["kp_gs01_04", "k_discontinuity_types"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "锁定所有可疑点 $\\to$ 分别计算 $f(x_0^+)$ 与 $f(x_0^-)$ $\\to$ 依存在性及相等性对号入座",
                  uid: "m_gs01_13_ol",
                  tag: "要领",
                  tagType: "key"
                }
              },
              {
                data: {
                  text: "步骤1：求分母为零点或分段点左右极限",
                  uid: "m_gs01_13_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              },
              {
                data: {
                  text: "避坑：第一类与第二类以单侧极限是否存在（有限值）为唯一分水岭",
                  uid: "m_gs01_13_pf",
                  tag: "避坑",
                  tagType: "warn"
                }
              }
            ]
          },

          // M06
          {
            data: {
              text: "幂指函数与 $1^\\infty$ 型基准公式法",
              uid: "m_gs01_06",
              tag: "M06",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "基准求法：若 $\\lim u(x)=1, \\lim v(x)=\\infty$，则 $\\lim u(x)^{v(x)} = e^{\\lim [u(x)-1]v(x)}$",
                  uid: "m_gs01_06_s1",
                  tag: "公式",
                  tagType: "formula"
                }
              }
            ]
          },

          // M07
          {
            data: {
              text: "$\\infty - \\infty$ 与 $0\\cdot\\infty$ 转化法",
              uid: "m_gs01_07",
              tag: "M07",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "分式差通分化简为 $\\frac{0}{0}$；根式差有理化或倒代换 $t=\\frac{1}{x}$ 求解",
                  uid: "m_gs01_07_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              }
            ]
          },

          // M08
          {
            data: {
              text: "极限保号性与脱帽渐近表示法",
              uid: "m_gs01_08",
              tag: "M08",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "由 $\\lim \\frac{f(x)}{x^k} = A \\neq 0$ 推知 $f(x) = A x^k + o(x^k)$ 并定出极值或拐点",
                  uid: "m_gs01_08_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              }
            ]
          },

          // M09
          {
            data: {
              text: "夹逼准则与经典放缩不等式链法",
              uid: "m_gs01_09",
              tag: "M09",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "五元大小链放缩：$\\frac{x}{1+x} < \\ln(1+x) < x < e^x-1$ ($x>0$)",
                  uid: "m_gs01_09_s1",
                  tag: "公式",
                  tagType: "formula"
                }
              },
              {
                data: {
                  text: "和式极限最大项提取放缩：$n\\cdot \\min \\le \\sum_{i=1}^n x_i \\le n\\cdot \\max$",
                  uid: "m_gs01_09_s2",
                  tag: "步骤",
                  tagType: "step"
                }
              }
            ]
          },

          // M10
          {
            data: {
              text: "递推数列单调有界性证明四步法",
              uid: "m_gs01_10",
              tag: "M10",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "四步标准化流程：1. 设极限并解出候选值 $L$；2. 数学归纳法证有界；3. 作差/作商/函数导数符号证单调；4. 两端取极限求得 $L$",
                  uid: "m_gs01_10_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              }
            ]
          },

          // M11
          {
            data: {
              text: "定积分定义转化求和式极限法",
              uid: "m_gs01_11",
              tag: "M11",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "提出 $\\frac{1}{n}$，识别 $\\frac{i}{n}$，转化为 $\\int_0^1 f(x)dx$ 定积分计算",
                  uid: "m_gs01_11_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              }
            ]
          },

          // M12
          {
            data: {
              text: "海涅归结原则与 Stolz 定理应用法",
              uid: "m_gs01_12",
              tag: "M12",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "离散化洛必达：对于 $\\frac{*}{\\infty}$ 型数列，$\\lim \\frac{a_n}{b_n} = \\lim \\frac{a_n - a_{n-1}}{b_n - b_{n-1}}$",
                  uid: "m_gs01_12_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              }
            ]
          },

          // M14
          {
            data: {
              text: "闭区间连续函数零点与介值定理构造法",
              uid: "m_gs01_14",
              tag: "M14",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "移项构造辅助函数 $F(x)=f(x)-g(x)$ 或 $F(x)=f(x)-x$ $\\to$ 端点异号用零点定理，最值用介值定理",
                  uid: "m_gs01_14_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              }
            ]
          },

          // M15
          {
            data: {
              text: "无穷小运算与复合定阶法",
              uid: "m_gs01_15",
              tag: "M15",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "复合定阶：若 $f(u)\\sim c u^p$ 且 $u(x)\\sim k x^q$，则 $f(u(x))\\sim c k^p x^{pq}$",
                  uid: "m_gs01_15_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              }
            ]
          },

          // M17 (挂载跨章同步块)
          {
            data: {
              text: "M17 跨章求极限工具法（导数定义/变限积分/定积分/拉格朗日）",
              uid: "m_gs01_17",
              tag: "M17",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              // 挂载跨章同步块：跨章求极限四大工具
              {
                data: {
                  text: "跨章求极限四大工具（导数定义识别 / 变限积分等价代换 / 定积分定义求 $n$ 项和 / 拉格朗日中值同构）",
                  uid: "m_lim_sync_tools",
                  syncBlockId: "sync_limit_cross_tools",
                  role: "sync_block"
                },
                children: []
              },
              {
                data: {
                  text: "拉格朗日中值同构在差式极限中的构造套路",
                  uid: "m_pending_lagrange_iso",
                  tag: "待确认·30讲",
                  tagType: "pending",
                  formalTag: "招法",
                  formalTagType: "method"
                }
              }
            ]
          },

          // M18
          {
            data: {
              text: "压缩映射原理与导数绝对值放缩法",
              uid: "m_gs01_18",
              tag: "M18",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "若 $x_{n+1}=f(x_n)$ 且 $|f'(x)| \\le k < 1$，由拉格朗日中值定理 $|x_{n+1}-x_n| \\le k |x_n-x_{n-1}|$ 直接证明收敛",
                  uid: "m_gs01_18_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              }
            ]
          }
        ]
      }
    ]
  };

  return data;
});
