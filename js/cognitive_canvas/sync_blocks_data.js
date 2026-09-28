/**
 * 考研数学跨章节同步块母本库与同步块管理器 (SyncBlocksData & SyncBlockManager)
 * 职责：
 * 1. 维护跨章节完整子树规范库 (Single Source of Truth)，首批收录 4 大核心跨章同步块；
 * 2. 具备单章先行与动态挂载能力：第 1 章作为首发母本宿主，预声明关联章节元数据；
 * 3. 作用域 UID 投影 (Scoped Hydration: hostUid__syncKey)，彻底防止 SVG 布局与 DOM ID 冲突；
 * 4. 写穿式双向同步与全静默持久化 (Write-Through Sync -> localStorage: kaoyan.g.mindmap_sync_blocks)。
 */

(function (global) {
  'use strict';

  function safeClone(obj) {
    if (!obj) return null;
    return JSON.parse(JSON.stringify(obj));
  }

  function generateShortUid() {
    return 'sb_' + Math.random().toString(36).substr(2, 8);
  }

  // 首批跨章节同步块母本库（完整多级子树，非单行提纲）
  var SyncBlocksData = {
    // 1. 函数、导函数、原函数与变限积分的奇偶性/周期性互转规律
    'sync_parity_period': {
      syncBlockId: 'sync_parity_period',
      title: '函数、导函数、原函数与变限积分的奇偶性/周期性互转规律',
      linkedChapters: ['math_ch1', 'math_ch2', 'math_ch3'],
      rootData: {
        text: '函数、导函数、原函数与变限积分的奇偶性/周期性互转规律',
        syncKey: 'sb_pp_root',
        tag: '同步块',
        tagType: 'sync'
      },
      children: [
        {
          data: {
            text: '奇偶性互转关系网（导函数、原函数与变限积分）',
            syncKey: 'sb_pp_parity_group',
            tag: '定理',
            tagType: 'thm'
          },
          children: [
            {
              data: {
                text: '可导偶函数的导函数必为奇函数：$f(-x)=f(x) \\implies f\'(-x)=-f\'(x)$',
                syncKey: 'sb_pp_even_deriv',
                tag: '性质',
                tagType: 'prop'
              },
              children: [
                {
                  data: {
                    text: '逆命题警示：$f\'(x)$ 为奇函数，只能推出 $f(x)-f(0)$ 为偶函数（必须在对称区间上有定义）',
                    syncKey: 'sb_pp_even_deriv_rev',
                    tag: '避坑',
                    tagType: 'warn'
                  }
                }
              ]
            },
            {
              data: {
                text: '可导奇函数的导函数必为偶函数：$f(-x)=-f(x) \\implies f\'(-x)=f\'(x)$',
                syncKey: 'sb_pp_odd_deriv',
                tag: '性质',
                tagType: 'prop'
              },
              children: [
                {
                  data: {
                    text: '逆命题特例：若 $f\'(x)$ 为偶函数，则 $f(x)$ 的所有原函数中仅有唯一一个是奇函数，即 $F_0(x)=\\int_0^x f(t)dt$',
                    syncKey: 'sb_pp_odd_deriv_rev',
                    tag: '要领',
                    tagType: 'key'
                  }
                }
              ]
            },
            {
              data: {
                text: '变限积分奇偶性通用法则：$\\Phi(x)=\\int_a^x f(t)dt$',
                syncKey: 'sb_pp_int_rule',
                tag: '公式',
                tagType: 'formula'
              },
              children: [
                {
                  data: {
                    text: '若 $f(t)$ 为奇函数，则对**任意下限** $a$，$\\Phi(x)=\\int_a^x f(t)dt$ 必为偶函数',
                    syncKey: 'sb_pp_int_odd_rule',
                    tag: '结论',
                    tagType: 'prop'
                  },
                  children: [
                    {
                      data: {
                        text: '严格换元证明：$\\Phi(-x)=\\int_a^{-x}f(t)dt \\xrightarrow{t=-u} \\int_{-a}^x f(-u)d(-u) = \\int_{-a}^x f(u)du = \\Phi(x) - \\int_a^{-a}f(t)dt = \\Phi(x) - 0 = \\Phi(x)$',
                        syncKey: 'sb_pp_int_odd_proof',
                        tag: '推导',
                        tagType: 'step'
                      }
                    }
                  ]
                },
                {
                  data: {
                    text: '若 $f(t)$ 为偶函数，则 $\\Phi(x)=\\int_a^x f(t)dt$ 为奇函数的**充要条件是 $\\int_0^a f(t)dt = 0$**（通常取 $a=0$）',
                    syncKey: 'sb_pp_int_even_rule',
                    tag: '充要',
                    tagType: 'thm'
                  }
                }
              ]
            }
          ]
        },
        {
          data: {
            text: '周期性互转关系网（导函数、原函数与变限积分）',
            syncKey: 'sb_pp_period_group',
            tag: '定理',
            tagType: 'thm'
          },
          children: [
            {
              data: {
                text: '可导周期函数的导函数必为同周期函数：$f(x+T)=f(x) \\implies f\'(x+T)=f\'(x)$',
                syncKey: 'sb_pp_deriv_period',
                tag: '性质',
                tagType: 'prop'
              }
            },
            {
              data: {
                text: '连续周期函数的原函数具有周期性的**充要条件是一个周期内定积分为零**：$\\int_0^T f(t)dt = 0$',
                syncKey: 'sb_pp_int_period_iff',
                tag: '充要',
                tagType: 'thm'
              },
              children: [
                {
                  data: {
                    text: '变限积分线性分解定理：$\\int_0^x f(t)dt = \\frac{x}{T}\\int_0^T f(t)dt + P(x)$，其中 $P(x)$ 为以 $T$ 为周期的周期函数',
                    syncKey: 'sb_pp_decomp_thm',
                    tag: '公式',
                    tagType: 'formula'
                  }
                },
                {
                  data: {
                    text: '若 $\\int_0^T f(t)dt \\neq 0$，则其原函数必为“直线项 + 周期振荡项”，图像沿倾斜方向发散，绝无周期性',
                    syncKey: 'sb_pp_int_nonperiod_warn',
                    tag: '避坑',
                    tagType: 'warn'
                  }
                }
              ]
            }
          ]
        }
      ]
    },

    // 2. 函数有界性的四大判定准则与典型反例对比
    'sync_boundedness': {
      syncBlockId: 'sync_boundedness',
      title: '函数有界性的四大判定准则与典型反例对比',
      linkedChapters: ['math_ch1', 'math_ch2', 'math_ch4'],
      rootData: {
        text: '函数有界性的四大判定准则与典型反例对比',
        syncKey: 'sb_bound_root',
        tag: '同步块',
        tagType: 'sync'
      },
      children: [
        {
          data: {
            text: '准则一（闭区间连续必有界）：$f(x) \\in C[a, b] \\implies f(x)$ 在 $[a, b]$ 上必有界且能取到最大值与最小值',
            syncKey: 'sb_bound_crit1',
            tag: '准则',
            tagType: 'thm'
          }
        },
        {
          data: {
            text: '准则二（开区间两端单侧极限存在充要性）：设 $f(x) \\in C(a, b)$，则 $f(x)$ 在 $(a, b)$ 上有界的**充要条件是左右两端单侧极限 $\\lim_{x\\to a^+}f(x)$ 与 $\\lim_{x\\to b^-}f(x)$ 均存在（有限实数）**',
            syncKey: 'sb_bound_crit2',
            tag: '充要',
            tagType: 'thm'
          },
          children: [
            {
              data: {
                text: '充分性直观：若极限存在，可在邻域内取界，中间紧闭区间由闭区间连续定理保证有界，拼接即证全开区间有界',
                syncKey: 'sb_bound_crit2_pf',
                tag: '推导',
                tagType: 'step'
              }
            }
          ]
        },
        {
          data: {
            text: '准则三（导函数有界推原函数有界）：若 $f\'(x)$ 在有限区间 $I$ 上有界，则 $f(x)$ 在 $I$ 上必有界',
            syncKey: 'sb_bound_crit3',
            tag: '准则',
            tagType: 'thm'
          },
          children: [
            {
              data: {
                text: '由拉格朗日中值定理：$|f(x)-f(x_0)| = |f\'(\\xi)||x-x_0| \\le M|b-a|$，满足 Lipschitz 条件故整体有界',
                syncKey: 'sb_bound_crit3_pf',
                tag: '推导',
                tagType: 'step'
              }
            }
          ]
        },
        {
          data: {
            text: '四大经典反例族谱对比（彻底厘清充分与必要边界）',
            syncKey: 'sb_bound_counter_group',
            tag: '反例',
            tagType: 'warn'
          },
          children: [
            {
              data: {
                text: '$f(x) = \\frac{1}{x}$ 在 $(0, 1)$ 上连续但无界（端点极限 $\\lim_{x\\to 0^+} \\frac{1}{x} = +\\infty$ 破坏准则二）',
                syncKey: 'sb_bound_cex1',
                tag: '反例',
                tagType: 'warn'
              }
            },
            {
              data: {
                text: '$f(x) = \\sin\\frac{1}{x}$ 在 $(0, 1)$ 上有界（$|f(x)|\\le 1$），但端点极限 $\\lim_{x\\to 0^+} \\sin\\frac{1}{x}$ 振荡不存在（说明准则二仅为充分条件而非必要条件）',
                syncKey: 'sb_bound_cex2',
                tag: '反例',
                tagType: 'warn'
              }
            },
            {
              data: {
                text: '$f(x) = \\sin(x^2)$ 在 $[0, +\\infty)$ 上有界，但其导数 $f\'(x) = 2x\\cos(x^2)$ 在无穷远无界（原函数有界无法推导函数有界）',
                syncKey: 'sb_bound_cex3',
                tag: '反例',
                tagType: 'warn'
              }
            },
            {
              data: {
                text: '$f(x) = \\sqrt{x}$ 在 $[0, 1]$ 上有界，但 $f\'(x) = \\frac{1}{2\\sqrt{x}}$ 在 $(0, 1]$ 上无界（函数有界不能反推导数有界）',
                syncKey: 'sb_bound_cex4',
                tag: '反例',
                tagType: 'warn'
              }
            }
          ]
        }
      ]
    },

    // 3. 连续、可导(偏导)、可微与导函数连续 ($C^1$) 关系网与反例族（一元 vs 多元对比）
    'sync_cont_diff_1vN': {
      syncBlockId: 'sync_cont_diff_1vN',
      title: '连续、可导(偏导)、可微与导函数连续 ($C^1$) 关系网与反例族（一元 vs 多元对比）',
      linkedChapters: ['math_ch1', 'math_ch2', 'math_ch8'],
      rootData: {
        text: '连续、可导(偏导)、可微与导函数连续 ($C^1$) 关系网与反例族（一元 vs 多元对比）',
        syncKey: 'sb_cd_root',
        tag: '同步块',
        tagType: 'sync'
      },
      children: [
        {
          data: {
            text: '一元函数包含阶梯：$f\'(x) \\in C (C^1) \\implies f(x)$ 可导 $\\iff f(x)$ 可微 $\\implies f(x)$ 连续 $\\implies f(x)$ 极限存在',
            syncKey: 'sb_cd_1var_chain',
            tag: '定理',
            tagType: 'thm'
          },
          children: [
            {
              data: {
                text: '一元可导与可微等价：$\\Delta y = A\\Delta x + o(\\Delta x) \\iff \\lim_{\\Delta x\\to 0}\\frac{\\Delta y}{\\Delta x} = A = f\'(x_0)$',
                syncKey: 'sb_cd_1var_equiv',
                tag: '性质',
                tagType: 'prop'
              }
            },
            {
              data: {
                text: '一元反例核心谱系：$f_k(x) = x^k \\sin\\frac{1}{x} \\ (x\\neq 0), \\ 0 \\ (x=0)$',
                syncKey: 'sb_cd_1var_c_family',
                tag: '反例',
                tagType: 'warn'
              },
              children: [
                {
                  data: {
                    text: '$k=1$：$f(x)=x\\sin\\frac{1}{x}$ 在 $x=0$ 处连续但**不可导**（差商 $\\sin\\frac{1}{x}$ 振荡发散）',
                    syncKey: 'sb_cd_cex_k1',
                    tag: '反例',
                    tagType: 'warn'
                  }
                },
                {
                  data: {
                    text: '$k=2$：$f(x)=x^2\\sin\\frac{1}{x}$ 在 $x=0$ 处**可导**（$f\'(0)=0$），但导函数 $f\'(x)=2x\\sin\\frac{1}{x}-\\cos\\frac{1}{x}$ 在 $x=0$ 处极限振荡不存在，故**导函数不连续**',
                    syncKey: 'sb_cd_cex_k2',
                    tag: '反例',
                    tagType: 'warn'
                  }
                },
                {
                  data: {
                    text: '$k=3$：$f(x)=x^3\\sin\\frac{1}{x}$ 导函数在 $x=0$ 连续，但二阶导数在 $x=0$ 处不存在',
                    syncKey: 'sb_cd_cex_k3',
                    tag: '反例',
                    tagType: 'warn'
                  }
                }
              ]
            }
          ]
        },
        {
          data: {
            text: '多元函数四角核心蕴含网（第 5 章多元微分对比，打破一元直觉）',
            syncKey: 'sb_cd_nvar_net',
            tag: '定理',
            tagType: 'thm'
          },
          children: [
            {
              data: {
                text: '偏导数连续 ($f_x, f_y \\in C$) $\\implies$ 全微分存在 ($dz = f_x dx + f_y dy$)（充分非必要）',
                syncKey: 'sb_cd_nvar_c1_diff',
                tag: '准则',
                tagType: 'thm'
              }
            },
            {
              data: {
                text: '全微分存在 $\\implies$ 函数连续，且偏导数 $f_x, f_y$ 必存在（必要条件）',
                syncKey: 'sb_cd_nvar_diff_cont',
                tag: '定理',
                tagType: 'thm'
              }
            },
            {
              data: {
                text: '偏导数在邻域内存在且有界（$|f_x|\\le M, |f_y|\\le M$）$\\implies$ 函数必连续（Lipschitz 夹逼证明）',
                syncKey: 'sb_cd_nvar_bound_cont',
                tag: '定理',
                tagType: 'thm'
              }
            },
            {
              data: {
                text: '核心断裂 1：偏导数存在**推不出**连续（反例：$f(x,y)=\\frac{xy}{x^2+y^2}$，沿两坐标轴偏导数均为 0，但沿 $y=kx$ 趋于 0 时极限为 $\\frac{k}{1+k^2}$，极限不存在故不连续）',
                syncKey: 'sb_cd_nvar_break1',
                tag: '避坑',
                tagType: 'warn'
              }
            },
            {
              data: {
                text: '核心断裂 2：偏导数存在且函数连续**仍推不出**可微（反例：$f(x,y)=\\sqrt{x^2+y^2}$ 圆锥面，在原点连续且无方向全微分）',
                syncKey: 'sb_cd_nvar_break2',
                tag: '避坑',
                tagType: 'warn'
              }
            },
            {
              data: {
                text: '核心断裂 3：偏导数有界**仍推不出**可微（反例：$f(x,y)=\\frac{xy}{\\sqrt{x^2+y^2}}$，偏导绝对值 $\\le 1$ 有界且原点连续，但 $\\frac{\\Delta z - 0}{\\rho}=\\cos\\theta\\sin\\theta$ 不趋于 0，不可微）',
                syncKey: 'sb_cd_nvar_break3',
                tag: '反例',
                tagType: 'warn'
              }
            }
          ]
        }
      ]
    },

    // 4. 跨章求极限四大工具（导数定义识别 / 变限积分等价代换 / 定积分定义求 n 项和 / 拉格朗日中值同构）
    'sync_limit_cross_tools': {
      syncBlockId: 'sync_limit_cross_tools',
      title: '跨章求极限四大工具（导数定义识别 / 变限积分等价代换 / 定积分定义求 n 项和 / 拉格朗日中值同构）',
      linkedChapters: ['math_ch1', 'math_ch2', 'math_ch3', 'math_ch4'],
      rootData: {
        text: '跨章求极限四大工具（导数定义识别 / 变限积分等价代换 / 定积分定义求 $n$ 项和 / 拉格朗日中值同构）',
        syncKey: 'sb_lim_root',
        tag: '同步块',
        tagType: 'sync'
      },
      children: [
        {
          data: {
            text: '工具一：导数定义逆向识别极限定型',
            syncKey: 'sb_lim_t1_deriv_def',
            tag: '招法',
            tagType: 'method'
          },
          children: [
            {
              data: {
                text: '标准对称差商公式：若 $f\'(x_0)$ 存在，则 $\\lim_{h\\to 0} \\frac{f(x_0+ah) - f(x_0+bh)}{h} = (a-b)f\'(x_0)$',
                syncKey: 'sb_lim_t1_sym_formula',
                tag: '公式',
                tagType: 'formula'
              }
            },
            {
              data: {
                text: '前提红线：若题目**未交代 $f\'(x_0)$ 存在**，禁止直接套用 $(a-b)f\'(x_0)$，必须拆成单侧差商或用保号性/反例定性',
                syncKey: 'sb_lim_t1_warn',
                tag: '避坑',
                tagType: 'warn'
              }
            }
          ]
        },
        {
          data: {
            text: '工具二：变限积分求极限的等价无穷小替换法则',
            syncKey: 'sb_lim_t2_integral_equiv',
            tag: '招法',
            tagType: 'method'
          },
          children: [
            {
              data: {
                text: '幂函数积分等价定理：当 $x\\to 0$ 且 $f(t) \\sim c t^k$ 时，$\\int_0^x f(t)dt \\sim \\frac{c}{k+1} x^{k+1}$',
                syncKey: 'sb_lim_t2_power_rule',
                tag: '公式',
                tagType: 'formula'
              }
            },
            {
              data: {
                text: '复合上限等价换元法：$\\int_0^{\\sin x} \\ln(1+t^2)dt \\sim \\int_0^x t^2 dt = \\frac{1}{3}x^3$',
                syncKey: 'sb_lim_t2_comp_rule',
                tag: '步骤',
                tagType: 'step'
              }
            }
          ]
        },
        {
          data: {
            text: '工具三：定积分定义求 $n$ 项和式极限',
            syncKey: 'sb_lim_t3_riemann_sum',
            tag: '招法',
            tagType: 'method'
          },
          children: [
            {
              data: {
                text: '标准 Riemann 转化式：$\\lim_{n\\to\\infty} \\frac{1}{n} \\sum_{i=1}^n f\\left(\\frac{i}{n}\\right) = \\int_0^1 f(x)dx$',
                syncKey: 'sb_lim_t3_standard',
                tag: '公式',
                tagType: 'formula'
              }
            },
            {
              data: {
                text: '三步定位法：1. 提出公因子 $\\frac{1}{n}$ 构造步长 $dx$；2. 识别主部项 $\\frac{i}{n}$ 换元为自变量 $x$；3. 求定积分得出极限值',
                syncKey: 'sb_lim_t3_steps',
                tag: '要领',
                tagType: 'key'
              }
            }
          ]
        },
        {
          data: {
            text: '工具四：拉格朗日中值定理构造同构差式求极限',
            syncKey: 'sb_lim_t4_lagrange_iso',
            tag: '招法',
            tagType: 'method'
          },
          children: [
            {
              data: {
                text: '适用特征：表达式形如 $f(b) - f(a)$，其中 $a, b$ 为同阶无穷小或同阶无穷大（如 $\\sin(\\sin x) - \\sin x$、$(1+x)^{1/x} - e$）',
                syncKey: 'sb_lim_t4_feature',
                tag: '要领',
                tagType: 'key'
              }
            },
            {
              data: {
                text: '公式与夹逼中介点：$f(b) - f(a) = f\'(\\xi)(b-a)$，其中 $\\xi$ 介于 $a, b$ 之间，由夹逼准则可知 $\\xi \\sim a \\sim b$，将二阶导转化为乘积定阶',
                syncKey: 'sb_lim_t4_formula',
                tag: '公式',
                tagType: 'formula'
              }
            }
          ]
        }
      ]
    },

    // 5. 各类积分对称性与奇偶性通解矩阵（定积分 vs 重积分 vs 第一/第二类曲线曲面积分）
    'sync_symmetry_integrals': {
      syncBlockId: 'sync_symmetry_integrals',
      title: '各类积分对称性与奇偶性通解矩阵（定积分 vs 重积分 vs 一二型线面积分）',
      linkedChapters: ['math_ch1', 'math_ch4', 'math_ch7'],
      rootData: {
        text: '各类积分对称性与奇偶性通解矩阵（定积分 vs 重积分 vs 一二型线面积分）',
        syncKey: 'sb_sym_root',
        tag: '同步块',
        tagType: 'sync'
      },
      children: [
        {
          data: {
            text: '第一家族（无方向数量型：定积分、二重/三重积分、第一类曲线/曲面积分）——“奇零偶倍”',
            syncKey: 'sb_sym_scalar_group',
            tag: '定理',
            tagType: 'thm'
          },
          children: [
            {
              data: {
                text: '一元定积分 $[-a,a]$：$f(-x)=-f(x) \\implies \\int_{-a}^a f(x)dx = 0$；$f(-x)=f(x) \\implies 2\\int_0^a f(x)dx$',
                syncKey: 'sb_sym_1d',
                tag: '公式',
                tagType: 'formula'
              }
            },
            {
              data: {
                text: '二重/三重与第一类线面积分：积分域关于某坐标轴/坐标面对称（如关于 $yOz$ 面对称，即 $x\\leftrightarrow -x$ 不变），看被积函数关于 $x$ 的奇偶性：奇函数得 $0$，偶函数得 $2$ 倍半域积分',
                syncKey: 'sb_sym_nd_scalar',
                tag: '准则',
                tagType: 'thm'
              }
            },
            {
              data: {
                text: '轮换对称性（坐标地位对等）：若积分域关于 $y=x$（或 $x,y,z$ 轮换）对称，则 $\\iint_D f(x,y)d\\sigma = \\iint_D f(y,x)d\\sigma = \\frac{1}{2}\\iint_D [f(x,y)+f(y,x)]d\\sigma$',
                syncKey: 'sb_sym_cyclic',
                tag: '招法',
                tagType: 'method'
              }
            }
          ]
        },
        {
          data: {
            text: '第二家族（有方向坐标型：第二类曲线积分 $\\int_L Pdx$、第二类曲面积分 $\\iint_\\Sigma Rdxdy$）——“奇偶性与第一家族完全相反”',
            syncKey: 'sb_sym_vector_group',
            tag: '避坑',
            tagType: 'warn'
          },
          children: [
            {
              data: {
                text: '第二类曲面积分 $\\iint_\\Sigma R(x,y,z)dxdy$：若 $\\Sigma$ 关于 $xOy$ 面 ($z\\leftrightarrow -z$) 对称且同取外侧（上半上侧、下半下侧，法向 $z$ 分量反号）：当 $R$ 关于 $z$ 为**偶函数时积分为 $0$**，为**奇函数时积分为 $2\\iint_{\\Sigma_1} R dxdy$**',
                syncKey: 'sb_sym_surf2_z',
                tag: '警钟',
                tagType: 'warn'
              }
            },
            {
              data: {
                text: '同面关于非投影轴对称：若 $\\Sigma$ 关于 $yOz$ 面 ($x\\leftrightarrow -x$) 对称且取外侧（左右两侧法向 $z$ 分量同号）：此时 $\\iint_\\Sigma R(x,y,z)dxdy$ 恢复与数量积分一致（关于 $x$ 奇零偶倍）',
                syncKey: 'sb_sym_surf2_x',
                tag: '要领',
                tagType: 'key'
              }
            },
            {
              data: {
                text: '第二类平面曲线积分 $\\int_L P(x,y)dx$：若 $L$ 关于 $y$ 轴对称且方向一致（如顺时针从右到左，$dx$ 符号一致），则 $P$ 关于 $x$ 偶倍奇零；若 $L$ 关于 $x$ 轴上下对称且沿逆时针闭路（上下两段 $dx$ 方向相反），则 $P$ 关于 $y$ **偶零奇倍**',
                syncKey: 'sb_sym_line2',
                tag: '准则',
                tagType: 'thm'
              }
            }
          ]
        }
      ]
    }
  };

  // 同步块管理器类
  class SyncBlockManager {
    constructor() {
      this.registry = new Map();
      this.initRegistry();
    }

    initRegistry() {
      // 1. 载入代码中的母本
      Object.keys(SyncBlocksData).forEach((id) => {
        this.registry.set(id, safeClone(SyncBlocksData[id]));
      });

      // 2. 检查 localStorage 是否有用户编辑过的最新同步块态 (静默覆盖)
      try {
        if (typeof localStorage !== 'undefined') {
          var raw = localStorage.getItem('kaoyan.g.mindmap_sync_blocks');
          if (raw) {
            var parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
              Object.keys(parsed).forEach((id) => {
                this.registry.set(id, parsed[id]);
              });
            }
          }
        }
      } catch (e) {
        console.warn('[SyncBlockManager] 读取本地同步块存储失败:', e);
      }
    }

    getSyncBlock(id) {
      return this.registry.get(id) || null;
    }

    /**
     * 将树中的宿主节点（声明了 data.syncBlockId）自动展开并注入规范子树
     * 作用域 UID 生成规则：hostUid__syncKey，彻底杜绝同画布内跨分支或全局 UID 冲突
     */
    hydrateTree(rootNode) {
      if (!rootNode) return null;
      var self = this;

      function walk(node) {
        if (!node) return;
        var d = node.data || {};
        var sId = d.syncBlockId;

        if (sId && !d.isSyncBlockChild) {
          var block = self.getSyncBlock(sId);
          if (block) {
            d.isSyncBlockRoot = true;
            // 复制母本中的根数据描述（不覆盖宿主本身的必要标识如 uid, dir 等）
            if (block.rootData) {
              if (!d.text || d.text.trim() === '') d.text = block.rootData.text;
              d.tag = block.rootData.tag || '同步块';
              d.tagType = block.rootData.tagType || 'sync';
            }

            var hostUid = d.uid || 'host_sb';
            var canonicalChildren = safeClone(block.children) || [];

            // 递归投影子节点并附加 hostUid__ 作用域前缀
            function injectScope(childNode) {
              if (!childNode) return;
              if (!childNode.data) childNode.data = {};
              var sk = childNode.data.syncKey || generateShortUid();
              childNode.data.syncKey = sk;
              childNode.data.uid = hostUid + '__' + sk;
              childNode.data.syncBlockId = sId;
              childNode.data.isSyncBlockChild = true;

              if (Array.isArray(childNode.children)) {
                childNode.children.forEach(injectScope);
              }
            }

            canonicalChildren.forEach(injectScope);
            node.children = canonicalChildren;
          }
          return; // 子节点已经由 injectScope 深度注入，无需外部 walk 再次展开
        }

        if (Array.isArray(node.children)) {
          node.children.forEach(walk);
        }
      }

      var clonedTree = safeClone(rootNode);
      walk(clonedTree);
      return clonedTree;
    }

    /**
     * 从修改后的渲染树中提取出带有 syncBlockId 的最新子树，剥离作用域前缀并规范化写回注册表与 localStorage
     */
    extractAndSaveSyncBlocks(renderedTree) {
      if (!renderedTree) return false;
      var self = this;
      var updatedBlockIds = new Set();

      function walkExtract(node) {
        if (!node) return;
        var d = node.data || {};
        var sId = d.syncBlockId;

        // 若当前节点是同步块宿主根
        if (sId && (d.isSyncBlockRoot || !d.isSyncBlockChild)) {
          var hostUid = d.uid || '';
          var prefix = hostUid ? (hostUid + '__') : '';

          function cleanChild(child) {
            if (!child) return null;
            var res = {
              data: {},
              children: []
            };
            if (child.data) {
              for (var k in child.data) {
                if (k === '_node' || k === 'node' || k.startsWith('_')) continue;
                if (k === 'uid' || k === 'isSyncBlockChild') continue;
                res.data[k] = child.data[k];
              }
              // 还原规范 syncKey
              var curUid = child.data.uid || '';
              if (!res.data.syncKey) {
                if (prefix && curUid.indexOf(prefix) === 0) {
                  res.data.syncKey = curUid.slice(prefix.length);
                } else {
                  res.data.syncKey = generateShortUid();
                }
              }
            }
            if (Array.isArray(child.children)) {
              res.children = child.children.map(cleanChild).filter(Boolean);
            }
            return res;
          }

          var extractedChildren = Array.isArray(node.children)
            ? node.children.map(cleanChild).filter(Boolean)
            : [];

          var existingBlock = self.registry.get(sId) || {
            syncBlockId: sId,
            title: d.text || '同步块',
            linkedChapters: ['math_ch1']
          };

          existingBlock.children = extractedChildren;
          self.registry.set(sId, existingBlock);
          updatedBlockIds.add(sId);
        }

        if (Array.isArray(node.children)) {
          node.children.forEach(walkExtract);
        }
      }

      walkExtract(renderedTree);

      if (updatedBlockIds.size > 0) {
        this.persistRegistry();
        return true;
      }
      return false;
    }

    getAllBlocks() {
      var exportObj = {};
      this.registry.forEach(function (val, key) {
        exportObj[key] = val;
      });
      return exportObj;
    }

    persistRegistry() {
      try {
        if (typeof localStorage !== 'undefined') {
          var exportObj = this.getAllBlocks();
          localStorage.setItem('kaoyan.g.mindmap_sync_blocks', JSON.stringify(exportObj));
          if (typeof window !== 'undefined' && typeof window.notifyStorageSync === 'function') {
            window.notifyStorageSync();
          }
        }
      } catch (e) {
        console.warn('[SyncBlockManager] 持久化同步块注册表失败:', e);
      }
    }
  }

  // 挂载全局实例
  global.SyncBlocksData = SyncBlocksData;
  global.SyncBlockManager = new SyncBlockManager();

})(typeof window !== 'undefined' ? window : this);
