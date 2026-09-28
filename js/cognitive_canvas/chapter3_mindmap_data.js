/**
 * 考研数学一 · 高等数学 第3章《微分中值定理与导数应用专题》全量认知导图数据
 *
 * 架构规范：
 * 1. 严格执行「知识点 · 考点 · 解法」三扇区正品字 △ 混合三角布局；
 * 2. 零 Emoji，零外部品牌词，纯正 LaTeX 公式与结构化标签；
 * 3. 挂载跨章同步块（sync_boundedness, sync_limit_cross_tools）；
 * 4. 完整覆盖四大中值定理、积分第一中值定理开区间强化与变限积分标准模板、泰勒中值（拉格朗日余项）、辅助函数微分方程还原法、双中值决策树与微分不等式全集。
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Chapter3MindMapData = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var chapter3Data = {
    data: {
      text: "第3章 微分中值定理与导数应用专题",
      uid: "root_chapter_3",
      tag: "第3章",
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
              text: "方程根（零点）存在性、唯一性与实根个数判定",
              uid: "kp_gs03_01",
              tag: "高频",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch3_zeros", "m_gs03_01"],
              associativeLineText: ["定理支撑", "判根套路"]
            },
            children: [
              {
                data: {
                  text: "题眼：闭区间异号用零点定理，导数零点用罗尔逆向找原函数，唯一性用单调性，$f^{(n)}(x)\\neq 0$ 推至多 $n$ 根",
                  uid: "kp_gs03_01_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "单中值等式证明与微分方程辅助函数构造",
              uid: "kp_gs03_02",
              tag: "核心压轴",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch3_aux_table", "m_gs03_02", "m_gs03_03"],
              associativeLineText: ["构造谱系", "还原招法", "开区间模板"]
            },
            children: [
              {
                data: {
                  text: "题眼：待证含 $f'(\\xi)$ 与 $f(\\xi), \\xi$ 的组合式，将 $\\xi$ 换为 $x$ 视为一阶线性微分方程求积分因子还原辅助函数 $F(x)$",
                  uid: "kp_gs03_02_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "双中值等式（异点 ξ, η）与柯西中值证明",
              uid: "kp_gs03_03",
              tag: "高频压轴",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch3_mvt_core", "m_gs03_04"],
              associativeLineText: ["定理基石", "双中值决策树"]
            },
            children: [
              {
                data: {
                  text: "题眼：和式双中值必取中点分段用拉格朗日；商式异点双中值用双拉格朗日相除；同点比值用柯西中值",
                  uid: "kp_gs03_03_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "含高阶导数 f''(ξ) 的泰勒中值证明题",
              uid: "kp_gs03_04",
              tag: "核心压轴",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch3_taylor_mvt", "m_gs03_05"],
              associativeLineText: ["拉格朗日余项", "展开点选取法"]
            },
            children: [
              {
                data: {
                  text: "题眼：已知端点的函数值与二阶/三阶导数关系且无一阶导信息时，在极值点或中点处向两端写带拉格朗日余项的泰勒公式",
                  uid: "kp_gs03_04_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "函数与积分微分不等式证明体系",
              uid: "kp_gs03_05",
              tag: "高频",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch3_ineq", "m_gs03_06"],
              associativeLineText: ["不等式体系", "证明四法"]
            },
            children: [
              {
                data: {
                  text: "题眼：移项构造单调辅助函数、拉格朗日差量放缩、凹凸性切线不等式放缩、泰勒余项定号放缩",
                  uid: "kp_gs03_05_d1",
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
          // §1 中值定理四大基石全景体系
          {
            data: {
              text: "§1 中值定理四大基石全景体系",
              uid: "k_ch3_sec1",
              tag: "理论基石",
              tagType: "thm",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "1.1 积分第一中值定理与开区间强化准则",
                  uid: "k_ch3_int_mvt",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "积分第一中值定理：若 $f\\in C[a,b]$，则 $\\exists \\xi\\in[a,b]$ 使 $\\int_a^b f(x)dx = f(\\xi)(b-a)$；若 $f$ 不恒为常数，可严格强化为开区间 $\\xi\\in(a,b)$",
                      uid: "k_ch3_int_mvt_open",
                      tag: "定理",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "考研阅卷防扣分标准书写：需严格使用开区间 $\\xi\\in(a,b)$ 时，设变上限积分 $F(x)=\\int_a^x f(t)dt$，对 $F(x)$ 在 $[a,b]$ 用拉格朗日中值定理直接得 $F(b)-F(a)=f(\\xi)(b-a),\\ \\xi\\in(a,b)$",
                      uid: "k_ch3_int_mvt_tpl",
                      tag: "满分模板",
                      tagType: "warn"
                    }
                  },
                  {
                    data: {
                      text: "函数有界性的四大判定准则与导数传播关系",
                      uid: "k_ch3_sync_bd",
                      syncBlockId: "sync_boundedness",
                      role: "sync_block"
                    },
                    children: []
                  }
                ]
              },
              {
                data: {
                  text: "1.2 费马、罗尔、拉格朗日与柯西中值定理",
                  uid: "k_ch3_mvt_core",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "费马引理与罗尔定理：费马（极值且可导 $\\implies f'(x_0)=0$）；罗尔（$f\\in C[a,b]\\cap D(a,b)$ 且 $f(a)=f(b) \\implies \\exists \\xi\\in(a,b), f'(\\xi)=0$）",
                      uid: "k_ch3_rolle",
                      tag: "定理",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "拉格朗日中值定理：$f\\in C[a,b]\\cap D(a,b) \\implies \\exists \\xi\\in(a,b)$ 使 $f(b)-f(a) = f'(\\xi)(b-a)$（有限增量公式 $\\Delta y = f'(x_0+\\theta\\Delta x)\\Delta x$）",
                      uid: "k_ch3_lagrange",
                      tag: "定理",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "柯西中值定理：$f,g\\in C[a,b]\\cap D(a,b)$ 且 $g'(x)\\neq 0 \\implies \\exists \\xi\\in(a,b)$ 使 $\\frac{f(b)-f(a)}{g(b)-g(a)} = \\frac{f'(\\xi)}{g'(\\xi)}$（注意分子分母共用同一个 $\\xi$）",
                      uid: "k_ch3_cauchy",
                      tag: "定理",
                      tagType: "thm"
                    }
                  }
                ]
              }
            ]
          },

          // §2 泰勒中值定理与方程根判定
          {
            data: {
              text: "§2 泰勒中值定理与方程零点理论",
              uid: "k_ch3_sec2",
              tag: "高阶与零点",
              tagType: "thm",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "2.1 带拉格朗日余项的泰勒中值定理",
                  uid: "k_ch3_taylor_mvt",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "泰勒中值公式：$f(x) = \\sum_{k=0}^n \\frac{f^{(k)}(x_0)}{k!}(x-x_0)^k + \\frac{f^{(n+1)}(\\xi)}{(n+1)!}(x-x_0)^{n+1}$，其中 $\\xi$ 严格介于 $x_0$ 与 $x$ 之间",
                      uid: "k_ch3_taylor_formula",
                      tag: "定理",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "两大余项定位区分：佩亚诺余项 $o((x-x_0)^n)$ 用于局部极限与极值拐点判别；拉格朗日余项用于区间整体高阶导数中值证明与不等式放缩",
                      uid: "k_ch3_taylor_dual",
                      tag: "对比",
                      tagType: "prop"
                    }
                  },
                  {
                    data: {
                      text: "跨章求极限四大工具（导数定义识别 / 变限积分等价代换 / 定积分定义求 $n$ 项和 / 拉格朗日中值同构）",
                      uid: "k_ch3_sync_lim",
                      syncBlockId: "sync_limit_cross_tools",
                      role: "sync_block"
                    },
                    children: []
                  }
                ]
              },
              {
                data: {
                  text: "2.2 方程根（零点）存在性、唯一性与个数上界",
                  uid: "k_ch3_zeros",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "存在性与唯一性：存在性靠零点定理（$f(a)f(b)<0$）或罗尔定理逆向法；唯一性靠导数严格保号（$f'(x)>0$ 或 $<0$）配合反证法",
                      uid: "k_ch3_zeros_ex_un",
                      tag: "准则",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "罗尔定理实根个数上界推论：若区间 $I$ 上 $f^{(n)}(x)\\neq 0$，则方程 $f(x)=0$ 在 $I$ 内至多有 $n$ 个实根（逆否：若 $f(x)=0$ 有 $n+1$ 个根，则 $f^{(n)}(\\xi)=0$ 至少有 $1$ 根）",
                      uid: "k_ch3_zeros_bound",
                      tag: "推论",
                      tagType: "thm"
                    }
                  }
                ]
              }
            ]
          },

          // §3 辅助函数构造与微分不等式
          {
            data: {
              text: "§3 辅助函数构造谱系与微分不等式",
              uid: "k_ch3_sec3",
              tag: "构造与放缩",
              tagType: "formula",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "3.1 中值定理辅助函数微分方程还原全景表",
                  uid: "k_ch3_aux_table",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "指数因子型：$f'(\\xi) + af(\\xi) = 0 \\implies F(x) = e^{ax}f(x)$；更一般地 $f'(\\xi) + g'(\\xi)f(\\xi) = 0 \\implies F(x) = e^{g(x)}f(x)$",
                      uid: "k_ch3_aux_exp",
                      tag: "构造模板",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "幂函数与商式型：$\\xi f'(\\xi) + nf(\\xi) = 0 \\implies F(x) = x^n f(x)$；$f'(\\xi)g(\\xi) - f(\\xi)g'(\\xi) = 0 \\implies F(x) = \\frac{f(x)}{g(x)}$",
                      uid: "k_ch3_aux_pow",
                      tag: "构造模板",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "高阶降阶型：$f''(\\xi) + af'(\\xi) = 0 \\implies$ 令 $u(x)=f'(x)$ 构造 $F(x)=e^{ax}f'(x)$，连续施加两次中值定理",
                      uid: "k_ch3_aux_2nd",
                      tag: "构造模板",
                      tagType: "formula"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "3.2 微分不等式四大标准证明体系",
                  uid: "k_ch3_ineq",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "单调性法与拉格朗日放缩：作差 $h(x)=f(x)-g(x)$ 求导定号；或将同构差式 $f(b)-f(a)=f'(\\xi)(b-a)$ 用导数上下界放缩",
                      uid: "k_ch3_ineq_mono",
                      tag: "定理",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "凹凸性切线不等式与 Jensen 不等式：若 $f''(x)>0$（凹），则 $f(x)\\ge f(x_0)+f'(x_0)(x-x_0)$ 且 $f\\left(\\sum \\lambda_i x_i\\right) \\le \\sum \\lambda_i f(x_i)$（秒杀 $e^x\\ge 1+x,\\ \\ln(1+x)\\le x$）",
                      uid: "k_ch3_ineq_convex",
                      tag: "秒杀工具",
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
              text: "导数零点存在性的逆向原函数罗尔法",
              uid: "m_gs03_01",
              tag: "M01",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "欲证 $\\exists \\xi\\in(a,b)$ 使含导数等式成立：先对式子不定积分还原出原函数 $F(x)$，再通过端点值、定积分性质或零点定理找到两点 $x_1 < x_2$ 使 $F(x_1)=F(x_2)$，最后施加罗尔定理",
                  uid: "m_gs03_01_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              }
            ]
          },
          {
            data: {
              text: "一阶线性微分方程积分因子逆向构造法",
              uid: "m_gs03_02",
              tag: "M02",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "三步还原：1) 将待证结论中 $\\xi$ 换为 $x$ 整理成标准型 $y' + P(x)y = 0$；2) 计算积分因子 $\\mu(x) = e^{\\int P(x)dx}$；3) 令辅助函数 $F(x) = \\mu(x)y(x)$，对 $F(x)$ 用罗尔定理",
                  uid: "m_gs03_02_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              }
            ]
          },
          {
            data: {
              text: "变上限积分转化拉格朗日开区间标准法",
              uid: "m_gs03_03",
              tag: "M03",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "题目同时含 $\\int_a^b f(x)dx$ 与 $f'(\\xi)$ 时：第一步设 $F(x)=\\int_a^x f(t)dt$ 用拉格朗日定理得 $\\int_a^b f(x)dx = f(\\xi_1)(b-a),\\ \\xi_1\\in(a,b)$；第二步在 $[a,\\xi_1]$ 或 $[\\xi_1,b]$ 上对 $f(x)$ 再用拉格朗日定理",
                  uid: "m_gs03_03_s1",
                  tag: "满分步骤",
                  tagType: "step"
                }
              }
            ]
          },
          {
            data: {
              text: "双中值定理（ξ, η）三路分支决策树",
              uid: "m_gs03_04",
              tag: "M04",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "1) 加权和式 $f'(\\xi)+f'(\\eta)$：必取中点 $c=\\frac{a+b}{2}$ 在 $[a,c]$ 与 $[c,b]$ 分段用拉格朗日相加（自动保证 $\\xi < \\eta$）；2) 异点商式 $\\frac{f'(\\xi)}{g'(\\eta)}$：分别用拉格朗日再相除；3) 同点商式 $\\frac{f'(\\xi)}{g'(\\xi)}$：直接用柯西中值",
                  uid: "m_gs03_04_s1",
                  tag: "决策树",
                  tagType: "method"
                }
              }
            ]
          },
          {
            data: {
              text: "泰勒中值展开点选取法则（中点 / 极值点 / 端点）",
              uid: "m_gs03_05",
              tag: "M05",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "谁的导数信息多就在谁处展开：1) 已知 $f'(x_0)=0$（极值点或驻点），在 $x_0$ 处向两端 $a,b$ 展开消去一阶项；2) 僅知两端点值 $f(a),f(b)$ 且求证含 $\\frac{a+b}{2}$ 或 $(b-a)^2$，取中点 $x_0=\\frac{a+b}{2}$ 向 $a,b$ 展开后作差/作和",
                  uid: "m_gs03_05_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              }
            ]
          },
          {
            data: {
              text: "微分与积分不等式证明四步破题法",
              uid: "m_gs03_06",
              tag: "M06",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "1) 含单变量或可改写为变上限积分的不等式 $\\implies$ 移项构造 $h(x)$ 求导判单调性；2) 含对称双变量 $b,a$ $\\implies$ 拉格朗日或柯西中值放缩；3) 含二阶导保号 $f''(x)>0$ $\\implies$ 在中点或极值点用泰勒余项/切线不等式放缩",
                  uid: "m_gs03_06_s1",
                  tag: "策略",
                  tagType: "method"
                }
              }
            ]
          }
        ]
      }
    ]
  };

  return chapter3Data;
});
