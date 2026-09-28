/**
 * 考研数学一 · 高等数学 第4章《一元函数积分学》全量认知导图数据
 *
 * 架构规范：
 * 1. 严格执行「知识点 · 考点 · 解法」三扇区正品字 △ 混合三角布局；
 * 2. 零 Emoji，零外部品牌词，纯正 LaTeX 公式与结构化标签；
 * 3. 挂载跨章同步块（sync_parity_period, sync_boundedness, sync_limit_cross_tools, sync_symmetry_integrals）；
 * 4. 完整覆盖原函数存在性红线、黎曼可积、变上限积分、反常积分（含狄利克雷/阿贝尔秒杀与主观题分部积分模板）、积分计算全谱、几何应用（含弧长定限与开方绝对值铁律）与物理应用（做功/抽水/水压力/古鲁金定理）。
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Chapter4MindMapData = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var chapter4Data = {
    data: {
      text: "第4章 一元函数积分学",
      uid: "root_chapter_4",
      tag: "第4章",
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
              text: "原函数存在性、定积分性质与变限积分求导",
              uid: "kp_gs04_01",
              tag: "高频",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch4_prim_riemann", "k_ch4_var_limit", "m_gs04_01"],
              associativeLineText: ["概念红线", "变限求导", "换元拆分法"]
            },
            children: [
              {
                data: {
                  text: "题眼：第一类/无穷间断点绝无原函数；变上限积分连续可导性阶数提升；被积函数含 $x$ 的变限积分必先换元或拆项再求导",
                  uid: "kp_gs04_01_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "不定积分与定积分综合计算（换元/分部/有理式/对称性）",
              uid: "kp_gs04_02",
              tag: "核心必考",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch4_calc_methods", "k_ch4_def_tricks", "m_gs04_02", "m_gs04_03"],
              associativeLineText: ["积分法则", "定积分技巧", "表格分部法", "区间再现法"]
            },
            children: [
              {
                data: {
                  text: "题眼：凑微分、三角代换、反对幂指三表格分部积分、有理真分式裂项、奇零偶倍、区间再现与 Wallis 点火公式",
                  uid: "kp_gs04_02_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "反常积分（无穷区间与瑕积分）敛散性判别与计算",
              uid: "kp_gs04_03",
              tag: "高频",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch4_improper", "m_gs04_04"],
              associativeLineText: ["审敛准则", "拆限判敛法"]
            },
            children: [
              {
                data: {
                  text: "题眼：大无穷 $p>1$、小瑕点 $p<1$；客观题狄利克雷秒杀 $\\int_1^{+\\infty}\\frac{\\sin x}{x^p}dx$，主观题用分部积分降阶证收敛",
                  uid: "kp_gs04_03_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "定积分几何应用（面积/旋转体体积/弧长/侧面积/形心）",
              uid: "kp_gs04_04",
              tag: "核心必考",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch4_geom_app", "m_gs04_05"],
              associativeLineText: ["几何公式", "弧长防错与古鲁金"]
            },
            children: [
              {
                data: {
                  text: "题眼：圆盘法与柱壳法求体积、三类坐标系下弧长（积分限必下小上大、开方必加绝对值）、古鲁金第一定理秒杀斜轴旋转体",
                  uid: "kp_gs04_04_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "定积分物理应用（变力做功/抽水做功/静水侧压力）",
              uid: "kp_gs04_05",
              tag: "数一专项",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch4_phys_app", "m_gs04_06"],
              associativeLineText: ["物理模型", "微元建系法"]
            },
            children: [
              {
                data: {
                  text: "题眼：以液面或池顶为原点建铅直向下坐标轴，准确写出深度 $x$ 处的水平截面面积 $A(x)$ 或平板宽度 $b(x)$",
                  uid: "kp_gs04_05_d1",
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
          // §1 概念、性质与反常积分
          {
            data: {
              text: "§1 原函数、定积分性质、变限积分与反常积分",
              uid: "k_ch4_sec1",
              tag: "概念与审敛",
              tagType: "thm",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "1.1 原函数存在性三大红线与黎曼可积条件",
                  uid: "k_ch4_prim_riemann",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "原函数存在红线：1) 连续必有原函数；2) 含第一类间断点（可去/跳跃）或无穷间断点的区间内绝无原函数；3) 振荡间断点可能存在原函数（如 $F(x)=x^2\\sin\\frac{1}{x}$ 的导函数）",
                      uid: "k_ch4_prim_rule",
                      tag: "定理与避坑",
                      tagType: "warn"
                    }
                  },
                  {
                    data: {
                      text: "黎曼可积条件：可积必有界（无界必不可积）；闭区间上连续、单调、或有界且仅有有限个间断点的函数必可积（第一类间断点可积但无原函数）",
                      uid: "k_ch4_riemann_cond",
                      tag: "定理",
                      tagType: "thm"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "1.2 变上限积分性态与广义莱布尼茨求导公式",
                  uid: "k_ch4_var_limit",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "平滑阶数提升定理：$f(x)$ 可积 $\\implies F(x)=\\int_a^x f(t)dt$ 必连续；$f(x)$ 连续 $\\implies F(x)$ 必可导且 $F'(x)=f(x)$；若 $x_0$ 为 $f$ 的跳跃间断点，则 $F'_\\pm(x_0)=f(x_0^\\pm)$（连续不可导角点）",
                      uid: "k_ch4_var_smooth",
                      tag: "定理",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "含参变限积分求导公式：$\\frac{d}{dx}\\int_{\\varphi(x)}^{\\psi(x)} f(x,t)dt = f(x,\\psi(x))\\psi'(x) - f(x,\\varphi(x))\\varphi'(x) + \\int_{\\varphi(x)}^{\\psi(x)}\\frac{\\partial f(x,t)}{\\partial x}dt$",
                      uid: "k_ch4_var_leibniz",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "奇偶性、周期性与单调性在求导/积分下的传播规律",
                      uid: "k_ch4_sync_pp",
                      syncBlockId: "sync_parity_period",
                      role: "sync_block"
                    },
                    children: []
                  },
                  {
                    data: {
                      text: "函数有界性的四大判定准则与导数传播关系",
                      uid: "k_ch4_sync_bd",
                      syncBlockId: "sync_boundedness",
                      role: "sync_block"
                    },
                    children: []
                  }
                ]
              },
              {
                data: {
                  text: "1.3 反常积分审敛准则（p-积分与交错振荡型双轨规范）",
                  uid: "k_ch4_improper",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "基准 $p$-积分口诀（大无穷，小瑕点）：无穷区间 $\\int_a^{+\\infty}\\frac{1}{x^p}dx$ 当 $p>1$ 收敛；无界瑕积分 $\\int_a^b\\frac{1}{(x-a)^p}dx$ 当 $p<1$ 收敛；混合型必须从裂点拆开分别判敛",
                      uid: "k_ch4_imp_p",
                      tag: "基准准则",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "交错振荡型 $\\int_1^{+\\infty}\\frac{\\sin x}{x^p}dx$ 双轨规范：1) 客观题用狄利克雷判别法秒杀（$p>1$ 绝对收敛，$0<p\\le 1$ 条件收敛，$p\\le 0$ 发散）；2) 主观题大纲防扣分模板：必须用分部积分法 $\\int_1^A\\frac{\\sin x}{x^p}dx = \\left[-\\frac{\\cos x}{x^p}\\right]_1^A - p\\int_1^A\\frac{\\cos x}{x^{p+1}}dx$ 降阶为 $p+1>1$ 的绝对收敛积分证收敛",
                      uid: "k_ch4_imp_dirichlet",
                      tag: "客观秒杀与主观模板",
                      tagType: "warn"
                    }
                  }
                ]
              }
            ]
          },

          // §2 积分计算方法与技巧全谱
          {
            data: {
              text: "§2 积分计算方法与定积分对称技巧",
              uid: "k_ch4_sec2",
              tag: "计算全谱",
              tagType: "formula",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "2.1 换元法、分部积分与有理分式裂项",
                  uid: "k_ch4_calc_methods",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "三大三角代换：$\\sqrt{a^2-x^2}$ 令 $x=a\\sin t$；$\\sqrt{a^2+x^2}$ 令 $x=a\\tan t$；$\\sqrt{x^2-a^2}$ 令 $x=a\\sec t$；分母高次幂用倒代换 $x=1/t$",
                      uid: "k_ch4_calc_trig",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "分部积分优先级（反、对、幂、指、三）：排前选为 $u$ 求导，排后选为 $dv$ 积分；多项式乘指数/三角直接用表格法交叉相乘配正负号",
                      uid: "k_ch4_calc_ibp",
                      tag: "口诀",
                      tagType: "method"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "2.2 定积分对称性、区间再现与 Wallis 点火公式",
                  uid: "k_ch4_def_tricks",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "区间再现与三角对称：$\\int_a^b f(x)dx = \\int_a^b f(a+b-x)dx$；$\\int_0^{\\pi/2} f(\\sin x)dx = \\int_0^{\\pi/2} f(\\cos x)dx$；$\\int_0^\\pi x f(\\sin x)dx = \\frac{\\pi}{2}\\int_0^\\pi f(\\sin x)dx$",
                      uid: "k_ch4_def_reappear",
                      tag: "核心公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "Wallis 点火公式：$I_n = \\int_0^{\\pi/2}\\sin^n x dx = \\int_0^{\\pi/2}\\cos^n x dx = \\frac{n-1}{n}\\frac{n-3}{n-2}\\cdots$（$n$ 为偶最后乘 $\\frac{1}{2}\\cdot\\frac{\\pi}{2}$，$n$ 为奇最后乘 $\\frac{2}{3}\\cdot 1$）",
                      uid: "k_ch4_def_wallis",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "各类积分对称性与奇偶性通解矩阵（定积分 vs 重积分 vs 一二型线面积分）",
                      uid: "k_ch4_sync_symm",
                      syncBlockId: "sync_symmetry_integrals",
                      role: "sync_block"
                    },
                    children: []
                  },
                  {
                    data: {
                      text: "跨章求极限四大工具（导数定义识别 / 变限积分等价代换 / 定积分定义求 $n$ 项和 / 拉格朗日中值同构）",
                      uid: "k_ch4_sync_lim",
                      syncBlockId: "sync_limit_cross_tools",
                      role: "sync_block"
                    },
                    children: []
                  }
                ]
              }
            ]
          },

          // §3 几何应用与物理应用
          {
            data: {
              text: "§3 定积分几何应用与物理应用体系",
              uid: "k_ch4_sec3",
              tag: "几何与物理",
              tagType: "formula",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "3.1 面积、旋转体体积、弧长与古鲁金定理",
                  uid: "k_ch4_geom_app",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "面积与旋转体体积：极坐标面积 $S=\\frac{1}{2}\\int_\\alpha^\\beta r^2(\\theta)d\\theta$；绕 $x$ 轴体积 $V_x=\\pi\\int_a^b y^2 dx$，绕 $y$ 轴柱壳法 $V_y=2\\pi\\int_a^b |x||y|dx$",
                      uid: "k_ch4_geom_vol",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "弧长与旋转侧面积防错铁律：弧长 $L=\\int_\\alpha^\\beta ds$ 积分限必须严格下小上大（$\\alpha < \\beta$），且根式开方必须保留绝对值 $\\sqrt{A^2}=|A|$ 配合对称性去绝对值；旋转侧面积 $A=2\\pi\\int_a^b |y|ds$",
                      uid: "k_ch4_geom_arc_warn",
                      tag: "防错铁律",
                      tagType: "warn"
                    }
                  },
                  {
                    data: {
                      text: "古鲁金第一定理（Pappus 重心定理）：平面图形 $D$ 绕同平面不相交轴旋转所得体积等于面积乘以形心旋转路程 $V = 2\\pi \\bar{d} \\cdot S$（侧面积 $A = 2\\pi \\bar{d} \\cdot L$）",
                      uid: "k_ch4_geom_pappus",
                      tag: "秒杀定理",
                      tagType: "thm"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "3.2 物理应用三大模型（变力做功 / 抽水 / 静水侧压力）",
                  uid: "k_ch4_phys_app",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "抽水做功模型：沿深度 $x\\in[a,b]$ 取水平薄层微元，体积 $dV = A(x)dx$，提升高度 $h(x)$，总功 $W = \\rho g \\int_a^b A(x)h(x)dx$",
                      uid: "k_ch4_phys_pump",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "液体静水侧压力：深度 $x$ 处静压强 $p(x)=\\rho g x$，取水平窄条宽 $b(x)$，总侧压力 $F = \\rho g \\int_a^b x \\cdot b(x)dx$（注意 $x$ 必须是从真实水面算起的垂直深度）",
                      uid: "k_ch4_phys_press",
                      tag: "公式与避坑",
                      tagType: "warn"
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
              text: "被积函数含 x 的变限积分换元与提因子求导法",
              uid: "m_gs04_01",
              tag: "M01",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "严禁直接把 $t$ 换成上限求导：1) 若为 $\\int_0^x (x-t)f(t)dt$，拆为 $x\\int_0^x f(t)dt - \\int_0^x tf(t)dt$ 再按乘积求导；2) 若为 $\\int_0^x f(x-t)dt$，先令 $u=x-t$ 换元为 $\\int_0^x f(u)du$ 再求导",
                  uid: "m_gs04_01_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              }
            ]
          },
          {
            data: {
              text: "表格分部积分法（多项式 × 指数/三角秒杀）",
              uid: "m_gs04_02",
              tag: "M02",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "左列写多项式 $P(x)$ 一路求导直到 $0$，右列写 $e^{ax}$ 或 $\\sin bx$ 一路积分，左上方往右下方斜线相乘并交替冠以 $+, -, +, -$ 号直接求和",
                  uid: "m_gs04_02_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              }
            ]
          },
          {
            data: {
              text: "区间再现換元与奇偶平移消去法",
              uid: "m_gs04_03",
              tag: "M03",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "当定积分含 $f(x)+f(a+b-x)$、$\\ln(1+\\tan x)$（在 $[0,\\pi/4]$）或 $x f(\\sin x)$（在 $[0,\\pi]$）时，令 $t=a+b-x$ 与原积分相加取半，瞬间消去多余因子 $x$",
                  uid: "m_gs04_03_s1",
                  tag: "破题",
                  tagType: "method"
                }
              }
            ]
          },
          {
            data: {
              text: "反常积分双坏点拆分与同阶无穷小/无穷大比较法",
              uid: "m_gs04_04",
              tag: "M04",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "1) 找出区间内所有瑕点（分母为 $0$ 或对数真数为 $0$）及 $\\pm\\infty$，在坏点之间任取正常点拆成若干单坏点积分；2) 在瑕点 $x\\to a^+$ 用泰勒等价为 $\\frac{C}{(x-a)^p}$，在 $x\\to +\\infty$ 抓大头等价为 $\\frac{C}{x^p}$，只要有一个子积分发散则整体发散",
                  uid: "m_gs04_04_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              }
            ]
          },
          {
            data: {
              text: "斜轴旋转体体积的古鲁金定理与点到直线距离积分法",
              uid: "m_gs04_05",
              tag: "M05",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "平面区域 $D$ 绕斜直线 $Ax+By+C=0$ 旋转一周的体积：$V = 2\\pi \\iint_D \\frac{|Ax+By+C|}{\\sqrt{A^2+B^2}} dxdy$；若 $D$ 的面积 $S$ 与形心 $(\\bar{x},\\bar{y})$ 已知，直接代 $V = 2\\pi \\frac{|A\\bar{x}+B\\bar{y}+C|}{\\sqrt{A^2+B^2}} S$",
                  uid: "m_gs04_05_s1",
                  tag: "秒杀公式",
                  tagType: "formula"
                }
              }
            ]
          },
          {
            data: {
              text: "物理应用微元法四步标准建系流程",
              uid: "m_gs04_06",
              tag: "M06",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "1) 选定原点（抽水选出水口、水压力选自由液面）建正方向朝下的 $x$ 轴；2) 标出有水区或平板的上下限 $[a,b]$；3) 用相似三角形或圆方程写出深度 $x$ 处的水平宽度 $b(x)$ 或截面半径 $r(x)$；4) 写出微元 $dW$ 或 $dF$ 定积分求解",
                  uid: "m_gs04_06_s1",
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

  return chapter4Data;
});
