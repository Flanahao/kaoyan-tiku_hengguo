/**
 * 考研数学一 · 高等数学 第2章《一元函数微分学》全量认知导图数据
 *
 * 架构规范：
 * 1. 严格执行「知识点 · 考点 · 解法」三扇区正品字 △ 混合三角布局；
 * 2. 零 Emoji，零外部品牌词，纯正 LaTeX 公式与结构化标签；
 * 3. 挂载跨章同步块（sync_parity_period, sync_boundedness, sync_cont_diff_1vN, sync_limit_cross_tools）与 MathViz 切线割线动图组件；
 * 4. 完整覆盖导数与微分概念、计算法则、高阶导数、泰勒展开与几何物理应用（含因式奇偶性极值拐点精细边界与极坐标曲率公式）。
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Chapter2MindMapData = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var chapter2Data = {
    data: {
      text: "第2章 一元函数微分学",
      uid: "root_chapter_2",
      tag: "第2章",
      tagType: "chapter",
      macroLevel: 1,
      expand: true
    },
    children: [
      // ═══════════════════════════════════════════════════════════════════════
      // 考点分支 (上方横向排布，子节点向上生长 ↑)
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
              text: "导数定义、单侧导数与绝对值可导性判别",
              uid: "kp_gs02_01",
              tag: "高频",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch2_def_core", "m_gs02_01", "m_gs02_02"],
              associativeLineText: ["概念支撑", "定义破题", "秒杀法则"]
            },
            children: [
              {
                data: {
                  text: "题眼：一点处极限与增量比值 $\\lim_{h\\to 0}\\frac{f(x_0+ah)-f(x_0-bh)}{h}$、对称差商陷阱与 $|x-x_0|\\varphi(x)$ 可导充要条件",
                  uid: "kp_gs02_01_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              },
              {
                data: {
                  text: "李范对应：ch2 题型一（导数与微分概念命题判定）、题型二（乘积与绝对值可导性讨论）",
                  uid: "kp_gs02_01_d2",
                  tag: "题源",
                  tagType: "def"
                }
              }
            ]
          },
          {
            data: {
              text: "复合、反函数、参数方程与隐函数求导计算",
              uid: "kp_gs02_02",
              tag: "高频",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch2_calc_param", "m_gs02_03"],
              associativeLineText: ["公式支撑", "计算招法"]
            },
            children: [
              {
                data: {
                  text: "题眼：反函数二阶导 $-\\frac{y''}{(y')^3}$、参数方程二阶导分母立方 $[\\varphi'(t)]^3$、隐函数全微分法与对数求导法",
                  uid: "kp_gs02_02_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "高阶导数通项、莱布尼茨公式与泰勒系数反求",
              uid: "kp_gs02_03",
              tag: "高频",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch2_high_order", "m_gs02_04"],
              associativeLineText: ["公式支撑", "求导招法"]
            },
            children: [
              {
                data: {
                  text: "题眼：求 $f^{(n)}(0)$ 或 $f^{(n)}(x)$ 通项，优先对比泰勒系数 $a_n = \\frac{f^{(n)}(0)}{n!}$ 或莱布尼茨截断公式",
                  uid: "kp_gs02_03_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "单调性、极值点与凹凸性、拐点综合判定",
              uid: "kp_gs02_04",
              tag: "核心",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch2_ext_inflect", "m_gs02_05", "m_gs02_06"],
              associativeLineText: ["定理支撑", "极值拐点判别", "因式奇偶秒杀"]
            },
            children: [
              {
                data: {
                  text: "题眼：三大充分条件、极值与拐点互斥定理、因式 $(x-a)^n g(x)$ 奇偶次幂秒杀（仅需 $g(x)$ 在 $a$ 连续）",
                  uid: "kp_gs02_04_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "切法线、渐近线、弧微分与曲率几何应用",
              uid: "kp_gs02_05",
              tag: "必考",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch2_curvature", "m_gs02_07"],
              associativeLineText: ["几何公式", "曲率与渐近线法"]
            },
            children: [
              {
                data: {
                  text: "题眼：三条渐近线完备排查、直角/参数/极坐标曲率公式与曲率圆半径 $R = 1/K$、相关变化率",
                  uid: "kp_gs02_05_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          }
        ]
      },

      // ═══════════════════════════════════════════════════════════════════════
      // 知识点分支 (左下方排布，子节点向左生长 ←)
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
          // §1 导数与微分的基本概念
          {
            data: {
              text: "§1 导数与微分的基本概念",
              uid: "k_ch2_sec1",
              tag: "核心概念",
              tagType: "def",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "1.1 导数定义、单侧导数与绝对值可导性",
                  uid: "k_ch2_def_core",
                  macroLevel: 3,
                  expand: false,
                  hasWidget: true,
                  widgetType: "derivative_tangent"
                },
                children: [
                  {
                    data: {
                      text: "导数定义与充要条件：$f'(x_0) = \\lim_{\\Delta x\\to 0}\\frac{f(x_0+\\Delta x)-f(x_0)}{\\Delta x}$ 存在 $\\iff f'_-(x_0) = f'_+(x_0)$ 均存在且有限",
                      uid: "k_ch2_def_limit",
                      tag: "定义",
                      tagType: "def"
                    }
                  },
                  {
                    data: {
                      text: "对称差商核心避坑：$\\lim_{h\\to 0}\\frac{f(x_0+h)-f(x_0-h)}{2h}$ 存在 $\\centernot\\implies f(x)$ 在 $x_0$ 可导（反例 $f(x)=|x|$ 在 $0$ 处）；仅当已知 $f'(x_0)$ 存在时才等于 $f'(x_0)$",
                      uid: "k_ch2_def_symm_warn",
                      tag: "避坑",
                      tagType: "warn"
                    }
                  },
                  {
                    data: {
                      text: "绝对值函数可导性秒杀定理：设 $f(x) = |x-x_0|\\varphi(x)$ 且 $\\varphi(x)$ 在 $x_0$ 连续，则 $f(x)$ 在 $x_0$ 可导 $\\iff \\varphi(x_0)=0$（此时 $f'(x_0)=0$）",
                      uid: "k_ch2_def_abs_thm",
                      tag: "定理",
                      tagType: "thm"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "1.2 几何意义、微分形式不变性与性态分层网",
                  uid: "k_ch2_def_geom",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "切线与法线：切线 $y-f(x_0)=f'(x_0)(x-x_0)$，法线 $y-f(x_0)=-\\frac{1}{f'(x_0)}(x-x_0)$；可导必有切线，有铅直切线（如 $y=x^{1/3}$）则不可导",
                      uid: "k_ch2_geom_tan",
                      tag: "几何",
                      tagType: "prop"
                    }
                  },
                  {
                    data: {
                      text: "微分与一阶微分形式不变性：$\\Delta y = A\\Delta x + o(\\Delta x) \\iff$ 可微（一元中可导 $\\iff$ 可微）；无论 $u$ 为自变量或中间变量恒有 $dy = f'(u)du$",
                      uid: "k_ch2_diff_invar",
                      tag: "定理",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "导数极限定理与达布定理（导数介值定理）：导函数 $f'(x)$ 必具介值性，故导函数绝无第一类间断点（可去或跳跃），间断点必为振荡等第二类",
                      uid: "k_ch2_darboux",
                      tag: "定理",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "连续、可导(偏导)、可微与导函数连续 ($C^1$) 关系网与反例族（一元 vs 多元对比）",
                      uid: "k_ch2_sync_cd",
                      syncBlockId: "sync_cont_diff_1vN",
                      role: "sync_block"
                    },
                    children: []
                  },
                  {
                    data: {
                      text: "奇偶性、周期性与单调性在求导/积分下的传播规律",
                      uid: "k_ch2_sync_pp",
                      syncBlockId: "sync_parity_period",
                      role: "sync_block"
                    },
                    children: []
                  },
                  {
                    data: {
                      text: "函数有界性的四大判定准则与导数传播关系",
                      uid: "k_ch2_sync_bd",
                      syncBlockId: "sync_boundedness",
                      role: "sync_block"
                    },
                    children: []
                  }
                ]
              }
            ]
          },

          // §2 导数与微分的计算法则
          {
            data: {
              text: "§2 导数与微分的计算法则",
              uid: "k_ch2_sec2",
              tag: "计算体系",
              tagType: "formula",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "2.1 基本求导公式与四则复合链式法则",
                  uid: "k_ch2_calc_basic",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "三角与反三角导数：$(\\\\tan x)'=\\\\sec^2 x,\\ (\\\\sec x)'=\\\\sec x\\\\tan x,\\ (\\\\arcsin x)'=\\\\frac{1}{\\\\sqrt{1-x^2}},\\ (\\\\arctan x)'=\\\\frac{1}{1+x^2}$",
                      uid: "k_ch2_calc_f1",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "双曲函数求导：$(\\\\sinh x)'=\\\\cosh x,\\ (\\\\cosh x)'=\\\\sinh x,\\ [\\\\ln(x+\\\\sqrt{x^2\\pm a^2})]'=\\\\frac{1}{\\\\sqrt{x^2\\pm a^2}}$",
                      uid: "k_ch2_calc_f2",
                      tag: "公式",
                      tagType: "formula"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "2.2 反函数、参数方程、隐函数与对数求导法",
                  uid: "k_ch2_calc_param",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "反函数一阶与二阶导数：$\\frac{dx}{dy} = \\frac{1}{y'_x}$，二阶导数 $\\frac{d^2x}{dy^2} = -\\frac{y''_{xx}}{(y'_x)^3}$（切忌漏掉对 $x$ 求导后再乘 $\\frac{dx}{dy}$）",
                      uid: "k_ch2_calc_inv",
                      tag: "避坑公式",
                      tagType: "warn"
                    }
                  },
                  {
                    data: {
                      text: "参数方程一阶与二阶导数：$\\frac{dy}{dx} = \\frac{\\psi'(t)}{\\varphi'(t)}$，二阶导数 $\\frac{d^2y}{dx^2} = \\frac{\\psi''(t)\\varphi'(t)-\\psi'(t)\\varphi''(t)}{[\\varphi'(t)]^3}$（分母为立方）",
                      uid: "k_ch2_calc_par",
                      tag: "避坑公式",
                      tagType: "warn"
                    }
                  },
                  {
                    data: {
                      text: "隐函数与幂指函数求导：$F(x,y)=0 \\implies \\frac{dy}{dx} = -\\frac{F'_x}{F'_y}$；幂指函数 $u^v = e^{v\\ln u} \\implies (u^v)' = u^v\\left(v'\\ln u + \\frac{vu'}{u}\\right)$",
                      uid: "k_ch2_calc_imp",
                      tag: "公式",
                      tagType: "formula"
                    }
                  }
                ]
              }
            ]
          },

          // §3 高阶导数与泰勒展开
          {
            data: {
              text: "§3 高阶导数与麦克劳林展开体系",
              uid: "k_ch2_sec3",
              tag: "高阶与展开",
              tagType: "formula",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "3.1 高阶导数三大求法（归纳通项 / 莱布尼茨 / 泰勒系数）",
                  uid: "k_ch2_high_order",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "基础通项：$[\\sin(ax+b)]^{(n)} = a^n\\sin(ax+b+\\frac{n\\pi}{2})$，$\\left(\\frac{1}{ax+b}\\right)^{(n)} = \\frac{(-1)^n n! a^n}{(ax+b)^{n+1}}$",
                      uid: "k_ch2_high_f1",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "莱布尼茨公式：$(uv)^{(n)} = \\sum_{k=0}^n C_n^k u^{(n-k)}v^{(k)}$（将低次多项式选为 $v(x)$ 使其高阶导截断为零）",
                      uid: "k_ch2_high_leibniz",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "泰勒系数反求高阶导：若 $f(x) = \\sum_{n=0}^\\infty a_n (x-x_0)^n$，则 $f^{(n)}(x_0) = n! \\cdot a_n$（奇函数偶次导为零，偶函数奇次导为零）",
                      uid: "k_ch2_high_taylor",
                      tag: "核心招法",
                      tagType: "method"
                    }
                  },
                  {
                    data: {
                      text: "跨章求极限四大工具（导数定义识别 / 变限积分等价代换 / 定积分定义求 $n$ 项和 / 拉格朗日中值同构）",
                      uid: "k_ch2_sync_lim",
                      syncBlockId: "sync_limit_cross_tools",
                      role: "sync_block"
                    },
                    children: []
                  }
                ]
              }
            ]
          },

          // §4 导数的几何与物理应用
          {
            data: {
              text: "§4 导数的几何与物理应用",
              uid: "k_ch2_sec4",
              tag: "导数应用",
              tagType: "thm",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "4.1 单调性、极值与凹凸性、拐点结构定理",
                  uid: "k_ch2_ext_inflect",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "极值三大充分条件：1) $f'(x)$ 左右穿透变号；2) $f'(x_0)=0, f''(x_0)\\gtrless 0$；3) 首个非零导数 $f^{(n)}(x_0)\\neq 0$ 中 $n$ 为正偶数则取极值，$n$ 为正奇数则绝非极值",
                      uid: "k_ch2_ext_cond",
                      tag: "定理",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "凹凸性与拐点三大充分条件：$f''(x)>0$ 为凹弧（切线在下方），$f''(x)<0$ 为凸弧；拐点必须写成坐标点 $(x_0, f(x_0))$，首个非零导数阶数 $n\\ge 3$ 为正奇数则是拐点",
                      uid: "k_ch2_inflect_cond",
                      tag: "定理与避坑",
                      tagType: "warn"
                    }
                  },
                  {
                    data: {
                      text: "互斥定理与因式奇偶判定精细边界：1) 若 $f''(x_0)\\neq 0$，则 $x_0$ 绝不可能同为极值点与拐点横坐标；2) 设 $f(x)=(x-a)^n g(x), g(a)\\neq 0$ 且 $g(x)$ 在 $a$ 连续（无需高阶可导）：$n$ 为正偶数 $\\implies x=a$ 必为极值点；$n\\ge 3$ 为正奇数 $\\implies (a,0)$ 必为拐点",
                      uid: "k_ch2_factor_parity",
                      tag: "绝杀定理",
                      tagType: "thm"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "4.2 渐近线、弧微分、曲率与曲率圆体系",
                  uid: "k_ch2_curvature",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "渐近线三步排查：铅直 $\\lim_{x\\to x_0}f(x)=\\infty$；水平 $\\lim_{x\\to\\pm\\infty}f(x)=b$；斜渐近线 $a=\\lim\\frac{f(x)}{x}, b=\\lim[f(x)-ax]$（同侧水平与斜渐近线互斥）",
                      uid: "k_ch2_asymp",
                      tag: "准则",
                      tagType: "prop"
                    }
                  },
                  {
                    data: {
                      text: "弧微分公式：直角坐标 $ds = \\sqrt{1+(y')^2}dx$；参数方程 $ds = \\sqrt{(\\varphi')^2+(\\psi')^2}dt$；极坐标 $ds = \\sqrt{r^2+(r')^2}d\\theta$",
                      uid: "k_ch2_arc_diff",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "三大曲率公式与曲率半径：直角 $K=\\frac{|y''|}{(1+y'^2)^{3/2}}$；参数 $K=\\frac{|\\varphi'\\psi''-\\psi'\\varphi''|}{(\\varphi'^2+\\psi'^2)^{3/2}}$；极坐标 $K=\\frac{|r^2+2r'^2-rr''|}{(r^2+r'^2)^{3/2}}$（默认 $r\\ge 0$ 且代数对 $r\\to -r$ 严格对称）；曲率半径 $R=1/K$",
                      uid: "k_ch2_curv_formula",
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
      // 解法分支 (右下方排布，子节点向右生长 →)
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
              text: "导数定义增量凑配与动静点辨析法",
              uid: "m_gs02_01",
              tag: "M01",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "一静一动原则：导数定义式 $\\lim\\frac{f(x_0+\\Delta x)-f(x_0)}{\\Delta x}$ 必须包含固定点函数值 $f(x_0)$；若为双动点 $\\frac{f(\\alpha_n)-f(\\beta_n)}{\\alpha_n-\\beta_n}$，须拆项加减 $f(x_0)$ 且确保 $\\alpha_n, \\beta_n$ 分居两侧或已知可导",
                  uid: "m_gs02_01_s1",
                  tag: "法则",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "绝对值与连乘函数可导性秒杀法",
              uid: "m_gs02_02",
              tag: "M02",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "直接检验 $|x-x_0|$ 旁边的连续因子 $\\varphi(x)$ 在 $x_0$ 处是否为零：$\\varphi(x_0)=0 \\iff$ 可导且导数为 $0$；$\\varphi(x_0)\\neq 0 \\iff$ 不可导（角点）",
                  uid: "m_gs02_02_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              }
            ]
          },
          {
            data: {
              text: "参数方程与隐函数高阶求导防错流程",
              uid: "m_gs02_03",
              tag: "M03",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "参数二阶导口诀：一阶导商对参数 $t$ 求导后，必须再除以 $\\frac{dx}{dt}=\\varphi'(t)$；隐函数求二阶导时先代入已知点 $(x_0, y_0, y'_0)$ 数值再解 $y''_0$，切忌化简庞大的代数分式",
                  uid: "m_gs02_03_s1",
                  tag: "实战技巧",
                  tagType: "method"
                }
              }
            ]
          },
          {
            data: {
              text: "高阶导数在零点求值的泰勒与莱布尼茨双轨法",
              uid: "m_gs02_04",
              tag: "M04",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "求 $f^{(n)}(0)$ 优先用麦克劳林展开提取 $x^n$ 系数乘以 $n!$；若为 $x^k g(x)$ 型且 $g^{(m)}(0)$ 易求，直接套用莱布尼茨公式仅保留 $C_n^k (x^k)^{(k)} g^{(n-k)}(0)$ 单项",
                  uid: "m_gs02_04_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              }
            ]
          },
          {
            data: {
              text: "极值点与拐点定义的保号性与高阶导判别法",
              uid: "m_gs02_05",
              tag: "M05",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "题干给极限 $\\lim_{x\\to x_0}\\frac{f(x)-f(x_0)}{(x-x_0)^n} = A \\neq 0$ 时：由局部保号性或佩亚诺泰勒展开，$n$ 为偶则 $x_0$ 为极值点（$A>0$ 极小，$A<0$ 极大），$n\\ge 3$ 为奇则 $(x_0,f(x_0))$ 为拐点",
                  uid: "m_gs02_05_s1",
                  tag: "破题",
                  tagType: "method"
                }
              }
            ]
          },
          {
            data: {
              text: "连乘因式 $(x-a)^n g(x)$ 极值与拐点个数统计法",
              uid: "m_gs02_06",
              tag: "M06",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "无需展开求导：1) 统计各重根重数 $n_i$（重数 $1$ 为单穿零点，重数偶为极值点，重数 $\\ge 3$ 奇为拐点）；2) 结合罗尔定理推算相邻根之间新增的驻点与二阶导零点个数",
                  uid: "m_gs02_06_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              }
            ]
          },
          {
            data: {
              text: "渐近线三步完备排查与相关变化率建模法",
              uid: "m_gs02_07",
              tag: "M07",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "按「铅直（无定义点/分母零点）→ 水平（$x\\to +\\infty$ 与 $x\\to -\\infty$ 分开算）→ 斜渐近线」顺序排查；含 $e^x, \\arctan x, |x|$ 时左右无穷大极限必异，切勿合并",
                  uid: "m_gs02_07_s1",
                  tag: "避坑步骤",
                  tagType: "warn"
                }
              }
            ]
          }
        ]
      }
    ]
  };

  return chapter2Data;
});
