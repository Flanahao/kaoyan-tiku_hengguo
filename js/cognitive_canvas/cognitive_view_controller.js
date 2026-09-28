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
  var hoveredResonanceUid = null;
  var hoveredEdgePair = null;
  var activeLinesLayer = null;
  var isAssociativeLineVisible = true;
  var pendingFitOnRender = false;
  var pendingViewportAction = null;
  var pendingViewportTimer = null;
  var currentActiveSubject = 'math';

  // 原树拓扑剪枝聚拢状态机 (1对N 关联节点聚拢 / 1对1 关联线聚拢)
  var clusterState = {
    active: false,
    mode: null,          // 'node' | 'edge' | null
    centerUid: null,     // 1对N 中心节点 UID 或 1对1 起点 UID
    edgeFromUid: null,   // 1对1 连线起点 UID
    edgeToUid: null,     // 1对1 连线终点 UID
    involvedUids: [],    // 聚拢涉及的核心节点 UID 列表
    fullTreeBackup: null, // 进入聚拢前的完整章节树纯净备份（绝不向 localStorage 写入剪枝残树）
    lastContextMenuTime: 0,
    rightDownPos: null
  };

  // 章节导图注册表与两层架构状态管理 (L1 学科全量层 / L2 章节全量层)
  var chapterRegistry = new Map();
  var currentChapterId = 'math_ch1';
  var lastVisitedChapterId = 'math_ch1';
  var macroFocusedChapterId = 'math_ch1';
  var lastHostChapterId = '';
  var currentLayerMode = 'chapter'; // 'chapter' | 'subject_macro'
  var saveDebounceTimer = null;
  var stateSaveDebounceTimer = null;
  var MATH_CHAPTER_ORDER = [
    'math_ch0', 'math_ch1', 'math_ch2', 'math_ch3', 'math_ch4',
    'math_ch5', 'math_ch6', 'math_ch7', 'math_ch8', 'math_ch9'
  ];

  // 深拷贝纯净节点树（剥离 SimpleMindMap 内部 _node 循环引用与临时标记）
  function cloneCleanTree(node, options) {
    if (!node) return null;
    var opts = options || {};
    var stripMacro = Boolean(opts.stripMacroMeta);
    var cleanData = {};
    var srcData = (node._node && node._node.nodeData && node._node.nodeData.data) ? node._node.nodeData.data : node.data;
    if (srcData && typeof srcData === 'object') {
      var keys = Object.keys(srcData);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (k === '_node' || k === '_mmLastSig' || k === '_expandModified' || k === '_isClusterPruned') continue;
        if (stripMacro && (
          k === 'isSubjectMacroRoot' ||
          k === 'isMacroChapterGroup' ||
          k === 'isCatalogLeaf' ||
          k === 'isChapterPortal' ||
          k === 'sourceChapterId' ||
          k === 'sourceNodeUid' ||
          k === 'targetChapterId' ||
          k === 'targetNodeUid' ||
          k === 'hiddenChildCount'
        )) continue;
        var val = srcData[k];
        if (Array.isArray(val)) {
          cleanData[k] = val.slice();
        } else if (val && typeof val === 'object') {
          cleanData[k] = JSON.parse(JSON.stringify(val));
        } else {
          cleanData[k] = val;
        }
      }
    }
    var cleanChildren = [];
    if (Array.isArray(node.children)) {
      for (var j = 0; j < node.children.length; j++) {
        var ch = cloneCleanTree(node.children[j], opts);
        if (ch) cleanChildren.push(ch);
      }
    }
    return {
      data: cleanData,
      children: cleanChildren
    };
  }

  // 读取 kaoyan.g.cognitive_state 记忆状态
  function readCognitiveState() {
    try {
      if (typeof localStorage !== 'undefined') {
        var raw = localStorage.getItem('kaoyan.g.cognitive_state');
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      }
      if (typeof window !== 'undefined' && window.StorageEngine && window.StorageEngine.GlobalStore) {
        var gsVal = window.StorageEngine.GlobalStore.get('cognitive_state');
        if (gsVal && typeof gsVal === 'object') return gsVal;
      }
    } catch (e) {}
    return {};
  }

  function getCurrentViewportKey() {
    if (currentLayerMode === 'subject_macro') {
      return 'subject_macro:' + (currentActiveSubject || 'math');
    }
    return 'chapter:' + (currentChapterId || 'math_ch1');
  }

  // 保存 kaoyan.g.cognitive_state（支持跨页面刷新恢复 O 键状态、层级模式、章节、大纲/导图模式与相机视口）
  function saveCognitiveState(overrideFields) {
    try {
      var prev = readCognitiveState();
      var viewports = Object.assign({}, prev.viewports || {});
      if (mindMapInstance && mindMapInstance.view &&
          typeof mindMapInstance.view.scale === 'number' && !isNaN(mindMapInstance.view.scale) &&
          typeof mindMapInstance.view.x === 'number' && !isNaN(mindMapInstance.view.x) &&
          typeof mindMapInstance.view.y === 'number' && !isNaN(mindMapInstance.view.y)) {
        viewports[getCurrentViewportKey()] = {
          scale: Number(mindMapInstance.view.scale.toFixed(4)),
          x: Math.round(mindMapInstance.view.x),
          y: Math.round(mindMapInstance.view.y)
        };
      }

      var curViewMode = (dualViewController && typeof dualViewController.getCurrentView === 'function')
        ? dualViewController.getCurrentView()
        : (prev.viewMode || 'mindmap');

      var nextState = Object.assign({}, prev, {
        isOpen: Boolean(isModalOpen),
        subject: currentActiveSubject || 'math',
        layerMode: currentLayerMode || 'chapter',
        currentChapterId: currentChapterId || 'math_ch1',
        lastVisitedChapterId: lastVisitedChapterId || currentChapterId || 'math_ch1',
        macroFocusedChapterId: macroFocusedChapterId || currentChapterId || 'math_ch1',
        lastHostChapterId: lastHostChapterId || prev.lastHostChapterId || '',
        viewMode: curViewMode,
        isAssociativeLineVisible: Boolean(isAssociativeLineVisible),
        viewports: viewports,
        updatedAt: Date.now()
      }, overrideFields || {});

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('kaoyan.g.cognitive_state', JSON.stringify(nextState));
      }
      if (typeof window !== 'undefined' && window.StorageEngine && window.StorageEngine.GlobalStore) {
        window.StorageEngine.GlobalStore.set('cognitive_state', nextState);
      }
    } catch (e) {
      console.warn('[CognitiveViewController] 保存 cognitive_state 失败:', e);
    }
  }

  function scheduleSaveCognitiveState() {
    if (stateSaveDebounceTimer) {
      clearTimeout(stateSaveDebounceTimer);
      stateSaveDebounceTimer = null;
    }
    stateSaveDebounceTimer = setTimeout(function () {
      stateSaveDebounceTimer = null;
      saveCognitiveState();
    }, 400);
  }

  function getChapterDisplayTitle(cid) {
    ensureBuiltInChaptersRegistered();
    var targetCid = cid || currentChapterId || 'math_ch1';
    if (chapterRegistry.has(targetCid)) {
      var chObj = chapterRegistry.get(targetCid);
      if (chObj && chObj.data && chObj.data.text) {
        return chObj.data.text;
      }
    }
    return targetCid;
  }

  function updateBottomCapsuleUI() {
    if (!structureController || typeof structureController.updateLayerStatus !== 'function') return;
    var isEnglish = (currentActiveSubject === 'english' || window.curSubjectId === 'english' || (window.curSubject && window.curSubject.type === 'english'));
    if (isEnglish) {
      structureController.updateLayerStatus({ hidden: true });
      return;
    }
    if (currentLayerMode === 'subject_macro') {
      var focusCid = macroFocusedChapterId || currentChapterId || 'math_ch1';
      var chTitle = getChapterDisplayTitle(focusCid);
      structureController.updateLayerStatus({
        hidden: false,
        layerMode: 'subject_macro',
        labelText: '全量层 · ' + chTitle,
        disableChapterNav: false
      });
    } else {
      structureController.updateLayerStatus({
        hidden: false,
        layerMode: 'chapter',
        labelText: getChapterDisplayTitle(currentChapterId),
        disableChapterNav: false
      });
    }
  }

  // 将聚拢剪枝态下用户对节点的文本修改、高亮、样式、Shift+空格转正同步回完整章节树备份
  function syncPrunedChangesToFullTree(prunedTree, fullTree) {
    if (!prunedTree || !fullTree) return;
    var dataMap = new Map();
    function collectPruned(n) {
      if (!n) return;
      var d = (n._node && n._node.nodeData && n._node.nodeData.data) ? n._node.nodeData.data : n.data;
      if (d && d.uid) {
        dataMap.set(d.uid, d);
      }
      if (Array.isArray(n.children)) {
        for (var i = 0; i < n.children.length; i++) {
          collectPruned(n.children[i]);
        }
      }
    }
    collectPruned(prunedTree);

    var mutableKeys = [
      'text', 'tag', 'tagType', 'formalTag', 'formalTagType', 'pendingSource',
      'highlightColor', 'fontWeight', 'fontStyle', 'textDecoration',
      'note', 'customTextWidth', 'richText', 'associativeLineTargets', 'resonanceLinks'
    ];

    function applyToFull(n) {
      if (!n) return;
      if (n.data && n.data.uid && dataMap.has(n.data.uid)) {
        var pData = dataMap.get(n.data.uid);
        for (var k = 0; k < mutableKeys.length; k++) {
          var key = mutableKeys[k];
          if (Object.prototype.hasOwnProperty.call(pData, key) && pData[key] !== undefined) {
            if (Array.isArray(pData[key])) {
              n.data[key] = pData[key].slice();
            } else {
              n.data[key] = pData[key];
            }
          } else {
            delete n.data[key];
          }
        }
      }
      if (Array.isArray(n.children)) {
        for (var i = 0; i < n.children.length; i++) {
          applyToFull(n.children[i]);
        }
      }
    }
    applyToFull(fullTree);
  }

  // 注册章节思维导图母本数据
  function registerChapterMindMap(chapterId, data) {
    if (!chapterId || !data) return;
    chapterRegistry.set(chapterId, data);
  }

  // 确保全部内置章节导图（高数第0~9章与英语翻译导图）均已注册
  function ensureBuiltInChaptersRegistered() {
    if (window.Chapter1MindMapData && !chapterRegistry.has('math_ch1')) {
      registerChapterMindMap('math_ch1', window.Chapter1MindMapData);
    }
    if (window.Chapter0MindMapData && !chapterRegistry.has('math_ch0')) {
      registerChapterMindMap('math_ch0', window.Chapter0MindMapData);
    }
    if (window.Chapter2MindMapData && !chapterRegistry.has('math_ch2')) {
      registerChapterMindMap('math_ch2', window.Chapter2MindMapData);
    }
    if (window.Chapter3MindMapData && !chapterRegistry.has('math_ch3')) {
      registerChapterMindMap('math_ch3', window.Chapter3MindMapData);
    }
    if (window.Chapter4MindMapData && !chapterRegistry.has('math_ch4')) {
      registerChapterMindMap('math_ch4', window.Chapter4MindMapData);
    }
    if (window.Chapter5MindMapData && !chapterRegistry.has('math_ch5')) {
      registerChapterMindMap('math_ch5', window.Chapter5MindMapData);
    }
    if (window.Chapter6MindMapData && !chapterRegistry.has('math_ch6')) {
      registerChapterMindMap('math_ch6', window.Chapter6MindMapData);
    }
    if (window.Chapter7MindMapData && !chapterRegistry.has('math_ch7')) {
      registerChapterMindMap('math_ch7', window.Chapter7MindMapData);
    }
    if (window.Chapter8MindMapData && !chapterRegistry.has('math_ch8')) {
      registerChapterMindMap('math_ch8', window.Chapter8MindMapData);
    }
    if (window.Chapter9MindMapData && !chapterRegistry.has('math_ch9')) {
      registerChapterMindMap('math_ch9', window.Chapter9MindMapData);
    }
    if (window.TangJingTranslationMindMapData && !chapterRegistry.has('english_translation')) {
      registerChapterMindMap('english_translation', window.TangJingTranslationMindMapData);
    }
  }

  // 将 18 讲体系讲号 (0~18) 映射至 10 大高数章节 ID (math_ch0 ~ math_ch9)
  function map18LectureNumToMathChapter(num) {
    if (num === 0) return 'math_ch0';
    if (num === 1 || num === 2) return 'math_ch1';
    if (num === 3 || num === 4 || num === 5 || num === 7) return 'math_ch2';
    if (num === 6) return 'math_ch3';
    if (num >= 8 && num <= 12) return 'math_ch4';
    if (num === 13) return 'math_ch5';
    if (num === 17) return 'math_ch6';
    if (num === 14 || num === 18) return 'math_ch7';
    if (num === 16) return 'math_ch8';
    if (num === 15) return 'math_ch9';
    return 'math_ch1';
  }

  // 解析外部传入的题库章节 ID（如 math::基础30讲::高数::lec01）至已注册的认知导图章节 ID
  function resolveChapterId(rawChapterId, isEnglish) {
    ensureBuiltInChaptersRegistered();
    if (isEnglish) return 'english_translation';
    if (!rawChapterId || typeof rawChapterId !== 'string') return 'math_ch1';
    var s = rawChapterId.trim();
    if (chapterRegistry.has(s)) return s;
    if (s === 'ch85') return 'math_ch0';

    // 1. 解析运行时四段式 UID: math::<wb>::<subj>::<slug>
    if (s.indexOf('::') !== -1) {
      var parts = s.split('::');
      var wb = parts[1] || '';
      var subj = parts[2] || '';
      var slug = parts[3] || '';
      var numMatch = slug.match(/(\d+)/);
      var num = numMatch ? parseInt(numMatch[1], 10) : -1;

      if (subj.indexOf('高数') !== -1 && num >= 0) {
        if (wb === '基础30讲' || wb === '强化36讲' || wb === '1000题') {
          return map18LectureNumToMathChapter(num);
        }
        if (wb === '李范全书' || wb === '李范习题') {
          var lifanMap = {
            1: 'math_ch1', 2: 'math_ch2', 3: 'math_ch4', 4: 'math_ch3',
            5: 'math_ch2', 6: 'math_ch9', 7: 'math_ch6', 8: 'math_ch5',
            9: 'math_ch7', 10: 'math_ch7', 11: 'math_ch8'
          };
          if (lifanMap[num]) return lifanMap[num];
        }
        if (wb === '老姚高数') {
          var laoyaoMap = {
            1: 'math_ch1', 2: 'math_ch2', 3: 'math_ch3', 4: 'math_ch4',
            5: 'math_ch4', 6: 'math_ch4', 7: 'math_ch9', 8: 'math_ch6',
            9: 'math_ch5', 10: 'math_ch7', 11: 'math_ch7', 12: 'math_ch8'
          };
          if (laoyaoMap[num]) return laoyaoMap[num];
        }
        if (wb === '880') {
          var map880 = {
            1: 'math_ch1', 2: 'math_ch2', 3: 'math_ch4', 4: 'math_ch6',
            5: 'math_ch5', 6: 'math_ch7', 7: 'math_ch9', 8: 'math_ch8',
            9: 'math_ch7'
          };
          if (map880[num]) return map880[num];
        }
        if (wb === '夜雨强化') {
          var yeyuMap = {
            1: 'math_ch1', 2: 'math_ch2', 3: 'math_ch2', 4: 'math_ch3',
            5: 'math_ch4', 6: 'math_ch4', 7: 'math_ch4', 8: 'math_ch5',
            9: 'math_ch9', 10: 'math_ch7', 11: 'math_ch7', 12: 'math_ch8',
            13: 'math_ch8', 14: 'math_ch7', 15: 'math_ch7', 16: 'math_ch3',
            17: 'math_ch6', 18: 'math_ch1', 19: 'math_ch2', 20: 'math_ch4',
            21: 'math_ch5', 22: 'math_ch8'
          };
          if (yeyuMap[num]) return yeyuMap[num];
        }
      }
    }

    // 2. 解析短讲号 lec00~lec18 或原始章节号 ch1~ch18 / ch31~ch48
    var lecMatch = s.match(/^lec0*(\d+)$/i);
    if (lecMatch) {
      return map18LectureNumToMathChapter(parseInt(lecMatch[1], 10));
    }
    var chMatch = s.match(/^ch0*(\d+)$/i);
    if (chMatch) {
      var cNum = parseInt(chMatch[1], 10);
      if (cNum === 0) return 'math_ch0';
      if (cNum >= 1 && cNum <= 18) return map18LectureNumToMathChapter(cNum);
      if (cNum >= 31 && cNum <= 48) return map18LectureNumToMathChapter(cNum - 30);
    }

    return 'math_ch1';
  }

  // 将章节导图展开态归一化为默认“一览全局”二级骨架态（保留用户节点增删改，仅重置初始展开层级，避免本地缓存的全展开状态导致 O 键打开卡顿与偏移）
  function normalizeOverviewExpandState(rootNode) {
    if (!rootNode || !rootNode.data || !Array.isArray(rootNode.children)) return rootNode;
    var hasHybridBranches = rootNode.children.some(function (c) {
      var u = (c && c.data && c.data.uid) || '';
      return u === 'branch_knowledge' || u === 'branch_exam_points' || u === 'branch_methods';
    });
    if (!hasHybridBranches) return rootNode;

    var isMacroRoot = Boolean(rootNode.data && rootNode.data.isSubjectMacroRoot);
    var modified = false;
    function walk(node, depth, branchType) {
      if (!node) return;
      if (!node.data) node.data = {};
      var uid = node.data.uid || '';
      var curBranch = branchType;
      if (uid === 'branch_knowledge' || uid.indexOf('sec_') === 0 || uid.indexOf('macro_know_') === 0) curBranch = 'knowledge';
      else if (uid === 'branch_exam_points' || uid.indexOf('kp_') === 0 || uid.indexOf('macro_exam_') === 0) curBranch = 'exam';
      else if (uid === 'branch_methods' || uid.indexOf('m_') === 0 || uid.indexOf('macro_method_') === 0) curBranch = 'method';

      var nextExpand = false;
      if (depth === 0 || depth === 1) {
        nextExpand = true;
      } else if (isMacroRoot) {
        nextExpand = (depth === 2);
      } else if (curBranch === 'knowledge' || curBranch === 'exam') {
        nextExpand = (depth === 2);
      } else {
        nextExpand = false;
      }

      if (node.data.expand !== nextExpand) {
        node.data.expand = nextExpand;
        modified = true;
        if (!nextExpand && node._node && typeof node._node.removeLine === 'function') {
          node._node.removeLine();
        }
      }

      if (Array.isArray(node.children)) {
        for (var i = 0; i < node.children.length; i++) {
          walk(node.children[i], depth + 1, curBranch);
        }
      }
    }

    walk(rootNode, 0, null);
    rootNode._expandModified = modified;
    return rootNode;
  }

  // 在 L1 全量层对节点的修改、样式、待确认转正及新增子节点，双向写穿同步回对应章节 (kaoyan.g.mindmap_chapters.math_chX)
  function syncMacroTreeChangesToChapters(macroTree) {
    if (!macroTree) return;
    var mutableKeys = [
      'text', 'tag', 'tagType', 'formalTag', 'formalTagType', 'pendingSource',
      'highlightColor', 'fontWeight', 'fontStyle', 'textDecoration',
      'note', 'customTextWidth', 'richText', 'associativeLineTargets', 'resonanceLinks'
    ];

    // 1. 提取 L1 全量层自身的展开状态表并持久化到 kaoyan.g.mindmap_subject.<subject>
    var expandMap = {};
    var editsByChapter = new Map();
    var newNodesByChapter = new Map();

    function walkMacro(node, parentNode, inheritedChapterId) {
      if (!node) return;
      var d = (node._node && node._node.nodeData && node._node.nodeData.data) ? node._node.nodeData.data : (node.data || {});
      var uid = d.uid || '';
      if (uid) {
        expandMap[uid] = (d.expand !== false);
      }

      var cid = d.sourceChapterId || d.targetChapterId || inheritedChapterId || '';
      if (cid && uid && !d.isSubjectMacroRoot) {
        if (!editsByChapter.has(cid)) {
          editsByChapter.set(cid, new Map());
        }
        var targetUid = d.isMacroChapterGroup ? '' : (d.sourceNodeUid || uid);
        if (targetUid) {
          editsByChapter.get(cid).set(targetUid, d);
        }
        // 检查是否在全量层新增了尚未标记 sourceNodeUid 的子节点
        if (!d.isMacroChapterGroup && !d.sourceNodeUid && parentNode) {
          var pd = (parentNode._node && parentNode._node.nodeData && parentNode._node.nodeData.data)
            ? parentNode._node.nodeData.data
            : (parentNode.data || {});
          var parentTargetUid = pd.sourceNodeUid || pd.uid || '';
          if (parentTargetUid) {
            d.sourceChapterId = cid;
            d.sourceNodeUid = uid;
            if (!newNodesByChapter.has(cid)) {
              newNodesByChapter.set(cid, []);
            }
            newNodesByChapter.get(cid).push({
              parentUid: parentTargetUid,
              nodeUid: uid,
              cleanSubtree: cloneCleanTree(node, { stripMacroMeta: true })
            });
          }
        }
      }

      if (Array.isArray(node.children)) {
        for (var i = 0; i < node.children.length; i++) {
          walkMacro(node.children[i], node, cid);
        }
      }
    }

    walkMacro(macroTree, null, '');

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('kaoyan.g.mindmap_subject.' + (currentActiveSubject || 'math'), JSON.stringify({
          expandMap: expandMap,
          updatedAt: Date.now()
        }));
      }
    } catch (e) {}

    // 2. 遍历涉及的章节，对比并写穿保存修改
    editsByChapter.forEach(function (nodeEditMap, cid) {
      var chTree = getInitialChapterData(cid, { preserveExpandState: true });
      if (!chTree) return;
      var chapterModified = false;
      var existingUids = new Set();

      function collectExistingUids(n) {
        if (!n) return;
        if (n.data && n.data.uid) existingUids.add(n.data.uid);
        if (Array.isArray(n.children)) {
          for (var i = 0; i < n.children.length; i++) collectExistingUids(n.children[i]);
        }
      }
      collectExistingUids(chTree);

      function applyEditsToChapterNode(n) {
        if (!n) return;
        if (n.data && n.data.uid && nodeEditMap.has(n.data.uid)) {
          var mData = nodeEditMap.get(n.data.uid);
          for (var k = 0; k < mutableKeys.length; k++) {
            var key = mutableKeys[k];
            var hasNew = Object.prototype.hasOwnProperty.call(mData, key) && mData[key] !== undefined;
            var hasOld = Object.prototype.hasOwnProperty.call(n.data, key) && n.data[key] !== undefined;
            if (hasNew) {
              var newStr = JSON.stringify(mData[key]);
              var oldStr = hasOld ? JSON.stringify(n.data[key]) : '';
              if (newStr !== oldStr) {
                n.data[key] = Array.isArray(mData[key]) ? mData[key].slice() : mData[key];
                chapterModified = true;
              }
            } else if (hasOld) {
              delete n.data[key];
              chapterModified = true;
            }
          }
        }
        if (Array.isArray(n.children)) {
          for (var i = 0; i < n.children.length; i++) {
            applyEditsToChapterNode(n.children[i]);
          }
        }
      }
      applyEditsToChapterNode(chTree);

      // 插入在全量层新增的子节点
      var pendingAdditions = newNodesByChapter.get(cid) || [];
      pendingAdditions.forEach(function (item) {
        if (!item || !item.nodeUid || existingUids.has(item.nodeUid)) return;
        function insertUnderParent(n) {
          if (!n) return false;
          if (n.data && n.data.uid === item.parentUid) {
            if (!Array.isArray(n.children)) n.children = [];
            n.children.push(item.cleanSubtree);
            existingUids.add(item.nodeUid);
            chapterModified = true;
            return true;
          }
          if (Array.isArray(n.children)) {
            for (var i = 0; i < n.children.length; i++) {
              if (insertUnderParent(n.children[i])) return true;
            }
          }
          return false;
        }
        insertUnderParent(chTree);
      });

      if (chapterModified) {
        if (window.SyncBlockManager && typeof window.SyncBlockManager.extractAndSaveSyncBlocks === 'function') {
          window.SyncBlockManager.extractAndSaveSyncBlocks(chTree);
        }
        try {
          if (typeof localStorage !== 'undefined') {
            var cleanCh = cloneCleanTree(chTree, { stripMacroMeta: true });
            localStorage.setItem('kaoyan.g.mindmap_chapters.' + cid, JSON.stringify(cleanCh));
          }
        } catch (e) {}
      }
    });
  }

  function flushMindMapStateToStorage() {
    if (!mindMapInstance) return;
    var curTree = (mindMapInstance.renderer && mindMapInstance.renderer.renderTree) || mindMapInstance.getData(false);
    if (!curTree) return;

    var treeToPersist = curTree;
    if (clusterState.active && clusterState.fullTreeBackup) {
      syncPrunedChangesToFullTree(curTree, clusterState.fullTreeBackup);
      treeToPersist = clusterState.fullTreeBackup;
    } else if (curTree.data && curTree.data._isClusterPruned) {
      return;
    }

    // L1 全量层：执行双向写穿同步至对应章节，并保存全量层展开状态与全局认知状态
    if (currentLayerMode === 'subject_macro' || (treeToPersist.data && treeToPersist.data.isSubjectMacroRoot)) {
      if (window.SyncBlockManager && typeof window.SyncBlockManager.extractAndSaveSyncBlocks === 'function') {
        window.SyncBlockManager.extractAndSaveSyncBlocks(treeToPersist);
      }
      syncMacroTreeChangesToChapters(treeToPersist);
      saveCognitiveState();
      if (typeof window.notifyStorageSync === 'function') {
        window.notifyStorageSync();
      }
      return;
    }

    // 1. 若存在跨章同步块，写穿提取并更新 SyncBlockManager
    if (window.SyncBlockManager && typeof window.SyncBlockManager.extractAndSaveSyncBlocks === 'function') {
      window.SyncBlockManager.extractAndSaveSyncBlocks(treeToPersist);
    }

    // 2. 章节全量状态静默写入 localStorage
    try {
      if (typeof localStorage !== 'undefined' && currentChapterId) {
        var cleanTree = cloneCleanTree(treeToPersist, { stripMacroMeta: true });
        if (cleanTree && cleanTree.data) {
          delete cleanTree.data._isClusterPruned;
        }
        localStorage.setItem('kaoyan.g.mindmap_chapters.' + currentChapterId, JSON.stringify(cleanTree));
        saveCognitiveState();
        if (typeof window.notifyStorageSync === 'function') {
          window.notifyStorageSync();
        }
      }
    } catch (e) {
      console.warn('[CognitiveViewController] 静默持久化失败:', e);
    }
  }

  // 静默自动持久化当前导图全量状态与跨章同步块（聚拢剪枝态下自动同步回 fullTreeBackup，严禁将剪枝残树写入 localStorage）
  function persistCurrentMindMapState(immediate) {
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer);
      saveDebounceTimer = null;
    }
    if (immediate === true) {
      flushMindMapStateToStorage();
      return;
    }
    saveDebounceTimer = setTimeout(function () {
      saveDebounceTimer = null;
      flushMindMapStateToStorage();
    }, 60);
  }

  // 获取章节初始数据（优先从 localStorage 读取用户修改，若无则从注册表抓取，并调用 SyncBlockManager 注入同步块子树）
  function getInitialChapterData(chapterId, options) {
    var opts = options || {};
    var isEnglish = (currentActiveSubject === 'english' || window.curSubjectId === 'english' || (window.curSubject && window.curSubject.type === 'english'));
    var cid = resolveChapterId(chapterId || currentChapterId, isEnglish);

    var rawSaved = null;
    try {
      if (typeof localStorage !== 'undefined') {
        rawSaved = localStorage.getItem('kaoyan.g.mindmap_chapters.' + cid);
      }
    } catch (e) {}

    var baseData = null;
    if (rawSaved) {
      try {
        var parsed = JSON.parse(rawSaved);
        if (parsed && (!parsed.data || (!parsed.data._isClusterPruned && !parsed.data.isSubjectMacroRoot))) {
          baseData = parsed;
        }
      } catch (e) {
        console.warn('[CognitiveViewController] 解析本地章节数据失败:', e);
      }
    }

    if (!baseData) {
      if (chapterRegistry.has(cid)) {
        baseData = JSON.parse(JSON.stringify(chapterRegistry.get(cid)));
      } else if (isEnglish && window.TangJingTranslationMindMapData) {
        baseData = JSON.parse(JSON.stringify(window.TangJingTranslationMindMapData));
      } else if (window.Chapter1MindMapData) {
        baseData = JSON.parse(JSON.stringify(window.Chapter1MindMapData));
      } else {
        baseData = { data: { text: "思维导图", uid: "root_default", expand: true }, children: [] };
      }
    }

    // 使用 SyncBlockManager 进行跨章同步块展开与作用域 UID 注入
    if (window.SyncBlockManager && typeof window.SyncBlockManager.hydrateTree === 'function') {
      baseData = window.SyncBlockManager.hydrateTree(baseData);
    }

    if (!opts.preserveExpandState) {
      normalizeOverviewExpandState(baseData);
      delete baseData._expandModified;
    }
    return baseData;
  }

  // 在章节内展开祖先并选中/高亮目标节点
  function focusAndSelectNodeInChapter(targetUid) {
    if (!mindMapInstance || !targetUid) return;
    var targets = getTargetsByUid(targetUid);
    if (Array.isArray(targets) && targets.length > 0) {
      applyFocusResonanceByUid(targetUid);
      return;
    }
    ensureNodesExpanded([targetUid], function () {
      if (mindMapInstance.renderer && typeof mindMapInstance.renderer.findNodeByUid === 'function') {
        var foundNode = mindMapInstance.renderer.findNodeByUid(targetUid);
        if (foundNode) {
          mindMapInstance.renderer.clearActiveNodeList();
          mindMapInstance.renderer.addNodeToActiveList(foundNode);
        }
      }
      scheduleFitView(48, { minReadableScale: 0, maxScale: 1.0, verticalAnchor: 'center', horizontalAnchor: 'center', allowHorizontalOverflow: false });
    });
  }

  // 加载指定章节进入 L2 章节全量层
  function loadChapter(chapterId, options) {
    var opts = options || {};
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer);
      saveDebounceTimer = null;
      flushMindMapStateToStorage();
    } else if (mindMapInstance && isModalOpen && !opts.skipFlushBeforeLoad) {
      flushMindMapStateToStorage();
    }
    if (clusterState.active) {
      exitClusterMode({ restoreOnly: true });
    }
    if (shortcutManager && typeof shortcutManager.resetCycleState === 'function') {
      shortcutManager.resetCycleState();
    }
    var isEnglish = (currentActiveSubject === 'english' || window.curSubjectId === 'english' || (window.curSubject && window.curSubject.type === 'english'));
    currentChapterId = resolveChapterId(chapterId, isEnglish);
    lastVisitedChapterId = currentChapterId;
    macroFocusedChapterId = currentChapterId;
    currentLayerMode = 'chapter';

    var container = document.getElementById('cognitiveMindMapContainer');
    var shouldCrossFade = Boolean(container && isModalOpen && !opts.skipCrossFade);
    if (shouldCrossFade) {
      container.classList.add('mm-canvas-crossfade', 'mm-canvas-fadeout');
    }

    var data = getInitialChapterData(currentChapterId, {
      preserveExpandState: Boolean(opts.preserveExpandState)
    });
    applySemanticClustering(data);
    updateBottomCapsuleUI();

    if (mindMapInstance) {
      clearCachedTreeLines();
      if (mindMapInstance.renderer) {
        if (typeof mindMapInstance.renderer.clearActiveNodeList === 'function') {
          mindMapInstance.renderer.clearActiveNodeList();
        } else {
          mindMapInstance.renderer.activeNodeList = [];
        }
      }
      mindMapInstance.setData(data);
      if (outliner && typeof outliner.setData === 'function') {
        outliner.setData(data);
      }
      setTimeout(function () {
        if (!mindMapInstance) return;
        var cEl = document.getElementById('cognitiveMindMapContainer');
        if (cEl && cEl.offsetWidth > 0 && cEl.offsetHeight > 0) {
          mindMapInstance.resize();
        }
        if (shouldCrossFade && cEl) {
          requestAnimationFrame(function () {
            cEl.classList.remove('mm-canvas-fadeout');
            setTimeout(function () {
              if (cEl) cEl.classList.remove('mm-canvas-crossfade');
            }, 65);
          });
        }
        if (opts.restoreViewport && typeof opts.restoreViewport.scale === 'number') {
          var rv = opts.restoreViewport;
          scheduleViewportAction(function () {
            if (!mindMapInstance || !mindMapInstance.view) return false;
            mindMapInstance.view.scale = rv.scale;
            mindMapInstance.view.x = rv.x;
            mindMapInstance.view.y = rv.y;
            if (typeof mindMapInstance.view.transform === 'function') mindMapInstance.view.transform();
            if (structureController) structureController.updateZoomDisplay();
            syncAssociativeLinesState();
            return true;
          }, true);
        } else if (opts.focusNodeUid) {
          focusAndSelectNodeInChapter(opts.focusNodeUid);
        } else {
          scheduleFitView(48, { minReadableScale: 0, maxScale: 1.0, verticalAnchor: 'center', horizontalAnchor: 'center', allowHorizontalOverflow: false });
        }
        saveCognitiveState();
      }, 30);
    } else {
      saveCognitiveState();
    }
  }

  // 构建学科级全量层同构正品字 △ 树 (L1 Subject Macro Tree：上方考点 · 左下知识点 · 右下解法，内部按第0~9章分组并裁剪至 1.1/考点/解法标题)
  function buildSubjectMacroTree(subjectId, maxMacroLevel, options) {
    var opts = options || {};
    var maxLvl = typeof maxMacroLevel === 'number' ? maxMacroLevel : 3;
    var subId = subjectId || 'math';
    var isMath = (subId === 'math');

    ensureBuiltInChaptersRegistered();

    if (!isMath) {
      var fallbackRoot = {
        data: {
          text: '学科导图',
          uid: 'root_subject_' + subId,
          isSubjectMacroRoot: true,
          subjectId: subId,
          macroLevel: 0,
          expand: true
        },
        children: []
      };
      chapterRegistry.forEach(function (chData, cid) {
        if (subId === 'english' && cid.indexOf('english_') !== 0) return;
        var raw = getInitialChapterData(cid, { preserveExpandState: true });
        if (raw) fallbackRoot.children.push(raw);
      });
      return fallbackRoot;
    }

    var examSector = {
      data: {
        text: '考点',
        uid: 'branch_exam_points',
        role: 'branch',
        category: 'exam',
        dir: 'right',
        macroLevel: 1,
        expand: true
      },
      children: []
    };
    var methodSector = {
      data: {
        text: '解法',
        uid: 'branch_methods',
        role: 'branch',
        category: 'method',
        dir: 'right',
        macroLevel: 1,
        expand: true
      },
      children: []
    };
    var knowSector = {
      data: {
        text: '知识点',
        uid: 'branch_knowledge',
        role: 'branch',
        category: 'knowledge',
        dir: 'left',
        macroLevel: 1,
        expand: true
      },
      children: []
    };

    var orderedChapterIds = MATH_CHAPTER_ORDER.slice();
    chapterRegistry.forEach(function (_, cid) {
      if (cid.indexOf('math_') === 0 && orderedChapterIds.indexOf(cid) === -1) {
        orderedChapterIds.push(cid);
      }
    });

    function cloneMacroSubtree(node, cid, currentLevel, extraData) {
      if (!node) return null;
      var nodeData = (node.data ? JSON.parse(JSON.stringify(node.data)) : {});
      if (extraData) {
        Object.assign(nodeData, extraData);
      }
      var lvl = typeof nodeData.macroLevel === 'number' ? nodeData.macroLevel : currentLevel;
      nodeData.macroLevel = lvl;
      nodeData.sourceChapterId = cid;
      nodeData.sourceNodeUid = nodeData.uid || '';

      var isLeaf = (lvl >= maxLvl);
      var pruned = {
        data: nodeData,
        children: []
      };

      if (isLeaf) {
        pruned.data.isChapterPortal = true;
        pruned.data.targetChapterId = cid;
        pruned.data.targetNodeUid = nodeData.uid || '';
        pruned.data.expand = false;
        if (Array.isArray(node.children) && node.children.length > 0) {
          pruned.data.hiddenChildCount = node.children.length;
        }
      } else if (Array.isArray(node.children)) {
        pruned.children = node.children.map(function (c) {
          return cloneMacroSubtree(c, cid, lvl + 1, null);
        }).filter(Boolean);
      }
      return pruned;
    }

    orderedChapterIds.forEach(function (cid) {
      if (!chapterRegistry.has(cid)) return;
      var rawCh = getInitialChapterData(cid, { preserveExpandState: true });
      if (!rawCh || !Array.isArray(rawCh.children)) return;
      var chTitle = (rawCh.data && rawCh.data.text) ? rawCh.data.text : cid;

      var chExamBranch = null;
      var chMethodBranch = null;
      var chKnowBranch = null;
      for (var i = 0; i < rawCh.children.length; i++) {
        var b = rawCh.children[i];
        var buid = (b && b.data && b.data.uid) || '';
        if (buid === 'branch_exam_points') chExamBranch = b;
        else if (buid === 'branch_methods') chMethodBranch = b;
        else if (buid === 'branch_knowledge') chKnowBranch = b;
      }

      // 1. 考点扇区章节组 (向上堆叠本章各考点卡片)
      var examChildren = [];
      if (chExamBranch && Array.isArray(chExamBranch.children)) {
        examChildren = chExamBranch.children.map(function (kpNode) {
          // 考点标题卡片在全量层作为向上目录子项展示，截断其下的具体题源详情
          return cloneMacroSubtree(kpNode, cid, maxLvl, {
            isCatalogLeaf: true,
            macroLevel: maxLvl
          });
        }).filter(Boolean);
      }
      var defaultChapterExpand = Boolean(opts.expandChapterGroups);
      examSector.children.push({
        data: {
          text: chTitle,
          uid: 'macro_exam_' + cid,
          role: 'section',
          tag: '章节',
          tagType: 'exam',
          category: 'exam',
          macroLevel: 2,
          isMacroChapterGroup: true,
          sourceChapterId: cid,
          sourceNodeUid: 'branch_exam_points',
          targetChapterId: cid,
          targetNodeUid: 'branch_exam_points',
          expand: defaultChapterExpand
        },
        children: examChildren
      });

      // 2. 解法扇区章节组 (向右展开本章各解法招法标题)
      var methodChildren = [];
      if (chMethodBranch && Array.isArray(chMethodBranch.children)) {
        methodChildren = chMethodBranch.children.map(function (mNode) {
          return cloneMacroSubtree(mNode, cid, maxLvl, {
            macroLevel: maxLvl
          });
        }).filter(Boolean);
      }
      methodSector.children.push({
        data: {
          text: chTitle,
          uid: 'macro_method_' + cid,
          role: 'section',
          tag: '章节',
          tagType: 'method',
          category: 'method',
          dir: 'right',
          macroLevel: 2,
          isMacroChapterGroup: true,
          sourceChapterId: cid,
          sourceNodeUid: 'branch_methods',
          targetChapterId: cid,
          targetNodeUid: 'branch_methods',
          expand: defaultChapterExpand
        },
        children: methodChildren
      });

      // 3. 知识点扇区章节组 (向左展开本章 §1~§4 分节及 1.1~4.2 小节标题)
      var knowChildren = [];
      if (chKnowBranch && Array.isArray(chKnowBranch.children)) {
        knowChildren = chKnowBranch.children.map(function (secNode) {
          var clonedSec = cloneMacroSubtree(secNode, cid, 2, null);
          if (clonedSec && clonedSec.data) {
            // 默认在全量层二级总览展开至 §1~§4，按 3 键或 Q 键或点击展开至 1.1~4.2
            clonedSec.data.expand = defaultChapterExpand ? (maxLvl > 3) : false;
            clonedSec.data.targetChapterId = cid;
            clonedSec.data.targetNodeUid = clonedSec.data.uid || '';
          }
          return clonedSec;
        }).filter(Boolean);
      }
      knowSector.children.push({
        data: {
          text: chTitle,
          uid: 'macro_know_' + cid,
          role: 'section',
          tag: '章节',
          tagType: 'section',
          category: 'knowledge',
          dir: 'left',
          macroLevel: 2,
          isMacroChapterGroup: true,
          sourceChapterId: cid,
          sourceNodeUid: 'branch_knowledge',
          targetChapterId: cid,
          targetNodeUid: 'branch_knowledge',
          expand: defaultChapterExpand
        },
        children: knowChildren
      });
    });

    var macroRoot = {
      data: {
        text: '高等数学',
        uid: 'root_subject_' + subId,
        isSubjectMacroRoot: true,
        subjectId: subId,
        macroLevel: 0,
        expand: true
      },
      children: [examSector, methodSector, knowSector]
    };

    // 若请求恢复用户保存的全量层节点展开状态，则从 kaoyan.g.mindmap_subject.<subId> 合并恢复
    if (opts.restoreSavedExpand && typeof localStorage !== 'undefined') {
      try {
        var rawSubjSaved = localStorage.getItem('kaoyan.g.mindmap_subject.' + subId);
        if (rawSubjSaved) {
          var parsedSubj = JSON.parse(rawSubjSaved);
          var expMap = (parsedSubj && parsedSubj.expandMap) || null;
          if (expMap && typeof expMap === 'object') {
            (function applySavedExp(n) {
              if (!n) return;
              if (n.data && n.data.uid && Object.prototype.hasOwnProperty.call(expMap, n.data.uid)) {
                n.data.expand = Boolean(expMap[n.data.uid]);
              }
              if (Array.isArray(n.children)) {
                for (var i = 0; i < n.children.length; i++) applySavedExp(n.children[i]);
              }
            })(macroRoot);
          }
        }
      } catch (e) {}
    }

    return macroRoot;
  }

  // 解析在 L1 全量层按 S 键下钻时的目标章节与目标节点
  function resolveMacroTargetChapterAndNode() {
    var activeList = (mindMapInstance && mindMapInstance.renderer && mindMapInstance.renderer.activeNodeList) || [];
    var activeNode = activeList.length > 0 ? activeList[0] : null;
    if (activeNode) {
      var cur = activeNode;
      var targetCid = '';
      var targetUid = '';
      while (cur) {
        var d = (typeof cur.getData === 'function' ? cur.getData() : (cur.nodeData && cur.nodeData.data)) || {};
        var scid = d.sourceChapterId || d.targetChapterId || '';
        if (scid && !targetCid) {
          targetCid = scid;
        }
        if (!targetUid && !d.isMacroChapterGroup && !d.isSubjectMacroRoot && d.uid && d.uid.indexOf('branch_') !== 0) {
          targetUid = d.sourceNodeUid || d.targetNodeUid || d.uid;
        }
        cur = cur.parent;
      }
      if (targetCid) {
        return { chapterId: targetCid, nodeUid: targetUid };
      }
    }

    if (outliner && outliner.focusedUid && mindMapInstance) {
      var rTree = (mindMapInstance.renderer && mindMapInstance.renderer.renderTree) || mindMapInstance.getData(false);
      var fData = findNodeDataByUid(rTree, outliner.focusedUid);
      if (fData && (fData.sourceChapterId || fData.targetChapterId)) {
        return {
          chapterId: fData.sourceChapterId || fData.targetChapterId,
          nodeUid: fData.isMacroChapterGroup ? '' : (fData.sourceNodeUid || fData.uid || '')
        };
      }
    }

    return {
      chapterId: macroFocusedChapterId || lastVisitedChapterId || currentChapterId || 'math_ch1',
      nodeUid: ''
    };
  }

  // 切换进入 L1 全量层 (Subject Macro Layer)
  function enterSubjectMacroLayer(options) {
    var opts = options || {};
    var isEnglish = (currentActiveSubject === 'english' || window.curSubjectId === 'english' || (window.curSubject && window.curSubject.type === 'english'));
    if (isEnglish) return false;

    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer);
      saveDebounceTimer = null;
      flushMindMapStateToStorage();
    } else if (mindMapInstance && isModalOpen && !opts.skipFlushBeforeLoad) {
      flushMindMapStateToStorage();
    }

    if (clusterState.active) {
      exitClusterMode({ restoreOnly: true });
    }
    if (shortcutManager && typeof shortcutManager.resetCycleState === 'function') {
      shortcutManager.resetCycleState();
    }

    if (currentLayerMode === 'chapter' && currentChapterId) {
      lastVisitedChapterId = currentChapterId;
    }
    macroFocusedChapterId = opts.focusChapterId || lastVisitedChapterId || currentChapterId || 'math_ch1';
    currentLayerMode = 'subject_macro';

    var container = document.getElementById('cognitiveMindMapContainer');
    var shouldCrossFade = Boolean(container && isModalOpen && !opts.skipCrossFade);
    if (shouldCrossFade) {
      container.classList.add('mm-canvas-crossfade', 'mm-canvas-fadeout');
    }

    var macroTree = buildSubjectMacroTree(currentActiveSubject || 'math', 3, {
      restoreSavedExpand: Boolean(opts.restoreSavedExpand)
    });
    applySemanticClustering(macroTree);
    updateBottomCapsuleUI();

    if (mindMapInstance) {
      clearCachedTreeLines();
      if (mindMapInstance.renderer) {
        if (typeof mindMapInstance.renderer.clearActiveNodeList === 'function') {
          mindMapInstance.renderer.clearActiveNodeList();
        } else {
          mindMapInstance.renderer.activeNodeList = [];
        }
      }
      mindMapInstance.setData(macroTree);
      if (outliner && typeof outliner.setData === 'function') {
        outliner.setData(macroTree);
      }
      setTimeout(function () {
        if (!mindMapInstance) return;
        var cEl = document.getElementById('cognitiveMindMapContainer');
        if (cEl && cEl.offsetWidth > 0 && cEl.offsetHeight > 0) {
          mindMapInstance.resize();
        }
        if (shouldCrossFade && cEl) {
          requestAnimationFrame(function () {
            cEl.classList.remove('mm-canvas-fadeout');
            setTimeout(function () {
              if (cEl) cEl.classList.remove('mm-canvas-crossfade');
            }, 65);
          });
        }
        if (opts.restoreViewport && typeof opts.restoreViewport.scale === 'number') {
          var rv = opts.restoreViewport;
          scheduleViewportAction(function () {
            if (!mindMapInstance || !mindMapInstance.view) return false;
            mindMapInstance.view.scale = rv.scale;
            mindMapInstance.view.x = rv.x;
            mindMapInstance.view.y = rv.y;
            if (typeof mindMapInstance.view.transform === 'function') mindMapInstance.view.transform();
            if (structureController) structureController.updateZoomDisplay();
            syncAssociativeLinesState();
            return true;
          }, true);
        } else {
          scheduleFitView(48, { minReadableScale: 0, maxScale: 1.0, verticalAnchor: 'center', horizontalAnchor: 'center', allowHorizontalOverflow: false });
        }
        saveCognitiveState();
      }, 30);
    } else {
      saveCognitiveState();
    }
    return true;
  }

  // S 键：在 L1 全量层与 L2 章节层之间无缝切换
  function toggleLayerMode() {
    var isEnglish = (currentActiveSubject === 'english' || window.curSubjectId === 'english' || (window.curSubject && window.curSubject.type === 'english'));
    if (isEnglish) return currentLayerMode;

    if (currentLayerMode === 'subject_macro') {
      var target = resolveMacroTargetChapterAndNode();
      loadChapter(target.chapterId, { focusNodeUid: target.nodeUid });
      return 'chapter';
    } else {
      enterSubjectMacroLayer({ restoreSavedExpand: true });
      return 'subject_macro';
    }
  }

  // A / D 键：在章节层切换上/下一章；在全量层循环聚焦定位上/下一章
  function navigateChapter(delta) {
    var isEnglish = (currentActiveSubject === 'english' || window.curSubjectId === 'english' || (window.curSubject && window.curSubject.type === 'english'));
    if (isEnglish) return currentChapterId;

    var step = (typeof delta === 'number' && delta < 0) ? -1 : 1;
    var list = MATH_CHAPTER_ORDER;
    var len = list.length;

    if (currentLayerMode === 'subject_macro') {
      var baseCid = macroFocusedChapterId || lastVisitedChapterId || currentChapterId || 'math_ch1';
      var curIdx = list.indexOf(baseCid);
      if (curIdx === -1) curIdx = 1;
      var nextCid = list[(curIdx + step + len) % len];
      macroFocusedChapterId = nextCid;
      currentChapterId = nextCid;
      lastVisitedChapterId = nextCid;
      updateBottomCapsuleUI();

      // 在全量层画布中定位并选中该章对应的分组子树
      if (mindMapInstance) {
        var activeCat = (shortcutManager && shortcutManager.categoryCycleState && shortcutManager.categoryCycleState.category) || '';
        var targetGroupUid = activeCat === 'exam'
          ? ('macro_exam_' + nextCid)
          : (activeCat === 'method' ? ('macro_method_' + nextCid) : ('macro_know_' + nextCid));
        var anchor = activeCat === 'exam' ? 'center' : (activeCat === 'method' ? 'left' : 'right');

        ensureNodesExpanded([targetGroupUid], function () {
          if (mindMapInstance.renderer && typeof mindMapInstance.renderer.findNodeByUid === 'function') {
            var gNode = mindMapInstance.renderer.findNodeByUid(targetGroupUid);
            if (gNode) {
              mindMapInstance.renderer.clearActiveNodeList();
              mindMapInstance.renderer.addNodeToActiveList(gNode);
            }
          }
          scheduleViewportAction(function () {
            return fitSubtreeToViewport([targetGroupUid], {
              padding: 48,
              minReadableScale: 0.85,
              maxScale: 1.05,
              verticalAnchor: 'top',
              horizontalAnchor: anchor,
              allowHorizontalOverflow: true,
              animate: true,
              duration: 240
            });
          }, true);
          saveCognitiveState();
        });
      } else {
        saveCognitiveState();
      }
      return nextCid;
    } else {
      var chIdx = list.indexOf(currentChapterId);
      if (chIdx === -1) chIdx = 1;
      var targetChapter = list[(chIdx + step + len) % len];
      loadChapter(targetChapter);
      return targetChapter;
    }
  }

  // 待确认标签一键转正 (Shift + 空格)
  function confirmPendingNode(nodeOrUid) {
    if (!mindMapInstance) return false;
    var targetNode = null;
    var uid = '';

    if (typeof nodeOrUid === 'string') {
      uid = nodeOrUid;
      if (mindMapInstance.renderer) {
        targetNode = mindMapInstance.renderer.findNodeByUid(uid);
      }
    } else if (nodeOrUid && typeof nodeOrUid.getData === 'function') {
      targetNode = nodeOrUid;
      uid = targetNode.getData('uid');
    }

    if (targetNode) {
      var tag = targetNode.getData('tag');
      var tagType = targetNode.getData('tagType');
      var isPending = tagType === 'pending' || (tag && String(tag).startsWith('待确认'));
      if (!isPending) return false;

      var formalTag = targetNode.getData('formalTag') || '注';
      var formalTagType = targetNode.getData('formalTagType') || 'warn';

      if (targetNode.nodeData && targetNode.nodeData.data) {
        delete targetNode.nodeData.data.formalTag;
        delete targetNode.nodeData.data.formalTagType;
        delete targetNode.nodeData.data.pendingSource;
      }

      if (mindMapInstance.renderer && mindMapInstance.renderer.renderTree && uid) {
        (function syncTreeNode(n) {
          if (!n) return;
          if (n.data && n.data.uid === uid) {
            n.data.tag = formalTag;
            n.data.tagType = formalTagType;
            delete n.data.formalTag;
            delete n.data.formalTagType;
            delete n.data.pendingSource;
          }
          if (Array.isArray(n.children)) {
            for (var i = 0; i < n.children.length; i++) {
              syncTreeNode(n.children[i]);
            }
          }
        })(mindMapInstance.renderer.renderTree);
      }

      mindMapInstance.execCommand('SET_NODE_DATA', targetNode, {
        tag: formalTag,
        tagType: formalTagType
      });

      persistCurrentMindMapState(true);

      mindMapInstance.render(function () {
        if (mindMapInstance.renderer && uid) {
          var fresh = mindMapInstance.renderer.findNodeByUid(uid);
          if (fresh) {
            mindMapInstance.renderer.clearActiveNodeList();
            mindMapInstance.renderer.addNodeToActiveList(fresh);
          }
        }
        persistCurrentMindMapState(true);
      });
      return true;
    }

    if (outliner && uid) {
      var oNode = outliner.findNode(uid);
      if (oNode && oNode.data) {
        oNode.data.tag = oNode.data.formalTag || '注';
        oNode.data.tagType = oNode.data.formalTagType || 'warn';
        delete oNode.data.formalTag;
        delete oNode.data.formalTagType;
        delete oNode.data.pendingSource;
        outliner.render();
        persistCurrentMindMapState(true);
        return true;
      }
    }

    return false;
  }

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

  function getNodeUid(node) {
    if (!node) return '';
    if (typeof node.getData === 'function') {
      var u = node.getData('uid');
      if (u) return u;
    }
    if (node.nodeData && node.nodeData.data && node.nodeData.data.uid) {
      return node.nodeData.data.uid;
    }
    if (node.data && node.data.uid) {
      return node.data.uid;
    }
    return '';
  }

  // 判定节点所属的混合三角扇区: 'top_exam' (上方考点目录图) | 'left_know' (左下知识逻辑图) | 'right_method' (右下招法逻辑图)
  function getNodeSector(node) {
    var cur = node;
    while (cur) {
      var uid = getNodeUid(cur);
      var text = (typeof cur.getData === 'function' ? cur.getData('text') : (cur.data && cur.data.text)) || '';
      if (uid === 'branch_exam_points' || uid.indexOf('kp_') === 0 || uid.indexOf('macro_exam_') === 0 || text === '考点') return 'top_exam';
      if (uid === 'branch_knowledge' || uid.indexOf('sec_') === 0 || uid.indexOf('k_') === 0 || uid.indexOf('macro_know_') === 0 || text === '知识点') return 'left_know';
      if (uid === 'branch_methods' || uid.indexOf('m_') === 0 || uid.indexOf('macro_method_') === 0 || text === '解法' || text.indexOf('招法') !== -1) return 'right_method';
      cur = cur.parent;
    }
    if (node && node.dir === 'left') return 'left_know';
    return 'right_method';
  }

  function isHybridTriangleRoot(rootNode) {
    if (!rootNode || !Array.isArray(rootNode.children) || rootNode.children.length === 0) return false;
    var hasExam = false, hasKnow = false, hasMethod = false;
    for (var i = 0; i < rootNode.children.length; i++) {
      var child = rootNode.children[i];
      var u = getNodeUid(child);
      var t = (typeof child.getData === 'function' ? child.getData('text') : (child.data && child.data.text)) || '';
      if (u === 'branch_exam_points' || t === '考点') hasExam = true;
      else if (u === 'branch_knowledge' || t === '知识点') hasKnow = true;
      else if (u === 'branch_methods' || t === '解法' || t.indexOf('招法') !== -1) hasMethod = true;
    }
    var isPruned = Boolean(
      (clusterState && clusterState.active) ||
      (typeof rootNode.getData === 'function' && rootNode.getData('_isClusterPruned')) ||
      (rootNode.nodeData && rootNode.nodeData.data && rootNode.nodeData.data._isClusterPruned) ||
      (rootNode.data && rootNode.data._isClusterPruned)
    );
    if (isPruned) {
      return hasExam || hasKnow || hasMethod;
    }
    return hasExam && hasKnow && hasMethod;
  }

  function measureNodeSubtreeBox(node) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    function walk(n) {
      if (!n) return;
      if (typeof n.left === 'number' && typeof n.top === 'number' && n.width > 0 && n.height > 0) {
        if (n.left < minX) minX = n.left;
        if (n.top < minY) minY = n.top;
        if (n.left + n.width > maxX) maxX = n.left + n.width;
        if (n.top + n.height > maxY) maxY = n.top + n.height;
      }
      var expanded = (typeof n.getData === 'function' ? n.getData('expand') : true) !== false;
      if (expanded && Array.isArray(n.children)) {
        for (var i = 0; i < n.children.length; i++) {
          walk(n.children[i]);
        }
      }
    }
    walk(node);
    if (!isFinite(minX)) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }
    return {
      minX: minX,
      minY: minY,
      maxX: maxX,
      maxY: maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  function shiftNodeSubtree(node, dx, dy) {
    if (!node) return;
    if (typeof node.left === 'number') node.left += dx;
    if (typeof node.top === 'number') node.top += dy;
    if (Array.isArray(node.children)) {
      for (var i = 0; i < node.children.length; i++) {
        shiftNodeSubtree(node.children[i], dx, dy);
      }
    }
  }

  function layoutLeftLogicHorizontal(knowNode, rightEdgeX) {
    if (!knowNode) return;
    knowNode.dir = 'left';
    knowNode.left = rightEdgeX - knowNode.width;
    function walkChildren(parent, depth) {
      var expanded = (typeof parent.getData === 'function' ? parent.getData('expand') : true) !== false;
      if (!expanded || !Array.isArray(parent.children)) return;
      var gapX = depth === 1 ? 56 : (depth === 2 ? 62 : 38);
      for (var i = 0; i < parent.children.length; i++) {
        var child = parent.children[i];
        child.dir = 'left';
        child.left = parent.left - gapX - child.width;
        walkChildren(child, depth + 1);
      }
    }
    walkChildren(knowNode, 1);
  }

  function layoutRightLogicHorizontal(methodNode, leftEdgeX) {
    if (!methodNode) return;
    methodNode.dir = 'right';
    methodNode.left = leftEdgeX;
    function walkChildren(parent, depth) {
      var expanded = (typeof parent.getData === 'function' ? parent.getData('expand') : true) !== false;
      if (!expanded || !Array.isArray(parent.children)) return;
      var gapX = depth === 1 ? 56 : 42;
      for (var i = 0; i < parent.children.length; i++) {
        var child = parent.children[i];
        child.dir = 'right';
        child.left = parent.left + parent.width + gapX;
        walkChildren(child, depth + 1);
      }
    }
    walkChildren(methodNode, 1);
  }

  // ─────────────────────────────────────────────────────────────
  // 正品字 △ 混合结构三角布局引擎 (Hybrid Triangle Layout)
  // 上方顶点：核心考点与题源 (目录组织图 catalogOrganization，水平并列 + 垂直缩进子项)
  // 左下顶点：核心知识点体系 (向左逻辑图，右端口面向中央与底边走廊)
  // 右下顶点：解法流程与招法 (向右逻辑图，左端口面向中央与底边走廊)
  // ─────────────────────────────────────────────────────────────
  function applyHybridTriangleLayout(rootNode) {
    if (!isHybridTriangleRoot(rootNode)) return;

    var examNode = null, knowNode = null, methodNode = null;
    for (var i = 0; i < rootNode.children.length; i++) {
      var ch = rootNode.children[i];
      var u = getNodeUid(ch);
      if (u === 'branch_exam_points') examNode = ch;
      else if (u === 'branch_knowledge') knowNode = ch;
      else if (u === 'branch_methods') methodNode = ch;
    }
    if (!examNode && !knowNode && !methodNode) return;

    var rootCx = rootNode.left + rootNode.width / 2;
    var targetWingTopY = rootNode.top - 16;

    // 1. 上方顶点：branch_exam_points (向上离心展开目录树，中央走廊 100% 净空)
    if (examNode) {
      var examExpanded = (typeof examNode.getData === 'function' ? examNode.getData('expand') : true) !== false;
      var kpList = (examExpanded && Array.isArray(examNode.children)) ? examNode.children : [];
      var gapRootToExam = 44;
      var gapExamToKp = 38;

      examNode.left = rootCx - examNode.width / 2;
      examNode.top = rootNode.top - gapRootToExam - examNode.height;

      if (kpList.length > 0) {
        var colWidths = [];
        var colSubHeights = [];
        var maxKpHeight = 0;
        var indentX = 14;
        var topSubGap = 10;
        var itemSubGap = 8;

        for (var k = 0; k < kpList.length; k++) {
          var kp = kpList[k];
          if (kp.height > maxKpHeight) maxKpHeight = kp.height;
          var kpExp = (typeof kp.getData === 'function' ? kp.getData('expand') : true) !== false;
          var subs = (kpExp && Array.isArray(kp.children)) ? kp.children : [];
          var maxSubW = 0;
          var subH = 0;
          for (var s = 0; s < subs.length; s++) {
            var sub = subs[s];
            if (indentX + sub.width > maxSubW) maxSubW = indentX + sub.width;
            subH += (s === 0 ? topSubGap : itemSubGap) + sub.height;
          }
          colWidths.push(Math.max(kp.width, maxSubW));
          colSubHeights.push(subH);
        }

        var colGap = 14;
        var totalRowW = 0;
        for (var c = 0; c < colWidths.length; c++) {
          totalRowW += colWidths[c];
        }
        totalRowW += Math.max(0, kpList.length - 1) * colGap;

        // 5 大考点卡片底部基准线（位于 examNode 上方 gapExamToKp 处，中央走廊彻底净空）
        var kpRowBottom = examNode.top - gapExamToKp;
        var kpRowTop = kpRowBottom - maxKpHeight;

        var curColX = rootCx - totalRowW / 2;
        for (var idx = 0; idx < kpList.length; idx++) {
          var kpNode = kpList[idx];
          kpNode.left = curColX;
          kpNode.top = kpRowTop;

          var isKpExp = (typeof kpNode.getData === 'function' ? kpNode.getData('expand') : true) !== false;
          if (isKpExp && Array.isArray(kpNode.children) && kpNode.children.length > 0) {
            // 子项向上垂直堆叠：自上而下阅读，sub[0] 在顶，sub[n-1] 邻接考点卡片上方
            var curSubY = kpNode.top - colSubHeights[idx];
            for (var j = 0; j < kpNode.children.length; j++) {
              var subNode = kpNode.children[j];
              subNode.left = kpNode.left + indentX;
              subNode.top = curSubY;
              curSubY += subNode.height + itemSubGap;
            }
          }
          curColX += colWidths[idx] + colGap;
        }
      }
    }

    // 2. 左下顶点：branch_knowledge (向左逻辑图)
    if (knowNode) {
      layoutLeftLogicHorizontal(knowNode, rootNode.left - 64);
      var kBox = measureNodeSubtreeBox(knowNode);
      shiftNodeSubtree(knowNode, 0, targetWingTopY - kBox.minY);
    }

    // 3. 右下顶点：branch_methods (向右逻辑图)
    if (methodNode) {
      layoutRightLogicHorizontal(methodNode, rootNode.left + rootNode.width + 64);
      var mBox = measureNodeSubtreeBox(methodNode);
      shiftNodeSubtree(methodNode, 0, targetWingTopY - mBox.minY);
    }
  }

  function installHybridTriangleLayoutHook(mm) {
    if (!mm || !mm.renderer || !mm.renderer.layout) return;
    var layout = mm.renderer.layout;
    if (layout._hasHybridTriangleHook) return;
    layout._hasHybridTriangleHook = true;

    if (typeof layout.checkIsNodeDataChange === 'function') {
      var origCheckIsNodeDataChange = layout.checkIsNodeDataChange.bind(layout);
      var getVisualSig = function (d) {
        if (!d || typeof d !== 'object') return '';
        return (d.uid || '') + '|' +
               (d.text || '') + '|' +
               (d.tag || '') + '|' +
               (d.tagType || '') + '|' +
               (d.highlightColor || '') + '|' +
               (d.fontWeight || '') + '|' +
               (d.fontStyle || '') + '|' +
               (d.textDecoration || '') + '|' +
               (d.customTextWidth || '') + '|' +
               (d.questionCount || 0) + '|' +
               (d.widgetType || '');
      };
      layout.checkIsNodeDataChange = function (lastData, curData) {
        if (!lastData || !curData) return false;
        if (curData.needUpdate || curData.resetRichText) return true;
        var lastObj = lastData;
        if (typeof lastData === 'string') {
          try {
            lastObj = JSON.parse(lastData);
          } catch (e) {
            return origCheckIsNodeDataChange(lastData, curData);
          }
        }
        return getVisualSig(lastObj) !== getVisualSig(curData);
      };
    }

    var origDoLayout = layout.doLayout.bind(layout);
    layout.doLayout = function (callback) {
      if (mm.opt.layout === 'mindMap' && typeof this.computedBaseValue === 'function') {
        if (window.MindMapNodeRenderer && typeof window.MindMapNodeRenderer.batchPreMeasureTree === 'function' && this.renderer && this.renderer.renderTree) {
          window.MindMapNodeRenderer.batchPreMeasureTree(this.renderer.renderTree, mm.el, {
            onActionClick: handleNodeActionClick
          });
        }
        this.computedBaseValue();
        if (typeof this.computedTopValue === 'function') this.computedTopValue();
        if (typeof this.adjustTopValue === 'function') this.adjustTopValue();
        if (isHybridTriangleRoot(this.root)) {
          applyHybridTriangleLayout(this.root);
        }
        if (typeof callback === 'function') {
          callback(this.root);
        }
        return;
      }
      origDoLayout(function (root) {
        if (mm.opt.layout === 'mindMap' && isHybridTriangleRoot(root)) {
          applyHybridTriangleLayout(root);
        }
        if (typeof callback === 'function') {
          callback(root);
        }
      });
    };

    var origRenderLine = layout.renderLine.bind(layout);
    layout.renderLine = function (node, lines, style, lineStyle) {
      var root = mm.renderer.root;
      if (mm.opt.layout !== 'mindMap' || !isHybridTriangleRoot(root)) {
        return origRenderLine(node, lines, style, lineStyle);
      }
      if (!node || !Array.isArray(node.children) || node.children.length <= 0) {
        return [];
      }

      var uid = getNodeUid(node);
      var self = this;

      // 1. 中央根节点 -> 上方考点 / 左下知识 / 右下招法
      if (node.isRoot) {
        var rootCx = node.left + node.width / 2;
        var rootCy = node.top + node.height / 2;
        node.children.forEach(function (item, index) {
          if (!lines[index]) return;
          var itemUid = getNodeUid(item);
          var path = '';
          if (itemUid === 'branch_exam_points') {
            var x1 = rootCx;
            var y1 = node.top;
            var x2 = item.left + item.width / 2;
            var y2 = item.top + item.height;
            path = 'M ' + x1 + ',' + y1 + ' L ' + x2 + ',' + y2;
          } else if (itemUid === 'branch_knowledge' || item.dir === 'left') {
            var lx1 = node.left;
            var ly1 = rootCy;
            var lx2 = item.left + item.width;
            var ly2 = item.top + item.height / 2;
            var lMidX = lx1 - (lx1 - lx2) * 0.5;
            path = (lineStyle === 'curve' && typeof self.cubicBezierPath === 'function')
              ? self.cubicBezierPath(lx1, ly1, lx2, ly2)
              : self.createFoldLine([[lx1, ly1], [lMidX, ly1], [lMidX, ly2], [lx2, ly2]]);
          } else {
            var rx1 = node.left + node.width;
            var ry1 = rootCy;
            var rx2 = item.left;
            var ry2 = item.top + item.height / 2;
            var rMidX = rx1 + (rx2 - rx1) * 0.5;
            path = (lineStyle === 'curve' && typeof self.cubicBezierPath === 'function')
              ? self.cubicBezierPath(rx1, ry1, rx2, ry2)
              : self.createFoldLine([[rx1, ry1], [rMidX, ry1], [rMidX, ry2], [rx2, ry2]]);
          }
          self.setLineStyle(style, lines[index], path, item);
        });
        return;
      }

      // 2. 上方考点主干节点 (branch_exam_points) -> 5 大核心考点向上分流总线
      if (uid === 'branch_exam_points') {
        var bx1 = node.left + node.width / 2;
        var by1 = node.top;
        var firstChildBottom = node.children[0].top + node.children[0].height;
        var yBus = by1 + (firstChildBottom - by1) * 0.48;
        node.children.forEach(function (item, index) {
          if (!lines[index]) return;
          var bx2 = item.left + item.width / 2;
          var by2 = item.top + item.height;
          var bPath = self.createFoldLine([[bx1, by1], [bx1, yBus], [bx2, yBus], [bx2, by2]]);
          self.setLineStyle(style, lines[index], bPath, item);
        });
        return;
      }

      // 3. 考点卡片 (kp_gs01_*) -> 向上垂直目录缩进子项 (题源 / 要领)
      if (getNodeSector(node) === 'top_exam') {
        var xTrunk = node.left + 7;
        var ky1 = node.top;
        node.children.forEach(function (item, index) {
          if (!lines[index]) return;
          var kx2 = item.left;
          var ky2 = item.top + item.height / 2;
          var kPath = self.createFoldLine([[xTrunk, ky1], [xTrunk, ky2], [kx2, ky2]]);
          self.setLineStyle(style, lines[index], kPath, item);
        });
        return;
      }

      // 4. 左下知识树与右下招法树：使用原生逻辑图连线
      return origRenderLine(node, lines, style, lineStyle);
    };

    if (typeof layout.renderExpandBtn === 'function') {
      var origRenderExpandBtn = layout.renderExpandBtn.bind(layout);
      layout.renderExpandBtn = function (node, btn) {
        var root = mm.renderer.root;
        if (mm.opt.layout === 'mindMap' && isHybridTriangleRoot(root) && node && !node.isRoot && getNodeSector(node) === 'top_exam') {
          var width = node.width;
          var expandBtnSize = node.expandBtnSize || 20;
          var tr = btn.transform();
          var translateX = tr.translateX || 0;
          var translateY = tr.translateY || 0;
          var targetX = (getNodeUid(node) === 'branch_exam_points' ? (width * 0.5) : 14) - expandBtnSize / 2;
          var targetY = -expandBtnSize / 2;
          btn.translate(targetX - translateX, targetY - translateY);
          return;
        }
        return origRenderExpandBtn(node, btn);
      };
    }

    if (typeof layout.renderExpandBtnRect === 'function') {
      var origRenderExpandBtnRect = layout.renderExpandBtnRect.bind(layout);
      layout.renderExpandBtnRect = function (rect, expandBtnSize, width, height, node) {
        var root = mm.renderer.root;
        if (mm.opt.layout === 'mindMap' && isHybridTriangleRoot(root) && node && getNodeSector(node) === 'top_exam') {
          rect.size(width, expandBtnSize).x(0).y(-expandBtnSize);
          return;
        }
        return origRenderExpandBtnRect(rect, expandBtnSize, width, height, node);
      };
    }
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

  // 递归收集目标子树根节点及其所有当前展开可见后代节点的 UID 集合（用于独立视野分配，排除非目标分支）
  function collectSubtreeUidSet(targetRootUids) {
    if (!Array.isArray(targetRootUids) || targetRootUids.length === 0 || !mindMapInstance) {
      return null;
    }
    var rootSet = new Set(targetRootUids.filter(Boolean));
    if (rootSet.size === 0) return null;

    var collected = new Set();
    var treeData = (mindMapInstance.renderer && mindMapInstance.renderer.renderTree) ||
                   (mindMapInstance.getData ? mindMapInstance.getData(false) : null);

    function walkData(node, inTarget) {
      if (!node) return;
      var d = node.data || {};
      var uid = d.uid || '';
      var matched = Boolean(inTarget || (uid && rootSet.has(uid)));
      if (matched && uid) {
        collected.add(uid);
      }
      var isExpanded = (d.expand !== false);
      if (isExpanded && Array.isArray(node.children)) {
        for (var i = 0; i < node.children.length; i++) {
          walkData(node.children[i], matched);
        }
      }
    }

    if (treeData) {
      walkData(treeData, false);
    }
    return collected.size > 0 ? collected : null;
  }

  function measureTargetCardsBounds(allowedUidSet) {
    var cards = document.querySelectorAll('#cognitiveMindMapContainer .smm-node-container .mm-node-card');
    if (!cards || cards.length === 0) {
      cards = document.querySelectorAll('#cognitiveMindMapContainer svg .mm-node-card');
    }
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    var count = 0;
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (allowedUidSet) {
        var uid = card.getAttribute('data-node-uid') || '';
        if (!allowedUidSet.has(uid)) continue;
      }
      var r = card.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.left > -10000 && r.top > -10000) {
        if (r.left < minX) minX = r.left;
        if (r.top < minY) minY = r.top;
        if (r.right > maxX) maxX = r.right;
        if (r.bottom > maxY) maxY = r.bottom;
        count++;
      }
    }
    if (count === 0) return null;
    return {
      minX: minX,
      minY: minY,
      maxX: maxX,
      maxY: maxY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
      count: count
    };
  }

  function measureWorldSubtreeBounds(allowedUidSet) {
    var rootNode = mindMapInstance && mindMapInstance.renderer && mindMapInstance.renderer.root;
    if (!rootNode) return null;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    var count = 0;

    function walk(node) {
      if (!node) return;
      var uid = (typeof node.getData === 'function' ? node.getData('uid') : '') ||
                (node.nodeData && node.nodeData.data && node.nodeData.data.uid) || '';
      var include = !allowedUidSet || (uid && allowedUidSet.has(uid));
      if (include && typeof node.left === 'number' && typeof node.top === 'number' && node.width > 0 && node.height > 0) {
        if (node.left < minX) minX = node.left;
        if (node.top < minY) minY = node.top;
        if (node.left + node.width > maxX) maxX = node.left + node.width;
        if (node.top + node.height > maxY) maxY = node.top + node.height;
        count++;
      }
      var isExpanded = (typeof node.getData === 'function' ? node.getData('expand') : true) !== false;
      if (isExpanded && Array.isArray(node.children)) {
        for (var i = 0; i < node.children.length; i++) {
          walk(node.children[i]);
        }
      }
    }

    walk(rootNode);
    if (count === 0) return null;
    return {
      minX: minX,
      minY: minY,
      maxX: maxX,
      maxY: maxY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
      count: count
    };
  }

  function getCustomNodesRbox() {
    var b = measureTargetCardsBounds(null);
    if (!b) return null;
    // 预留顶部悬浮栏与底部工具栏的安全边距
    return {
      x: b.minX,
      y: b.minY - 18,
      width: b.width,
      height: Math.max(1, b.height + 36)
    };
  }

  var currentFlightRaf = null;

  function stopCameraFlight() {
    if (currentFlightRaf) {
      cancelAnimationFrame(currentFlightRaf);
      currentFlightRaf = null;
    }
  }

  // 丝滑 cubic-bezier 减速缓动曲线: easeOutCubic (t => 1 - (1-t)^3)
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function flyCameraTo(targetScale, targetX, targetY, options, onComplete) {
    if (!mindMapInstance || !mindMapInstance.view) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }
    stopCameraFlight();

    if (typeof targetScale !== 'number' || isNaN(targetScale) ||
        typeof targetX !== 'number' || isNaN(targetX) ||
        typeof targetY !== 'number' || isNaN(targetY)) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }

    var opts = options || {};
    var duration = typeof opts.duration === 'number' ? opts.duration : 250;
    var startScale = mindMapInstance.view.scale;
    var startX = mindMapInstance.view.x;
    var startY = mindMapInstance.view.y;

    if (typeof startScale !== 'number' || isNaN(startScale)) startScale = 1;
    if (typeof startX !== 'number' || isNaN(startX)) startX = 0;
    if (typeof startY !== 'number' || isNaN(startY)) startY = 0;

    var dx = Math.abs(targetX - startX);
    var dy = Math.abs(targetY - startY);
    var ds = Math.abs(targetScale - startScale);

    if (dx < 0.5 && dy < 0.5 && ds < 0.005) {
      mindMapInstance.view.scale = targetScale;
      mindMapInstance.view.x = targetX;
      mindMapInstance.view.y = targetY;
      if (typeof mindMapInstance.view.transform === 'function') mindMapInstance.view.transform();
      if (typeof mindMapInstance.view.emitEvent === 'function') {
        mindMapInstance.view.emitEvent('scale');
        mindMapInstance.view.emitEvent('translate');
      }
      if (structureController) structureController.updateZoomDisplay();
      syncAssociativeLinesState();
      if (typeof onComplete === 'function') onComplete();
      return;
    }

    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var elapsed = timestamp - startTime;
      var progress = Math.min(1, elapsed / duration);
      var eased = easeOutCubic(progress);

      var curScale = startScale + (targetScale - startScale) * eased;
      var curX = startX + (targetX - startX) * eased;
      var curY = startY + (targetY - startY) * eased;

      mindMapInstance.view.scale = curScale;
      mindMapInstance.view.x = curX;
      mindMapInstance.view.y = curY;
      if (typeof mindMapInstance.view.transform === 'function') {
        mindMapInstance.view.transform();
      }

      if (progress < 1) {
        currentFlightRaf = requestAnimationFrame(step);
      } else {
        currentFlightRaf = null;
        mindMapInstance.view.scale = targetScale;
        mindMapInstance.view.x = targetX;
        mindMapInstance.view.y = targetY;
        if (typeof mindMapInstance.view.transform === 'function') {
          mindMapInstance.view.transform();
        }
        if (typeof mindMapInstance.view.emitEvent === 'function') {
          mindMapInstance.view.emitEvent('scale');
          mindMapInstance.view.emitEvent('translate');
        }
        if (structureController) structureController.updateZoomDisplay();
        syncAssociativeLinesState();
        if (typeof onComplete === 'function') {
          onComplete();
        }
      }
    }

    currentFlightRaf = requestAnimationFrame(step);
  }

  function computeSubtreeViewport(targetRootUids, options) {
    if (!mindMapInstance || !mindMapInstance.view) return null;
    var opts = options || {};
    var pad = typeof opts.padding === 'number' ? opts.padding : 48;
    var minReadableScale = typeof opts.minReadableScale === 'number' ? opts.minReadableScale : 0;
    var maxScale = typeof opts.maxScale === 'number' ? opts.maxScale : 1.08;
    var verticalAnchor = opts.verticalAnchor || 'auto'; // 'auto' | 'top' | 'center'
    var horizontalAnchor = opts.horizontalAnchor || 'auto'; // 'auto' | 'left' | 'right' | 'center'
    var allowHorizontalOverflow = Boolean(opts.allowHorizontalOverflow);

    var allowedUidSet = collectSubtreeUidSet(targetRootUids);
    var wb = measureWorldSubtreeBounds(allowedUidSet) || measureWorldSubtreeBounds(null);
    if (!wb) {
      return null;
    }

    var container = document.getElementById('cognitiveMindMapContainer');
    var cRect = container ? container.getBoundingClientRect() : null;
    var vw = (cRect && cRect.width > 0) ? cRect.width : (mindMapInstance.width || 1440);
    var vh = (cRect && cRect.height > 0) ? cRect.height : (mindMapInstance.height || 900);

    var padX = pad;
    var topPad = Math.max(44, pad);
    var bottomPad = Math.max(64, pad + 18);
    var availW = Math.max(240, vw - padX * 2);
    var availH = Math.max(240, vh - topPad - bottomPad);

    var scaleToFitW = availW / Math.max(1, wb.width);
    var scaleToFitH = availH / Math.max(1, wb.height);
    var targetScale = Math.min(scaleToFitW, scaleToFitH);

    if (minReadableScale > 0 && targetScale < minReadableScale) {
      targetScale = allowHorizontalOverflow ? minReadableScale : Math.min(scaleToFitW, minReadableScale);
    }
    if (maxScale > 0 && targetScale > maxScale) {
      targetScale = maxScale;
    }
    // 允许鸟瞰全景按需缩至 0.05，不再被 0.25 限制导致全图溢出视口
    targetScale = Math.max(0.05, targetScale);

    // 水平定位计算：根据目标子树生长方向与水平锚点做智能自适应居中排版
    var worldCenterX = (wb.minX + wb.maxX) / 2;
    var targetX;
    var scaledSubtreeW = wb.width * targetScale;
    if (horizontalAnchor === 'right') {
      if (scaledSubtreeW <= availW) {
        // 子树宽度未充满视口：整体居中平衡，主节点自然处于中央偏右，两边对称留白
        targetX = (vw / 2) - worldCenterX * targetScale;
      } else {
        // 子树超宽：保留 22%~25% 视口宽度的充裕呼吸区（不少于 260px），主节点不贴边缘
        var breathPadRight = Math.max(260, vw * 0.24);
        targetX = (vw - breathPadRight) - wb.maxX * targetScale;
      }
    } else if (horizontalAnchor === 'left') {
      if (scaledSubtreeW <= availW) {
        // 整体居中
        targetX = (vw / 2) - worldCenterX * targetScale;
      } else {
        // 预留左侧呼吸区（不少于 240px）
        var breathPadLeft = Math.max(240, vw * 0.22);
        targetX = breathPadLeft - wb.minX * targetScale;
      }
    } else {
      // 标准几何居中
      targetX = (vw / 2) - worldCenterX * targetScale;
    }

    // 垂直定位计算：
    // 1. 若显式指定 verticalAnchor === 'top'，或 auto 模式下子树高度溢出可用高度，采用顶部安全对齐
    // 2. 若显式指定 verticalAnchor === 'center'，以视口垂直中心为基准居中，并做双向防溢出微调
    var scaledH = wb.height * targetScale;
    var isTallSubtree = scaledH > availH + 8;
    var shouldAlignTop = (verticalAnchor === 'top') ||
                         (verticalAnchor === 'auto' && isTallSubtree);

    var worldCenterY = (wb.minY + wb.maxY) / 2;
    var targetY;
    if (shouldAlignTop) {
      targetY = topPad - wb.minY * targetScale;
    } else {
      var viewportCenterY = (topPad + (vh - bottomPad)) / 2;
      targetY = viewportCenterY - worldCenterY * targetScale;

      // 垂直居中态双向防溢出优化：若底部超出视口且顶部有安全余量，向上微调使底部节点完整入屏
      var minSafeTopCenter = 16;
      var maxSafeBottomCenter = vh - 16;
      var curTop = wb.minY * targetScale + targetY;
      var curBottom = wb.maxY * targetScale + targetY;
      if (curBottom > maxSafeBottomCenter && curTop > minSafeTopCenter) {
        var shiftUp = Math.min(curBottom - maxSafeBottomCenter, curTop - minSafeTopCenter);
        targetY -= shiftUp;
      }
    }

    // 顶部安全边距严格保底：杜绝任何情况下节点卡片被顶出视口上边缘（防止负坐标切顶）
    var minSafeTop = shouldAlignTop ? topPad : 16;
    if (wb.minY * targetScale + targetY < minSafeTop) {
      targetY = minSafeTop - wb.minY * targetScale;
    }

    return {
      scale: targetScale,
      x: targetX,
      y: targetY
    };
  }

  // 目标子树/全图智能相机定焦：基于 SimpleMindMap 布局树世界坐标一次性精确求解 (scale, x, y)，
  // 排除非目标分支与离屏缓存干扰，支持可读缩放保底 (minReadableScale)、方向性智能锚定与安全边距保底
  function fitSubtreeToViewport(targetRootUids, options) {
    if (!mindMapInstance || !mindMapInstance.view) return false;
    var opts = options || {};
    var computed = computeSubtreeViewport(targetRootUids, opts);
    if (!computed) {
      return false;
    }

    if (opts.animate) {
      flyCameraTo(computed.scale, computed.x, computed.y, {
        duration: typeof opts.duration === 'number' ? opts.duration : 250
      }, opts.onComplete);
      return true;
    }

    stopCameraFlight();

    mindMapInstance.view.scale = computed.scale;
    mindMapInstance.view.x = computed.x;
    mindMapInstance.view.y = computed.y;
    if (typeof mindMapInstance.view.transform === 'function') {
      mindMapInstance.view.transform();
    }
    if (typeof mindMapInstance.view.emitEvent === 'function') {
      mindMapInstance.view.emitEvent('scale');
      mindMapInstance.view.emitEvent('translate');
    }

    if (structureController) structureController.updateZoomDisplay();
    syncAssociativeLinesState();
    return true;
  }

  function fitCanvasToViewport(padding, options) {
    var opts = Object.assign({
      minReadableScale: 0,
      maxScale: 1.0,
      verticalAnchor: 'center',
      horizontalAnchor: 'center',
      allowHorizontalOverflow: false
    }, options || {});
    if (typeof padding === 'number') opts.padding = padding;
    return fitSubtreeToViewport(null, opts);
  }

  function scheduleViewportAction(actionFn, immediateIfReady) {
    var fn = typeof actionFn === 'function' ? actionFn : function () { return fitCanvasToViewport(48); };
    pendingFitOnRender = true;
    pendingViewportAction = fn;
    if (pendingViewportTimer) {
      clearTimeout(pendingViewportTimer);
      pendingViewportTimer = null;
    }
    var isRenderReady = Boolean(
      mindMapInstance &&
      mindMapInstance.renderer &&
      mindMapInstance.renderer.root &&
      !mindMapInstance.renderer.isRendering &&
      !mindMapInstance.renderer.hasWaitRendering
    );
    if (immediateIfReady && isRenderReady) {
      var appliedNow = fn();
      if (appliedNow !== false) {
        pendingFitOnRender = false;
        return;
      }
    }
    pendingViewportTimer = setTimeout(function () {
      pendingViewportTimer = null;
      if (pendingFitOnRender) {
        var appliedLater = fn();
        if (appliedLater !== false) {
          pendingFitOnRender = false;
        }
      }
    }, 450);
  }

  function scheduleFitView(padding, options) {
    scheduleViewportAction(function () {
      return fitCanvasToViewport(padding, options);
    }, false);
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
        fillColor: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
        color: '#1f2329',
        fontSize: 13,
        fontWeight: '600',
        borderColor: 'transparent',
        borderWidth: 0,
        borderRadius: 8,
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
      toggleNodeCluster(uid);
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
  // SimpleMindMap 原生关联线系统深度优化：
  // 1. 强制关联线图层位于节点卡片层下方 (.smm-associative-line-container < .smm-node-container)
  // 2. 正品字 △ 三边自然分流 (左斜边: 上方考点↔左下知识 / 右斜边: 上方考点↔右下招法 / 底边: 左下知识↔右下招法)
  // 3. 移除生硬禁区束腰钳制，采用多端口同心扇出避免交点扎堆与同列掉头
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
      var tree = this.mindMap && this.mindMap.renderer && this.mindMap.renderer.root;
      if (!tree) return;
      this.removeAllLines();
      this.removeControls();
      this.clearActiveLine();

      // 确保关联线图层位于节点图层下方，避免连线压在卡片文字正面引起半透明错觉
      if (this.associativeLineDraw && this.associativeLineDraw.node &&
          this.mindMap && this.mindMap.nodeDraw && this.mindMap.nodeDraw.node) {
        var assocEl = this.associativeLineDraw.node;
        var nodeDrawEl = this.mindMap.nodeDraw.node;
        if (assocEl.parentNode && assocEl.parentNode === nodeDrawEl.parentNode && assocEl.nextSibling !== nodeDrawEl) {
          nodeDrawEl.parentNode.insertBefore(assocEl, nodeDrawEl);
        }
      }

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

          // 在拓扑剪枝聚拢态下：1对1 连线聚拢仅渲染该条连线，1对N 节点聚拢仅渲染中心节点的辐射连线
          if (clusterState && clusterState.active) {
            if (clusterState.mode === 'edge') {
              var isTargetEdge = (e.fromUid === clusterState.edgeFromUid && e.toUid === clusterState.edgeToUid) ||
                                 (e.fromUid === clusterState.edgeToUid && e.toUid === clusterState.edgeFromUid);
              if (!isTargetEdge) return;
            } else if (clusterState.mode === 'node' && clusterState.centerUid) {
              if (e.fromUid !== clusterState.centerUid && e.toUid !== clusterState.centerUid) return;
            }
          }

          var secA = getNodeSector(e.fromNode);
          var secB = getNodeSector(toNode);
          var srcNode = e.fromNode;
          var dstNode = toNode;
          var srcUid = e.fromUid;
          var dstUid = e.toUid;
          var srcSector = secA;
          var dstSector = secB;

          // 归一化边方向：上方考点 (top_exam) 始终作为起点，或底边左下知识 (left_know) 作为起点
          if (secB === 'top_exam' && secA !== 'top_exam') {
            srcNode = toNode;
            dstNode = e.fromNode;
            srcUid = e.toUid;
            dstUid = e.fromUid;
            srcSector = secB;
            dstSector = secA;
          } else if (secA === 'right_method' && secB === 'left_know') {
            srcNode = toNode;
            dstNode = e.fromNode;
            srcUid = e.toUid;
            dstUid = e.fromUid;
            srcSector = secB;
            dstSector = secA;
          }

          validEdges.push({
            fromNode: srcNode,
            toNode: dstNode,
            fromUid: srcUid,
            toUid: dstUid,
            srcSector: srcSector,
            dstSector: dstSector,
            pairKey: pairKey
          });
        }
      });

      if (validEdges.length === 0) return;

      // 1. 多端口拓扑分配：按上方考点底边框、左下知识右边框、右下招法左边框分别排序，杜绝同心扇出交叉
      var examPortGroups = new Map();
      var sidePortsMap = new Map();

      validEdges.forEach(function (edge) {
        if (edge.srcSector === 'top_exam') {
          if (!examPortGroups.has(edge.fromNode)) {
            examPortGroups.set(edge.fromNode, { toKnow: [], toMethod: [] });
          }
          var grp = examPortGroups.get(edge.fromNode);
          if (edge.dstSector === 'left_know') {
            grp.toKnow.push(edge);
          } else {
            grp.toMethod.push(edge);
          }
        } else {
          if (!sidePortsMap.has(edge.fromNode)) sidePortsMap.set(edge.fromNode, []);
          sidePortsMap.get(edge.fromNode).push({
            edge: edge,
            isFrom: true,
            otherSector: edge.dstSector,
            otherX: edge.toNode.left + edge.toNode.width / 2,
            otherY: edge.toNode.top + edge.toNode.height / 2
          });
        }

        if (edge.dstSector !== 'top_exam') {
          if (!sidePortsMap.has(edge.toNode)) sidePortsMap.set(edge.toNode, []);
          sidePortsMap.get(edge.toNode).push({
            edge: edge,
            isFrom: false,
            otherSector: edge.srcSector,
            otherX: edge.fromNode.left + edge.fromNode.width / 2,
            otherY: edge.fromNode.top + edge.fromNode.height / 2
          });
        }
      });

      // 1a. 为上方考点节点 (kp_gs01_*) 分配底边框左右分流端口 X 坐标
      examPortGroups.forEach(function (grp, kpNode) {
        var kpBottomY = kpNode.top + kpNode.height;
        var kpCenterX = kpNode.left + kpNode.width / 2;

        // 发往左下知识节点的端口：目标 Y 越小越靠左，目标 Y 越大越靠右（外圈包内圈，零交叉）
        grp.toKnow.sort(function (a, b) {
          return (a.toNode.top + a.toNode.height / 2) - (b.toNode.top + b.toNode.height / 2);
        });
        var knowLen = grp.toKnow.length;
        var avgKnowRightX = knowLen > 0
          ? grp.toKnow.reduce(function (s, e) { return s + e.toNode.left + e.toNode.width; }, 0) / knowLen
          : kpNode.left;
        var leftAnchorX = Math.max(
          kpNode.left + kpNode.width * 0.28,
          Math.min(kpNode.left + kpNode.width * 0.62, avgKnowRightX + 34)
        );
        var knowPortStep = 12;
        grp.toKnow.forEach(function (e, idx) {
          var offset = knowLen === 1 ? 0 : ((idx - (knowLen - 1) / 2) * knowPortStep);
          e.startX = leftAnchorX + offset;
          e.startY = kpBottomY;
          e.examFanIndex = idx;
        });

        // 发往右下招法节点的端口：若考点在招法左侧，目标 Y 越大越靠左、越小越靠右（同心嵌套零交叉）
        grp.toMethod.sort(function (a, b) {
          var ay = a.toNode.top + a.toNode.height / 2;
          var by = b.toNode.top + b.toNode.height / 2;
          var mLeft = a.toNode.left;
          return kpCenterX <= mLeft ? (by - ay) : (ay - by);
        });
        var methodLen = grp.toMethod.length;
        var rightAnchorX = Math.max(
          knowLen > 0 ? (leftAnchorX + 26) : (kpNode.left + kpNode.width * 0.52),
          kpNode.left + kpNode.width * 0.68
        );
        var methodPortStep = 11;
        grp.toMethod.forEach(function (e, idx) {
          var offset = methodLen === 1 ? 0 : ((idx - (methodLen - 1) / 2) * methodPortStep);
          e.startX = Math.min(kpNode.left + kpNode.width - 10, rightAnchorX + offset);
          e.startY = kpBottomY;
          e.examFanIndex = idx;
        });
      });

      // 1b. 为左下知识节点 (右边框) 与右下招法节点 (左边框) 分配纵向端口 Y 坐标
      sidePortsMap.forEach(function (portList, node) {
        var nodeSector = getNodeSector(node);
        portList.sort(function (a, b) {
          // 来自上方考点的连线排在上半区，水平底边连线排在下半区
          var aFromTop = a.otherSector === 'top_exam' ? 0 : 1;
          var bFromTop = b.otherSector === 'top_exam' ? 0 : 1;
          if (aFromTop !== bFromTop) return aFromTop - bFromTop;
          if (a.otherSector === 'top_exam') {
            return nodeSector === 'left_know' ? (a.otherX - b.otherX) : (b.otherX - a.otherX);
          }
          return a.otherY - b.otherY;
        });

        var total = portList.length;
        var stepY = Math.min(8, Math.max(4, (node.height * 0.52) / Math.max(1, total)));
        var centerY = node.top + node.height / 2;
        portList.forEach(function (p, idx) {
          var offsetY = total === 1 ? 0 : ((idx - (total - 1) / 2) * stepY);
          var portY = centerY + offsetY;
          var portX = nodeSector === 'left_know' ? (node.left + node.width) : node.left;
          if (p.isFrom) {
            p.edge.startX = portX;
            p.edge.startY = portY;
            p.edge.sidePortIndex = idx;
          } else {
            p.edge.endX = portX;
            p.edge.endY = portY;
            p.edge.sidePortIndex = idx;
          }
        });
      });

      var self = this;

      // 2. 绘制三边自然贝塞尔流线
      validEdges.forEach(function (edge) {
        var fromNode = edge.fromNode;
        var toNode = edge.toNode;
        var fromUid = edge.fromUid;
        var toUid = edge.toUid;

        var startX = typeof edge.startX === 'number' ? edge.startX : (fromNode.left + fromNode.width);
        var startY = typeof edge.startY === 'number' ? edge.startY : (fromNode.top + fromNode.height / 2);
        var endX = typeof edge.endX === 'number' ? edge.endX : toNode.left;
        var endY = typeof edge.endY === 'number' ? edge.endY : (toNode.top + toNode.height / 2);
        var cx1, cy1, cx2, cy2;

        if (edge.srcSector === 'top_exam' && edge.dstSector === 'left_know') {
          // 三角形左斜边流：上方考点底端口 -> 左下知识右端口
          var dyL = Math.max(44, endY - startY);
          var fanIdxL = (edge.examFanIndex || 0) + (edge.sidePortIndex || 0);
          var channelRightShift = 46 + Math.max(0, (startX - endX) * 0.20) + fanIdxL * 12;
          if (clusterState && clusterState.active) {
            channelRightShift += 36; // 聚拢态加大拱度，主动避让密集的 1 层详情卡片正面
          }
          cx1 = startX;
          cy1 = startY + Math.min(115, dyL * 0.44);
          cx2 = endX + channelRightShift;
          cy2 = endY;
        } else if (edge.srcSector === 'top_exam' && edge.dstSector === 'right_method') {
          // 三角形右斜边流：上方考点底端口 -> 右下招法左端口
          var dyR = Math.max(44, endY - startY);
          var fanIdxR = (edge.sidePortIndex || 0);
          var channelLeftShift = 46 + Math.max(0, (endX - startX) * 0.20) + fanIdxR * 10;
          if (clusterState && clusterState.active) {
            channelLeftShift += 36; // 聚拢态加大拱度，主动避让密集的 1 层详情卡片正面
          }
          cx1 = startX;
          cy1 = startY + Math.min(115, dyR * 0.44);
          cx2 = endX - channelLeftShift;
          cy2 = endY;
        } else if (edge.srcSector === 'left_know' && edge.dstSector === 'right_method') {
          // 三角形水平底边流：左下知识右端口 -> 右下招法左端口 (Sugiyama 零交叉单调平行流)
          var spanX = Math.max(80, endX - startX);
          var bowY = (clusterState && clusterState.active) ? 32 : 0; // 聚拢态微向下避让
          cx1 = startX + spanX * 0.36;
          cy1 = startY + bowY;
          cx2 = endX - spanX * 0.36;
          cy2 = endY + bowY;
        } else {
          // 兜底同侧或普通连接
          var dx = endX - startX;
          cx1 = startX + dx * 0.38;
          cy1 = startY;
          cx2 = startX + dx * 0.62;
          cy2 = endY;
        }

        var pathStr = 'M ' + startX.toFixed(1) + ' ' + startY.toFixed(1) +
                      ' C ' + cx1.toFixed(1) + ' ' + cy1.toFixed(1) + ', ' +
                      cx2.toFixed(1) + ' ' + cy2.toFixed(1) + ', ' +
                      endX.toFixed(1) + ' ' + endY.toFixed(1);

        // 真实可视线条 (实线无箭头、底层柔和呈现)
        var path = self.associativeLineDraw.path();
        path.plot(pathStr);
        path.stroke({
          width: 1.45,
          color: '#4068eb'
        }).fill({
          color: 'none'
        });
        if (path.node) {
          path.node.setAttribute('class', 'smm-associative-line-path');
          path.node.setAttribute('data-from-uid', fromUid);
          path.node.setAttribute('data-to-uid', toUid);
          path.node.style.strokeDasharray = 'none';
        }

        // 宽截面点击与悬停感应区 (16px 判定区)
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
          clickPath.node.addEventListener('mouseenter', function () {
            hoveredEdgePair = { from: fromUid, to: toUid };
            syncAssociativeLinesState();
          });
          clickPath.node.addEventListener('mouseleave', function () {
            hoveredEdgePair = null;
            syncAssociativeLinesState();
          });
          clickPath.node.addEventListener('mousedown', function (e) {
            e.stopPropagation();
          });
          clickPath.node.addEventListener('mouseup', function (e) {
            e.stopPropagation();
          });
          // 左键点击某条关联线：触发 1对1 端点拓扑剪枝聚拢（再次点击同一条激活线则退出聚拢）
          clickPath.node.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            toggleEdgeCluster(fromUid, toUid);
          });
        }

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

    ensureBuiltInChaptersRegistered();

    var isEnglish = (currentActiveSubject === 'english' || window.curSubjectId === 'english' || (window.curSubject && window.curSubject.type === 'english'));
    if (isEnglish) {
      currentLayerMode = 'chapter';
      currentChapterId = 'english_translation';
    } else if (currentLayerMode !== 'subject_macro' && (!currentChapterId || !chapterRegistry.has(currentChapterId))) {
      currentChapterId = 'math_ch1';
    }
    var initialData;
    var preserveExpandOnInit = Boolean(initMindMap._preserveExpandState);
    if (currentLayerMode === 'subject_macro' && !isEnglish) {
      currentChapterId = 'macro_' + (currentActiveSubject || 'math');
      initialData = buildSubjectMacroTree(currentActiveSubject || 'math', 3, {
        preserveExpandState: preserveExpandOnInit
      });
    } else {
      initialData = getInitialChapterData(currentChapterId, {
        preserveExpandState: preserveExpandOnInit
      });
    }
    applySemanticClustering(initialData);

    mindMapInstance = new MindMap({
      el: container,
      data: initialData,
      layout: 'mindMap', // 正品字 △ 混合结构三角布局（上方：考点目录组织图，左下：知识向左逻辑图，右下：招法向右逻辑图）
      theme: 'cognitive_modern',
      associativeLineIsAlwaysAboveNode: false, // 关联线严格处于节点卡片下方，杜绝连线压在节点文字表面造成半透明感
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

    var origRender = mindMapInstance.render.bind(mindMapInstance);
    mindMapInstance.render = function (callback, source) {
      return origRender(function () {
        mindMapInstance.emit('node_tree_render_end');
        if (typeof callback === 'function') {
          callback();
        }
      }, source);
    };

    mindMapInstance.on('data_change', function () {
      persistCurrentMindMapState();
    });

    installHybridTriangleLayoutHook(mindMapInstance);
    mindMapInstance.on('layout_change', function () {
      installHybridTriangleLayoutHook(mindMapInstance);
    });

    // 悬停有关联线的节点卡片时，高亮其关联线（无点击锁定时生效）
    container.addEventListener('mouseover', function (e) {
      var card = e.target && e.target.closest ? e.target.closest('.mm-node-card') : null;
      var uid = card ? (card.getAttribute('data-node-uid') || '') : '';
      if (uid && uid !== hoveredResonanceUid) {
        var t = getTargetsByUid(uid);
        hoveredResonanceUid = (Array.isArray(t) && t.length > 0) ? uid : null;
        syncAssociativeLinesState();
      } else if (!uid && hoveredResonanceUid) {
        hoveredResonanceUid = null;
        syncAssociativeLinesState();
      }
    });
    container.addEventListener('mouseleave', function () {
      if (hoveredResonanceUid || hoveredEdgePair) {
        hoveredResonanceUid = null;
        hoveredEdgePair = null;
        syncAssociativeLinesState();
      }
    });

    // 监听原生缩放事件，同步更新底栏比例显示
    mindMapInstance.on('scale', function (scale) {
      if (structureController && typeof structureController.updateZoomDisplay === 'function') {
        structureController.updateZoomDisplay(scale);
      }
    });

    // 确保双向布局下同一类的二级节点严格聚拢在一起
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

      if (mindMapInstance.renderer && mindMapInstance.renderer.renderTree) {
        applySemanticClustering(mindMapInstance.renderer.renderTree);
      }
      installHybridTriangleLayoutHook(mindMapInstance);
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
      outliner.on('change', function () {
        persistCurrentMindMapState();
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
      if (typeof dualViewController.on === 'function') {
        dualViewController.on('view_change', function () {
          saveCognitiveState();
        });
      }
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
        onLevelChange: function (lvl, treeModified) {
          updateLevelButtonsUI(lvl);
          var flightDuration = treeModified ? 160 : 250;
          var fitOpts;
          if (lvl === 3 || lvl === 0) {
            fitOpts = { minReadableScale: 0, maxScale: 1.0, verticalAnchor: 'center', horizontalAnchor: 'center', allowHorizontalOverflow: false, animate: true, duration: flightDuration };
          } else if (lvl === 1) {
            fitOpts = { minReadableScale: 0.88, maxScale: 1.05, verticalAnchor: 'center', horizontalAnchor: 'center', allowHorizontalOverflow: false, animate: true, duration: flightDuration };
          } else {
            fitOpts = { minReadableScale: 0.85, maxScale: 1.05, verticalAnchor: 'center', horizontalAnchor: 'center', allowHorizontalOverflow: false, animate: true, duration: flightDuration };
          }
          scheduleViewportAction(function () {
            return fitCanvasToViewport(48, fitOpts);
          }, !treeModified);
          scheduleSaveCognitiveState();
        },
        onCategoryFocus: function (targetCategory, activeStep, cycleState, treeModified) {
          updateLevelButtonsUI(99);
          if (activeStep && activeStep.chapterId) {
            macroFocusedChapterId = activeStep.chapterId;
            updateBottomCapsuleUI();
          }
          var rootUids = (activeStep && Array.isArray(activeStep.targetRootUids)) ? activeStep.targetRootUids : [];
          var flightDuration = treeModified ? 160 : 250;
          var fitOpts = {
            padding: 48,
            minReadableScale: (activeStep && typeof activeStep.minReadableScale === 'number') ? activeStep.minReadableScale : 0.84,
            maxScale: (activeStep && typeof activeStep.maxScale === 'number') ? activeStep.maxScale : 1.05,
            verticalAnchor: (activeStep && activeStep.verticalAnchor) ? activeStep.verticalAnchor : 'auto',
            horizontalAnchor: (activeStep && activeStep.horizontalAnchor) ? activeStep.horizontalAnchor : 'auto',
            allowHorizontalOverflow: (activeStep && typeof activeStep.allowHorizontalOverflow === 'boolean') ? activeStep.allowHorizontalOverflow : true,
            animate: true,
            duration: flightDuration
          };
          scheduleViewportAction(function () {
            return fitSubtreeToViewport(rootUids, fitOpts);
          }, !treeModified);
          scheduleSaveCognitiveState();
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
            var rTree = (mindMapInstance.renderer && mindMapInstance.renderer.renderTree) || mindMapInstance.getData(false);
            applySemanticClustering(rTree);
          }
          updateNexusLines();
        }
      });
      updateBottomCapsuleUI();
    }

    // 节点右键交互：右键点击存在关联线的节点，触发 1对N 原树拓扑剪枝聚拢（拖拽平移画布时不误触）
    function handleNodeContextMenuEvent(e, fallbackNode) {
      if (clusterState.rightDownPos && e && typeof e.clientX === 'number' && typeof e.clientY === 'number') {
        var dx = e.clientX - clusterState.rightDownPos.x;
        var dy = e.clientY - clusterState.rightDownPos.y;
        if (Math.hypot(dx, dy) > 6) {
          return;
        }
      }
      var card = (e && e.target && e.target.closest) ? e.target.closest('.mm-node-card') : null;
      var uid = card ? (card.getAttribute('data-node-uid') || '') : getNodeUid(fallbackNode);
      if (!uid) return;

      var now = Date.now();
      if (now - clusterState.lastContextMenuTime < 80) {
        if (e && e.preventDefault) e.preventDefault();
        if (e && e.stopPropagation) e.stopPropagation();
        return;
      }

      var targets = getTargetsByUid(uid);
      if (Array.isArray(targets) && targets.length > 0) {
        if (e && e.preventDefault) e.preventDefault();
        if (e && e.stopPropagation) e.stopPropagation();
        clusterState.lastContextMenuTime = now;
        toggleNodeCluster(uid);
      }
    }

    container.addEventListener('mousedown', function (e) {
      if (currentFlightRaf) {
        cancelAnimationFrame(currentFlightRaf);
        currentFlightRaf = null;
      }
      if (e.button === 2) {
        clusterState.rightDownPos = { x: e.clientX, y: e.clientY };
      }
    }, true);

    container.addEventListener('wheel', function () {
      if (currentFlightRaf) {
        cancelAnimationFrame(currentFlightRaf);
        currentFlightRaf = null;
      }
    }, { capture: true, passive: true });

    container.addEventListener('contextmenu', function (e) {
      handleNodeContextMenuEvent(e, null);
    }, true);

    mindMapInstance.on('node_contextmenu', function (e, node) {
      handleNodeContextMenuEvent(e, node);
    });

    // 画布背景左键点击：若处于拓扑剪枝聚拢态则退出聚拢恢复全图，否则清除共鸣高亮、几何浮层并收起快捷键抽屉
    mindMapInstance.on('draw_click', function () {
      if (clusterState.active) {
        exitClusterMode();
      } else {
        clearFocusResonance();
      }
      if (window.MathVizWidget && typeof window.MathVizWidget.closePopover === 'function') {
        window.MathVizWidget.closePopover();
      }
      if (shortcutDrawer && shortcutDrawer.isOpen) {
        shortcutDrawer.close();
      }
    });

    // 节点左键点击：保持与其他节点一致的常规选中行为（不触发拓扑剪枝，L静音下透出当前选中节点的关联线）
    mindMapInstance.on('node_click', function (node) {
      if (!node || typeof node.getData !== 'function') return;
      if (clusterState.active) {
        return;
      }
      var uid = node.getData('uid');
      if (!uid) {
        clearFocusResonance();
        return;
      }
      var srcChId = node.getData('sourceChapterId') || node.getData('targetChapterId');
      if (currentLayerMode === 'subject_macro' && srcChId) {
        macroFocusedChapterId = srcChId;
        updateBottomCapsuleUI();
      }
      if (currentLayerMode === 'subject_macro' && node.getData('isMacroChapterGroup') && node.getData('expand') === false) {
        if (typeof node.setData === 'function') {
          node.setData({ expand: true });
        }
        if (node.nodeData && node.nodeData.data) {
          node.nodeData.data.expand = true;
        }
        mindMapInstance.render();
      }
      var targets = getTargetsByUid(uid);
      if (Array.isArray(targets) && targets.length > 0) {
        activeResonanceUid = uid;
        syncAssociativeLinesState();
      } else {
        clearFocusResonance();
      }
    });

    // 视口平移与缩放后，防抖记忆当前相机坐标（漫游过程中剥离高频 DOM 操作，保持纯 GPU 硬件加速）
    mindMapInstance.on('view_after_render', function () {
      scheduleSaveCognitiveState();
    });

    mindMapInstance.on('node_tree_render_end', function () {
      if (pendingFitOnRender && mindMapInstance && mindMapInstance.view) {
        var applied = false;
        if (typeof pendingViewportAction === 'function') {
          applied = (pendingViewportAction() !== false);
        } else {
          applied = (fitCanvasToViewport() !== false);
        }
        if (applied) {
          pendingFitOnRender = false;
          if (pendingViewportTimer) {
            clearTimeout(pendingViewportTimer);
            pendingViewportTimer = null;
          }
        }
      }
      if (mindMapInstance.associativeLine && typeof mindMapInstance.associativeLine.renderAllLines === 'function') {
        mindMapInstance.associativeLine.renderAllLines();
      }
      if (clusterState.active) {
        executeClusterHighlight();
      }
      syncAssociativeLinesState();
      updateNexusLines();
    });

    mindMapInstance.on('scale', function () {
      if (structureController && typeof structureController.updateZoomDisplay === 'function') {
        structureController.updateZoomDisplay();
      }
    });

    if (mindMapInstance.associativeLine) {
      if (typeof mindMapInstance.associativeLine.unBindEvent === 'function') {
        mindMapInstance.associativeLine.unBindEvent();
      }
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
    scheduleFitView(48, { minReadableScale: 0, maxScale: 1.0, verticalAnchor: 'center', horizontalAnchor: 'center', allowHorizontalOverflow: false });
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
    // 若当前处于拓扑剪枝聚拢态，优先从完整章节备份树查询无向邻接表，保证聚拢态内漫游切换时不丢失被剪枝节点的反向关联
    if (clusterState.active && clusterState.fullTreeBackup) {
      var fullAdjMap = buildUndirectedAdjacencyMap(clusterState.fullTreeBackup);
      if (fullAdjMap.has(uid) && fullAdjMap.get(uid).size > 0) {
        return Array.from(fullAdjMap.get(uid));
      }
    }
    if (mindMapInstance) {
      var curTree = (mindMapInstance.renderer && mindMapInstance.renderer.renderTree) || mindMapInstance.getData(false);
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
    var treeData = (mindMapInstance.renderer && mindMapInstance.renderer.renderTree) || mindMapInstance.getData(false);
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
      mindMapInstance.render(function () {
        if (callback) callback();
      });
    } else {
      if (callback) callback();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 原树拓扑剪枝聚拢引擎 (Topological Pruning & Clustering Engine)
  // 保持「上考点 ↑ · 左知识 ← · 右解法 →」方位不变，剪除无关兄弟分支与无关节点，
  // 自动展开涉及节点的 1 层直接细节子节点（更深层孙节点保持折叠），并自适应定焦放大视口
  // ─────────────────────────────────────────────────────────────
  function clearCachedTreeLines() {
    if (!mindMapInstance || !mindMapInstance.renderer) return;
    var r = mindMapInstance.renderer;
    var caches = [r.nodeCache, r.lastNodeCache];
    for (var c = 0; c < caches.length; c++) {
      var mapObj = caches[c];
      if (mapObj && typeof mapObj === 'object') {
        Object.keys(mapObj).forEach(function (k) {
          var n = mapObj[k];
          if (n && typeof n.removeLine === 'function') {
            n.removeLine();
          }
        });
      }
    }
  }

  function buildPrunedClusterTree(fullTree, involvedUidSet) {
    if (!fullTree || !involvedUidSet || involvedUidSet.size === 0) return null;

    var subtreeHasInvolved = new WeakMap();
    function checkSubtree(node) {
      if (!node) return false;
      var uid = (node.data && node.data.uid) || '';
      var selfIn = Boolean(uid && involvedUidSet.has(uid));
      var childIn = false;
      if (Array.isArray(node.children)) {
        for (var i = 0; i < node.children.length; i++) {
          if (checkSubtree(node.children[i])) {
            childIn = true;
          }
        }
      }
      var res = selfIn || childIn;
      subtreeHasInvolved.set(node, res);
      return res;
    }
    checkSubtree(fullTree);

    function pruneWalk(node, distFromInvolved, isRoot) {
      if (!node) return null;
      var uid = (node.data && node.data.uid) || '';
      var isSelfInvolved = Boolean(uid && involvedUidSet.has(uid));
      var hasInvolvedDescendant = false;
      if (Array.isArray(node.children)) {
        for (var i = 0; i < node.children.length; i++) {
          if (subtreeHasInvolved.get(node.children[i])) {
            hasInvolvedDescendant = true;
            break;
          }
        }
      }

      var myDist = isSelfInvolved ? 0 : (distFromInvolved !== null ? distFromInvolved + 1 : null);

      // 保留条件：根节点、通往涉及节点的祖先路径节点、涉及节点自身、或涉及节点下属子树节点
      if (!isRoot && !isSelfInvolved && !hasInvolvedDescendant && myDist === null) {
        return null;
      }

      var cloned = cloneCleanTree({ data: node.data, children: [] });
      if (!cloned.data) cloned.data = {};

      if (isRoot) {
        cloned.data.expand = true;
        cloned.data._isClusterPruned = true;
      } else if (hasInvolvedDescendant) {
        // 通往涉及节点的分类/小节骨架祖先：强制展开以连通涉及节点
        cloned.data.expand = true;
      } else if (isSelfInvolved) {
        // 涉及节点自身 (myDist === 0)：自动展开其直接下属的 1 层子节点（题源/要领/公式/步骤）
        cloned.data.expand = Boolean(Array.isArray(node.children) && node.children.length > 0);
      } else {
        // 涉及节点的第 1 层细节子节点 (myDist === 1) 及其更深层孙节点 (myDist >= 2)：自身保持折叠 (expand = false)
        cloned.data.expand = false;
      }

      if (Array.isArray(node.children) && node.children.length > 0) {
        var nextChildren = [];
        for (var j = 0; j < node.children.length; j++) {
          var childCloned = pruneWalk(node.children[j], myDist, false);
          if (childCloned) {
            nextChildren.push(childCloned);
          }
        }
        cloned.children = nextChildren;
      }

      return cloned;
    }

    return pruneWalk(fullTree, null, true);
  }

  function executeClusterHighlight() {
    if (!clusterState.active) return;
    var containerEl = document.querySelector('#cognitiveMindMapContainer .smm-node-container');
    if (containerEl) {
      containerEl.classList.add('has-resonance-focus', 'is-cluster-mode');
    }
    var rootContainer = document.getElementById('cognitiveMindMapContainer');
    if (rootContainer) {
      rootContainer.classList.add('is-cluster-mode');
    }

    var allCardEls = document.querySelectorAll('#cognitiveMindMapContainer .mm-node-card');
    allCardEls.forEach(function (el) {
      el.classList.remove('is-in-resonance', 'resonance-active', 'resonance-linked');
    });

    var allNodeEls = document.querySelectorAll('#cognitiveMindMapContainer .smm-node');
    allNodeEls.forEach(function (el) {
      el.classList.remove('is-in-resonance', 'resonance-active', 'resonance-linked');
    });

    var primaryUid = clusterState.mode === 'edge' ? clusterState.edgeFromUid : clusterState.centerUid;
    if (primaryUid) {
      var srcCard = document.querySelector('#cognitiveMindMapContainer [data-node-uid="' + primaryUid + '"]');
      if (srcCard) {
        srcCard.classList.add('is-in-resonance', 'resonance-active');
        var parentSmmNode = srcCard.closest('.smm-node');
        if (parentSmmNode) {
          parentSmmNode.classList.add('is-in-resonance', 'resonance-active');
        }
      }
    }

    (clusterState.involvedUids || []).forEach(function (u) {
      if (!u || u === primaryUid) return;
      var targetEl = document.querySelector('#cognitiveMindMapContainer [data-node-uid="' + u + '"]');
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

  function applyClusterTreeAndFit(prunedTree) {
    if (!mindMapInstance || !mindMapInstance.renderer || !prunedTree) return false;
    applySemanticClustering(prunedTree);
    clearCachedTreeLines();
    if (typeof mindMapInstance.renderer.clearActiveNodeList === 'function') {
      mindMapInstance.renderer.clearActiveNodeList();
    } else {
      mindMapInstance.renderer.activeNodeList = [];
    }

    var clusterFitOpts = {
      minReadableScale: 0.78,
      maxScale: 1.05,
      verticalAnchor: 'center',
      horizontalAnchor: 'center',
      allowHorizontalOverflow: false,
      animate: true,
      duration: 280
    };

    scheduleViewportAction(function () {
      var ok = fitCanvasToViewport(44, clusterFitOpts);
      executeClusterHighlight();
      return ok;
    }, false);

    if (typeof mindMapInstance.renderer.setData === 'function') {
      mindMapInstance.renderer.setData(prunedTree);
    } else {
      mindMapInstance.renderer.renderTree = prunedTree;
    }

    mindMapInstance.render(function () {
      if (pendingViewportTimer) {
        clearTimeout(pendingViewportTimer);
        pendingViewportTimer = null;
      }
      if (pendingFitOnRender) {
        pendingFitOnRender = false;
        fitCanvasToViewport(44, clusterFitOpts);
      }
      if (mindMapInstance.associativeLine && typeof mindMapInstance.associativeLine.renderAllLines === 'function') {
        mindMapInstance.associativeLine.renderAllLines();
      }
      executeClusterHighlight();
    });
    return true;
  }

  // 进入 1对N 关联节点拓扑剪枝聚拢
  function enterNodeCluster(uid) {
    if (!mindMapInstance || !uid) return false;
    var curTree = (mindMapInstance.renderer && mindMapInstance.renderer.renderTree) || mindMapInstance.getData(false);
    if (!curTree) return false;

    if (clusterState.active && clusterState.fullTreeBackup) {
      syncPrunedChangesToFullTree(curTree, clusterState.fullTreeBackup);
    } else {
      clusterState.fullTreeBackup = cloneCleanTree(curTree);
      if (clusterState.fullTreeBackup && clusterState.fullTreeBackup.data) {
        delete clusterState.fullTreeBackup.data._isClusterPruned;
      }
    }

    var baseFullTree = clusterState.fullTreeBackup;
    var adjMap = buildUndirectedAdjacencyMap(baseFullTree);
    var targets = adjMap.has(uid) ? Array.from(adjMap.get(uid)) : getTargetsByUid(uid);
    if (!Array.isArray(targets) || targets.length === 0) {
      return false;
    }

    var involvedUids = [uid].concat(targets.filter(function (t) { return t && t !== uid; }));
    var involvedSet = new Set(involvedUids);
    var prunedTree = buildPrunedClusterTree(baseFullTree, involvedSet);
    if (!prunedTree) return false;

    clusterState.active = true;
    clusterState.mode = 'node';
    clusterState.centerUid = uid;
    clusterState.edgeFromUid = null;
    clusterState.edgeToUid = null;
    clusterState.involvedUids = involvedUids;
    activeResonanceUid = uid;

    return applyClusterTreeAndFit(prunedTree);
  }

  function toggleNodeCluster(uid) {
    if (!mindMapInstance || !uid) return false;
    if (clusterState.active && clusterState.mode === 'node' && clusterState.centerUid === uid) {
      return exitClusterMode();
    }
    return enterNodeCluster(uid);
  }

  // 进入 1对1 关联线两端节点拓扑剪枝聚拢
  function enterEdgeCluster(fromUid, toUid) {
    if (!mindMapInstance || !fromUid || !toUid || fromUid === toUid) return false;
    var curTree = (mindMapInstance.renderer && mindMapInstance.renderer.renderTree) || mindMapInstance.getData(false);
    if (!curTree) return false;

    if (clusterState.active && clusterState.fullTreeBackup) {
      syncPrunedChangesToFullTree(curTree, clusterState.fullTreeBackup);
    } else {
      clusterState.fullTreeBackup = cloneCleanTree(curTree);
      if (clusterState.fullTreeBackup && clusterState.fullTreeBackup.data) {
        delete clusterState.fullTreeBackup.data._isClusterPruned;
      }
    }

    var baseFullTree = clusterState.fullTreeBackup;
    var involvedUids = [fromUid, toUid];
    var involvedSet = new Set(involvedUids);
    var prunedTree = buildPrunedClusterTree(baseFullTree, involvedSet);
    if (!prunedTree) return false;

    clusterState.active = true;
    clusterState.mode = 'edge';
    clusterState.centerUid = fromUid;
    clusterState.edgeFromUid = fromUid;
    clusterState.edgeToUid = toUid;
    clusterState.involvedUids = involvedUids;
    activeResonanceUid = fromUid;

    return applyClusterTreeAndFit(prunedTree);
  }

  function toggleEdgeCluster(fromUid, toUid) {
    if (!mindMapInstance || !fromUid || !toUid) return false;
    var isSameActiveEdge = clusterState.active && clusterState.mode === 'edge' && (
      (clusterState.edgeFromUid === fromUid && clusterState.edgeToUid === toUid) ||
      (clusterState.edgeFromUid === toUid && clusterState.edgeToUid === fromUid)
    );
    if (isSameActiveEdge) {
      return exitClusterMode();
    }
    return enterEdgeCluster(fromUid, toUid);
  }

  // 退出拓扑剪枝聚拢态，恢复完整章节树
  function exitClusterMode(options) {
    var opts = options || {};
    if (!clusterState.active) {
      if (activeResonanceUid) {
        clearFocusResonance();
      }
      return false;
    }

    var curTree = (mindMapInstance && mindMapInstance.renderer && mindMapInstance.renderer.renderTree) ||
                  (mindMapInstance && mindMapInstance.getData ? mindMapInstance.getData(false) : null);
    if (curTree && clusterState.fullTreeBackup) {
      syncPrunedChangesToFullTree(curTree, clusterState.fullTreeBackup);
    }

    var restoredTree = clusterState.fullTreeBackup ? cloneCleanTree(clusterState.fullTreeBackup) : null;
    if (restoredTree && restoredTree.data) {
      delete restoredTree.data._isClusterPruned;
    }

    clusterState.active = false;
    clusterState.mode = null;
    clusterState.centerUid = null;
    clusterState.edgeFromUid = null;
    clusterState.edgeToUid = null;
    clusterState.involvedUids = [];
    clusterState.fullTreeBackup = null;
    activeResonanceUid = null;

    var containerEl = document.querySelector('#cognitiveMindMapContainer .smm-node-container');
    if (containerEl) {
      containerEl.classList.remove('has-resonance-focus', 'is-cluster-mode');
    }
    var rootContainer = document.getElementById('cognitiveMindMapContainer');
    if (rootContainer) {
      rootContainer.classList.remove('is-cluster-mode');
    }
    var allCardEls = document.querySelectorAll('#cognitiveMindMapContainer .mm-node-card');
    allCardEls.forEach(function (el) {
      el.classList.remove('is-in-resonance', 'resonance-active', 'resonance-linked');
    });
    var allNodeEls = document.querySelectorAll('#cognitiveMindMapContainer .smm-node');
    allNodeEls.forEach(function (el) {
      el.classList.remove('is-in-resonance', 'resonance-active', 'resonance-linked');
    });

    if (mindMapInstance && mindMapInstance.renderer && restoredTree) {
      applySemanticClustering(restoredTree);
      clearCachedTreeLines();
      if (typeof mindMapInstance.renderer.clearActiveNodeList === 'function') {
        mindMapInstance.renderer.clearActiveNodeList();
      } else {
        mindMapInstance.renderer.activeNodeList = [];
      }
      if (typeof mindMapInstance.renderer.setData === 'function') {
        mindMapInstance.renderer.setData(restoredTree);
      } else {
        mindMapInstance.renderer.renderTree = restoredTree;
      }

      if (!opts.restoreOnly) {
        var overviewFitOpts = {
          minReadableScale: 0,
          maxScale: 1.0,
          verticalAnchor: 'center',
          horizontalAnchor: 'center',
          allowHorizontalOverflow: false,
          animate: true,
          duration: 280
        };
        scheduleViewportAction(function () {
          return fitCanvasToViewport(48, overviewFitOpts);
        }, false);
        mindMapInstance.render(function () {
          if (pendingViewportTimer) {
            clearTimeout(pendingViewportTimer);
            pendingViewportTimer = null;
          }
          if (pendingFitOnRender) {
            pendingFitOnRender = false;
            fitCanvasToViewport(48, overviewFitOpts);
          }
          if (mindMapInstance.associativeLine && typeof mindMapInstance.associativeLine.renderAllLines === 'function') {
            mindMapInstance.associativeLine.renderAllLines();
          }
          syncAssociativeLinesState();
        });
      } else {
        stopCameraFlight();
      }
    } else {
      syncAssociativeLinesState();
    }

    return true;
  }

  function isClusterActive() {
    return Boolean(clusterState && clusterState.active);
  }

  function getClusterState() {
    return {
      active: Boolean(clusterState.active),
      mode: clusterState.mode,
      centerUid: clusterState.centerUid,
      edgeFromUid: clusterState.edgeFromUid,
      edgeToUid: clusterState.edgeToUid,
      involvedUids: (clusterState.involvedUids || []).slice()
    };
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
    saveCognitiveState();
    return isAssociativeLineVisible;
  }

  function toggleNexusLines(force) {
    return toggleAssociativeLines(force);
  }

  function updateNexusLines() {
    syncAssociativeLinesState();
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

    if (clusterState && clusterState.active && clusterState.mode === 'edge' && clusterState.edgeFromUid && clusterState.edgeToUid) {
      lineContainer.classList.remove('has-hover-selection');
      lineContainer.classList.add('has-active-selection');
      visiblePaths.forEach(function (p) {
        p.classList.remove('is-hover-line');
        var from = p.getAttribute('data-from-uid');
        var to = p.getAttribute('data-to-uid');
        var isTargetEdge = (from === clusterState.edgeFromUid && to === clusterState.edgeToUid) ||
                           (from === clusterState.edgeToUid && to === clusterState.edgeFromUid);
        if (isTargetEdge) {
          p.classList.add('is-active-line');
        } else {
          p.classList.remove('is-active-line');
        }
      });
      return;
    }

    if (!activeResonanceUid) {
      lineContainer.classList.remove('has-active-selection');
      visiblePaths.forEach(function (p) {
        p.classList.remove('is-active-line', 'is-hover-line');
      });

      if (isAssociativeLineVisible && (hoveredEdgePair || hoveredResonanceUid)) {
        if (hoveredEdgePair) {
          lineContainer.classList.add('has-hover-selection');
          visiblePaths.forEach(function (p) {
            var f = p.getAttribute('data-from-uid');
            var t = p.getAttribute('data-to-uid');
            if ((f === hoveredEdgePair.from && t === hoveredEdgePair.to) ||
                (f === hoveredEdgePair.to && t === hoveredEdgePair.from)) {
              p.classList.add('is-hover-line');
            }
          });
        } else if (hoveredResonanceUid) {
          var hTargets = new Set(getTargetsByUid(hoveredResonanceUid));
          if (hTargets.size > 0) {
            lineContainer.classList.add('has-hover-selection');
            visiblePaths.forEach(function (p) {
              var f = p.getAttribute('data-from-uid');
              var t = p.getAttribute('data-to-uid');
              if (f === hoveredResonanceUid || t === hoveredResonanceUid ||
                  (f === hoveredResonanceUid && hTargets.has(t)) ||
                  (t === hoveredResonanceUid && hTargets.has(f))) {
                p.classList.add('is-hover-line');
              }
            });
          } else {
            lineContainer.classList.remove('has-hover-selection');
          }
        }
      } else {
        lineContainer.classList.remove('has-hover-selection');
      }
      return;
    }

    lineContainer.classList.remove('has-hover-selection');
    lineContainer.classList.add('has-active-selection');
    var targets = getTargetsByUid(activeResonanceUid);
    var targetSet = new Set(targets);

    visiblePaths.forEach(function (p) {
      p.classList.remove('is-hover-line');
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
      containerEl.classList.remove('is-cluster-mode');
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
    if (clusterState.active) {
      exitClusterMode({ restoreOnly: true });
    }
    activeResonanceUid = uid;

    var targets = getTargetsByUid(uid);
    var nodesToEnsure = [uid].concat(targets);
    ensureNodesExpanded(nodesToEnsure, function () {
      executeResonanceHighlight(uid, targets);
    });
  }

  function toggleFocusResonanceByUid(uid) {
    if (!mindMapInstance || !uid) return;
    if (activeResonanceUid === uid && !clusterState.active) {
      clearFocusResonance();
    } else {
      applyFocusResonanceByUid(uid);
    }
  }

  function clearFocusResonance() {
    if (clusterState.active) {
      exitClusterMode();
      return;
    }
    activeResonanceUid = null;
    var containerEl = document.querySelector('#cognitiveMindMapContainer .smm-node-container');
    if (containerEl) {
      containerEl.classList.remove('has-resonance-focus', 'is-cluster-mode');
    }
    var rootContainer = document.getElementById('cognitiveMindMapContainer');
    if (rootContainer) {
      rootContainer.classList.remove('is-cluster-mode');
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

  // 展开至指定层级 (1=分节骨架，2=核心全景同级对齐，3=微观详情可读聚焦)
  function expandToLevel(level) {
    if (!mindMapInstance) return;
    if (shortcutManager && typeof shortcutManager.expandToLevel === 'function') {
      shortcutManager.expandToLevel(level);
      return;
    }
    if (clusterState.active) {
      exitClusterMode({ restoreOnly: true });
    }
    if (typeof mindMapInstance.execCommand === 'function') {
      mindMapInstance.execCommand('UNEXPAND_TO_LEVEL', level);
    }
    updateLevelButtonsUI(level);
    scheduleFitView();
  }

  function expandAll() {
    if (!mindMapInstance) return;
    if (shortcutManager && typeof shortcutManager.expandAll === 'function') {
      shortcutManager.expandAll();
      return;
    }
    if (clusterState.active) {
      exitClusterMode({ restoreOnly: true });
    }
    if (typeof mindMapInstance.execCommand === 'function') {
      mindMapInstance.execCommand('EXPAND_ALL');
    }
    updateLevelButtonsUI(0);
    scheduleFitView(48, { minReadableScale: 0, maxScale: 1.0, verticalAnchor: 'center' });
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
      if (clusterState.active) {
        exitClusterMode();
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
        if (typeof window.triggerOpenCognitiveView === 'function') {
          window.triggerOpenCognitiveView();
        } else {
          close();
        }
        return true;
      }
    }

    // 快捷键单键系统 (1, 2, 3, Q, W, E, L, S, A, D) - 非打字编辑态下直接单键极速触发
    if (!isTyping && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (!e.shiftKey) {
        if (e.key === '1') {
          expandToLevel(1); // 1 键：分节骨架（左至 §1~§3，右至考点/招法标题）
          return true;
        }
        if (e.key === '2') {
          expandToLevel(2); // 2 键：核心全景（左至 1.1~3.3，右至考点/招法，同级对齐）
          return true;
        }
        if (e.key === '3') {
          expandToLevel(3); // 3 键：全图全量展开 + 一屏鸟瞰居中
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
        if (k === 's') {
          toggleLayerMode();
          return true;
        }
        if (k === 'a') {
          navigateChapter(-1);
          return true;
        }
        if (k === 'd') {
          navigateChapter(1);
          return true;
        }
      }
    }

    // 兼容 Alt + 1 / 2 / 3 / Q / W / E 组合键
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && !isTyping) {
      if (e.key === '1') { expandToLevel(1); return true; }
      if (e.key === '2') { expandToLevel(2); return true; }
      if (e.key === '3') { expandToLevel(3); return true; }
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

  function applySavedViewportOrFit(savedVp, fallbackFitOpts) {
    if (!mindMapInstance || !mindMapInstance.view) return false;
    if (savedVp && typeof savedVp.scale === 'number' && typeof savedVp.x === 'number' && typeof savedVp.y === 'number' && isFinite(savedVp.scale) && savedVp.scale > 0.05) {
      stopCameraFlight();
      mindMapInstance.view.scale = savedVp.scale;
      mindMapInstance.view.x = savedVp.x;
      mindMapInstance.view.y = savedVp.y;
      if (typeof mindMapInstance.view.transform === 'function') {
        mindMapInstance.view.transform();
      }
      if (typeof mindMapInstance.view.emitEvent === 'function') {
        mindMapInstance.view.emitEvent('scale');
        mindMapInstance.view.emitEvent('translate');
      }
      if (structureController) structureController.updateZoomDisplay();
      syncAssociativeLinesState();
      return true;
    }
    return fitCanvasToViewport(48, fallbackFitOpts);
  }

  function setupUI() {
    var modal = document.getElementById('cognitiveModal');
    if (!modal) return;

    window.addEventListener('resize', function () {
      if (isModalOpen && mindMapInstance) {
        var container = document.getElementById('cognitiveMindMapContainer');
        if (container && container.offsetWidth > 0 && container.offsetHeight > 0) {
          mindMapInstance.resize();
        }
      }
    });

    // 页面刷新后若刷新前处于 O 键开启状态，自动恢复 O 键认知视图及全部内部状态
    var savedState = readCognitiveState();
    if (savedState && savedState.isOpen === true) {
      setTimeout(function () {
        if (!isModalOpen) {
          open({ _fromPageReload: true });
        }
      }, 60);
    }
  }

  function open(detail) {
    var modal = document.getElementById('cognitiveModal');
    if (!modal) return;

    ensureBuiltInChaptersRegistered();

    var isPageReload = Boolean(detail && detail._fromPageReload);
    var isFromToggle = Boolean(detail && detail._fromToggle);
    var savedState = readCognitiveState();

    var reqSubject = (detail && detail.subject) ||
      (isPageReload && savedState && savedState.subject) ||
      ((window.curSubjectId === 'english' || (window.curSubject && window.curSubject.type === 'english')) ? 'english' : 'math');
    var isEnglish = (reqSubject === 'english');
    var hostChapterId = resolveChapterId(detail && detail.chapterId, isEnglish);

    var targetLayerMode = 'chapter';
    var targetChapterId = hostChapterId;
    var preserveExpandState = Boolean(detail && detail.preserveExpandState);
    var restoreSavedViewport = false;
    var targetViewMode = 'mindmap';

    if (isPageReload && savedState) {
      // 跨页面刷新恢复：100% 恢复刷新前的层级、章节、导图/大纲模式、L 键连线显隐、节点展开态与相机视口
      preserveExpandState = true;
      restoreSavedViewport = true;
      if (typeof savedState.isAssociativeLineVisible === 'boolean') {
        isAssociativeLineVisible = savedState.isAssociativeLineVisible;
      }
      if (savedState.viewMode === 'outline' || savedState.viewMode === 'mindmap') {
        targetViewMode = savedState.viewMode;
      }
      if (savedState.lastVisitedChapterId && chapterRegistry.has(savedState.lastVisitedChapterId)) {
        lastVisitedChapterId = savedState.lastVisitedChapterId;
      }
      if (savedState.macroFocusedChapterId && chapterRegistry.has(savedState.macroFocusedChapterId)) {
        macroFocusedChapterId = savedState.macroFocusedChapterId;
      }
      if (savedState.lastHostChapterId) {
        lastHostChapterId = savedState.lastHostChapterId;
      } else {
        lastHostChapterId = hostChapterId;
      }
      if (!isEnglish && savedState.layerMode === 'subject_macro') {
        targetLayerMode = 'subject_macro';
        targetChapterId = 'macro_' + reqSubject;
      } else {
        targetLayerMode = 'chapter';
        var savedCh = savedState.currentChapterId;
        targetChapterId = (savedCh && chapterRegistry.has(savedCh) && savedCh.indexOf('macro_') !== 0)
          ? savedCh
          : (lastVisitedChapterId || hostChapterId);
      }
    } else if (detail && !isFromToggle && (detail.chapterId || detail.kpId || detail.methodId)) {
      // 显式 API 指定章节或点击题目考点/解法徽标进入：精确打开目标章节
      targetLayerMode = 'chapter';
      targetChapterId = hostChapterId;
      lastVisitedChapterId = targetChapterId;
      lastHostChapterId = hostChapterId;
    } else {
      // 手动按 O 键开关：若后台题库章节未变，则恢复上次在 O 键内停留的层级（全量层或 A/D 切过的章节）；若后台题库切了新章节，则智能联动至新章节
      var prevHostCh = lastHostChapterId || (savedState && savedState.lastHostChapterId) || null;
      var prevSubj = currentActiveSubject || (savedState && savedState.subject) || reqSubject;
      if (prevHostCh && prevHostCh === hostChapterId && prevSubj === reqSubject) {
        var rememberedLayer = currentLayerMode || (savedState && savedState.layerMode) || 'chapter';
        if (!isEnglish && rememberedLayer === 'subject_macro') {
          targetLayerMode = 'subject_macro';
          targetChapterId = 'macro_' + reqSubject;
          preserveExpandState = true;
        } else {
          targetLayerMode = 'chapter';
          var rememberedCh = (currentChapterId && chapterRegistry.has(currentChapterId) && currentChapterId.indexOf('macro_') !== 0)
            ? currentChapterId
            : ((savedState && savedState.currentChapterId && chapterRegistry.has(savedState.currentChapterId)) ? savedState.currentChapterId : hostChapterId);
          targetChapterId = rememberedCh;
        }
      } else {
        targetLayerMode = 'chapter';
        targetChapterId = hostChapterId;
        lastVisitedChapterId = targetChapterId;
        lastHostChapterId = hostChapterId;
      }
    }

    var defaultOverviewFitOpts = {
      minReadableScale: 0,
      maxScale: 1.0,
      verticalAnchor: 'center',
      horizontalAnchor: 'center',
      allowHorizontalOverflow: false
    };

    modal.style.display = 'flex';
    void modal.offsetWidth;
    modal.classList.add('show');
    isModalOpen = true;

    currentActiveSubject = reqSubject;
    currentLayerMode = targetLayerMode;

    if (!mindMapInstance) {
      currentChapterId = targetChapterId;
      if (targetLayerMode === 'chapter' && chapterRegistry.has(targetChapterId)) {
        lastVisitedChapterId = targetChapterId;
      }
      initMindMap._preserveExpandState = preserveExpandState;
      initMindMap();
      initMindMap._preserveExpandState = false;

      if (dualViewController && typeof dualViewController.switchView === 'function' && targetViewMode !== 'mindmap') {
        dualViewController.switchView(targetViewMode);
      }
      syncAssociativeLinesState();
      updateBottomCapsuleUI();

      var vpKeyInit = getCurrentViewportKey();
      var savedVpInit = (restoreSavedViewport && savedState && savedState.viewports) ? savedState.viewports[vpKeyInit] : null;

      setTimeout(function () {
        if (mindMapInstance) {
          var container = document.getElementById('cognitiveMindMapContainer');
          if (container && container.offsetWidth > 0 && container.offsetHeight > 0) {
            mindMapInstance.resize();
          }
          scheduleViewportAction(function () {
            var applied = applySavedViewportOrFit(savedVpInit, defaultOverviewFitOpts);
            saveCognitiveState({ isOpen: true });
            return applied;
          }, true);
        }
      }, 40);
    } else {
      if (clusterState.active) {
        exitClusterMode({ restoreOnly: true });
      }
      if (mindMapInstance.keyCommand) mindMapInstance.keyCommand.recovery();
      if (dualViewController && typeof dualViewController.getCurrentView === 'function') {
        if (dualViewController.getCurrentView() !== targetViewMode) {
          dualViewController.switchView(targetViewMode);
        }
      }
      if (shortcutManager && typeof shortcutManager.resetCycleState === 'function') {
        shortcutManager.resetCycleState();
      }

      if (targetLayerMode === 'subject_macro') {
        enterSubjectMacroLayer({
          subject: reqSubject,
          preserveExpandState: preserveExpandState,
          skipCrossFade: true
        });
        if (restoreSavedViewport && savedState && savedState.viewports) {
          var savedMacroVp = savedState.viewports['macro_' + reqSubject];
          if (savedMacroVp) {
            setTimeout(function () {
              applySavedViewportOrFit(savedMacroVp, defaultOverviewFitOpts);
              saveCognitiveState({ isOpen: true });
            }, 45);
          }
        }
      } else if (currentChapterId !== targetChapterId) {
        loadChapter(targetChapterId, {
          preserveExpandState: preserveExpandState,
          skipCrossFade: true
        });
        if (restoreSavedViewport && savedState && savedState.viewports && savedState.viewports[targetChapterId]) {
          var savedChVp = savedState.viewports[targetChapterId];
          setTimeout(function () {
            applySavedViewportOrFit(savedChVp, defaultOverviewFitOpts);
            saveCognitiveState({ isOpen: true });
          }, 45);
        }
      } else {
        currentLayerMode = 'chapter';
        var curRenderTree = (mindMapInstance.renderer && mindMapInstance.renderer.renderTree) || null;
        var expandChanged = false;
        if (curRenderTree && !preserveExpandState) {
          normalizeOverviewExpandState(curRenderTree);
          expandChanged = Boolean(curRenderTree._expandModified);
          delete curRenderTree._expandModified;
          if (expandChanged) {
            mindMapInstance.render();
          }
        }
        updateLevelButtonsUI(2);
        updateBottomCapsuleUI();
        var vpKeyCur = getCurrentViewportKey();
        var savedVpCur = (restoreSavedViewport && savedState && savedState.viewports) ? savedState.viewports[vpKeyCur] : null;
        scheduleViewportAction(function () {
          return applySavedViewportOrFit(savedVpCur, defaultOverviewFitOpts);
        }, !expandChanged);
        setTimeout(function () {
          if (!mindMapInstance) return;
          var container = document.getElementById('cognitiveMindMapContainer');
          if (container && container.offsetWidth > 0 && container.offsetHeight > 0) {
            mindMapInstance.resize();
          }
          scheduleViewportAction(function () {
            var applied = applySavedViewportOrFit(savedVpCur, defaultOverviewFitOpts);
            saveCognitiveState({ isOpen: true });
            return applied;
          }, true);
        }, 30);
      }
    }

    saveCognitiveState({ isOpen: true });

    if (detail && detail.kpId) {
      setTimeout(function () {
        if (!mindMapInstance) return;
        var curTree = (mindMapInstance.renderer && mindMapInstance.renderer.renderTree) || mindMapInstance.getData(false);
        if (findNodeDataByUid(curTree, detail.kpId)) {
          applyFocusResonanceByUid(detail.kpId);
        }
      }, 120);
    }
  }

  function close() {
    stopCameraFlight();
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

    if (clusterState.active) {
      exitClusterMode({ restoreOnly: true });
    } else {
      clearFocusResonance();
    }

    flushMindMapStateToStorage();

    if (mindMapInstance && mindMapInstance.keyCommand) {
      mindMapInstance.keyCommand.pause();
    }

    modal.classList.remove('show');
    setTimeout(function () {
      if (!modal.classList.contains('show')) {
        modal.style.display = 'none';
      }
    }, 180);
    isModalOpen = false;
    saveCognitiveState({ isOpen: false });
  }

  function toggle(detail) {
    if (isModalOpen) close();
    else open(Object.assign({}, detail || {}, { _fromToggle: true }));
  }

  function onStorageRefresh() {
    var saved = readCognitiveState();
    if (!saved) return;
    if (saved.isOpen && !isModalOpen) {
      open({ _fromPageReload: true });
    } else if (!saved.isOpen && isModalOpen) {
      close();
    }
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
    fitCanvasToViewport: fitCanvasToViewport,
    fitSubtreeToViewport: fitSubtreeToViewport,
    stopCameraFlight: stopCameraFlight,
    applyFocusResonanceByUid: applyFocusResonanceByUid,
    toggleFocusResonanceByUid: toggleFocusResonanceByUid,
    clearFocusResonance: clearFocusResonance,
    enterNodeCluster: enterNodeCluster,
    toggleNodeCluster: toggleNodeCluster,
    enterEdgeCluster: enterEdgeCluster,
    toggleEdgeCluster: toggleEdgeCluster,
    exitClusterMode: exitClusterMode,
    isClusterActive: isClusterActive,
    getClusterState: getClusterState,
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
    getShortcutManager: function () { return shortcutManager; },
    getStructureController: function () { return structureController; },
    registerChapterMindMap: registerChapterMindMap,
    resolveChapterId: resolveChapterId,
    loadChapter: loadChapter,
    buildSubjectMacroTree: buildSubjectMacroTree,
    enterSubjectMacroLayer: enterSubjectMacroLayer,
    toggleLayerMode: toggleLayerMode,
    navigateChapter: navigateChapter,
    getLayerMode: function () { return currentLayerMode; },
    getMacroFocusedChapterId: function () { return macroFocusedChapterId; },
    getLastVisitedChapterId: function () { return lastVisitedChapterId; },
    readCognitiveState: readCognitiveState,
    saveCognitiveState: saveCognitiveState,
    onStorageRefresh: onStorageRefresh,
    confirmPendingNode: confirmPendingNode,
    persistCurrentMindMapState: persistCurrentMindMapState,
    getChapterRegistry: function () { ensureBuiltInChaptersRegistered(); return chapterRegistry; },
    getCurrentChapterId: function () { return currentChapterId; }
  };
});
