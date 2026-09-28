/**
 * 考研数学一 · 高等数学 第7章《多元函数积分学》全量认知导图数据
 *
 * 架构规范：
 * 1. 严格执行「知识点 · 考点 · 解法」三扇区正品字 △ 混合三角布局；
 * 2. 零 Emoji，零外部品牌词，纯正 LaTeX 公式与结构化标签；
 * 3. 挂载跨章同步块（sync_symmetry_integrals）；
 * 4. 完整覆盖二重积分、三重积分、第一/二类曲线与曲面积分（含二型曲面同域投影差式消去法）、格林/高斯/斯托克斯三大公式（含斯托克斯隐式曲面法向消模长与常旋度投影面积秒杀）及古鲁金第二定理。
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Chapter7MindMapData = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var chapter7Data = {
    data: {
      text: "第7章 多元函数积分学",
      uid: "root_chapter_7",
      tag: "第7章",
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
              text: "二重积分计算、交换积分次序与对称性化简",
              uid: "kp_gs07_01",
              tag: "高频必考",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch7_double_int", "m_gs07_01"],
              associativeLineText: ["二重积分体系", "交换次序与极坐标"]
            },
            children: [
              {
                data: {
                  text: "题眼：先看奇偶对称与轮换对称倍加平均，再选直角坐标（交换次序破不可积原函数）或极坐标 $r dr d\\theta$",
                  uid: "kp_gs07_01_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "三重积分（先一后二/先二后一/柱面/球面坐标）",
              uid: "kp_gs07_02",
              tag: "数一高频",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch7_triple_int", "m_gs07_02"],
              associativeLineText: ["三大坐标系", "截面法与球面法"]
            },
            children: [
              {
                data: {
                  text: "题眼：旋转体且被积函数仅含 $z$ 优先用「先二后一」截面法；含 $x^2+y^2$ 用柱面坐标；球体锥体用球面坐标 $r^2\\sin\\varphi dr d\\varphi d\\theta$",
                  uid: "kp_gs07_02_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "第一型与第二型曲线积分、格林公式与路径无关",
              uid: "kp_gs07_03",
              tag: "数一核心",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch7_line_int", "k_ch7_green", "m_gs07_03"],
              associativeLineText: ["两类线积分", "格林与路径无关", "补线与挖奇点法"]
            },
            children: [
              {
                data: {
                  text: "题眼：一型曲线积分可代入曲线方程化简；二型平面曲线优先验 $\\frac{\\partial Q}{\\partial x}=\\frac{\\partial P}{\\partial y}$，闭曲线用格林公式（含奇点必挖圆或椭圆形小洞）",
                  uid: "kp_gs07_03_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "第一型与第二型曲面积分、高斯公式与通量计算",
              uid: "kp_gs07_04",
              tag: "数一压轴",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch7_surf_int", "k_ch7_gauss", "m_gs07_04", "m_gs07_05"],
              associativeLineText: ["两类面积分", "高斯公式", "补面与挖奇点", "合一投影与同域差消"]
            },
            children: [
              {
                data: {
                  text: "题眼：二型曲面积分首选补面高斯公式；不便用高斯时用合一投影法 $P(-z'_x)+Q(-z'_y)+R$ 或上下两面同域投影代数差式消去法",
                  uid: "kp_gs07_04_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "空间第二型曲线积分与斯托克斯公式环量计算",
              uid: "kp_gs07_05",
              tag: "数一必考",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch7_stokes", "m_gs07_06"],
              associativeLineText: ["斯托克斯公式", "常旋度几何面积秒杀"]
            },
            children: [
              {
                data: {
                  text: "题眼：空间闭曲线优先张平面或简单曲面用斯托克斯公式；隐式曲面法向投影根式模长自然对消；平面截口且旋度为常向量时直接乘面积秒杀",
                  uid: "kp_gs07_05_d1",
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
          // §1 二重积分与三重积分
          {
            data: {
              text: "§1 二重积分与三重积分体系",
              uid: "k_ch7_sec1",
              tag: "重积分",
              tagType: "formula",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "1.1 二重积分性质、对称性与极坐标变换",
                  uid: "k_ch7_double_int",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "极坐标与移轴极坐标：标准极坐标 $dxdy = r dr d\\theta$；偏心圆 $(x-a)^2+y^2\\le R^2$ 可用 $x=r\\cos\\theta, y=r\\sin\\theta$（$\\theta\\in[-\\pi/2,\\pi/2], r\\in[0,2a\\cos\\theta]$）或平移极坐标 $x=a+\\rho\\cos\\varphi, y=\\rho\\sin\\varphi$",
                      uid: "k_ch7_double_polar",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "各类积分对称性与奇偶性通解矩阵（定积分 vs 重积分 vs 一二型线面积分）",
                      uid: "k_ch7_sync_symm",
                      syncBlockId: "sync_symmetry_integrals",
                      role: "sync_block"
                    },
                    children: []
                  }
                ]
              },
              {
                data: {
                  text: "1.2 三重积分三大坐标系与古鲁金第二定理",
                  uid: "k_ch7_triple_int",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "直角先一后二与先二后一：先一后二 $\\iint_{D_{xy}}dxdy\\int_{z_1(x,y)}^{z_2(x,y)}f dz$；先二后一（截面法）$\\int_{c_1}^{c_2}dz\\iint_{D_z}f dxdy$（当 $f=f(z)$ 且截面 $D_z$ 面积 $S(z)$ 已知时化为一元定积分 $\\int_{c_1}^{c_2}f(z)S(z)dz$）",
                      uid: "k_ch7_triple_cart",
                      tag: "核心公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "柱面坐标与球面坐标：柱面微元 $dV = r dr d\\theta dz$；球面坐标 $x=r\\sin\\varphi\\cos\\theta, y=r\\sin\\varphi\\sin\\theta, z=r\\cos\\varphi$，微元 $dV = r^2\\sin\\varphi dr d\\varphi d\\theta$（天顶角 $\\varphi\\in[0,\\pi]$）",
                      uid: "k_ch7_triple_sph",
                      tag: "公式",
                      tagType: "formula"
                    }
                  }
                ]
              }
            ]
          },

          // §2 曲线积分与曲面积分
          {
            data: {
              text: "§2 第一型与第二型曲线积分、曲面积分",
              uid: "k_ch7_sec2",
              tag: "线面积分",
              tagType: "formula",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "2.1 第一型（对弧长）与第二型（对坐标）曲线积分",
                  uid: "k_ch7_line_int",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "一型曲线积分 $\\int_L f ds$：与方向无关，定限必须下小上大（$\\alpha < \\beta$），且可先将曲线方程代入被积函数化简；微元 $ds = \\sqrt{x'^2(t)+y'^2(t)+z'^2(t)}dt$",
                      uid: "k_ch7_line_type1",
                      tag: "准则",
                      tagType: "prop"
                    }
                  },
                  {
                    data: {
                      text: "二型曲线积分 $\\int_L Pdx+Qdy+Rdz$：有向曲线反向变号，定限必须「下限对应起点参数 $t_A$，上限对应终点参数 $t_B$」；两类联系 $\\int_L Pdx+Qdy+Rdz = \\int_L (P\\cos\\alpha+Q\\cos\\beta+R\\cos\\gamma)ds$",
                      uid: "k_ch7_line_type2",
                      tag: "准则与避坑",
                      tagType: "warn"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "2.2 第一型（对面积）与第二型（对坐标）曲面积分",
                  uid: "k_ch7_surf_int",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "一型曲面积分 $\\iint_\\Sigma f dS$：与曲面侧无关，可代入曲面方程化简；显式投影微元 $dS = \\sqrt{1+z'^2_x+z'^2_y}dxdy$",
                      uid: "k_ch7_surf_type1",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "二型曲面积分与合一投影公式：反侧变号；对显式曲面 $\\Sigma: z=z(x,y)$，有向微元 $(dydz, dzdx, dxdy) = \\pm(-z'_x, -z'_y, 1)dxdy$（上侧取 $+$，下侧取 $-$），一步将三项合并为单个二重积分",
                      uid: "k_ch7_surf_type2",
                      tag: "秒杀公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "二型曲面同域投影代数差式消去法：闭曲面或折叠曲面上下两半 $\\Sigma_2: z=z_2(x,y)$（上侧）与 $\\Sigma_1: z=z_1(x,y)$（下侧）在 $D_{xy}$ 重叠投影时，$\\iint_{\\Sigma_2+\\Sigma_1} R(x,y,z)dxdy = \\iint_{D_{xy}}[R(x,y,z_2)-R(x,y,z_1)]dxdy$（若 $R$ 不含 $z$ 则直接相消为 $0$）",
                      uid: "k_ch7_surf_overlap",
                      tag: "核心定理",
                      tagType: "thm"
                    }
                  }
                ]
              }
            ]
          },

          // §3 三大核心场论积分公式
          {
            data: {
              text: "§3 格林公式、高斯公式与斯托克斯公式",
              uid: "k_ch7_sec3",
              tag: "三大公式",
              tagType: "thm",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "3.1 格林公式与平面曲线积分路径无关四等价命题",
                  uid: "k_ch7_green",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "格林公式：$\\oint_{\\partial D^+} Pdx+Qdy = \\iint_D\\left(\\frac{\\partial Q}{\\partial x}-\\frac{\\partial P}{\\partial y}\\right)dxdy$（正向为区域内部在左：外边界逆时针，内边界顺时针）",
                      uid: "k_ch7_green_f",
                      tag: "定理",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "单连通域路径无关四等价条件：$\\int_L Pdx+Qdy$ 与路径无关 $\\iff \\oint_C Pdx+Qdy = 0 \\iff Pdx+Qdy = du \\iff \\frac{\\partial Q}{\\partial x}\\equiv\\frac{\\partial P}{\\partial y}$",
                      uid: "k_ch7_path_indep",
                      tag: "定理",
                      tagType: "thm"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "3.2 高斯公式（通量-散度定理）",
                  uid: "k_ch7_gauss",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "高斯公式：$\\oiint_{\\partial\\Omega^+} Pdydz+Qdzdx+Rdxdy = \\iiint_\\Omega\\left(\\frac{\\partial P}{\\partial x}+\\frac{\\partial Q}{\\partial y}+\\frac{\\partial R}{\\partial z}\\right)dV$（闭曲面取外侧，且内部无奇点）",
                      uid: "k_ch7_gauss_f",
                      tag: "定理",
                      tagType: "thm"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "3.3 斯托克斯公式（环量-旋度定理）与模长对消",
                  uid: "k_ch7_stokes",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "斯托克斯公式：$\\oint_{\\partial\\Sigma} Pdx+Qdy+Rdz = \\iint_\\Sigma (\\operatorname{curl}\\vec{F})\\cdot\\vec{n}^0 dS$（边界曲线与曲面法向符合右手螺旋定则）",
                      uid: "k_ch7_stokes_f",
                      tag: "定理",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "隐式曲面 $F(x,y,z)=0$ 投影根式模长消去定理：$\\vec{n}^0 dS = \\pm\\frac{\\nabla F}{\\|\\nabla F\\|}\\cdot\\frac{\\|\\nabla F\\|}{|F'_z|}dxdy = \\operatorname{sgn}(\\vec{n}_z)\\frac{(F'_x,F'_y,F'_z)}{|F'_z|}dxdy$（根式模长 $\\|\\nabla F\\|$ 恒严格对消）",
                      uid: "k_ch7_stokes_cancel",
                      tag: "绝杀定理",
                      tagType: "thm"
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
              text: "二重积分交换次序与轮换对称倍加平均法",
              uid: "m_gs07_01",
              tag: "M01",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "1) 遇 $e^{\\pm x^2}, \\sin(x^2), \\frac{\\sin x}{x}$ 等无初等原函数的内层积分，必画区域草图交换积分次序；2) 若区域关于 $y=x$ 对称，必试 $\\iint_D f(x,y)d\\sigma = \\frac{1}{2}\\iint_D [f(x,y)+f(y,x)]d\\sigma$",
                  uid: "m_gs07_01_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              }
            ]
          },
          {
            data: {
              text: "三重积分「先二后一」截面法与球面齐次对称法",
              uid: "m_gs07_02",
              tag: "M02",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "1) 当立体为椭球或旋转体且被积函数仅含 $z$ 时，直接用 $\\int_{z_1}^{z_2} f(z) S(z)dz$；2) 若 $\\Omega$ 关于三坐标轴完全轮换对称，则 $\\iiint_\\Omega x^2 dV = \\frac{1}{3}\\iiint_\\Omega (x^2+y^2+z^2)dV$",
                  uid: "m_gs07_02_s1",
                  tag: "秒杀技巧",
                  tagType: "method"
                }
              }
            ]
          },
          {
            data: {
              text: "平面二型曲线积分含奇点时的「挖洞法」",
              uid: "m_gs07_03",
              tag: "M03",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "当分母在原点为 $0$（如 $P=\\frac{-y}{ax^2+by^2}, Q=\\frac{x}{ax^2+by^2}$）且 $\\frac{\\partial Q}{\\partial x}=\\frac{\\partial P}{\\partial y}$（除原点外）时：作包裹原点的同向小椭圆 $L_\\varepsilon: ax^2+by^2=\\varepsilon^2$，由格林公式知 $\\oint_L = \\oint_{L_\\varepsilon} = \\frac{1}{\\varepsilon^2}\\oint_{L_\\varepsilon}(-ydx+xdy) = \\frac{2\\pi}{\\sqrt{ab}}$（若奇点在 $L$ 外则积分为 $0$）",
                  uid: "m_gs07_03_s1",
                  tag: "高频母题",
                  tagType: "method"
                }
              }
            ]
          },
          {
            data: {
              text: "第二型曲面积分「补面高斯法」与「挖奇点球面法」",
              uid: "m_gs07_04",
              tag: "M04",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "1) 开曲面 $\\Sigma$ 补平盖 $\\Sigma_0$（如 $z=h$，注意外侧方向）围成闭区域 $\\Omega$：$\\iint_\\Sigma = \\iiint_\\Omega \\operatorname{div}\\vec{F} dV - \\iint_{\\Sigma_0}$（在平盖 $\\Sigma_0$ 上 $dz=0$，故 $dydz=0, dzdx=0$，只算 $Rdxdy$）；2) 分母含 $(x^2+y^2+z^2)^{3/2}$ 奇点时挖小外侧球面转化",
                  uid: "m_gs07_04_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              }
            ]
          },
          {
            data: {
              text: "二型曲面积分「合一投影法（转换一型）」",
              uid: "m_gs07_05",
              tag: "M05",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "当曲面 $\\Sigma: z=z(x,y)$ 单独给出且不适合补面高斯时，直接用 $\\iint_\\Sigma Pdydz+Qdzdx+Rdxdy = \\pm\\iint_{D_{xy}}[P(-z'_x)+Q(-z'_y)+R(x,y,z(x,y))]dxdy$（切勿分三次往三个坐标面投影！）",
                  uid: "m_gs07_05_s1",
                  tag: "防错铁律",
                  tagType: "warn"
                }
              }
            ]
          },
          {
            data: {
              text: "斯托克斯公式「斜平面常旋度几何面积秒杀法」",
              uid: "m_gs07_06",
              tag: "M06",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "若空间闭曲线 $\\Gamma$ 位于平面 $Ax+By+Cz+D=0$ 上且旋度 $\\operatorname{curl}\\vec{F}=(u,v,w)$ 为常向量：1) 单位法向量 $\\vec{n}^0 = \\pm\\frac{(A,B,C)}{\\sqrt{A^2+B^2+C^2}}$（右手定则定正负）；2) $\\oint_\\Gamma = (\\operatorname{curl}\\vec{F}\\cdot\\vec{n}^0)\\cdot\\operatorname{Area}(\\Sigma) = \\pm(uA+vB+wC)\\cdot\\frac{\\operatorname{Area}(D_{xy})}{|C|}$，几秒出解",
                  uid: "m_gs07_06_s1",
                  tag: "秒杀公式",
                  tagType: "formula"
                }
              }
            ]
          }
        ]
      }
    ]
  };

  return chapter7Data;
});
