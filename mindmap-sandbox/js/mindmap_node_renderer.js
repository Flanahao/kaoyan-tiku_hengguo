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
    if (tagType) return 'mm-tag-' + tagType;
    const t = String(tag || '');
    if (/定义|概念|两要素|表示/.test(t)) return 'mm-tag-def';
    if (/定理|准则|充要|推论|法则|公式|重要极限|恒等式/.test(t)) return 'mm-tag-thm';
    if (/性质|有界|单调|奇偶|周期|阶|传递/.test(t)) return 'mm-tag-prop';
    if (/要领|首选|核心|秒杀/.test(t)) return 'mm-tag-key';
    if (/步骤|步法|排查|流程|方法/.test(t)) return 'mm-tag-step';
    if (/避坑|注意|警示|反例|互斥/.test(t)) return 'mm-tag-warn';
    if (/同步/.test(t)) return 'mm-tag-sync';
    if (/★|星|必考|常考|趋势/.test(t)) return 'mm-tag-exam';
    if (/^GS|^M\d+/i.test(t)) return 'mm-tag-code';
    return 'mm-tag-default';
  }

  function renderNodeContent(node, options) {
    const opts = options || {};
    const rawData = (node.nodeData && node.nodeData.data) || {};
    let text = rawData.text || '';
    text = normalizeInlineHighlights(stripOuterParagraph(text));

    // 1. 若全局存在 MarkdownLatexEngine，进行行内公式与 Markdown 编译
    let renderedHtml = '';
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

    // 2. 确定层级索引 (0 为根节点，1 为一级分支卡片，2 为二级分类卡片，3 及以上为紧凑条目节点)
    const layerIndex = node.layerIndex !== undefined ? node.layerIndex : (node.isRoot ? 0 : 2);
    const role = rawData.role || '';

    // 3. 构建紧凑卡片 DOM
    const cardEl = document.createElement('div');
    let cardClasses = `mm-node-card level-${layerIndex} ${node.isRoot ? 'is-root' : ''}`;
    if (role) {
      cardClasses += ` role-${role}`;
    }
    const resonanceTargets = rawData.associativeLineTargets || rawData.resonanceLinks;
    if (resonanceTargets && resonanceTargets.length > 0) {
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
      linkBtn.title = '点击聚焦关联知识点与破题招法';
      linkBtn.textContent = `关联 ${resonanceTargets.length}`;
      linkBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof opts.onResonanceClick === 'function') {
          opts.onResonanceClick(rawData.uid, rawData);
        } else if (global.CognitiveViewController && typeof global.CognitiveViewController.toggleFocusResonanceByUid === 'function') {
          global.CognitiveViewController.toggleFocusResonanceByUid(rawData.uid);
        } else if (global.CognitiveViewController && typeof global.CognitiveViewController.applyFocusResonanceByUid === 'function') {
          global.CognitiveViewController.applyFocusResonanceByUid(rawData.uid);
        }
      });
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
      qBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof opts.onQuestionJump === 'function') {
          opts.onQuestionJump(rawData.uid, rawData);
        } else if (global.CognitiveViewController && typeof global.CognitiveViewController.jumpToExamPointQuestions === 'function') {
          global.CognitiveViewController.jumpToExamPointQuestions(rawData.uid);
        }
      });
      cardEl.appendChild(qBadge);
    }

    // 3.5 后置交互微胶囊：按需唤起 MathViz 几何图解浮层
    if (rawData.hasWidget && rawData.widgetType) {
      const vizBtn = document.createElement('button');
      vizBtn.type = 'button';
      vizBtn.className = 'mm-node-action-pill action-widget mm-pill-widget mm-node-viz-pill';
      vizBtn.title = '点击打开交互式数学几何图解';
      vizBtn.textContent = '几何图解';
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
      cardEl.appendChild(vizBtn);
    }

    return cardEl;
  }

  global.MindMapNodeRenderer = {
    render: renderNodeContent,
    stripOuterParagraph: stripOuterParagraph,
    normalizeInlineHighlights: normalizeInlineHighlights
  };
})(typeof window !== 'undefined' ? window : this);
