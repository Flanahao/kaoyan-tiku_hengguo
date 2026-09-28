/**
 * 考研数学一 · 高等数学 第6章《向量代数、空间解析几何与场论初步》全量认知导图数据
 *
 * 架构规范：
 * 1. 严格执行「知识点 · 考点 · 解法」三扇区正品字 △ 混合三角布局；
 * 2. 零 Emoji，零外部品牌词，纯正 LaTeX 公式与结构化标签；
 * 3. 挂载跨章同步块（sync_cont_diff_1vN）；
 * 4. 完整覆盖空间向量代数、平面与直线方程、距离与正交射影（含点线外积距离与异面/平行退化）、二次曲面（含双曲抛物面截线与抛物线弓形面积推导）、空间切线切平面及数学一场论（方向导数/梯度/散度/旋度/保守场势函数）。
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Chapter6MindMapData = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var chapter6Data = {
    data: {
      text: "第6章 向量代数、空间解析几何与场论初步",
      uid: "root_chapter_6",
      tag: "第6章",
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
              text: "空间平面与直线方程构建、距离及正交投影",
              uid: "kp_gs06_01",
              tag: "数一高频",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch6_plane_line", "m_gs06_01", "m_gs06_02"],
              associativeLineText: ["方程与距离", "平面束法", "外积距离与射影"]
            },
            children: [
              {
                data: {
                  text: "题眼：过交线平面用平面束方程；点到直线距离用外积面积法 $\\frac{|\\vec{P_0P_1}\\times\\vec{s}|}{|\\vec{s}|}$；异面直线公垂线距离用混合积体积除以叉积底面积",
                  uid: "kp_gs06_01_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "旋转曲面、柱面、二次曲面截线与空间曲线投影",
              uid: "kp_gs06_02",
              tag: "数一高频",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch6_surfaces", "m_gs06_03"],
              associativeLineText: ["二次曲面谱系", "旋转曲面轨迹法"]
            },
            children: [
              {
                data: {
                  text: "题眼：绕轴旋转不动变量保留、另一变量换为 $\\pm\\sqrt{\\cdot}$；双曲抛物面（马鞍面）三向截线特征与抛物线拱形面积 $\\frac{2}{3}bH$",
                  uid: "kp_gs06_02_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "空间曲线切线法平面与空间曲面切平面法线",
              uid: "kp_gs06_03",
              tag: "核心必考",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch6_tan_norm", "m_gs06_04"],
              associativeLineText: ["切向与法向", "交线切向量叉积法"]
            },
            children: [
              {
                data: {
                  text: "题眼：曲面 $F(x,y,z)=0$ 法向量为 $\\nabla F=(F'_x,F'_y,F'_z)$；两曲面交线切向量为两法向量叉积 $\\vec{T}=\\nabla F\\times\\nabla G$",
                  uid: "kp_gs06_03_d1",
                  tag: "题眼",
                  tagType: "prop"
                }
              }
            ]
          },
          {
            data: {
              text: "方向导数、梯度、散度、旋度与保守场势函数",
              uid: "kp_gs06_04",
              tag: "数一必考",
              tagType: "Importance",
              macroLevel: 2,
              expand: false,
              associativeLineTargets: ["k_ch6_field_grad", "k_ch6_field_div_curl", "m_gs06_05"],
              associativeLineText: ["方向导数与梯度", "散度与旋度", "场论计算防错"]
            },
            children: [
              {
                data: {
                  text: "题眼：可微时 $\\frac{\\partial u}{\\partial \\vec{l}}=\\nabla u\\cdot\\vec{l}^0$（必须单位化 $\\vec{l}^0$！）；梯度模长即最大方向导数；无旋场 $\\operatorname{curl}\\vec{F}=\\vec{0} \\iff$ 存在势函数",
                  uid: "kp_gs06_04_d1",
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
          // §1 向量代数、平面与直线
          {
            data: {
              text: "§1 空间向量代数、平面与直线方程体系",
              uid: "k_ch6_sec1",
              tag: "向量与线面",
              tagType: "formula",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "1.1 数量积、向量积与混合积几何准则",
                  uid: "k_ch6_vec_ops",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "点积与叉积：$\\vec{a}\\perp\\vec{b} \\iff \\vec{a}\\cdot\\vec{b}=0$；$\\vec{a}\\parallel\\vec{b} \\iff \\vec{a}\\times\\vec{b}=\\vec{0}$；$|\\vec{a}\\times\\vec{b}|$ 为平行四边形面积",
                      uid: "k_ch6_vec_dot_cross",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "混合积与三向量共面：$[\\vec{a}\\,\\vec{b}\\,\\vec{c}] = (\\vec{a}\\times\\vec{b})\\cdot\\vec{c}$ 为平行六面体有向体积；三向量共面 $\\iff [\\vec{a}\\,\\vec{b}\\,\\vec{c}]=0$",
                      uid: "k_ch6_vec_mixed",
                      tag: "定理",
                      tagType: "thm"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "1.2 空间平面、直线方程与空间距离公式全集",
                  uid: "k_ch6_plane_line",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "点面距离与点线外积距离：点 $P_1$ 到平面距离 $d=\\frac{|Ax_1+By_1+Cz_1+D|}{\\sqrt{A^2+B^2+C^2}}$；点 $P_1$ 到直线 $(P_0,\\vec{s})$ 距离 $d=\\frac{|\\vec{P_0P_1}\\times\\vec{s}|}{|\\vec{s}|}$（点在直线上时叉积为 $\\vec{0}$ 自洽归零）",
                      uid: "k_ch6_dist_pt",
                      tag: "核心公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "两直线距离与平行退化准则：异面直线 $(\\vec{s}_1\\nparallel\\vec{s}_2)$ 公垂线距离 $d=\\frac{|[\\vec{P_1P_2}\\,\\vec{s}_1\\,\\vec{s}_2]|}{|\\vec{s}_1\\times\\vec{s}_2|}$；若两直线平行 $(\\vec{s}_1\\parallel\\vec{s}_2)$ 分母为零，必须退化为点线距离 $d=\\frac{|\\vec{P_1P_2}\\times\\vec{s}_1|}{|\\vec{s}_1|}$",
                      uid: "k_ch6_dist_lines",
                      tag: "公式与避坑",
                      tagType: "warn"
                    }
                  }
                ]
              }
            ]
          },

          // §2 空间曲面、曲线与微分几何应用
          {
            data: {
              text: "§2 二次曲面、旋转曲面与空间切线切平面",
              uid: "k_ch6_sec2",
              tag: "曲面与切面",
              tagType: "formula",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "2.1 二次曲面谱系、双曲抛物面与抛物线弓形面积",
                  uid: "k_ch6_surfaces",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "二次曲面与双曲抛物面（马鞍面 $\\frac{x^2}{a^2}-\\frac{y^2}{b^2}=2pz$）：水平截面 $z=z_0$ 为双曲线（$z_0=0$ 退化为两相交直线），竖直截面 $x=x_0$ 或 $y=y_0$ 为抛物线；单叶双曲面与双曲抛物面同属直纹面",
                      uid: "k_ch6_quadric",
                      tag: "几何特征",
                      tagType: "prop"
                    }
                  },
                  {
                    data: {
                      text: "抛物线拱形截面面积秒杀公式：底宽为 $b$、拱高为 $H$ 的对称抛物线弓形面积恒为 $S = \\int_{-b/2}^{b/2}\\left(H-\\frac{4H}{b^2}y^2\\right)dy = \\frac{2}{3}bH$（三重积分定一积二截面法利器）",
                      uid: "k_ch6_parabola_area",
                      tag: "秒杀公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "旋转曲面与投影柱面：曲线 $f(y,z)=0, x=0$ 绕 $z$ 轴旋转得 $f(\\pm\\sqrt{x^2+y^2}, z)=0$；空间曲线联立消去 $z$ 得投影柱面 $H(x,y)=0$，联立 $z=0$ 即为投影曲线",
                      uid: "k_ch6_rev_proj",
                      tag: "公式",
                      tagType: "formula"
                    }
                  }
                ]
              },
              {
                data: {
                  text: "2.2 空间曲线切线法平面与曲面切平面法线",
                  uid: "k_ch6_tan_norm",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "空间曲线切向量：参数曲线 $\\vec{T}=(x'(t_0),y'(t_0),z'(t_0))$；两曲面交线 $\\begin{cases}F=0\\\\G=0\\end{cases}$ 的切向量为两法向量叉积 $\\vec{T} = \\nabla F \\times \\nabla G$",
                      uid: "k_ch6_curve_tan",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "空间曲面法向量：隐式曲面 $F(x,y,z)=0$ 法向量 $\\vec{n}=(F'_x,F'_y,F'_z)$；显式曲面 $z=f(x,y)$ 法向量 $\\vec{n}=(f'_x,f'_y,-1)$（向上法向量取 $(-f'_x,-f'_y,1)$）",
                      uid: "k_ch6_surf_norm",
                      tag: "公式",
                      tagType: "formula"
                    }
                  }
                ]
              }
            ]
          },

          // §3 场论初步（数学一核心）
          {
            data: {
              text: "§3 场论初步（方向导数、梯度、散度、旋度与保守场）",
              uid: "k_ch6_sec3",
              tag: "数一场论",
              tagType: "thm",
              macroLevel: 2,
              expand: true
            },
            children: [
              {
                data: {
                  text: "3.1 方向导数与梯度（标量场）",
                  uid: "k_ch6_field_grad",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "方向导数定义与计算：定义 $\\frac{\\partial u}{\\partial \\vec{l}}=\\lim_{t\\to 0^+}\\frac{u(P_0+t\\vec{l}^0)-u(P_0)}{t}$（单侧射线极限 $t\\to 0^+$）；可微时 $\\frac{\\partial u}{\\partial \\vec{l}} = \\nabla u \\cdot \\vec{l}^0 = u'_x\\cos\\alpha + u'_y\\cos\\beta + u'_z\\cos\\gamma$",
                      uid: "k_ch6_dir_deriv",
                      tag: "公式与定义",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "梯度几何与物理内涵：$\\operatorname{grad} u = \\nabla u = (u'_x,u'_y,u'_z)$ 指向函数增长最快方向，最大方向导数即为 $|\\nabla u|$，且梯度必垂直于过该点的等值面（等高线）",
                      uid: "k_ch6_grad_prop",
                      tag: "定理",
                      tagType: "thm"
                    }
                  },
                  {
                    data: {
                      text: "连续、可导(偏导)、可微与导函数连续 ($C^1$) 关系网与反例族（一元 vs 多元对比）",
                      uid: "k_ch6_sync_cd",
                      syncBlockId: "sync_cont_diff_1vN",
                      role: "sync_block"
                    },
                    children: []
                  }
                ]
              },
              {
                data: {
                  text: "3.2 散度、旋度与有势保守场（向量场）",
                  uid: "k_ch6_field_div_curl",
                  macroLevel: 3,
                  expand: false
                },
                children: [
                  {
                    data: {
                      text: "散度与旋度公式：散度（标量）$\\operatorname{div}\\vec{F}=\\nabla\\cdot\\vec{F}=\\frac{\\partial P}{\\partial x}+\\frac{\\partial Q}{\\partial y}+\\frac{\\partial R}{\\partial z}$；旋度（向量）$\\operatorname{rot}\\vec{F}=\\nabla\\times\\vec{F}=\\left(\\frac{\\partial R}{\\partial y}-\\frac{\\partial Q}{\\partial z}, \\frac{\\partial P}{\\partial z}-\\frac{\\partial R}{\\partial x}, \\frac{\\partial Q}{\\partial x}-\\frac{\\partial P}{\\partial y}\\right)$",
                      uid: "k_ch6_div_curl",
                      tag: "公式",
                      tagType: "formula"
                    }
                  },
                  {
                    data: {
                      text: "保守场（无旋场）与恒等式：单连通域内 $\\vec{F}=\\nabla u \\iff \\operatorname{rot}\\vec{F}=\\vec{0}$；恒等式 $\\operatorname{rot}(\\operatorname{grad} u)\\equiv \\vec{0}$（梯度场必无旋），$\\operatorname{div}(\\operatorname{rot}\\vec{F})\\equiv 0$（旋度场必无源）",
                      uid: "k_ch6_conserv",
                      tag: "定理",
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
              text: "过直线作平面的「平面束方程」待定参数法",
              uid: "m_gs06_01",
              tag: "M01",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "过交线 $\\begin{cases}\\Pi_1=0\\\\\\Pi_2=0\\end{cases}$ 的平面一律设为 $\\Pi_1 + \\lambda\\Pi_2 = 0$（注意补检 $\\Pi_2=0$ 本身），利用平行、垂直或过已知点条件一步解出单参数 $\\lambda$",
                  uid: "m_gs06_01_s1",
                  tag: "步骤",
                  tagType: "step"
                }
              }
            ]
          },
          {
            data: {
              text: "点在直线上垂足与对称点的「正交射影向量法」",
              uid: "m_gs06_02",
              tag: "M02",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "求点 $P_1$ 在直线 $(P_0,\\vec{s})$ 上的垂足 $H$：直接算向量投影 $H = P_0 + \\frac{\\vec{P_0P_1}\\cdot\\vec{s}}{|\\vec{s}|^2}\\vec{s}$；对称点坐标即为 $P'_1 = 2H - P_1$",
                  uid: "m_gs06_02_s1",
                  tag: "秒杀公式",
                  tagType: "formula"
                }
              }
            ]
          },
          {
            data: {
              text: "空间曲线绕任意轴旋转的「动点球面交截轨跡法」",
              uid: "m_gs06_03",
              tag: "M03",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "若旋转轴为一般直线 $(P_0, \\vec{s})$：在母线 $\\Gamma$ 上任取点 $M_0(x_0,y_0,z_0)$，旋转曲面上的动点 $M(x,y,z)$ 满足 $\\begin{cases}\\vec{M_0M}\\cdot\\vec{s}=0 \\\\ |\\vec{P_0M}|^2 = |\\vec{P_0M_0}|^2\\end{cases}$，联立母线方程消去 $(x_0,y_0,z_0)$ 即得旋转曲面方程",
                  uid: "m_gs06_03_s1",
                  tag: "通法",
                  tagType: "method"
                }
              }
            ]
          },
          {
            data: {
              text: "曲面距离极值与切平面平行转化法",
              uid: "m_gs06_04",
              tag: "M04",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "求光滑曲面 $\\Sigma: F(x,y,z)=0$ 上距已知平面 $\\Pi: Ax+By+Cz+D=0$ 最近/最远的点：不必上拉格朗日乘数法，直接令曲面法向量与平面法向量平行 $\\frac{F'_x}{A}=\\frac{F'_y}{B}=\\frac{F'_z}{C}$ 联立曲面方程秒解切点",
                  uid: "m_gs06_04_s1",
                  tag: "几何秒杀",
                  tagType: "method"
                }
              }
            ]
          },
          {
            data: {
              text: "径向场 r = √(x²+y²+z²) 的梯度、散度与旋度速算法",
              uid: "m_gs06_05",
              tag: "M05",
              tagType: "method",
              macroLevel: 2,
              expand: false
            },
            children: [
              {
                data: {
                  text: "记 $\\vec{r}=(x,y,z), r=|\\vec{r}|$：牢记 $\\nabla r = \\frac{\\vec{r}}{r},\\ \\nabla f(r) = f'(r)\\frac{\\vec{r}}{r}$；$\\operatorname{div}(f(r)\\vec{r}) = 3f(r) + rf'(r)$（特别地 $\\operatorname{div}\\frac{\\vec{r}}{r^3} = 0,\\ r\\neq 0$）；$\\operatorname{rot}(f(r)\\vec{r}) \\equiv \\vec{0}$",
                  uid: "m_gs06_05_s1",
                  tag: "数一常用",
                  tagType: "formula"
                }
              }
            ]
          }
        ]
      }
    ]
  };

  return chapter6Data;
});
