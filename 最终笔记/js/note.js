/**
 * 最终笔记阅读器
 * 数据：js/data.js → window.NOTE_DATA（嵌入，无 fetch）
 * 样式：与主站 Quiet Liquid 一致（清华紫 / 液态玻璃）
 */
(function () {
  'use strict';

  var state = { chapterId: null };
  var els = {};

  function $(s) { return document.querySelector(s); }

  function escapeHtml(str) {
    if (typeof MarkdownLatexEngine !== 'undefined' && MarkdownLatexEngine.escapeHtml) {
      return MarkdownLatexEngine.escapeHtml(str);
    }
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderMd(md) {
    if (typeof MarkdownLatexEngine !== 'undefined' && MarkdownLatexEngine.renderBlock) {
      return MarkdownLatexEngine.renderBlock(md);
    }
    if (typeof marked !== 'undefined' && marked.parse) {
      var html = marked.parse(md || '');
      return (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(html) : html;
    }
    return '<pre></pre>';
  }

  function extractToc(md) {
    var lines = String(md || '').split(/\r?\n/);
    var items = [];
    var slugCount = {};
    for (var i = 0; i < lines.length; i++) {
      var m = /^(#{1,3})\s+(.+)$/.exec(lines[i]);
      if (!m) continue;
      var level = m[1].length;
      var display = m[2].trim().replace(/[*`]/g, '');
      var slug = 'h-' + level + '-' + display.replace(/[^\w一-龥]+/g, '-').slice(0, 40);
      if (slugCount[slug]) {
        slugCount[slug] += 1;
        slug = slug + '-' + slugCount[slug];
      } else {
        slugCount[slug] = 1;
      }
      items.push({ level: level, text: display, slug: slug });
    }
    return items;
  }

  function currentChapter() {
    var data = window.NOTE_DATA;
    if (!data || !data.chapters) return null;
    var id = state.chapterId || (data.chapters[0] && data.chapters[0].id);
    for (var i = 0; i < data.chapters.length; i++) {
      if (data.chapters[i].id === id) return data.chapters[i];
    }
    return data.chapters[0];
  }

  function bindHeadingIds(toc) {
    var content = els.content;
    if (!content) return;
    var heads = content.querySelectorAll('h1, h2, h3');
    var map = toc.filter(function (t) { return t.level <= 3; });
    var idx = 0;
    for (var j = 0; j < heads.length; j++) {
      var el = heads[j];
      var text = (el.textContent || '').trim().replace(/\s+/g, '');
      while (idx < map.length && map[idx].text.replace(/\s+/g, '') !== text) idx++;
      if (idx < map.length) {
        el.id = map[idx].slug;
        idx++;
      } else if (!el.id) {
        el.id = 'sec-' + j;
      }
    }
  }

  function renderToc(toc) {
    var nav = els.nav;
    if (!nav) return;
    var html = '';
    toc.forEach(function (t) {
      if (t.text === '第1章　函数与极限' || t.text === '第1章 函数与极限') return;
      var cls = 'l' + Math.min(t.level, 3);
      html += '<a class="' + cls + '" href="#' + t.slug + '" data-slug="' + t.slug + '">' +
        escapeHtml(t.text) + '</a>';
    });
    nav.innerHTML = html;
  }

  function renderChapter() {
    var ch = currentChapter();
    if (!ch) {
      els.content.innerHTML = '<p style="color:#D32F2F">未找到笔记数据</p>';
      return;
    }
    els.chapterNo.textContent = ch.number || '';
    els.docTitle.textContent = ch.title || '';
    els.docSub.textContent = ch.subtitle || ch.subtitle === '' ? (ch.subtitle || '') : '';
    els.docSub.textContent = ch.subtitle || '';
    els.content.innerHTML = renderMd(ch.md);

    var quotes = els.content.querySelectorAll('blockquote');
    for (var i = 0; i < quotes.length; i++) {
      if ((quotes[i].textContent || '').indexOf('同步块') !== -1) {
        quotes[i].classList.add('sync-block');
      }
    }

    var toc = extractToc(ch.md);
    renderToc(toc);
    bindHeadingIds(toc);

    if (els.tocMobile) {
      var opts = toc.filter(function (t) { return t.level <= 2 && t.text.indexOf('第1章') !== 0; })
        .map(function (t) {
          return '<option value="' + t.slug + '">' + escapeHtml(t.text) + '</option>';
        }).join('');
      els.tocMobile.innerHTML = '<select>' + opts + '</select>';
      var sel = els.tocMobile.querySelector('select');
      if (sel) {
        sel.addEventListener('change', function () {
          var el = document.getElementById(sel.value);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        });
      }
    }
  }

  function buildChapterList() {
    var data = window.NOTE_DATA;
    var box = els.chapters;
    if (!box || !data || !data.chapters) return;
    var html = '';
    data.chapters.forEach(function (c) {
      html += '<a class="l1" href="#" data-ch="' + c.id + '">' +
        escapeHtml((c.number || '') + ' ' + (c.title || '')) + '</a>';
    });
    box.innerHTML = html;
  }

  function toggleTheme() {
    var body = document.body;
    var dark = body.getAttribute('data-theme') === 'dark';
    if (dark) body.removeAttribute('data-theme');
    else body.setAttribute('data-theme', 'dark');
    try { localStorage.setItem('note-theme', dark ? 'light' : 'dark'); } catch (e) {}
  }

  function initTheme() {
    try {
      var t = localStorage.getItem('note-theme');
      if (t === 'dark') document.body.setAttribute('data-theme', 'dark');
    } catch (e) {}
  }

  function init() {
    els.content = $('#content');
    els.nav = $('#toc');
    els.chapters = $('#chapters');
    els.chapterNo = $('#chapter-no');
    els.docTitle = $('#doc-title');
    els.docSub = $('#doc-sub');
    els.tocMobile = $('#toc-mobile');
    els.btnTheme = $('#btn-theme');

    initTheme();
    if (els.btnTheme) els.btnTheme.addEventListener('click', toggleTheme);

    if (!window.NOTE_DATA || !window.NOTE_DATA.chapters || !window.NOTE_DATA.chapters.length) {
      els.content.innerHTML = '<p style="color:#D32F2F">缺少 js/data.js 数据。</p>';
      return;
    }

    buildChapterList();
    els.chapters.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-ch]');
      if (!a) return;
      e.preventDefault();
      state.chapterId = a.getAttribute('data-ch');
      renderChapter();
      window.scrollTo(0, 0);
    });
    els.nav.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-slug]');
      if (!a) return;
      e.preventDefault();
      var el = document.getElementById(a.getAttribute('data-slug'));
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    state.chapterId = window.NOTE_DATA.chapters[0].id;
    renderChapter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
