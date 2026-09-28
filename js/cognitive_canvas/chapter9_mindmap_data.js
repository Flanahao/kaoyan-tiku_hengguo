/**
 * 考研数学一 · 高等数学 第9章《常微分方程》全量认知导图数据
 *
 * 架构规范：
 * 1. 严格执行「知识点 · 考点 · 解法」三扇区正品字 △ 混合三角布局；
 * 2. 零 Emoji，零外部品牌词，纯正 LaTeX 公式与结构化标签；
 * 3. 完整覆盖一阶微分方程全谱（分离变量/齐次/一阶线性/伯努利/全微分/变量互换）、可降阶二阶方程、高阶常系数线性方程（含欧拉复数化+指数平移算子法SOP）、欧拉方程、数列递推差分方程（含阶乘自由项裂项与同除归一化）及几何物理建模。
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Chapter9MindMapData = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var chapter9Data = {
    data: {
      text: "第9章 常微分方程",
      uid: "root_chapter_9",
      tag: "第9章",
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
              text: "一阶微分方程六大类型识别与求解（含变量互换与全微分）",
              uid: "kp_gs09_01",
              tag: "高频必考",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch9_first_order", "k_ch9_bernoulli_exact", "m_gs09_01"],
              associativeLineText: ["基础三型", "伯努利与全微分", "六步识别与互换"]
            },
            children: [
              {
                data: {
                  text: "题眼：分离变量、齐次 $u=y/x$、一阶线性通解公式、伯努利 $z=y^{1-n}$、全微分凑微分法、对 $y$ 非线性但对 $x$ 线性时必交换 $x,y$ 地位",
                  uid: "kp_gs09_01_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "可降阶二阶微分方程（缺 y 型与缺 x 型）",
              uid: "kp_gs09_02",
              tag: "高频",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch9_reducible", "m_gs09_02"],
              associativeLineText: ["两类降阶公式", "缺x型链式代换"]
            },
            children: [
              {
                data: {
                  text: "题眼：缺 $y$ 型令 $y'=p(x), y''=p'$；缺 $x$ 型令 $y'=p(y), y''=p\\frac{dp}{dy}$（切勿写成 $\\frac{dp}{dy}$！）",
                  uid: "kp_gs09_02_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "高阶线性方程解的结构、特征根反推与特解待定/算子法",
              uid: "kp_gs09_03",
              tag: "核心必考",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch9_linear_struct", "k_ch9_const_coeff", "m_gs09_03", "m_gs09_04"],
              associativeLineText: ["解的结构定理", "特解与算子法", "已知解反推特征根", "复数算子平移秒杀"]
            },
            children: [
              {
                data: {
                  text: "题眼：解的线性组合判齐次/非齐次解；待定系数中重数 $k$ 的判定；共振三角多项式用欧拉复数化 $+$ 算子平移法 2 分钟秒杀",
                  uid: "kp_gs09_03_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "欧拉方程（数一专属）与变上限积分方程转化",
              uid: "kp_gs09_04",
              tag: "数一高频",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch9_euler_diff", "m_gs09_05"],
              associativeLineText: ["欧拉与递推方程", "积分方程求导还原"]
            },
            children: [
              {
                data: {
                  text: "题眼：欧拉方程 $x=e^t$ 化为 $\\frac{d^2y}{dt^2}+(p-1)\\frac{dy}{dt}+qy=f(e^t)$；含变限积分等式必先代端点定初值再求导化为微分方程",
                  uid: "kp_gs09_04_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "微分方程几何与物理应用建模（切法线/面积/冷却/混流）",
              uid: "kp_gs09_05",
              tag: "高频大题",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch9_modeling", "m_gs09_06"],
              associativeLineText: ["几何物理模型", "截距与斜率建模"]
            },
            children: [
              {
                data: {
                  text: "题眼：切线 $X$ 截距 $x-\\frac{y}{y'}$、$Y$ 截距 $y-xy'$；法线斜率 $-1/y'$；旋转体体积与面积变化率建立微分方程",
                  uid: "kp_gs09_05_d1",
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
          // §1 一阶微分方程与可降阶方程
          {
            data: {
              text: "§1 一阶微分方程全谱与可降阶高阶方程",
              uid: "k_ch9_sec1",
              tag: "一阶与降阶",
              tagType: "formula",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "1.1 可分离变量、齐次型与一阶线性微分方程",
                  uid: "k_ch9_first_order",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "可分离变量与齐次型：$\\frac{dy}{dx}=f(x)g(y) \\implies \\int\\frac{dy}{g(y)}=\\int f(x)dx$（注意补检 $g(y_0)=0$ 的常数解）；齐次型 $y'=\\varphi(y/x)$ 令 $u=y/x \\implies y'=u+xu'$",
                      uid: "k_ch9_fo_sep_hom",
                      tag: "公式与避坑",
                      tagType: "warn"
                    }
                  },
                  {
                    data: {
                      text: "一阶线性方程 $y'+p(x)y=q(x)$ 通解公式：$y = e^{-\\int p(x)dx}\\left(\\int q(x)e^{\\int p(x)dx}dx + C\\right)$（不定积分 $\\int p(x)dx$ 固定取一个原函数即可，不加常数且保留绝对值符号或按区间去绝对值）",
                      uid: "k_ch9_fo_linear",
                      tag: "核心公式",
                      tagType: "formula"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "1.2 伯努利方程、全微分方程与变量互换法",
                  uid: "k_ch9_bernoulli_exact",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "伯努利方程 $y'+p(x)y=q(x)y^n\\ (n\\neq 0,1)$：两边同除 $y^n$ 令 $z=y^{1-n}$，化为一阶线性方程 $\\frac{dz}{dx}+(1-n)p(x)z=(1-n)q(x)$",
                      uid: "k_ch9_bernoulli",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "全微分方程（数一）与变量互换：$\\frac{\\partial Q}{\\partial x}=\\frac{\\partial P}{\\partial y} \\implies Pdx+Qdy=du=0$；若对 $y$ 复杂但对 $x$ 一次，取倒数化为 $\\frac{dx}{dy}+P(y)x=Q(y)$",
                      uid: "k_ch9_exact_swap",
                      tag: "法则",
                      tagType: "method"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "1.3 可降阶的高阶微分方程（缺 y 型与缺 x 型）",
                  uid: "k_ch9_reducible",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "两大标准代换：1) 缺 $y$ 型 $y''=f(x,y')$：令 $y'=p(x),\\ y''=\\frac{dp}{dx}$；2) 缺 $x$ 型 $y''=f(y,y')$：令 $y'=p(y),\\ y''=\\frac{dp}{dy}\\frac{dy}{dx}=p\\frac{dp}{dy}$（注意讨论 $p=0$ 即常数解是否满足初值）",
                      uid: "k_ch9_red_rules",
                      tag: "核心公式",
                      tagType: "formula"
                    }
                  }
                ]
              }
            ]
          },

          // §2 高阶线性微分方程与算子法
          {
            data: {
              text: "§2 高阶线性微分方程与微分算子法",
              uid: "k_ch9_sec2",
              tag: "高阶与算子",
              tagType: "thm",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "2.1 线性微分方程解的结构定理与叠加原理",
                  uid: "k_ch9_linear_struct",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "解的结构四定理：1) 齐次解的线性组合仍是齐次解；2) 非齐次两解之差 $y_1-y_2$ 必为齐次解；3) 非齐次两解加权和 $\\sum c_i y_i$ 当 $\\sum c_i = 1$ 时仍是非齐次解，当 $\\sum c_i = 0$ 时是齐次解；4) 非齐次通解 $=$ 齐次通解 $Y +$ 非齐次特解 $y^*$",
                      uid: "k_ch9_struct_thm",
                      tag: "高频定理",
                      tagType: "thm"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "2.2 常系数特征方程、待定系数法与复数算子平移法",
                  uid: "k_ch9_const_coeff",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "特征根与非齐次特解形式：实单根 $e^{rx}$、$k$ 重实根 $(C_1+\\dots+C_k x^{k-1})e^{rx}$、共轭复根 $e^{\\alpha x}(C_1\\cos\\beta x+C_2\\sin\\beta x)$；特解 $y^*=x^k Q_m(x)e^{\\alpha x}$ 或 $x^k e^{\\alpha x}[Q_l^{(1)}\\cos\\beta x+Q_l^{(2)}\\sin\\beta x]$（$k$ 为 $\\alpha$ 或 $\\alpha+i\\beta$ 作为特征根的重数）",
                      uid: "k_ch9_char_spec",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "微分算子法欧拉复数化 $+$ 指数平移 SOP：求 $\\frac{1}{F(D)}[P_m(x)\\cos\\beta x]$（或 $\\sin\\beta x$）时，化为 $\\operatorname{Re}\\left[e^{i\\beta x}\\frac{1}{F(D+i\\beta)}P_m(x)\\right]$，将 $\\frac{1}{F(D+i\\beta)}$ 长除截断展开至 $D^m$ 作用于 $P_m(x)$ 后取实部（或虚部），免解四元方程组",
                      uid: "k_ch9_op_complex",
                      tag: "秒杀SOP",
                      tagType: "method"
                    }
                  }
                ]
              }
            ]
          },

          // §3 欧拉方程、数列递推差分与建模应用
          {
            data: {
              text: "§3 欧拉方程、数列递推转化与几何物理建模",
              uid: "k_ch9_sec3",
              tag: "欧拉与建模",
              tagType: "formula",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "3.1 欧拉方程（数一）与含阶乘数列递推两大范式",
                  uid: "k_ch9_euler_diff",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "欧拉方程 $x^2 y'' + px y' + qy = f(x)\\ (x>0)$：令 $x=e^t\\ (t=\\ln x)$，则 $xy'=\\frac{dy}{dt},\\ x^2y''=\\frac{d^2y}{dt^2}-\\frac{dy}{dt}$，化为常系数方程 $\\frac{d^2y}{dt^2}+(p-1)\\frac{dy}{dt}+qy=f(e^t)$，解出 $y(t)$ 后必回代 $t=\\ln x$",
                      uid: "k_ch9_euler_f",
                      tag: "数一专属",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "数列递推与含阶乘自由项转化范式（数一考法）：1) 阶乘裂项累加法：$t\\cdot t! = (t+1)! - t!$ 逐项累加消去中间项；2) 同除阶乘归一化：对 $y_{t+1}-(t+1)y_t=(t+1)!$ 两边同除 $(t+1)!$ 令 $z_t=\\frac{y_t}{t!}$，化为等差递推 $z_{t+1}-z_t=1$",
                      uid: "k_ch9_diff_fact",
                      tag: "转化范式",
                      tagType: "method"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "3.2 几何截距与物理动态建模公式",
                  uid: "k_ch9_modeling",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "切法线截距与物理模型：点 $(x,y)$ 处切线在 $x$ 轴截距为 $x-\\frac{y}{y'}$、在 $y$ 轴截距为 $y-xy'$；法线在 $x$ 轴截距为 $x+yy'$、在 $y$ 轴截距为 $y+\\frac{x}{y'}$；溶液混流模型 $\\frac{dQ}{dt} = R_{\\text{in}}c_{\\text{in}} - R_{\\text{out}}\\frac{Q(t)}{V(t)}$",
                      uid: "k_ch9_mod_f",
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
              text: "一阶微分方程「六步快速识别与凑全微分法」",
              uid: "m_gs09_01",
              tag: "M01",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "1) 先看能否分离变量或齐次 $y/x$；2) 再看对 $y$ 是否一阶线性（不成则颠倒看对 $x$ 是否一阶线性或伯努利）；3) 写成微分形式 $Pdx+Qdy=0$ 观察常見全微分组合：$xdy+ydx=d(xy),\\ \\frac{xdy-ydx}{x^2}=d\\left(\\frac{y}{x}\\right),\\ xdx+ydy=\\frac{1}{2}d(x^2+y^2)$",
                  uid: "m_gs09_01_s1",
                  tag: "秒杀技巧",
                  tagType: "method"
                }
              }
            ]
          },
          {
            data: {
              text: "缺 x 型二阶方程 y'' = f(y, y') 的降阶与初值代入法",
              uid: "m_gs09_02",
              tag: "M02",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "令 $y'=p(y),\\ y''=p\\frac{dp}{dy}$ 解出 $p(y, C_1)$ 后，切勿急于对 $y$ 积分：立即代入初值 $(y(x_0)=y_0, y'(x_0)=p_0)$ 先定出常数 $C_1$（大幅简化函数表达式），再写 $\\frac{dy}{dx}=p(y)$ 分离变量求 $y(x)$",
                  uid: "m_gs09_02_s1",
                  tag: "实战技巧",
                  tagType: "step"
                }
              }
            ]
          },
          {
            data: {
              text: "由已知特解/通解项反推常系数方程阶数与系数法",
              uid: "m_gs09_03",
              tag: "M03",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "1) 将已知非齐次解两两作差得齐次解；2) 齐次解含 $x^{k-1}e^{rx} \\implies r$ 至少为 $k$ 重实特征根；含 $e^{\\alpha x}\\cos\\beta x \\implies \\alpha\\pm i\\beta$ 必成对为共轭复特征根；3) 非齐次自由项为 $P_m(x)e^{\\alpha x}$ 而特解出现了 $x^k Q_m(x)e^{\\alpha x} \\implies \\alpha$ 恰为 $k$ 重特征根，最後に用韦达定理求 $p,q$",
                  uid: "m_gs09_03_s1",
                  tag: "破题",
                  tagType: "method"
                }
              }
            ]
          },
          {
            data: {
              text: "算子法 1/F(D) 速解二阶非齐次特解四步法",
              uid: "m_gs09_04",
              tag: "M04",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "1) 纯指数 $\\frac{1}{F(D)}e^{\\alpha x}$：若 $F(\\alpha)\\neq 0$ 直接代 $D=\\alpha$；若 $F(\\alpha)=0$（$k$ 重根）直接写 $\\frac{x^k}{F^{(k)}(\\alpha)}e^{\\alpha x}$；2) 纯三角 $\\frac{1}{F(D^2)}\\cos\\beta x$：代 $D^2=-\\beta^2$；3) 指数乘多项式或共振三角：用移位公式 $e^{\\alpha x}\\frac{1}{F(D+\\alpha)}v(x)$ 配合欧拉公式 $\\operatorname{Re}[e^{i\\beta x}v(x)]$",
                  uid: "m_gs09_04_s1",
                  tag: "秒杀公式",
                  tagType: "formula"
                }
              }
            ]
          },
          {
            data: {
              text: "含变限积分方程求导转化为微分方程初值问题法",
              uid: "m_gs09_05",
              tag: "M05",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "1) 先在原积分方程中令 $x=a$（积分下限）白捡初始条件 $f(a)$；2) 若被积函数含 $x$，先换元或提因子，再两端对 $x$ 求导；3) 令 $x=a$ 再提一阶初值 $f'(a)$，若仍含积分号则再求导一次化为纯常微分方程求解",
                  uid: "m_gs09_05_s1",
                  tag: "标准步骤",
                  tagType: "step"
                }
              }
            ]
          },
          {
            data: {
              text: "几何与物理应用「画图列微元/几何关系 → 定初值 → 解方程」",
              uid: "m_gs09_06",
              tag: "M06",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "几何题区分「动点切线 $(X,Y)$ 与曲线上切点 $(x,y)$」：切线方程 $Y-y=y'(X-x)$，令 $Y=0$ 得横截距 $X=x-y/y'$，令 $X=0$ 得纵截距 $Y=y-xy'$，结合题目给出的面积或距离条件列出关于 $x,y,y'$ 的微分方程",
                  uid: "m_gs09_06_s1",
                  tag: "防错步骤",
                  tagType: "step"
                }
              }
            ]
          }
        ]
      }
    ]
  };

  return chapter9Data;
});
