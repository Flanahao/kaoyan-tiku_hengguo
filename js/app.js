'use strict';

    // ===== 全局常量 =====
    // 仪表盘/错题本列顺序（高数→线代→概率论）
    var SUBJECT_ORDER = ['高数', '线代', '概率论'];

    // localStorage 容量溢出保护：写入失败时静默捕获并在控制台提示
    // 大体积数据（标注 JSON、SM-2 全量）优先使用此函数，避免 QuotaExceededError 静默丢失数据
    function safeLSSet(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        if (e && (e.name === 'QuotaExceededError' || e.code === 22)) {
          console.warn('[题库] localStorage 已满，无法保存键:', key, '。请尝试清理旧标注数据。');
        }
      }
    }

    // ===== 章节数据（已移至 js/chapters.js）=====

    let curSubjectId = 'math';
    window.curSubjectId = curSubjectId;
    let curSubject = SUBJECTS[0];
    window.curSubject = curSubject;
    let CHAPTERS = curSubject.chapters;   // 当前科目章节数组（原 const 改 let，切换科目时重赋值）
    window.CHAPTERS = CHAPTERS;
    function getCurrentSubject() { return curSubject; }
// ===== 状态变量 (0-based) =====
    let currentChapterId = 'math::基础30讲::高数::lec00';
    let current = 0;
    let showSolution = true;
    let defaultShowSolution = true;
    let statuses = {};
    let qBad = {};   // R键：题目图不达标  { idx: true }
    let sBad = {};   // T键：解析图不达标  { idx: true }
    let bookMismatch = {}; // R+T键：该题与实书不符  { idx: true }
    let currentFilters = new Set(['all']);
    let subMode = false; // F键：小题选择模式（仅当前题组含子题时生效）
    let visualRows = []; // W/S 视觉行映射，每个元素是一个数组包含该行的 group.startIdx

    function isAllFilterActive() {
      return currentFilters.has('all') || currentFilters.size === 0;
    }

    function getChapter() { return CHAPTERS.find(function(c) { return c.id === currentChapterId; }); }
    function chapterById(id) {
      if (!id) return null;
      var found = CHAPTERS.find(function(c) { return c.id === id; });
      if (found) return found;
      if (typeof SUBJECTS !== 'undefined') {
        for (var s = 0; s < SUBJECTS.length; s++) {
          var subChs = SUBJECTS[s].chapters || [];
          var f = subChs.find(function(c) { return c.id === id; });
          if (f) return f;
        }
      }
      return null;
    }

    // ===== 合并章节（1000题/李范习题并入）辅助 =====
    // 当前索引所属分区：idx 落在合并章节的伴章段 → 30讲/36讲为 '1000题'，李范全书为 '习题'；否则按标签分类
    function partOfIdx(idx, targetCh) {
      const ch = targetCh || getChapter();
      if (ch && ch.parts) {
        const p = ch.parts.find(function (pt) { return idx >= pt.start && idx < pt.start + pt.count; });
        if (p) return p.type;
      }
      if (ch && ch.q1000Total && idx >= ch.ownTotal) {
        if (ch.wb === '李范全书') return '习题';
        return '1000题';
      }
      if (ch && ch.wb === '老姚高数' && ch.sections) {
        const s = ch.sections.find(function (sec) { return idx >= sec.start && idx < sec.start + sec.count; });
        if (s) return s.type;
      }
      return (curSubject && curSubject.classifyLabel) ? curSubject.classifyLabel(ch ? ch.labels[idx] : '', ch) : classifyLabel(ch ? ch.labels[idx] : '');
    }
    // 笔记命名空间键：避免「30讲例1-1」与「1000题1-1」笔记键冲突。
    // 返回 '<源章节id>::<标签>'，源章节 = 1000题伴章（1000段）或本章（自身段）。
    function notesKeyFor(idx) {
      const ch = getChapter();
      if (!ch) return '';
      const label = (ch.labels && ch.labels[idx]) ? ch.labels[idx] : idx;
      if (ch.q1000Total && idx >= ch.ownTotal) {
        const qc = (ch.q1000Id && typeof chapterById === 'function') ? chapterById(ch.q1000Id) : null;
        return (qc ? qc.id : ch.id) + '::' + label;
      }
      return ch.id + '::' + label;
    }

    // ===== 题组（父题/子题）解析 =====
    // 去掉 label 末尾括号及内容（支持 (1)、(a)、(I)、全角括号），得到父题号
    function stripSubSuffix(label) { return String(label).replace(/\s*[\(（][^\)）]*[\)）]\s*$/, ''); }
    // 提取 label 末尾括号内容，如 '3-4(1)' -> '(1)'；无括号返回原 label
    function subSuffix(label) { const m = String(label).match(/[\(（][^\)）]*[\)）]\s*$/); return m ? m[0].trim() : String(label); }

    // 为章节计算 subGroups / groupForIdx（懒计算，缓存在章节对象上）
    function ensureGroups(ch) {
      if (ch.subGroups && ch.groupForIdx) return;
      const labels = ch.labels || [];
      const groups = [];
      let i = 0;
      while (i < labels.length) {
        const parent = stripSubSuffix(labels[i]);
        const hasParen = parent !== labels[i];
        let j = i + 1;
        if (hasParen) {
          while (j < labels.length && stripSubSuffix(labels[j]) === parent && stripSubSuffix(labels[j]) !== labels[j]) j++;
        }
        groups.push({ parentLabel: parent, startIdx: i, count: j - i, isParent: hasParen && (j - i) > 1 });
        i = j;
      }
      ch.subGroups = groups;
      ch.groupForIdx = new Array(labels.length);
      groups.forEach(g => { for (let k = 0; k < g.count; k++) ch.groupForIdx[g.startIdx + k] = g; });
    }

    // 题组内当前筛选下可见的索引列表
    // filteredSet 可传入预计算的筛中索引集合，避免在 renderNav 等热路径中反复调用 getFilteredIndices()。
    // 传入 null 且当前为「全部」筛选时，直接返回整组（跳过 Set 构建）。
    function groupVisibleIndices(g, filteredSet) {
      if (!filteredSet) {
        if (isAllFilterActive()) {
          return Array.from({ length: g.count }, (_, k) => g.startIdx + k);
        }
        filteredSet = new Set(getFilteredIndices());
      }
      const out = [];
      for (let k = 0; k < g.count; k++) { const idx = g.startIdx + k; if (filteredSet.has(idx)) out.push(idx); }
      return out;
    }
    function totalQuestions() { return getChapter().total; }

    // ===== 筛选相关 =====
    function updateFilterButtons() {
      document.querySelectorAll('.filter-btn').forEach(b => {
        const active = currentFilters.has(b.dataset.filter);
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    function applyFilter(filterKey) {
      if (filterKey === 'all') {
        currentFilters = new Set(['all']);
      } else {
        if (currentFilters.has('all')) currentFilters.delete('all');
        if (currentFilters.has(filterKey)) {
          currentFilters.delete(filterKey);
          if (currentFilters.size === 0) currentFilters.add('all');
        } else {
          currentFilters.add(filterKey);
        }
      }
      updateFilterButtons();
      saveGlobalFilters(); // 筛选状态持久化（跨会话记忆）
      const filtered = getFilteredIndices();
      updateFilterCounts();
      renderNav();
      if (filtered.length > 0 && !isFiltered(current)) {
        switchTo(filtered[0]);
      }
    }

    // 检查题目是否具有标注（文字笔记、图片标注、或关联考点/同类题）
    function hasQuestionMarked(idx) {
      if (notesData[notesKeyFor(idx)]) return true;
      if (typeof hasQuestionImagesAnnotated === 'function' && hasQuestionImagesAnnotated(idx)) return true;
      var qid = (typeof getQid === 'function') ? getQid(curSubjectId, currentChapterId, idx) : '';
      if (qid) {
        if (typeof window.hasTopicsForQid === 'function') return window.hasTopicsForQid(qid);
        if (window.TopicManager && typeof window.TopicManager.hasTopicsForQid === 'function') return window.TopicManager.hasTopicsForQid(qid);
        var fn = (typeof getTopicsForQid === 'function') ? getTopicsForQid : (window.TopicManager && window.TopicManager.getTopicsForQid);
        if (typeof fn === 'function' && fn(qid).length > 0) return true;
      }
      return false;
    }

    function getFilteredIndices() {
      const ch = getChapter();
      const all = Array.from({ length: ch.total }, function(_, i) { return i; });
      if (isAllFilterActive()) return all;
      return all.filter(function(i) {
        // 带标注（含文字笔记、图片标注、关联同类题）
        if (currentFilters.has('unmarked')) {
          if (hasQuestionMarked(i)) return true;
        }
        const s = statuses[i] || '';
        // 熟练 = proficient(lv5)
        if (currentFilters.has('proficient') && s === 'proficient') return true;
        // 模糊 = vague(lv3) + familiar(lv4 较熟练)
        if (currentFilters.has('vague') && (s === 'vague' || s === 'familiar')) return true;
        // 不会 = wrong(lv1) + rusty(lv2 困难)
        if (currentFilters.has('wrong') && (s === 'wrong' || s === 'rusty')) return true;
        return false;
      });
    }
    function filteredIndex(idx) { return getFilteredIndices().indexOf(idx); }
    function isFiltered(idx) { return filteredIndex(idx) !== -1; }

    // ===== localStorage 持久化（按书分离：合并章节的自身部分与1000题部分分开存取） =====
    // 合并章节（ch 有 q1000Id）：内存态 statuses/qBad/sBad 用合并索引承载，
    // 保存时按 [本章自身段, 1000题伴章段] 拆到两本书各自的存储键，加载时反向合并。
    // 非合并章节与现状完全一致（单一源）。→ 进度天然按书分开。
    function statusSources(ch) {
      ch = ch || getChapter();
      // 合并章节：自身段长度为 ownTotal；非合并章节用 total
      const srcs = [{ ch: ch, offset: 0, len: (ch.q1000Total ? ch.ownTotal : ch.total) }];
      if (ch && ch.q1000Id) {
        srcs.push({ ch: chapterById(ch.q1000Id), offset: ch.ownTotal, len: ch.q1000Total });
      }
      return srcs;
    }
    // 通用：按「源章节+偏移」拆合（statuses/qBad/sBad/bookMismatch 共用）
    // 业界成熟设计：优先使用物理切图 Slug 与语义标签寻址，向下兼容旧数字索引
    function loadIndexedObj(readRaw, semanticType) {
      const out = {};
      statusSources().forEach(function (src) {
        let o = {};
        var raw = readRaw ? readRaw(src.ch) : null;
        if (!raw && semanticType && src.ch && src.ch.uid) {
          raw = localStorage.getItem(semanticType + '::' + src.ch.uid);
        }
        try { o = JSON.parse(raw) || {}; } catch (e) { o = {}; }
        var hasSemanticKeys = false;
        var oKeys = Object.keys(o);
        for (var ki = 0; ki < oKeys.length; ki++) {
          if (!/^\d+$/.test(oKeys[ki])) {
            hasSemanticKeys = true;
            break;
          }
        }
        for (var k = 0; k < src.len; k++) {
          var qSlug = (src.ch.getQuestionSlug ? src.ch.getQuestionSlug(k) : null);
          var qLabel = (src.ch.labels && src.ch.labels[k]) ? src.ch.labels[k] : null;
          var val = undefined;
          if (qSlug && o[qSlug] !== undefined) val = o[qSlug];
          else if (qLabel && o[qLabel] !== undefined) val = o[qLabel];
          else if (!hasSemanticKeys && o[k] !== undefined) val = o[k];

          if (val !== undefined) out[src.offset + k] = val;
        }
      });
      return out;
    }
    function saveIndexedObj(obj, writeRaw, removeRaw, semanticType) {
      statusSources().forEach(function (src) {
        const part = {};
        for (var k = 0; k < src.len; k++) {
          var val = obj[src.offset + k];
          if (val !== undefined) {
            var qSlug = (src.ch.getQuestionSlug ? src.ch.getQuestionSlug(k) : null);
            if (qSlug) part[qSlug] = val;
            part[k] = val; // 保持双向兼容
          }
        }
        const keys = Object.keys(part);
        if (keys.length > 0) {
          var jsonStr = JSON.stringify(part);
          if (writeRaw) writeRaw(src.ch, jsonStr);
          if (semanticType && src.ch && src.ch.uid) {
            safeLSSet(semanticType + '::' + src.ch.uid, jsonStr);
          }
        } else {
          if (removeRaw) removeRaw(src.ch);
          if (semanticType && src.ch && src.ch.uid) {
            localStorage.removeItem(semanticType + '::' + src.ch.uid);
          }
        }
      });
    }
    function notifyStorageSync() {
      if (window.storageSync && typeof window.storageSync.scheduleSave === 'function') {
        window.storageSync.scheduleSave();
      }
    }
    // ===== 存储引擎：ChapterStore 工厂（含伴章感知）=====
    function getStoresForCurrentChapter() {
      if (!window.StorageEngine) return null;
      var srcs = statusSources();
      return srcs.map(function (src) {
        return { store: new window.StorageEngine.ChapterStore(src.ch), offset: src.offset, len: src.len, ch: src.ch };
      });
    }

    // 从存储引擎加载指定字段到目标内存对象中。
    function loadFieldFromStore(targetObj, fieldName) {
      var stores = getStoresForCurrentChapter();
      if (!stores) return false;
      var loaded = false;
      stores.forEach(function (s) {
        if (s.store._loadRaw()) {
          loaded = true;
          var opts = {};
          opts[fieldName] = targetObj;
          s.store.readIntoMemory(opts, s.offset);
        }
      });
      return loaded;
    }

    // 将当前内存中某类字段写入存储引擎（原子合并，不覆盖其他字段）。
    function writeFieldToStore(fieldObj, fieldName) {
      var stores = getStoresForCurrentChapter();
      if (!stores) return;
      stores.forEach(function (s) {
        var opts = { offset: s.offset, len: s.len };
        opts[fieldName] = fieldObj;
        s.store.writeFromMemory(opts);
      });
    }

    // 统一获取章节掌握度状态字典 { [idx]: status }（SSOT 直读 ChapterStore，防漂移）
    function getChapterStatusMap(ch) {
      if (!ch) return {};
      var out = {};
      if (window.StorageEngine && ch.uid) {
        var store = new window.StorageEngine.ChapterStore(ch);
        store.readIntoMemory({ statuses: out }, 0);
        return out;
      }
      return out;
    }
    window.getChapterStatusMap = getChapterStatusMap;

    function loadStatuses() {
      statuses = {};
      loadFieldFromStore(statuses, 'statuses');
    }
    function saveStatuses() {
      writeFieldToStore(statuses, 'statuses');
      notifyStorageSync();
    }
    function loadQBad() {
      qBad = {};
      loadFieldFromStore(qBad, 'qBad');
    }
    function saveQBad() {
      writeFieldToStore(qBad, 'qBad');
      notifyStorageSync();
    }
    function loadSBad() {
      sBad = {};
      loadFieldFromStore(sBad, 'sBad');
    }
    function saveSBad() {
      writeFieldToStore(sBad, 'sBad');
      notifyStorageSync();
    }
    function loadBookMismatch() {
      bookMismatch = {};
      loadFieldFromStore(bookMismatch, 'bookMismatch');
    }
    function saveBookMismatch() {
      writeFieldToStore(bookMismatch, 'bookMismatch');
      notifyStorageSync();
    }

    // ===== 全局 UI 状态持久化（跨会话记忆，存储在 kaoyan.g / kaoyan.ui） =====
    function loadGlobalFilters() {
      var saved = null;
      if (window.StorageEngine && window.StorageEngine.GlobalStore) {
        saved = window.StorageEngine.GlobalStore.get('filters');
      }
      if (!saved || !Array.isArray(saved) || saved.length === 0) {
        currentFilters = new Set(['all']);
        return;
      }
      var valid = ['all', 'proficient', 'vague', 'wrong', 'unmarked'].filter(function (k) { return saved.indexOf(k) !== -1; });
      if (valid.indexOf('all') !== -1) currentFilters = new Set(['all']);
      else if (valid.length > 0) currentFilters = new Set(valid);
      else currentFilters = new Set(['all']);
    }
    function saveGlobalFilters() {
      var arr = Array.from(currentFilters);
      if (window.StorageEngine && window.StorageEngine.GlobalStore) {
        window.StorageEngine.GlobalStore.set('filters', arr);
      }
      notifyStorageSync();
    }

    function loadSolutionPref() {
      var v = null;
      if (window.StorageEngine && window.StorageEngine.UiStore) {
        v = window.StorageEngine.UiStore.get(curSubjectId);
      }
      if (v && typeof v.def === 'boolean') defaultShowSolution = v.def;
      else defaultShowSolution = true;
      if (v && typeof v.show === 'boolean') showSolution = v.show;
      else showSolution = defaultShowSolution;
    }
    function saveSolutionPref() {
      var pref = { show: !!showSolution, def: !!defaultShowSolution };
      if (window.StorageEngine && window.StorageEngine.UiStore) {
        window.StorageEngine.UiStore.set(curSubjectId, pref);
      }
      notifyStorageSync();
    }

    // ===== 笔记数据（按书分离：复合键 '<源章节id>::<label>'） =====
    let notesData = {};
    let notesDirty = false;
    function notesSourceId(idx) {
      const ch = getChapter();
      if (!ch) return '';
      if (ch.q1000Total && idx >= ch.ownTotal) {
        const qc = (ch.q1000Id && typeof chapterById === 'function') ? chapterById(ch.q1000Id) : null;
        return qc ? qc.id : ch.id;
      }
      return ch.id;
    }
    function loadNotes() {
      autoSaveNotes();
      notesData = {};
      if (window.StorageEngine) {
        var stores = getStoresForCurrentChapter();
        if (stores) {
          stores.forEach(function (s) {
            s.store.readIntoMemory({ notes: notesData }, s.offset);
          });
        }
      }
    }
    function saveNotes() {
      if (window.StorageEngine) {
        var stores = getStoresForCurrentChapter();
        if (stores) {
          stores.forEach(function (s) {
            s.store.writeFromMemory({ notes: notesData, offset: s.offset, len: s.len });
          });
        }
      }
      notifyStorageSync();
    }

    function getStatusClass(idx) {
      const s = statuses[idx];
      if (s === 'proficient') return 'proficient';
      if (s === 'familiar') return 'familiar';
      if (s === 'vague') return 'vague';
      if (s === 'rusty') return 'rusty';
      if (s === 'wrong') return 'wrong';
      return '';
    }

    // ===== 考研倒计时 =====
    const MOTIVATION_QUOTES = [
      '“星光不问赶路人，时光不负有心人。”',
      '“日拱一卒无有穷，终有凌云登顶时。”',
      '“既然选择了远方，便只顾风雨兼程。”',
      '“每一个清晨与深夜的伏案，都是通往梦想的阶梯。”',
      '“沉潜笃定，静待花开；乾坤未定，你我皆是黑马！”'
    ];

    function getKaoyanTargetDate() {
      const now = new Date();
      const currentYear = now.getFullYear();
      let target = new Date(currentYear, 11, 19, 8, 30, 0); // 12月19日
      if (now > target) {
        target = new Date(currentYear + 1, 11, 19, 8, 30, 0);
      }
      return target;
    }

    function renderCountdown() {
      const target = getKaoyanTargetDate();
      const now = new Date();
      const diffMs = target - now;
      const days = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      const sbDays = document.getElementById('sidebarCountdownDays');
      const sbDate = document.getElementById('sidebarCountdownDate');
      if (sbDays) sbDays.textContent = days + ' 天';
      if (sbDate) sbDate.textContent = target.getFullYear() + '/' + (target.getMonth() + 1) + '/' + target.getDate();

      const dbDays = document.getElementById('dbCountdownDays');
      const dbQuote = document.getElementById('dbCountdownQuote');
      if (dbDays) dbDays.textContent = days;
      if (dbQuote) {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const dayOfYear = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24));
        dbQuote.textContent = MOTIVATION_QUOTES[dayOfYear % MOTIVATION_QUOTES.length];
      }
    }

    // ===== 侧边栏 8 字数码管实时时钟 =====
    function updateClock() {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');

      const dH1 = document.getElementById('segH1');
      const dH2 = document.getElementById('segH2');
      const dM1 = document.getElementById('segM1');
      const dM2 = document.getElementById('segM2');
      const dS1 = document.getElementById('segS1');
      const dS2 = document.getElementById('segS2');

      if (dH1) dH1.setAttribute('data-val', h[0]);
      if (dH2) dH2.setAttribute('data-val', h[1]);
      if (dM1) dM1.setAttribute('data-val', m[0]);
      if (dM2) dM2.setAttribute('data-val', m[1]);
      if (dS1) dS1.setAttribute('data-val', s[0]);
      if (dS2) dS2.setAttribute('data-val', s[1]);

      const dateEl = document.getElementById('clockDate');
      if (dateEl) {
        const y = now.getFullYear();
        const mo = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const days = ['日', '一', '二', '三', '四', '五', '六'];
        const day = days[now.getDay()];
        dateEl.textContent = y + '/' + mo + '/' + d + ' 周' + day;
      }
    }
    setInterval(updateClock, 1000);
    updateClock();

    // ===== 昼夜主题（默认清华紫明亮 / 沉浸暗夜）与试卷暗化 =====
    let currentTheme = (window.StorageEngine && window.StorageEngine.GlobalStore && window.StorageEngine.GlobalStore.get('theme')) || 'light';
    let darkImageFilter = (window.StorageEngine && window.StorageEngine.GlobalStore && window.StorageEngine.GlobalStore.get('dark_img_filter')) === '1';

    const THEME_NAMES = {
      light: '明亮',
      dark: '暗夜'
    };

    function applyTheme(theme) {
      if (theme !== 'dark') theme = 'light';
      currentTheme = theme;
      document.documentElement.setAttribute('data-theme', theme);
      document.body.setAttribute('data-theme', theme);
      if (window.StorageEngine && window.StorageEngine.GlobalStore) {
        window.StorageEngine.GlobalStore.set('theme', theme);
      }

      var btnTheme = document.getElementById('btnToggleTheme');
      var engTxtTheme = document.getElementById('engTxtTheme');
      var themeLabel = THEME_NAMES[theme] || '明亮';

      if (btnTheme) btnTheme.innerHTML = '主题：' + themeLabel + '<span class="sol-key">Y</span>';
      if (engTxtTheme) engTxtTheme.textContent = '主题：' + themeLabel + ' (Y)';

      var btnDarkFilter = document.getElementById('btnDarkFilter');
      if (btnDarkFilter) {
        btnDarkFilter.style.display = (theme === 'dark') ? 'block' : 'none';
      }
      updateImageDarkFilter();
      notifyStorageSync();

      // 若当前正处于全局进度总览面板，立即重绘环形图以适配新主题配色
      if (typeof dashboardOpen !== 'undefined' && dashboardOpen) {
        var dbOverview = document.getElementById('dbOverview');
        if (dbOverview && dbOverview.style.display !== 'none') {
          renderDashboardOverview();
        }
      }
    }

    function toggleTheme() {
      applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    }
    window.toggleTheme = toggleTheme;

    function toggleImageDarkFilter() {
      darkImageFilter = !darkImageFilter;
      if (window.StorageEngine && window.StorageEngine.GlobalStore) {
        window.StorageEngine.GlobalStore.set('dark_img_filter', darkImageFilter ? '1' : '0');
      }
      updateImageDarkFilter();
      notifyStorageSync();
    }
    window.toggleImageDarkFilter = toggleImageDarkFilter;

    function updateImageDarkFilter() {
      var btnDarkFilter = document.getElementById('btnDarkFilter');
      if (btnDarkFilter) {
        btnDarkFilter.innerHTML = '试卷暗化：' + (darkImageFilter ? '开' : '关') + '<span class="sol-key">U</span>';
        btnDarkFilter.classList.toggle('active', darkImageFilter);
      }
      var enable = (currentTheme === 'dark' && darkImageFilter);
      var qImg = document.getElementById('questionImg');
      var lbImg = document.getElementById('lightboxImg');

      if (qImg) qImg.classList.toggle('dark-filter', enable);
      if (lbImg) lbImg.classList.toggle('dark-filter', enable);

      // 全面覆盖主试卷、主解析、同类题卡片、弹窗做题卡片与标注层
      document.querySelectorAll(
        '.question-img, #questionImg, .solution-img, #solutionImgs img, .solution-imgs img, #solutionArea img, ' +
        '.rc-img-box img, .rc-sol-box img, #rmViewerQImg, #rmViewerSolImgs img, mjs-marker-area'
      ).forEach(function(el) {
        el.classList.toggle('dark-filter', enable);
      });
    }

    // ===== 图片路径（按当前科目的 getImgPath） =====
    function getImgPath(idx) {
      const ch = getChapter();
      if (!ch || !ch.labels || idx < 0 || idx >= ch.labels.length) return '';
      // 合并章节的 1000题 段：路径路由到 1000题 伴章（标签与目录均为 pb_ 前缀）
      if (ch.q1000Total && idx >= ch.ownTotal) {
        const qc = chapterById(ch.q1000Id);
        if (qc && qc.labels && (idx - ch.ownTotal) < qc.labels.length) {
          return curSubject.getImgPath(qc, qc.labels[idx - ch.ownTotal]);
        }
      }
      return curSubject.getImgPath(ch, ch.labels[idx]);
    }


    // ===== 章节切换 =====
    function switchChapter(chapterId) {
      // 核心安全重定向：1000题或李范习题为并入母章的数据源伴章，绝不可作为独立章节打开，自动重定向至母章
      const allChs = (curSubject && curSubject.chapters) ? curSubject.chapters : CHAPTERS;
      const hostCh = allChs.find(function(c) {
        if (!c) return false;
        if (c.q1000Id === chapterId || c.lfxitiId === chapterId) return true;
        var qc = (typeof chapterById === 'function') ? (chapterById(c.q1000Id) || chapterById(c.lfxitiId)) : null;
        if (qc && (qc.id === chapterId || qc.uid === chapterId)) return true;
        return false;
      });
      if (hostCh) {
        switchChapter(hostCh.id);
        if (typeof hostCh.ownTotal === 'number') {
          switchTo(hostCh.ownTotal);
        }
        return;
      }

      const ch = CHAPTERS.find(c => c.id === chapterId || c.uid === chapterId);
      if (!ch || ch.total === 0) { console.warn('该章节尚未导入:', chapterId); return; }
      autoSaveNotes(); // 切章前保存未提交的笔记（loadNotes 会重建 notesData）
      currentChapterId = ch.id;
      current = 0;
      isAccordionMode = false;
      showSolution = defaultShowSolution;
      // 小题模式（F）是全局开关，切章不重置，跨章保持
      loadStatuses(); loadQBad(); loadSBad(); loadBookMismatch(); loadNotes(); loadSm2();
      // 每次切章先清除错题本返回状态（错题本跳题会在 switchTo 之后重新置位）
      showWrongBookReturnBtn(false);
      // 全局筛选跨章保持：不重置、不按章恢复，仅加载本章数据后定位到第一条筛中题
      updateFilterButtons();
      updateFilterCounts();
      // 优先恢复章节级停靠记录（切回某章回到上次停的题），再走定位逻辑。
      // 仅恢复位置，不恢复小题模式（全局开关由 F 控制，跨章保持）
      const chResume = loadChapterResume(ch.id);
      if (chResume) {
        current = chResume.idx;
        // 若全局筛选激活且恢复位置被筛掉，跳到第一条筛中题
        if (!isAllFilterActive()) {
          const filtered = getFilteredIndices();
          if (filtered.length > 0 && filtered.indexOf(current) === -1) current = filtered[0];
        }
        lastActivePartLabel = partOfIdx(current);
        renderTitle();
        renderNav();
        switchTo(current);
        return;
      }
      // 定位逻辑：无章节记忆时落在第一道可见题（源序第一条，如 822 例题第一题）。
      // 不再按 partOrder 跳到"第一分区第一个"——避免 822 落到习题区导致按 A 跳回上一分区末尾。
      // partOrder 仅用于侧栏显示排序（renderNav），不影响切章落点。
      let target = 0;
      const filtered = getFilteredIndices();
      target = filtered.length > 0 ? filtered[0] : 0;
      lastActivePartLabel = partOfIdx(target);
      renderTitle();
      renderNav();
      switchTo(target);
    }

    function gotoPrevChapter() {
      let idx = CHAPTERS.findIndex(c => c.id === currentChapterId);
      for (let i = idx - 1; i >= 0; i--) { if (CHAPTERS[i].total > 0) { switchChapter(CHAPTERS[i].id); return; } }
    }
    function gotoNextChapter() {
      let idx = CHAPTERS.findIndex(c => c.id === currentChapterId);
      for (let i = idx + 1; i < CHAPTERS.length; i++) { if (CHAPTERS[i].total > 0) { switchChapter(CHAPTERS[i].id); return; } }
    }

    // ===== 章节标题栏（三级面板式下拉） =====
    function getUniqueWbs() {
      var wbs = [];
      CHAPTERS.forEach(function(c) { if (c.wb && wbs.indexOf(c.wb) === -1) wbs.push(c.wb); });
      return wbs;
    }

    // 关闭所有标题下拉面板
    function closeAllTitlePanels() {
      document.querySelectorAll('.title-trigger.open').forEach(function(t) { t.classList.remove('open'); });
      document.querySelectorAll('.title-panel.open').forEach(function(p) { p.classList.remove('open'); });
    }

    // 填充某个面板的选项
    function fillPanel(panelId, items, idKey, textKey, activeId, onClick) {
      var panel = document.getElementById(panelId);
      panel.innerHTML = '';
      items.forEach(function(item) {
        var btn = document.createElement('button');
        btn.className = 'title-option';
        if ((idKey ? item[idKey] : item) === activeId) btn.classList.add('active');
        btn.textContent = textKey ? item[textKey] : item;
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          closeAllTitlePanels();
          onClick(item);
        });
        panel.appendChild(btn);
      });
    }

    // 书籍展示名称 + 固定排序（按当前科目的 wbOrder）
    function getSortedWbs() {
      var existing = getUniqueWbs();
      var result = [];
      var order = curSubject ? curSubject.wbOrder : [];
      order.forEach(function(entry) {
        if (existing.indexOf(entry.wb) !== -1) result.push(entry);
      });
      return result;
    }

    // 填充书籍面板
    // 1000题/李范习题已分别并入 30讲/36讲/李范全书：标题栏书籍下拉不再单独列伴章（进度统计仍按书分开）。
    function fillWbPanel(activeWb) {
      var entries = getSortedWbs().filter(function(e) { return e.wb !== '1000题' && e.wb !== '李范习题'; });
      fillPanel('panelWb', entries, 'wb', 'label', activeWb, function(entry) {
        document.getElementById('txtWb').textContent = entry.label;
        // 切书先尝试恢复该书的停靠位置；无记录才落到第一学科第一章节
        if (applyResumeBook(entry.wb)) return;
        var subjs = getSortedSubjs(entry.wb);
        if (subjs.length > 0) {
          var firstSubj = subjs[0];
          document.getElementById('txtSubj').textContent = firstSubj;
          fillSubjPanel(entry.wb, firstSubj);
          var firstCh = CHAPTERS.find(function(c) { return c.wb === entry.wb && c.subj === firstSubj; });
          if (firstCh) {
            document.getElementById('txtChapter').textContent = firstCh.short;
            fillChapterPanel(entry.wb, firstSubj, firstCh.id);
            switchChapter(firstCh.id);
          }
        }
      });
    }

    // 学科固定排序（按当前科目的 subjOrder）
    function getSortedSubjs(wb) {
      var subjs = [];
      CHAPTERS.forEach(function(c) { if (c.wb === wb && c.subj && subjs.indexOf(c.subj) === -1) subjs.push(c.subj); });
      var sorted = [];
      var order = curSubject ? curSubject.subjOrder : [];
      order.forEach(function(s) { if (subjs.indexOf(s) !== -1) sorted.push(s); });
      subjs.forEach(function(s) { if (sorted.indexOf(s) === -1) sorted.push(s); }); // 未列出的学科放末尾
      return sorted;
    }

    // 填充学科面板
    function fillSubjPanel(wb, activeSubj) {
      var subjs = getSortedSubjs(wb);
      fillPanel('panelSubj', subjs, null, null, activeSubj, function(subj) {
        document.getElementById('txtSubj').textContent = subj;
        var firstCh = CHAPTERS.find(function(c) { return c.wb === wb && c.subj === subj; });
        if (firstCh) {
          document.getElementById('txtChapter').textContent = firstCh.short;
          fillChapterPanel(wb, subj, firstCh.id);
          switchChapter(firstCh.id);
        }
      });
    }

    // 填充章节面板
    // 只列「浏览章节」：排除 wb==='1000题' 的章节（1000题 已并入 30讲/36讲 题目区，
    // 其章节仅作为数据源/统计单元；第0讲已改 wb='基础30讲' 会正常列出）。
    function fillChapterPanel(wb, subj, activeId) {
      var chs = CHAPTERS.filter(function(c) { return c.wb === wb && c.subj === subj && c.wb !== '1000题' && c.wb !== '李范习题'; });
      fillPanel('panelChapter', chs, 'id', 'short', activeId, function(ch) {
        document.getElementById('txtChapter').textContent = ch.short;
        switchChapter(ch.id);
      });
    }

    function renderTitle() {
      var ch = getChapter();
      if (!ch) return;
      var wb = ch.wb || '';
      var subj = ch.subj || '';

      // 防穿透映射：若当前章节为伴章，书籍显示名必须映射为其所属母章书名（基础30讲/强化36讲/李范全书）
      if (wb === '1000题' || wb === '李范习题') {
        var host = CHAPTERS.find(function(c) { return c.q1000Id === ch.id || c.lfxitiId === ch.id; });
        if (host && host.wb) wb = host.wb;
      }

      var wbLabel = getWbLabel(wb); // 按当前科目的 wbOrder 映射显示名
      document.getElementById('txtWb').textContent = wbLabel;
      document.getElementById('txtSubj').textContent = subj;
      document.getElementById('txtChapter').textContent = ch.short;

      fillWbPanel(wb);
      fillSubjPanel(wb, subj);
      fillChapterPanel(wb, subj, ch.id);

      // 学科下拉可见性：当前书籍仅一个学科时隐藏（822 各书只有「控制工程基础」，标题栏只需 书籍+章节；
      // 数学各书有 高数/线代/概率论 三学科，保留学科下拉）
      var ddSubjEl = document.getElementById('ddSubj');
      if (ddSubjEl) ddSubjEl.style.display = getSortedSubjs(wb).length > 1 ? '' : 'none';

      // 错题本书籍筛选下拉栏：在普通学习模式下必须保持隐藏
      var ddWbWrongbookEl = document.getElementById('ddWbWrongbook');
      if (ddWbWrongbookEl) ddWbWrongbookEl.style.display = 'none';
    }

    function setPanelTitle(text, wrongbookMode) {
      var bar = document.getElementById('chapterTitleBar');
      var panelTitle = document.getElementById('panelTitle');
      if (!bar || !panelTitle) return;
      var ddWb = document.getElementById('ddWb');
      var ddSubj = document.getElementById('ddSubj');
      var ddChapter = document.getElementById('ddChapter');
      var ddWbWrongbook = document.getElementById('ddWbWrongbook');

      if (text) {
        panelTitle.textContent = text;
        panelTitle.style.display = '';
        if (ddWb) ddWb.style.display = 'none';
        if (ddSubj) ddSubj.style.display = 'none';
        if (ddChapter) ddChapter.style.display = 'none';
        if (ddWbWrongbook) ddWbWrongbook.style.display = wrongbookMode ? '' : 'none';
      } else {
        panelTitle.textContent = '';
        panelTitle.style.display = 'none';
        if (ddWb) ddWb.style.display = '';
        if (ddChapter) ddChapter.style.display = '';
        // 错题本书籍下拉栏只在错题本模式下显示，返回普通题库时必须强制隐藏
        if (ddWbWrongbook) ddWbWrongbook.style.display = 'none';
        // 学科下拉栏恢复：当前书籍仅一个学科时隐藏（如822或老姚高数）
        if (ddSubj) {
          var ch = (typeof getChapter === 'function') ? getChapter() : null;
          var wb = ch ? (ch.wb || '') : '';
          var subjs = (typeof getSortedSubjs === 'function') ? getSortedSubjs(wb) : [];
          ddSubj.style.display = subjs.length > 1 ? '' : 'none';
        }
      }
    }
    window.setPanelTitle = setPanelTitle;

    // 面板展开/收起 + 外部点击关闭
    (function () {
      document.addEventListener('DOMContentLoaded', function () {
        function togglePanel(ddId, trigId) {
          var trig = document.getElementById(trigId);
          var panel = document.getElementById(ddId.replace('dd', 'panel'));
          if (!trig || !panel) return;
          trig.addEventListener('click', function(e) {
            e.stopPropagation();
            // 复习中标题只读：不响应下拉点击（保留文本标签供查看书/模块/章节）
            if (reviewSession) return;
            var isOpen = panel.classList.contains('open');
            closeAllTitlePanels();
            if (!isOpen) {
              panel.classList.add('open');
              trig.classList.add('open');
            }
          });
        }
        togglePanel('ddWb', 'trigWb');
        togglePanel('ddSubj', 'trigSubj');
        togglePanel('ddChapter', 'trigChapter');
        togglePanel('ddWbWrongbook', 'trigWbWrongbook');

        document.addEventListener('click', function(e) {
          var openPanels = document.querySelectorAll('.title-panel.open');
          if (openPanels.length === 0) return;
          var inside = false;
          openPanels.forEach(function(p) { if (p.parentElement.contains(e.target)) inside = true; });
          if (!inside) closeAllTitlePanels();
        });
      });
    })();

    // ===== 自动分区：从 label 推断所属类别（按当前科目） =====
    // 合并章节：李范全书为 例题 → 习题；30讲/36讲为 例题 → 习题 → 1000题；其余章节用科目 partOrder
    function getPartOrder(targetCh, targetSubj) {
      const ch = targetCh || getChapter();
      const s = targetSubj || curSubject;
      if (ch && ch.parts) return ch.parts.map(function (p) { return p.type; });
      if (ch && ch.wb === '老姚高数' && ch.sections) return ch.sections.map(function (sec) { return sec.type; });
      if (ch && ch.wb === '李范全书') return ['例题', '习题'];
      if (ch && ch.q1000Total) return ['例题', '习题', '1000题'];
      return (s && s.partOrder) ? s.partOrder : ['例题', '习题'];
    }

    function classifyLabel(label) {
      const ch = getChapter();
      if (ch && ch.parts) {
        const idx = ch.labels ? ch.labels.indexOf(label) : -1;
        if (idx >= 0) {
          const p = ch.parts.find(function (pt) { return idx >= pt.start && idx < pt.start + pt.count; });
          if (p) return p.type;
        }
      }
      if (ch && ch.wb === '老姚高数' && ch.sections) {
        const idx = ch.labels.indexOf(label);
        if (idx >= 0) {
          const s = ch.sections.find(function(sec) { return idx >= sec.start && idx < sec.start + sec.count; });
          if (s && s.exampleCount !== undefined) {
            return (idx < s.start + s.exampleCount) ? '例题' : '补充练习';
          }
        }
      }
      return curSubject ? curSubject.classifyLabel(label, ch) : (label.startsWith('例') ? '例题' : '习题');
    }

    // ===== 渲染章节统计面板 =====
    // 合并章节（1000题/李范习题并入）按书分两块统计：第1块=自身部分，第2块=伴章部分；
    // 进度分别累计，实现「进度按书分开」。非合并章节单块渲染（与现状一致）。
    function renderStats() {
      const ch = getChapter();
      const hasMerge = ch && ch.q1000Total;
      let segs;
      if (hasMerge) {
        const compCh = chapterById(ch.q1000Id);
        const compWb = compCh ? compCh.wb : '伴章';
        segs = [
          { label: getWbLabel(ch.wb), start: 0, len: ch.ownTotal },
          { label: getWbLabel(compWb), start: ch.ownTotal, len: ch.q1000Total }
        ];
      } else {
        segs = [{ label: '', start: 0, len: ch.total }];
      }
      const html = segs.map(function (seg) {
        let lv5 = 0, lv4 = 0, lv3 = 0, lv2 = 0, lv1 = 0, un = 0;
        for (let i = seg.start; i < seg.start + seg.len; i++) {
          const s = statuses[i];
          if (s === 'proficient') lv5++;
          else if (s === 'familiar') lv4++;
          else if (s === 'vague') lv3++;
          else if (s === 'rusty') lv2++;
          else if (s === 'wrong') lv1++;
          else un++;
        }
        const done = lv5 + lv4 + lv3 + lv2 + lv1;
        const pct = seg.len > 0 ? Math.round(done / seg.len * 100) : 0;
        return '<div class="stats-seg">' +
          (seg.label ? '<div class="stats-seg-label">' + seg.label + '</div>' : '') +
          '<div class="stats-bar-wrap"><div class="stats-bar-fill" style="width:' + pct + '%"></div></div>' +
          '<div class="stats-counts">' +
            '<span><span class="sc-dot" style="background:var(--lv5)"></span>熟练 <span class="sc-val">' + lv5 + '</span></span>' +
            '<span><span class="sc-dot" style="background:var(--lv4)"></span>较熟 <span class="sc-val">' + lv4 + '</span></span>' +
            '<span><span class="sc-dot" style="background:var(--lv3)"></span>模糊 <span class="sc-val">' + lv3 + '</span></span>' +
            '<span><span class="sc-dot" style="background:var(--lv2)"></span>困难 <span class="sc-val">' + lv2 + '</span></span>' +
            '<span><span class="sc-dot" style="background:var(--lv1)"></span>不会 <span class="sc-val">' + lv1 + '</span></span>' +
            '<span><span class="sc-dot" style="background:var(--text-light)"></span>未做 <span class="sc-val">' + un + '</span></span>' +
          '</div>' +
        '</div>';
      }).join('');
      document.getElementById('statsPanel').innerHTML = html;
    }


    // ===== 全局仪表盘（已拆分至 js/dashboard.js） =====
    let dashboardOpen = false;
    let dashboardDetailReturn = false;

    function toggleDashboard() {
      if (window.Dashboard) {
        window.Dashboard.toggle();
        dashboardOpen = window.Dashboard.isOpen();
        dashboardDetailReturn = window.Dashboard.isDetailReturn();
      }
    }

    function backToDashboardOverview() {
      if (window.Dashboard) {
        window.Dashboard.backToOverview();
        dashboardDetailReturn = window.Dashboard.isDetailReturn();
      }
    }

    function renderDashboardOverview() {
      if (window.Dashboard) window.Dashboard.renderOverview();
    }

    function showDashboardBackBtn(show) {
      dashboardDetailReturn = !!show;
      var btn = document.getElementById('btnBackDashboard');
      if (btn) {
        btn.style.display = show ? '' : 'none';
        if (show) alignBackBtnToMainArea(btn);
      }
    }

    // Back button
    document.addEventListener('DOMContentLoaded', function() {
      // 「返回总览」按钮：全局进度处于详情视图时显示，点击回到总览（同时绑定后退）
      const dbBack = document.getElementById('btnBackDashboard');
      if (dbBack) dbBack.addEventListener('click', function() {
        backToDashboardOverview();
      });
      // 「返回错题本」按钮：从错题本跳题后显示，点击回到错题本面板（同时绑定后退）
      const wbBack = document.getElementById('btnBackWrongBook');
      if (wbBack) wbBack.addEventListener('click', function() {
        backToWrongBook();
      });
    });

    // ===== 错题本 =====
    let wrongBookOpen = false;
    // 从错题本跳题后，用于「返回错题本」按钮与鼠标后退键回错题本
    let wrongBookReturn = false;
    function showWrongBookReturnBtn(show) {
      const btn = document.getElementById('btnBackWrongBook');
      if (btn) {
        btn.style.display = show ? '' : 'none';
        if (show) alignBackBtnToMainArea(btn); // 显示时动态对齐下方图片区左缘
      }
      wrongBookReturn = show;
    }
    function alignBackBtnToMainArea(btn) {
      // left = 主区域左缘相对标题栏左缘的偏移（动态计算，避免硬编码宽度）
      const mainArea = document.querySelector('.main-area');
      const bar = document.getElementById('chapterTitleBar');
      if (!mainArea || !bar) return;
      const barRect = bar.getBoundingClientRect();
      const mainRect = mainArea.getBoundingClientRect();
      btn.style.left = (mainRect.left - barRect.left) + 'px';
    }
    function backToWrongBook() {
      // 从题目页回到错题本面板
      wrongBookOpen = true;
      const panel = document.getElementById('wrongBookPanel');
      const dashPanel = document.getElementById('dashboardPanel');
      const content = document.getElementById('mainAreaContent');
      const btn = document.getElementById('btnWrongBook');
      renderWrongBook();
      dashPanel.style.display = 'none';
      content.style.display = 'none';
      panel.style.display = '';
      btn.innerHTML = '返回章节<span class="sol-key">B</span>';
      if (dashboardOpen) { dashboardOpen = false; showDashboardBackBtn(false); document.getElementById('btnDashboard').innerHTML = '全局进度<span class="sol-key">V</span>'; }
      showWrongBookReturnBtn(false); // 回到错题本后隐藏返回按钮
    }
    function toggleWrongBook() {
      wrongBookOpen = !wrongBookOpen;
      const panel = document.getElementById('wrongBookPanel');
      const dashPanel = document.getElementById('dashboardPanel');
      const content = document.getElementById('mainAreaContent');
      const btn = document.getElementById('btnWrongBook');
      if (wrongBookOpen) {
        renderWrongBook();
        dashPanel.style.display = 'none';
        content.style.display = 'none';
        panel.style.display = '';
        btn.innerHTML = '返回章节<span class="sol-key">B</span>';
        showWrongBookReturnBtn(false); // 打开错题本面板本身时不显示返回按钮
        // 关闭仪表盘
        if (dashboardOpen) { dashboardOpen = false; showDashboardBackBtn(false); document.getElementById('btnDashboard').innerHTML = '全局进度<span class="sol-key">V</span>'; }
      } else {
        panel.style.display = 'none';
        content.style.display = '';
        setPanelTitle('');
        renderTitle();
        btn.innerHTML = '错题本<span class="sol-key">B</span>';
        showWrongBookReturnBtn(false);
      }
    }

    // ===== 快捷键帮助模态 =====
    let shortcutHelpOpen = false;
    function toggleShortcutHelp() {
      shortcutHelpOpen = !shortcutHelpOpen;
      document.getElementById('shortcutOverlay').classList.toggle('show', shortcutHelpOpen);
    }

    // ===== 全局统一确认模态框 (Quiet Liquid Confirm Modal) =====
    // 注：全局 window.showConfirmModal 与 window.closeConfirmModal 已由 confirm_modal.js 顶层定义，严禁在全局作用域重复 var 声明导致递归爆栈

    // ===== 科目选择模态 =====
    let subjectPickerOpen = false;
    function openSubjectPicker() {
      if (typeof closeRelatedModal === 'function' && relatedModalOpen) closeRelatedModal();
      if (typeof closeSm2Panel === 'function' && sm2PanelOpen) closeSm2Panel();
      subjectPickerOpen = true;
      document.getElementById('subjectOverlay').classList.add('show');
    }
    function closeSubjectPicker() {
      subjectPickerOpen = false;
      document.getElementById('subjectOverlay').classList.remove('show');
    }

    // ===== 记住上次位置（章节 + 题目 + 小题模式），按科目、再按书籍分别保存 =====
    // 键 kaoyan.g.resume = JSON {
    //   '<科目id>': { ch, slug, sub },                      // 切科目时恢复
    //   '<科目id>::<书籍wb>': { ch, slug, sub }             // 切书籍时恢复
    // }
    function saveResume() {
      if (curSubjectId === 'english' || (curSubject && curSubject.type === 'english')) {
        if (window.kyApp && typeof window.kyApp.saveResume === 'function') {
          window.kyApp.saveResume();
        }
        return;
      }
      if (window.StorageEngine) {
        window.StorageEngine.ResumeStore.save(curSubjectId, currentChapterId, getChapter(), current, subMode);
        notifyStorageSync();
      }
    }

    // 读取某章的章节级停靠记录（无记录/记录失效返回 null）
    function loadChapterResume(chId) {
      var ch = CHAPTERS.find(function (c) { return c.id === chId; });
      if (!ch || ch.total === 0 || !window.StorageEngine) return null;
      var r = window.StorageEngine.ResumeStore.loadChapter(curSubjectId, chId, ch);
      if (!r) return null;
      return { idx: r.idx, sub: !!r.sub };
    }

    function loadResume(subjectId) {
      if (!window.StorageEngine) return null;
      var subj = SUBJECTS.find(function (s) { return s.id === subjectId; });
      if (!subj || !subj.chapters) return null;
      var r = window.StorageEngine.ResumeStore.loadSubject(subjectId, subj.chapters);
      if (!r) return null;
      var ch = subj.chapters.find(function (c) { return c.id === r.ch; });
      if (!ch || ch.total === 0) return null;
      return { ch: r.ch, idx: r.idx, sub: !!r.sub };
    }

    // 切换到某本书时恢复该书停靠位置（切书不回到第1讲第1题）。
    // 返回 true 表示已恢复；false 表示无记录/记录失效，调用方走「第一学科第一章节」。
    function applyResumeBook(wb) {
      if (!window.StorageEngine) return false;
      var r = window.StorageEngine.ResumeStore.loadBook(curSubjectId, wb, CHAPTERS);
      if (!r) return false;
      var ch = CHAPTERS.find(function (c) { return c.id === r.ch; });
      if (!ch || ch.total === 0 || ch.wb !== wb) return false;
      currentChapterId = ch.id;
      current = r.idx;
      // 小题模式（F）是全局开关，切书不重置、跨书保持
      loadStatuses(); loadQBad(); loadSBad(); loadBookMismatch(); loadNotes(); loadSm2();
      if (!isAllFilterActive()) {
        const filtered = getFilteredIndices();
        if (filtered.length > 0 && filtered.indexOf(current) === -1) current = filtered[0];
      }
      renderTitle(); renderNav(); switchTo(current); updateFilterCounts();
      return true;
    }
    function switchSubject(subjectId) {
      const subj = SUBJECTS.find(s => s.id === subjectId);
      if (!subj) return;

      const mathLayout = document.getElementById('mathAppLayout') || document.querySelector('.app-layout');
      const engLayout = document.getElementById('englishAppLayout');

      if (subjectId === 'english' || (subj && subj.type === 'english')) {
        autoSaveNotes();
        if (reviewSession) exitReviewSession();
        if (curSubjectId !== 'english') {
          saveResume();
        }
        curSubjectId = subjectId;
        window.curSubjectId = subjectId;
        curSubject = subj;
        window.curSubject = subj;
        CHAPTERS = subj.chapters || [];
        window.CHAPTERS = CHAPTERS;
        if (window.StorageEngine && window.StorageEngine.GlobalStore) {
          window.StorageEngine.GlobalStore.set('subject', subjectId);
        }
        if (mathLayout) mathLayout.style.display = 'none';
        if (engLayout) engLayout.style.display = 'flex';
        if (window.kyApp && window.kyApp.activate) window.kyApp.activate(subjectId);
        closeSubjectPicker();
        return;
      }

      if ((curSubjectId === 'english' || (curSubject && curSubject.type === 'english')) && window.kyApp && window.kyApp.saveResume) {
        window.kyApp.saveResume();
      }
      if (engLayout) engLayout.style.display = 'none';
      if (mathLayout) mathLayout.style.display = 'flex';

      autoSaveNotes(); // 切科目前保存未提交的笔记（loadNotes 会重建 notesData）
      // 切科目时若有进行中的复习：提交已评级结果并清除续接会话（跨科目不保留）
      if (reviewSession) exitReviewSession();
      if (curSubjectId !== 'english') {
        saveResume(); // 先记录当前数学/822停的位置，再切换
      }
      curSubjectId = subjectId;
      window.curSubjectId = subjectId;
      curSubject = subj;
      window.curSubject = subj;
      CHAPTERS = subj.chapters;
      window.CHAPTERS = CHAPTERS;
      var resume = loadResume(subjectId);
      if (resume) {
        var hostCh = subj.chapters.find(function(c) { return c.q1000Id === resume.ch; });
        if (hostCh) {
          currentChapterId = hostCh.id;
          current = Math.min((hostCh.total || 1) - 1, (hostCh.ownTotal || 0) + (resume.idx || 0));
        } else {
          currentChapterId = resume.ch;
          current = resume.idx;
        }
      } else {
        currentChapterId = subj.initChapterId;
        current = 0;
      }
      // 小题模式（F）是全局开关，切科目不重置、跨科目保持
      if (window.StorageEngine && window.StorageEngine.GlobalStore) {
        window.StorageEngine.GlobalStore.set('subject', subjectId);
      }
      // 关闭可能打开的全局进度/错题本面板，避免旧科目 DOM 残留
      if (dashboardOpen) {
        dashboardOpen = false; dashboardDetailReturn = false;
        document.getElementById('dashboardPanel').style.display = 'none';
        document.getElementById('mainAreaContent').style.display = '';
        document.getElementById('btnDashboard').innerHTML = '全局进度<span class="sol-key">V</span>';
        showDashboardBackBtn(false); setPanelTitle('');
      }
      if (wrongBookOpen) {
        wrongBookOpen = false; wrongBookReturn = false;
        document.getElementById('wrongBookPanel').style.display = 'none';
        document.getElementById('mainAreaContent').style.display = '';
        document.getElementById('btnWrongBook').innerHTML = '错题本<span class="sol-key">B</span>';
        showWrongBookReturnBtn(false); setPanelTitle('');
      }
      wrongBookWb = null; // 无条件重置错题本书籍筛选（书籍列表按科目不同，防跨科目残留）
      closeAllTitlePanels(); // 关闭可能残留的标题下拉面板（切换后重建）
      loadGlobalFilters(); // 恢复全局筛选偏好
      loadStatuses(); loadQBad(); loadSBad(); loadBookMismatch(); loadNotes();
      loadAnnotations(); // 恢复图片标注
      loadSm2(); // 恢复 SM-2 掌握度与复习算法数据
      loadRelatedTopics(); // 恢复考点主题及题目关联
      loadSolutionPref(); renderSolDefaultBtn(); updateSolutionUI(); // 解析默认按科目记忆
      renderTitle(); renderStats(); renderNav();
      // 若全局筛选激活且恢复的位置被筛掉，则跳到第一条筛中题，避免落在不可见题上
      if (!isAllFilterActive()) {
        const filtered = getFilteredIndices();
        if (filtered.length > 0 && filtered.indexOf(current) === -1) current = filtered[0];
      }
      switchTo(current); updateFilterCounts();
      updateFilterButtons(); // 恢复筛选按钮高亮
      closeSubjectPicker();
    }
    function pickSubject(id) {
      const s = SUBJECTS.find(x => x.id === id);
      if (s) switchSubject(id);
      closeSubjectPicker();
    }
    window.switchSubject = switchSubject;
    window.openSubjectPicker = openSubjectPicker;
    window.closeSubjectPicker = closeSubjectPicker;
    document.addEventListener('DOMContentLoaded', function () {
      const btnSwitch = document.getElementById('btnSwitchSubject');
      if (btnSwitch) btnSwitch.onclick = openSubjectPicker;
      document.querySelectorAll('#subjectOverlay .subject-option').forEach(function (btn) {
        btn.addEventListener('click', function () { pickSubject(btn.dataset.subject); });
      });
      const so = document.getElementById('subjectOverlay');
      if (so) so.addEventListener('click', function (e) { if (e.target === this) closeSubjectPicker(); });
    });

    // 鼠标侧键后退：详情视图/从错题本跳题后，鼠标后退键回总览或错题本
    document.addEventListener('mouseup', function (e) {
      if (e.button !== 3) return; // 按钮 3 = 浏览器后退键（XButton1）
      if (dashboardDetailReturn) backToDashboardOverview();
      else if (wrongBookReturn) backToWrongBook();
    });
    // 窗口尺寸变化时，若返回按钮可见则重新对齐
    window.addEventListener('resize', function () {
      if (dashboardDetailReturn) {
        const dbtn = document.getElementById('btnBackDashboard');
        if (dbtn) alignBackBtnToMainArea(dbtn);
      }
      if (wrongBookReturn) {
        const btn = document.getElementById('btnBackWrongBook');
        if (btn) alignBackBtnToMainArea(btn);
      }
    });

    // ===== 错题本辅助函数 =====
    // 主学科：去掉"基础篇-/强化篇-"前缀（与全局进度一致）
    function baseSubject(subj) { return String(subj).replace(/^(基础篇|强化篇)[-—]/, ''); }
    function getWbLabel(wb) {
      var order = curSubject ? curSubject.wbOrder : [];
      for (var i = 0; i < order.length; i++) { if (order[i].wb === wb) return order[i].label; }
      return wb;
    }
    let wrongBookWb = null; // 错题本书籍筛选（null=未初始化，首次打开时跟随当前章节栏书籍）

    function updateWrongBookTitle() {
      // 错题本模式：保留标题栏书籍下拉，标题固定为「错题本」
      setPanelTitle('错题本', true);
    }

    function fillWrongBookWbPanel() {
      // 收集有错/糊题的书籍（1000题/李范习题已并入 30讲/36讲/李范全书：不再单列伴章，
      // 其错题归入对应 base 书卡；第0讲 wb 已改 '基础30讲' 也并入）。
      var wbSet = new Set();
      for (const ch of CHAPTERS) {
        if (ch.total === 0) continue;
        if (ch.wb === '1000题' || ch.wb === '李范习题') continue; // 数据源章节：错题由其 base 伴章汇总
        var statusObj = getChapterStatusMap(ch);
        var ownLen = ch.ownTotal || ch.total;
        for (var i = 0; i < ownLen; i++) {
          if (statusObj[i] === 'wrong' || statusObj[i] === 'vague') { wbSet.add(ch.wb); break; }
        }
        // 伴章（1000题/李范习题）部分也归入 base 书
        if (ch.q1000Id && !wbSet.has(ch.wb)) {
          var qc = chapterById(ch.q1000Id);
          if (qc) {
            var qobj = getChapterStatusMap(qc);
            for (var q = 0; q < qc.total; q++) {
              if (qobj[q] === 'wrong' || qobj[q] === 'vague') { wbSet.add(ch.wb); break; }
            }
          }
        }
      }
      var entries = [];
      var order = curSubject ? curSubject.wbOrder : [];
      order.forEach(function(e) { if (wbSet.has(e.wb)) entries.push({ wb: e.wb, label: e.label }); });
      wbSet.forEach(function(w) { if (!entries.some(function(e) { return e.wb === w; })) entries.push({ wb: w, label: w }); });
      var defaultWb = order.length > 0 ? order[0].wb : (entries.length > 0 ? entries[0].wb : '');
      // 首次打开（null）：跟随当前章节栏选中的书籍；若该书无错题则回退到第一个有错题的书籍
      if (wrongBookWb === null) {
        var curWb = getChapter() ? getChapter().wb : null;
        wrongBookWb = (curWb && entries.some(function(e) { return e.wb === curWb; })) ? curWb : (entries.length > 0 ? entries[0].wb : defaultWb);
      } else if (!entries.some(function(e) { return e.wb === wrongBookWb; })) {
        wrongBookWb = entries.length > 0 ? entries[0].wb : defaultWb;
      }
      document.getElementById('txtWbWrongbook').textContent = getWbLabel(wrongBookWb);
      fillPanel('panelWbWrongbook', entries, 'wb', 'label', wrongBookWb, function(entry) {
        wrongBookWb = entry.wb;
        renderWrongBook();
      });
    }

    function renderWrongBook() {
      fillWrongBookWbPanel();
      updateWrongBookTitle();
      const grid = document.getElementById('wrongBookGrid');

      // 按书籍筛选 + 按学科分组收集。
      // 合并章节（有 q1000Id）：自身部分(ownTotal) + 伴章部分(偏移 ownTotal) 一起进 base 书卡。
      const colMap = {};
      let totalWrong = 0;
      for (const ch of CHAPTERS) {
        if (ch.total === 0) continue;
        if (ch.wb !== wrongBookWb) continue;
        if (ch.wb === '1000题' || ch.wb === '李范习题') continue;
        const groups = {}; // { wrong: [], rusty: [], vague: [], familiar: [] }
        // 自身部分
        var statusObj = getChapterStatusMap(ch);
        var ownLen = ch.ownTotal || ch.total;
        for (let i = 0; i < ownLen; i++) {
          var s = statusObj[i];
          if (s === 'wrong') (groups.wrong = groups.wrong || []).push(i);
          else if (s === 'rusty') (groups.rusty = groups.rusty || []).push(i);
          else if (s === 'vague') (groups.vague = groups.vague || []).push(i);
          else if (s === 'familiar') (groups.familiar = groups.familiar || []).push(i);
        }
        // 伴章（1000题/李范习题）部分
        if (ch.q1000Id) {
          var qc = chapterById(ch.q1000Id);
          if (qc) {
            var qobj = getChapterStatusMap(qc);
            for (let q = 0; q < qc.total; q++) {
              var qs = qobj[q];
              if (qs === 'wrong') (groups.wrong = groups.wrong || []).push(ch.ownTotal + q);
              else if (qs === 'rusty') (groups.rusty = groups.rusty || []).push(ch.ownTotal + q);
              else if (qs === 'vague') (groups.vague = groups.vague || []).push(ch.ownTotal + q);
              else if (qs === 'familiar') (groups.familiar = groups.familiar || []).push(ch.ownTotal + q);
            }
          }
        }
        var totalCount = (groups.wrong ? groups.wrong.length : 0) + (groups.rusty ? groups.rusty.length : 0) + (groups.vague ? groups.vague.length : 0) + (groups.familiar ? groups.familiar.length : 0);
        if (totalCount === 0) continue;
        totalWrong += totalCount;
        const bs = baseSubject(ch.subj);
        (colMap[bs] = colMap[bs] || []).push({ ch, groups });
      }

      let html = '';
      if (totalWrong === 0) {
        html = '<div class="wrongbook-empty">暂无标记为「不会」「困难」「模糊」「较熟练」的题目</div>';
      } else {
        // 列顺序：高数 → 线代 → 概率论（其余排后，使用模块级 SUBJECT_ORDER 常量）
        const colKeys = [];
        SUBJECT_ORDER.forEach(function(s) { if (colMap[s]) colKeys.push(s); });
        Object.keys(colMap).forEach(function(s) { if (colKeys.indexOf(s) === -1) colKeys.push(s); });
        colKeys.forEach(function(bs) {
          const items = colMap[bs];
          html += '<div class="db-subject-col">' +
            '<div class="db-subject-header">' + bs + ' <span class="db-subject-count">' + items.length + ' 讲</span></div>';
          items.forEach(function(item) {
            const ch = item.ch;
            const name = ch.short || ch.name;
            const labels = ch.labels || [];
            var g = item.groups;
            html += '<div class="wrongbook-chapter-card">' +
              '<div class="wrongbook-chapter-header">' +
              '<div class="wrongbook-chapter-title">' + name + '</div>' +
              '<div class="wrongbook-status-count">' +
              (g.familiar ? '<span class="ws w-familiar">较熟 ' + g.familiar.length + '</span>' : '') +
              (g.vague ? '<span class="ws w-vague">模糊 ' + g.vague.length + '</span>' : '') +
              (g.rusty ? '<span class="ws w-rusty">困难 ' + g.rusty.length + '</span>' : '') +
              (g.wrong ? '<span class="ws w-wrong">不会 ' + g.wrong.length + '</span>' : '') +
              '</div></div>' +
              '<div class="wrongbook-q-grid">';
            function qItem(idx, cls, statTitle) {
              const label = labels[idx] || (idx + 1);
              const isQ = ch.q1000Total && idx >= ch.ownTotal;
              const qc = isQ ? chapterById(ch.q1000Id) : null;
              let tag = '';
              const dispLabel = (ch.displayLabels && ch.displayLabels[idx]) ? ch.displayLabels[idx] : label;
              let titleText = '第' + label + '题（' + statTitle + '）';
              if (isQ && qc) {
                const secInfo = ch.sections ? ch.sections.find(function(s) { return idx >= s.start && idx < s.start + s.count; }) : null;
                let typeName = secInfo ? secInfo.type : '习题';
                if (typeName.indexOf('计算') !== -1) typeName = '计算';
                else if (typeName.indexOf('选择') !== -1) typeName = '选择';
                else if (typeName.indexOf('填空') !== -1) typeName = '填空';
                else if (typeName.indexOf('证明') !== -1) typeName = '证明';
                else if (typeName.indexOf('最值') !== -1) typeName = '最值';
                else if (typeName.indexOf('应用') !== -1) typeName = '应用';
                else if (typeName.length > 2) typeName = typeName.slice(0, 2);

                tag = qc.wb === '1000题' ? '<span class="ws q1000-tag">1000</span>' : '<span class="ws lf-tag">' + typeName + '</span>';
                titleText = (secInfo ? secInfo.type + ' ' : '') + '第' + dispLabel + '题 (' + label + ')（' + statTitle + '）';
              }
              return '<span class="wrongbook-q-item ' + cls + '" data-chapter="' + ch.id + '" data-index="' + idx + '" title="' + titleText + '"><span class="q-num">' + dispLabel + '</span>' + tag + '</span>';
            }
            if (g.wrong) for (var wIdx of g.wrong) html += qItem(wIdx, 'wrong', '不会');
            if (g.rusty) for (var rIdx of g.rusty) html += qItem(rIdx, 'rusty', '困难');
            if (g.vague) for (var vIdx of g.vague) html += qItem(vIdx, 'vague', '模糊');
            if (g.familiar) for (var fIdx of g.familiar) html += qItem(fIdx, 'familiar', '较熟练');
            html += '</div></div>';
          });
          html += '</div>';
        });
      }
      grid.innerHTML = html;

      // 点击跳转
      grid.querySelectorAll('.wrongbook-q-item').forEach(function(el) {
        el.addEventListener('click', function() {
          const cid = this.getAttribute('data-chapter');
          const idx = parseInt(this.getAttribute('data-index'));
          // 关闭错题本
          wrongBookOpen = false;
          document.getElementById('wrongBookPanel').style.display = 'none';
          document.getElementById('mainAreaContent').style.display = '';
          document.getElementById('btnWrongBook').innerHTML = '错题本<span class="sol-key">B</span>';
          setPanelTitle(''); // 恢复章节下拉栏（与 dashboard 跳转一致）
          renderTitle();
          // 切换章节并跳转到目标题
          switchChapter(cid);
          switchTo(idx);
          // 标记从错题本进入，显示「返回错题本」按钮
          showWrongBookReturnBtn(true);
        });
      });
    }

    // ===== 题号分区手风琴折叠状态存储与题号网格渲染 =====
    const collapsedSections = new Set();
    const collapsedSubSections = new Set();
    let isAccordionMode = false; // 手风琴单分区聚焦模式（默认 false：保持展开；仅当用户主动点击「全部折叠」时开启）

    function renderNav() {
      const nav = document.getElementById('qnav');
      nav.innerHTML = '';
      const ch = getChapter();
      ensureGroups(ch);
      const cols = effectiveCols();
      nav.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
      const labels = ch.labels;
      const curGroup = ch.groupForIdx[current];
      // 预计算筛中索引集合，renderNav 内多处使用，避免重复调用 getFilteredIndices()。
      // 「全部」筛选下无需构建集合（所有组均可见）。
      const filteredSet = isAllFilterActive() ? null : new Set(getFilteredIndices());

      // 更新题号区顶部当前进度摘要 (如 "共 68 题 · 当前 第 14 题")
      const qnavStat = document.getElementById('qnavStat');
      if (qnavStat) {
        qnavStat.textContent = '共 ' + labels.length + ' 题 · 当前 第 ' + (current + 1) + ' 题';
      }

      function appendBadges(btn, i) {
        const labels = ch.labels;
        // 该题组内任一题有笔记、有图片标注或有关联同类题，就在题号右上角亮提示圆点
        let groupHasNote = false, groupHasAnnot = false, groupHasRelated = false;
        const g0 = ch.groupForIdx[i];
        const start = g0 ? g0.startIdx : i;
        const count = g0 ? g0.count : 1;
        for (var k = 0; k < count; k++) {
          const idx = start + k;
          if (notesData[notesKeyFor(idx)]) groupHasNote = true;
          if (hasQuestionImagesAnnotated(idx)) groupHasAnnot = true;
          const qid = getQid(curSubjectId, currentChapterId, idx);
          if (typeof window.hasTopicsForQid === 'function') {
            if (window.hasTopicsForQid(qid)) groupHasRelated = true;
          } else if (getTopicsForQid(qid).length > 0) {
            groupHasRelated = true;
          }
          if (groupHasNote && groupHasAnnot && groupHasRelated) break;
        }
        if (qBad[i] || sBad[i] || bookMismatch[i] || groupHasNote || groupHasAnnot || groupHasRelated) {
          const badgeSpan = document.createElement('span');
          badgeSpan.className = 'img-badges';
          if (qBad[i]) { const d = document.createElement('span'); d.className = 'badge-text qbad-dot'; d.textContent = 'Q'; badgeSpan.appendChild(d); }
          if (sBad[i]) { const d = document.createElement('span'); d.className = 'badge-text sbad-dot'; d.textContent = 'S'; badgeSpan.appendChild(d); }
          if (bookMismatch[i]) { const d = document.createElement('span'); d.className = 'badge-text mismatch-dot'; d.textContent = '书'; badgeSpan.appendChild(d); }
          if (groupHasNote) { const d = document.createElement('span'); d.className = 'badge-dot note-dot'; d.title = '有笔记'; badgeSpan.appendChild(d); }
          if (groupHasAnnot) { const d = document.createElement('span'); d.className = 'badge-dot annot-dot'; d.title = '有图片标注'; badgeSpan.appendChild(d); }
          if (groupHasRelated) { const d = document.createElement('span'); d.className = 'badge-dot related-dot'; d.title = '有关联同类题'; badgeSpan.appendChild(d); }
          btn.appendChild(badgeSpan);
        }
      }

      // 自动从 labels 推断分区（连续同类别归为一个 partition）
      // 合并章节用 partOfIdx(i)：1000题 段独立成「1000题」分区，不并入「例题/习题」
      var parts = []; // [{label, startIdx, endIdx}]
      var curPart = null;
      var partOrder = getPartOrder(); // 当前科目分区顺序
      for (var i = 0; i < labels.length; i++) {
        var cat = partOfIdx(i);
        if (!curPart || curPart.label !== cat) {
          if (curPart) curPart.endIdx = i;
          curPart = { label: cat, startIdx: i, endIdx: -1 };
          parts.push(curPart);
        }
      }
      if (curPart) curPart.endIdx = labels.length;

      // 按 partOrder 排序渲染
      parts.sort(function(a, b) {
        return partOrder.indexOf(a.label) - partOrder.indexOf(b.label);
      });
      // 补全 partOrder 中缺失的分区（如无例题则显示"无"）
      partOrder.forEach(function(po) {
        if (!parts.some(function(p) { return p.label === po; })) {
          parts.push({ label: po, startIdx: -1, endIdx: -1 });
        }
      });
      parts.sort(function(a, b) {
        return partOrder.indexOf(a.label) - partOrder.indexOf(b.label);
      });

      // 当前题所在的分区必须保持自动展开，绝不折叠
      const curPartLabel = partOfIdx(current);
      const curSecKey = (curSubjectId || 'default') + '::' + currentChapterId + '::' + curPartLabel;
      collapsedSections.delete(curSecKey);

      // 收集当前章节中有题目的非当前分区 keys（用于一键全部折叠/展开）
      const validOtherSecKeys = [];
      const frag = document.createDocumentFragment();

      parts.forEach(function(part) {
        // 收集该分区的 subGroups
        var secGroups = [];
        ch.subGroups.forEach(function(g) {
          if (g.startIdx >= part.startIdx && g.startIdx < part.endIdx) {
            secGroups.push(g);
          }
        });

        // 该分区无题则跳过（如36讲无习题、某些章节无例题）
        if (secGroups.length === 0) return;

        const secKey = (curSubjectId || 'default') + '::' + currentChapterId + '::' + part.label;
        if (part.label !== curPartLabel) {
          validOtherSecKeys.push(secKey);
        }

        // 计算该分区已完成题数与总题数
        let totalSecQuestions = 0;
        let completedSecQuestions = 0;
        secGroups.forEach(function(g) {
          for (var k = 0; k < g.count; k++) {
            totalSecQuestions++;
            if (statuses[g.startIdx + k]) completedSecQuestions++;
          }
        });

        const isCurrentPart = (part.label === curPartLabel);
        const isCollapsed = isCurrentPart ? false : collapsedSections.has(secKey);

        // 分区手风琴标题
        var secTitle = document.createElement('div');
        secTitle.className = 'section-header' + (isCollapsed ? ' collapsed' : '') + (isCurrentPart ? ' current-locked' : '');
        secTitle.title = isCurrentPart ? '当前做题分区（保持展开）' : (isCollapsed ? '点击展开本分区题号' : '点击收起本分区题号');
        secTitle.innerHTML = '<div class="sec-header-left">' +
          '<span class="sec-arrow">' + (isCollapsed ? '▸' : '▾') + '</span>' +
          '<span class="sec-title-text">' + part.label + '</span>' +
          '</div>' +
          '<span class="sec-badge">' + completedSecQuestions + '/' + totalSecQuestions + '</span>';

        secTitle.onclick = function(e) {
          e.stopPropagation();
          if (isCurrentPart) return; // 当前做题分区不可折叠
          if (collapsedSections.has(secKey)) {
            collapsedSections.delete(secKey);
            isAccordionMode = false; // 用户主动展开分区，退出强制手风琴聚焦折叠
          } else {
            collapsedSections.add(secKey);
          }
          renderNav();
        };
        frag.appendChild(secTitle);

        // 若被折叠，不渲染下方题号按钮
        if (isCollapsed) return;

        var curSecObj = null;
        var curSubObj = null;
        var isCurrentSubCollapsed = false;

        secGroups.forEach(function(g) {
          // 插入题型二级/三级标题抽屉
          if (ch.sections) {
            var s = ch.sections.find(function(sec) {
              return g.startIdx >= sec.start && g.startIdx < sec.start + sec.count;
            });

            // 1. Level 2 大考点/大节分割线
            if (s && s !== curSecObj) {
              curSecObj = s;
              curSubObj = null;
              if (s.type !== part.label) {
                var secDiv = document.createElement('div');
                secDiv.className = 'section-divider';
                secDiv.innerHTML = '<span class="sec-divider-title">' + s.type + '</span>';
                frag.appendChild(secDiv);
              }
            }

            // 2. Level 3 微观考点/微观题型/子小节抽屉
            var matchedSub = null;
            if (s && s.subSections) {
              matchedSub = s.subSections.find(function(ss) {
                return g.startIdx >= ss.start && g.startIdx < ss.start + ss.count;
              });
            } else if (ch.wb === '老姚高数' && s && s.exampleCount !== undefined) {
              var isEx = g.startIdx < s.start + s.exampleCount;
              matchedSub = {
                type: isEx ? '例题' : '补充练习',
                start: isEx ? s.start : s.start + s.exampleCount,
                count: isEx ? s.exampleCount : s.count - s.exampleCount
              };
            }

            if (matchedSub && matchedSub !== curSubObj) {
              curSubObj = matchedSub;
              const subKey = (curSubjectId || 'default') + '::' + currentChapterId + '::' + (s ? s.type : '') + '::' + matchedSub.type + '::' + matchedSub.start;

              // 当前做题所在微观考点必须保持展开，绝不折叠
              const isCurrentInSub = (current >= matchedSub.start && current < matchedSub.start + matchedSub.count);
              if (isCurrentInSub) {
                collapsedSubSections.delete(subKey);
              }
              const isSubCollapsed = isCurrentInSub ? false : collapsedSubSections.has(subKey);
              isCurrentSubCollapsed = isSubCollapsed;

              // 计算该小节已完成题数与总题数
              let totalSubQ = 0;
              let completedSubQ = 0;
              for (var sk = 0; sk < matchedSub.count; sk++) {
                totalSubQ++;
                if (statuses[matchedSub.start + sk]) completedSubQ++;
              }

              var subTitle = document.createElement('div');
              subTitle.className = 'subsection-header' + (isSubCollapsed ? ' collapsed' : '') + (isCurrentInSub ? ' current-locked' : '');
              subTitle.title = isCurrentInSub ? '当前做题小节（保持展开）' : (isSubCollapsed ? '点击展开小节' : '点击收起小节');
              subTitle.innerHTML = '<div class="subsec-left">' +
                '<span class="sec-arrow">' + (isSubCollapsed ? '▸' : '▾') + '</span>' +
                '<span class="subsec-title-text">' + matchedSub.type + '</span>' +
                '</div>' +
                '<span class="sec-badge">' + completedSubQ + '/' + totalSubQ + '</span>';

              subTitle.onclick = function(e) {
                e.stopPropagation();
                if (isCurrentInSub) return;
                if (collapsedSubSections.has(subKey)) {
                  collapsedSubSections.delete(subKey);
                } else {
                  collapsedSubSections.add(subKey);
                }
                renderNav();
              };
              frag.appendChild(subTitle);
            } else if (!matchedSub && s && s.start === g.startIdx && s.type !== part.label && !s.subSections) {
              var subTitle = document.createElement('div');
              subTitle.className = 'subsection-header';
              subTitle.textContent = s.type;
              frag.appendChild(subTitle);
              isCurrentSubCollapsed = false;
            }
          }

          // 若所属小节被折叠，不渲染该题号按钮
          if (isCurrentSubCollapsed) return;

          var dispLabel = (ch.displayLabels && ch.displayLabels[g.startIdx]) ? ch.displayLabels[g.startIdx] : g.parentLabel;
          var secInfo = ch.sections ? ch.sections.find(function(s) { return g.startIdx >= s.start && g.startIdx < s.start + s.count; }) : null;
          var isK = ch.isKnowledge && ch.isKnowledge[g.startIdx];
          var desc = ch.itemDescs && ch.itemDescs[g.startIdx];

          var btn = document.createElement('button');
          btn.setAttribute('data-group-start', g.startIdx);
          if (desc) {
            var pfx = (secInfo && !desc.includes(secInfo.type) && secInfo.type !== '例题' && secInfo.type !== '习题') ? (secInfo.type + ' · ') : '';
            var sfx = (g.parentLabel && !desc.includes(g.parentLabel)) ? (' (' + g.parentLabel + ')') : '';
            btn.title = pfx + desc + sfx;
          } else if (secInfo) {
            var subSecTitle = '';
            if (secInfo.subSections) {
              var matchedSub2 = secInfo.subSections.find(function(ss) { return g.startIdx >= ss.start && g.startIdx < ss.start + ss.count; });
              if (matchedSub2) subSecTitle = ' · ' + matchedSub2.type;
            }
            btn.title = secInfo.type + subSecTitle + (isK ? ' · ' : ' 第') + dispLabel + (isK ? '' : '题') + ' (' + g.parentLabel + ')';
          } else {
            btn.title = g.parentLabel;
          }
          var inCurGroup = (curGroup === g);
          var cls = '';
          if (isK) cls += ' is-knowledge';

          if (inCurGroup && (!g.isParent || !subMode)) { cls += ' active'; }

          var visIdx = groupVisibleIndices(g, filteredSet);
          var groupHasVisible = isAllFilterActive() || visIdx.length > 0;
          if (!groupHasVisible) cls += ' filtered-out';

          if (g.isParent) {
            cls += ' has-subs';
            var anyStatus = false;
            for (var k = 0; k < g.count; k++) { if (statuses[g.startIdx + k]) { anyStatus = true; break; } }
            if (anyStatus) cls += ' has-color';
            btn.className = cls.trim();

            for (var k = 0; k < g.count; k++) {
              var idx = g.startIdx + k;
              var bar = document.createElement('span');
              bar.className = 'sub-bar';
              var st = statuses[idx];
              if (st) bar.classList.add(st);
              if (inCurGroup && subMode && idx === current) bar.classList.add('active-sub');
              bar.style.width = (100 / g.count) + '%';
              bar.style.left = (k * 100 / g.count) + '%';
              btn.appendChild(bar);
            }

            var textSpan = document.createElement('span');
            textSpan.className = 'btn-text';
            textSpan.textContent = dispLabel;
            btn.appendChild(textSpan);
          } else {
            cls += ' ' + getStatusClass(g.startIdx);
            btn.className = cls.trim();
            btn.textContent = dispLabel;
          }

          if (!groupHasVisible) { btn.style.visibility = 'hidden'; }
          appendBadges(btn, g.startIdx);

          btn.onclick = function() {
            // 点击侧栏定位到该题组第一个可见题；小题模式（F 全局开关）不重置，跨章/跨题保持
            if (visIdx.length > 0) { switchTo(visIdx[0], false); }
          };
          frag.appendChild(btn);
        });
      });

      nav.appendChild(frag);

      // 更新「全部折叠/展开」按钮状态
      const btnToggleAll = document.getElementById('btnToggleAllSections');
      if (btnToggleAll) {
        if (validOtherSecKeys.length === 0) {
          btnToggleAll.style.display = 'none';
        } else {
          btnToggleAll.style.display = '';
          const allOthersCollapsed = validOtherSecKeys.every(function(k) { return collapsedSections.has(k); });
          if (allOthersCollapsed) {
            btnToggleAll.textContent = '全部展开';
            btnToggleAll.title = '展开所有题号分区';
          } else {
            btnToggleAll.textContent = '全部折叠';
            btnToggleAll.title = '折叠其他题号分区，仅保留当前分区';
          }
          btnToggleAll.onclick = function(e) {
            e.stopPropagation();
            if (allOthersCollapsed) {
              isAccordionMode = false; // 用户点击全部展开，退出手风琴折叠模式
              validOtherSecKeys.forEach(function(k) { collapsedSections.delete(k); });
            } else {
              isAccordionMode = true; // 用户点击全部折叠，进入手风琴单分区聚焦模式
              validOtherSecKeys.forEach(function(k) { collapsedSections.add(k); });
            }
            renderNav();
          };
        }
      }

      // 构建视觉行映射（W/S 导航用）
      buildVisualRows(nav);

      renderSubSelectBar(curGroup);

      // 自动平滑滚动聚焦到当前题号按钮（将其尽量居中定位在右侧栏可视窗口中）
      const activeBtn = nav.querySelector('button.active, button.has-subs.active');
      if (activeBtn) {
        requestAnimationFrame(function() {
          scrollActiveBtnToCenter(activeBtn, true);
        });
      }
      updateFilterCounts();
    }

    // 将右侧栏当前激活的题号按钮居中定位在侧边栏滚动视口内
    function scrollActiveBtnToCenter(activeBtn, smooth) {
      if (!activeBtn) return;
      var qnav = document.getElementById('qnav') || activeBtn.closest('.qnav');
      if (qnav) {
        var qRect = qnav.getBoundingClientRect();
        var bRect = activeBtn.getBoundingClientRect();
        // 计算按钮中心与 #qnav 滚动容器可视中心的垂直偏移差
        var delta = (bRect.top + bRect.height / 2) - (qRect.top + qRect.height / 2);
        if (Math.abs(delta) > 2) {
          if (typeof qnav.scrollBy === 'function') {
            qnav.scrollBy({ top: delta, behavior: smooth ? 'smooth' : 'auto' });
          } else {
            qnav.scrollTop += delta;
          }
        }
      }
      var sidebar = activeBtn.closest('.sidebar-right') || document.querySelector('.sidebar-right');
      if (sidebar) {
        var sRect = sidebar.getBoundingClientRect();
        var bRect2 = activeBtn.getBoundingClientRect();
        if (bRect2.top < sRect.top + 30 || bRect2.bottom > sRect.bottom - 30) {
          var deltaSidebar = (bRect2.top + bRect2.height / 2) - (sRect.top + sRect.height / 2);
          if (Math.abs(deltaSidebar) > 5) {
            if (typeof sidebar.scrollBy === 'function') {
              sidebar.scrollBy({ top: deltaSidebar, behavior: smooth ? 'smooth' : 'auto' });
            } else {
              sidebar.scrollTop += deltaSidebar;
            }
          }
        }
      }
    }

    // ===== 根据 DOM 构建视觉行映射 =====
    function buildVisualRows(nav) {
      visualRows = [];
      var btns = nav.querySelectorAll('button[data-group-start]');
      var lastTop = -1;
      btns.forEach(function(btn) {
        var top = btn.offsetTop;
        if (top !== lastTop) {
          visualRows.push([]);
          lastTop = top;
        }
        visualRows[visualRows.length - 1].push(parseInt(btn.getAttribute('data-group-start')));
      });
    }

    // W/S：按视觉行偏移（基于 DOM 实际布局，跳过 section header 行）
    function navByGroupOffset(offset) {
      var groups = visibleGroups();
      var g = currentGroup();
      if (!g || visualRows.length === 0) return;

      // 找到当前 group 在哪个视觉行、哪一列
      var curRow = -1, curCol = -1;
      for (var r = 0; r < visualRows.length; r++) {
        var col = visualRows[r].indexOf(g.startIdx);
        if (col !== -1) { curRow = r; curCol = col; break; }
      }
      if (curRow === -1) return;

      var targetRow = curRow + offset;
      if (targetRow < 0 || targetRow >= visualRows.length) return;

      var targetRowSids = visualRows[targetRow];
      // 目标列：优先与当前列同列；若当前列超出目标行长度（目标行较短，如末行不足一列），
      // 夹到目标行最后一个——如 13 题中第 10 题按 S 落到第 13 题（下一行最后一个）。
      var targetCol = Math.min(curCol, targetRowSids.length - 1);
      // 从目标列向外扩展，找最近的可见 group（处理筛选隐藏的题）。
      // 扩展半径覆盖整个目标行：目标行可能比当前列短（上一行/末行不足一列），
      // 此时旧代码 d 上限用 targetRowSids.length 够不到任何项 → S/W 无反应。
      for (var d = 0; d < targetRowSids.length; d++) {
        var left = targetCol - d, right = targetCol + d;
        if (left >= 0) {
          var tgL = groups.find(function(gr) { return gr.startIdx === targetRowSids[left]; });
          if (tgL && groupVisibleIndices(tgL).length > 0) { switchTo(groupVisibleIndices(tgL)[0]); return; }
        }
        if (right < targetRowSids.length && d > 0) {
          var tgR = groups.find(function(gr) { return gr.startIdx === targetRowSids[right]; });
          if (tgR && groupVisibleIndices(tgR).length > 0) { switchTo(groupVisibleIndices(tgR)[0]); return; }
        }
      }
    }

    function navUp() { navByGroupOffset(-1); }
    function navDown() { navByGroupOffset(1); }
    function renderSubSelectBar(curGroup) {
      const bar = document.getElementById('subSelectBar');
      if (!bar) return;

      if (!curGroup || !curGroup.isParent) {
        bar.innerHTML = '';
        bar.style.display = 'none';
        return;
      }

      bar.style.display = 'block';
      bar.innerHTML = '';
      const ch = getChapter();
      const labels = ch.labels;
      const filteredSet = new Set(getFilteredIndices());

      for (let k = 0; k < curGroup.count; k++) {
        const i = curGroup.startIdx + k;
        const btn = document.createElement('button');
        btn.className = 'sub-sel-btn';
        btn.textContent = subSuffix(labels[i]);
        btn.title = labels[i];

        // 未按F时所有子题高亮，按F后仅当前子题高亮
        if (!subMode || i === current) {
          btn.classList.add('active');
        }

        const visible = isAllFilterActive() || filteredSet.has(i);
        if (!visible) { btn.style.display = 'none'; }

        btn.onclick = function () {
          if (!isFiltered(i)) return;
          subMode = true;
          switchTo(i, false);
        };
        bar.appendChild(btn);
      }
    }

    // ===== 题组级 / 子题级导航 =====
    function visibleGroups() {
      const ch = getChapter();
      ensureGroups(ch);
      if (isAllFilterActive()) return ch.subGroups.slice();
      const filteredSet = new Set(getFilteredIndices());
      return ch.subGroups.filter(g => groupVisibleIndices(g, filteredSet).length > 0);
    }

    function currentGroup() {
      const ch = getChapter();
      ensureGroups(ch);
      return ch.groupForIdx[current];
    }

    function effectiveCols() {
      // 每行列数：按科目配置（数学/822 均为 5），与 822 原工具一致；忽略章节数据中的 cols 字段
      return (curSubject && curSubject.navCols) ? curSubject.navCols : 5;
    }

    // A：上一题（题组级：跳上一题组最后一个可见子题；子题级：组内-1，越界跳上一组末尾）
    function navPrev() {
      const g = currentGroup();
      if (!g) return;
      if (subMode) {
        const vis = groupVisibleIndices(g);
        const pos = vis.indexOf(current);
        if (pos > 0) { switchTo(vis[pos - 1]); return; }
      }
      const groups = visibleGroups();
      if (groups.length === 0) return;
      const gi = groups.indexOf(g);
      if (gi > 0) {
        const pv = groupVisibleIndices(groups[gi - 1]);
        if (pv.length > 0) { switchTo(pv[pv.length - 1]); return; }
      } else if (gi === -1) {
        // 当前组不在可见列表中（被过滤器排除），寻找前一个可见组
        const prevG = groups.slice().reverse().find(function (cand) { return cand.startIdx < g.startIdx; });
        if (prevG) {
          const pv = groupVisibleIndices(prevG);
          if (pv.length > 0) { switchTo(pv[pv.length - 1]); return; }
        }
      }
    }

    // D：下一题（题组级：跳下一题组第一个可见子题；子题级：组内+1，越界跳下一组开头）
    function navNext() {
      const g = currentGroup();
      if (!g) return;
      if (subMode) {
        const vis = groupVisibleIndices(g);
        const pos = vis.indexOf(current);
        if (pos !== -1 && pos < vis.length - 1) { switchTo(vis[pos + 1]); return; }
      }
      const groups = visibleGroups();
      if (groups.length === 0) return;
      const gi = groups.indexOf(g);
      if (gi !== -1) {
        if (gi < groups.length - 1) {
          const nv = groupVisibleIndices(groups[gi + 1]);
          if (nv.length > 0) switchTo(nv[0]);
        }
      } else {
        // 关键修复：当前题目刚被打标并被过滤器移出（例如处于「未做」或「模糊」筛选态），
        // gi 为 -1，此时寻找第一个起始序号大于当前题的可见组进行跳转
        const nextG = groups.find(function (cand) { return cand.startIdx > g.startIdx; });
        if (nextG) {
          const nv = groupVisibleIndices(nextG);
          if (nv.length > 0) { switchTo(nv[0]); return; }
        } else if (groups.length > 0) {
          // 若后续没有了，跳转到剩余筛选列表的第一个
          const firstNv = groupVisibleIndices(groups[0]);
          if (firstNv.length > 0) switchTo(firstNv[0]);
        }
      }
    }

    function getQLabelText(idx) {
      const ch = getChapter();
      if (!ch) return '';
      ensureGroups(ch);
      const g = ch.groupForIdx ? ch.groupForIdx[idx] : null;
      const labels = ch.labels;
      const secInfo = ch.sections ? ch.sections.find(function(s) { return idx >= s.start && idx < s.start + s.count; }) : null;
      const isK = ch.isKnowledge && ch.isKnowledge[idx];
      const desc = ch.itemDescs && ch.itemDescs[idx];
      if (desc) {
        const pfx = (secInfo && !desc.includes(secInfo.type) && secInfo.type !== '例题' && secInfo.type !== '习题') ? (secInfo.type + ' · ') : '';
        return pfx + desc;
      } else if (secInfo && ch.displayLabels && ch.displayLabels[idx] !== undefined) {
        return secInfo.type + (isK ? ' · ' : ' 第') + ch.displayLabels[idx] + (isK ? '' : '题');
      } else if (subMode) {
        return labels[idx];
      } else if (g && g.isParent) {
        return g.parentLabel;
      } else {
        return labels[idx];
      }
    }

    // F：切换小题选择模式（全局开关，跨章保持；当前题无子题时仅切换开关，导航仍正常逐题/逐组）
    function toggleSubMode() {
      const g = currentGroup();
      if (!g) return;
      subMode = !subMode;
      if (window.StorageEngine && window.StorageEngine.GlobalStore) {
        window.StorageEngine.GlobalStore.set('sub_mode', subMode);
      }
      saveResume();
      renderNav();
      renderSubSelectBar(g);
      // 同步更新题号标签
      const qLabelEl = document.getElementById('qLabel');
      if (qLabelEl) qLabelEl.textContent = getQLabelText(current);
    }

    // ===== 切换题目 =====
    function updateSolutionUI() {
      const area = document.getElementById('solutionArea');
      const btn = document.getElementById('btnToggle');
      if (showSolution) {
        area.classList.add('show');
        btn.innerHTML = '<span class="func-name">隐藏解析</span><span class="key">Space</span>';
        btn.classList.add('hide');
        // 从隐藏切换为显示时，重新加载解析图并叠加标注：
        // 隐藏期间图片无实际尺寸，标注叠加会被跳过（避免 NaN 放大 bug），
        // 显示后再重新探测/渲染，等图片有尺寸后 onload 里会正常叠加。
        refreshSolutionAnnotations();
      } else {
        area.classList.remove('show');
        btn.innerHTML = '<span class="func-name">显示解析</span><span class="key">Space</span>';
        btn.classList.remove('hide');
      }
    }
    // 对当前已加载的解析图重新叠加标注（隐藏→显示后调用，修复 NaN 放大 bug）
    function refreshSolutionAnnotations() {
      const container = document.getElementById('solutionImgs');
      if (!container) return;
      container.querySelectorAll('.annot-wrapper').forEach(function (wrap) {
        const img = wrap.querySelector('.solution-img');
        const overlay = wrap.querySelector('.annot-overlay');
        if (img && overlay) renderImageAnnotation(img.src, img, overlay);
      });
    }

    // ===== 分片解析图：_solution.png + _solution_2.png + _solution_3.png ... =====
    let _solutionImgGen = 0; // 世代号：切题过快时丢弃过期分片回调
    function setSolutionImages(base) {
      const container = document.getElementById('solutionImgs');
      if (!container) return;
      container.innerHTML = '';
      const gen = ++_solutionImgGen;
      function tryAdd(n, altAttempt) {
        let src;
        if (n === 1) {
          src = altAttempt ? (base + '_solution_1.png') : (base + '_solution.png');
        } else {
          src = base + '_solution_' + n + '.png';
        }
        const img = document.createElement('img');
        img.className = 'solution-img';
        img.alt = '解析' + (n > 1 ? '（' + n + '）' : '');
        img.onload = function () {
          if (gen !== _solutionImgGen) return; // 已有更新的题目在加载，丢弃
          // 每个解析图包一层标注叠加容器
          const wrap = document.createElement('div');
          wrap.className = 'annot-wrapper';
          const overlay = document.createElement('div');
          overlay.className = 'annot-overlay';
          overlay.style.display = 'none';
          wrap.appendChild(img);
          wrap.appendChild(overlay);
          container.appendChild(wrap);
          img.classList.toggle('sbad-border', !!sBad[current]); // 异步加载后才生效，需在追加时补齐边框
          img.classList.toggle('dark-filter', (currentTheme === 'dark' && darkImageFilter));
          // 若该图有标注，加载完成后叠加显示
          if (hasAnnotation(src)) renderImageAnnotation(src, img, overlay);
          tryAdd(n + 1, false); // 加载成功则继续探测下一张
        };
        img.onerror = function () {
          if (gen !== _solutionImgGen) return;
          // 若第 1 张 (_solution.png) 缺失，尝试备用命名 _solution_1.png
          if (n === 1 && !altAttempt) {
            tryAdd(1, true);
            return;
          }
          // 未找到该分片，停止探测；若尚无任何分片加载成功，给出占位提示
          if (n === 1 && container.children.length === 0) {
            const ph = document.createElement('div');
            ph.className = 'section-empty';
            ph.style.textAlign = 'center';
            ph.style.padding = '12px';
            ph.textContent = '（该题暂无解析图）';
            container.appendChild(ph);
          }
        };
        img.src = src;
      }
      tryAdd(1, false);
    }

    // ===== 普通浏览标注叠加（切题即见） =====
    var _annotViewers = {}; // key: 归一化 src，value: MarkerView 实例

    // 永久屏蔽 marker.js 内置在 .canvas-container 上的滚轮平移监听（根因修复）：
    // 该监听匿名、不可解绑，且 MarkerView/MarkerArea 都在 **appendChild 时**才绑定到
    // .canvas-container 上（不是构造时），所以旧的「构造期临时 patch addEventListener」
    // 根本拦不住它 → 标注图在只读浏览时滚轮一滚，标注层就相对底图平移并 preventDefault，
    // 造成图片撕裂/重叠 + 页面无法滚动。
    // 方案：启动即全局 patch Element.prototype.addEventListener，凡是在带
    // canvas-container 类名的元素上注册 wheel 监听一律丢弃。这样无论 marker.js 何时、
    // 在哪一步绑定，内置滚轮平移都永远不会生效。
    // 兼容性验证：MarkerArea（编辑模式）自身的滚轮缩放/切工具走 ma 元素上的
    // onAnnotWheel（capture 监听），而真实 wheel 事件是 composed 的，能从 shadow 内
    // .canvas-container 冒泡穿透到宿主 ma 元素上，故全局屏蔽后编辑缩放功能不受影响。
    (function blockMarkerCanvasWheel() {
      const origAE = Element.prototype.addEventListener;
      Element.prototype.addEventListener = function (type, fn, opts) {
        if (type === 'wheel' && this.classList && this.classList.contains('canvas-container')) {
          return; // 丢弃 marker.js 内置滚轮平移监听
        }
        return origAE.call(this, type, fn, opts);
      };
    })();
    function clearImageAnnotation(src) {
      const key = normalizeAnnotSrc(src);
      const v = _annotViewers[key];
      if (v) { try { v.remove(); } catch (e) {} delete _annotViewers[key]; }
    }
    function renderImageAnnotation(src, imgEl, overlayEl) {
      const key = normalizeAnnotSrc(src);
      // 移除旧的 overlay
      if (overlayEl) overlayEl.innerHTML = '';
      clearImageAnnotation(key);
      const state = getAnnotation(key);
      if (!state || typeof markerjs3 === 'undefined' || !overlayEl) return;
      // 若图片处于 display:none（解析默认隐藏）或尚未布局出实际尺寸，此时创建 MarkerView 会用 0 尺寸
      // 计算 SVG 矩阵 → NaN → 标注区域被放大/错乱。等图片可见后再渲染（见 updateSolutionUI 的重新触发）。
      if (imgEl.getBoundingClientRect().width === 0 || imgEl.getBoundingClientRect().height === 0) return;
      overlayEl.style.display = '';
      try {
        const viewer = new markerjs3.MarkerView();
        _annotViewers[key] = viewer;
        overlayEl.appendChild(viewer);
        viewer.targetImage = imgEl;
        viewer.show(state);
        // 关键：MarkerView 内部会在 Shadow DOM 里克隆一张 _editingTarget 底图。
        // 普通只读浏览时，底层原图（#questionImg / .solution-img）已有标准 dark-filter 样式。
        // 若 MarkerView 内部克隆底图可见，会导致双重底图重叠以及多层滤镜乘法导致图片过暗。
        // 注入 Shadow DOM 样式彻底隐藏内部克隆底图，上层仅保留透明的 SVG 标注，底图 100% 复用真实原图。
        if (viewer.shadowRoot) {
          const st = document.createElement('style');
          st.textContent = 'img { display: none !important; }';
          viewer.shadowRoot.appendChild(st);
        }
      } catch (e) { /* 标注渲染失败时静默 */ }
    }
    function renderQuestionAnnotations() {
      const img = document.getElementById('questionImg');
      const overlay = document.getElementById('qAnnotOverlay');
      const src = img && img.src;
      if (!src || !overlay) return;
      if (img.complete && img.naturalWidth > 0) {
        renderImageAnnotation(src, img, overlay);
      } else {
        img.onload = function() { renderImageAnnotation(src, img, overlay); };
      }
    }

    let lastActivePartLabel = null;
    function updateNavActive(scroll) {
      if (scroll === undefined) scroll = true;
      const nav = document.getElementById('qnav');
      if (!nav) return;
      const ch = getChapter();
      const curGroup = ch.groupForIdx ? ch.groupForIdx[current] : null;
      const targetStart = curGroup ? curGroup.startIdx : current;

      // 检查当前题所在分区：自动展开当前做题分区
      const curPartLabel = partOfIdx(current);
      const curSecKey = (curSubjectId || 'default') + '::' + currentChapterId + '::' + curPartLabel;
      let needRerender = false;
      if (collapsedSections.has(curSecKey)) {
        collapsedSections.delete(curSecKey);
        needRerender = true;
      }
      // 仅当用户主动开启了「全部折叠」（手风琴聚焦模式）时，跨分区切题才自动收起上一分区；展开模式下保持全开绝不折叠
      if (isAccordionMode && lastActivePartLabel !== null && lastActivePartLabel !== curPartLabel) {
        const prevSecKey = (curSubjectId || 'default') + '::' + currentChapterId + '::' + lastActivePartLabel;
        collapsedSections.add(prevSecKey);
        needRerender = true;
      }
      lastActivePartLabel = curPartLabel;

      if (needRerender) {
        renderNav();
        return;
      }

      const allBtns = nav.querySelectorAll('button[data-group-start]');
      let activeBtn = null;
      allBtns.forEach(function(btn) {
        const start = parseInt(btn.getAttribute('data-group-start'), 10);
        const inGroup = (start === targetStart);
        const isParent = btn.classList.contains('has-subs');
        const isActive = inGroup && (!isParent || !subMode);
        btn.classList.toggle('active', isActive);

        if (isParent) {
          btn.querySelectorAll('.sub-bar').forEach(function(bar, k) {
            const subIdx = start + k;
            bar.classList.toggle('active-sub', inGroup && subMode && subIdx === current);
          });
        }

        if (inGroup) {
          activeBtn = btn;
        }
      });

      if (!activeBtn) {
        renderNav();
      } else {
        const qnavStat = document.getElementById('qnavStat');
        if (qnavStat && ch.labels) {
          qnavStat.textContent = '共 ' + ch.labels.length + ' 题 · 当前 第 ' + (current + 1) + ' 题';
        }
        renderSubSelectBar(curGroup);
        if (scroll && activeBtn) {
          scrollActiveBtnToCenter(activeBtn, true);
        }
      }
    }

    function switchTo(idx, scrollNav) {
      if (scrollNav === undefined) scrollNav = true;
      autoSaveNotes(); // 切题前保存未提交的笔记（当前仍是旧题，saveNote 用 current 定位正确）
      const ch = getChapter();
      if (!ch || !ch.labels || ch.labels.length === 0) return;
      current = Math.max(0, Math.min(idx, ch.labels.length - 1));
      showSolution = defaultShowSolution;
      const base = getImgPath(current);
      const qImg = document.getElementById('questionImg');
      if (qImg) qImg.src = base ? (base + '_question.png') : '';
      setSolutionImages(base);
      renderQuestionAnnotations(); // 叠加已保存的图片标注（切题即见）
      updateSolutionUI();
      // 更新题号标签
      const qLabelEl = document.getElementById('qLabel');
      if (qLabelEl) qLabelEl.textContent = getQLabelText(current) || '';
      updateStatusBtns(); updateQBadBtn(); updateSBadBtn(); updateBookMismatchBtn(); updateImgBadWarnings();
      renderNotes();
      recordRecentQuestion(getCurrentQid());
      renderRelatedQuestions();
      renderCognitiveBadges();
      renderStats();
      updateNavActive(scrollNav);
      renderSm2InfoBar();
      updateHeaderProgressTag();
      saveResume(); // 记住当前停的章节/题目/小题模式，刷新或切科目前保留
    }

    // ===== 题目图/解析图不达标 & 与实书不符 =====
    function updateQBadBtn() { const btn = document.getElementById('btnQBad'); if (btn) btn.classList.toggle('marked', !!qBad[current]); }
    function updateSBadBtn() { const btn = document.getElementById('btnSBad'); if (btn) btn.classList.toggle('marked', !!sBad[current]); }
    function updateBookMismatchBtn() { const btn = document.getElementById('btnBookMismatch'); if (btn) btn.classList.toggle('marked', !!bookMismatch[current]); }

    function updateImgBadWarnings() {
      const qWarn = document.getElementById('qBadWarning');
      if (qWarn) qWarn.classList.toggle('show', !!qBad[current]);
      const sWarn = document.getElementById('sBadWarning');
      if (sWarn) sWarn.classList.toggle('show', !!sBad[current]);
      const mWarn = document.getElementById('bookMismatchWarning');
      if (mWarn) mWarn.classList.toggle('show', !!bookMismatch[current]);
      const qImg = document.getElementById('questionImg');
      if (qImg) {
        qImg.classList.toggle('qbad-border', !!qBad[current]);
        qImg.classList.toggle('mismatch-border', !!bookMismatch[current]);
      }
      document.querySelectorAll('#solutionImgs .solution-img').forEach(img => {
        img.classList.toggle('sbad-border', !!sBad[current]);
      });
    }

    // ===== 笔记渲染（统一委托至 MarkdownLatexEngine 基础引擎） =====
    function renderNotesMarkdown(src) {
      if (window.MarkdownLatexEngine && typeof window.MarkdownLatexEngine.renderBlock === 'function') {
        return window.MarkdownLatexEngine.renderBlock(src);
      }
      return escapeHtml(src);
    }

    // HTML 转义安全工具函数（优先使用基础引擎标准实现）
    function escapeHtml(str) {
      if (window.MarkdownLatexEngine && typeof window.MarkdownLatexEngine.escapeHtml === 'function') {
        return window.MarkdownLatexEngine.escapeHtml(str);
      }
      if (str === undefined || str === null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
    window.escapeHtml = escapeHtml;

    // ===== 同类题与跨书双向关联管理系统（已拆分至 js/topics.js） =====
    // 状态通过 window.TopicManager 与 window 上挂载的动态 getter 实时同步，不设静态快照遮蔽变量

    function normalizeSubjectId(sid) { return window.TopicManager ? window.TopicManager.normalizeSubjectId(sid) : sid; }
    function getQid(subjId, chId, idx) { return window.TopicManager ? window.TopicManager.getQid(subjId, chId, idx) : ''; }
    function getCurrentQid() { return window.TopicManager ? window.TopicManager.getCurrentQid() : ''; }
    function parseQid(qid) { return window.TopicManager ? window.TopicManager.parseQid(qid) : null; }
    function formatQidDisplay(qid) { return window.TopicManager ? window.TopicManager.formatQidDisplay(qid) : ''; }
    function loadRelatedTopics() { if (window.TopicManager) window.TopicManager.loadTopics(); }
    function saveRelatedTopics() { if (window.TopicManager) window.TopicManager.saveTopics(); }
    function loadRelatedAffinity() { if (window.TopicManager) window.TopicManager.loadAffinity(); }
    function saveRelatedAffinity() { if (window.TopicManager) window.TopicManager.saveAffinity(); }
    function getAffinityPairKey(q1, q2) { return window.TopicManager && (window.TopicManager.getAffinityPairKey || window.TopicManager.getPairKey) ? (window.TopicManager.getAffinityPairKey || window.TopicManager.getPairKey)(q1, q2) : ''; }
    function getTopicAffinity(q1, q2) { return window.TopicManager && (window.TopicManager.getTopicAffinity || window.TopicManager.getAffinity) ? (window.TopicManager.getTopicAffinity || window.TopicManager.getAffinity)(q1, q2) : 0; }
    function recordTopicAffinity(q1, q2, delta) { if (window.TopicManager && (window.TopicManager.recordTopicAffinity || window.TopicManager.recordAffinity)) (window.TopicManager.recordTopicAffinity || window.TopicManager.recordAffinity)(q1, q2, delta); }
    function recordQuestionVisit(qid) { if (window.TopicManager) window.TopicManager.recordRecentQuestion(qid); }
    function recordRecentQuestion(qid) { if (window.TopicManager) window.TopicManager.recordRecentQuestion(qid); }
    function parseTopicAndSubTopic(s) { return window.TopicManager ? window.TopicManager.parseTopicAndSubTopic(s) : { topicName: s, subTopic: '' }; }
    function createRelatedTopic(name, qid, note, sub) { return window.TopicManager ? window.TopicManager.createTopic(name, qid, note, sub) : null; }
    function addQuestionToTopic(tid, qid, note, sub) { return window.TopicManager ? window.TopicManager.addQuestion(tid, qid, note, sub) : false; }
    function removeQuestionFromTopic(tid, qid) { return window.TopicManager ? window.TopicManager.removeQuestion(tid, qid) : false; }
    function getQuestionRelatedData(qid) { return window.TopicManager && (window.TopicManager.getQuestionRelatedData || window.TopicManager.getQuestionData) ? (window.TopicManager.getQuestionRelatedData || window.TopicManager.getQuestionData)(qid) : { topics: [], relatedQuestions: [] }; }
    function openRelatedModal() { if (window.TopicManager) window.TopicManager.openModal(); }
    function closeRelatedModal() { if (window.TopicManager) window.TopicManager.closeModal(); }
    function initRelatedModal() { if (window.TopicManager) window.TopicManager.initModal(); }
    function renderRelatedQuestions() { if (window.TopicManager) window.TopicManager.renderRelatedQuestions(); }
    function jumpToQid(qid, pushStack) { if (window.TopicManager) window.TopicManager.jumpToQid(qid, pushStack); }

    // ===== 四维认知挂载插槽 (Cognitive Nexus Slot) 与全局通信事件 =====
    function triggerOpenCognitiveView(targetMeta) {
      const curQ = (typeof getCurrentQid === 'function') ? getCurrentQid() : '';
      const ch = getChapter();
      const curCh = currentChapterId || (ch ? ch.id : '');
      const isEnglish = (curSubjectId === 'english' || (curSubject && curSubject.type === 'english'));
      const detail = Object.assign({
        subject: isEnglish ? 'english' : 'math',
        qid: curQ,
        chapterId: curCh,
        kpId: '',
        methodId: ''
      }, targetMeta || {});

      if (!detail.kpId && window.TopicManager && curQ) {
        const topics = window.TopicManager.getTopicsForQid(curQ);
        if (topics && topics.length > 0) {
          detail.kpId = topics[0].id || '';
          detail.kpName = topics[0].name || '';
        }
      }

      if (window.CognitiveViewController) {
        if (targetMeta) {
          window.CognitiveViewController.open(detail);
        } else {
          window.CognitiveViewController.toggle(detail);
        }
      }

      window.dispatchEvent(new CustomEvent('open-cognitive-view', {
        detail: detail
      }));
    }
    window.triggerOpenCognitiveView = triggerOpenCognitiveView;

    function renderCognitiveBadges() {
      const slot = document.getElementById('questionCognitiveBadges');
      if (!slot) return;
      const qid = (typeof getCurrentQid === 'function') ? getCurrentQid() : '';
      slot.dataset.qid = qid || '';
      slot.innerHTML = '';
      if (!qid) return;

      const ch = getChapter();
      const currentChapter = currentChapterId || (ch ? ch.id : '');

      let kpId = '';
      let kpName = '';
      let methodId = '';
      let methodName = '';

      if (ch && ch.questions && ch.questions[current] && ch.questions[current].tracingMeta) {
        const tm = ch.questions[current].tracingMeta;
        kpId = tm.kpId || '';
        kpName = tm.kpTitle || tm.kpName || '';
        methodId = tm.methodId || '';
        methodName = tm.methodTitle || tm.methodName || '';
      }

      if (!kpId && window.TopicManager) {
        const topics = window.TopicManager.getTopicsForQid(qid);
        if (topics && topics.length > 0) {
          kpId = topics[0].id;
          kpName = topics[0].name;
        }
      }

      if (kpName) {
        const badgeKp = document.createElement('span');
        badgeKp.className = 'badge badge-kp';
        badgeKp.dataset.kpId = kpId;
        badgeKp.title = '对应考点 (点击打开认知视图)';
        badgeKp.innerHTML = '考点: ' + escapeHtml(kpName);
        badgeKp.addEventListener('click', function(e) {
          e.stopPropagation();
          triggerOpenCognitiveView({ qid: qid, chapterId: currentChapter, kpId: kpId, methodId: methodId });
        });
        slot.appendChild(badgeKp);
      }

      if (methodName) {
        const badgeMethod = document.createElement('span');
        badgeMethod.className = 'badge badge-method';
        badgeMethod.dataset.methodId = methodId;
        badgeMethod.title = '所用解法 (点击打开认知视图)';
        badgeMethod.innerHTML = '解法: ' + escapeHtml(methodName);
        badgeMethod.addEventListener('click', function(e) {
          e.stopPropagation();
          triggerOpenCognitiveView({ qid: qid, chapterId: currentChapter, kpId: kpId, methodId: methodId });
        });
        slot.appendChild(badgeMethod);
      }
    }
    window.renderCognitiveBadges = renderCognitiveBadges;
    // ===== 考研数学常用 LaTeX 符号盘与自动补全词典（已独立为 js/math_palette.js） =====
    function insertSnippetIntoNotes(snippet) {
      if (window.MathPalette) {
        window.MathPalette.insertSnippetIntoNotes(snippet, {
          enterEditMode: enterEditMode,
          onDirty: function() { notesDirty = true; },
          updateNotesPreview: updateNotesPreview
        });
      }
    }

    function wrapOrInsertPair(textarea, openChar, closeChar) {
      if (window.MathPalette) {
        window.MathPalette.wrapOrInsertPair(textarea, openChar, closeChar, {
          onDirty: function() { notesDirty = true; },
          updateNotesPreview: updateNotesPreview
        });
      }
    }

    var AUTOCOMPLETE_DICT = (window.MathPalette && window.MathPalette.AUTOCOMPLETE_DICT) || [];

    // 自动补全状态管理
    let acVisible = false;
    let acItems = [];
    let acActiveIndex = 0;
    let acQueryStart = -1;

    function showAcPopup() {
      acVisible = true;
      const popup = document.getElementById('notesAutocompletePopup');
      if (!popup) return;
      popup.style.display = 'flex';
      renderAcPopup();
    }

    function hideAcPopup() {
      acVisible = false;
      const popup = document.getElementById('notesAutocompletePopup');
      if (popup) popup.style.display = 'none';
    }

    function renderAcPopup() {
      const popup = document.getElementById('notesAutocompletePopup');
      if (!popup || !acVisible) return;
      popup.innerHTML = '';
      acItems.slice(0, 10).forEach(function(item, idx) {
        const el = document.createElement('div');
        el.className = 'n-ac-item' + (idx === acActiveIndex ? ' active' : '');
        el.innerHTML = '<div class="n-ac-left">' +
          '<span class="n-ac-label">\\' + item.key + '</span>' +
          '<span class="n-ac-desc">' + item.desc + '</span>' +
          '</div>' +
          '<span class="n-ac-preview">' + (item.preview || '') + '</span>';
        el.addEventListener('mousedown', function(e) {
          e.preventDefault(); // 防止失去焦点
          applyAutocomplete(item);
        });
        popup.appendChild(el);
      });
      const activeEl = popup.children[acActiveIndex];
      if (activeEl && activeEl.scrollIntoView) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }

    function applyAutocomplete(item) {
      const textarea = document.getElementById('notesTextarea');
      if (!textarea || acQueryStart === -1) return;
      const val = textarea.value;
      const before = val.substring(0, acQueryStart);
      const after = val.substring(textarea.selectionStart);
      let insertText = item.insert;
      let targetCursor = acQueryStart + insertText.length;
      if (insertText.indexOf('|') !== -1) {
        const pipeIdx = insertText.indexOf('|');
        insertText = insertText.replace('|', '');
        targetCursor = acQueryStart + pipeIdx;
      }
      textarea.value = before + insertText + after;
      textarea.selectionStart = targetCursor;
      textarea.selectionEnd = targetCursor;
      textarea.focus();
      hideAcPopup();
      notesDirty = true;
      updateNotesPreview();
    }

    // 编辑时右侧实时预览（40ms 低延迟防抖）
    var notesPreviewTimer = null;
    function updateNotesPreview() {
      clearTimeout(notesPreviewTimer);
      notesPreviewTimer = setTimeout(function() {
        var preview = document.getElementById('notesPreview');
        var textarea = document.getElementById('notesTextarea');
        if (preview) preview.innerHTML = renderNotesMarkdown(textarea ? textarea.value : '');
      }, 40);
    }

    // 查看模式：渲染结果常驻显示在「笔记」下方
    // 查看模式：渲染结果常驻显示在「笔记」下方
    function renderNotes() {
      const hasNote = notesData[notesKeyFor(current)] || '';
      const duo = document.getElementById('notesDuo');
      if (duo) duo.style.display = 'none'; // 非编辑态隐藏双栏编辑区
      const render = document.getElementById('notesRender');
      if (render) {
        render.style.display = '';
        render.innerHTML = renderNotesMarkdown(hasNote);
      }
      const textarea = document.getElementById('notesTextarea');
      if (textarea) textarea.value = hasNote;
      const preview = document.getElementById('notesPreview');
      if (preview) preview.innerHTML = renderNotesMarkdown(hasNote);

      var btnEdit = document.getElementById('btnNoteEdit');
      if (btnEdit) btnEdit.style.display = '';
      var btnSave = document.getElementById('btnNoteSave');
      if (btnSave) btnSave.style.display = 'none';
      var btnCancel = document.getElementById('btnNoteCancel');
      if (btnCancel) btnCancel.style.display = 'none';
      var btnDelete = document.getElementById('btnNoteDelete');
      if (btnDelete) btnDelete.style.display = hasNote ? '' : 'none';
      hideAcPopup();
      toggleMathSymbolPalette(false); // 结束编辑自动收起符号工具盘
    }

    // 有笔记（按当前题号 label）或任一图片有标注 → 右侧导航题号亮提示圆点（见 renderNav/appendBadges）

    function enterEditMode() {
      const duo = document.getElementById('notesDuo');
      const render = document.getElementById('notesRender');
      const btnEdit = document.getElementById('btnNoteEdit');
      const btnSave = document.getElementById('btnNoteSave');
      const btnCancel = document.getElementById('btnNoteCancel');
      const btnDelete = document.getElementById('btnNoteDelete');

      const val = notesData[notesKeyFor(current)] || '';
      const textarea = document.getElementById('notesTextarea');
      if (textarea) textarea.value = val;
      const preview = document.getElementById('notesPreview');
      if (preview) preview.innerHTML = renderNotesMarkdown(val);
      if (duo) duo.style.display = '';
      if (render) render.style.display = 'none';
      if (btnEdit) btnEdit.style.display = 'none';
      if (btnSave) btnSave.style.display = '';
      if (btnCancel) btnCancel.style.display = '';
      if (btnDelete) btnDelete.style.display = 'none';
      if (textarea) textarea.focus();
      notesDirty = false; // 进入编辑时重置（初始值即已保存内容）
      updateNotesPreview();
      toggleMathSymbolPalette(true); // 进入编辑自动展开常用符号代码工具盘

      // 实时预览（防抖）+ 自动补全触发 + 标记未保存改动
      textarea.oninput = function() {
        notesDirty = true;
        updateNotesPreview();

        const pos = textarea.selectionStart;
        const val = textarea.value;
        const before = val.substring(0, pos);
        const m = before.match(/\\([a-zA-Z0-9]*)$/);
        if (m) {
          const query = m[1].toLowerCase();
          acQueryStart = before.length - m[0].length;
          const matches = AUTOCOMPLETE_DICT.filter(function(item) {
            return item.key.toLowerCase().indexOf(query) === 0 || item.desc.indexOf(query) !== -1;
          });
          if (matches.length > 0) {
            acItems = matches;
            acActiveIndex = 0;
            showAcPopup();
          } else {
            hideAcPopup();
          }
        } else {
          hideAcPopup();
        }
      };

      // 快捷键、成对闭合与自动补全拦截
      textarea.onkeydown = function(e) {
        if (acVisible) {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            acActiveIndex = (acActiveIndex + 1) % Math.min(acItems.length, 10);
            renderAcPopup();
            return;
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            acActiveIndex = (acActiveIndex - 1 + Math.min(acItems.length, 10)) % Math.min(acItems.length, 10);
            renderAcPopup();
            return;
          } else if (e.key === 'Tab' || e.key === 'Enter') {
            e.preventDefault();
            applyAutocomplete(acItems[acActiveIndex]);
            return;
          } else if (e.key === 'Escape') {
            e.preventDefault();
            hideAcPopup();
            return;
          }
        }

        if (e.key === 'Escape') {
          e.preventDefault();
          cancelNoteEdit();
          return;
        }

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const val = textarea.value;

        // 跳过已存在的右括号/美元符号
        if (start === end && (e.key === '$' || e.key === '}' || e.key === ')' || e.key === ']') && val[start] === e.key) {
          e.preventDefault();
          textarea.selectionStart = start + 1;
          textarea.selectionEnd = start + 1;
          return;
        }

        // 成对自动闭合
        if (e.key === '$') {
          e.preventDefault();
          wrapOrInsertPair(textarea, '$', '$');
          return;
        } else if (e.key === '{') {
          e.preventDefault();
          wrapOrInsertPair(textarea, '{', '}');
          return;
        } else if (e.key === '(') {
          e.preventDefault();
          wrapOrInsertPair(textarea, '(', ')');
          return;
        } else if (e.key === '[') {
          e.preventDefault();
          wrapOrInsertPair(textarea, '[', ']');
          return;
        } else if (e.key === 'Backspace' && start === end && start > 0) {
          const prevChar = val[start - 1];
          const nextChar = val[start];
          if ((prevChar === '$' && nextChar === '$') ||
              (prevChar === '{' && nextChar === '}') ||
              (prevChar === '(' && nextChar === ')') ||
              (prevChar === '[' && nextChar === ']')) {
            e.preventDefault();
            textarea.value = val.substring(0, start - 1) + val.substring(start + 1);
            textarea.selectionStart = start - 1;
            textarea.selectionEnd = start - 1;
            notesDirty = true;
            updateNotesPreview();
            return;
          }
        }

        // Enter 保存，Shift+Enter 换行
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          saveNote();
        }
      };
    }

    function saveNote() {
      const nk = notesKeyFor(current);
      const textarea = document.getElementById('notesTextarea');
      const val = textarea.value.trim();
      if (val) {
        notesData[nk] = val;
      } else {
        delete notesData[nk];
      }
      saveNotes();
      notesDirty = false;
      hideAcPopup();
      renderNotes(); // 保存后回到查看模式（渲染结果）
      renderNav();
    }

    // 离开编辑态前的自动保存：若有未提交改动且仍在编辑态，落盘并退出编辑态
    function autoSaveNotes() {
      if (!notesDirty) return;
      const duo = document.getElementById('notesDuo');
      if (duo && duo.style.display === 'none') { notesDirty = false; return; } // 已退出编辑态，忽略残留标志
      saveNote(); // 内部写 notesData + saveNotes + renderNotes（退出编辑态）+ 清零 notesDirty
    }

    function cancelNoteEdit() {
      notesDirty = false; // 用户主动放弃编辑，丢弃未保存内容
      hideAcPopup();
      renderNotes(); // 取消后回到查看模式（渲染结果）
    }

    function deleteNote() {
      delete notesData[notesKeyFor(current)];
      saveNotes();
      notesDirty = false;
      renderNotes();
      renderNav();
    }

    function focusNotes() {
      enterEditMode(); // N 键：直接进入编辑
    }

    function toggleQBad() { qBad[current] = !qBad[current]; if (!qBad[current]) delete qBad[current]; saveQBad(); updateQBadBtn(); updateImgBadWarnings(); renderNav(); }
    function toggleSBad() { sBad[current] = !sBad[current]; if (!sBad[current]) delete sBad[current]; saveSBad(); updateSBadBtn(); updateImgBadWarnings(); renderNav(); }
    function toggleBookMismatch() { bookMismatch[current] = !bookMismatch[current]; if (!bookMismatch[current]) delete bookMismatch[current]; saveBookMismatch(); updateBookMismatchBtn(); updateImgBadWarnings(); renderNav(); }

    // ===== 笔记快速插入工具栏初始化（委托 MathPalette） =====
    function initNotesQuickToolbar() {
      if (window.MathPalette) {
        window.MathPalette.initNotesQuickToolbar({
          enterEditMode: enterEditMode,
          onDirty: function () { notesDirty = true; },
          updateNotesPreview: updateNotesPreview
        });
      }
    }

    // ===== 右侧常用数学符号工具盘折叠与切换（委托 MathPalette） =====
    function toggleMathSymbolPalette(forceOpen) {
      if (window.MathPalette) {
        window.MathPalette.toggleMathSymbolPalette(forceOpen, sidebarCollapsed);
      }
    }

    // ===== 右侧常用数学符号工具盘初始化（委托 MathPalette） =====
    function initMathSymbolPalette() {
      if (window.MathPalette) {
        window.MathPalette.initMathSymbolPalette({
          enterEditMode: enterEditMode,
          onDirty: function () { notesDirty = true; },
          updateNotesPreview: updateNotesPreview
        }, function () { return sidebarCollapsed; });
      }
    }

    // ===== 组合键检测（R/T 图质量与实书不符标记） =====
    let rtComboState = { r: false, t: false, timer: null };
    function resetRtCombo() {
      rtComboState.r = false; rtComboState.t = false;
      if (rtComboState.timer) { clearTimeout(rtComboState.timer); rtComboState.timer = null; }
    }
    function handleBadKey(key) {
      var ch = key.toLowerCase();
      if (ch !== 'r' && ch !== 't') { resetRtCombo(); return; }
      rtComboState[ch] = true;
      if (rtComboState.timer) { clearTimeout(rtComboState.timer); rtComboState.timer = null; }
      // 检测组合键（顺序无关）：R + T → 该题与实书不符
      if (rtComboState.r && rtComboState.t) {
        toggleBookMismatch();
        resetRtCombo();
        return;
      }
      // 未形成组合，等待 120ms 后按单键触发
      rtComboState.timer = setTimeout(function() {
        if (rtComboState.r) { toggleQBad(); }
        else if (rtComboState.t) { toggleSBad(); }
        resetRtCombo();
      }, 120);
    }

    // ===== 组合键检测（Z/X/C 5级打标） =====
    let comboState = { z: false, x: false, c: false, timer: null };
    function resetCombo() {
      comboState.z = false; comboState.x = false; comboState.c = false;
      if (comboState.timer) { clearTimeout(comboState.timer); comboState.timer = null; }
    }
    function handleStatusKey(key) {
      // 注：调用方已在 keydown 中做了 INPUT/TEXTAREA 过滤
      var ch = key.toLowerCase();
      if (ch !== 'z' && ch !== 'x' && ch !== 'c') { resetCombo(); return; }
      comboState[ch] = true;
      if (comboState.timer) { clearTimeout(comboState.timer); comboState.timer = null; }
      // 检测组合键（顺序无关）
      // Z + X → 较熟练 (familiar, lv4)
      if (comboState.z && comboState.x) {
        setStatus('familiar'); resetCombo(); return;
      }
      // X + C → 困难 (rusty, lv2)
      if (comboState.x && comboState.c) {
        setStatus('rusty'); resetCombo(); return;
      }
      // 未形成组合，等待 120ms 后按单键触发
      comboState.timer = setTimeout(function() {
        if (comboState.z) { setStatus('proficient'); }
        else if (comboState.x) { setStatus('vague'); }
        else if (comboState.c) { setStatus('wrong'); }
        resetCombo();
      }, 120);
    }

    // ===== 掌握度 =====
    function updateStatusBtns() {
      const cur = statuses[current] || '';
      ['proficient', 'familiar', 'vague', 'rusty', 'wrong'].forEach(function(s) {
        const btn = document.getElementById('btn' + s.charAt(0).toUpperCase() + s.slice(1));
        if (!btn) return;
        btn.className = 'gel-btn btn-status' + (s === cur ? ' ' + s + ' active' : '');
      });
    }

    function setStatus(status) {
      const had = statuses[current];
      // 复习会话中不允许取消标记（同一键重复选 = 正常记录，不 toggle off）
      const togglingOff = reviewSession ? false : (had === status);
      // 撤销栈：记录本次修改前的状态
      if (!togglingOff) pushUndo(current, had);
      if (togglingOff) { delete statuses[current]; pushUndo(current, had); }
      else { statuses[current] = status; }
      saveStatuses(); updateStatusBtns(); renderStats(); renderNav(); updateFilterCounts();
      const scoreMap = { proficient: 5, familiar: 4, vague: 3, rusty: 2, wrong: 1 };
      const score = scoreMap[status];
      if (reviewSession && !togglingOff && score) {
        // 复习会话评级：延迟提交，不即时改 SM-2
        const getCurItem = (typeof reviewCurrentItem === 'function') ? reviewCurrentItem : (window.Sm2Review ? window.Sm2Review.reviewCurrentItem : null);
        const item = getCurItem ? getCurItem() : null;
        const isReviewTarget = item && currentChapterId === item.chapterId && current === item.idx;
        if (isReviewTarget) {
          item.finalScore = score;
          item.status = 'graded';
          if (typeof reviewAdvance === 'function') reviewAdvance(1);
          else if (window.Sm2Review && window.Sm2Review.reviewAdvance) window.Sm2Review.reviewAdvance(1);
        } else {
          // A/D/W/S 漂移到相邻题评级：只重定基线，不改复习位置
          rebaselineSm2(current, score);
        }
      } else if (!togglingOff && score) {
        // 常规答题改标：重定基线，首次标记（原本未做）时自动跳到下一题
        rebaselineSm2(current, score);
        recordStudyActivity();
        if (!had) navNext();
      }
      renderSm2InfoBar();
    }

    // ===== 撤销最近一次掌握度标记 =====
    var undoStack = [];
    function pushUndo(idx, prevStatus) {
      undoStack.push({
        idx: idx,
        prevStatus: prevStatus || '',
        chapterId: currentChapterId,
        subjectId: curSubjectId
      });
      if (undoStack.length > 50) undoStack.shift();
    }
    function undoLastMark() {
      if (undoStack.length === 0) return;
      var act = undoStack.pop();
      if (!act) return;

      // 若撤销操作属于其他科目或章节，先切换回对应上下文
      if (act.subjectId && act.subjectId !== curSubjectId) {
        switchSubject(act.subjectId);
      }
      if (act.chapterId && act.chapterId !== currentChapterId) {
        switchChapter(act.chapterId);
      }
      switchTo(act.idx);

      const scoreMap = { proficient: 5, familiar: 4, vague: 3, rusty: 2, wrong: 1 };
      if (act.prevStatus) {
        statuses[act.idx] = act.prevStatus;
        rebaselineSm2(act.idx, scoreMap[act.prevStatus]);
      } else {
        delete statuses[act.idx];
        rebaselineSm2(act.idx, 0);
      }

      saveStatuses();
      updateStatusBtns();
      renderStats();
      renderNav();
      updateFilterCounts();
      renderSm2InfoBar();
    }

    function toggleSolution() {
      showSolution = !showSolution;
      saveSolutionPref(); // 解析显示开关持久化（按科目记忆）
      updateSolutionUI();
    }

    function toggleDefaultSolution() {
      defaultShowSolution = !defaultShowSolution;
      showSolution = defaultShowSolution;
      saveSolutionPref(); // 解析默认偏好持久化（按科目记忆）
      renderSolDefaultBtn();
      updateSolutionUI();
    }

    function renderSolDefaultBtn() {
      const btn = document.getElementById('btnSolDefault');
      if (defaultShowSolution) {
        btn.innerHTML = '解析默认：显示<span class="sol-key">Shift+Space</span>';
      } else {
        btn.innerHTML = '解析默认：隐藏<span class="sol-key">Shift+Space</span>';
      }
    }

    // ===== 筛选栏数字统计 =====
    function updateFilterCounts() {
      const ch = getChapter();
      const total = ch.total;
      let prof = 0, vag = 0, wr = 0;
      Object.values(statuses).forEach(function(s) {
        if (s === 'proficient') prof++;
        else if (s === 'vague' || s === 'familiar') vag++;
        else if (s === 'wrong' || s === 'rusty') wr++;
      });
      // 带标注计数（含文字笔记、图片标注、关联同类题）
      let withMarked = 0;
      for (let i = 0; i < total; i++) {
        if (hasQuestionMarked(i)) withMarked++;
      }
      const setCount = function(filter, val) {
        const el = document.querySelector('.filter-btn[data-filter="' + filter + '"] .filter-count');
        if (el) el.textContent = val;
      };
      setCount('all', total);
      setCount('proficient', prof);
      setCount('vague', vag);
      setCount('wrong', wr);
      setCount('unmarked', withMarked);
    }

    // ===== 灯箱（图片点击全屏） =====
    let lbScale = 1, lbTranslateX = 0, lbTranslateY = 0, lbDragging = false, lbLastX = 0, lbLastY = 0;

    function lbApplyTransform() {
      const img = document.getElementById('lightboxImg');
      img.style.transform = 'translate(' + lbTranslateX + 'px,' + lbTranslateY + 'px) scale(' + lbScale + ')';
    }


    document.addEventListener('DOMContentLoaded', function () {
      const overlay = document.getElementById('lightbox');
      const lbImg = document.getElementById('lightboxImg');

      // 题目图片点击打开灯箱。
      // 用捕获阶段监听 .annot-wrapper（图片 + readonly 标注层的父容器）：
      // 有标注时 readonly 标注层（mjs-marker-view 及其 shadow 内部）会覆盖图片区域，
      // 点击的 target 是标注层本身而非 <img>，冒泡阶段到不了 questionImg（questionImg
      // 是兄弟节点，不在事件路径上）。捕获阶段在 wrapper 上先于 target 处理，且能拿到
      // 图片 src，保证无论是否命中标注层都能开灯箱。
      document.getElementById('qAnnotWrap').addEventListener('click', function (e) {
        const img = document.getElementById('questionImg');
        const src = img && img.src;
        if (src && !src.endsWith('/')) openLightbox(src);
      }, true);
      // 解析图片（含分片）也可点击打开灯箱。
      // 捕获阶段监听：有标注时点击 target 是标注层（mjs-marker-view）而非 <img>，
      // 需从事件路径里找对应的 .solution-img 取 src（与主题目图同理，见 qAnnotWrap）。
      document.getElementById('solutionImgs').addEventListener('click', function (e) {
        // 从事件路径找 .solution-img（覆盖 命中标注层 / 命中 <img> 两种情况）。
        // 有标注时点击命中标注层，.solution-img 是 .annot-overlay 的兄弟节点、不在路径上，
        // 但 .annot-wrapper 是标注层的祖先、一定在路径上——从它里面取回被覆盖的那张 <img>。
        const path = e.composedPath ? e.composedPath() : (e.path || []);
        let img = null;
        for (let i = 0; i < path.length; i++) {
          const el = path[i];
          if (el && el.classList) {
            if (el.classList.contains('solution-img')) { img = el; break; }
            if (el.classList.contains('annot-wrapper')) {
              const im = el.querySelector('.solution-img');
              if (im) { img = im; break; }
            }
          }
        }
        const src = img && img.src;
        if (src && !src.endsWith('/')) openLightbox(src);
      }, true);

      document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
      overlay.addEventListener('click', function (e) { if (e.target === overlay) closeLightbox(); });

      // 标注模式下点击非图片背景：与查看模式一致地退出（保存标注并回到灯箱查看）。
      // mjs-marker-area 铺满灯箱，需在 capture 阶段拦截：命中 marker-area 本身或其后代空白区即视为背景点击。
      overlay.addEventListener('click', function (e) {
        if (!lbAnnotMode) return;
        const ma = (typeof lbMarkerArea !== 'undefined' && lbMarkerArea) ||
                   (window.ImageAnnotator && window.ImageAnnotator.getMarkerArea && window.ImageAnnotator.getMarkerArea()) ||
                   (typeof window.lbMarkerArea !== 'undefined' && window.lbMarkerArea);
        if (!ma) return;
        // 工具栏 / 预设色板 / 标注按钮 / 关闭按钮等控件上的点击不拦截
        if (e.target.closest && e.target.closest('#annotToolbar, #annotPalette, #lightboxAnnotate, #lightboxClose, .annot-palette, .annot-toolbar, .at-btn, .at-swatch, .at-color-swatch, .at-width-wrap, .at-width-step, .annot-palette-custom')) return;
        if (e.composedPath) {
          const path = e.composedPath();
          const hitControl = path.some(function (el) {
            return el && (
              el.id === 'annotToolbar' ||
              el.id === 'annotPalette' ||
              el.id === 'lightboxAnnotate' ||
              el.id === 'lightboxClose' ||
              (el.classList && (
                el.classList.contains('annot-palette') ||
                el.classList.contains('annot-toolbar') ||
                el.classList.contains('at-btn') ||
                el.classList.contains('at-swatch') ||
                el.classList.contains('at-color-swatch') ||
                el.classList.contains('at-width-wrap') ||
                el.classList.contains('at-width-step') ||
                el.classList.contains('annot-palette-custom')
              ))
            );
          });
          if (hitControl) return;
        }
        // 判断是否点在图内：标记编辑区（canvas-container）内的图片/控件算图内，其余算背景
        let insideImage = false;
        try {
          const imgEl = ma._editingTarget || (ma.shadowRoot && ma.shadowRoot.querySelector('.canvas-container img'));
          if (imgEl && imgEl.getBoundingClientRect) {
            const r = imgEl.getBoundingClientRect();
            insideImage = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
          }
        } catch (err) {}
        if (!insideImage) {
          e.stopPropagation();
          // 无标注内容 → 直接退出灯箱；有标注内容 → 先保存并退出标注模式（回到灯箱查看）
          if (annotHasContent()) saveAnnotationFromArea();
          else closeLightbox();
        }
      }, true);

      // 灯箱滚轮缩放
      overlay.addEventListener('wheel', function (e) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 1.15 : 0.87;
        const newScale = Math.min(Math.max(lbScale * delta, 0.5), 5);
        const rect = lbImg.getBoundingClientRect();
        const mx = e.clientX - rect.left - rect.width / 2;
        const my = e.clientY - rect.top - rect.height / 2;
        lbTranslateX -= mx * (newScale / lbScale - 1);
        lbTranslateY -= my * (newScale / lbScale - 1);
        lbScale = newScale;
        lbApplyTransform();
      }, { passive: false });

      // 灯箱拖拽
      lbImg.addEventListener('mousedown', function (e) {
        lbDragging = true; lbLastX = e.clientX; lbLastY = e.clientY;
        lbImg.classList.add('grabbing');
      });
      window.addEventListener('mousemove', function (e) {
        if (!lbDragging) return;
        lbTranslateX += e.clientX - lbLastX;
        lbTranslateY += e.clientY - lbLastY;
        lbLastX = e.clientX; lbLastY = e.clientY;
        lbApplyTransform();
      });
      window.addEventListener('mouseup', function () {
        lbDragging = false;
        lbImg.classList.remove('grabbing');
      });

      // 绑定标注工具栏事件与上下文回调（含右键 contextmenu 拦截与画笔调节）
      if (window.ImageAnnotator && window.ImageAnnotator.bindToolbar) {
        window.ImageAnnotator.bindToolbar({
          refreshPageOverlays: refreshPageOverlays,
          renderNav: renderNav
        });
      }

      // 灯箱双击关闭
      lbImg.addEventListener('dblclick', closeLightbox);

      // 快捷键帮助：点击背景或关闭按钮关闭
      const scOverlay = document.getElementById('shortcutOverlay');
      if (scOverlay) {
        scOverlay.addEventListener('click', function(e) {
          if (e.target === scOverlay) toggleShortcutHelp();
        });
      }
      const scCloseBtn = document.getElementById('btnShortcutModalClose');
      if (scCloseBtn) {
        scCloseBtn.addEventListener('click', function() {
          toggleShortcutHelp();
        });
      }
      // 侧栏折叠、笔记快捷工具栏与常用数学符号盘初始化
      initSidebarCollapse();
      initNotesQuickToolbar();
      initMathSymbolPalette();
    });

    // ===== 侧栏折叠与自适应逻辑（I 键收起两侧栏进入沉浸模式） =====
    let sidebarCollapsed = false;
    try {
      sidebarCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    } catch (e) {}

    function setSidebarCollapsed(collapsed) {
      sidebarCollapsed = !!collapsed;
      const layout = document.getElementById('mathAppLayout');
      if (layout) layout.classList.toggle('sidebar-collapsed', sidebarCollapsed);
      const floatBtn = document.getElementById('btnFloatingExpandSidebar');
      if (floatBtn) floatBtn.style.display = sidebarCollapsed ? 'inline-flex' : 'none';
      try {
        localStorage.setItem('sidebar_collapsed', sidebarCollapsed ? 'true' : 'false');
      } catch (e) {}
      updateHeaderProgressTag();
    }

    function toggleLeftSidebar() {
      setSidebarCollapsed(!sidebarCollapsed);
    }

    // 侧栏收起时在上方书名/章节信息栏展现当前题目与分区进度（不显示符号代码）
    function updateHeaderProgressTag() {
      const tag = document.getElementById('headerProgressTag');
      if (!tag) return;
      const ch = getChapter();
      if (!ch || !ch.labels || !sidebarCollapsed) {
        tag.style.display = 'none';
        return;
      }

      const partLabel = partOfIdx(current) || '题目';
      ensureGroups(ch);
      const g = ch.groupForIdx[current];
      let qDisplay = (ch.displayLabels && ch.displayLabels[current]) ? ch.displayLabels[current] : (g && g.parentLabel ? g.parentLabel : ch.labels[current]);

      // 计算当前分区完成情况
      let secTotal = 0, secDone = 0;
      for (let i = 0; i < ch.labels.length; i++) {
        if (partOfIdx(i) === partLabel) {
          secTotal++;
          if (statuses[i]) secDone++;
        }
      }

      tag.innerHTML = '<span class="hpt-part">[' + partLabel + ']</span>' +
                      '<span class="hpt-q">' + qDisplay + '</span>' +
                      '<span class="hpt-stat">本区 ' + secDone + '/' + secTotal + ' · 全章 ' + (current + 1) + '/' + ch.labels.length + '</span>';
      tag.style.display = 'inline-flex';
    }

    function initSidebarCollapse() {
      const btnCollapse = document.getElementById('btnCollapseSidebar');
      if (btnCollapse) {
        btnCollapse.addEventListener('click', function() {
          setSidebarCollapsed(true);
        });
      }
      const btnExpand = document.getElementById('btnFloatingExpandSidebar');
      if (btnExpand) {
        btnExpand.addEventListener('click', function() {
          setSidebarCollapsed(false);
        });
      }
      setSidebarCollapsed(sidebarCollapsed);
    }


    // ===== 图片标注（marker.js 3，已拆分至 js/annotator.js） =====
    var imgAnnotations = (window.ImageAnnotator && window.ImageAnnotator.getAnnotationsMap()) || {};
    function normalizeAnnotSrc(imgSrc) { return window.ImageAnnotator ? window.ImageAnnotator.normalizeSrc(imgSrc) : imgSrc; }
    function loadAnnotations() { if (window.ImageAnnotator) window.ImageAnnotator.load(); }
    function saveAnnotation(imgSrc, state) { if (window.ImageAnnotator) window.ImageAnnotator.save(imgSrc, state); }
    function getAnnotation(imgSrc) { return window.ImageAnnotator ? window.ImageAnnotator.get(imgSrc) : null; }
    function clearAnnotation(imgSrc) { if (window.ImageAnnotator) window.ImageAnnotator.clear(imgSrc); }
    function hasAnnotation(imgSrc) { return window.ImageAnnotator ? window.ImageAnnotator.has(imgSrc) : false; }
    function hasQuestionImagesAnnotated(idx) {
      if (window.ImageAnnotator) return window.ImageAnnotator.hasPrefix(getImgPath(idx));
      return false;
    }

    // 灯箱与标注交互（委托 ImageAnnotator 模块）
    var lbCurrentSrc = null;
    function openLightbox(src) {
      closeAnnotator();
      const overlay = document.getElementById('lightbox');
      const img = document.getElementById('lightboxImg');
      lbCurrentSrc = src;
      if (window.ImageAnnotator) window.ImageAnnotator.setCurrentSrc(src);
      img.src = src;
      const enable = (currentTheme === 'dark' && darkImageFilter);
      img.classList.toggle('dark-filter', enable);
      lbScale = 1; lbTranslateX = 0; lbTranslateY = 0;
      img.style.transform = '';
      overlay.classList.add('show');
      document.body.style.overflow = 'hidden';
      updateAnnotateBtn();
      openAnnotator();
    }

    function closeLightbox() {
      closeAnnotator();
      const overlay = document.getElementById('lightbox');
      overlay.classList.remove('show');
      document.body.style.overflow = '';
      lbCurrentSrc = null;
      if (window.ImageAnnotator) window.ImageAnnotator.setCurrentSrc(null);
    }

    function showLightboxAnnotationOverlay() {
      if (window.ImageAnnotator) window.ImageAnnotator.showOverlay();
    }

    function updateAnnotateBtn() {
      if (window.ImageAnnotator) window.ImageAnnotator.updateBtn();
    }

    function openAnnotator() {
      if (window.ImageAnnotator) window.ImageAnnotator.open(lbCurrentSrc);
    }

    function closeAnnotator() {
      if (window.ImageAnnotator) window.ImageAnnotator.close();
    }

    function saveAnnotationFromArea() {
      if (window.ImageAnnotator) {
        window.ImageAnnotator.saveFromArea({
          refreshPageOverlays: refreshPageOverlays,
          renderNav: renderNav
        });
      }
    }

    function annotHasContent() {
      return window.ImageAnnotator ? window.ImageAnnotator.hasContent() : false;
    }

    function refreshPageOverlays() {
      renderQuestionAnnotations();
      const container = document.getElementById('solutionImgs');
      if (container) {
        const base = getImgPath(current);
        setSolutionImages(base);
      }
    }

    // ===== 事件绑定 =====
    document.getElementById('btnToggle').onclick = toggleSolution;
    document.getElementById('btnSolDefault').onclick = toggleDefaultSolution;
    document.getElementById('btnDashboard').onclick = toggleDashboard;
    document.getElementById('btnWrongBook').onclick = toggleWrongBook;
    document.getElementById('btnShortcutHelp').onclick = toggleShortcutHelp;
    const btnSm2Sidebar = document.getElementById('btnSm2PanelSidebar');
    if (btnSm2Sidebar) btnSm2Sidebar.onclick = toggleSm2Panel;
    const btnExam = document.getElementById('btnExamWorkbench');
    if (btnExam) {
      btnExam.onclick = function (e) {
        e.preventDefault();
        triggerOpenCognitiveView();
      };
    }
    ['Proficient', 'Familiar', 'Vague', 'Rusty', 'Wrong'].forEach(s => {
      document.getElementById('btn' + s).onclick = function () { setStatus(s.toLowerCase()); };
    });
    document.getElementById('btnQBad').onclick = toggleQBad;
    document.getElementById('btnSBad').onclick = toggleSBad;
    const btnMismatch = document.getElementById('btnBookMismatch');
    if (btnMismatch) btnMismatch.onclick = toggleBookMismatch;

    // 笔记按钮事件
    document.getElementById('btnNoteEdit').onclick = enterEditMode;
    document.getElementById('btnNoteSave').onclick = saveNote;
    document.getElementById('btnNoteCancel').onclick = cancelNoteEdit;
    document.getElementById('btnNoteDelete').onclick = deleteNote;

    // 筛选按钮事件
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        applyFilter(this.dataset.filter);
      });
    });

    // 导出按钮事件
    document.getElementById('btnExportVague').onclick = function () { exportQuestions('vague'); };
    document.getElementById('btnExportWrong').onclick = function () { exportQuestions('wrong'); };

    // ===== 错题导出 =====
    function exportQuestions(statusFilter) {
      const ch = getChapter();
      if (!ch) return;
      const items = [];
      for (let i = 0; i < ch.total; i++) {
        if (statuses[i] === statusFilter) {
          items.push({ label: ch.labels[i], qImg: getImgPath(i) + '_question.png' });
        }
      }
      if (items.length === 0) {
        var emptyMsg = (statusFilter === 'vague' ? '当前章节没有标记为"模糊"的题目' : '当前章节没有标记为"不会"的题目');
        if (typeof window.showToast === 'function') {
          window.showToast(emptyMsg, 'warning');
        } else if (window.storageSync && typeof window.storageSync.showToast === 'function') {
          window.storageSync.showToast(emptyMsg, 'warning');
        }
        return;
      }
      const statusLabel = statusFilter === 'vague' ? '模糊' : '不会';
      const statusColor = statusFilter === 'vague' ? '#FBC02D' : '#B71C1C';
      const cardsHTML = items.map((item, idx) => {
        // 导出窗口是 about:blank，相对路径无法解析；转成绝对路径（file:// 或 http(s)://）
        let abs = item.qImg;
        try { abs = new URL(item.qImg, window.location.href).href; } catch (e) {}
        return `<div class="card"><h3>${idx + 1}. ${escapeHtml(item.label)}</h3><img src="${escapeHtml(abs)}" alt="题目" onerror="this.style.display='none'"></div>`;
      }).join('');

      const w = window.open('', '_blank', 'width=900,height=700');
      if (!w) {
        if (typeof window.showToast === 'function') {
          window.showToast('导出窗口被浏览器拦截，请允许弹出窗口后重试。', 'error');
        } else if (window.storageSync && typeof window.storageSync.showToast === 'function') {
          window.storageSync.showToast('导出窗口被浏览器拦截，请允许弹出窗口后重试。', 'error');
        }
        return;
      }
      w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escapeHtml(ch.name)} — ${statusLabel}题</title>
