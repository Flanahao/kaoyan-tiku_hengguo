/**
 * 第1章讲义对照页
 * 数据已嵌入 js/data.js（window.CH1_DATA），同步渲染，不依赖 fetch。
 * Marked + KaTeX + DOMPurify（经 MarkdownLatexEngine）
 */
(function () {
  'use strict';

  var state = {
    mode: 'render', // render | outline | raw
    sync: false,
    active: {}
  };

  var els = {};
  var CACHE = {}; // id -> { src, md, ok }

  function $(sel) { return document.querySelector(sel); }

  function loadEmbeddedSources() {
    var data = window.CH1_DATA;
    if (!data || !data.sources || !data.sources.length) {
      console.error('[ch1-compare] window.CH1_DATA missing or empty');
      return [];
    }
    return data.sources.map(function (s) {
      return {
        id: s.id,
        name: s.name,
        role: s.role,
        desc: s.desc || '',
        defOn: !!s.defOn,
        relPath: s.relPath || '',
        md: s.md || ''
      };
    });
  }

  var SOURCES = loadEmbeddedSources();

  function extractHeadings(md) {
    var lines = String(md || '').split(/\r?\n/);
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var m = /^(#{1,6})\s+(.+)$/.exec(lines[i]);
      if (m) out.push(m[1] + ' ' + m[2].trim());
    }
    return out.join('\n');
  }

  function escapeHtml(str) {
    if (typeof MarkdownLatexEngine !== 'undefined' && MarkdownLatexEngine.escapeHtml) {
      return MarkdownLatexEngine.escapeHtml(str);
    }
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderMarkdown(md) {
    if (typeof MarkdownLatexEngine !== 'undefined' && MarkdownLatexEngine.renderBlock) {
      return MarkdownLatexEngine.renderBlock(md);
    }
    if (typeof marked !== 'undefined' && marked.parse) {
      var html = marked.parse(md, { breaks: false });
      if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
      }
      return html;
    }
    return '<pre class="raw-text">' + escapeHtml(md) + '</pre>';
  }

  function paneHtml(item) {
    if (!item || !item.ok) {
      return '<div class="status err">无内容：' + escapeHtml((item && item.error) || 'data 缺失') + '</div>';
    }
    if (state.mode === 'raw') {
      return '<article><div class="raw-text">' + escapeHtml(item.md) + '</div></article>';
    }
    var bodyMd = item.md;
    if (state.mode === 'outline') {
      bodyMd = extractHeadings(item.md);
      if (!bodyMd) bodyMd = '（无标题）';
    }
    return '<article>' + renderMarkdown(bodyMd) + '</article>';
  }

  function byteLabel(text) {
    var n = new Blob([text || '']).size;
    if (n < 1024) return n + ' B';
    return (n / 1024).toFixed(1) + ' KB';
  }

  function lineLabel(text) {
    return String(text || '').split(/\r?\n/).length + ' 行';
  }

  function activeSources() {
    return SOURCES.filter(function (s) { return state.active[s.id]; });
  }

  /** 同步布局 + 同步渲染全部内容 */
  function renderLayout() {
    var list = activeSources();
    var wrap = els.panes;
    wrap.innerHTML = '';
    wrap.classList.toggle('outline-mode', state.mode === 'outline');

    if (!list.length) {
      wrap.innerHTML = '<div class="status">请在上方勾选至少一个数据源</div>';
      return;
    }

    list.forEach(function (src) {
      // 预置缓存（嵌入数据，始终 ok）
      CACHE[src.id] = { src: src, md: src.md, ok: !!src.md, error: src.md ? '' : 'md 为空' };

      var item = CACHE[src.id];
      var col = document.createElement('div');
      col.className = 'pane-wrap';
      col.dataset.id = src.id;

      var head = document.createElement('div');
      head.className = 'pane-head';
      head.innerHTML =
        '<span class="dot ' + src.role + '"></span>' +
        '<span class="name">' + escapeHtml(src.name) + '</span>' +
        '<span class="meta" data-meta="' + src.id + '">' +
        (item.ok ? lineLabel(item.md) + ' · ' + byteLabel(item.md) : '空') +
        '</span>';

      var pane = document.createElement('div');
      pane.className = 'pane' + (state.mode === 'raw' ? ' raw' : '') + (state.mode === 'outline' ? ' outline' : '');
      pane.dataset.id = src.id;
      pane.innerHTML = paneHtml(item);

      col.appendChild(head);
      col.appendChild(pane);
      wrap.appendChild(col);
    });
  }

  function rerenderPanes() {
    var wrap = els.panes;
    wrap.classList.toggle('outline-mode', state.mode === 'outline');
    activeSources().forEach(function (src) {
      var item = CACHE[src.id];
      var pane = wrap.querySelector('.pane[data-id="' + src.id + '"]');
      if (!pane || !item) return;
      pane.className = 'pane' + (state.mode === 'raw' ? ' raw' : '') + (state.mode === 'outline' ? ' outline' : '');
      pane.innerHTML = paneHtml(item);
    });
  }

  function buildChips() {
    var box = els.chips;
    box.innerHTML = '<span class="label">数据源</span>';
    SOURCES.forEach(function (s) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip' + (state.active[s.id] ? ' on' : '');
      btn.textContent = s.name;
      btn.title = (s.desc || '') + (s.relPath ? '\n' + s.relPath : '');
      btn.dataset.id = s.id;
      btn.addEventListener('click', function () {
        state.active[s.id] = !state.active[s.id];
        btn.classList.toggle('on', !!state.active[s.id]);
        renderLayout();
      });
      box.appendChild(btn);
    });
  }

  function setMode(mode) {
    state.mode = mode;
    els.btnRender.classList.toggle('active', mode === 'render');
    els.btnOutline.classList.toggle('active', mode === 'outline');
    els.btnRaw.classList.toggle('active', mode === 'raw');
    rerenderPanes();
  }

  function setAll(on) {
    SOURCES.forEach(function (s) { state.active[s.id] = on; });
    buildChips();
    renderLayout();
  }

  function toggleSync() {
    state.sync = !state.sync;
    els.btnSync.classList.toggle('active', state.sync);
    els.btnSync.textContent = state.sync ? '同步滚动：开' : '同步滚动：关';
  }

  function onPaneScroll(e) {
    if (!state.sync) return;
    var srcPane = e.target;
    if (!srcPane.classList || !srcPane.classList.contains('pane')) return;
    var max = srcPane.scrollHeight - srcPane.clientHeight;
    var ratio = max > 0 ? srcPane.scrollTop / max : 0;
    var panes = els.panes.querySelectorAll('.pane');
    for (var i = 0; i < panes.length; i++) {
      var p = panes[i];
      if (p === srcPane) continue;
      var m = p.scrollHeight - p.clientHeight;
      p.scrollTop = ratio * m;
    }
  }

  function bind() {
    els.chips = $('#chips');
    els.panes = $('#panes');
    els.btnRender = $('#btn-render');
    els.btnOutline = $('#btn-outline');
    els.btnRaw = $('#btn-raw');
    els.btnSync = $('#btn-sync');
    els.btnAll = $('#btn-all');
    els.btnNone = $('#btn-none');
    els.btnDefault = $('#btn-default');
    els.info = $('#data-info');

    els.btnRender.addEventListener('click', function () { setMode('render'); });
    els.btnOutline.addEventListener('click', function () { setMode('outline'); });
    els.btnRaw.addEventListener('click', function () { setMode('raw'); });
    els.btnSync.addEventListener('click', toggleSync);
    els.btnAll.addEventListener('click', function () { setAll(true); });
    els.btnNone.addEventListener('click', function () { setAll(false); });
    els.btnDefault.addEventListener('click', function () {
      SOURCES.forEach(function (s) { state.active[s.id] = !!s.defOn; });
      buildChips();
      renderLayout();
    });

    els.panes.addEventListener('scroll', onPaneScroll, true);
  }

  function init() {
    if (!SOURCES.length) {
      document.getElementById('panes').innerHTML =
        '<div class="status err">未找到嵌入数据 window.CH1_DATA，请确认已加载 js/data.js</div>';
      return;
    }

    // 默认全部打开，便于直接比对
    SOURCES.forEach(function (s) { state.active[s.id] = true; });

    bind();
    if (els.info) {
      var gen = (window.CH1_DATA && window.CH1_DATA.generatedAt) || '';
      els.info.textContent = '已嵌入 ' + SOURCES.length + ' 个数据源' + (gen ? ' · ' + gen.slice(0, 19).replace('T', ' ') : '');
    }
    buildChips();
    setMode('render');
    renderLayout();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
