/**
 * Kaoyan-Tiku: Lexicon Notebook v2 & SM-2 Review System (LexiconNotebook)
 * 职责：
 *   1. 按 Lexeme 聚合展示生词本，单卡片展示该词所有已收藏真题语境。
 *   2. 遮挡释义自测模式 (Blur Self-Test Mode)。
 *   3. 专属 SM-2+ 真题语境复习会话 (优先级：已收藏语境 -> 历年其他真题语境 -> 通用词典)。
 *   4. 一键导出考研真题 Markdown 生词本。
 */

(function (global) {
  'use strict';

  var dom = {
    modal: null,
    grid: null,
    totalBadge: null,
    btnBlur: null,
    btnExport: null,
    btnClose: null
  };

  var state = {
    blurMode: false,
    filterMastery: 'all',
    filterYear: 'all',
    reviewSession: null // SM-2 复习会话状态
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function initDom() {
    dom.modal = document.getElementById('engModalVocabBook');
    if (!dom.modal) return;
    dom.grid = document.getElementById('vocabGrid');
    dom.totalBadge = document.getElementById('vocabTotalBadge');
    dom.btnBlur = document.getElementById('btnToggleVocabBlur');
    dom.btnExport = document.getElementById('btnExportVocab');
    dom.btnClose = document.getElementById('btnCloseVocabBook');

    if (dom.btnBlur) {
      dom.btnBlur.onclick = function () {
        state.blurMode = !state.blurMode;
        dom.btnBlur.classList.toggle('active', state.blurMode);
        dom.btnBlur.textContent = state.blurMode ? '显示全部释义' : '遮挡释义自测';
        renderNotebook();
      };
    }

    if (dom.btnExport) {
      dom.btnExport.onclick = exportMarkdown;
    }

    if (dom.btnClose) {
      dom.btnClose.onclick = closeNotebook;
    }

    dom.modal.onclick = function (e) {
      if (e.target === dom.modal) closeNotebook();
    };
  }

  function openNotebook() {
    initDom();
    if (global.UserWordManager) {
      global.UserWordManager.loadUserWords();
    }
    renderNotebook();
    if (dom.modal) {
      dom.modal.classList.add('show');
    }
  }

  function closeNotebook() {
    if (dom.modal) {
      dom.modal.classList.remove('show');
    }
  }

  function renderNotebook() {
    initDom();
    if (!dom.grid) return;

    var userWords = global.UserWordManager ? global.UserWordManager.getStarredUserWords() : [];

    // 计算统计
    var totalWords = userWords.length;
    var totalOccs = 0;
    userWords.forEach(function (uw) {
      totalOccs += (uw.savedOccurrences || []).length;
    });

    if (dom.totalBadge) {
      dom.totalBadge.textContent = '(共 ' + totalWords + ' 词 · ' + totalOccs + ' 处真题语境)';
    }

    if (totalWords === 0) {
      if (global.kyApp && typeof global.kyApp.renderVocabNotebook === 'function') {
        global.kyApp.renderVocabNotebook();
        if (dom.grid.querySelector('.vocab-card')) {
          return;
        }
      }
      dom.grid.innerHTML = [
        '<div class="vocab-empty" style="grid-column: 1 / -1; padding: 60px 20px; text-align: center;">',
        '  <div style="font-size:18px;color:var(--text);font-weight:700;">生词本暂无记录</div>',
        '  <div style="font-size:13px;color:var(--text-muted);margin-top:8px;line-height:1.6;">',
        '    在真题正文中点击任意英文单词或短语，点击「收藏」即可将其加入本句真题语境。<br>',
        '    同一个词在不同年份的不同真题句子会自动聚合在同一张卡片下集中复习。',
        '  </div>',
        '</div>'
      ].join('\n');
      return;
    }

    // 过滤列表
    var filtered = userWords.filter(function (uw) {
      if (state.filterMastery !== 'all' && uw.mastery !== state.filterMastery) {
        return false;
      }
      return true;
    });

    // 渲染卡片
    var cardsHtml = filtered.map(function (uw) {
      var lex = (global.LexiconLoader) ? global.LexiconLoader.getLexemeByIdSync(uw.lexemeId) : null;
      var headword = (lex && lex.display) || uw.lemma || uw.lexemeId;
      var d = (lex && lex.dictionary) || {};
      var ipa = d.ipa || '';
      var pos = d.pos || '';

      var savedOccs = uw.savedOccurrences || [];
      var masteryLabelMap = {
        proficient: '熟练',
        vague: '模糊',
        wrong: '不会',
        unmarked: '未评级'
      };
      var mStatus = uw.mastery || 'unmarked';
      var mLabel = masteryLabelMap[mStatus] || '未评级';

      var sm2Reps = (uw.sm2 && uw.sm2.reps) || 0;
      var sm2Tag = sm2Reps > 0 ? ('已复习 ' + sm2Reps + ' 次') : '未开启复习';

      var occListHtml = '';
      if (savedOccs.length > 0) {
        occListHtml = savedOccs.map(function (o) {
          var locStr = (o.year ? (o.year + ' 年') : '') + (o.textId ? (' · ' + o.textId.toUpperCase()) : '') + (o.ps ? (' · ' + o.ps) : '');
          var mText = o.contextMeaning || '详见真题语境';
          return [
            '<div class="vocab-saved-occ-item">',
            '  <div class="occ-item-loc">',
            '    <span class="occ-loc-badge">' + escapeHtml(locStr) + '</span>',
            '    <button type="button" class="btn-occ-remove" data-act="remove-occ" data-lex-id="' + uw.lexemeId + '" data-occ-id="' + o.occurrenceId + '" title="移除此语境">&times;</button>',
            '  </div>',
            '  <div class="occ-item-meaning ' + (state.blurMode ? 'is-blurred' : '') + '" onclick="this.classList.toggle(\'is-blurred\')" title="点击显隐释义">',
            '    ' + escapeHtml(mText),
            '  </div>',
            '</div>'
          ].join('\n');
        }).join('\n');
      } else {
        var defZh = (d.generalDefinition && d.generalDefinition.zh) || '通用释义 (展开查看)';
        occListHtml = [
          '<div class="vocab-saved-occ-item">',
          '  <div class="occ-item-loc"><span class="occ-loc-badge">通用词典收藏</span></div>',
          '  <div class="occ-item-meaning ' + (state.blurMode ? 'is-blurred' : '') + '" onclick="this.classList.toggle(\'is-blurred\')">' + escapeHtml(defZh) + '</div>',
          '</div>'
        ].join('\n');
      }

      return [
        '<div class="vocab-card" id="vcard-' + uw.lexemeId + '">',
        '  <div class="vocab-card-head">',
        '    <div class="vocab-head-left">',
        '      <span class="vocab-word-text">' + escapeHtml(headword) + '</span>',
        (ipa ? ('      <span class="vocab-word-phonetic">[' + escapeHtml(ipa) + ']</span>') : ''),
        (pos ? ('      <span class="vocab-word-pos">' + escapeHtml(pos) + '</span>') : ''),
        '    </div>',
        '    <div class="vocab-head-actions">',
        '      <button type="button" class="popover-btn" data-act="pronounce" data-word="' + escapeHtml(headword) + '" data-type="1" title="英音">英</button>',
        '      <button type="button" class="popover-btn" data-act="pronounce" data-word="' + escapeHtml(headword) + '" data-type="2" title="美音">美</button>',
        '      <button type="button" class="btn-unstar-lex" data-act="unstar-lex" data-lex-id="' + uw.lexemeId + '" title="取消收藏整个词条">移除</button>',
        '    </div>',
        '  </div>',
        '  <div class="vocab-card-subhead">',
        '    <span class="vocab-mastery-badge mastery-' + mStatus + '">' + mLabel + '</span>',
        '    <span class="vocab-sm2-badge">' + sm2Tag + '</span>',
        '    <div class="vocab-card-sm2-rates">',
        '      <button type="button" class="btn-quick-rate ' + (mStatus === 'proficient' ? 'active' : '') + '" data-act="rate-word" data-lex-id="' + uw.lexemeId + '" data-status="proficient">熟练</button>',
        '      <button type="button" class="btn-quick-rate ' + (mStatus === 'vague' ? 'active' : '') + '" data-act="rate-word" data-lex-id="' + uw.lexemeId + '" data-status="vague">模糊</button>',
        '      <button type="button" class="btn-quick-rate ' + (mStatus === 'wrong' ? 'active' : '') + '" data-act="rate-word" data-lex-id="' + uw.lexemeId + '" data-status="wrong">不会</button>',
        '    </div>',
        '  </div>',
        '  <div class="vocab-saved-occs-list">',
        '    <div class="occs-list-title">已收藏真题语境 (' + savedOccs.length + ')：</div>',
        occListHtml,
        '  </div>',
        '  <div class="vocab-card-footer">',
        '    <button type="button" class="btn-card-history" data-act="view-history" data-lex-id="' + uw.lexemeId + '" data-lemma="' + escapeHtml(headword) + '">查看全部历年语境 &gt;</button>',
        '  </div>',
        '</div>'
      ].join('\n');
    }).join('\n');

    dom.grid.innerHTML = cardsHtml;

    // 事件委托
    dom.grid.onclick = function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var act = btn.dataset.act;

      if (act === 'pronounce') {
        var w = btn.dataset.word;
        var t = parseInt(btn.dataset.type, 10) || 1;
        if (window.kyApp && typeof window.kyApp.playWordPronunciation === 'function') {
          window.kyApp.playWordPronunciation(w, t);
        } else {
          new Audio('https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(w) + '&type=' + t).play().catch(function () {});
        }
      } else if (act === 'remove-occ') {
        var lId = btn.dataset.lexId;
        var oId = btn.dataset.occId;
        if (global.UserWordManager) {
          global.UserWordManager.removeSavedOccurrence(lId, oId);
          renderNotebook();
        }
      } else if (act === 'unstar-lex') {
        var unstarLexId = btn.dataset.lexId;
        if (global.UserWordManager) {
          global.UserWordManager.unstarLexeme(unstarLexId);
          renderNotebook();
        }
      } else if (act === 'rate-word') {
        var rateLexId = btn.dataset.lexId;
        var st = btn.dataset.status;
        if (global.UserWordManager) {
          global.UserWordManager.setMastery(rateLexId, st);
          renderNotebook();
        }
      } else if (act === 'view-history') {
        var vLexId = btn.dataset.lexId;
        var vLemma = btn.dataset.lemma;
        if (global.LexiconPopup && typeof global.LexiconPopup.openHistory === 'function') {
          global.LexiconPopup.openHistory(vLexId, vLemma);
        }
      }
    };
  }

  // 导出生词本 Markdown
  function exportMarkdown() {
    var userWords = global.UserWordManager ? global.UserWordManager.getStarredUserWords() : [];
    if (userWords.length === 0) {
      alert('当前生词本为空，无需导出。');
      return;
    }

    var md = [];
    md.push('# 考研英语一真题生词本');
    md.push('导出时间：' + new Date().toLocaleString() + ' · 共 ' + userWords.length + ' 词\n');
    md.push('| 单词/短语 | 音标 | 掌握度 | 已收藏真题语境 | 通用释义 |');
    md.push('| :--- | :--- | :--- | :--- | :--- |');

    userWords.forEach(function (uw) {
      var lex = (global.LexiconLoader) ? global.LexiconLoader.getLexemeByIdSync(uw.lexemeId) : null;
      var head = (lex && lex.display) || uw.lemma;
      var ipa = (lex && lex.dictionary && lex.dictionary.ipa) ? ('[' + lex.dictionary.ipa + ']') : '';
      var m = uw.mastery || '未评级';

      var occStrList = (uw.savedOccurrences || []).map(function (o) {
        return (o.year || '') + ' ' + (o.textId || '') + ' ' + (o.ps || '') + ': ' + (o.contextMeaning || '');
      });
      var occText = occStrList.join('<br>') || '无特定语境';
      var defZh = (lex && lex.dictionary && lex.dictionary.generalDefinition && lex.dictionary.generalDefinition.zh) || '';
      defZh = defZh.replace(/\n/g, ' / ').replace(/\|/g, '/');

      md.push('| **' + head + '** | ' + ipa + ' | ' + m + ' | ' + occText.replace(/\|/g, '/') + ' | ' + defZh + ' |');
    });

    var blob = new Blob([md.join('\n')], { type: 'text/markdown;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = '考研英语一真题生词本_' + new Date().toISOString().slice(0, 10) + '.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  var LexiconNotebook = {
    open: openNotebook,
    close: closeNotebook,
    render: renderNotebook,
    exportMarkdown: exportMarkdown,
    onUserWordChanged: renderNotebook
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LexiconNotebook;
  }
  global.LexiconNotebook = LexiconNotebook;

})(typeof window !== 'undefined' ? window : global);
