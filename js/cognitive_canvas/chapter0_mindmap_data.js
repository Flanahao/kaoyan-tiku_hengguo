/**
 * 考研数学认知视图 · 第0章 预备知识 全量数据模型
 * 整合来源：
 * 1. 题库/讲义和笔记/整理稿/第0章_预备知识.md (《数学笔记 预备知识》+《零基础通关讲义》)
 * 2. 题库/研砖/ (逻辑放缩、柯西不等式、极坐标典型曲线工具)
 *
 * 核心架构规范：
 * - 顶层二级分类严格命名为：考点 (正上方目录组织图)、知识点 (左下方逻辑图)、解法 (右下方逻辑图)；
 * - 零 Emoji、零外部品牌命名；
 * - 预设 macroLevel: 0 (章), 1 (二级分类), 2 (节/招法级), 3 (0.1小节/招法步骤级)。
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Chapter0MindMapData = factory();
    if (typeof window !== 'undefined' && window.CognitiveViewController && typeof window.CognitiveViewController.registerChapterMindMap === 'function') {
      window.CognitiveViewController.registerChapterMindMap('math_ch0', root.Chapter0MindMapData);
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var examPointsMeta = [
    {
      uid: "kp_gs00_01",
      text: "充要条件判定与全称存在量词否定",
      importance: 3,
      trend: "概念题基础",
      questionCount: 12,
      questionRefIds: ["2022_math1_02", "2019_math1_01"],
      associativeLineTargets: ["m_gs00_01", "k_ch0_logic_prop", "k_ch0_quantifiers"]
    },
    {
      uid: "kp_gs00_02",
      text: "均值不等式链与柯西不等式放缩",
      importance: 4,
      trend: "综合证明常用",
      questionCount: 16,
      questionRefIds: ["2021_math1_21", "2018_math1_19"],
      associativeLineTargets: ["m_gs00_02", "m_gs00_03", "k_ch0_mean_ineq", "k_ch0_cauchy_ineq"]
    },
    {
      uid: "kp_gs00_03",
      text: "极坐标互化、对称性与经典曲线作图",
      importance: 5,
      trend: "重积分与定积分高频前置",
      questionCount: 28,
      questionRefIds: ["2024_math1_14", "2023_math1_18"],
      associativeLineTargets: ["m_gs00_04", "k_ch0_polar_conv", "k_ch0_polar_curves"]
    },
    {
      uid: "kp_gs00_04",
      text: "等差等比数列求和与有理分式裂项",
      importance: 4,
      trend: "极限与级数常考",
      questionCount: 20,
      questionRefIds: ["2023_math1_16", "2020_math1_17"],
      associativeLineTargets: ["m_gs00_05", "k_ch0_seq_basic", "k_ch0_alg_vieta"]
    }
  ];

  var data = {
    data: {
      text: "第0章 预备知识",
      uid: "root_chapter_0",
      role: "root",
      chapterId: "math_ch0",
      subjectId: "math",
      chapterIndex: 0,
      macroLevel: 0,
      expand: true,
      examPoints: examPointsMeta
    },
    children: [
      // ═══════════════════════════════════════════════════════════════════════
      // 考点分支 (正上方目录组织图)
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
              text: "充要条件判定与全称存在量词否定",
              uid: "kp_gs00_01",
              tag: "3★ 基础",
              tagType: "exam",
              macroLevel: 2,
              questionCount: 12,
              resonanceLinks: ["m_gs00_01", "k_ch0_logic_prop", "k_ch0_quantifiers"],
              expand: true
            },
            children: [
              {
                data: {
                  text: "题源：2022数一T2、2019数一T1（概念充要辨析）",
                  uid: "kp_gs00_01_ref",
                  tag: "题源",
                  tagType: "key",
                  macroLevel: 3,
                  role: "ref"
                }
              },
              {
                data: {
                  text: "要领：正面难判立刻转逆否命题 $\\neg q \\implies \\neg p$；否定全称量词找单点反例",
                  uid: "kp_gs00_01_path",
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
              text: "均值不等式链与柯西不等式放缩",
              uid: "kp_gs00_02",
              tag: "4★ 常考",
              tagType: "exam",
              macroLevel: 2,
              questionCount: 16,
              resonanceLinks: ["m_gs00_02", "m_gs00_03", "k_ch0_mean_ineq", "k_ch0_cauchy_ineq"],
              expand: true
            },
            children: [
              {
                data: {
                  text: "题源：2021数一T21、2018数一T19（积分与数列放缩）",
                  uid: "kp_gs00_02_ref",
                  tag: "题源",
                  tagType: "key",
                  macroLevel: 3,
                  role: "ref"
                }
              },
              {
                data: {
                  text: "要领：和积互化用 $H_2\\le G_2\\le A_2\\le Q_2$；定积分平方放缩用积分柯西不等式",
                  uid: "kp_gs00_02_path",
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
              text: "极坐标互化、对称性与经典曲线作图",
              uid: "kp_gs00_03",
              tag: "5★ 必考",
              tagType: "exam",
              macroLevel: 2,
              questionCount: 28,
              resonanceLinks: ["m_gs00_04", "k_ch0_polar_conv", "k_ch0_polar_curves"],
              expand: true
            },
            children: [
              {
                data: {
                  text: "题源：2024数一T14、2023数一T18（极坐标二重积分与平面域）",
                  uid: "kp_gs00_03_ref",
                  tag: "题源",
                  tagType: "key",
                  macroLevel: 3,
                  role: "ref"
                }
              },
              {
                data: {
                  text: "要领：象限修正定角度 $\\to$ 代换判对称 $\\to$ 心形线/双纽线/偏心圆秒画定限",
                  uid: "kp_gs00_03_path",
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
              text: "等差等比数列求和与有理分式裂项",
              uid: "kp_gs00_04",
              tag: "4★ 高频",
              tagType: "exam",
              macroLevel: 2,
              questionCount: 20,
              resonanceLinks: ["m_gs00_05", "k_ch0_seq_basic", "k_ch0_alg_vieta"],
              expand: true
            },
            children: [
              {
                data: {
                  text: "题源：2023数一T16、2020数一T17（级数与不定积分部分分式）",
                  uid: "kp_gs00_04_ref",
                  tag: "题源",
                  tagType: "key",
                  macroLevel: 3,
                  role: "ref"
                }
              },
              {
                data: {
                  text: "要领：韦达定理根差公式配方法 $\\to$ 留数遮盖法速算部分分式系数 $\\to$ 等比错位相减",
                  uid: "kp_gs00_04_path",
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
      // 知识点分支 (左下方逻辑图，dir: 'left')
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
          // §1 命题逻辑与推理套路
          {
            data: {
              text: "§1 命题逻辑与高数推理套路",
              uid: "sec_1_logic",
              dir: "left",
              role: "section",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "0.1 四种命题与等价真假关系",
                  uid: "k_ch0_logic_prop",
                  tag: "定理",
                  tagType: "thm",
                  macroLevel: 3,
                  resonanceLinks: ["kp_gs00_01", "m_gs00_01"],
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "四种形式：原命题 $p \\implies q$、逆命题 $q \\implies p$、否命题 $\\neg p \\implies \\neg q$、逆否命题 $\\neg q \\implies \\neg p$",
                      uid: "k_ch0_logic_prop_1",
                      tag: "定义",
                      tagType: "def"
                    }
                  },
                  {
                    data: {
                      text: "真假等价律：原命题 $\\iff$ 逆否命题；逆命题 $\\iff$ 否命题；原命题与逆/否命题无必然真假关系",
                      uid: "k_ch0_logic_prop_2",
                      tag: "定理",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "充要条件关系：$p \\implies q$ 则 $p$ 为充分条件、$q$ 为必要条件；双向成立 $p \\iff q$ 为充要条件",
                      uid: "k_ch0_logic_prop_3",
                      tag: "性质",
                      tagType: "prop"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "0.2 量词否定与高数六大证明套路",
                  uid: "k_ch0_quantifiers",
                  tag: "公式",
                  tagType: "formula",
                  macroLevel: 3,
                  resonanceLinks: ["kp_gs00_01"],
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "量词否定法则：$\\neg(\\forall x \\in M, P(x)) \\iff \\exists x \\in M, \\neg P(x)$；$\\neg(\\exists x \\in M, P(x)) \\iff \\forall x \\in M, \\neg P(x)$",
                      uid: "k_ch0_quant_1",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "德·摩根定律：$\\neg(p \\land q) \\iff \\neg p \\lor \\neg q$；$\\neg(p \\lor q) \\iff \\neg p \\land \\neg q$",
                      uid: "k_ch0_quant_2",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "高数六大推理套路：直接推导法、逆否证法、反证法（否定性/唯一性命题）、第一/第二数学归纳法、同一法、构造法",
                      uid: "k_ch0_quant_3",
                      tag: "要领",
                      tagType: "key"
                    }
                  }
                ]
              }
            ]
          },

          // §2 代数式、韦达定理与经典不等式
          {
            data: {
              text: "§2 代数式、韦达定理与经典不等式",
              uid: "sec_2_algebra_ineq",
              dir: "left",
              role: "section",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "0.3 解析式分类与韦达定理变形",
                  uid: "k_ch0_alg_vieta",
                  tag: "公式",
                  tagType: "formula",
                  macroLevel: 3,
                  resonanceLinks: ["kp_gs00_04", "m_gs00_05"],
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "解析式谱系：解析式 $\\to$ 代数式（有理式［整式/分式］、无理式）/ 超越式（指、对、三角、反三角）",
                      uid: "k_ch0_alg_1",
                      tag: "定义",
                      tagType: "def"
                    }
                  },
                  {
                    data: {
                      text: "韦达定理与根距公式：$x_1+x_2=-\\frac{b}{a},\\ x_1x_2=\\frac{c}{a}$；$x_1^2+x_2^2=\\frac{b^2-2ac}{a^2}$；$|x_1-x_2|=\\frac{\\sqrt{\\Delta}}{|a|}$",
                      uid: "k_ch0_alg_2",
                      tag: "公式",
                      tagType: "formula"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "0.4 均值不等式链与绝对值三角不等式",
                  uid: "k_ch0_mean_ineq",
                  tag: "定理",
                  tagType: "thm",
                  macroLevel: 3,
                  resonanceLinks: ["kp_gs00_02", "m_gs00_02"],
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "二元均值不等式链（$a,b>0$）：$H_2=\\frac{2ab}{a+b} \\le G_2=\\sqrt{ab} \\le A_2=\\frac{a+b}{2} \\le Q_2=\\sqrt{\\frac{a^2+b^2}{2}}$（当且仅当 $a=b$ 取等）",
                      uid: "k_ch0_mean_1",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "绝对值三角不等式：$\\big||a|-|b|\\big| \\le |a\\pm b| \\le |a|+|b|$；$n$ 元推广 $\\big|\\sum a_i\\big| \\le \\sum |a_i|$（非零项同号取等）",
                      uid: "k_ch0_mean_2",
                      tag: "公式",
                      tagType: "formula"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "0.5 柯西-施瓦茨不等式三态（代数/向量/积分）",
                  uid: "k_ch0_cauchy_ineq",
                  tag: "定理",
                  tagType: "thm",
                  macroLevel: 3,
                  resonanceLinks: ["kp_gs00_02", "m_gs00_03"],
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "代数与向量形式：$\\big(\\sum a_i b_i\\big)^2 \\le \\big(\\sum a_i^2\\big)\\big(\\sum b_i^2\\big)$（成比例取等）；$|\\vec{\\alpha}\\cdot\\vec{\\beta}| \\le \\|\\vec{\\alpha}\\|\\,\\|\\vec{\\beta}\\|$（共线取等）",
                      uid: "k_ch0_cauchy_1",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "积分柯西不等式（考研高频）：$\\left(\\int_a^b f(x)g(x)dx\\right)^2 \\le \\int_a^b f^2(x)dx \\int_a^b g^2(x)dx$（$f,g$ 线性相关取等，由二次型 $I(t)=\\int_a^b(tf+g)^2dx\\ge 0$ 判别式 $\\Delta\\le 0$ 证得）",
                      uid: "k_ch0_cauchy_2",
                      tag: "定理",
                      tagType: "thm"
                    }
                  }
                ]
              }
            ]
          },

          // §3 初等函数、数列与极坐标工具
          {
            data: {
              text: "§3 初等函数、数列与极坐标工具",
              uid: "sec_3_func_seq_polar",
              dir: "left",
              role: "section",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "0.6 幂指对图像特征与等差等比数列",
                  uid: "k_ch0_seq_basic",
                  tag: "性质",
                  tagType: "prop",
                  macroLevel: 3,
                  resonanceLinks: ["kp_gs00_04", "m_gs00_05"],
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "幂指对增长阶：当 $x\\to +\\infty$ 时，$\\ln^\\beta x \\ll x^\\alpha \\ll a^x$（$\\alpha>0, a>1$）；指对互为反函数关于 $y=x$ 对称",
                      uid: "k_ch0_seq_1",
                      tag: "性质",
                      tagType: "prop"
                    }
                  },
                  {
                    data: {
                      text: "等差数列：$a_n=a_1+(n-1)d$，$S_n=\\frac{n(a_1+a_n)}{2}$；下标和性质 $m+n=p+q \\implies a_m+a_n=a_p+a_q$",
                      uid: "k_ch0_seq_2",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "等比数列（$q\\neq 0$）：$a_n=a_1 q^{n-1}$，$S_n=\\frac{a_1(1-q^n)}{1-q}$（$q\\neq 1$）；当 $|q|<1$ 时无穷级数和 $S=\\frac{a_1}{1-q}$",
                      uid: "k_ch0_seq_3",
                      tag: "公式",
                      tagType: "formula"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "0.7 极坐标互化、象限修正与对称性准则",
                  uid: "k_ch0_polar_conv",
                  tag: "公式",
                  tagType: "formula",
                  macroLevel: 3,
                  resonanceLinks: ["kp_gs00_03", "m_gs00_04"],
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "直角与极坐标互化：$x=r\\cos\\theta,\\ y=r\\sin\\theta \\iff r^2=x^2+y^2,\\ \\tan\\theta=\\frac{y}{x}\\ (x\\neq 0)$",
                      uid: "k_ch0_polar_c1",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "极角象限修正法则：$x>0$ 时 $\\theta=\\arctan\\frac{y}{x}$；$x<0,y\\ge 0$ 时 $\\theta=\\arctan\\frac{y}{x}+\\pi$；$x<0,y<0$ 时 $\\theta=\\arctan\\frac{y}{x}-\\pi$（避开 $\\arctan$ 主值 $(-\\frac{\\pi}{2},\\frac{\\pi}{2})$ 象限偏差）",
                      uid: "k_ch0_polar_c2",
                      tag: "避坑",
                      tagType: "warn"
                    }
                  },
                  {
                    data: {
                      text: "极坐标曲线对称性代换准则：关于极轴（$x$ 轴）对称 $\\iff \\theta\\to -\\theta$ 不变；关于垂直极轴（$y$ 轴）对称 $\\iff \\theta\\to \\pi-\\theta$ 不变；关于极点对称 $\\iff \\theta\\to \\pi+\\theta$（或 $r\\to -r$）不变",
                      uid: "k_ch0_polar_c3",
                      tag: "准则",
                      tagType: "thm"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "0.8 极坐标五大高频曲线族（圆/螺线/心形线/双纽线/玫瑰线）",
                  uid: "k_ch0_polar_curves",
                  tag: "公式",
                  tagType: "formula",
                  macroLevel: 3,
                  resonanceLinks: ["kp_gs00_03", "m_gs00_04"],
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "偏心圆方程：圆心 $(a,0)$ 过极点 $r=2a\\cos\\theta\\ (-\\frac{\\pi}{2}\\le\\theta\\le\\frac{\\pi}{2})$；圆心 $(0,a)$ 过极点 $r=2a\\sin\\theta\\ (0\\le\\theta\\le\\pi)$",
                      uid: "k_ch0_polar_v1",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "心形线与阿基米德螺线：心形线 $r=a(1\\pm\\cos\\theta)$（全长 $8a$，围成面积 $\\frac{3}{2}\\pi a^2$）；螺线 $r=a\\theta$",
                      uid: "k_ch0_polar_v2",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "双纽线与玫瑰线：双纽线 $r^2=a^2\\cos 2\\theta$（定义域 $|\\theta|\\le\\frac{\\pi}{4}$ 或 $|\\theta-\\pi|\\le\\frac{\\pi}{4}$，总面积 $a^2$）；玫瑰线 $r=a\\sin 2\\theta$（四叶）、$r=a\\sin 3\\theta$（三叶）",
                      uid: "k_ch0_polar_v3",
                      tag: "公式",
                      tagType: "formula"
                    }
                  }
                ]
              }
            ]
          }
        ]
      },

      // ═══════════════════════════════════════════════════════════════════════
      // 解法分支 (右下方逻辑图，dir: 'right')
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
          {
            data: {
              text: "逆否命题转换与特值反例证伪法",
              uid: "m_gs00_01",
              tag: "M01",
              tagType: "method",
              macroLevel: 2,
              resonanceLinks: ["kp_gs00_01", "k_ch0_logic_prop"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "要领：当结论含“至少有一个”“不等于”或无穷区间定性时，改证逆否命题 $\\neg q \\implies \\neg p$ 或用反证法",
                  uid: "m_gs00_01_ol",
                  tag: "要领",
                  tagType: "key"
                }
              },
              {
                data: {
                  text: "步骤：选择题先用三大标准反例库（$|x|$、$x^k\\sin\\frac{1}{x}$、Dirichlet/分段跳变函数）快速证伪排除",
                  uid: "m_gs00_01_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              }
            ]
          },
          {
            data: {
              text: "均值不等式配凑与消元放缩法",
              uid: "m_gs00_02",
              tag: "M02",
              tagType: "method",
              macroLevel: 2,
              resonanceLinks: ["kp_gs00_02", "k_ch0_mean_ineq"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "要领：“一正二定三相等”，通过拆项平衡幂次使乘积为定值，或用 $ab \\le \\frac{a^2+b^2}{2}$ 解耦交叉乘积项",
                  uid: "m_gs00_02_ol",
                  tag: "要领",
                  tagType: "key"
                }
              },
              {
                data: {
                  text: "避坑：若多处连续使用均值不等式，必须核验各处取等条件是否兼容一致",
                  uid: "m_gs00_02_pf",
                  tag: "避坑",
                  tagType: "warn"
                }
              }
            ]
          },
          {
            data: {
              text: "积分柯西-施瓦茨配凑法",
              uid: "m_gs00_03",
              tag: "M03",
              tagType: "method",
              macroLevel: 2,
              resonanceLinks: ["kp_gs00_02", "k_ch0_cauchy_ineq"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "要领：见到 $\\int_a^b [f'(x)]^2 dx$ 与 $[f(b)-f(a)]^2$ 同现，立刻将 $\\int_a^b f'(x)\\cdot 1\\,dx$ 或 $\\int_a^b x f'(x)dx$ 拆成两函数内积套积分柯西不等式",
                  uid: "m_gs00_03_ol",
                  tag: "要领",
                  tagType: "key"
                }
              },
              {
                data: {
                  text: "公式：$\\left(\\int_a^b f'(x)\\cdot 1\\,dx\\right)^2 \\le (b-a)\\int_a^b [f'(x)]^2 dx$",
                  uid: "m_gs00_03_f1",
                  tag: "公式",
                  tagType: "formula"
                }
              }
            ]
          },
          {
            data: {
              text: "极坐标曲线定限与对称折半法",
              uid: "m_gs00_04",
              tag: "M04",
              tagType: "method",
              macroLevel: 2,
              resonanceLinks: ["kp_gs00_03", "k_ch0_polar_conv", "k_ch0_polar_curves"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "步骤1：代入 $\\theta\\to -\\theta$ 或 $\\theta\\to \\pi-\\theta$ 判定极轴/垂直极轴对称，先折半积分区间并乘 $2$",
                  uid: "m_gs00_04_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              },
              {
                data: {
                  text: "步骤2：令 $r(\\theta)=0$ 求切入极点的起止角（如双纽线 $\\cos 2\\theta=0 \\implies \\theta=\\pm\\frac{\\pi}{4}$），严防角度上限盲目写 $2\\pi$",
                  uid: "m_gs00_04_s2",
                  tag: "避坑",
                  tagType: "warn"
                }
              }
            ]
          },
          {
            data: {
              text: "有理分式Heaviside留数遮盖裂项法",
              uid: "m_gs00_05",
              tag: "M05",
              tagType: "method",
              macroLevel: 2,
              resonanceLinks: ["kp_gs00_04", "k_ch0_seq_basic", "k_ch0_alg_vieta"],
              expand: false
            },
            children: [
              {
                data: {
                  text: "要领：对单实根因子 $\\frac{P(x)}{(x-a)Q(x)} = \\frac{A}{x-a} + \\cdots$，直接在原式中遮住 $(x-a)$ 并代入 $x=a$ 得 $A = \\frac{P(a)}{Q(a)}$",
                  uid: "m_gs00_05_ol",
                  tag: "要领",
                  tagType: "key"
                }
              },
              {
                data: {
                  text: "步骤：数列求和与高阶导数遇到二次分母 $ax^2+bx+c$ 先因式分解裂项，再利用首尾相消（Telescoping）化简",
                  uid: "m_gs00_05_s1",
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
