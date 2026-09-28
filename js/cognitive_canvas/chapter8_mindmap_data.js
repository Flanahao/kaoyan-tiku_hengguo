/**
 * 考研数学一 · 高等数学 第8章《无穷级数》全量认知导图数据
 *
 * 架构规范：
 * 1. 严格执行「知识点 · 考点 · 解法」三扇区正品字 △ 混合三角布局；
 * 2. 零 Emoji，零外部品牌词，纯正 LaTeX 公式与结构化标签；
 * 3. 挂载跨章同步块（sync_limit_cross_tools, sync_parity_period）；
 * 4. 完整覆盖常数项级数（正项/交错/任意项审敛与11条真假命题）、幂级数收敛域与和函数（含微分方程求和六步SOP与初值黄金法则）、麦克劳林展开及数学一傅里叶级数（含半程奇偶延拓端点收敛值双重证明）。
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Chapter8MindMapData = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var chapter8Data = {
    data: {
      text: "第8章 无穷级数",
      uid: "root_chapter_8",
      tag: "第8章",
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
              text: "常数项级数（正项/交错/任意项）敛散性与概念辨析",
              uid: "kp_gs08_01",
              tag: "高频必考",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch8_const_series", "k_ch8_alt_series", "m_gs08_01"],
              associativeLineText: ["正项审敛", "交错与绝对收敛", "审敛五步决策流"]
            },
            children: [
              {
                data: {
                  text: "题眼：先验 $\\lim a_n = 0$，正项用比较/比值/根值/积分法，交错用莱布尼茨或泰勒拆项法，熟悉高频真假命题反例",
                  uid: "kp_gs08_01_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "幂级数收敛半径、收敛区间与收敛域（含缺项级数）",
              uid: "kp_gs08_02",
              tag: "高频",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch8_power_radius", "m_gs08_02"],
              associativeLineText: ["阿贝尔定理与半径", "缺项模比与端点检验"]
            },
            children: [
              {
                data: {
                  text: "题眼：阿贝尔定理单向推演、缺项幂级数直接用通项绝对值比值 $\\left|\\frac{u_{n+1}(x)}{u_n(x)}\\right|<1$、端点 $x=\\pm R$ 必单独代入判敛",
                  uid: "kp_gs08_02_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "幂级数和函数求解与数项级数求和（压轴大题）",
              uid: "kp_gs08_03",
              tag: "核心压轴",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch8_sum_func", "m_gs08_03", "m_gs08_04"],
              associativeLineText: ["逐项积导与方程法", "先导后积/先积后导", "微分方程法六步SOP"]
            },
            children: [
              {
                data: {
                  text: "题眼：分母含一次因式先求导消分母，分子含一次因式先提出 $x$ 再积分；含阶乘或二阶递推系数时建立常微分方程配合初值求解",
                  uid: "kp_gs08_03_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "函数展开成幂级数与高阶导数在中心点求值",
              uid: "kp_gs08_04",
              tag: "高频",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch8_maclaurin", "m_gs08_05"],
              associativeLineText: ["八大麦克劳林公式", "间接展开四法"]
            },
            children: [
              {
                data: {
                  text: "题眼：先求导化为有理分式或已知展开式，展开后再逐项积分还原并补常数项 $f(x_0)$，必注明收敛域",
                  uid: "kp_gs08_04_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "傅里叶级数展开、狄利克雷收敛定理与帕塞瓦尔等式",
              uid: "kp_gs08_05",
              tag: "数一专属",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch8_fourier", "m_gs08_06"],
              associativeLineText: ["傅里叶与狄利克雷", "半程延拓端点秒杀"]
            },
            children: [
              {
                data: {
                  text: "题眼：间断点处和值为左右极限均值 $\\frac{f(x^+)+f(x^-)}{2}$；正弦级数（奇延拓）在两端点 $x=0, \\pm l$ 处和值恒为 $0$，余弦级数（偶延拓）在端点等于原函数单侧极限",
                  uid: "kp_gs08_05_d1",
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
          // §1 常数项级数概念与审敛体系
          {
            data: {
              text: "§1 常数项级数审敛与真假命题辨析",
              uid: "k_ch8_sec1",
              tag: "常数项级数",
              tagType: "thm",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "1.1 基本性质、正项级数审敛法与基准级数库",
                  uid: "k_ch8_const_series",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "收敛必要条件与加括号准则：$\\sum a_n$ 收敛 $\\implies \\lim_{n\\to\\infty}a_n = 0$（不趋于 $0$ 必发散）；收敛级数加括号仍收敛，加括号发散则原级数必发散（反之加括号收敛原级数未必收敛）",
                      uid: "k_ch8_const_nec",
                      tag: "性质与避坑",
                      tagType: "warn"
                    }
                  },
                  {
                    data: {
                      text: "正项级数审敛与基准库：充要条件为部分和 $S_n$ 有上界；基准级数 $\\sum\\frac{1}{n^p}$ 与 $\\sum\\frac{1}{n(\\ln n)^p}$ 均当且仅当 $p>1$ 时收敛；比值/根值极限 $\\rho<1$ 收敛，$\\rho>1$ 发散，$\\rho=1$ 失效",
                      uid: "k_ch8_const_pos",
                      tag: "定理",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "跨章求极限四大工具（导数定义识别 / 变限积分等价代换 / 定积分定义求 $n$ 项和 / 拉格朗日中值同构）",
                      uid: "k_ch8_sync_lim",
                      syncBlockId: "sync_limit_cross_tools",
                      role: "sync_block"
                    },
                    children: []
                  }
                ]
              },
              {
                data: {
                  text: "1.2 交错级数莱布尼茨定理、绝对收敛与经典反例",
                  uid: "k_ch8_alt_series",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "莱布尼茨定理与绝对/条件收敛：交错级数 $\\sum(-1)^{n-1}u_n\\ (u_n>0)$ 若 $u_n$ 单调不增且 $\\lim u_n=0$ 则必收敛（余项 $|r_n|\\le u_{n+1}$）；条件收敛级数的正部与负部级数均发散至 $+\\infty$",
                      uid: "k_ch8_alt_leibniz",
                      tag: "定理",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "高频真假命题与反例：1) 正项或绝对收敛 $\\sum a_n$ 收敛 $\\implies \\sum a_n^2$ 必收敛；2) 条件收敛 $\\sum a_n$ 收敛 $\\centernot\\implies \\sum a_n^2$ 收敛（反例 $a_n=\\frac{(-1)^n}{\\sqrt{n}}$）；3) $\\sum a_n^2$ 收敛 $\\implies \\sum\\frac{|a_n|}{n}$ 收敛（均值不等式 $|a_n|/n \\le \\frac{1}{2}(a_n^2 + 1/n^2)$）",
                      uid: "k_ch8_alt_tf",
                      tag: "秒杀反例",
                      tagType: "warn"
                    }
                  }
                ]
              }
            ]
          },

          // §2 幂级数收敛域、和函数与函数展开
          {
            data: {
              text: "§2 幂级数收敛域、和函数与麦克劳林展开",
              uid: "k_ch8_sec2",
              tag: "幂级数体系",
              tagType: "formula",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "2.1 阿贝尔定理、收敛半径与逐项积导性质",
                  uid: "k_ch8_power_radius",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "阿贝尔定理与半径不变性：若 $\\sum a_n x^n$ 在 $x_0\\neq 0$ 收敛，则在 $|x|<|x_0|$ 内绝对收敛；逐项求导与逐项积分后收敛半径 $R$ 严格不变（逐项求导端点可能由收敛变发散，逐项积分端点可能由发散变收敛）",
                      uid: "k_ch8_abel_thm",
                      tag: "定理",
                      tagType: "thm"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "2.2 幂级数和函数求解与微分方程法初值黄金法则",
                  uid: "k_ch8_sum_func",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "四大变形种子公式：$\\sum_{n=0}^\\infty x^n = \\frac{1}{1-x}$，$\\sum_{n=1}^\\infty nx^{n-1} = \\frac{1}{(1-x)^2}$，$\\sum_{n=1}^\\infty \\frac{x^n}{n} = -\\ln(1-x)$，$\\sum_{n=0}^\\infty \\frac{x^n}{n!} = e^x$",
                      uid: "k_ch8_sum_seeds",
                      tag: "种子公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "微分方程法求和函数的初值提取黄金法则：设 $S(x)=\\sum_{n=0}^\\infty a_n x^n$，在逐项求导前立刻由零次与一次项系数读取初值 $S(0)=a_0,\\ S'(0)=a_1$（若从 $n\\ge 2$ 起标或仅含偶次项 $x^{2n}$，对应初值必为 $0$）",
                      uid: "k_ch8_sum_ode_init",
                      tag: "防错铁律",
                      tagType: "warn"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "2.3 八大麦克劳林级数展开公式全表",
                  uid: "k_ch8_maclaurin",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "全域展开 ($x\\in(-\\infty,+\\infty)$)：$e^x=\\sum_{n=0}^\\infty\\frac{x^n}{n!}$，$\\sin x=\\sum_{n=0}^\\infty\\frac{(-1)^n}{(2n+1)!}x^{2n+1}$，$\\cos x=\\sum_{n=0}^\\infty\\frac{(-1)^n}{(2n)!}x^{2n}$",
                      uid: "k_ch8_mac_all",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "有限域展开：$\\frac{1}{1\\mp x}=\\sum (\\pm x)^n\\ ((-1,1))$，$\\ln(1+x)=\\sum_{n=1}^\\infty\\frac{(-1)^{n-1}}{n}x^n\\ ((-1,1])$，$\\arctan x=\\sum_{n=0}^\\infty\\frac{(-1)^n}{2n+1}x^{2n+1}\\ ([-1,1])$",
                      uid: "k_ch8_mac_fin",
                      tag: "公式与收敛域",
                      tagType: "formula"
                    }
                  }
                ]
              }
            ]
          },

          // §3 傅里叶级数（数学一特有）
          {
            data: {
              text: "§3 傅里叶级数与狄利克雷收敛定理（数学一）",
              uid: "k_ch8_sec3",
              tag: "数一傅里叶",
              tagType: "thm",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "3.1 傅里叶系数、狄利克雷定理与半程延拓端点准则",
                  uid: "k_ch8_fourier",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "周期 $2l$ 傅里叶系数与狄利克雷定理：$a_n=\\frac{1}{l}\\int_{-l}^l f(x)\\cos\\frac{n\\pi x}{l}dx$（$a_0$ 必单独算！），$b_n=\\frac{1}{l}\\int_{-l}^l f(x)\\sin\\frac{n\\pi x}{l}dx$；和函数在间断点收敛于 $\\frac{f(x^+)+f(x^-)}{2}$，在周期端点 $\\pm l$ 收敛于 $\\frac{f(-l^+)+f(l^-)}{2}$",
                      uid: "k_ch8_fourier_dir",
                      tag: "定理",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "半程延拓（$[0,l]$）端点和值秒杀铁律：1) 展开为正弦级数（奇延拓）时，因每项 $\\sin(k\\pi)\\equiv 0$ 且奇延拓左右极限互为相反数，在端点 $x=0$ 与 $x=\\pm l$ 处和值恒等于 $0$（$S(0)=S(l)=0$）；2) 展开为余弦级数（偶延拓）时，在端点处等于原函数单侧极限 $S(0)=f(0^+),\\ S(l)=f(l^-)$",
                      uid: "k_ch8_fourier_endpt",
                      tag: "高频防坑",
                      tagType: "warn"
                    }
                  },
                  {
                    data: {
                      text: "奇偶性、周期性与单调性在求导/积分下的传播规律",
                      uid: "k_ch8_sync_pp",
                      syncBlockId: "sync_parity_period",
                      role: "sync_block"
                    },
                    children: []
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
              text: "常数项级数敛散性判别「五步标准决策流」",
              uid: "m_gs08_01",
              tag: "M01",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "1) 检验 $\\lim a_n$ 是否为 $0$；2) 正项级数含 $n!, a^n, n^n$ 用比值/根值法，含无理根式或三角对数用泰勒等价于 $\\frac{1}{n^p}$；3) 交错级数若通项非单调（如 $\\frac{(-1)^n}{\\sqrt{n}+(-1)^n}$），严禁直接套莱布尼茨，必须泰勒展开拆成「交错收敛项 $+$ 正项发散/收敛项」判定",
                  uid: "m_gs08_01_s1",
                  tag: "避坑决策",
                  tagType: "warn"
                }
              }
            ]
          },
          {
            data: {
              text: "含缺项或平移幂级数收敛域的「通项模比法」",
              uid: "m_gs08_02",
              tag: "M02",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "对 $\\sum a_n (ax+b)^{2n+1}$ 等非标准幂级数：切勿套 $R=1/\\rho$ 公式，直接将 $x$ 连同系数带入通项 $u_n(x)$，解不等式 $\\lim_{n\\to\\infty}\\left|\\frac{u_{n+1}(x)}{u_n(x)}\\right| < 1$ 直接得出开区间，再验两端点",
                  uid: "m_gs08_02_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              }
            ]
          },
          {
            data: {
              text: "幂级数和函数的「先导后积 / 先积后导」凑微分法",
              uid: "m_gs08_03",
              tag: "M03",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "1) 分母含 $(an+b)$：提凑幂次使指数等于分母 $x^{an+b}$，求导消分母化为等比级数，再定积分还原 $S(x)=S(0)+\\int_0^x S'(t)dt$；2) 分子含 $(an+b)$：凑成 $(x^{an+b})'$，先对原级数积分化为等比级数，再求导还原",
                  uid: "m_gs08_03_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              }
            ]
          },
          {
            data: {
              text: "微分方程法求幂级数和函数的「六步流水线 SOP」",
              uid: "m_gs08_04",
              tag: "M04",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "Step 1 求收敛域；Step 2 立刻提取零点初值 $S(0)=a_0, S'(0)=a_1$；Step 3 逐项求导两次并换指标对齐 $x^n$，代入系数递推关系得常微分方程；Step 4 解方程通解；Step 5 代初值定常数 $C_1,C_2$；Step 6 补写闭端点说明",
                  uid: "m_gs08_04_s1",
                  tag: "压轴SOP",
                  tagType: "step"
                }
              }
            ]
          },
          {
            data: {
              text: "数项级数求和的「构造幂级数赋特值法」",
              uid: "m_gs08_05",
              tag: "M05",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "求常数项级数 $\\sum_{n=1}^\\infty c_n \\cdot r^n$ 的精确和：将常数 $r$ 换为变量 $x$ 构造幂级数 $S(x)=\\sum c_n x^n$，求出和函数解析式 $S(x)$ 后代入 $x=r$ 即得级数和",
                  uid: "m_gs08_05_s1",
                  tag: "破题",
                  tagType: "method"
                }
              }
            ]
          },
          {
            data: {
              text: "傅里叶级数狄利克雷和函数画图与系数的数项级数反求法",
              uid: "m_gs08_06",
              tag: "M06",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "1) 求和函数在任意点 $x_0$ 的值：先按要求延拓（正弦奇延拓、余弦偶延拓）并在 $[-l,l]$ 外周期复制画出 $2$ 个周期草图，再看 $x_0$ 是连续点还是跳跃点；2) 将展开式在特殊点（如 $x=0$ 或 $\\pi/2$）代入狄利克雷和值，直接反求 $\\sum\\frac{(-1)^{n-1}}{2n-1}=\\frac{\\pi}{4}$ 等数项级数",
                  uid: "m_gs08_06_s1",
                  tag: "实战技巧",
                  tagType: "method"
                }
              }
            ]
          }
        ]
      }
    ]
  };

  return chapter8Data;
});
