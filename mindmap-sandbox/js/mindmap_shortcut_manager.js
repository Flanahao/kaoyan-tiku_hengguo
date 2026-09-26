/**
 * 思维导图全局快捷键管理器 (MindMapShortcutManager)
 * 职责：
 * 1. 7 色高亮体系 (Alt + R, Y, P, B, C, O, G)
 * 2. 节点样式切换 (Ctrl + B 加粗, Ctrl + I 斜体, Ctrl + U 下划线)
 * 3. 节点副本创建 (Ctrl + D Duplicate)
 * 4. 节点折叠与展开 (Alt + . / Alt + Shift + . / Alt + 1, 2, 3 按层级展开)
 * 5. 单节点钻取聚焦与返回 (Ctrl + ] / Ctrl + [)
 * 6. 画布缩放 (Ctrl + + / -) 与快捷键指南抽屉唤起 (H / Ctrl + /)
 * 7. 支持作用域隔离 (isActiveCheck)，当导图未激活时零侵入宿主环境
 */
(function (global) {
  'use strict';

  function generateUid() {
    return 'node_' + Math.random().toString(36).substr(2, 9);
  }

  function safeCloneNodeData(source) {
    if (!source) return null;
    const res = {
      data: {},
      children: []
    };
    if (source.data) {
      for (const k in source.data) {
        if (k === '_node' || k === 'node' || k.startsWith('_')) continue;
        const val = source.data[k];
        if (typeof val !== 'object' || val === null) {
          res.data[k] = val;
        } else if (Array.isArray(val)) {
          res.data[k] = val.slice();
        } else {
          try {
            res.data[k] = JSON.parse(JSON.stringify(val));
          } catch (e) {
            // 忽略潜在循环结构
          }
        }
      }
    }
    res.data.uid = generateUid();
    if (Array.isArray(source.children)) {
      res.children = source.children.map(child => safeCloneNodeData(child)).filter(Boolean);
    }
    return res;
  }

  class MindMapShortcutManager {
    constructor(mindMap, options = {}) {
      if (!mindMap) {
        throw new Error('[MindMapShortcutManager] 必须传入 SimpleMindMap 实例');
      }
      this.mindMap = mindMap;
      this.options = options;
      this.mountContainer = options.container || document.body;
      this.isActiveCheck = typeof options.isActiveCheck === 'function' ? options.isActiveCheck : null;
      this.shortcutDrawer = options.shortcutDrawer || null;

      // 钻取栈 (Drill-down stack)
      this.drillStack = [];
      this.breadcrumbEl = null;

      this.initBreadcrumbDom();
      this.bindShortcuts();
    }

    isActive() {
      if (this.isActiveCheck) {
        return !!this.isActiveCheck();
      }
      return true;
    }

    initBreadcrumbDom() {
      const existing = this.mountContainer.querySelector('.mm-drill-breadcrumb');
      if (existing) existing.remove();

      this.breadcrumbEl = document.createElement('div');
      this.breadcrumbEl.className = 'mm-drill-breadcrumb';
      this.breadcrumbEl.style.cssText = `
        position: fixed;
        top: 16px;
        left: 140px;
        z-index: 120;
        display: none;
        align-items: center;
        gap: 8px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(12px);
        padding: 4px 12px;
        border-radius: 16px;
        border: 1px solid #dee0e3;
        box-shadow: 0 4px 12px rgba(31, 35, 41, 0.08);
        font-size: 13px;
        color: #646a73;
      `;
      this.mountContainer.appendChild(this.breadcrumbEl);
    }

    bindShortcuts() {
      window.addEventListener('keydown', (e) => {
        if (!this.isActive()) return;

        const isEditing = this.isUserTyping();
        const activeList = (this.mindMap.renderer && this.mindMap.renderer.activeNodeList) || [];
        const activeNode = (activeList.length === 1) ? activeList[0] : null;

        // 1. 快捷键指南面板呼出 (H 键与 Ctrl + /)
        if ((e.key === 'h' || e.key === 'H') && !isEditing && !e.altKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          e.stopPropagation();
          if (this.shortcutDrawer) {
            this.shortcutDrawer.toggle();
          }
          return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key === '/') {
          e.preventDefault();
          e.stopPropagation();
          if (this.shortcutDrawer) {
            this.shortcutDrawer.toggle();
          }
          return;
        }

        // 2. 7 色高亮体系 (Alt + R, Y, P, B, C, O, G 以及 Alt + H 快捷高亮)
        if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
          const colorMap = {
            'KeyR': 'red',
            'KeyY': 'yellow',
            'KeyP': 'purple',
            'KeyB': 'blue',
            'KeyC': 'cyan',
            'KeyO': 'orange',
            'KeyG': 'green',
            'KeyH': 'yellow'
          };
          const colorKey = colorMap[e.code];
          if (colorKey) {
            if (isEditing) {
              e.preventDefault();
              e.stopPropagation();
              this.dispatchFormatting('color', colorKey);
              return;
            } else if (activeNode) {
              e.preventDefault();
              e.stopPropagation();
              this.toggleNodeHighlight(activeNode, colorKey);
              return;
            }
          }
        }

        // 2.1 单键层级概览与全量分类展开 (1, 2, 3, 0, Q, W, E, L) - 非编辑/打字态下直接生效
        if (!isEditing && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
          if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '0') {
            e.preventDefault();
            e.stopPropagation();
            if (e.key === '0') {
              this.expandAll();
            } else if (e.key === '1') {
              this.expandToLevel(1); // 1 键：知识点展开至 1.1~3.3，考点展开至 5 大考点，招法展开至 7 大招法
            } else if (e.key === '2') {
              this.expandToLevel(2); // 2 键：微观要点与真题步骤展开
            } else if (e.key === '3') {
              this.expandToLevel(3); // 3 键：全量深度展开
            }
            return;
          }

          const k = (e.key || '').toLowerCase();
          if (k === 'q') {
            e.preventDefault();
            e.stopPropagation();
            this.expandCategory('knowledge');
            return;
          }
          if (k === 'w') {
            e.preventDefault();
            e.stopPropagation();
            this.expandCategory('exam');
            return;
          }
          if (k === 'e') {
            e.preventDefault();
            e.stopPropagation();
            this.expandCategory('method');
            return;
          }
          if (k === 'l') {
            e.preventDefault();
            e.stopPropagation();
            if (window.CognitiveViewController && typeof window.CognitiveViewController.toggleAssociativeLines === 'function') {
              window.CognitiveViewController.toggleAssociativeLines();
            }
            return;
          }
        }

        // 兼容 Alt + 1 / 2 / 3 / 0 / Q / W / E
        if (!isEditing && e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
          if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '0') {
            e.preventDefault();
            e.stopPropagation();
            if (e.key === '0') this.expandAll();
            else if (e.key === '1') this.expandToLevel(1);
            else if (e.key === '2') this.expandToLevel(2);
            else if (e.key === '3') this.expandToLevel(3);
            return;
          }
          const k = (e.key || '').toLowerCase();
          if (k === 'q') { e.preventDefault(); e.stopPropagation(); this.expandCategory('knowledge'); return; }
          if (k === 'w') { e.preventDefault(); e.stopPropagation(); this.expandCategory('exam'); return; }
          if (k === 'e') { e.preventDefault(); e.stopPropagation(); this.expandCategory('method'); return; }
        }

        // 3. 复制节点副本 (Ctrl + D)
        if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D') && !e.shiftKey && !e.altKey) {
          if (activeNode && !isEditing) {
            e.preventDefault();
            e.stopPropagation();
            this.duplicateNode(activeNode);
            return;
          }
        }

        // 4. 聚焦钻取进入当前节点 (Ctrl + ]) 与返回上一级 (Ctrl + [)
        if ((e.ctrlKey || e.metaKey) && e.key === ']') {
          if (activeNode && !isEditing) {
            e.preventDefault();
            e.stopPropagation();
            this.drillDown(activeNode);
            return;
          }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === '[') {
          if (!isEditing && this.drillStack.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            this.drillUp();
            return;
          }
        }

        // 5. 展开 / 折叠 (Alt + . 与 Alt + Shift + .)
        if (e.altKey && e.key === '.') {
          e.preventDefault();
          e.stopPropagation();
          if (e.shiftKey) {
            this.toggleExpandAll();
          } else if (activeNode) {
            const expand = activeNode.getData('expand');
            this.mindMap.execCommand('SET_NODE_EXPAND', activeNode, expand === false);
          }
          return;
        }

        // 6. 富文本样式快捷键 (Ctrl + B / I / U / Shift+X / E) 编辑态与非编辑态双模流转
        if ((e.ctrlKey || e.metaKey) && !e.altKey) {
          const k = e.key.toLowerCase();
          if (k === 'b' || k === 'i' || k === 'u') {
            if (isEditing) {
              e.preventDefault();
              e.stopPropagation();
              const map = { 'b': 'bold', 'i': 'italic', 'u': 'underline' };
              this.dispatchFormatting(map[k]);
              return;
            } else if (activeNode) {
              e.preventDefault();
              e.stopPropagation();
              if (k === 'b') this.toggleNodeStyle(activeNode, 'fontWeight', 'bold');
              else if (k === 'i') this.toggleNodeStyle(activeNode, 'fontStyle', 'italic');
              else if (k === 'u') this.toggleNodeStyle(activeNode, 'textDecoration', 'underline');
              return;
            }
          }
          // 删除线 Ctrl + Shift + X
          if (e.shiftKey && k === 'x') {
            if (isEditing) {
              e.preventDefault();
              e.stopPropagation();
              this.dispatchFormatting('strikethrough');
              return;
            }
          }
          // 行内代码 Ctrl + E
          if (!e.shiftKey && k === 'e') {
            if (isEditing) {
              e.preventDefault();
              e.stopPropagation();
              this.dispatchFormatting('code');
              return;
            }
          }
        }
      }, true);
    }

    // 转发富文本排版指令（优先作用于活跃编辑器的文本选区）
    dispatchFormatting(formatType, extra = null) {
      const editor = this.mindMap.mindMapNodeEditor || window._mindMapNodeEditorInstance;
      if (editor && editor.isEditing) {
        editor.formatSelection(formatType, extra);
        return true;
      }
      const outliner = this.options.outliner || window._outlinerInstance;
      if (outliner && outliner.focusedUid) {
        outliner.formatSelection(formatType, extra);
        return true;
      }
      return false;
    }

    // 判断用户是否正在输入框中键入
    isUserTyping() {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
    }

    // 切换节点高亮颜色 (Toggle 逻辑与深度清理)
    toggleNodeHighlight(node, colorKey) {
      if (!node) return;
      const curColor = node.getData('highlightColor');
      const isClearing = (!colorKey || colorKey === 'none' || curColor === colorKey);
      const targetColor = isClearing ? null : colorKey;

      const nodeData = node.getData() || {};
      let text = nodeData.text || '';

      if (!targetColor && text) {
        text = text.replace(/<span class="mm-(?:text|inline)-hl-[a-z]+">([\s\S]+?)<\/span>/gi, '$1')
                   .replace(/<mark class="[^"]*">([\s\S]+?)<\/mark>/gi, '$1');
      }

      if (node.nodeData && node.nodeData.data) {
        if (targetColor) {
          node.nodeData.data.highlightColor = targetColor;
        } else {
          delete node.nodeData.data.highlightColor;
        }
      }

      const nodeUid = node.getData('uid');
      this.mindMap.execCommand('SET_NODE_DATA', node, {
        highlightColor: targetColor,
        text: text
      });
      this.mindMap.render(() => {
        if (this.mindMap.renderer && nodeUid) {
          const freshNode = this.mindMap.renderer.findNodeByUid(nodeUid);
          if (freshNode) {
            this.mindMap.renderer.clearActiveNodeList();
            this.mindMap.renderer.addNodeToActiveList(freshNode);
          }
        }
      });
    }

    // 切换节点样式 (粗体/斜体/下划线)
    toggleNodeStyle(node, key, value) {
      if (!node) return;
      const cur = node.getData(key);
      const target = (cur === value) ? '' : value;
      this.mindMap.execCommand('SET_NODE_DATA', node, { [key]: target });
      this.mindMap.render();
    }

    // 创建节点副本 (Ctrl + D)
    duplicateNode(node) {
      if (!node || node.isRoot) return;
      const parent = node.parent;
      if (!parent || !parent.nodeData || !Array.isArray(parent.nodeData.children)) return;

      const cloned = safeCloneNodeData(node.nodeData);
      const index = parent.nodeData.children.findIndex(child => child.data && child.data.uid === node.getData('uid'));
      if (index !== -1) {
        parent.nodeData.children.splice(index + 1, 0, cloned);
        this.mindMap.render(() => {
          const newNode = this.mindMap.renderer.findNodeByUid(cloned.data.uid);
          if (newNode) {
            this.mindMap.renderer.clearActiveNodeList();
            this.mindMap.renderer.addNodeToActiveList(newNode);
          }
        });
      }
    }

    // 进入当前节点聚焦钻取 (Ctrl + ])
    drillDown(node) {
      if (!node || node.isRoot) return;
      const currentFullTree = this.mindMap.getData(false);
      const nodeText = (node.getData('text') || '聚焦节点').replace(/<[^>]+>/g, '').trim();

      this.drillStack.push({
        fullTree: JSON.parse(JSON.stringify(currentFullTree)),
        targetUid: node.getData('uid'),
        title: nodeText
      });

      const subtree = safeCloneNodeData(node.nodeData);
      // 钻取进入子树后默认展开该根节点
      if (subtree && subtree.data) {
        subtree.data.expand = true;
      }
      this.mindMap.setData(subtree);
      this.mindMap.view.reset();

      this.updateBreadcrumb();
    }

    // 返回上一级节点 (Ctrl + [)
    drillUp() {
      if (this.drillStack.length === 0) return;
      const prev = this.drillStack.pop();
      this.mindMap.setData(prev.fullTree);
      this.mindMap.view.reset();

      this.updateBreadcrumb();
      setTimeout(() => {
        const targetNode = this.mindMap.renderer.findNodeByUid(prev.targetUid);
        if (targetNode) {
          this.mindMap.renderer.clearActiveNodeList();
          this.mindMap.renderer.addNodeToActiveList(targetNode);
        }
      }, 50);
    }

    // 更新面包屑指示器
    updateBreadcrumb() {
      if (!this.breadcrumbEl) return;
      if (this.drillStack.length === 0) {
        this.breadcrumbEl.style.display = 'none';
        this.breadcrumbEl.innerHTML = '';
        return;
      }

      this.breadcrumbEl.style.display = 'inline-flex';
      const items = ['<span style="cursor: pointer; color: #3370ff;" class="breadcrumb-root">全部导图</span>'];
      this.drillStack.forEach((entry) => {
        items.push('<span>/</span>');
        items.push(`<span style="font-weight: 500; color: #1f2329;">${entry.title}</span>`);
      });

      this.breadcrumbEl.innerHTML = items.join('');
      const rootBtn = this.breadcrumbEl.querySelector('.breadcrumb-root');
      if (rootBtn) {
        rootBtn.onclick = () => {
          while (this.drillStack.length > 1) {
            this.drillStack.pop();
          }
          this.drillUp();
        };
      }
    }

    // 按指定层级展开导图 (实现“一览全局”与三柱同频展开能力)
    expandToLevel(level = 1) {
      if (level >= 3) {
        this.expandAll();
        return;
      }
      const treeData = this.mindMap.getData(false);
      if (treeData) {
        const walk = (node, depth, branchType) => {
          if (!node) return;
          if (!node.data) node.data = {};
          const uid = node.data.uid || '';

          let curBranch = branchType;
          if (uid === 'branch_knowledge' || uid.startsWith('sec_')) curBranch = 'knowledge';
          else if (uid === 'branch_exam_points' || uid.startsWith('kp_')) curBranch = 'exam';
          else if (uid === 'branch_methods' || uid.startsWith('m_')) curBranch = 'method';

          if (depth === 0 || depth === 1) {
            node.data.expand = true;
          } else if (curBranch === 'knowledge') {
            // 知识点体系：含有 §1/§2/§3 章节中间层 (depth 2)
            // level 1: 展开至 1.1~3.3 知识点卡片，1.1~3.3 内部公式定理折叠
            // level 2: 展开 1.1~3.3 内部公式定理卡片
            if (depth === 2) {
              node.data.expand = true; // §1, §2, §3 展开
            } else if (depth === 3) {
              node.data.expand = (level >= 2); // 1.1~3.3 在 level 1 下折叠子项，在 level 2 下展开
            } else {
              node.data.expand = (level >= 3);
            }
          } else {
            // 考点与解法体系：无章节中间层，depth 2 即为具体考点与招法
            // level 1: 具体考点/招法展示，折叠其下属题源真题与解题步骤
            // level 2: 展开具体考点下属的真题题源与招法下属的步骤避坑
            if (depth === 2) {
              node.data.expand = (level >= 2);
            } else {
              node.data.expand = (level >= 3);
            }
          }

          if (Array.isArray(node.children)) {
            node.children.forEach(c => walk(c, depth + 1, curBranch));
          }
        };

        walk(treeData, 0, null);
        this.mindMap.setData(treeData);
        this.mindMap.render();
      }

      const outliner = this.options.outliner || window._outlinerInstance;
      if (outliner && typeof outliner.expandToLevel === 'function') {
        outliner.expandToLevel(level);
      }
      if (typeof this.options.onLevelChange === 'function') {
        this.options.onLevelChange(level);
      }
    }

    // 定向全量展开特定分类（知识点 / 考点 / 解法招法），其余分类保持 2 级概览态
    expandCategory(targetCategory) {
      const isTargetNode = (childData) => {
        if (!childData || !childData.data) return false;
        const d = childData.data;
        const cat = d.category || '';
        const uid = d.uid || '';
        const text = d.text || '';
        if (targetCategory === 'knowledge') {
          return cat === 'knowledge' || uid === 'branch_knowledge' || uid.startsWith('sec_') || text.includes('知识') || text.startsWith('§');
        }
        if (targetCategory === 'exam') {
          return cat === 'exam' || uid === 'branch_exam_points' || uid.includes('exam') || text.includes('考点');
        }
        if (targetCategory === 'method') {
          return cat === 'method' || uid === 'branch_methods' || uid === 'branch_solution_methods' || uid.includes('method') || text.includes('解法') || text.includes('招法');
        }
        return false;
      };

      const setSubtreeExpand = (node, expandState) => {
        if (!node) return;
        if (!node.data) node.data = {};
        node.data.expand = expandState;
        if (Array.isArray(node.children)) {
          node.children.forEach(child => setSubtreeExpand(child, expandState));
        }
      };

      const treeData = this.mindMap.getData(false);
      if (!treeData) return;

      if (!treeData.data) treeData.data = {};
      treeData.data.expand = true;

      if (Array.isArray(treeData.children)) {
        treeData.children.forEach(c2 => {
          if (!c2.data) c2.data = {};
          const isTarget = isTargetNode(c2);
          if (isTarget) {
            // 目标分类：递归全量展开到底（各节、定理、公式、招法细节全部展开）
            setSubtreeExpand(c2, true);
          } else {
            // 非目标分类：保持第 3 级概览态（主分支自身展开，但其下直接子节点收纳折叠）
            c2.data.expand = true;
            if (Array.isArray(c2.children)) {
              c2.children.forEach(child => setSubtreeExpand(child, false));
            }
          }
        });
      }

      this.mindMap.setData(treeData);
      this.mindMap.render();

      const outliner = this.options.outliner || window._outlinerInstance;
      if (outliner && typeof outliner.setData === 'function') {
        outliner.setData(treeData);
        if (typeof outliner.render === 'function') outliner.render();
      }
      if (typeof this.options.onLevelChange === 'function') {
        this.options.onLevelChange(99);
      }
    }

    // 全部折叠 / 展开
    toggleExpandAll() {
      let hasUnexpanded = false;
      const walk = (node) => {
        if (node.getData && node.getData('expand') === false) {
          hasUnexpanded = true;
          return;
        }
        if (node.children) node.children.forEach(walk);
      };
      if (this.mindMap.renderer && this.mindMap.renderer.root) {
        walk(this.mindMap.renderer.root);
      }

      if (hasUnexpanded) {
        this.expandAll();
      } else {
        this.collapseAll();
      }
    }

    // 全部展开
    expandAll() {
      if (typeof this.mindMap.execCommand === 'function') {
        this.mindMap.execCommand('EXPAND_ALL');
      }
      const outliner = this.options.outliner || window._outlinerInstance;
      if (outliner && typeof outliner.expandAll === 'function') {
        outliner.expandAll();
      }
      if (typeof this.options.onLevelChange === 'function') {
        this.options.onLevelChange(99);
      }
    }

    // 全部折叠
    collapseAll() {
      if (typeof this.mindMap.execCommand === 'function') {
        this.mindMap.execCommand('UNEXPAND_ALL');
      }
      const outliner = this.options.outliner || window._outlinerInstance;
      if (outliner && typeof outliner.collapseAll === 'function') {
        outliner.collapseAll();
      }
      if (typeof this.options.onLevelChange === 'function') {
        this.options.onLevelChange(1);
      }
    }
  }

  // 静态暴露辅助方法供工具条调用
  MindMapShortcutManager.duplicateActiveNode = function (mindMap) {
    const activeList = (mindMap.renderer && mindMap.renderer.activeNodeList) || [];
    if (activeList.length === 1 && global._mindMapShortcutManagerInstance) {
      global._mindMapShortcutManagerInstance.duplicateNode(activeList[0]);
    }
  };

  MindMapShortcutManager.drillDown = function (mindMap) {
    const activeList = (mindMap.renderer && mindMap.renderer.activeNodeList) || [];
    if (activeList.length === 1 && global._mindMapShortcutManagerInstance) {
      global._mindMapShortcutManagerInstance.drillDown(activeList[0]);
    }
  };

  global.MindMapShortcutManager = MindMapShortcutManager;
})(typeof window !== 'undefined' ? window : this);
