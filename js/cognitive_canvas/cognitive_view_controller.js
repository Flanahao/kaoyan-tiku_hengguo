/**
 * 考研数学认知视图 · 顶层协调器 (CognitiveViewController)
 * 职责：
 * 1. 管理全屏独立认知画布工作台 (#cognitiveModal)，作为宿主调用思维导图工具集 (MindMap* Toolkit)；
 * 2. 调度 SimpleMindMap 实例，采用双向发散布局 (layout: 'mindMap')，挂载第1章紧凑树状节点数据；
 * 3. 实现“一屏一览全局 + 渐进展开详情”层级控制 (expandToLevel(2) 一览全局 / expandAll() 展开全部子项)；
 * 4. 驱动 Focus Resonance 跨分支拓扑共鸣高亮与平滑贝塞尔曲线绘制，以及 MathViz 按需几何图解浮层；
 * 5. 严格双向键盘流隔离 (O 键呼出/关闭，Esc 键分层级回退直至退出，杜绝后台题库快捷键串扰，无返回按钮)。
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CognitiveViewController = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var mindMapInstance = null;
  var isModalOpen = false;
  var activeResonanceUid = null;
  var activeLinesLayer = null;
  var isAssociativeLineVisible = true;
  var pendingFitOnRender = false;
  var currentActiveSubject = 'math';

  // 思维导图工具集实例引用
  var dragEnhancer = null;
  var nodeEditor = null;
  var outliner = null;
  var dualViewController = null;
  var shortcutDrawer = null;
  var bottomToolbar = null;
  var structureController = null;
  var shortcutManager = null;

  function checkIsActive() {
    return Boolean(isModalOpen);
  }

  // 二级节点语义分类与左右双翼干预：同一类的二级节点必须严格聚拢
  function classifyNodeDir(nodeItem) {
    var d = (nodeItem && nodeItem.data) ? nodeItem.data : (nodeItem || {});
    if (d.dir === 'left' || d.dir === 'right') return d.dir;
    var text = d.text || '';
    var uid = d.uid || '';
    var cat = d.category || '';
    // 最终笔记知识体系 (branch_knowledge, §1 函数, §2 极限, §3 连续) 严格归拢在导图左翼
    if (cat === 'knowledge' || uid === 'branch_knowledge' || uid.indexOf('sec_') === 0 || text.indexOf('§') === 0 || text.indexOf('知识') !== -1) {
      if (text.indexOf('考点') === -1 && text.indexOf('招法') === -1 && text.indexOf('解法') === -1) {
        return 'left';
      }
    }
    // 考点体系与招法解法体系严格归拢在导图右翼
    return 'right';
  }

  function applySemanticClustering(tree) {
    if (!tree || !Array.isArray(tree.children) || tree.children.length === 0) return;
    if (tree.data && tree.data.customClustering) return;
    tree.children.forEach(function (child) {
      if (!child.data) child.data = {};
      child.data.dir = classifyNodeDir(child);
    });

    var getCategoryRank = function (child) {
      var d = child.data || {};
      var uid = d.uid || '';
      var text = d.text || '';
      if (uid === 'branch_exam_points' || text.indexOf('考点') !== -1) return 1;
      if (uid === 'branch_methods' || uid === 'branch_solution_methods' || text.indexOf('解法') !== -1 || text.indexOf('招法') !== -1) return 2;
      if (uid === 'branch_knowledge' || text.indexOf('知识') !== -1) return 10;
      if (uid === 'sec_1_func' || uid === 'sec_func_properties' || text.indexOf('§1') !== -1) return 11;
      if (uid === 'sec_2_limit' || uid === 'sec_limit_theory' || text.indexOf('§2') !== -1) return 12;
      if (uid === 'sec_3_cont' || uid === 'sec_continuity' || text.indexOf('§3') !== -1) return 13;
      return 20;
    };

    tree.children.sort(function (a, b) {
      return getCategoryRank(a) - getCategoryRank(b);
    });
  }

  function getCustomNodesRbox() {
    var cards = document.querySelectorAll('#cognitiveMindMapContainer .smm-node .mm-node-card');
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    var count = 0;
    for (var i = 0; i < cards.length; i++) {
      var r = cards[i].getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.left > -10000 && r.top > -10000) {
        if (r.left < minX) minX = r.left;
        if (r.top < minY) minY = r.top;
        if (r.right > maxX) maxX = r.right;
        if (r.bottom > maxY) maxY = r.bottom;
        count++;
      }
    }
    if (count === 0) return null;
    // 预留顶部悬浮栏与底部工具栏的安全边距
    return {
      x: minX,
      y: minY - 18,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, (maxY - minY) + 36)
    };
  }

  function fitCanvasToViewport(padding) {
    if (!mindMapInstance || !mindMapInstance.view) return;
    var pad = typeof padding === 'number' ? padding : 48;
    mindMapInstance.view.fit(getCustomNodesRbox, false, pad);
    if (structureController) structureController.updateZoomDisplay();
  }

  function scheduleFitView(padding) {
    pendingFitOnRender = true;
    setTimeout(function () {
      fitCanvasToViewport(padding);
    }, 320);
  }

  function initTheme() {
    var MindMap = (window.simpleMindMap && (window.simpleMindMap.default || window.simpleMindMap)) || window.MindMap;
    if (!MindMap || typeof MindMap.defineTheme !== 'function') return;

    // 注册认知视图专属紧凑现代主题（减小节点间距以支撑“一屏一览全局”）
    MindMap.defineTheme('cognitive_modern', {
      backgroundColor: '#f8f9fa',
      lineColor: '#3370ff',
      lineWidth: 1.8,
      lineStyle: 'straight',
      lineRadius: 8,
      nodeUseLineStyle: false,
      showLineMarker: false,
      associativeLineWidth: 1.6,
      associativeLineColor: 'rgba(51, 112, 255, 0.45)',
      associativeLineActiveWidth: 2.2,
      associativeLineActiveColor: '#3370ff',
      associativeLineTextColor: 'transparent',
      associativeLineTextFontSize: 0,
      associativeLineDasharray: '',
      root: {
        shape: 'rectangle',
        fillColor: '#3370ff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '600',
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 8,
        paddingX: 18,
        paddingY: 10
      },
      second: {
        shape: 'rectangle',
        marginX: 46,
        marginY: 12,
        fillColor: '#eff0f1',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
        color: '#1f2329',
        fontSize: 13,
        fontWeight: '600',
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 6,
        hoverRectColor: '#3370ff',
        paddingX: 12,
        paddingY: 6
      },
      node: {
        shape: 'rectangle',
        marginX: 32,
        marginY: 7,
        fillColor: 'transparent',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
        color: '#1f2329',
        fontSize: 12,
        fontWeight: 'normal',
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 4,
        hoverRectColor: '#3370ff',
        paddingX: 6,
        paddingY: 3
      }
    });
  }

  function handleNodeActionClick(action, uid, nodeData, pillEl) {
    var modal = document.getElementById('cognitiveModal');
    if (action === 'questions') {
      jumpToExamPointQuestions(uid);
    } else if (action === 'resonance') {
      if (activeResonanceUid === uid) {
        clearFocusResonance();
      } else {
        applyFocusResonanceByUid(uid);
      }
    } else if (action === 'widget') {
      if (window.MathVizWidget && typeof window.MathVizWidget.openPopover === 'function') {
        window.MathVizWidget.openPopover(
          nodeData.widgetType || 'discontinuity_trio',
          nodeData.widgetTitle || nodeData.text || '几何图解',
          pillEl,
          modal
        );
      }
    }
  }

  function updateLevelButtonsUI(level) {
    var btnOverview = document.getElementById('btnCognLevelOverview');
    var btnExpandAll = document.getElementById('btnCognExpandAll');
    if (btnOverview) {
      btnOverview.classList.toggle('active', level <= 2);
    }
    if (btnExpandAll) {
      btnExpandAll.classList.toggle('active', level > 2);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SimpleMindMap 原生关联线系统深度优化：多端口解耦、立体外扩立交桥分流与点击穿透
  // 彻底杜绝连线汇聚单点重叠、悬空穿模与点击产生水平控制线圆圈手柄
  // ─────────────────────────────────────────────────────────────
  function installAssociativeLineEnhancer(AssociativeLineProto) {
    if (!AssociativeLineProto || AssociativeLineProto._hasCognitiveEnhancement) return;
    AssociativeLineProto._hasCognitiveEnhancement = true;

    AssociativeLineProto.onNodeClick = function () {
      if (this.isCreatingLine) return;
      this.clearActiveLine();
    };

    AssociativeLineProto.removeAllLines = function () {
      (this.lineList || []).forEach(function (line) {
        if (line[0] && typeof line[0].remove === 'function') line[0].remove();
        if (line[1] && typeof line[1].remove === 'function') line[1].remove();
        if (line[2] && typeof line[2].remove === 'function') line[2].remove();
      });
      this.lineList = [];
    };

    AssociativeLineProto.renderAllLines = function () {
      if (this.isNotRenderAllLines) {
        this.isNotRenderAllLines = false;
        return;
      }
      this.removeAllLines();
      this.removeControls();
      this.clearActiveLine();

      var tree = this.mindMap.renderer.root;
      if (!tree) return;

      var idToNode = new Map();
      var rawEdges = [];

      var walk = function (cur) {
        if (!cur) return;
        var data = cur.getData();
        if (data && data.uid) {
          idToNode.set(data.uid, cur);
        }
        var targets = (data && (data.associativeLineTargets || data.resonanceLinks)) || [];
        if (Array.isArray(targets) && targets.length > 0) {
          targets.forEach(function (toUid) {
            rawEdges.push({
              fromNode: cur,
              fromUid: data.uid,
              toUid: toUid
            });
          });
        }
        if (Array.isArray(cur.children)) {
          cur.children.forEach(walk);
        }
      };
      walk(tree);

      var validEdges = [];
      var seenUndirectedPairs = new Set();
      rawEdges.forEach(function (e) {
        if (!e.fromUid || !e.toUid || e.fromUid === e.toUid) return;
        var toNode = idToNode.get(e.toUid);
        if (toNode && e.fromNode) {
          var pairKey = e.fromUid < e.toUid
            ? (e.fromUid + '<->' + e.toUid)
            : (e.toUid + '<->' + e.fromUid);
          if (seenUndirectedPairs.has(pairKey)) return;
          seenUndirectedPairs.add(pairKey);
          validEdges.push({
            fromNode: e.fromNode,
            toNode: toNode,
            fromUid: e.fromUid,
            toUid: e.toUid,
            pairKey: pairKey
          });
        }
      });

      if (validEdges.length === 0) return;

      var rootCenterX = tree.left + tree.width / 2;
      var rootCenterY = tree.top + tree.height / 2;

      // 计算中央核心禁区（覆盖中央根节点与紧邻的一级知识主干节点），防止跨翼连线横穿中央根节点
      var branchKnowledgeNode = idToNode.get('branch_knowledge');
      var centralLeft = (branchKnowledgeNode ? Math.min(tree.left, branchKnowledgeNode.left) : tree.left) - 18;
      var centralRight = tree.left + tree.width + 22;
      var centralTop = (branchKnowledgeNode ? Math.min(tree.top, branchKnowledgeNode.top) : tree.top) - 22;
      var centralBottom = (branchKnowledgeNode
        ? Math.max(tree.top + tree.height, branchKnowledgeNode.top + branchKnowledgeNode.height)
        : (tree.top + tree.height)) + 22;

      // 1. 多端口锚点分配 (Multi-Port Anchor Distribution)
      var nodePortsMap = new Map();
      validEdges.forEach(function (edge) {
        var fromN = edge.fromNode;
        var toN = edge.toNode;
        if (!nodePortsMap.has(fromN)) nodePortsMap.set(fromN, []);
        if (!nodePortsMap.has(toN)) nodePortsMap.set(toN, []);

        nodePortsMap.get(fromN).push({
          edge: edge,
          isFrom: true,
          otherY: toN.top + toN.height / 2
        });
        nodePortsMap.get(toN).push({
          edge: edge,
          isFrom: false,
          otherY: fromN.top + fromN.height / 2
        });
      });

      var portOffsetMap = new Map();
      nodePortsMap.forEach(function (portList, node) {
        portList.sort(function (a, b) { return a.otherY - b.otherY; });
        var total = portList.length;
        var maxOffset = Math.min(12, Math.max(4, (node.height * 0.4) / Math.max(1, total)));
        portList.forEach(function (p, idx) {
          var offset = total === 1 ? 0 : ((idx - (total - 1) / 2) * maxOffset);
          var key = p.edge.fromUid + '->' + p.edge.toUid + ':' + (p.isFrom ? 'from' : 'to');
          portOffsetMap.set(key, offset);
        });
      });

      // 2. 预计算每条边的端点与分类（右翼同侧 / 左翼同侧 / 跨翼上方走廊 / 跨翼下方走廊）以分配无冲突立交车道
      var rightWingEdges = [];
      var leftWingEdges = [];
      var crossUpperEdges = [];
      var crossLowerEdges = [];

      validEdges.forEach(function (edge) {
        var fromNode = edge.fromNode;
        var toNode = edge.toNode;
        var fromUid = edge.fromUid;
        var toUid = edge.toUid;

        var fromCenterX = fromNode.left + fromNode.width / 2;
        var toCenterX = toNode.left + toNode.width / 2;
        var fromIsLeft = fromCenterX < rootCenterX;
        var toIsLeft = toCenterX < rootCenterX;

        var fromOffset = portOffsetMap.get(fromUid + '->' + toUid + ':from') || 0;
        var toOffset = portOffsetMap.get(fromUid + '->' + toUid + ':to') || 0;

        edge.startY = fromNode.top + fromNode.height / 2 + fromOffset;
        edge.endY = toNode.top + toNode.height / 2 + toOffset;
        edge.fromIsLeft = fromIsLeft;
        edge.toIsLeft = toIsLeft;
        edge.dy = Math.abs(edge.startY - edge.endY);
        edge.midY = (edge.startY + edge.endY) / 2;

        if (!fromIsLeft && !toIsLeft) {
          rightWingEdges.push(edge);
        } else if (fromIsLeft && toIsLeft) {
          leftWingEdges.push(edge);
        } else {
          if (edge.midY <= rootCenterY) {
            crossUpperEdges.push(edge);
          } else {
            crossLowerEdges.push(edge);
          }
        }
      });

      // 同翼边按纵向跨度从小到大排序：短跨度在内侧、长跨度在外侧，减少交叉
      rightWingEdges.sort(function (a, b) { return a.dy - b.dy; });
      rightWingEdges.forEach(function (e, idx) { e.wingRank = idx; });

      leftWingEdges.sort(function (a, b) { return a.dy - b.dy; });
      leftWingEdges.forEach(function (e, idx) { e.wingRank = idx; });

      // 跨翼上方走廊：平均高度越靠近根节点中心，分配越靠近内侧的走廊车道
      crossUpperEdges.sort(function (a, b) { return b.midY - a.midY; });
      crossUpperEdges.forEach(function (e, idx) { e.corridorRank = idx; e.passAbove = true; });

      // 跨翼下方走廊：平均高度越靠近根节点中心，分配越靠近内侧的走廊车道
      crossLowerEdges.sort(function (a, b) { return a.midY - b.midY; });
      crossLowerEdges.forEach(function (e, idx) { e.corridorRank = idx; e.passAbove = false; });

      var self = this;

      validEdges.forEach(function (edge) {
        var fromNode = edge.fromNode;
        var toNode = edge.toNode;
        var fromUid = edge.fromUid;
        var toUid = edge.toUid;
        var fromIsLeft = edge.fromIsLeft;
        var toIsLeft = edge.toIsLeft;

        var startX, startY, endX, endY, cx1, cy1, cx2, cy2;

        startY = edge.startY;
        endY = edge.endY;

        if (!fromIsLeft && !toIsLeft) {
          // 同在右翼（例如考点 kp -> 招法 m）：从卡片左边框连接，向左侧走廊紧凑外扩，且绝不侵入中央根节点
          startX = fromNode.left;
          endX = toNode.left;
          var rankR = edge.wingRank || 0;
          var laneWidth = Math.min(110, Math.max(24, edge.dy * 0.14) + rankR * 8);
          var minAllowedCx = centralRight + 14;
          cx1 = Math.max(minAllowedCx, Math.min(startX, endX) - laneWidth);
          cy1 = startY;
          cx2 = cx1;
          cy2 = endY;
        } else if (fromIsLeft && toIsLeft) {
          // 同在左翼：从卡片右边框连接，向右侧走廊紧凑外扩，且绝不侵入中央禁区
          startX = fromNode.left + fromNode.width;
          endX = toNode.left + toNode.width;
          var rankL = edge.wingRank || 0;
          var laneWidthLeft = Math.min(110, Math.max(24, edge.dy * 0.14) + rankL * 8);
          var maxAllowedCx = centralLeft - 14;
          cx1 = Math.min(maxAllowedCx, Math.max(startX, endX) + laneWidthLeft);
          cy1 = startY;
          cx2 = cx1;
          cy2 = endY;
        } else {
          // 跨翼连接 (左翼 <-> 右翼)：绕行中央根节点上/下方立交走廊
          if (!fromIsLeft && toIsLeft) {
            startX = fromNode.left;
            endX = toNode.left + toNode.width;
          } else {
            startX = fromNode.left + fromNode.width;
            endX = toNode.left;
          }

          var spanX = endX - startX;
          cx1 = startX + spanX * 0.38;
          cx2 = startX + spanX * 0.62;
          cy1 = startY;
          cy2 = endY;

          var cRank = edge.corridorRank || 0;
          var laneGap = 12;

          if (edge.passAbove) {
            var targetTop = centralTop - cRank * laneGap;
            var requiredControlY = Infinity;
            var hitsCentralX = false;
            for (var step = 1; step < 20; step++) {
              var t = step / 20;
              var mt = 1 - t;
              var xt = mt * mt * mt * startX + 3 * mt * mt * t * cx1 + 3 * mt * t * t * cx2 + t * t * t * endX;
              if (xt >= centralLeft && xt <= centralRight) {
                hitsCentralX = true;
                var baseYt = mt * mt * mt * startY + t * t * t * endY;
                var wt = 3 * mt * t;
                var boundY = (targetTop - baseYt) / wt;
                if (boundY < requiredControlY) {
                  requiredControlY = boundY;
                }
              }
            }
            if (hitsCentralX && isFinite(requiredControlY)) {
              var naturalCy = (startY + endY) / 2;
              if (requiredControlY < naturalCy) {
                cy1 = requiredControlY;
                cy2 = requiredControlY;
              }
            }
          } else {
            var targetBottom = centralBottom + cRank * laneGap;
            var requiredControlYBottom = -Infinity;
            var hitsCentralXBottom = false;
            for (var stepB = 1; stepB < 20; stepB++) {
              var tB = stepB / 20;
              var mtB = 1 - tB;
              var xtB = mtB * mtB * mtB * startX + 3 * mtB * mtB * tB * cx1 + 3 * mtB * tB * tB * cx2 + tB * tB * tB * endX;
              if (xtB >= centralLeft && xtB <= centralRight) {
                hitsCentralXBottom = true;
                var baseYtB = mtB * mtB * mtB * startY + tB * tB * tB * endY;
                var wtB = 3 * mtB * tB;
                var boundYB = (targetBottom - baseYtB) / wtB;
                if (boundYB > requiredControlYBottom) {
                  requiredControlYBottom = boundYB;
                }
              }
            }
            if (hitsCentralXBottom && isFinite(requiredControlYBottom)) {
              var naturalCyB = (startY + endY) / 2;
              if (requiredControlYBottom > naturalCyB) {
                cy1 = requiredControlYBottom;
                cy2 = requiredControlYBottom;
              }
            }
          }
        }

        var pathStr = 'M ' + startX.toFixed(1) + ' ' + startY.toFixed(1) +
                      ' C ' + cx1.toFixed(1) + ' ' + cy1.toFixed(1) + ', ' +
                      cx2.toFixed(1) + ' ' + cy2.toFixed(1) + ', ' +
                      endX.toFixed(1) + ' ' + endY.toFixed(1);

        // 真实可视线条 (实线无箭头、微带圆角)
        var path = self.associativeLineDraw.path();
        path.plot(pathStr);
        path.stroke({
          width: 1.6,
          color: '#3370ff'
        }).fill({
          color: 'none'
        });
        if (path.node) {
          path.node.setAttribute('class', 'smm-associative-line-path');
          path.node.setAttribute('data-from-uid', fromUid);
          path.node.setAttribute('data-to-uid', toUid);
          path.node.style.strokeDasharray = 'none';
        }

        // 宽截面点击感应区 (16px 点击判定区，无形有质，点击触发共鸣聚焦)
        var clickPath = self.associativeLineDraw.path();
        clickPath.plot(pathStr);
        clickPath.stroke({
          width: 16,
          color: 'transparent'
        }).fill({
          color: 'none'
        });
        if (clickPath.node) {
          clickPath.node.setAttribute('class', 'smm-associative-line-click-path');
          clickPath.node.setAttribute('data-from-uid', fromUid);
          clickPath.node.setAttribute('data-to-uid', toUid);
          clickPath.node.style.cursor = 'pointer';
        }

        // 点击连线本身唤醒聚焦共鸣
        clickPath.click(function (e) {
          if (e && e.stopPropagation) e.stopPropagation();
          applyFocusResonanceByUid(fromUid);
        });

        // 创建占位文字对象，具备完整的 remove/hide/show 方法，防止 SimpleMindMap 抛错
        var dummyText = self.associativeLineDraw.plain ? self.associativeLineDraw.plain('') : null;
        if (!dummyText) {
          dummyText = {
            remove: function () {},
            hide: function () {},
            show: function () {},
            clear: function () {}
          };
        } else if (dummyText.hide) {
          dummyText.hide();
        }

        self.lineList.push([path, clickPath, dummyText, fromNode, toNode]);
      });

      syncAssociativeLinesState();
    };
  }

  function initMindMap() {
    if (mindMapInstance) return;

    var MindMap = (window.simpleMindMap && (window.simpleMindMap.default || window.simpleMindMap)) || window.MindMap;
    if (!MindMap) {
      console.error('[CognitiveViewController] 找不到 SimpleMindMap 构造函数');
      return;
    }

    initTheme();

    var modal = document.getElementById('cognitiveModal');
    var container = document.getElementById('cognitiveMindMapContainer');
    var outlinerContainer = document.getElementById('cognitiveOutlinerContainer');
    if (!container || !modal) return;

    var isEnglish = (currentActiveSubject === 'english' || window.curSubjectId === 'english' || (window.curSubject && window.curSubject.type === 'english'));
    var targetSource = (isEnglish && window.TangJingTranslationMindMapData)
      ? window.TangJingTranslationMindMapData
      : window.Chapter1MindMapData;

    var MindMap = (window.simpleMindMap && (window.simpleMindMap.default || window.simpleMindMap)) || window.MindMap;
    if (MindMap && Array.isArray(MindMap.pluginList)) {
      var layoutPlugin = MindMap.pluginList.find(function (p) {
        return p.instanceName === 'mindMapLayoutPro' || p.name === 'MindMapLayoutPro';
      });
      if (layoutPlugin && layoutPlugin.prototype) {
        layoutPlugin.prototype.updateNodeTree = function (tree) {
          if (!this.isMindMapLayout()) return;
          applySemanticClustering(tree);
        };
      }
      var assocPlugin = MindMap.pluginList.find(function (p) {
        return p.instanceName === 'associativeLine' || p.name === 'AssociativeLine';
      });
      if (assocPlugin && assocPlugin.prototype) {
        installAssociativeLineEnhancer(assocPlugin.prototype);
      }
    }

    var initialData = targetSource
      ? JSON.parse(JSON.stringify(targetSource))
      : { data: { text: "思维导图", uid: "root_default", expand: true }, children: [] };
    applySemanticClustering(initialData);

    mindMapInstance = new MindMap({
      el: container,
      data: initialData,
      layout: 'mindMap', // 双向平衡发散布局（左：最终笔记知识底座，右：核心考点与解法招法）
      theme: 'cognitive_modern',
      enableFreeDrag: false,
      autoMoveWhenMouseInEdgeOnDrag: true,
      useLeftKeySelectionRightKeyDrag: true, // 空白处左键框选，右键拖拽平移画布
      mousewheelAction: 'zoom', // 鼠标滚轮直接缩放画布，平滑丝滑
      mouseScaleCenterUseMousePosition: true, // 缩放锚点严格采用鼠标光标当前位置
      defaultAssociativeLineText: '', // 原生关联线不呈现多余的文字标签
      enableAdjustAssociativeLinePoints: false, // 彻底禁用关联线控制棒与调整点，防止点击产生水平线与圆圈手柄
      dragPlaceholderLineConfig: {
        color: '#3370ff',
        width: 2.5
      },
      dragPlaceholderRectFill: 'rgba(51, 112, 255, 0.15)',
      isUseCustomNodeContent: true,
      customCreateNodeContent: function (node) {
        if (window.MindMapNodeRenderer) {
          return window.MindMapNodeRenderer.render(node, {
            onActionClick: handleNodeActionClick
          });
        }
        return null;
      }
    });

    // 监听原生缩放事件，同步更新底栏比例显示
    mindMapInstance.on('scale', function (scale) {
      if (structureController && typeof structureController.updateZoomDisplay === 'function') {
        structureController.updateZoomDisplay(scale);
      }
    });

    // 确保双向布局下同一类的二级节点严格聚拢在一起（左侧为 §1/§2/§3 知识点，右侧为核心考点与解法流程）
    if (mindMapInstance.mindMapLayoutPro) {
      mindMapInstance.mindMapLayoutPro.restore();
      mindMapInstance.mindMapLayoutPro.updateNodeTree = function (tree) {
        if (!this.isMindMapLayout()) return;
        applySemanticClustering(tree);
      };
      mindMapInstance.mindMapLayoutPro.updateNodeTree = mindMapInstance.mindMapLayoutPro.updateNodeTree.bind(mindMapInstance.mindMapLayoutPro);
      mindMapInstance.on('layout_change', mindMapInstance.mindMapLayoutPro.layoutChange);
      mindMapInstance.on('afterExecCommand', mindMapInstance.mindMapLayoutPro.afterExecCommand);
      mindMapInstance.on('before_update_data', mindMapInstance.mindMapLayoutPro.updateNodeTree);
      mindMapInstance.on('before_set_data', mindMapInstance.mindMapLayoutPro.updateNodeTree);

      applySemanticClustering(mindMapInstance.getData(false));
      mindMapInstance.mindMapLayoutPro.updateRenderTree();
      mindMapInstance.render();
    }

    // 挂载思维导图组件库依赖 (全部限制在 #cognitiveModal 作用域并绑定激活检查)
    if (window.MindMapDragEnhancer) {
      dragEnhancer = new window.MindMapDragEnhancer(mindMapInstance);
    }

    if (window.MindMapNodeEditor) {
      nodeEditor = new window.MindMapNodeEditor(mindMapInstance, {
        container: modal,
        isActiveCheck: checkIsActive
      });
    }

    if (window.MindMapOutliner && outlinerContainer) {
      outliner = new window.MindMapOutliner(outlinerContainer, {
        mountContainer: modal,
        isActiveCheck: checkIsActive
      });
    }

    if (window.DualViewController && outliner) {
      dualViewController = new window.DualViewController(mindMapInstance, outliner, {
        defaultView: 'mindmap',
        container: modal,
        mindMapContainer: container,
        outlinerContainer: outlinerContainer,
        isActiveCheck: checkIsActive,
        mountSwitcher: true
      });
    }

    if (window.MindMapShortcutDrawer) {
      shortcutDrawer = new window.MindMapShortcutDrawer({
        container: modal,
        isActiveCheck: checkIsActive
      });
    }

    if (window.MindMapBottomToolbar) {
      bottomToolbar = new window.MindMapBottomToolbar(mindMapInstance, {
        container: modal,
        shortcutDrawer: shortcutDrawer
      });
    }

    if (window.MindMapShortcutManager) {
      shortcutManager = new window.MindMapShortcutManager(mindMapInstance, {
        container: modal,
        isActiveCheck: checkIsActive,
        shortcutDrawer: shortcutDrawer,
        outliner: outliner,
        onLevelChange: function (lvl) {
          updateLevelButtonsUI(lvl);
          scheduleFitView();
        }
      });
    }

    if (window.MindMapStructureController) {
      structureController = new window.MindMapStructureController(mindMapInstance, {
        container: modal,
        defaultLayout: 'mindMap',
        defaultLineStyle: 'straight',
        onLayoutChange: function (layoutName) {
          if (dragEnhancer && typeof dragEnhancer.onLayoutChange === 'function') {
            dragEnhancer.onLayoutChange(layoutName);
          }
          if (layoutName === 'mindMap') {
            applySemanticClustering(mindMapInstance.getData(false));
          }
          updateNexusLines();
        }
      });
    }

    // 画布背景点击清除共鸣高亮、几何浮层，并收起快捷键指南抽屉
    mindMapInstance.on('draw_click', function () {
      clearFocusResonance();
      if (window.MathVizWidget && typeof window.MathVizWidget.closePopover === 'function') {
        window.MathVizWidget.closePopover();
      }
      if (shortcutDrawer && shortcutDrawer.isOpen) {
        shortcutDrawer.close();
      }
    });

    // 节点点击：若该节点存在关联线（无论当前 L 键处于显示还是隐藏状态），点击节点即刻高亮显示其关联线；若无关联线则清除聚焦
    mindMapInstance.on('node_click', function (node) {
      if (!node || typeof node.getData !== 'function') return;
      var uid = node.getData('uid');
      if (!uid) {
        clearFocusResonance();
        return;
      }
      var targets = getTargetsByUid(uid);
      if (Array.isArray(targets) && targets.length > 0) {
        applyFocusResonanceByUid(uid);
      } else {
        clearFocusResonance();
      }
    });

    // 视口平移与缩放后，实时同步关联线高亮与隐现状态
    mindMapInstance.on('view_after_render', function () {
      syncAssociativeLinesState();
      updateNexusLines();
    });

    mindMapInstance.on('node_tree_render_end', function () {
      if (pendingFitOnRender && mindMapInstance && mindMapInstance.view) {
        pendingFitOnRender = false;
        fitCanvasToViewport();
      }
      if (mindMapInstance.associativeLine && typeof mindMapInstance.associativeLine.renderAllLines === 'function') {
        mindMapInstance.associativeLine.renderAllLines();
      }
      syncAssociativeLinesState();
      updateNexusLines();
    });

    mindMapInstance.on('scale', function () {
      updateNexusLines();
    });

    if (mindMapInstance.associativeLine) {
      var alProto = Object.getPrototypeOf(mindMapInstance.associativeLine);
      installAssociativeLineEnhancer(alProto);
      mindMapInstance.associativeLine.renderAllLines = alProto.renderAllLines.bind(mindMapInstance.associativeLine);
      mindMapInstance.associativeLine.removeAllLines = alProto.removeAllLines.bind(mindMapInstance.associativeLine);
      mindMapInstance.associativeLine.onNodeClick = alProto.onNodeClick.bind(mindMapInstance.associativeLine);
      mindMapInstance.associativeLine.renderAllLines();
    }

    // 拦截 SimpleMindMap 内置 keyCommand，仅当 #cognitiveModal 打开且不在输入框时响应
    if (mindMapInstance.keyCommand) {
      var origCheck = mindMapInstance.keyCommand.defaultEnableCheck;
      mindMapInstance.keyCommand.defaultEnableCheck = function (e) {
        if (!isModalOpen) return false;
        var target = e && e.target;
        if (!target || !target.classList) return false;
        if (nodeEditor && nodeEditor.isEditing) return false;
        if (outliner && outliner.focusedUid) return false;
        return origCheck.call(this, e);
      };
      if (!isModalOpen) {
        mindMapInstance.keyCommand.pause();
      }
    }

    // 默认“一览全局”自适应视口
    scheduleFitView();
  }

  // 递归查找节点数据中的 resonanceLinks 或 associativeLineTargets
  function findNodeDataByUid(treeNode, uid) {
    if (!treeNode) return null;
    if (treeNode.data && treeNode.data.uid === uid) return treeNode.data;
    if (Array.isArray(treeNode.children)) {
      for (var i = 0; i < treeNode.children.length; i++) {
        var found = findNodeDataByUid(treeNode.children[i], uid);
        if (found) return found;
      }
    }
    return null;
  }

  // 构建全树无向关联邻接表：保证无论关联定义在哪一端，双向查询完全对称
  function buildUndirectedAdjacencyMap(treeNode, adjMap) {
    var map = adjMap || new Map();
    if (!treeNode) return map;
    var d = treeNode.data || {};
    var u = d.uid || '';
    if (u) {
      if (!map.has(u)) map.set(u, new Set());
      var rawTargets = [];
      if (Array.isArray(d.resonanceLinks)) rawTargets = rawTargets.concat(d.resonanceLinks);
      if (Array.isArray(d.associativeLineTargets)) rawTargets = rawTargets.concat(d.associativeLineTargets);
      rawTargets.forEach(function (v) {
        if (!v || v === u) return;
        map.get(u).add(v);
        if (!map.has(v)) map.set(v, new Set());
        map.get(v).add(u);
      });
    }
    if (Array.isArray(treeNode.children)) {
      for (var i = 0; i < treeNode.children.length; i++) {
        buildUndirectedAdjacencyMap(treeNode.children[i], map);
      }
    }
    return map;
  }

  function getTargetsByUid(uid) {
    if (!uid) return [];
    if (mindMapInstance) {
      var curTree = mindMapInstance.getData(false);
      var adjMap = buildUndirectedAdjacencyMap(curTree);
      if (adjMap.has(uid) && adjMap.get(uid).size > 0) {
        return Array.from(adjMap.get(uid));
      }
      var nodeData = findNodeDataByUid(curTree, uid);
      if (nodeData) {
        if (Array.isArray(nodeData.resonanceLinks) && nodeData.resonanceLinks.length > 0) {
          return nodeData.resonanceLinks;
        }
        if (Array.isArray(nodeData.associativeLineTargets) && nodeData.associativeLineTargets.length > 0) {
          return nodeData.associativeLineTargets;
        }
      }
    }
    var data = (currentActiveSubject === 'english' && window.TangJingTranslationMindMapData)
      ? window.TangJingTranslationMindMapData
      : window.Chapter1MindMapData;
    var fallbackAdj = buildUndirectedAdjacencyMap(data);
    if (fallbackAdj.has(uid) && fallbackAdj.get(uid).size > 0) {
      return Array.from(fallbackAdj.get(uid));
    }
    var examPoints = (data && data.data && data.data.examPoints) || [];
    var kp = examPoints.find(function (p) { return p.uid === uid; });
    return kp ? (kp.associativeLineTargets || []) : [];
  }

  // 递归展开所有目标节点的祖先分支（不展开目标节点自身的叶子子项），保证折叠状态下的目标卡片挂载且关联线即刻连通
  function ensureNodesExpanded(targetUids, callback) {
    if (!mindMapInstance || !targetUids || targetUids.length === 0) {
      if (callback) callback();
      return;
    }
    var treeData = mindMapInstance.getData(false);
    if (!treeData) {
      if (callback) callback();
      return;
    }

    var uidSet = new Set(targetUids);
    var modified = false;

    function markAncestors(node) {
      if (!node) return false;
      var curUid = (node.data && node.data.uid) || '';
      var isSelfTarget = uidSet.has(curUid);
      var hasDescendantTarget = false;
      if (Array.isArray(node.children)) {
        for (var i = 0; i < node.children.length; i++) {
          if (markAncestors(node.children[i])) {
            hasDescendantTarget = true;
          }
        }
      }
      if (hasDescendantTarget && node.data && node.data.expand === false) {
        node.data.expand = true;
        modified = true;
      }
      return isSelfTarget || hasDescendantTarget;
    }

    markAncestors(treeData);

    if (modified) {
      mindMapInstance.setData(treeData);
      mindMapInstance.render(function () {
        if (callback) callback();
      });
    } else {
      if (callback) callback();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SimpleMindMap 原生关联线系统 (AssociativeLine Plugin)
  // 支持通过 L 键显隐切换原生关联线，默认开启显示；常态隐藏时点击有关联的节点依然透出实线
  // ─────────────────────────────────────────────────────────────
  function toggleAssociativeLines(force) {
    if (typeof force === 'boolean') {
      isAssociativeLineVisible = force;
    } else {
      isAssociativeLineVisible = !isAssociativeLineVisible;
    }
    syncAssociativeLinesState();
    return isAssociativeLineVisible;
  }

  function toggleNexusLines(force) {
    return toggleAssociativeLines(force);
  }

  function syncAssociativeLinesState() {
    var lineContainer = document.querySelector('#cognitiveMindMapContainer .smm-associative-line-container');
    if (!lineContainer) return;

    if (!isAssociativeLineVisible) {
      lineContainer.classList.add('is-global-muted');
    } else {
      lineContainer.classList.remove('is-global-muted');
    }

    var visiblePaths = lineContainer.querySelectorAll('.smm-associative-line-path');
    var clickPaths = lineContainer.querySelectorAll('.smm-associative-line-click-path');
    clickPaths.forEach(function (cp) {
      cp.classList.remove('is-active-line');
    });

    if (!activeResonanceUid) {
      lineContainer.classList.remove('has-active-selection');
      visiblePaths.forEach(function (p) {
        p.classList.remove('is-active-line');
      });
      return;
    }

    lineContainer.classList.add('has-active-selection');
    var targets = getTargetsByUid(activeResonanceUid);
    var targetSet = new Set(targets);

    visiblePaths.forEach(function (p) {
      var from = p.getAttribute('data-from-uid');
      var to = p.getAttribute('data-to-uid');
      var isConnected = (from === activeResonanceUid && targetSet.has(to)) ||
                        (to === activeResonanceUid && targetSet.has(from)) ||
                        (from === activeResonanceUid) ||
                        (to === activeResonanceUid);
      if (isConnected) {
        p.classList.add('is-active-line');
      } else {
        p.classList.remove('is-active-line');
      }
    });
  }

  function executeResonanceHighlight(uid, targets) {
    var containerEl = document.querySelector('#cognitiveMindMapContainer .smm-node-container');
    if (containerEl) {
      containerEl.classList.add('has-resonance-focus');
    }

    var allCardEls = document.querySelectorAll('#cognitiveMindMapContainer .mm-node-card');
    allCardEls.forEach(function (el) {
      el.classList.remove('is-in-resonance', 'resonance-active', 'resonance-linked');
    });

    var allNodeEls = document.querySelectorAll('#cognitiveMindMapContainer .smm-node');
    allNodeEls.forEach(function (el) {
      el.classList.remove('is-in-resonance', 'resonance-active', 'resonance-linked');
    });

    var srcCard = document.querySelector('#cognitiveMindMapContainer [data-node-uid="' + uid + '"]');
    if (srcCard) {
      srcCard.classList.add('is-in-resonance', 'resonance-active');
      var parentSmmNode = srcCard.closest('.smm-node');
      if (parentSmmNode) {
        parentSmmNode.classList.add('is-in-resonance', 'resonance-active');
      }
    }

    targets.forEach(function (targetUid) {
      var targetEl = document.querySelector('#cognitiveMindMapContainer [data-node-uid="' + targetUid + '"]');
      if (targetEl) {
        targetEl.classList.add('is-in-resonance', 'resonance-linked');
        var parentNodeEl = targetEl.closest('.smm-node');
        if (parentNodeEl) {
          parentNodeEl.classList.add('is-in-resonance', 'resonance-linked');
        }
      }
    });

    syncAssociativeLinesState();
  }

  function applyFocusResonanceByUid(uid) {
    if (!mindMapInstance || !uid) return;
    activeResonanceUid = uid;

    var targets = getTargetsByUid(uid);
    var nodesToEnsure = [uid].concat(targets);
    ensureNodesExpanded(nodesToEnsure, function () {
      executeResonanceHighlight(uid, targets);
    });
  }

  function toggleFocusResonanceByUid(uid) {
    if (!mindMapInstance || !uid) return;
    if (activeResonanceUid === uid) {
      clearFocusResonance();
    } else {
      applyFocusResonanceByUid(uid);
    }
  }

  function clearFocusResonance() {
    activeResonanceUid = null;
    var containerEl = document.querySelector('#cognitiveMindMapContainer .smm-node-container');
    if (containerEl) {
      containerEl.classList.remove('has-resonance-focus');
    }

    var allCardEls = document.querySelectorAll('#cognitiveMindMapContainer .mm-node-card');
    allCardEls.forEach(function (el) {
      el.classList.remove('is-in-resonance', 'resonance-active', 'resonance-linked');
    });

    var allNodeEls = document.querySelectorAll('#cognitiveMindMapContainer .smm-node');
    allNodeEls.forEach(function (el) {
      el.classList.remove('is-in-resonance', 'resonance-active', 'resonance-linked');
    });

    syncAssociativeLinesState();
  }

  // 展开至指定层级 (默认 level=2 一览全局)
  function expandToLevel(level) {
    if (!mindMapInstance) return;
    if (shortcutManager && typeof shortcutManager.expandToLevel === 'function') {
      shortcutManager.expandToLevel(level);
    } else if (typeof mindMapInstance.execCommand === 'function') {
      mindMapInstance.execCommand('UNEXPAND_TO_LEVEL', level);
    }
    updateLevelButtonsUI(level);
    scheduleFitView();
  }

  function expandAll() {
    if (!mindMapInstance) return;
    if (shortcutManager && typeof shortcutManager.expandAll === 'function') {
      shortcutManager.expandAll();
    } else if (typeof mindMapInstance.execCommand === 'function') {
      mindMapInstance.execCommand('EXPAND_ALL');
    }
    updateLevelButtonsUI(99);
    scheduleFitView();
  }

  // 宿主键盘拦截器：由 app.js 在 #cognitiveModal 打开时优先调用，实现严格分层级回退与关闭
  function handleHostKeydown(e) {
    if (!isModalOpen) return false;

    var isTyping = Boolean(
      (nodeEditor && nodeEditor.isEditing) ||
      (outliner && outliner.focusedUid) ||
      (document.activeElement && (
        document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.isContentEditable
      ))
    );

    if (e.key === 'Escape') {
      if (nodeEditor && nodeEditor.isEditing) {
        nodeEditor.commitAndClose();
        return true;
      }
      if (outliner && outliner.focusedUid) {
        outliner.commitNode(outliner.focusedUid);
        return true;
      }
      if (shortcutDrawer && shortcutDrawer.isOpen) {
        shortcutDrawer.close();
        return true;
      }
      if (structureController && structureController.isPopoverVisible) {
        structureController.hidePopover();
        return true;
      }
      if (window.MathVizWidget && typeof window.MathVizWidget.isPopoverOpen === 'function' && window.MathVizWidget.isPopoverOpen()) {
        window.MathVizWidget.closePopover();
        return true;
      }
      if (shortcutManager && shortcutManager.drillStack && shortcutManager.drillStack.length > 0) {
        shortcutManager.drillUp();
        return true;
      }
      if (activeResonanceUid) {
        clearFocusResonance();
        return true;
      }
      close();
      return true;
    }

    if ((e.key === 'o' || e.key === 'O') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (!isTyping) {
        close();
        return true;
      }
    }

    // 快捷键单键系统 (1, 2, 3, 0, Q, W, E, L) - 非打字编辑态下直接单键极速触发
    if (!isTyping && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      if (e.key === '1') {
        expandToLevel(1); // 1 键：知识点展开至 1.1~3.3（公式折叠），考点展开至 5 大考点，招法展开至 7 大招法
        return true;
      }
      if (e.key === '2') {
        expandToLevel(2); // 2 键：微观定理公式、真题题源与解题步骤全展开
        return true;
      }
      if (e.key === '3') {
        expandToLevel(3); // 3 键：全量深度展开
        return true;
      }
      if (e.key === '0') {
        expandAll();
        return true;
      }
      var k = (e.key || '').toLowerCase();
      if (k === 'q') {
        if (shortcutManager && typeof shortcutManager.expandCategory === 'function') {
          shortcutManager.expandCategory('knowledge');
        }
        return true;
      }
      if (k === 'w') {
        if (shortcutManager && typeof shortcutManager.expandCategory === 'function') {
          shortcutManager.expandCategory('exam');
        }
        return true;
      }
      if (k === 'e') {
        if (shortcutManager && typeof shortcutManager.expandCategory === 'function') {
          shortcutManager.expandCategory('method');
        }
        return true;
      }
      if (k === 'l') {
        toggleAssociativeLines();
        return true;
      }
    }

    // 兼容 Alt + 1/2/3/0/Q/W/E 组合键
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && !isTyping) {
      if (e.key === '1') { expandToLevel(1); return true; }
      if (e.key === '2') { expandToLevel(2); return true; }
      if (e.key === '3') { expandToLevel(3); return true; }
      if (e.key === '0') { expandAll(); return true; }
      var kAlt = (e.key || '').toLowerCase();
      if (kAlt === 'q' || kAlt === 'w' || kAlt === 'e') {
        if (shortcutManager && typeof shortcutManager.expandCategory === 'function') {
          if (kAlt === 'q') shortcutManager.expandCategory('knowledge');
          else if (kAlt === 'w') shortcutManager.expandCategory('exam');
          else if (kAlt === 'e') shortcutManager.expandCategory('method');
          return true;
        }
      }
    }

    return false;
  }

  function setupUI() {
    var modal = document.getElementById('cognitiveModal');
    if (!modal) return;

    window.addEventListener('resize', function () {
      if (isModalOpen && mindMapInstance) {
        mindMapInstance.resize();
      }
    });
  }

  function open(detail) {
    var modal = document.getElementById('cognitiveModal');
    if (!modal) return;

    var reqSubject = (detail && detail.subject) || ((window.curSubjectId === 'english' || (window.curSubject && window.curSubject.type === 'english')) ? 'english' : 'math');
    var isEnglish = (reqSubject === 'english');

    modal.style.display = 'flex';
    void modal.offsetWidth;
    modal.classList.add('show');
    isModalOpen = true;

    if (!mindMapInstance) {
      currentActiveSubject = reqSubject;
      initMindMap();
    } else {
      if (mindMapInstance.keyCommand) mindMapInstance.keyCommand.recovery();
      if (currentActiveSubject !== reqSubject) {
        currentActiveSubject = reqSubject;
        var targetSource = (isEnglish && window.TangJingTranslationMindMapData)
          ? window.TangJingTranslationMindMapData
          : window.Chapter1MindMapData;
        var cloned = JSON.parse(JSON.stringify(targetSource));
        applySemanticClustering(cloned);
        mindMapInstance.setData(cloned);
        if (outliner) {
          outliner.render(cloned);
        }
      }
      setTimeout(function () {
        mindMapInstance.resize();
        fitCanvasToViewport();
      }, 50);
    }

    if (detail && detail.kpId) {
      setTimeout(function () {
        applyFocusResonanceByUid(detail.kpId);
      }, 120);
    }
  }

  function close() {
    var modal = document.getElementById('cognitiveModal');
    if (!modal) return;

    if (nodeEditor && nodeEditor.isEditing) {
      nodeEditor.commitAndClose();
    }
    if (outliner && outliner.focusedUid) {
      outliner.commitNode(outliner.focusedUid);
    }
    if (shortcutDrawer && shortcutDrawer.isOpen) {
      shortcutDrawer.close();
    }
    if (structureController && structureController.isPopoverVisible) {
      structureController.hidePopover();
    }
    if (window.MathVizWidget && typeof window.MathVizWidget.closePopover === 'function') {
      window.MathVizWidget.closePopover();
    }

    if (mindMapInstance && mindMapInstance.keyCommand) {
      mindMapInstance.keyCommand.pause();
    }

    modal.classList.remove('show');
    clearFocusResonance();
    setTimeout(function () {
      if (!modal.classList.contains('show')) {
        modal.style.display = 'none';
      }
    }, 180);
    isModalOpen = false;
  }

  function toggle(detail) {
    if (isModalOpen) close();
    else open(detail);
  }

  function jumpToExamPointQuestions(kpId) {
    close();
    if (window.TopicManager && typeof window.TopicManager.filterByTopicId === 'function') {
      window.TopicManager.filterByTopicId(kpId);
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupUI);
    } else {
      setupUI();
    }
  }

  return {
    init: setupUI,
    open: open,
    close: close,
    toggle: toggle,
    isOpen: function () { return isModalOpen; },
    handleHostKeydown: handleHostKeydown,
    expandToLevel: expandToLevel,
    expandAll: expandAll,
    applyFocusResonanceByUid: applyFocusResonanceByUid,
    toggleFocusResonanceByUid: toggleFocusResonanceByUid,
    clearFocusResonance: clearFocusResonance,
    jumpToExamPointQuestions: jumpToExamPointQuestions,
    toggleAssociativeLines: toggleAssociativeLines,
    isAssociativeLineVisible: function () { return isAssociativeLineVisible; },
    toggleNexusLines: toggleAssociativeLines,
    updateNexusLines: function () {},
    expandCategory: function (cat) {
      if (shortcutManager && typeof shortcutManager.expandCategory === 'function') {
        shortcutManager.expandCategory(cat);
      }
    },
    getInstance: function () { return mindMapInstance; },
    getOutliner: function () { return outliner; },
    getDualViewController: function () { return dualViewController; },
    getShortcutDrawer: function () { return shortcutDrawer; },
    getShortcutManager: function () { return shortcutManager; }
  };
});
