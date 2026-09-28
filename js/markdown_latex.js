/**
 * 考研题库 · 统一 Markdown 与 LaTeX 基础引擎 (MarkdownLatexEngine)
 *
 * 核心职责：
 *   1. 统一 Markdown（marked）编译、公式保护占位、KaTeX 自动渲染与 DOMPurify 双阶段安全净化。
 *   2. 统一行内排版 (renderInline, 专供考点胶囊/按钮/徽标) 与块级排版 (renderBlock, 专供笔记/大段解析)。
 *   3. 统一极速纯文本快道与 HTML 字符安全转义 (escapeHtml)。
 *   4. 统一算子上下标位置优化（自动补齐 \limits_，如 \lim, \sum, \max 等）。
 *   5. 统一通用输入框代码片段插入、光标定位 (⦙ 与 |) 与选区成对包裹 (insertSnippet, wrapSelection)。
 *   6. 统一各编辑框的实时预览数据流绑定 (bindLivePreview)。
 */

(function (root, factory) {
  'use strict';
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var engine = factory();
    root.MarkdownLatexEngine = engine;
    // 兼容全局历史别名，确保上下游模块无缝调用
    root.renderNotesMarkdown = engine.renderBlock;
    root.renderTopicTextHtml = engine.renderInline;
    root.escapeHtml = engine.escapeHtml;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. 安全 HTML 字符转义工具
  // ─────────────────────────────────────────────────────────────────────────────
  function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // 纯文本极速快道判断：若不含任何 LaTeX/Markdown 语法符号，则秒级直出
  function isPlainString(text) {
    if (!text || typeof text !== 'string') return true;
    return !text.includes('$') &&
           !text.includes('\\') &&
           !/[*_`~\[\]<>#|]/.test(text);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. DOMPurify 安全净化工具
  // ─────────────────────────────────────────────────────────────────────────────
  function sanitizeHtml(html) {
    var purify = (typeof window !== 'undefined' && window.DOMPurify) ? window.DOMPurify :
                 (typeof DOMPurify !== 'undefined' ? DOMPurify : null);
    if (!purify) {
      return String(html).replace(/<[^>]*>/g, '');
    }
    return purify.sanitize(html, { ADD_ATTR: ['target'] });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. LaTeX 公式占位保护与 TreeWalker 文本节点精准还原
  // ─────────────────────────────────────────────────────────────────────────────
  // 把 N 占位符还原为原始 LaTeX 文本（text node，不经 HTML 解析，规避反斜杠/特殊字符丢失）
  function restoreMathPlaceholders(root, spans) {
    if (!spans || !spans.length || !root) return;
    if (typeof document === 'undefined') return;

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var txt = node.nodeValue || '';
      if (txt.indexOf('') === -1) continue;

      var frag = document.createDocumentFragment();
      var re = /([0-9]+)/g, m, last = 0, hit = false;
      while ((m = re.exec(txt)) !== null) {
        if (m.index > last) {
          frag.appendChild(document.createTextNode(txt.substring(last, m.index)));
        }
        var idx = parseInt(m[1], 10);
        if (spans[idx] !== undefined) {
          frag.appendChild(document.createTextNode(spans[idx]));
        }
        last = m.index + m[0].length;
        hit = true;
      }
      if (!hit) continue;
      if (last < txt.length) {
        frag.appendChild(document.createTextNode(txt.substring(last)));
      }
      if (node.parentNode) {
        node.parentNode.replaceChild(frag, node);
      }
    }
  }

  // 优化常见数学算子：自动补全 \limits，确保上下标居中在正下方/正上方
  function optimizeMathOperators(formula) {
    if (!formula || typeof formula !== 'string') return '';
    return formula.replace(/\\(lim|sum|prod|max|min|inf|sup)(?!\\limits|\\nolimits)\s*_/g, function (match, op) {
      return '\\' + op + '\\limits_';
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. KaTeX 统一容器渲染驱动
  // ─────────────────────────────────────────────────────────────────────────────
  var KATEX_DELIMITERS = [
    { left: '$$', right: '$$', display: true },
    { left: '$', right: '$', display: false },
    { left: '\\[', right: '\\]', display: true },
    { left: '\\(', right: '\\)', display: false }
  ];

  function renderMathInElementSafely(element, options) {
    if (!element) return;
    var autoRender = (typeof window !== 'undefined' && window.renderMathInElement) ? window.renderMathInElement :
                     (typeof renderMathInElement !== 'undefined' ? renderMathInElement : null);
    if (!autoRender) return;
    var opts = options || {};
    try {
      autoRender(element, {
        delimiters: opts.delimiters || KATEX_DELIMITERS,
        ignoredClasses: opts.ignoredClasses || ['currency-dollar', 'katex-ignore'],
        throwOnError: opts.throwOnError !== undefined ? opts.throwOnError : false,
        errorColor: opts.errorColor || '#cc0000'
      });
    } catch (e) {
      console.warn('[MarkdownLatexEngine] KaTeX render error:', e);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. 核心渲染管道 (Markdown + LaTeX + DOMPurify)
  // ─────────────────────────────────────────────────────────────────────────────
  function render(src, options) {
    if (!src) return '';
    var text = String(src);
    var opts = options || {};
    var isInline = !!opts.inline;
    var enableFastPath = opts.fastPath !== false;

    // 纯文本极速直出快道
    if (enableFastPath && isPlainString(text)) {
      return escapeHtml(text);
    }

    // 自愈容错：若整个文本被外层 $$...$$ 误包裹（常见于 OCR/AI 复制导出），且内部含有 \[、\] 或中文段落，自动剥离外层 $$
    var trimmed = text.trim();
    if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4) {
      var inner = trimmed.substring(2, trimmed.length - 2).trim();
      if (inner.includes('\\[') || inner.includes('\\]') || (/[\u4e00-\u9fa5]/.test(inner) && !inner.includes('\\text{'))) {
        text = inner;
      }
    }

    var markedParser = (typeof window !== 'undefined' && window.marked && window.marked.parse) ? window.marked.parse :
                       (typeof marked !== 'undefined' && marked.parse ? marked.parse : null);

    // 先抽离数学公式，以 0, 1 占位，避免 marked 的 Markdown 转义破坏 LaTeX 语法（如 \{, \\, _）
    // 严格遵循数学公式定界符规范：前置 $ 后面不可紧跟数字或空白，后置 $ 前面不可为空白，规避货币金额 ($30, $120) 误伤
    var mathSpans = [];
    var protectedSrc = text.replace(/\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([^$\n]+?\\\)|\$(?!\d|\s)(?:[^\$\n]|\\\$)+?(?<!\s)\$/g, function (m) {
      var processed = optimizeMathOperators(m);
      mathSpans.push(processed);
      return '' + (mathSpans.length - 1) + '';
    });

    var html = '';
    try {
      if (markedParser) {
        var md = markedParser(protectedSrc, { breaks: opts.breaks !== false });
        html = sanitizeHtml(md);
      } else {
        html = escapeHtml(protectedSrc);
      }
    } catch (e) {
      html = escapeHtml(protectedSrc);
    }

    // Node 环境或无 DOM 环境兜底
    if (typeof document === 'undefined') {
      var restored = html.replace(/([0-9]+)/g, function (match, p1) {
        var idx = parseInt(p1, 10);
        return mathSpans[idx] !== undefined ? escapeHtml(mathSpans[idx]) : match;
      });
      return restored;
    }

    var holder = document.createElement('div');
    holder.innerHTML = html;
    restoreMathPlaceholders(holder, mathSpans);
    renderMathInElementSafely(holder, opts.katexOptions);

    var result = sanitizeHtml(holder.innerHTML);

    // 行内模式单段落精确剥离外层 <p>...</p>，支持胶囊、按钮无缝嵌入
    if (isInline && typeof result === 'string') {
      result = result.trim();
      if (result.startsWith('<p>') && result.endsWith('</p>') && result.indexOf('<p>', 3) === -1) {
        result = result.substring(3, result.length - 4);
      }
    }

    return result;
  }

  var inlineRenderCache = new Map();

  function renderInline(src, options) {
    if (!options && typeof src === 'string') {
      var cached = inlineRenderCache.get(src);
      if (cached !== undefined) return cached;
      var out = render(src, { inline: true });
      if (inlineRenderCache.size > 2000) inlineRenderCache.clear();
      inlineRenderCache.set(src, out);
      return out;
    }
    var opts = Object.assign({}, options, { inline: true });
    return render(src, opts);
  }

  function renderBlock(src, options) {
    var opts = Object.assign({}, options, { inline: false });
    return render(src, opts);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. 通用输入框代码片段插入与光标/选区控制
  // ─────────────────────────────────────────────────────────────────────────────
  // 判断 snippet 是否含有光标占位符 ⦙ 或作为占位符的单竖线 |
  function hasCursorPlaceholder(snippet) {
    if (!snippet || typeof snippet !== 'string') return false;
    if (snippet.indexOf('⦙') !== -1) return true;
    if (snippet.indexOf('|') === -1) return false;
    var isNorm = /\\\|/.test(snippet);
    var isArraySpec = /\{cc\|c\}/.test(snippet);
    var isLiteralBar = /(^\|[A-Za-z0-9\\\\]|f\(\\lambda\) = \||\left\||P\([^)]*\|)/.test(snippet) &&
                       !/(\{[\|]+\}|\|[\\s]*&|\{\|\})/.test(snippet);
    return !isNorm && !isArraySpec && !isLiteralBar;
  }

  function insertSnippet(inputEl, snippet, onUpdate) {
    if (!inputEl) return null;
    var start = inputEl.selectionStart !== undefined ? inputEl.selectionStart : inputEl.value.length;
    var end = inputEl.selectionEnd !== undefined ? inputEl.selectionEnd : start;
    var val = inputEl.value;
    var selected = val.substring(start, end);

    var insertText = snippet;
    var targetCursor = start + snippet.length;

    var placeholder = null;
    if (snippet.indexOf('⦙') !== -1) {
      placeholder = '⦙';
    } else if (hasCursorPlaceholder(snippet)) {
      placeholder = '|';
    }

    if (placeholder) {
      if (selected) {
        insertText = snippet.replace(placeholder, selected);
        targetCursor = start + insertText.length;
      } else {
        var pIdx = snippet.indexOf(placeholder);
        insertText = snippet.replace(placeholder, '');
        targetCursor = start + pIdx;
      }
    }

    inputEl.value = val.substring(0, start) + insertText + val.substring(end);
    inputEl.selectionStart = targetCursor;
    inputEl.selectionEnd = targetCursor;
    inputEl.focus();

    if (typeof onUpdate === 'function') {
      onUpdate(inputEl.value);
    }

    return { value: inputEl.value, cursor: targetCursor };
  }

  function wrapSelection(inputEl, openChar, closeChar, onUpdate) {
    if (!inputEl) return null;
    var start = inputEl.selectionStart !== undefined ? inputEl.selectionStart : inputEl.value.length;
    var end = inputEl.selectionEnd !== undefined ? inputEl.selectionEnd : start;
    var val = inputEl.value;
    var sel = val.substring(start, end);
    var insertText = openChar + sel + closeChar;

    inputEl.value = val.substring(0, start) + insertText + val.substring(end);
    inputEl.selectionStart = start + openChar.length;
    inputEl.selectionEnd = end + openChar.length;
    inputEl.focus();

    if (typeof onUpdate === 'function') {
      onUpdate(inputEl.value);
    }
    return { value: inputEl.value, start: inputEl.selectionStart, end: inputEl.selectionEnd };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. 通用实时预览绑定数据流 (bindLivePreview)
  // ─────────────────────────────────────────────────────────────────────────────
  function bindLivePreview(inputEl, previewEl, options) {
    if (!inputEl || !previewEl) {
      return { update: function () {}, destroy: function () {} };
    }
    var opts = options || {};
    var isInline = opts.inline !== undefined ? opts.inline : (inputEl.tagName === 'INPUT');
    var emptyHtml = opts.emptyPlaceholder !== undefined ? opts.emptyPlaceholder : '<span style="color:var(--text-muted)">（暂无输入内容）</span>';
    var debounceMs = opts.debounceMs !== undefined ? opts.debounceMs : 30;
    var timer = null;

    var doUpdate = function () {
      var val = inputEl.value ? inputEl.value.trim() : '';
      if (!val) {
        previewEl.innerHTML = emptyHtml;
        if (typeof opts.onEmpty === 'function') opts.onEmpty();
      } else {
        previewEl.innerHTML = isInline ? renderInline(val) : renderBlock(val);
        if (typeof opts.onNonEmpty === 'function') opts.onNonEmpty(previewEl.innerHTML);
      }
      if (typeof opts.onUpdate === 'function') opts.onUpdate(val, previewEl.innerHTML);
    };

    var inputHandler = function () {
      if (debounceMs <= 0) {
        doUpdate();
      } else {
        clearTimeout(timer);
        timer = setTimeout(doUpdate, debounceMs);
      }
    };

    inputEl.addEventListener('input', inputHandler);

    return {
      update: doUpdate,
      destroy: function () {
        clearTimeout(timer);
        inputEl.removeEventListener('input', inputHandler);
      }
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. 统一接口暴露
  // ─────────────────────────────────────────────────────────────────────────────
  return {
    escapeHtml: escapeHtml,
    isPlainString: isPlainString,
    sanitizeHtml: sanitizeHtml,
    optimizeMathOperators: optimizeMathOperators,
    hasCursorPlaceholder: hasCursorPlaceholder,
    render: render,
    renderInline: renderInline,
    renderBlock: renderBlock,
    renderMathInElement: renderMathInElementSafely,
    insertSnippet: insertSnippet,
    wrapSelection: wrapSelection,
    bindLivePreview: bindLivePreview
  };
});