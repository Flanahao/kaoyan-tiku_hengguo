/**
 * 思维导图富节点渲染器 (MindMapNodeRenderer)
 * 职责：
 * 1. 挂载至 SimpleMindMap 的 customCreateNodeContent 配置项
 * 2. 调度全局 MarkdownLatexEngine 进行 Markdown + KaTeX + DOMPurify 安全编译
 * 3. 支持紧凑条带式层级卡片、语义前置微标签 (tag)、题库跳转徽标 (questionCount) 与按需几何图解按钮 (widgetType)
 * 4. 纯原生 Vanilla JS 实现，零表情符号
 */
(function (global) {
  'use strict';

  function stripOuterParagraph(str) {
    if (!str || typeof str !== 'string') return '';
    let s = str.trim();
    // 剥离 SimpleMindMap 默认包裹的 <p>...</p> 标签，还原原始 Markdown/LaTeX 文本
    if (s.startsWith('<p>') && s.endsWith('</p>') && s.indexOf('<p>', 3) === -1) {
      s = s.slice(3, -4);
    }
    // 还原 SimpleMindMap 在展开/折叠重绘时转义进 LaTeX 定界符内部的 &lt; / &gt; / &amp;
    s = s.replace(/\$([^$]+)\$/g, function (m, inner) {
      return '$' + inner
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&') + '$';
    });
    // 防止单行节点以 "1. " / "2. " 开头时被 marked 误解析为 <ol><li> 悬挂列表导致序号左移重叠
    s = s.replace(/^(\d+)\.\s+/, '$1\\. ');
    return s;
  }

  function normalizeInlineHighlights(str) {
    if (!str || typeof str !== 'string') return '';
    return str;
  }

  function getTagColorClass(tag, tagType) {
    if (tagType === 'pending' || (tag && String(tag).startsWith('待确认'))) return 'mm-tag-pending';
    if (tagType) return 'mm-tag-' + tagType;
    const t = String(tag || '');
    if (/待确认/.test(t)) return 'mm-tag-pending';
    if (/定义|概念|两要素|表示/.test(t)) return 'mm-tag-def';
    if (/定理|准则|充要|推论|法则|公式|重要极限|恒等式/.test(t)) return 'mm-tag-thm';
    if (/性质|有界|单调|奇偶|周期|阶|传递/.test(t)) return 'mm-tag-prop';
    if (/要领|首选|核心|秒杀/.test(t)) return 'mm-tag-key';
    if (/步骤|步法|排查|流程|方法|招法/.test(t)) return 'mm-tag-step';
    if (/避坑|注意|警示|反例|互斥/.test(t)) return 'mm-tag-warn';
    if (/结论/.test(t)) return 'mm-tag-conclusion';
    if (/同步/.test(t)) return 'mm-tag-sync';
    if (/★|星|必考|常考|趋势/.test(t)) return 'mm-tag-exam';
    if (/^GS|^M\d+/i.test(t)) return 'mm-tag-code';
    return 'mm-tag-default';
  }

  var htmlCache = new Map();
  var sizeCache = new Map();
  var domCardCache = new Map();
  var batchMeasureHost = null;

  function computeSizeCacheKey(rawData, layerIndex) {
    if (!rawData) return '';
    const role = rawData.role || '';
    const text = normalizeInlineHighlights(stripOuterParagraph(rawData.text || ''));
    const tagText = rawData.tag || rawData.code || (rawData.importance ? `${rawData.importance}★ ${rawData.trend || '考点'}` : '');
    const rawResonanceTargets = rawData.associativeLineTargets || rawData.resonanceLinks;
    const resLen = Array.isArray(rawResonanceTargets)
      ? new Set(rawResonanceTargets.filter(uid => uid && uid !== rawData.uid)).size
      : 0;
    const catFlag = rawData.isCatalogLeaf ? 'cat' : '';
    const uid = rawData.uid || '';
    const hl = rawData.highlightColor || '';
    const tagType = rawData.tagType || '';
    return `${uid}|${layerIndex}|${role}|${catFlag}|${tagText}|${tagType}|${hl}|${text}|${rawData.questionCount || 0}|${rawData.hasWidget ? rawData.widgetType : ''}|${resLen}|${rawData.fontWeight || ''}|${rawData.fontStyle || ''}|${rawData.textDecoration || ''}`;
  }

  function ensureNodeRectCacheHook(node) {
    if (!node) return;
    var proto = Object.getPrototypeOf(node);
    if (!proto || proto._hasFastSizeCache || typeof proto.getNodeRect !== 'function') return;
    var origGetNodeRect = proto.getNodeRect;
    proto.getNodeRect = function () {
      if (!this._mmSizeCacheKey && this.nodeData && this.nodeData.data) {
        var rawData = this.nodeData.data;
        var layerIndex = this.layerIndex !== undefined ? this.layerIndex : (this.isRoot ? 0 : 2);
        this._mmSizeCacheKey = computeSizeCacheKey(rawData, layerIndex);
      }
      if (this.isUseCustomNodeContent && this.isUseCustomNodeContent() &&
          (!this.hasCustomWidth || !this.hasCustomWidth()) &&
          this._mmSizeCacheKey && sizeCache.has(this._mmSizeCacheKey)) {
        var cached = sizeCache.get(this._mmSizeCacheKey);
        return { width: cached.width, height: cached.height };
      }
      var rect = origGetNodeRect.apply(this, arguments);
      if (this.isUseCustomNodeContent && this.isUseCustomNodeContent() &&
          (!this.hasCustomWidth || !this.hasCustomWidth()) &&
          this._mmSizeCacheKey && rect && rect.width > 0 && rect.height > 0) {
        sizeCache.set(this._mmSizeCacheKey, { width: rect.width, height: rect.height });
      }
      return rect;
    };
    proto._hasFastSizeCache = true;
  }

  function batchPreMeasureTree(treeRoot, containerEl, options) {
    if (!treeRoot || !containerEl || typeof document === 'undefined') return;
    var pending = [];

    function walk(nodeObj, layerIndex) {
      if (!nodeObj) return;
      var d = nodeObj.data || {};
      var key = computeSizeCacheKey(d, layerIndex);
      if (key && !sizeCache.has(key)) {
        var fakeNode = {
          isRoot: layerIndex === 0,
          layerIndex: layerIndex,
          nodeData: nodeObj
        };
        var cardEl = renderNodeContent(fakeNode, options);
        nodeObj._preRenderedCard = cardEl;
        nodeObj._preRenderedKey = key;
        var wrap = document.createElement('div');
        wrap.style.cssText = 'position:fixed;left:-99999px;top:-99999px;';
        wrap.appendChild(cardEl);
        pending.push({ wrap: wrap, cardEl: cardEl, key: key });
      }
      var shouldWalkChildren = Boolean(options && options.allNodes) || (d.expand !== false);
      if (shouldWalkChildren && Array.isArray(nodeObj.children)) {
        for (var i = 0; i < nodeObj.children.length; i++) {
          walk(nodeObj.children[i], layerIndex + 1);
        }
      }
    }

    walk(treeRoot, 0);
    if (pending.length === 0) return;

    if (!batchMeasureHost || !batchMeasureHost.parentNode) {
      batchMeasureHost = document.createElement('div');
      batchMeasureHost.style.cssText = 'position:fixed;left:-99999px;top:-99999px;pointer-events:none;visibility:hidden;';
      containerEl.appendChild(batchMeasureHost);
    }
    var frag = document.createDocumentFragment();
    for (var i = 0; i < pending.length; i++) {
      frag.appendChild(pending[i].wrap);
    }
    batchMeasureHost.appendChild(frag);

    for (var j = 0; j < pending.length; j++) {
      var item = pending[j];
      var r = (item.cardEl && item.cardEl.getBoundingClientRect) ? item.cardEl.getBoundingClientRect() : item.wrap.getBoundingClientRect();
      if (r && r.width > 0 && r.height > 0) {
        sizeCache.set(item.key, { width: Math.ceil(r.width), height: Math.ceil(r.height) });
      }
    }

    for (var k = 0; k < pending.length; k++) {
      if (pending[k].cardEl.parentNode === pending[k].wrap) {
        pending[k].wrap.removeChild(pending[k].cardEl);
      }
    }
    batchMeasureHost.innerHTML = '';
  }

  function renderNodeContent(node, options) {
    ensureNodeRectCacheHook(node);
    const opts = options || {};
    const rawData = (node.nodeData && node.nodeData.data) || {};
    const layerIndex = node.layerIndex !== undefined ? node.layerIndex : (node.isRoot ? 0 : 2);
    const cacheKey = computeSizeCacheKey(rawData, layerIndex);
    node._mmSizeCacheKey = cacheKey;

    if (node.nodeData && node.nodeData._preRenderedCard && node.nodeData._preRenderedKey === cacheKey) {
      const preCard = node.nodeData._preRenderedCard;
      delete node.nodeData._preRenderedCard;
      delete node.nodeData._preRenderedKey;
      return preCard;
    }

    const rawResonanceTargets = rawData.associativeLineTargets || rawData.resonanceLinks;
    const resonanceTargets = Array.isArray(rawResonanceTargets)
      ? Array.from(new Set(rawResonanceTargets.filter(uid => uid && uid !== rawData.uid)))
      : [];

    let text = rawData.text || '';
    text = normalizeInlineHighlights(stripOuterParagraph(text));

    function bindCardActionListeners(cardEl) {
      if (resonanceTargets && resonanceTargets.length > 0) {
        const linkBtn = cardEl.querySelector('.action-resonance');
        if (linkBtn) {
          linkBtn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
          });
          linkBtn.addEventListener('mouseup', (e) => {
            e.stopPropagation();
          });
          linkBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (typeof opts.onResonanceClick === 'function') {
              opts.onResonanceClick(rawData.uid, rawData, linkBtn);
            } else if (typeof opts.onActionClick === 'function') {
              opts.onActionClick('resonance', rawData.uid, rawData, linkBtn);
            } else if (global.CognitiveViewController && typeof global.CognitiveViewController.toggleNodeCluster === 'function') {
              global.CognitiveViewController.toggleNodeCluster(rawData.uid);
            } else if (global.CognitiveViewController && typeof global.CognitiveViewController.toggleFocusResonanceByUid === 'function') {
              global.CognitiveViewController.toggleFocusResonanceByUid(rawData.uid);
            } else if (global.CognitiveViewController && typeof global.CognitiveViewController.applyFocusResonanceByUid === 'function') {
              global.CognitiveViewController.applyFocusResonanceByUid(rawData.uid);
            }
          });
        }
      }

      if (rawData.questionCount) {
        const qBadge = cardEl.querySelector('.action-questions');
        if (qBadge) {
          qBadge.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof opts.onQuestionJump === 'function') {
              opts.onQuestionJump(rawData.uid, rawData);
            } else if (global.CognitiveViewController && typeof global.CognitiveViewController.jumpToExamPointQuestions === 'function') {
              global.CognitiveViewController.jumpToExamPointQuestions(rawData.uid);
            }
          });
        }
      }

      if (rawData.hasWidget && rawData.widgetType) {
        const vizBtn = cardEl.querySelector('.action-widget');
        if (vizBtn) {
          vizBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof opts.onWidgetClick === 'function') {
              opts.onWidgetClick(rawData.widgetType, rawData, vizBtn);
            } else if (global.CognitiveViewController && typeof global.CognitiveViewController.openWidgetPopover === 'function') {
              global.CognitiveViewController.openWidgetPopover(rawData.widgetType, rawData.widgetTitle || text, vizBtn);
            } else if (global.MathVizWidget && typeof global.MathVizWidget.openPopover === 'function') {
              global.MathVizWidget.openPopover(rawData.widgetType, vizBtn, rawData.widgetTitle || text);
            }
          });
        }
      }
    }

    if (cacheKey && domCardCache.has(cacheKey)) {
      const cachedTpl = domCardCache.get(cacheKey);
      const cardEl = cachedTpl.cloneNode(true);
      bindCardActionListeners(cardEl);
      return cardEl;
    }

    // 1. 若全局存在 MarkdownLatexEngine，进行行内公式与 Markdown 编译（带内存级缓存）
    let renderedHtml = htmlCache.get(text);
    if (renderedHtml === undefined) {
      if (global.MarkdownLatexEngine && typeof global.MarkdownLatexEngine.renderInline === 'function') {
        renderedHtml = global.MarkdownLatexEngine.renderInline(text);
      } else {
        renderedHtml = String(text)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }
      if (!renderedHtml || renderedHtml.trim() === '') {
        renderedHtml = '&nbsp;';
      }
      htmlCache.set(text, renderedHtml);
    }

    // 2. 确定层级角色
    const role = rawData.role || '';

    // 3. 构建紧凑卡片 DOM
    const cardEl = document.createElement('div');
    let cardClasses = `mm-node-card level-${layerIndex} ${node.isRoot ? 'is-root' : ''}`;
    if (role) {
      cardClasses += ` role-${role}`;
    }
    if (rawData.isSyncBlockRoot || (rawData.syncBlockId && !rawData.isSyncBlockChild)) {
      cardClasses += ' is-sync-block-root';
    } else if (rawData.isSyncBlockChild) {
      cardClasses += ' is-sync-block-child';
    }
    if (rawData.tagType === 'pending' || (rawData.tag && String(rawData.tag).startsWith('待确认'))) {
      cardClasses += ' is-pending-node';
    }
    if (rawData.isCatalogLeaf || (rawData.uid && /^kp_gs\d+_\d+_/.test(rawData.uid))) {
      cardClasses += ' mm-catalog-leaf';
    }
    if (resonanceTargets.length > 0) {
      cardClasses += ' has-resonance-targets';
    }
    cardEl.className = cardClasses;
    cardEl.dataset.nodeUid = rawData.uid || '';

    // 支持全局粗体、斜体、下划线样式
    if (rawData.fontWeight === 'bold') {
      cardEl.style.fontWeight = 'bold';
    }
    if (rawData.fontStyle === 'italic') {
      cardEl.style.fontStyle = 'italic';
    }
    if (rawData.textDecoration === 'underline') {
      cardEl.style.textDecoration = 'underline';
    }

    // 3.1 前置语义微标签 (tag / code / importance)
    const tagText = rawData.tag || rawData.code || (rawData.importance ? `${rawData.importance}★ ${rawData.trend || '考点'}` : '');
    if (tagText) {
      const tagBadge = document.createElement('span');
      const colorCls = getTagColorClass(tagText, rawData.tagType);
      tagBadge.className = `mm-node-tag ${colorCls}`;
      tagBadge.dataset.tagType = rawData.tagType || colorCls.replace('mm-tag-', '');
      tagBadge.textContent = tagText;
      cardEl.appendChild(tagBadge);
    }

    // 3.2 核心文本与公式内容区
    const contentEl = document.createElement('div');
    let contentClasses = 'mm-node-content';
    if (rawData.highlightColor) {
      contentClasses += ` mm-hl-${rawData.highlightColor} mm-highlight-${rawData.highlightColor}`;
    }
    contentEl.className = contentClasses;
    contentEl.innerHTML = renderedHtml;
    cardEl.appendChild(contentEl);

    // 3.3 后置交互微胶囊：跨分支关联拓扑按钮
    if (resonanceTargets && resonanceTargets.length > 0) {
      const linkBtn = document.createElement('button');
      linkBtn.type = 'button';
      linkBtn.className = 'mm-node-action-pill action-resonance mm-pill-resonance mm-node-resonance-pill';
      linkBtn.title = '左键点击此徽标或右键节点聚拢关联知识点、考点与解法';
      linkBtn.textContent = `关联 ${resonanceTargets.length}`;
      cardEl.appendChild(linkBtn);
    }

    // 3.4 后置交互微胶囊：题库真题跳转按钮
    if (rawData.questionCount) {
      const qBadge = document.createElement('button');
      qBadge.type = 'button';
      qBadge.className = 'mm-node-action-pill action-questions mm-pill-questions';
      qBadge.dataset.kpid = rawData.uid || '';
      qBadge.title = '跳转题库练习此考点真题';
      qBadge.textContent = `${rawData.questionCount}题 →`;
      cardEl.appendChild(qBadge);
    }

    // 3.5 后置交互微胶囊：按需唤起 MathViz 几何图解浮层
    if (rawData.hasWidget && rawData.widgetType) {
      const vizBtn = document.createElement('button');
      vizBtn.type = 'button';
      vizBtn.className = 'mm-node-action-pill action-widget mm-pill-widget mm-node-viz-pill';
      vizBtn.title = '点击打开交互式数学几何图解';
      vizBtn.textContent = '几何图解';
      cardEl.appendChild(vizBtn);
    }

    bindCardActionListeners(cardEl);

    if (cacheKey) {
      domCardCache.set(cacheKey, cardEl.cloneNode(true));
    }

    return cardEl;
  }

  global.MindMapNodeRenderer = {
    render: renderNodeContent,
    batchPreMeasureTree: batchPreMeasureTree,
    computeSizeCacheKey: computeSizeCacheKey,
    stripOuterParagraph: stripOuterParagraph,
    normalizeInlineHighlights: normalizeInlineHighlights,
    getSizeCache: function () { return sizeCache; },
    getHtmlCache: function () { return htmlCache; },
    getDomCardCache: function () { return domCardCache; },
    clearCache: function () { htmlCache.clear(); sizeCache.clear(); domCardCache.clear(); }
  };
})(typeof window !== 'undefined' ? window : this);
