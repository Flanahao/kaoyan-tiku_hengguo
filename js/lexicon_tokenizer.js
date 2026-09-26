/**
 * Kaoyan-Tiku: Lexicon Tokenizer & Sentence Highlighting Engine (LexiconTokenizer)
 * 职责：
 *   1. 保护 LaTeX 数学公式与美元金额 ($30, $120)。
 *   2. 考查画线词句 (underlinedPhrases) 优先锚定。
 *   3. Canonical Phrase 短语贪婪探测与嵌套单字支持。
 *   4. 全文正文英文单词 100% Token 化并赋予点击能力。
 *   5. 遵循「查得到 ≠ 值得高亮」：仅 canonical / curated 标注重点词获得颜色高亮。
 */

(function (global) {
  'use strict';

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 格式化句子 HTML
   * @param {string} rawText 句子英文原文
   * @param {Array} sentenceOccurrences 当前句对应的 Canonical Occurrences
   * @param {Array} underlinedPhrases 试题考查画线词句
   * @param {string} ps 句子坐标 (如 "P1-S1")
   * @param {string} articleId 当前文章 ID
   * @returns {string} 安全的 HTML 字符串
   */
  function renderSentenceHtml(rawText, sentenceOccurrences, underlinedPhrases, ps, articleId) {
    if (!rawText) return '';

    // 1. LaTeX 数学公式与货币符号保护
    var mathPlaceholders = [];
    var safeText = rawText.replace(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$(?!\d|\s)(?:[^\$\n]|\\\$)+?(?<!\s)\$)/g, function (m) {
      var idx = mathPlaceholders.length;
      mathPlaceholders.push(m);
      return '___MATH_PH_' + idx + '___';
    });

    var len = safeText.length;
    var occupied = new Uint8Array(len);

    // 占位符禁止被切分
    var phRegex = /___MATH_PH_\d+___/g;
    var phMatch;
    while ((phMatch = phRegex.exec(safeText)) !== null) {
      for (var i = phMatch.index; i < phMatch.index + phMatch[0].length; i++) {
        occupied[i] = 1;
      }
    }

    var spans = []; // { start, end, type: 'underlined'|'phrase'|'word', data: ... }

    // 2. 优先匹配考查画线词句 (Exam Underlined Phrases)
    if (underlinedPhrases && underlinedPhrases.length > 0) {
      var sortedUps = underlinedPhrases.slice().sort(function (a, b) {
        return (b.phrase || '').length - (a.phrase || '').length;
      });
      sortedUps.forEach(function (up) {
        if (!up.phrase) return;
        var pEsc = escapeRegExp(up.phrase);
        var reg = new RegExp('(?<![a-zA-Z0-9_])(' + pEsc + ')(?![a-zA-Z0-9_])', 'gi');
        var m;
        while ((m = reg.exec(safeText)) !== null) {
          var start = m.index;
          var end = start + m[0].length;
          var overlap = false;
          for (var j = start; j < end; j++) {
            if (occupied[j]) { overlap = true; break; }
          }
          if (!overlap) {
            for (var k = start; k < end; k++) occupied[k] = 1;
            spans.push({
              start: start,
              end: end,
              rawText: m[0],
              type: 'underlined',
              underlinedObj: up
            });
          }
        }
      });
    }

    // 3. 匹配当前句的 Canonical Phrases (短语优先)
    var occList = sentenceOccurrences || [];
    var phraseOccs = occList.filter(function (occ) {
      var s = (occ.surface || '').trim();
      return s.indexOf(' ') !== -1 || (occ.lexemeId && occ.lexemeId.indexOf('phrase') !== -1);
    }).sort(function (a, b) {
      return (b.surface || '').length - (a.surface || '').length;
    });

    phraseOccs.forEach(function (pOcc) {
      var sEsc = escapeRegExp(pOcc.surface);
      var reg = new RegExp('(?<![a-zA-Z0-9_])(' + sEsc + ')(?![a-zA-Z0-9_])', 'gi');
      var m;
      while ((m = reg.exec(safeText)) !== null) {
        var start = m.index;
        var end = start + m[0].length;
        var overlap = false;
        for (var j = start; j < end; j++) {
          if (occupied[j]) { overlap = true; break; }
        }
        if (!overlap) {
          for (var k = start; k < end; k++) occupied[k] = 1;
          spans.push({
            start: start,
            end: end,
            rawText: m[0],
            type: 'canonical-phrase',
            occurrence: pOcc
          });
        }
      }
    });

    // 4. 匹配当前句的 Canonical 单字 Occurrences
    var wordOccs = occList.filter(function (occ) {
      return (occ.surface || '').indexOf(' ') === -1;
    }).sort(function (a, b) {
      return (b.surface || '').length - (a.surface || '').length;
    });

    wordOccs.forEach(function (wOcc) {
      var wEsc = escapeRegExp(wOcc.surface);
      var reg = new RegExp('(?<![a-zA-Z0-9_])(' + wEsc + ')(?![a-zA-Z0-9_])', 'gi');
      var m;
      while ((m = reg.exec(safeText)) !== null) {
        var start = m.index;
        var end = start + m[0].length;
        var overlap = false;
        for (var j = start; j < end; j++) {
          if (occupied[j]) { overlap = true; break; }
        }
        if (!overlap) {
          for (var k = start; k < end; k++) occupied[k] = 1;
          spans.push({
            start: start,
            end: end,
            rawText: m[0],
            type: 'canonical-word',
            occurrence: wOcc
          });
        }
      }
    });

    // 5. 对剩余未被认领的正常英文文本进行 Token 化（使全文所有单词 100% 可点）
    // 匹配常规英文词汇：支持内部撇号和连字符 (e.g. don't, nation's, up-to-date)
    var wordRegex = /[a-zA-Z0-9]+(?:['’\-][a-zA-Z0-9]+)*/g;
    var wMatch;
    while ((wMatch = wordRegex.exec(safeText)) !== null) {
      var start = wMatch.index;
      var end = start + wMatch[0].length;
      var overlap = false;
      for (var j = start; j < end; j++) {
        if (occupied[j]) { overlap = true; break; }
      }
      if (!overlap) {
        // 如果纯数字则不作为词汇 token（保留普通文本）
        if (!/^\d+$/.test(wMatch[0])) {
          for (var k = start; k < end; k++) occupied[k] = 1;
          spans.push({
            start: start,
            end: end,
            rawText: wMatch[0],
            type: 'plain-token',
            occurrence: null
          });
        }
      }
    }

    // 6. 按起始索引升序排列，单趟生成 HTML
    spans.sort(function (a, b) {
      return a.start - b.start;
    });

    function getHighlightClasses(occ) {
      if (!occ) return '';
      var classes = [];
      var ann = occ.annotations || {};
      if (ann.examPointPdf) {
        classes.push('level-red');
      } else if (ann.obstacleWord) {
        classes.push('level-green');
      } else if (occ.type === 'phrase' || (occ.surface && occ.surface.indexOf(' ') !== -1)) {
        classes.push('level-blue');
      }

      if (ann.familiarWordUncommonMeaning) {
        classes.push('level-amber');
      }
      if (ann.personalPdf) {
        classes.push('is-personal-pdf');
      }
      if (ann.properNoun) {
        classes.push('is-proper-noun');
      }
      return classes.join(' ');
    }

    var result = '';
    var lastIdx = 0;

    spans.forEach(function (item) {
      if (item.start > lastIdx) {
        var gap = safeText.slice(lastIdx, item.start);
        result += escapeHtml(gap).replace(/\$(?=\d)/g, '<span class="currency-dollar">$</span>');
      }

      var textEsc = escapeHtml(item.rawText);
      var surfaceEsc = escapeHtml(item.rawText);
      var psAttr = ps ? ' data-ps="' + escapeHtml(ps) + '"' : '';
      var artAttr = articleId ? ' data-article-id="' + escapeHtml(articleId) + '"' : '';

      if (item.type === 'underlined') {
        var up = item.underlinedObj;
        var qTitle = up.qIndex ? ('第 ' + up.qIndex + ' 题考查词句（点击直达对应题目）') : '真题考查词句';
        result += '<span class="exam-underlined-phrase lex-token" data-surface="' + surfaceEsc + '"' + psAttr + artAttr + ' data-qindex="' + (up.qIndex || '') + '" title="' + qTitle + '">' + textEsc + '</span>';
      } else if (item.type === 'canonical-phrase') {
        var pOcc = item.occurrence;
        var pClasses = getHighlightClasses(pOcc) || 'level-blue';
        var occId = pOcc.occurrenceId;
        var lexId = pOcc.lexemeId;
        var pMeaning = pOcc.context ? (pOcc.context.contextMeaning || '') : '';
        result += '<span class="vocab-word lex-phrase lex-token ' + pClasses + '" data-word="' + surfaceEsc + '" data-surface="' + surfaceEsc + '" data-phrase-surface="' + surfaceEsc + '" data-occ-id="' + occId + '" data-lexeme-id="' + lexId + '" data-meaning="' + escapeHtml(pMeaning) + '"' + psAttr + artAttr + ' title="考研短语搭配: ' + textEsc + '">' + textEsc + '</span>';
      } else if (item.type === 'canonical-word') {
        var wOcc = item.occurrence;
        var wClasses = getHighlightClasses(wOcc);
        var wOccId = wOcc.occurrenceId;
        var wLexId = wOcc.lexemeId;
        var wMeaning = wOcc.context ? (wOcc.context.contextMeaning || '') : '';
        // 重点词高亮加 vocab-word，未评级为重点的为普通 lex-token
        var baseCls = wClasses ? ('vocab-word ' + wClasses) : 'lex-token lex-word';
        result += '<span class="' + baseCls + '" data-word="' + surfaceEsc + '" data-surface="' + surfaceEsc + '" data-occ-id="' + wOccId + '" data-lexeme-id="' + wLexId + '" data-meaning="' + escapeHtml(wMeaning) + '"' + psAttr + artAttr + '>' + textEsc + '</span>';
      } else {
        // plain-token：正文普通单词，无色高亮，但完全可点击
        result += '<span class="lex-token lex-word" data-surface="' + surfaceEsc + '"' + psAttr + artAttr + '>' + textEsc + '</span>';
      }

      lastIdx = item.end;
    });

    if (lastIdx < len) {
      var tail = safeText.slice(lastIdx);
      result += escapeHtml(tail).replace(/\$(?=\d)/g, '<span class="currency-dollar">$</span>');
    }

    // 7. 还原 LaTeX 数学公式
    result = result.replace(/___MATH_PH_(\d+)___/g, function (m, idx) {
      return mathPlaceholders[parseInt(idx, 10)] || '';
    });

    return result;
  }

  var LexiconTokenizer = {
    renderSentenceHtml: renderSentenceHtml,
    escapeHtml: escapeHtml
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LexiconTokenizer;
  }
  global.LexiconTokenizer = LexiconTokenizer;

})(typeof window !== 'undefined' ? window : global);
