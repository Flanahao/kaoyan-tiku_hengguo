/**
 * 最终笔记 · 全幅工作区（经典脚本，file:// 可开）
 * 视图：笔记 | 知识树 | 分屏
 * 侧栏默认收起；无中间纸框
 */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };

  var state = {
    view: 'note',
    chapterId: null,
    graph: null,
    mind: null,
    mindReady: false,
    mindFailed: false
  };

  function escapeHtml(str) {
    if (window.MarkdownLatexEngine && MarkdownLatexEngine.escapeHtml) {
      return MarkdownLatexEngine.escapeHtml(str);
    }
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderMd(md) {
    if (window.MarkdownLatexEngine && MarkdownLatexEngine.renderBlock) {
      return MarkdownLatexEngine.renderBlock(md);
    }
    if (window.marked && marked.parse) {
      var html = marked.parse(md || '');
      return window.DOMPurify ? DOMPurify.sanitize(html) : html;
    }
    return '<pre></pre>';
  }

  function currentChapter() {
    var data = window.NOTE_DATA;
    if (!data || !data.chapters || !data.chapters.length) return null;
    var id = state.chapterId || data.chapters[0].id;
    for (var i = 0; i < data.chapters.length; i++) {
      if (data.chapters[i].id === id) return data.chapters[i];
    }
    return data.chapters[0];
  }

  function ensureHeadingIds() {
    var content = $('#content');
    var graph = state.graph;
    if (!content || !graph) return;
    var heads = content.querySelectorAll('h1, h2, h3, h4');
    var list = graph.nodes.filter(function (n) { return n.type !== 'sync'; });
    var idx = 0;
    for (var i = 0; i < heads.length; i++) {
      var el = heads[i];
      var text = (el.textContent || '').trim().replace(/\s+/g, '');
      while (
        idx < list.length &&
        (list[idx].title || '').replace(/\s+/g, '') !== text
      ) idx++;
      if (idx < list.length) {
        el.id = list[idx].bodyId || list[idx].id;
        el.setAttribute('data-node-id', list[idx].id);
        idx++;
      } else if (!el.id) {
        el.id = 'sec-' + i;
      }
    }
  }

  function renderTocFromGraph() {
    var graph = state.graph;
    var nav = $('#toc');
    if (!graph || !nav || !window.NoteSchema) return;
    var items = window.NoteSchema.tocFromNodes(graph.nodes);
    var html = '';
    items.forEach(function (t) {
      if (t.type === 'chapter') return;
      var lvl = Math.min(t.level || 2, 4);
      html +=
        '<a class="l' + Math.min(lvl, 3) + '" href="#' + t.slug +
        '" data-slug="' + t.slug + '" data-node="' + t.id + '">' +
        escapeHtml(t.text) + '</a>';
    });
    nav.innerHTML = html;

    var mobile = $('#toc-mobile');
    if (mobile) {
      var opts = items
        .filter(function (t) { return t.type !== 'chapter' && (t.level || 9) <= 3; })
        .map(function (t) {
          return '<option value="' + t.slug + '">' + escapeHtml(t.text) + '</option>';
        })
        .join('');
      mobile.innerHTML = '<select>' + opts + '</select>';
      var sel = mobile.querySelector('select');
      if (sel) {
        sel.addEventListener('change', function () {
          var el = document.getElementById(sel.value);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        });
      }
    }
  }

  function highlightLinearByNode(nodeId) {
    var content = $('#content');
    if (!content || !state.graph || !window.NoteSchema) return;
    var node = window.NoteSchema.findById(state.graph.nodes, nodeId);
    if (!node) return;

    var actives = content.querySelectorAll('.me-active-heading');
    for (var i = 0; i < actives.length; i++) {
      actives[i].classList.remove('me-active-heading');
    }
    var el = document.getElementById(node.bodyId);
    if (el) {
      el.classList.add('me-active-heading');
      if (state.view === 'note' || state.view === 'split') {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    var detail = $('#node-detail');
    if (detail) {
      detail.innerHTML =
        '<div class="nd-type">' + escapeHtml(node.type || '') + '</div>' +
        '<div class="nd-title">' + escapeHtml(node.title || '') + '</div>' +
        (node.summary
          ? '<div class="nd-sum">' + escapeHtml(node.summary) + '</div>'
          : '') +
        '<button type="button" class="btn nd-jump">在正文中查看</button>';
      var jump = detail.querySelector('.nd-jump');
      if (jump) {
        jump.addEventListener('click', function () {
          if (state.view === 'tree') setView('split');
          requestAnimationFrame(function () {
            highlightLinearByNode(nodeId);
          });
        });
      }
    }
  }

  function selectMindNode(nodeId) {
    if (!state.mind || !state.mindReady || !nodeId) return;
    try {
      // v4: selectNode 支持 id 字符串；若失败再试 findEle
      state.mind.selectNode(nodeId);
    } catch (e) {
      try {
        var el = state.mind.findEle && state.mind.findEle(nodeId);
        if (el) state.mind.selectNode(el);
      } catch (e2) {
        console.warn('[mind] select failed', e2);
      }
    }
  }

  /**
   * 从 Mind Elixir 节点 DOM 上取稳定知识点 id
   * v4 会把 data-nodeid 写成 "m"+原 id；优先读 element.nodeObj.id
   */
  function mindDomNodeId(nEl) {
    if (!nEl) return null;
    if (nEl.nodeObj && nEl.nodeObj.id) return nEl.nodeObj.id;
    var raw =
      nEl.getAttribute('data-nodeid') ||
      nEl.getAttribute('data-node-id') ||
      (nEl.dataset &&
        (nEl.dataset.nodeid || nEl.dataset.nodeId));
    if (!raw) return null;
    if (window.NoteSchema && state.graph) {
      if (window.NoteSchema.findById(state.graph.nodes, raw)) return raw;
    }
    // 去掉可能的 me/m 前缀
    if (raw.charAt(0) === 'm' && raw.length > 1) {
      var alt = raw.slice(1);
      if (window.NoteSchema && state.graph &&
          window.NoteSchema.findById(state.graph.nodes, alt)) {
        return alt;
      }
      return alt;
    }
    return raw;
  }

  function onMindPick(payload) {
    var node =
      (payload && (payload.nodeObj || payload.nodeData)) || payload || null;
    var id = node && node.id;
    if (id) highlightLinearByNode(id);
  }

  function mapEl() { return $('#mind-map'); }

  function destroyMind() {
    if (state.mind) {
      try { if (state.mind.destroy) state.mind.destroy(); } catch (e) {}
    }
    state.mind = null;
    state.mindReady = false;
    var map = mapEl();
    if (map) map.innerHTML = '';
  }

  /**
   * 知识树初始化：必须在容器已显示且有尺寸之后再 new MindElixir
   * （先前切到「知识树」时 display 刚从 none 变出来，宽度为 0 会导致画布空白）
   */
  function initMindElixirWhenReady() {
    var el = mapEl();
    if (!el) return;

    var w = el.clientWidth || 0;
    var h = el.clientHeight || 0;
    if (w < 40 || h < 40) {
      // 等一帧布局完成后再试
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          initMindElixirWhenReady();
        });
      });
      return;
    }

    if (state.mindReady) {
      try { if (state.mind.toCenter) state.mind.toCenter(); } catch (e) {}
      return;
    }

    if (typeof MindElixir === 'undefined') {
      el.innerHTML =
        '<div style="padding:24px;color:#D32F2F">Mind Elixir 未加载（lib/mind-elixir/MindElixir.iife.js）</div>';
      return;
    }
    if (!state.graph || !window.MeAdapter) {
      el.innerHTML = '<div style="padding:24px">知识图数据未就绪</div>';
      return;
    }

    var meData = window.MeAdapter.graphToMindElixir(state.graph);
    var mind;
    try {
      mind = new MindElixir({
        el: el,
        direction: 2,
        draggable: true,
        editable: false,
        contextMenu: false,
        toolBar: true,
        nodeMenu: false,
        keypress: true
      });
      mind.init(meData);
    } catch (err) {
      console.error('[mind] init error', err);
      el.innerHTML =
        '<div style="padding:24px;color:#D32F2F">知识树初始化失败：' +
        escapeHtml(String(err && err.message ? err.message : err)) + '</div>';
      return;
    }

    state.mind = mind;
    state.mindReady = true;

    if (mind.bus && mind.bus.on) {
      mind.bus.on('selectNode', onMindPick);
      mind.bus.on('selectNodes', onMindPick);
    }

    el.addEventListener('click', function (e) {
      var nEl =
        e.target.closest &&
        e.target.closest('me-tpc, me-node, [data-nodeid], [data-node-id]');
      if (!nEl) return;
      var id = mindDomNodeId(nEl);
      if (id) onMindPick({ id: id });
    });

    try { if (mind.toCenter) mind.toCenter(); } catch (e) {}
  }

  function setView(view) {
    state.view = view;
    var app = $('#app');
    if (app) app.setAttribute('data-view', view);

    var btns = document.querySelectorAll('[data-view-btn]');
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute('data-view-btn') === view;
      if (on) btns[i].classList.add('primary');
      else btns[i].classList.remove('primary');
    }

    var showNote = view === 'note' || view === 'split';
    var showTree = view === 'tree' || view === 'split';
    var notePane = $('#note-pane');
    var treePane = $('#tree-pane');

    if (notePane) {
      if (showNote) notePane.classList.remove('hidden');
      else notePane.classList.add('hidden');
    }
    if (treePane) {
      if (showTree) treePane.classList.remove('hidden');
      else treePane.classList.add('hidden');
    }

    if (showTree) {
      // 先让布局生效，再初始化 / 居中
      requestAnimationFrame(function () {
        initMindElixirWhenReady();
      });
    }
  }

  function buildGraphForChapter(ch) {
    var md = ch.md || '';
    if (ch.graph && ch.graph.nodes && ch.graph.nodes.length) {
      state.graph = ch.graph;
      return;
    }
    if (!window.MdToGraph) {
      state.graph = { chapterId: ch.id, title: ch.title, nodes: [] };
      return;
    }
    state.graph = window.MdToGraph.parse(md, {
      chapterId: ch.id || 'ch1',
      title: ch.title
    });
    ch.graph = state.graph;
  }

  function renderNoteChrome() {
    var ch = currentChapter();
    if (!ch) return;
    $('#chapter-no').textContent = ch.number || '';
    $('#doc-title').textContent = ch.title || '';
    $('#doc-sub').textContent = ch.subtitle || '';
    document.title = (
      '最终笔记 · ' + ((ch.number || '') + ' ' + (ch.title || '')).trim()
    ).trim();

    buildGraphForChapter(ch);
    var content = $('#content');
    content.innerHTML = renderMd(ch.md);

    var quotes = content.querySelectorAll('blockquote');
    for (var i = 0; i < quotes.length; i++) {
      if ((quotes[i].textContent || '').indexOf('同步块') !== -1) {
        quotes[i].classList.add('sync-block');
      }
    }

    ensureHeadingIds();
    renderTocFromGraph();
    destroyMind();

    if (state.view === 'tree' || state.view === 'split') {
      requestAnimationFrame(function () {
        initMindElixirWhenReady();
      });
    }
  }

  function buildChapterList() {
    var data = window.NOTE_DATA;
    var box = $('#chapters');
    if (!box || !data || !data.chapters) return;
    var html = '';
    data.chapters.forEach(function (c) {
      html +=
        '<a class="l1" href="#" data-ch="' + c.id + '">' +
        escapeHtml((c.number || '') + ' ' + (c.title || '')) + '</a>';
    });
    box.innerHTML = html;
  }

  function toggleTheme() {
    var dark = document.body.getAttribute('data-theme') === 'dark';
    if (dark) document.body.removeAttribute('data-theme');
    else document.body.setAttribute('data-theme', 'dark');
    try {
      localStorage.setItem('note-theme', dark ? 'light' : 'dark');
    } catch (e) {}
    if (state.view === 'tree' || state.view === 'split') {
      destroyMind();
      requestAnimationFrame(function () {
        initMindElixirWhenReady();
      });
    }
  }

  function toggleSide() {
    var app = $('#app');
    if (!app) return;
    app.classList.toggle('side-collapsed');
    // 侧栏开合会改变主区宽度 → 树需重算
    if (state.view === 'tree' || state.view === 'split') {
      requestAnimationFrame(function () {
        if (state.mindReady && state.mind && state.mind.toCenter) {
          try { state.mind.toCenter(); } catch (e) {}
        } else {
          initMindElixirWhenReady();
        }
      });
    }
  }

  function init() {
    try {
      var t = localStorage.getItem('note-theme');
      if (t === 'dark') document.body.setAttribute('data-theme', 'dark');
      var sidePref = localStorage.getItem('note-side');
      if (sidePref === 'open') {
        var app0 = $('#app');
        if (app0) app0.classList.remove('side-collapsed');
      }
    } catch (e) {}

    var content = $('#content');
    if (!window.NOTE_DATA || !window.NOTE_DATA.chapters || !window.NOTE_DATA.chapters.length) {
      content.innerHTML =
        '<p style="color:#D32F2F">缺少 js/data.js。请打开本目录下的 index.html。</p>';
      return;
    }
    if (!window.NoteSchema || !window.MdToGraph || !window.MeAdapter) {
      content.innerHTML =
        '<p style="color:#D32F2F">缺少 schema / md-to-graph / me-adapter。</p>';
      return;
    }

    state.chapterId = window.NOTE_DATA.chapters[0].id;

    document.querySelectorAll('[data-view-btn]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setView(btn.getAttribute('data-view-btn'));
      });
    });

    var sideBtn = $('#btn-side');
    if (sideBtn) {
      sideBtn.addEventListener('click', function () {
        toggleSide();
        try {
          var collapsed = $('#app').classList.contains('side-collapsed');
          localStorage.setItem('note-side', collapsed ? 'closed' : 'open');
        } catch (e) {}
      });
    }

    $('#toc').addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[data-slug]');
      if (!a) return;
      e.preventDefault();
      var slug = a.getAttribute('data-slug');
      var nodeId = a.getAttribute('data-node');
      var el = document.getElementById(slug);
      if (el && state.view !== 'tree') {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (nodeId) {
        highlightLinearByNode(nodeId);
        if (state.view !== 'note') selectMindNode(nodeId);
      }
    });

    content.addEventListener('click', function (e) {
      var h = e.target.closest && e.target.closest('h1[id],h2[id],h3[id],h4[id]');
      if (!h) return;
      var nodeId = h.getAttribute('data-node-id') || h.id;
      if (!nodeId) return;
      highlightLinearByNode(nodeId);
      if (state.view !== 'note') selectMindNode(nodeId);
    });

    var themeBtn = $('#btn-theme');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    $('#chapters').addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[data-ch]');
      if (!a) return;
      e.preventDefault();
      state.chapterId = a.getAttribute('data-ch');
      renderNoteChrome();
    });

    window.addEventListener('resize', function () {
      if ((state.view === 'tree' || state.view === 'split') && state.mindReady) {
        try { if (state.mind.toCenter) state.mind.toCenter(); } catch (e) {}
      }
    });

    buildChapterList();
    renderNoteChrome();
    setView('note');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
