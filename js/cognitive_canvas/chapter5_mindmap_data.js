/**
 * 考研数学一 · 高等数学 第5章《多元函数微分学》全量认知导图数据
 *
 * 架构规范：
 * 1. 严格执行「知识点 · 考点 · 解法」三扇区正品字 △ 混合三角布局；
 * 2. 零 Emoji，零外部品牌词，纯正 LaTeX 公式与结构化标签；
 * 3. 挂载跨章同步块（sync_cont_diff_1vN：含偏导有界推连续但不推可微反例）；
 * 4. 完整覆盖重极限、偏导数、全微分试金石、复合链式求导、隐函数（方程与方程组）及多元极值（含二阶微分二次型与 Hessian 矩阵正定判据）。
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Chapter5MindMapData = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var chapter5Data = {
    data: {
      text: "第5章 多元函数微分学",
      uid: "root_chapter_5",
      tag: "第5章",
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
              text: "重极限、连续、偏导数与可微性逻辑关系及点处判别",
              uid: "kp_gs05_01",
              tag: "高频必考",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch5_limit_cont", "k_ch5_diff_theory", "m_gs05_01", "m_gs05_02"],
              associativeLineText: ["重极限", "可微关系网", "路径证伪法", "可微三步走"]
            },
            children: [
              {
                data: {
                  text: "题眼：重极限路径无关性、偏导数存在且有界 $\\implies$ 连续但 $\\centernot\\implies$ 可微、全微分试金石极限 $\\lim_{\\rho\\to 0}\\frac{\\Delta z - (f'_x\\Delta x+f'_y\\Delta y)}{\\sqrt{\\Delta x^2+\\Delta y^2}} = 0$",
                  uid: "kp_gs05_01_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "多元复合函数一阶与二阶偏导数计算（含抽象函数）",
              uid: "kp_gs05_02",
              tag: "高频必考",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch5_chain_rule", "m_gs05_03"],
              associativeLineText: ["链式法则", "下标标记防错法"]
            },
            children: [
              {
                data: {
                  text: "题眼：对 $f'_1(u,v)$ 求二阶偏导时切记其仍是 $u,v$ 的二元复合函数，每项必须展开两个分支并利用 $f''_{12}=f''_{21}$ 合并",
                  uid: "kp_gs05_02_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "隐函数与方程组隐函数偏导数及全微分计算",
              uid: "kp_gs05_03",
              tag: "高频",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch5_implicit", "m_gs05_04"],
              associativeLineText: ["隐函数定理", "全微分消元法"]
            },
            children: [
              {
                data: {
                  text: "题眼：单方程 $F(x,y,z)=0$ 用公式 $-\\frac{F'_x}{F'_z}$ 或直接求导；方程组隐函数两边直接取全微分 $dx,dy,du,dv$ 线性消元最稳妥",
                  uid: "kp_gs05_03_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "多元无条件极值（AC-B² 与 Hessian 正定判据）",
              uid: "kp_gs05_04",
              tag: "核心必考",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch5_uncond_ext", "m_gs05_05"],
              associativeLineText: ["Hessian判据", "极值求解流程"]
            },
            children: [
              {
                data: {
                  text: "题眼：联立 $f'_x=0, f'_y=0$ 求驻点，算 $AC-B^2$（二元）或二阶微分二次型 Hessian 矩阵正负定性（多元及抽象函数）",
                  uid: "kp_gs05_04_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "条件极值（拉格朗日乘数法）与有界闭区域最值",
              uid: "kp_gs05_05",
              tag: "核心必考",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch5_cond_ext", "m_gs05_06"],
              associativeLineText: ["拉格朗日法", "闭区域最值五步走"]
            },
            children: [
              {
                data: {
                  text: "题眼：闭区域 $D$ 上的最值必须兼顾「内部驻点 + 边界条件极值点 + 边界角点」三类候选值比大小",
                  uid: "kp_gs05_05_d1",
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
          // §1 多元微积分基本概念与可微性理论
          {
            data: {
              text: "§1 重极限、偏导数与全微分可微性理论",
              uid: "k_ch5_sec1",
              tag: "概念与可微",
              tagType: "thm",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "1.1 二元重极限、累次极限与混合偏导相等定理",
                  uid: "k_ch5_limit_cont",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "重极限路径无关性：$(x,y)\\to(x_0,y_0)$ 要求沿平面内任意直线、任意高阶曲线逼近时极限均存在且相等；重极限与累次极限互不蕴含",
                      uid: "k_ch5_lim_path",
                      tag: "定义与避坑",
                      tagType: "warn"
                    }
                  },
                  {
                    data: {
                      text: "偏导数定义与 Schwarz 混合偏导定理：一点处偏导数 $f'_x(x_0,y_0) = \\frac{d}{dx}f(x,y_0)|_{x=x_0}$（先代常数后求导）；若 $f''_{xy}, f''_{yx}$ 在该点连续，则必有 $f''_{xy}=f''_{yx}$",
                      uid: "k_ch5_schwarz",
                      tag: "定理",
                      tagType: "thm"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "1.2 全微分定义、试金石极限与跨维关系网",
                  uid: "k_ch5_diff_theory",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "全微分定义与试金石：$\\Delta z = A\\Delta x + B\\Delta y + o(\\rho)\\ (\\rho=\\sqrt{\\Delta x^2+\\Delta y^2}) \\iff \\lim_{(\\Delta x,\\Delta y)\\to(0,0)}\\frac{f(x_0+\\Delta x,y_0+\\Delta y)-f(x_0,y_0)-f'_x\\Delta x-f'_y\\Delta y}{\\sqrt{\\Delta x^2+\\Delta y^2}} = 0$",
                      uid: "k_ch5_diff_def",
                      tag: "核心定义",
                      tagType: "def"
                    }
                  },
                  {
                    data: {
                      text: "偏导数有界性边界定理：邻域内偏导数存在且有界（$|f'_x|\\le M, |f'_y|\\le M$）$\\implies$ 函数必连续，但 $\\centernot\\implies$ 可微（反例 $f=\\frac{xy}{\\sqrt{x^2+y^2}}$ 偏导有界但原点不可微）",
                      uid: "k_ch5_bounded_pd",
                      tag: "高频定理",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "连续、可导(偏导)、可微与导函数连续 ($C^1$) 关系网与反例族（一元 vs 多元对比）",
                      uid: "k_ch5_sync_cd",
                      syncBlockId: "sync_cont_diff_1vN",
                      role: "sync_block"
                    },
                    children: []
                  }
                ]
              }
            ]
          },

          // §2 复合求导法则与隐函数定理
          {
            data: {
              text: "§2 复合链式求导法则与隐函数定理",
              uid: "k_ch5_sec2",
              tag: "求导体系",
              tagType: "formula",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "2.1 复合函数链式法则与一阶全微分形式不变性",
                  uid: "k_ch5_chain_rule",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "链式求导与二阶展开：$\\frac{\\partial z}{\\partial x}=f'_1 u'_x + f'_2 v'_x$；二阶偏导 $\\frac{\\partial^2 z}{\\partial x^2} = (f''_{11}u'_x + f''_{12}v'_x)u'_x + f'_1 u''_{xx} + (f''_{21}u'_x + f''_{22}v'_x)v'_x + f'_2 v''_{xx}$",
                      uid: "k_ch5_chain_2nd",
                      tag: "公式",
                      tagType: "formula"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "2.2 单方程与方程组隐函数求导定理",
                  uid: "k_ch5_implicit",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "单方程隐函数 $F(x,y,z)=0$（$F'_z\\neq 0$）：$\\frac{\\partial z}{\\partial x} = -\\frac{F'_x}{F'_z},\\ \\frac{\\partial z}{\\partial y} = -\\frac{F'_y}{F'_z}$；全微分 $dz = -\\frac{F'_x dx + F'_y dy}{F'_z}$",
                      uid: "k_ch5_imp_single",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "方程组隐函数 $\\begin{cases}F(x,y,u,v)=0 \\\\ G(x,y,u,v)=0\\end{cases}$：雅可比公式 $\\frac{\\partial u}{\\partial x} = -\\frac{\\partial(F,G)/\\partial(x,v)}{\\partial(F,G)/\\partial(u,v)}$，或直接两端取全微分消元解出 $du, dv$",
                      uid: "k_ch5_imp_system",
                      tag: "公式",
                      tagType: "formula"
                    }
                  }
                ]
              }
            ]
          },

          // §3 多元函数的极值与最值
          {
            data: {
              text: "§3 多元函数极值、Hessian 二次型与条件最值",
              uid: "k_ch5_sec3",
              tag: "极值与最值",
              tagType: "thm",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "3.1 无条件极值与二阶微分 Hessian 矩阵正定判据",
                  uid: "k_ch5_uncond_ext",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "二阶微分二次型与 Hessian 矩阵普适判据：在驻点 $\\nabla f(\\boldsymbol{x}_0)=\\boldsymbol{0}$ 处，$\\Delta f = \\frac{1}{2}\\boldsymbol{h}^T \\boldsymbol{H} \\boldsymbol{h} + o(\\|\\boldsymbol{h}\\|^2)$，其中 $\\boldsymbol{H}=\\left(\\frac{\\partial^2 f}{\\partial x_i\\partial x_j}\\right)_{n\\times n}$：$\\boldsymbol{H}$ 正定 $\\implies$ 严格极小值；$\\boldsymbol{H}$ 负定 $\\implies$ 严格极大值；$\\boldsymbol{H}$ 不定 $\\implies$ 非极值（鞍点）",
                      uid: "k_ch5_hessian_nd",
                      tag: "高数线代统一",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "二元函数 $AC-B^2$ 判别法（Hessian 二阶顺序主子式）：记 $A=f''_{xx}, B=f''_{xy}, C=f''_{yy}$，当 $AC-B^2>0$ 时取极值（$A>0$ 极小，$A<0$ 极大）；$AC-B^2<0$ 非极值；$AC-B^2=0$ 失效（改用定义考察邻域保号性）",
                      uid: "k_ch5_hessian_2d",
                      tag: "定理",
                      tagType: "thm"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "3.2 条件极值拉格朗日乘数法与有界闭区域最值",
                  uid: "k_ch5_cond_ext",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "拉格朗日乘数法：求 $f(x,y,z)$ 在 $\\varphi(x,y,z)=0, \\psi(x,y,z)=0$ 下的极值，构造 $L = f + \\lambda\\varphi + \\mu\\psi$，令各偏导数为零联立求解",
                      uid: "k_ch5_lagrange_mult",
                      tag: "法则",
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
              text: "二元重极限计算（极坐标放缩）与路径证伪法",
              uid: "m_gs05_01",
              tag: "M01",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "1) 证重极限不存在：观察分子分母各项幂次，取同幂次曲线 $y=kx^m$ 代入使极限与 $k$ 有关；2) 证重极限为 $0$：分母为 $x^2+y^2$ 时令 $x=r\\cos\\theta, y=r\\sin\\theta$，证明 $|f(r,\\theta)-0| \\le g(r)\\to 0$（$g(r)$ 必须与 $\\theta$ 无关）",
                  uid: "m_gs05_01_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              }
            ]
          },
          {
            data: {
              text: "分段二元函数在原点可微性的「三步走」试金石法",
              uid: "m_gs05_02",
              tag: "M02",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "第一步：验证重极限是否等于 $f(0,0)$（不连续直接不可微）；第二步：先代 $y=0$ 或 $x=0$ 用定义算出 $f'_x(0,0), f'_y(0,0)$；第三步：检验 $\\lim_{(x,y)\\to(0,0)}\\frac{f(x,y)-f(0,0)-f'_x(0,0)x-f'_y(0,0)y}{\\sqrt{x^2+y^2}}$ 是否为 $0$",
                  uid: "m_gs05_02_s1",
                  tag: "标准步骤",
                  tagType: "step"
                }
              }
            ]
          },
          {
            data: {
              text: "抽象复合函数高阶偏导的下标定位法",
              uid: "m_gs05_03",
              tag: "M03",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "一律用数字下标 $f'_1, f'_2, f''_{11}, f''_{12}, f''_{22}$ 代替字母下标，徹底避免自变量 $x,y$ 与中间变量同名时混淆求导对象；含有 $f(x, g(x,y))$ 时第一位置即为 $u=x$（$u'_x=1, u'_y=0$）",
                  uid: "m_gs05_03_s1",
                  tag: "防错技巧",
                  tagType: "method"
                }
              }
            ]
          },
          {
            data: {
              text: "隐函数与方程组偏导数的全微分线性消元法",
              uid: "m_gs05_04",
              tag: "M04",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "无需死记雅可比行列式负号：直接对给定方程（组）两边取一阶全微分 $d$，若求在某具体点 $(x_0,y_0,u_0,v_0)$ 处的偏导，立即将点坐标代入微分线性方程组，解出 $du = A dx + B dy$ 即得 $u'_x=A, u'_y=B$",
                  uid: "m_gs05_04_s1",
                  tag: "实战秒杀",
                  tagType: "method"
                }
              }
            ]
          },
          {
            data: {
              text: "等式给出二元泰勒近似时反读极值与 Hessian 矩阵法",
              uid: "m_gs05_05",
              tag: "M05",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "题干若给 $\\lim_{(x,y)\\to(x_0,y_0)}\\frac{f(x,y) - [c_0 + a(x-x_0)^2 + 2b(x-x_0)(y-y_0) + c(y-y_0)^2]}{(x-x_0)^2+(y-y_0)^2} = 0$：直接读出 $f(x_0,y_0)=c_0$，一阶偏导全为 $0$（驻点），且二次型矩阵 $\\frac{1}{2}\\boldsymbol{H} = \\begin{pmatrix}a & b\\\\ b & c\\end{pmatrix}$，由 $ac-b^2>0$ 结合 $a$ 的正负秒杀极值",
                  uid: "m_gs05_05_s1",
                  tag: "高频破题",
                  tagType: "method"
                }
              }
            ]
          },
          {
            data: {
              text: "有界闭区域 D 上连续函数最值求解「五步走」",
              uid: "m_gs05_06",
              tag: "M06",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "1) 解 $f'_x=0, f'_y=0$ 保留落在开区域 $D^\\circ$ 内的驻点；2) 将边界方程代入 $f(x,y)$ 化为一元函数（或用拉格朗日乘数法）求边界驻点；3) 补充边界光滑曲线交点（角点）；4) 计算全部候选点函数值；5) 比大小定 $\\max$ 与 $\\min$",
                  uid: "m_gs05_06_s1",
                  tag: "标准步骤",
                  tagType: "step"
                }
              }
            ]
          }
        ]
      }
    ]
  };

  return chapter5Data;
});