<style>
body{font-family:"Microsoft YaHei",sans-serif;background:#fff;padding:20px;color:#333}
h1{font-size:20px;text-align:center;margin-bottom:4px}
.subtitle{text-align:center;color:${statusColor};font-size:14px;margin-bottom:20px}
.card{border:1px solid #ddd;border-radius:8px;padding:16px;margin-bottom:20px;page-break-inside:avoid}
.card h3{font-size:14px;color:${statusColor};margin:0 0 8px}
.card img{max-width:100%;display:block;margin:8px 0}
@media print{body{padding:0}.card{border:none;border-bottom:1px dashed #ccc;border-radius:0;margin-bottom:12px;padding:12px 0}}
</style></head><body>
<h1>${escapeHtml(ch.name)}</h1>
<div class="subtitle">${statusLabel}题 · 共 ${items.length} 题</div>
${cardsHTML}
<script>window.onload=function(){window.print()}<\/script>
</body></html>`);
      w.document.close();
    }

    // ===== SM-2 间隔重复复习系统 =====
    let sm2 = {};          // { idx: { ef, interval, reps, nextReview, lastReview, history } }

    // SM-2 存储键：sm2_<subjectId>_<chapterId>（含科目 ID 避免数学/822 的 ch1 冲突）
    function sm2Key(ch) { return 'sm2_' + curSubjectId + '_' + ch.id; }

    function getSm2Item(key) {
      var val = localStorage.getItem(key);
      if (!val && key.startsWith('sm2_math_')) {
        var oldKey = 'sm2_shu1_' + key.substring(9);
        val = localStorage.getItem(oldKey);
        if (val) {
          try {
            localStorage.setItem(key, val);
            localStorage.removeItem(oldKey);
          } catch (e) {}
        }
      }
      return val;
    }

    function loadSm2() {
      const ch = getChapter(); if (!ch) return;
      sm2 = {};
      if (window.StorageEngine) {
        var stores = getStoresForCurrentChapter();
        if (stores) {
          stores.forEach(function (s) {
            s.store.readIntoMemory({ sm2: sm2 }, s.offset);
          });
        }
      }
    }

    // ===== SM-2 复习持久化与重置 =====
    function saveSm2() {
      if (window.StorageEngine) {
        var stores = getStoresForCurrentChapter();
        if (stores) {
          stores.forEach(function (s) {
            s.store.writeFromMemory({ sm2: sm2, offset: s.offset, len: s.len });
          });
        }
      }
      notifyStorageSync();
    }

    // 读取任意章节「合并后」的 SM-2（own 段 + 1000题伴章段），键为合并索引 0..total-1
    function readMergedSm2(ch) {
      var out = {};
      var srcs = statusSources(ch);
      if (window.StorageEngine) {
        srcs.forEach(function(src) {
          if (src.ch && src.ch.uid) {
            var store = new window.StorageEngine.ChapterStore(src.ch);
            store.readIntoMemory({ sm2: out }, src.offset);
          }
        });
      }
      return out;
    }

    // 将「合并后」的 SM-2 写回 own/伴章两块存储键（纯净 SSOT）
    function writeMergedSm2(ch, merged) {
      var srcs = statusSources(ch);
      if (window.StorageEngine) {
        srcs.forEach(function(src) {
          if (src.ch && src.ch.uid) {
            var store = new window.StorageEngine.ChapterStore(src.ch);
            store.writeFromMemory({ sm2: merged, offset: src.offset, len: src.len });
          }
        });
      }
      notifyStorageSync();
    }

    // 重置所有 SM-2 复习进度
    function resetAllSm2() {
      var clearedCount = 0;
      if (window.StorageEngine) {
        for (var j = 0; j < localStorage.length; j++) {
          var k3 = localStorage.key(j);
          if (k3 && k3.indexOf('kaoyan.q.') === 0) {
            try {
              var qdata = JSON.parse(localStorage.getItem(k3));
              if (qdata && qdata.$v === 3) {
                var changed = false;
                for (var slug in qdata) {
                  if (slug.charAt(0) !== '$' && qdata[slug] && qdata[slug].sm2) {
                    delete qdata[slug].sm2;
                    changed = true;
                    clearedCount++;
                  }
                }
                if (changed) {
                  qdata.$saved = new Date().toISOString();
                  safeLSSet(k3, JSON.stringify(qdata));
                }
              }
            } catch (e) {}
          }
        }
      }
      sm2 = {};
      if (sm2PanelOpen) renderSm2Panel();
      if (typeof window.showToast === 'function') {
        window.showToast('SM-2 复习进度已重置（' + clearedCount + ' 条记录已清除）。', 'info');
      } else if (window.storageSync && typeof window.storageSync.showToast === 'function') {
        window.storageSync.showToast('SM-2 复习进度已重置（' + clearedCount + ' 条记录已清除）。', 'info');
      }
      return clearedCount;
    }

    // ===== 基于 SM-2+ 算法的间隔重复记忆系统（已拆分至 js/sm2_review.js） =====
    function calcRetrievability(record, now) { return window.Sm2Review ? window.Sm2Review.calcRetrievability(record, now) : 1.0; }
    function calcSM2Plus(record, score, customNow) { return window.Sm2Review ? window.Sm2Review.calcSM2Plus(record, score, customNow) : null; }
    function calcSM2(record, score) { return window.Sm2Review ? window.Sm2Review.calcSM2(record, score) : null; }
    function getSm2Seed(score) { return window.Sm2Review ? window.Sm2Review.getSm2Seed(score) : null; }
    function getSm2Label(rec) { return window.Sm2Review ? window.Sm2Review.getSm2Label(rec) : ''; }
    function getSm2OverdueDays(rec) { return window.Sm2Review ? window.Sm2Review.getSm2OverdueDays(rec) : 0; }
    let sm2PanelOpen = false;
    function renderSm2InfoBar() { if (window.Sm2Review) window.Sm2Review.renderInfoBar(current, sm2); }
    function rebaselineSm2(idx, score) { if (window.Sm2Review) window.Sm2Review.rebaseline(idx, score, sm2, saveSm2); }
    function toggleSm2Panel() {
      if (window.Sm2Review) {
        window.Sm2Review.togglePanel();
        sm2PanelOpen = window.Sm2Review.isPanelOpen();
      }
    }
    function closeSm2Panel() {
      if (window.Sm2Review) {
        window.Sm2Review.closePanel();
        sm2PanelOpen = window.Sm2Review.isPanelOpen();
      }
    }
    function renderSm2Panel() { if (window.Sm2Review) window.Sm2Review.renderPanel(); }
    function startReviewChapter(cid) { if (window.Sm2Review) window.Sm2Review.startChapter(cid); }
    function startReviewModule(mod) { if (window.Sm2Review) window.Sm2Review.startModule(mod); }
    function startAllReview() { if (window.Sm2Review) window.Sm2Review.startAll(); }
    function resumeReviewSession() { if (window.Sm2Review) window.Sm2Review.resumeSession(); }
    function gradeCurrentReview(score) { if (window.Sm2Review) window.Sm2Review.gradeCurrent(score); }
    function reviewPrev() { if (window.Sm2Review) window.Sm2Review.reviewPrev(); }
    function reviewNext() { if (window.Sm2Review) window.Sm2Review.reviewNext(); }
    function reviewJump(i) { if (window.Sm2Review) window.Sm2Review.reviewJump(i); }
    function reviewSkip() { if (window.Sm2Review) window.Sm2Review.reviewSkip(); }
    function exitReviewSession() { if (window.Sm2Review) window.Sm2Review.exitSession(); }
    document.addEventListener('keydown', function (e) {
      // 标注模式下吃掉全部按键（Snipaste 式：避免切题/改状态等全局快捷键误触发）。
      // 需在 INPUT 判断之前：标注工具栏含 range 输入（粗细滑块），焦点在其上时 Alt 退出仍须生效。
      if (lbAnnotMode) { handleAnnotKeydown(e); return; }

      // 认知思维导图沉浸视图独占拦截（z-index: 11000）：
      // 当 O 键唤起的认知思维导图处于打开态时，主刷题系统的所有快捷键（切题、掌握度1-5、Space解析、Ctrl+Z撤销、面板H/M/V/B/G等）全部静默隔离，
      // 仅交由 CognitiveViewController.handleHostKeydown 协调导图组件与 O / Esc 分层级退出。
      if (window.CognitiveViewController && window.CognitiveViewController.isOpen()) {
        if (typeof window.CognitiveViewController.handleHostKeydown === 'function') {
          if (window.CognitiveViewController.handleHostKeydown(e)) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
        return;
      }

      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      const key = e.key.toLowerCase();
      const isShift = e.shiftKey;

      // 英语科目处于激活态时，由 english_app.js 接管做题按键，主系统放行系统级按键（G / Esc / Y / U / O）
      if (curSubjectId === 'english' || (curSubject && curSubject.type === 'english')) {
        if (key === 'g') {
          if (subjectPickerOpen) closeSubjectPicker();
          else openSubjectPicker();
        } else if (key === 'escape' && subjectPickerOpen) {
          closeSubjectPicker();
        } else if (key === 'y') {
          toggleTheme();
        } else if (key === 'u') {
          toggleImageDarkFilter();
        } else if (key === 'o') {
          e.preventDefault();
          triggerOpenCognitiveView();
        }
        return;
      }

      // 1. 灯箱层级拦截（z-index: 20000 顶层视觉独占权）：
      // 只要灯箱处于打开态，无论其是从主界面、错题本还是从 L 模态框唤起，
      // 必须优先由灯箱独占拦截（Esc 关闭灯箱、+/=/0 缩放、Alt 进入标注），
      // 绝对禁止任何按键（如 Esc/Space/A/D/Enter）穿透至底层的 relatedModal 或做题区！
      const lbEl = document.getElementById('lightbox');
      const isLbShown = lbEl && lbEl.classList.contains('show');
      if (isLbShown) {
        if (e.key === 'Alt' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          openAnnotator();
          return;
        }
        if (key === 'escape') {
          e.preventDefault();
          closeLightbox();
          return;
        }
        if (key === '+' || key === '=') {
          e.preventDefault();
          lbScale = Math.min(lbScale * 1.2, 5);
          lbApplyTransform();
          return;
        }
        if (key === '-') {
          e.preventDefault();
          lbScale = Math.max(lbScale / 1.2, 0.5);
          lbApplyTransform();
          return;
        }
        if (key === '0') {
          e.preventDefault();
          lbScale = 1; lbTranslateX = 0; lbTranslateY = 0;
          lbApplyTransform();
          return;
        }
        // 灯箱打开时，吞掉其他全部操作键，彻底杜绝底层状态泄露
        return;
      }

      // 2. 复习完成结算战报弹窗独占拦截（z-index: 10005）：
      if (window.isReviewSummaryOpen && window.isReviewSummaryOpen()) {
        if (key === 'escape') {
          e.preventDefault();
          if (typeof window.closeReviewSummaryModal === 'function') window.closeReviewSummaryModal();
          return;
        }
        if (key === 'enter') {
          e.preventDefault();
          if (typeof window.nextReviewSummarySprint === 'function') window.nextReviewSummarySprint();
          return;
        }
        return;
      }

      // 2.5 全局统一确认模态弹窗独占拦截（z-index: 10600）：
      const confirmModal = document.getElementById('confirmModal');
      if (confirmModal && confirmModal.style.display !== 'none') {
        if (key === 'escape') {
          e.preventDefault();
          e.stopPropagation();
          if (typeof window.closeConfirmModal === 'function') window.closeConfirmModal(false);
          return;
        }
        if (key === 'enter') {
          e.preventDefault();
          e.stopPropagation();
          if (typeof window.closeConfirmModal === 'function') window.closeConfirmModal(true);
          return;
        }
        return;
      }

      // 3. 考点重命名模态弹窗（z-index: 10500）
      if (topicRenameModalOpen) {
        if (key === 'escape') {
          e.preventDefault();
          closeRenameTopicModal();
        }
        return;
      } else if (subjectPickerOpen) {
        // 4. 科目选择弹窗（z-index: 12000）：放行 G（切换）、Esc（关闭）、Y（主题）、U（暗化）
        if (key !== 'g' && key !== 'escape' && key !== 'y' && key !== 'u') return;
      } else if (relatedModalOpen) {
        // 5. 同类题做题工作台内部快捷键接管（z-index: 10000）：
        // A/Left 上一题，D/Right 下一题，W/Up 上排，S/Down 下排，Space 切换解析，Enter 关联/移出，L/Esc 关闭
        if (key === 'a' || key === 'arrowleft' || key === 'k' || key === 'pageup') {
          e.preventDefault();
          modalPickerPrevQ();
          return;
        }
        if (key === 'd' || key === 'arrowright' || key === 'j' || key === 'pagedown') {
          e.preventDefault();
          modalPickerNextQ();
          return;
        }
        if (key === 'w' || key === 'arrowup') {
          e.preventDefault();
          modalPickerUpQ();
          return;
        }
        if (key === 's' || key === 'arrowdown') {
          e.preventDefault();
          modalPickerDownQ();
          return;
        }
        if (key === ' ') {
          e.preventDefault();
          toggleModalPickerSol();
          return;
        }
        if (key === 'enter') {
          e.preventDefault();
          toggleModalPickerLinkCurrent();
          return;
        }
        if (key === 'l' || key === 'escape') {
          e.preventDefault();
          closeRelatedModal();
          return;
        }
        if (key !== 'y' && key !== 'u') return;
      } else if (dashboardOpen || wrongBookOpen || shortcutHelpOpen || sm2PanelOpen) {
        const panelKeys = ['h', 'escape', 'g', 'y', 'u', 'o'];
        if (dashboardOpen || wrongBookOpen) panelKeys.push('v', 'b');
        if (sm2PanelOpen) panelKeys.push('m');
        if (!panelKeys.includes(key)) return;
      }

      // Alt：进入标注（进入/退出标注的快捷键；仅灯箱打开时生效）
      if (e.key === 'Alt' && !e.ctrlKey && !e.metaKey) {
        const lbEl = document.getElementById('lightbox');
        if (lbEl && lbEl.classList.contains('show')) {
          e.preventDefault();
          openAnnotator();
        }
        return;
      }

      // Ctrl+Z：撤销最近一次掌握度标记
      if ((e.ctrlKey || e.metaKey) && key === 'z' && !isShift) {
        e.preventDefault();
        undoLastMark();
        return;
      }

      // Shift 筛选快捷键
      if (isShift) {
        switch (key) {
          case 'a': e.preventDefault(); applyFilter('all'); return;
          case 'z': e.preventDefault(); applyFilter('proficient'); return;
          case 'x': e.preventDefault(); applyFilter('vague'); return;
          case 'c': e.preventDefault(); applyFilter('wrong'); return;
          case 'n': e.preventDefault(); applyFilter('unmarked'); return;
          case ' ': e.preventDefault(); toggleDefaultSolution(); return;
        }
      }

      // 灯箱打开（未处于标注模式）时：只放行灯箱自己的快捷键（Esc 关闭、+/=/0 缩放），
      // 屏蔽切题/改状态等全局快捷键，避免在放大查看图片时背后静默切换题目。
      if (document.getElementById('lightbox').classList.contains('show')) {
        if (key === 'escape') { closeLightbox(); return; }
        // +、=、-、0 在下方 switch 中按灯箱缩放处理
        if (key !== '+' && key !== '=' && key !== '-' && key !== '0') return;
      }

      // 带修饰键（Ctrl / Alt / Cmd）的普通键不放行：避免 Ctrl+A、Ctrl+W、Alt+A 等误触发放大/切题/改状态
      // （Shift 组合已在上方处理；Alt 进入标注已在前面单独处理）
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // 非 Z/X/C 键按下时，打断待处理的组合超时（避免导航/面板等操作后意外改标记）
      if (key !== 'z' && key !== 'x' && key !== 'c') resetCombo();
      // 非 R/T 键按下时，打断待处理的 R+T 组合超时
      if (key !== 'r' && key !== 't') resetRtCombo();

      // 掌握度数字快捷键（数字 1-5 对应熟练到不会：1熟练, 2较熟练, 3模糊, 4困难, 5不会，支持主键盘与小键盘）
      if (!isShift) {
        if (key === '1' || e.code === 'Digit1' || e.code === 'Numpad1') { e.preventDefault(); setStatus('proficient'); return; }
        if (key === '2' || e.code === 'Digit2' || e.code === 'Numpad2') { e.preventDefault(); setStatus('familiar'); return; }
        if (key === '3' || e.code === 'Digit3' || e.code === 'Numpad3') { e.preventDefault(); setStatus('vague'); return; }
        if (key === '4' || e.code === 'Digit4' || e.code === 'Numpad4') { e.preventDefault(); setStatus('rusty'); return; }
        if (key === '5' || e.code === 'Digit5' || e.code === 'Numpad5') { e.preventDefault(); setStatus('wrong'); return; }
      }

      switch (key) {
        // 上一题 / 下一题（题组级 / 子题级，见 navPrev / navNext）
        case 'a': case 'arrowleft': case 'k': case 'pageup': navPrev(); break;
        case 'd': case 'arrowright': case 'j': case 'pagedown': navNext(); break;
        // 小题选择模式
        case 'f': toggleSubMode(); break;
        // 上一行 / 下一行（视觉网格行导航）
        case 'w': case 'arrowup': navUp(); break;
        case 's': case 'arrowdown': navDown(); break;
        // 掌握度（组合键）
        case 'z': case 'x': case 'c': e.preventDefault(); handleStatusKey(key); break;
        // 解析
        case ' ': e.preventDefault(); toggleSolution(); break;
        // 章节切换（复习中 Q/E = 上一/下一复习题）
        case 'q': if (reviewSession) reviewPrev(); else gotoPrevChapter(); break;
        case 'e': if (reviewSession) reviewNext(); else gotoNextChapter(); break;
        // 图片质量与实书不符标记（R / T / R+T 组合键）
        case 'r': case 't': e.preventDefault(); handleBadKey(key); break;
        // 笔记与帮助
        case 'n': e.preventDefault(); focusNotes(); break;
        case 'h': toggleShortcutHelp(); break;
        // 全局进度 / 错题本 / 间隔重复
        case 'v': toggleDashboard(); break;
        case 'b': toggleWrongBook(); break;
        case 'm': toggleSm2Panel(); break;
        // 同类题关联面板与认知视图
        case 'l': if (relatedModalOpen) closeRelatedModal(); else openRelatedModal(); break;
        case 'o':
          e.preventDefault();
          triggerOpenCognitiveView();
          break;
        // 切换科目与主题与试卷暗化与侧栏/符号盘折叠
        case 'i': toggleLeftSidebar(); break;
        case 'p': toggleMathSymbolPalette(); break;
        case 'g': openSubjectPicker(); break;
        case 'y': toggleTheme(); break;
        case 'u': toggleImageDarkFilter(); break;
        // 灯箱快捷键
        // Esc 严格按照视觉 z-index 倒序层级关闭，坚决杜绝层间穿透泄露
        case 'escape':
          // 0. 认知视图沉浸浮层 (z-index 11000)
          if (window.CognitiveViewController && window.CognitiveViewController.isOpen()) {
            window.CognitiveViewController.close();
            return;
          }
          // 1. 快速关联考点下拉浮层
          var quickPop = document.getElementById('quickTopicPopover');
          if (quickPop && quickPop.style.display !== 'none') {
            closeQuickTopicPopover();
            return;
          }
          // 2. 考点重命名弹窗 (z-index 10500)
          if (topicRenameModalOpen) { closeRenameTopicModal(); return; }
          // 3. 复习结算战报弹窗 (z-index 10005)
          if (window.isReviewSummaryOpen && window.isReviewSummaryOpen()) {
            if (typeof window.closeReviewSummaryModal === 'function') window.closeReviewSummaryModal();
            return;
          }
          // 4. 灯箱大图 (z-index 20000)
          if (document.getElementById('lightbox').classList.contains('show')) { closeLightbox(); return; }
          // 5. 科目选择器与快捷键帮助 (z-index 12000)
          if (subjectPickerOpen) { closeSubjectPicker(); return; }
          if (shortcutHelpOpen) { toggleShortcutHelp(); return; }
          // 6. 同类题关联工作台 (z-index 10000)
          if (relatedModalOpen) { closeRelatedModal(); return; }
          // 7. 笔记双栏编辑态（输入框失焦后按 Esc 取消编辑并恢复常驻查看）
          var notesDuoEl = document.getElementById('notesDuo');
          if (notesDuoEl && notesDuoEl.style.display !== 'none') {
            if (typeof cancelNoteEdit === 'function') cancelNoteEdit();
            return;
          }
          // 8. 页面常驻面板（SM-2 队列面板、全局仪表盘、错题本）
          if (sm2PanelOpen) { closeSm2Panel(); return; }
          if (dashboardOpen) { toggleDashboard(); return; }
          if (wrongBookOpen) { toggleWrongBook(); return; }
          // 9. 进行中的复习会话 (退出复习并恢复题号断点)
          if (reviewSession) { exitReviewSession(); return; }
          break;
        case '=':
        case '+': if (document.getElementById('lightbox').classList.contains('show')) { lbScale = Math.min(lbScale * 1.2, 5); lbApplyTransform(); return; } break;
        case '-': if (document.getElementById('lightbox').classList.contains('show')) { lbScale = Math.max(lbScale / 1.2, 0.5); lbApplyTransform(); return; } break;
        case '0': if (document.getElementById('lightbox').classList.contains('show')) { lbScale = 1; lbTranslateX = 0; lbTranslateY = 0; lbApplyTransform(); return; } break;
      }
    });

    // ===== 滚轮切题与切章手势 =====
    // 1. 右键 + 滚轮：等效 Q / E（上/下一章，复习中为上/下一复习题）
    //    支持垂直滚轮 (上滚 Q，下滚 E) 与横向滚轮 (左推 Q，右推 E)，带 250ms 锁防止连续误翻
    // 2. 常规横向滚轮：等效 A / D（上/下一题）
    let _isRightMouseDown = false;
    let _suppressNextContextMenu = false;

    document.addEventListener('mousedown', function (e) {
      if (e.button === 2) _isRightMouseDown = true;
    }, true);

    document.addEventListener('mouseup', function (e) {
      if (e.button === 2) {
        _isRightMouseDown = false;
        _rwAccum = 0;
        _rwLocked = false;
        if (_rwTimer) { clearTimeout(_rwTimer); _rwTimer = null; }
        if (_suppressNextContextMenu) {
          setTimeout(function () { _suppressNextContextMenu = false; }, 200);
        }
      }
    }, true);

    window.addEventListener('blur', function () {
      _isRightMouseDown = false;
      _suppressNextContextMenu = false;
      _rwAccum = 0;
      _rwLocked = false;
      if (_rwTimer) { clearTimeout(_rwTimer); _rwTimer = null; }
    });

    // 拦截右键+滚轮手势触发后的 contextmenu，避免手势结束后弹出系统右键菜单
    document.addEventListener('contextmenu', function (e) {
      if (_suppressNextContextMenu) {
        e.preventDefault();
        e.stopPropagation();
        _suppressNextContextMenu = false;
      }
    }, true);

    let _rwAccum = 0, _rwLocked = false, _rwTimer = null;
    let _wDir = null, _wAccum = 0, _wLocked = false, _wTimer = null, _wIsMouse = false;

    document.addEventListener('wheel', function (e) {
      if (lbAnnotMode) return;
      if (window.CognitiveViewController && window.CognitiveViewController.isOpen()) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
      // 英语科目下禁止触发数学切题与切章（彻底防止跨学科穿透）
      if (curSubjectId === 'english' || (curSubject && curSubject.type === 'english')) return;
      if (subjectPickerOpen || dashboardOpen || wrongBookOpen || shortcutHelpOpen || sm2PanelOpen || relatedModalOpen || topicRenameModalOpen) return;
      if (window.isReviewSummaryOpen && window.isReviewSummaryOpen()) return;
      if (document.getElementById('lightbox').classList.contains('show')) return;
      // 侧栏与悬浮面板滚轮隔离：在左侧栏、右侧栏、题号区、符号盘或任何弹窗内部滑动时，绝不触发中央切题手势
      if (e.target.closest && e.target.closest('.sidebar-right, .sidebar-left, .qnav-container, .qnav, .math-symbol-palette, .chapter-selector, .filter-toolbar, .export-section, .related-modal-card, .quick-topic-popover, #mathSymbolPalette, .review-summary-modal, .review-summary-overlay, #cognitiveModal')) return;

      const dx = e.deltaX || 0, dy = e.deltaY || 0;
      const isRightClick = ((e.buttons & 2) !== 0) || _isRightMouseDown;

      // ===== 右键 + 滚轮（等效 Q / E 键） =====
      if (isRightClick) {
        e.preventDefault();
        _suppressNextContextMenu = true;

        if (_rwLocked) return;

        // 取绝对值主导方向的增量（垂直优先或横向）
        const delta = Math.abs(dy) >= Math.abs(dx) ? dy : dx;
        _rwAccum += delta;

        if (Math.abs(_rwAccum) >= 20) {
          if (_rwAccum > 0) {
            // 滚轮向下 / 向右：下一章 / 复习中下一题 (E)
            if (reviewSession) reviewNext();
            else gotoNextChapter();
          } else {
            // 滚轮向上 / 向左：上一章 / 复习中上一题 (Q)
            if (reviewSession) reviewPrev();
            else gotoPrevChapter();
          }
          _rwLocked = true;
          _rwAccum = 0;
          if (_rwTimer) clearTimeout(_rwTimer);
          _rwTimer = setTimeout(function () {
            _rwLocked = false;
            _rwTimer = null;
          }, 140);
        }
        return;
      }

      // ===== 常规横向滚轮（等效 A / D 键） =====
      const absDX = Math.abs(dx), absDY = Math.abs(dy);

      // 重置计时器：每次新事件都推迟 reset
      if (_wTimer) clearTimeout(_wTimer);
      _wTimer = setTimeout(function () {
        _wDir = null; _wAccum = 0; _wLocked = false; _wTimer = null; _wIsMouse = false;
      }, 300);

      if (_wLocked) return;

      // 方向未确定：哪个方向明显主导即锁定；同时标记设备类型
      if (_wDir === null) {
        if (absDX > absDY * 1.5 && absDX > 4) {
          _wDir = 'h';
          _wIsMouse = absDX >= 50; // 单次大增量 = 鼠标滚轮
        }
        else if (absDY > absDX * 1.5 && absDY > 4) { _wDir = 'v'; }
        else return; // 方向不明确，继续观察
      }

      if (_wDir === 'v') return; // 纵向手势，整段忽略

      // 横向手势：累积 dx，达标即切
      _wAccum += dx;
      if (Math.abs(_wAccum) > 15) {
        if (_wIsMouse) {
          // 鼠标滚轮：右滚→下一题
          if (_wAccum > 0) navNext();
          else navPrev();
        } else {
          // 触控板：右滑→上一题
          if (_wAccum > 0) navPrev();
          else navNext();
        }
        _wLocked = true;
        _wAccum = 0;
      }
    }, { passive: false });

    // ===== 初始化 =====
    // 读取 URL 参数或上次选择的科目（默认数学），加载其章节数组
    var urlParams = new URLSearchParams(window.location.search);
    var urlSubj = urlParams.get('subj');
    var rawSaved = (urlSubj && SUBJECTS.some(function (s) { return s.id === urlSubj; })) ? urlSubj : (window.StorageEngine && window.StorageEngine.GlobalStore ? window.StorageEngine.GlobalStore.get('subject') : null);
    var savedSubject = rawSaved || 'math';
    curSubjectId = (savedSubject && SUBJECTS.some(function (s) { return s.id === savedSubject; })) ? savedSubject : 'math';
    window.curSubjectId = curSubjectId;
    
    if (curSubjectId === 'english') {
      curSubject = SUBJECTS.find(function (s) { return s.id === curSubjectId; });
      CHAPTERS = [];
      document.addEventListener('DOMContentLoaded', function () {
        switchSubject(curSubjectId);
      });
    } else {
      curSubject = SUBJECTS.find(function (s) { return s.id === curSubjectId; });
      CHAPTERS = curSubject.chapters;
      // 恢复上次停的章节/题目/小题模式（无记录时从该科目默认章节第 1 题开始）
      var resume = loadResume(curSubjectId);
      var globalSubMode = (window.StorageEngine && window.StorageEngine.GlobalStore)
        ? window.StorageEngine.GlobalStore.get('sub_mode')
        : null;
      if (globalSubMode !== null && globalSubMode !== undefined) {
        subMode = !!globalSubMode;
      } else if (resume && resume.sub !== undefined) {
        subMode = !!resume.sub;
      } else {
        subMode = false;
      }

      if (resume) {
        var hostCh = curSubject.chapters.find(function(c) { return c.q1000Id === resume.ch; });
        if (hostCh) {
          currentChapterId = hostCh.id;
          current = Math.min((hostCh.total || 1) - 1, (hostCh.ownTotal || 0) + (resume.idx || 0));
        } else {
          currentChapterId = resume.ch;
          current = resume.idx;
        }
      } else {
        currentChapterId = curSubject.initChapterId;
        current = 0;
      }

      loadGlobalFilters(); loadSolutionPref(); // 恢复筛选状态与解析默认（解析默认按科目）
      loadStatuses(); loadQBad(); loadSBad(); loadBookMismatch(); loadNotes(); loadSm2(); loadRelatedTopics();
      // 若恢复的筛选状态激活且当前题被筛掉，跳到第一条筛中题，避免落在不可见题上
      if (!isAllFilterActive()) {
        const filtered = getFilteredIndices();
        if (filtered.length > 0 && filtered.indexOf(current) === -1) current = filtered[0];
      }
      renderTitle();
      renderStats();
      renderNav(); switchTo(current); updateFilterCounts();
      updateFilterButtons(); // 恢复筛选按钮高亮（需在 renderNav 之后，按钮已重建）
      renderSolDefaultBtn(); updateSolutionUI();
    }
    // DOM 就绪后初始化主题、倒计时与事件绑定
    document.addEventListener('DOMContentLoaded', function () {
      applyTheme(currentTheme || 'light');
      renderCountdown();
      initRelatedModal();

      var btnTheme = document.getElementById('btnToggleTheme');
      if (btnTheme) btnTheme.onclick = toggleTheme;
      // 首次加载（无已选科目）弹出科目选择
      if (!savedSubject) openSubjectPicker();

      // 检查并恢复未完成的复习会话
      try {
        if (typeof resumeReviewSession === 'function') {
          resumeReviewSession();
        } else if (window.Sm2Review && typeof window.Sm2Review.resumeSession === 'function') {
          window.Sm2Review.resumeSession();
        }
      } catch (e) {}

      // 支持从考点工作台携带 jumpQid 直接定位至目标题目
      var urlJumpQid = urlParams.get('jumpQid');
      if (urlJumpQid) {
        setTimeout(function () {
          if (typeof window.jumpToQid === 'function') {
            window.jumpToQid(decodeURIComponent(urlJumpQid), false);
          }
        }, 150);
      }
    });

    // 暴露核心刷新与读取方法至 window，供本地同步模块与英语模块触发联动
    window.loadStatuses = loadStatuses;
    window.loadQBad = loadQBad;
    window.loadSBad = loadSBad;
    window.loadBookMismatch = loadBookMismatch;
    window.loadNotes = loadNotes;
    window.loadAnnotations = loadAnnotations;
    window.loadSm2 = loadSm2;
    window.loadRelatedTopics = loadRelatedTopics;
    window.renderRelatedQuestions = renderRelatedQuestions;
    window.openRelatedModal = openRelatedModal;
    window.closeRelatedModal = closeRelatedModal;
    window.switchChapter = switchChapter;
    window.jumpToQid = jumpToQid;
    window.loadGlobalFilters = loadGlobalFilters;
    window.loadSolutionPref = loadSolutionPref;
    window.renderStats = renderStats;
    window.renderNav = renderNav;
    window.renderNotes = renderNotes;
    window.updateFilterCounts = updateFilterCounts;
    window.renderSm2InfoBar = renderSm2InfoBar;
    window.renderCountdown = renderCountdown;
    window.toggleTheme = toggleTheme;
    window.applyTheme = applyTheme;
    window.toggleImageDarkFilter = toggleImageDarkFilter;
    window.switchTo = switchTo;
    window.openSubjectPicker = openSubjectPicker;
    window.closeSubjectPicker = closeSubjectPicker;
    window.escapeHtml = escapeHtml;
    window.autoSaveNotes = autoSaveNotes;
    window.openLightbox = openLightbox;
    window.notifyStorageSync = notifyStorageSync;
    window.ensureGroups = ensureGroups;
    window.partOfIdx = partOfIdx;
    window.getPartOrder = getPartOrder;
    window.getWbLabel = getWbLabel;
    window.renderNotesMarkdown = renderNotesMarkdown;
    window.getChapter = getChapter;
    window.setPanelTitle = setPanelTitle;
    window.readMergedSm2 = readMergedSm2;
    window.writeMergedSm2 = writeMergedSm2;
    window.saveSm2 = saveSm2;
    window.chapterById = chapterById;
    window.refreshPageOverlays = refreshPageOverlays;
    window.renderTitle = renderTitle;
    window.getSortedWbs = getSortedWbs;
    window.baseSubject = baseSubject;
    window.toggleWrongBook = toggleWrongBook;
    window.toggleDashboard = toggleDashboard;
    window.switchChapter = switchChapter;
    window.safeLSSet = safeLSSet;
    window.toggleSubMode = toggleSubMode;

    function defGlobalProp(name, getter, setter) {
      try {
        Object.defineProperty(window, name, {
          get: getter,
          set: setter,
          configurable: true,
          enumerable: true
        });
      } catch (err) {
        console.error('[GlobalSync] defineProperty failed for ' + name + ':', err);
      }
    }

    defGlobalProp('current', function () { return current; }, function (v) { current = v; });
    defGlobalProp('currentChapterId', function () { return currentChapterId; }, function (v) { currentChapterId = v; });
    defGlobalProp('currentTheme', function () { return currentTheme; }, function (v) { currentTheme = v; });
    defGlobalProp('darkImageFilter', function () { return darkImageFilter; }, function (v) { darkImageFilter = !!v; });
    defGlobalProp('subjectPickerOpen', function () { return subjectPickerOpen; }, function (v) { subjectPickerOpen = !!v; });
    defGlobalProp('dashboardOpen', function () { return dashboardOpen; }, function (v) { dashboardOpen = !!v; });
    defGlobalProp('wrongBookOpen', function () { return wrongBookOpen; }, function (v) { wrongBookOpen = !!v; });
    defGlobalProp('subMode', function () { return subMode; }, function (v) { subMode = !!v; });
    defGlobalProp('sm2PanelOpen', function () {
      return (window.Sm2Review && typeof window.Sm2Review.isPanelOpen === 'function')
        ? window.Sm2Review.isPanelOpen()
        : sm2PanelOpen;
    }, function (v) { sm2PanelOpen = !!v; });
  