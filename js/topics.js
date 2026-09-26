/**
 * 考研题库 · 考点主题管理、双向亲密度与同类题图谱模块 (TopicManager)
 *
 * 职责：
 *   1. 考点主题 (Topics) 与二级子考点 (SubTopics) 的创建、重命名、合并与题目关联。
 *   2. 题目间双向无向亲密度 (Affinity) 计算与自定义优先级排序。
 *   3. 题目唯一标识符 (QID) 编解码与跨科目/跨书籍元数据路由。
 *   4. 同类题关系图谱模态框 (relatedModal)、考点重命名模态框 (topicRenameModal) 与手势隔离。
 */

(function () {
  'use strict';

    // ===== 同类题与跨书双向关联管理系统 =====
    var relatedTopics = {};
    var relatedAffinity = { pairs: {}, customOrders: {} };
    var recentQuestionsHistory = [];
    var jumpReturnStack = [];
    var relatedModalOpen = false;
    var topicRenameModalOpen = false;
    var _topicsLoaded = false;

    // 安全 HTML 转义函数
    var escapeHtml = (typeof window.escapeHtml === 'function') ? window.escapeHtml : function(str) {
      if (str === undefined || str === null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    function getWbForChapter(ch) {
      if (!ch) return '';
      return ch.wb || ch.book || '';
    }

    function closeQuickTopicPopover() {
      var pop = document.getElementById('quickTopicPopover');
      if (pop) pop.style.display = 'none';
    }

    // 1. QID 编解码与元数据工具
    function normalizeSubjectId(sid) {
      if (sid === 'shu1') return 'math';
      return sid || 'math';
    }

    function chapterById(id) {
      if (!id) return null;
      if (typeof window !== 'undefined' && typeof window.chapterById === 'function') {
        return window.chapterById(id);
      }
      var list = (typeof window !== 'undefined' && window.SUBJECTS) ? window.SUBJECTS : (typeof SUBJECTS !== 'undefined' ? SUBJECTS : []);
      for (var i = 0; i < list.length; i++) {
        var sub = list[i];
        if (sub && sub.chapters) {
          for (var j = 0; j < sub.chapters.length; j++) {
            var c = sub.chapters[j];
            if (c.id === id || c.uid === id) return c;
          }
        }
      }
      return null;
    }

    function getQid(subjId, chId, idx) {
      var sid = normalizeSubjectId(subjId || (typeof curSubjectId !== 'undefined' ? curSubjectId : (typeof window !== 'undefined' ? window.curSubjectId : 'math')));
      var effectiveChId = chId || (typeof currentChapterId !== 'undefined' ? currentChapterId : (typeof window !== 'undefined' ? window.currentChapterId : ''));
      var effectiveIdx = (typeof idx !== 'undefined') ? idx : (typeof current !== 'undefined' ? current : (typeof window !== 'undefined' ? window.current : 0));
      var ch = chapterById(effectiveChId);
      if (ch) {
        // 伴章路由：若属于合并章节中的伴章段（如 1000 题），生成其真实所属书籍的规范 QID
        if (ch.q1000Total && effectiveIdx >= ch.ownTotal && ch.q1000Id) {
          var qc = chapterById(ch.q1000Id);
          if (qc && qc.uid) {
            var q1000Idx = effectiveIdx - ch.ownTotal;
            var qSlug = qc.getQuestionSlug ? qc.getQuestionSlug(q1000Idx) : null;
            if (qSlug) return qc.uid + '::' + qSlug;
          }
        }
        if (ch.uid) {
          var slug = ch.getQuestionSlug ? ch.getQuestionSlug(effectiveIdx) : null;
          if (slug) return ch.uid + '::' + slug;
        }
      }
      return sid + '::' + effectiveChId + '::' + effectiveIdx;
    }

    function getCurrentQid() {
      var sid = (typeof curSubjectId !== 'undefined') ? curSubjectId : ((typeof window !== 'undefined' && window.curSubjectId) ? window.curSubjectId : 'math');
      var cid = (typeof currentChapterId !== 'undefined') ? currentChapterId : ((typeof window !== 'undefined' && window.currentChapterId) ? window.currentChapterId : '');
      var cIdx = (typeof current !== 'undefined') ? current : ((typeof window !== 'undefined' && typeof window.current !== 'undefined') ? window.current : 0);
      return getQid(sid, cid, cIdx);
    }

    function parseQid(qid) {
      if (!qid || typeof qid !== 'string') return null;
      var parts = qid.split('::');
      // Format 1: 语义化 Canonical QID: <subjectId>::<book>::<discipline>::<chapterSlug>::<questionSlug> (>= 5 parts)
      if (parts.length >= 5) {
        var sid = normalizeSubjectId(parts[0]);
        var chapterUid = parts.slice(0, 4).join('::');
        var questionSlug = parts[4];
        var ch = chapterById(chapterUid);
        if (ch) {
          var idx = ch.getIdxBySlug ? ch.getIdxBySlug(questionSlug) : -1;
          return {
            subjectId: sid,
            chapterId: ch.id,
            chapterUid: ch.uid,
            idx: idx >= 0 ? idx : 0,
            qIdx: idx >= 0 ? idx : 0,
            questionSlug: questionSlug,
            canonicalQid: ch.uid + '::' + questionSlug,
            isSemantic: true
          };
        }
      }
      // Format 2: 传统数字 QID: <subjectId>::<chapterId>::<idxOrSlug> (3 parts)
      if (parts.length === 3) {
        var sid = normalizeSubjectId(parts[0]);
        var cid = parts[1];
        var ch = chapterById(cid);
        var idxOrSlug = parts[2];
        var idx = parseInt(idxOrSlug, 10);
        if (isNaN(idx) && ch && ch.getIdxBySlug) {
          idx = ch.getIdxBySlug(idxOrSlug);
        }
        var slug = (ch && ch.getQuestionSlug && !isNaN(idx)) ? ch.getQuestionSlug(idx) : idxOrSlug;
        return {
          subjectId: sid,
          chapterId: cid,
          chapterUid: ch ? ch.uid : null,
          idx: !isNaN(idx) ? idx : 0,
          qIdx: !isNaN(idx) ? idx : 0,
          questionSlug: slug,
          canonicalQid: (ch && ch.uid && slug) ? (ch.uid + '::' + slug) : qid
        };
      }
      return null;
    }

    function getQuestionMeta(qid) {
      var parsed = parseQid(qid);
      if (!parsed) return null;

      var subj = SUBJECTS.find(function(s) { return s.id === parsed.subjectId; });
      if (!subj) return null;

      var ch = chapterById(parsed.chapterUid || parsed.chapterId);
      if (!ch) return null;

      var idx = parsed.idx;
      var label = (ch.labels && ch.labels[idx]) ? ch.labels[idx] : '#' + (idx + 1);
      var slug = parsed.questionSlug || (ch.getQuestionSlug ? ch.getQuestionSlug(idx) : null);

      // 读取该题当前掌握度状态与真实做题笔记 (通过规范 SSOT 存储引擎 ChapterStore 读取)
      var status = null;
      var questionNote = null;
      try {
        if (window.StorageEngine && window.StorageEngine.ChapterStore && ch && ch.uid && slug) {
          var store = new window.StorageEngine.ChapterStore(ch);
          var qData = store.getQuestion(slug);
          if (qData) {
            if (qData.status) status = qData.status;
            if (qData.notes) questionNote = qData.notes;
          }
        }
      } catch (e) {}

      var book = ch.wb || subj.name || '题库';
      var chShort = ch.short || ch.name;
      var displayTitle = book + ' · ' + chShort + ' ' + label;

      return {
        qid: parsed.canonicalQid || (ch.uid && slug ? (ch.uid + '::' + slug) : getQid(parsed.subjectId, ch.id, idx)),
        subjectId: parsed.subjectId,
        subjectName: subj.name,
        chapterId: ch.id,
        chapterUid: ch.uid,
        chapterName: ch.name,
        chapterShort: chShort,
        bookName: book,
        idx: idx,
        qIdx: idx,
        label: label,
        slug: slug,
        status: status,
        questionNote: questionNote,
        displayTitle: displayTitle
      };
    }

    // 2. 同类题数据存储、主题与双向亲密度排序引擎
    function getPairKey(qid1, qid2) {
      if (!qid1 || !qid2) return '';
      return qid1 < qid2 ? (qid1 + '::' + qid2) : (qid2 + '::' + qid1);
    }

    function loadRelatedAffinity() {
      try {
        var obj = null;
        if (window.StorageEngine && window.StorageEngine.GlobalStore) {
          obj = window.StorageEngine.GlobalStore.get('affinity');
        }
        if (obj) {
          relatedAffinity = {
            pairs: (obj && typeof obj.pairs === 'object' && obj.pairs) ? obj.pairs : {},
            customOrders: (obj && typeof obj.customOrders === 'object' && obj.customOrders) ? obj.customOrders : {}
          };
        } else {
          relatedAffinity = { pairs: {}, customOrders: {} };
        }
      } catch (e) {
        relatedAffinity = { pairs: {}, customOrders: {} };
      }
    }

    function saveRelatedAffinity() {
      try {
        if (window.StorageEngine && window.StorageEngine.GlobalStore) {
          window.StorageEngine.GlobalStore.set('affinity', relatedAffinity);
        }
        if (typeof notifyStorageSync === 'function') notifyStorageSync();
      } catch (e) {}
    }

    function loadRelatedTopics() {
      try {
        var rawObj = null;
        if (window.StorageEngine && window.StorageEngine.GlobalStore) {
          rawObj = window.StorageEngine.GlobalStore.get('topics');
        }
        if (!rawObj && typeof localStorage !== 'undefined') {
          try {
            var rawLs = localStorage.getItem('kaoyan.g.topics');
            if (rawLs) rawObj = JSON.parse(rawLs);
          } catch (eLs) {}
        }
        relatedTopics = rawObj || {};
        for (var tid in relatedTopics) {
          var t = relatedTopics[tid];
          if (t && t.members && Array.isArray(t.members)) {
            t.members.forEach(function(m) {
              if (m && m.qid) {
                var p = parseQid(m.qid);
                if (p) m.qid = p.canonicalQid || getQid(p.subjectId, p.chapterId, p.idx);
              }
            });
          }
        }
      } catch (e) {
        relatedTopics = {};
      }
      _topicsLoaded = true;
      invalidateTopicCache();
      loadRelatedAffinity();
    }

    function saveRelatedTopics() {
      invalidateTopicCache();
      if (window.StorageEngine && window.StorageEngine.GlobalStore) {
        window.StorageEngine.GlobalStore.set('topics', relatedTopics);
      }
      if (typeof notifyStorageSync === 'function') notifyStorageSync();
      if (typeof renderNav === 'function') renderNav();
    }

    function parseTopicAndSubTopic(input) {
      if (!input || typeof input !== 'string') return { topicName: '', subTopic: '' };
      return { topicName: input.trim(), subTopic: '' };
    }

    function updateRelatedAffinityOrder(curQid, newOrderedQids) {
      if (!curQid || !Array.isArray(newOrderedQids)) return;
      if (!relatedAffinity.customOrders) relatedAffinity.customOrders = {};
      relatedAffinity.customOrders[curQid] = newOrderedQids.slice();

      if (!relatedAffinity.pairs) relatedAffinity.pairs = {};
      newOrderedQids.forEach(function(targetQid, idx) {
        var pKey = getPairKey(curQid, targetQid);
        if (!pKey) return;
        // 越靠前，双向亲密度分值越高 (首位 +100，依次递减)
        var rankBonus = Math.max(10, 100 - idx * 15);
        relatedAffinity.pairs[pKey] = Math.max((relatedAffinity.pairs[pKey] || 0), rankBonus);
      });

      saveRelatedAffinity();
    }

    function pinRelatedQuestion(curQid, targetQid) {
      if (!curQid || !targetQid) return;
      var data = getRelatedQuestionsForQid(curQid);
      var qids = data.relatedQuestions.map(function(q) { return q.qid; });
      var idx = qids.indexOf(targetQid);
      if (idx !== -1) {
        qids.splice(idx, 1);
        qids.unshift(targetQid);
      } else {
        qids.unshift(targetQid);
      }
      updateRelatedAffinityOrder(curQid, qids);
      renderRelatedQuestions();
      if (window.storageSync && typeof window.storageSync.showToast === 'function') {
        window.storageSync.showToast('已置顶同类题并同步双向优先级', 'success');
      }
    }

    function sortRelatedQuestions(curQid, list) {
      if (!list || list.length <= 1) return list || [];
      var customOrder = (relatedAffinity.customOrders && relatedAffinity.customOrders[curQid]) || [];

      return list.slice().sort(function(a, b) {
        var scoreA = 0;
        var scoreB = 0;

        // 因子 1：当前题目的显式拖拽顺序 (最高优先级)
        var idxA = customOrder.indexOf(a.qid);
        var idxB = customOrder.indexOf(b.qid);
        if (idxA !== -1) scoreA += 10000 - idxA * 100;
        if (idxB !== -1) scoreB += 10000 - idxB * 100;

        // 因子 2：题目对双向亲密度权重 (在另一题中将本题前移时产生双向反向加分)
        var pairKeyA = getPairKey(curQid, a.qid);
        var pairKeyB = getPairKey(curQid, b.qid);
        var affA = (relatedAffinity.pairs && relatedAffinity.pairs[pairKeyA]) || 0;
        var affB = (relatedAffinity.pairs && relatedAffinity.pairs[pairKeyB]) || 0;
        scoreA += affA * 10;
        scoreB += affB * 10;

        // 因子 3：共同考点数量 (+10分)
        var commonCountA = (a.commonTopicIds && a.commonTopicIds.length) || (a.commonTopics && a.commonTopics.length) || ((a.topics && a.topics.length) || 0);
        var commonCountB = (b.commonTopicIds && b.commonTopicIds.length) || (b.commonTopics && b.commonTopics.length) || ((b.topics && b.topics.length) || 0);
        scoreA += commonCountA * 10;
        scoreB += commonCountB * 10;

        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }
        return a.qid.localeCompare(b.qid);
      });
    }

    // 考点排序辅助函数：未设定 order 默认按创建时间 createTime 降序（最新优先），有 order 严格按数值型 order 升序
    function sortTopicsList(list) {
      if (!Array.isArray(list)) return [];
      return list.slice().sort(function(a, b) {
        var hasOrderA = (a && typeof a.order === 'number');
        var hasOrderB = (b && typeof b.order === 'number');
        if (hasOrderA && hasOrderB) return a.order - b.order;
        if (!hasOrderA && hasOrderB) return -1;
        if (hasOrderA && !hasOrderB) return 1;
        var timeA = (a && a.createTime) || 0;
        var timeB = (b && b.createTime) || 0;
        if (timeA !== timeB) return timeB - timeA;
        return (a && a.name ? a.name : '').localeCompare(b && b.name ? b.name : '', 'zh-Hans-CN');
      });
    }

    // ===== 考点主题快速倒排索引与 O(1) 检索缓存 =====
    var _topicQidCache = null;

    function invalidateTopicCache() {
      _topicQidCache = null;
    }

    function getTopicQidIndex() {
      if (!_topicsLoaded) loadRelatedTopics();
      if (_topicQidCache) return _topicQidCache;
      var cache = new Map();
      for (var tid in relatedTopics) {
        if (!Object.prototype.hasOwnProperty.call(relatedTopics, tid)) continue;
        var t = relatedTopics[tid];
        if (t && t.members && Array.isArray(t.members)) {
          for (var i = 0; i < t.members.length; i++) {
            var m = t.members[i];
            if (!m || !m.qid) continue;
            var p = parseQid(m.qid);
            if (!p) continue;
            var norm = getQid(p.subjectId, p.chapterId, p.idx);
            var list = cache.get(norm);
            if (!list) {
              list = [];
              cache.set(norm, list);
            }
            list.push(t);
          }
        }
      }
      cache.forEach(function(list) {
        sortTopicsList(list);
      });
      _topicQidCache = cache;
      return cache;
    }

    function hasTopicsForQid(qid) {
      if (!qid) return false;
      var targetParsed = parseQid(qid);
      if (!targetParsed) return false;
      var targetNormalized = getQid(targetParsed.subjectId, targetParsed.chapterId, targetParsed.idx);
      var index = getTopicQidIndex();
      var list = index.get(targetNormalized);
      return !!(list && list.length > 0);
    }

    function getTopicsForQid(qid) {
      if (!qid) return [];
      var targetParsed = parseQid(qid);
      if (!targetParsed) return [];
      var targetNormalized = getQid(targetParsed.subjectId, targetParsed.chapterId, targetParsed.idx);
      var index = getTopicQidIndex();
      var list = index.get(targetNormalized);
      return list ? list.slice() : [];
    }

    function getRelatedQuestionsForQid(qid) {
      var relatedMap = {};
      var myTopics = getTopicsForQid(qid);

      var targetParsed = parseQid(qid);
      var targetNorm = targetParsed ? (targetParsed.canonicalQid || getQid(targetParsed.subjectId, targetParsed.chapterId, targetParsed.idx)) : qid;

      myTopics.forEach(function(t) {
        if (!t.members) return;
        t.members.forEach(function(m) {
          var mParsed = parseQid(m.qid);
          var mNorm = mParsed ? (mParsed.canonicalQid || getQid(mParsed.subjectId, mParsed.chapterId, mParsed.idx)) : m.qid;
          if (mNorm !== targetNorm) {
            if (!relatedMap[m.qid]) {
              relatedMap[m.qid] = {
                qid: m.qid,
                topics: [t.name],
                topicIds: [t.id || ''],
                topicItems: [{ id: t.id || '', name: t.name }],
                notes: m.note ? [m.note] : []
              };
            } else {
              var item = relatedMap[m.qid];
              if (!item.topicIds) item.topicIds = [];
              if (!item.topics) item.topics = [];
              if (!item.topicItems) item.topicItems = [];

              var exists = item.topicItems.some(function(ti) {
                return (t.id && ti.id === t.id) || ti.name === t.name;
              });
              if (!exists) {
                item.topicIds.push(t.id || '');
                item.topics.push(t.name);
                item.topicItems.push({ id: t.id || '', name: t.name });
              }
              if (m.note && item.notes.indexOf(m.note) === -1) item.notes.push(m.note);
            }
          }
        });
      });

      var list = [];
      for (var k in relatedMap) {
        if (Object.prototype.hasOwnProperty.call(relatedMap, k)) {
          var meta = getQuestionMeta(k);
          if (meta) {
            // 获取该同类题所归属的所有考点（包含共同考点与其它考点）
            var allTopicsForQ = getTopicsForQid(k);
            var commonIds = relatedMap[k].topicIds || [];
            if (allTopicsForQ && allTopicsForQ.length > 0) {
              // 共同考点排在前面，其他考点排在后面
              allTopicsForQ.sort(function(a, b) {
                var aIsCommon = commonIds.indexOf(a.id) !== -1 ? 1 : 0;
                var bIsCommon = commonIds.indexOf(b.id) !== -1 ? 1 : 0;
                return bIsCommon - aIsCommon;
              });
              meta.topics = allTopicsForQ.map(function(t) { return t.name; });
              meta.topicIds = allTopicsForQ.map(function(t) { return t.id; });
              meta.topicItems = allTopicsForQ.map(function(t) {
                return { id: t.id || '', name: t.name, isCommon: commonIds.indexOf(t.id) !== -1 };
              });
            } else {
              meta.topics = relatedMap[k].topics;
              meta.topicIds = relatedMap[k].topicIds;
              meta.topicItems = relatedMap[k].topicItems;
            }
            meta.commonTopicIds = commonIds;
            meta.commonTopics = relatedMap[k].topics;
            meta.note = relatedMap[k].notes.join('；') || meta.questionNote || '';
            list.push(meta);
          }
        }
      }

      // 执行智能多因子排序
      list = sortRelatedQuestions(qid, list);

      return {
        topics: myTopics,
        relatedQuestions: list
      };
    }

    function createRelatedTopic(name, currentQid, note) {
      if (!name || !name.trim()) return null;
      var topicName = name.trim();

      // 检查是否已存在同名考点
      var existingTid = null;
      for (var tid in relatedTopics) {
        if (relatedTopics[tid] && relatedTopics[tid].name && relatedTopics[tid].name.trim() === topicName) {
          existingTid = tid;
          break;
        }
      }

      if (existingTid) {
        if (currentQid) {
          addQuestionToTopic(existingTid, currentQid, note);
        }
        return relatedTopics[existingTid];
      }

      var newTid = 'topic_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      var newTopic = {
        id: newTid,
        name: topicName,
        createTime: Date.now(),
        members: currentQid ? [{ qid: currentQid, note: note || '' }] : []
      };
      relatedTopics[newTid] = newTopic;
      saveRelatedTopics();
      return newTopic;
    }

    function addQuestionToTopic(topicId, qid, note) {
      var t = relatedTopics[topicId];
      if (!t) return false;
      if (!t.members) t.members = [];
      var existing = t.members.find(function(m) { return m.qid === qid; });
      if (!existing) {
        t.members.push({ qid: qid, note: note || '' });
      } else {
        if (note !== undefined && note !== null) existing.note = note;
      }
      saveRelatedTopics();
      return true;
    }

    function removeQuestionFromTopic(topicId, qid) {
      var t = relatedTopics[topicId];
      if (!t || !t.members) return false;
      t.members = t.members.filter(function(m) { return m.qid !== qid; });
      // 保持考点实体持久存在，严禁因题目清零而静默销毁考点！只有用户在考点上明确点击垃圾桶并确认才彻底删除
      saveRelatedTopics();
      return true;
    }

    function recordRecentQuestion(qid) {
      if (!qid) return;
      recentQuestionsHistory = recentQuestionsHistory.filter(function(q) { return q !== qid; });
      recentQuestionsHistory.unshift(qid);
      if (recentQuestionsHistory.length > 10) recentQuestionsHistory.pop();
    }

    // 3. 渲染主界面同类题卡片栏（竖向单列大图排列，支持手动拖拽调序、一键置顶与查看解析）
    function getImgBaseForQid(qid) {
      var target = parseQid(qid);
      if (!target) return '';
      var s = SUBJECTS.find(function(sub) { return sub.id === target.subjectId; });
      if (!s || !s.chapters) return '';
      var ch = chapterById(target.chapterUid || target.chapterId);
      if (!ch || !ch.labels) return '';
      var idx = (target.idx >= 0) ? target.idx : (ch.getIdxBySlug ? ch.getIdxBySlug(target.questionSlug) : -1);
      if (idx < 0 || idx >= ch.labels.length) return '';
      return getImgBaseForSubjectChapterIdx(s, ch, idx);
    }

    function getImgPathForQid(qid) {
      var base = getImgBaseForQid(qid);
      return base ? base + '_question.png' : '';
    }

    function getSolImgPathForQid(qid) {
      var base = getImgBaseForQid(qid);
      return base ? base + '_solution.png' : '';
    }

    function setRelatedCardSolutionImages(base, container, isDarkFilter) {
      if (!container) return;
      container.innerHTML = '';
      if (!base) {
        container.innerHTML = '<span style="font-size:12px;color:var(--text-muted);padding:8px 0;text-align:center;display:block;">暂无解析路径</span>';
        return;
      }
      var loadedCount = 0;
      function tryAdd(n) {
        var src = n === 1 ? base + '_solution.png' : base + '_solution_' + n + '.png';
        var img = document.createElement('img');
        img.alt = '解析' + (n > 1 ? ' (' + n + ')' : '');
        img.title = '点击放大查看高清解析图 (Alt 开启画笔标注)';
        img.style.cursor = 'zoom-in';
        if (isDarkFilter) img.classList.add('dark-filter');
        img.onload = function () {
          loadedCount++;
          container.appendChild(img);
          tryAdd(n + 1);
        };
        img.onerror = function () {
          if (n === 1 && loadedCount === 0 && container.children.length === 0) {
            var ph = document.createElement('span');
            ph.style.cssText = 'font-size:12px;color:var(--text-muted);padding:8px 0;text-align:center;display:block;';
            ph.textContent = '暂无解析图片';
            container.appendChild(ph);
          }
        };
        img.src = src;
      }
      tryAdd(1);
    }

    function renderQuickTopicPopover() {
      if (!_topicsLoaded) loadRelatedTopics();
      var popover = document.getElementById('quickTopicPopover');
      var listEl = document.getElementById('quickTopicList');
      var searchInput = document.getElementById('inputQuickTopicSearch');
      if (!popover || !listEl) return;

      var curQid = getCurrentQid();
      var myTopics = getTopicsForQid(curQid);
      var myTopicIds = myTopics.map(function(t) { return t.id; });
      var query = searchInput ? searchInput.value.trim().toLowerCase() : '';

      var allTopics = [];
      for (var tid in relatedTopics) {
        if (!Object.prototype.hasOwnProperty.call(relatedTopics, tid)) continue;
        var tObj = relatedTopics[tid];
        if (!query || tObj.name.toLowerCase().indexOf(query) !== -1) {
          allTopics.push(tObj);
        }
      }

      // 按自定义 order 与创建时间排序
      allTopics = sortTopicsList(allTopics);

      if (allTopics.length === 0) {
        listEl.innerHTML = '<div style="padding:12px;font-size:12px;color:var(--text-muted);text-align:center;">' +
          (query ? '无匹配考点，点击右侧「新建」' : '暂无考点，输入名称（如“极限计算”）后点击「新建」') +
        '</div>';
        return;
      }

      var canDrag = !query; // 仅在未搜索过滤状态下允许拖拽，防止打乱未筛出的全量顺序
      listEl.innerHTML = allTopics.map(function(t) {
        var isLinked = myTopicIds.indexOf(t.id) !== -1;
        var count = (t.members ? t.members.length : 0);
        return '<div class="qtp-item' + (isLinked ? ' linked' : '') + '" data-tid="' + escapeHtml(t.id) + '"' +
          (canDrag ? ' draggable="true"' : ' draggable="false" title="搜索过滤时不支持排序，清空搜索后可拖拽排序"') + '>' +
          '<div class="qtp-item-left">' +
            (canDrag ? '<span class="qtp-drag-handle" title="按住拖拽排序">⠿</span>' : '') +
            '<span class="qtp-status-icon" style="font-weight:bold;margin-right:2px;">' + (isLinked ? '✓' : '+') + '</span>' +
            '<span class="qtp-name">' + renderTopicTextHtml(t.name) + '</span>' +
          '</div>' +
          '<span class="qtp-item-count">(' + count + '题)</span>' +
        '</div>';
      }).join('');

      var draggedItem = null;
      var draggedTid = null;
      var isDragging = false;

      listEl.querySelectorAll('.qtp-item').forEach(function(item) {
        // 点击切换关联（受 isDragging 标志保护，防止拖拽松开时误触发点击）
        item.onclick = function(e) {
          if (isDragging) return;
          if (e.target.closest('.qtp-drag-handle')) return;
          e.stopPropagation();
          var tid = this.dataset.tid;
          if (!tid) return;
          var isLinked = myTopicIds.indexOf(tid) !== -1;
          if (isLinked) {
            removeQuestionFromTopic(tid, curQid);
            if (window.storageSync && typeof window.storageSync.showToast === 'function') {
              window.storageSync.showToast('已从考点移出', 'info');
            }
          } else {
            addQuestionToTopic(tid, curQid);
            if (window.storageSync && typeof window.storageSync.showToast === 'function') {
              window.storageSync.showToast('已关联到考点', 'success');
            }
          }
          renderRelatedQuestions();
          renderNav();
          renderQuickTopicPopover();
          if (relatedModalOpen) renderModalWorkbench();
        };

        if (!canDrag) return;

        item.addEventListener('dragstart', function(e) {
          draggedItem = this;
          draggedTid = this.dataset.tid;
          isDragging = true;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', draggedTid || '');
          this.classList.add('dragging');
        });

        item.addEventListener('dragend', function() {
          this.classList.remove('dragging');
          listEl.querySelectorAll('.qtp-item').forEach(function(el) {
            el.classList.remove('drag-over-top', 'drag-over-bottom');
          });
          draggedItem = null;
          draggedTid = null;
          // 延迟微任务后重置 isDragging，确保 click 事件已被完全拦截
          setTimeout(function() { isDragging = false; }, 60);
        });

        item.addEventListener('dragover', function(e) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (!draggedItem || draggedItem === this) return;

          var rect = this.getBoundingClientRect();
          var isTop = (e.clientY - rect.top) < (rect.height / 2);
          if (isTop) {
            this.classList.add('drag-over-top');
            this.classList.remove('drag-over-bottom');
          } else {
            this.classList.add('drag-over-bottom');
            this.classList.remove('drag-over-top');
          }
        });

        item.addEventListener('dragleave', function() {
          this.classList.remove('drag-over-top', 'drag-over-bottom');
        });

        item.addEventListener('drop', function(e) {
          e.preventDefault();
          e.stopPropagation();
          this.classList.remove('drag-over-top', 'drag-over-bottom');
          if (!draggedItem || draggedItem === this) return;

          var rect = this.getBoundingClientRect();
          var isTop = (e.clientY - rect.top) < (rect.height / 2);
          if (isTop) {
            listEl.insertBefore(draggedItem, this);
          } else {
            listEl.insertBefore(draggedItem, this.nextSibling);
          }

          // 读取最新 DOM 节点顺序并批量更新各考点 order 属性
          var items = listEl.querySelectorAll('.qtp-item');
          var newOrderTids = [];
          items.forEach(function(el) {
            if (el.dataset.tid) newOrderTids.push(el.dataset.tid);
          });

          newOrderTids.forEach(function(tid, idx) {
            if (relatedTopics[tid]) {
              relatedTopics[tid].order = idx;
            }
          });

          saveRelatedTopics();
          renderRelatedQuestions();
          renderNav();
          if (window.storageSync && typeof window.storageSync.showToast === 'function') {
            window.storageSync.showToast('考点排序已更新', 'success');
          }
          if (relatedModalOpen) renderModalWorkbench();
        });
      });
    }

    function toggleQuickTopicPopover() {
      var pop = document.getElementById('quickTopicPopover');
      if (!pop) return;
      var isShown = pop.style.display !== 'none';
      if (isShown) {
        pop.style.display = 'none';
      } else {
        pop.style.display = 'flex';
        var searchInput = document.getElementById('inputQuickTopicSearch');
        var quickPreviewRow = document.getElementById('quickTopicPreviewRow');
        if (quickPreviewRow) quickPreviewRow.style.display = 'none';
        if (searchInput) {
          searchInput.value = '';
          searchInput.focus();
        }
        renderQuickTopicPopover();
      }
    }

    function getIsDarkFilter() {
      var theme = (typeof currentTheme !== 'undefined') ? currentTheme : ((typeof window !== 'undefined' && window.currentTheme) ? window.currentTheme : 'light');
      var filter = (typeof darkImageFilter !== 'undefined') ? darkImageFilter : ((typeof window !== 'undefined' && window.darkImageFilter) ? window.darkImageFilter : false);
      return theme === 'dark' && !!filter;
    }

    function renderRelatedQuestions() {
      var curQid = getCurrentQid();
      var data = getRelatedQuestionsForQid(curQid);
      var wrap = document.getElementById('relatedTopicsWrap');
      var list = document.getElementById('relatedCardsList');
      if (!wrap || !list) return;

      // 渲染主题胶囊（支持 LaTeX 数学公式、点击重命名与直接点击 ✕ 移除解绑）
      if (data.topics.length > 0) {
        wrap.innerHTML = data.topics.map(function(t) {
          return '<span class="related-topic-pill" data-tid="' + escapeHtml(t.id) + '">' +
            '<span class="topic-pill-text" data-tid="' + escapeHtml(t.id) + '" title="考点：' + escapeHtml(t.name) + '（点击或右键可重命名）">' +
              renderTopicTextHtml(t.name) +
            '</span>' +
            '<button type="button" class="topic-pill-remove" data-remove-tid="' + escapeHtml(t.id) + '" title="将当前题目移出此考点">✕</button>' +
          '</span>';
        }).join('');

        wrap.querySelectorAll('.topic-pill-remove').forEach(function(btn) {
          btn.onclick = function(e) {
            e.stopPropagation();
            var tid = this.dataset.removeTid;
            if (tid) {
              removeQuestionFromTopic(tid, curQid);
              if (window.storageSync && typeof window.storageSync.showToast === 'function') {
                window.storageSync.showToast('已将当前题目移出考点', 'info');
              }
              renderRelatedQuestions();
              renderNav();
              if (relatedModalOpen) renderModalWorkbench();
            }
          };
        });

        wrap.querySelectorAll('.topic-pill-text').forEach(function(el) {
          el.onclick = function(e) {
            e.stopPropagation();
            var tid = this.dataset.tid;
            if (tid) renameRelatedTopic(tid);
          };
          el.oncontextmenu = function(e) {
            e.preventDefault();
            e.stopPropagation();
            var tid = this.dataset.tid;
            if (tid) renameRelatedTopic(tid);
          };
        });
      } else {
        wrap.innerHTML = '<span style="font-size:12px;color:var(--text-muted);font-style:italic;">未归入考点</span>';
      }

      // 渲染同类题单列大图卡片（竖向排列，支持手柄拖拽排序、一键置顶、展开解析与跨书跳转）
      if (data.relatedQuestions.length > 0) {
        var isDarkFilter = getIsDarkFilter();
        var imgFilterClass = isDarkFilter ? ' dark-filter' : '';

        list.innerHTML = data.relatedQuestions.map(function(q) {
          var dotClass = q.status ? ' ' + q.status : '';
          var statusNameMap = {
            proficient: '熟练',
            familiar: '较熟练',
            vague: '模糊',
            rusty: '困难',
            wrong: '不会'
          };
          var statusText = q.status ? (statusNameMap[q.status] || '') : '未做';
          var noteText = q.note || q.questionNote || '';
          var noteHtml = noteText ? '<span class="rc-note" title="' + escapeHtml(noteText) + '">笔记: ' + renderTopicTextHtml(noteText) + '</span>' : '';
          var qImgSrc = getImgPathForQid(q.qid);
          var imgBase = getImgBaseForQid(q.qid);
          var safeId = q.qid.replace(/[^a-zA-Z0-9_]/g, '_');
          var topicsList = (q.topicItems && q.topicItems.length > 0) ? q.topicItems : (q.topics || []).map(function(name, i) {
            return { id: (q.topicIds && q.topicIds[i]) || '', name: name };
          });
          var topicsHtml = '';
          if (topicsList && topicsList.length > 0) {
            var commonTopicIds = q.commonTopicIds || [];
            topicsHtml = '<div class="rc-topics" title="所属考点">' +
              topicsList.map(function(t) {
                var isCommon = (typeof t.isCommon === 'boolean') ? t.isCommon : (commonTopicIds.indexOf(t.id) !== -1);
                var tidAttr = t.id ? ' data-tid="' + escapeHtml(t.id) + '"' : '';
                var commonClass = isCommon ? ' is-common' : '';
                var titlePrefix = isCommon ? '共同考点：' : '考点：';
                return '<span class="rc-topic-tag' + commonClass + '"' + tidAttr + ' title="' + titlePrefix + escapeHtml(t.name) + '（点击或右键可重命名）">' +
                  '<span class="rc-topic-name">' + renderTopicTextHtml(t.name) + '</span>' +
                '</span>';
              }).join('') +
            '</div>';
          }
          return '<div class="related-card" data-qid="' + escapeHtml(q.qid) + '" draggable="true">' +
            '<div class="rc-head">' +
              '<div class="rc-head-left">' +
                '<div class="rc-meta">' +
                  '<span class="rc-drag-handle" title="按住拖拽调整相似度与排序">⠿</span>' +
                  '<span class="rc-book">' + escapeHtml(q.bookName) + '</span>' +
                  '<span class="rc-label">' + escapeHtml(q.chapterShort + ' ' + q.label) + '</span>' +
                  '<span class="rc-dot' + dotClass + '" title="状态: ' + escapeHtml(statusText) + '"></span>' +
                  (statusText ? '<span class="rc-status-text">' + escapeHtml(statusText) + '</span>' : '') +
                '</div>' +
                topicsHtml +
              '</div>' +
              '<div class="rc-head-actions">' +
                '<button type="button" class="gel-btn btn-sm rc-btn-pin" data-pin-qid="' + escapeHtml(q.qid) + '" title="将此题置顶为最高相似度同类题">置顶</button>' +
                '<button type="button" class="gel-btn btn-sm rc-btn-sol" data-sol-qid="' + escapeHtml(q.qid) + '">显示解析</button>' +
                '<button type="button" class="gel-btn btn-sm rc-btn-jump" data-jump-qid="' + escapeHtml(q.qid) + '">跳转做此题</button>' +
                '<button type="button" class="gel-btn btn-sm rc-btn-unlink" data-unlink-qid="' + escapeHtml(q.qid) + '" title="移出与当前题目的关联">移出</button>' +
              '</div>' +
            '</div>' +
            '<div class="rc-img-box" title="点击放大查看">' +
              (qImgSrc ? '<img src="' + escapeHtml(qImgSrc) + '" class="' + imgFilterClass + '" loading="lazy" alt="' + escapeHtml(q.label) + '">' : '<span style="font-size:12px;color:var(--text-muted)">题目图片</span>') +
            '</div>' +
            '<div class="rc-sol-box" id="rcSolBox_' + safeId + '" style="display:none" data-sol-loaded="false" data-sol-base="' + escapeHtml(imgBase) + '">' +
              '<div class="rc-sol-divider"><span>答案与解析</span></div>' +
              '<div class="rc-sol-imgs" id="rcSolImgs_' + safeId + '"></div>' +
            '</div>' +
            (noteHtml ? '<div class="rc-foot">' + noteHtml + '</div>' : '') +
          '</div>';
        }).join('');

        if (window.renderMathInElement) {
          try {
            window.renderMathInElement(list, {
              delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\[', right: '\\]', display: true },
                { left: '\\(', right: '\\)', display: false }
              ],
              throwOnError: false
            });
          } catch (e) {}
        }

        // 绑定置顶按钮事件
        list.querySelectorAll('button.rc-btn-pin').forEach(function(btn) {
          btn.onclick = function(e) {
            e.stopPropagation();
            var targetQid = this.dataset.pinQid;
            var currentQid = getCurrentQid();
            if (targetQid && currentQid) {
              pinRelatedQuestion(currentQid, targetQid);
            }
          };
        });

        // 绑定 HTML5 拖拽重排与双向亲密度同步
        var draggedCard = null;
        var draggedQid = null;

        list.querySelectorAll('.related-card').forEach(function(card) {
          card.addEventListener('dragstart', function(e) {
            draggedCard = this;
            draggedQid = this.dataset.qid;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', draggedQid || '');
            this.classList.add('dragging');
          });

          card.addEventListener('dragend', function() {
            this.classList.remove('dragging');
            list.querySelectorAll('.related-card').forEach(function(c) {
              c.classList.remove('drag-over-top', 'drag-over-bottom');
            });
            draggedCard = null;
            draggedQid = null;
          });

          card.addEventListener('dragover', function(e) {
            e.preventDefault();
            if (!draggedCard || draggedCard === this) return;
            e.dataTransfer.dropEffect = 'move';
            var rect = this.getBoundingClientRect();
            var relY = e.clientY - rect.top;
            if (relY < rect.height / 2) {
              this.classList.add('drag-over-top');
              this.classList.remove('drag-over-bottom');
            } else {
              this.classList.add('drag-over-bottom');
              this.classList.remove('drag-over-top');
            }
          });

          card.addEventListener('dragleave', function() {
            this.classList.remove('drag-over-top', 'drag-over-bottom');
          });

          card.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('drag-over-top', 'drag-over-bottom');
            if (!draggedCard || draggedCard === this) return;

            var rect = this.getBoundingClientRect();
            var relY = e.clientY - rect.top;
            var insertBefore = (relY < rect.height / 2);

            if (insertBefore) {
              list.insertBefore(draggedCard, this);
            } else {
              list.insertBefore(draggedCard, this.nextSibling);
            }

            // 从重排后的 DOM 结构提取新顺序
            var newQids = [];
            list.querySelectorAll('.related-card').forEach(function(c) {
              if (c.dataset.qid) newQids.push(c.dataset.qid);
            });

            var currentQid = getCurrentQid();
            updateRelatedAffinityOrder(currentQid, newQids);
            if (window.storageSync && typeof window.storageSync.showToast === 'function') {
              window.storageSync.showToast('已更新同类题排序与双向相似度', 'success');
            }
          });
        });

        list.querySelectorAll('button.rc-btn-sol').forEach(function(btn) {
          btn.onclick = function(e) {
            e.stopPropagation();
            var qid = this.dataset.solQid;
            var safeId = qid.replace(/[^a-zA-Z0-9_]/g, '_');
            var box = document.getElementById('rcSolBox_' + safeId);
            if (box) {
              var isShown = box.style.display !== 'none';
              if (!isShown) {
                if (box.dataset.solLoaded !== 'true') {
                  var base = box.dataset.solBase || getImgBaseForQid(qid);
                  var imgsContainer = document.getElementById('rcSolImgs_' + safeId) || box;
                  var isDarkFilter = getIsDarkFilter();
                  setRelatedCardSolutionImages(base, imgsContainer, isDarkFilter);
                  box.dataset.solLoaded = 'true';
                }
                box.style.display = 'flex';
                this.textContent = '隐藏解析';
                this.classList.add('active');
              } else {
                box.style.display = 'none';
                this.textContent = '显示解析';
                this.classList.remove('active');
              }
            }
          };
        });

        list.querySelectorAll('button.rc-btn-jump').forEach(function(btn) {
          btn.onclick = function(e) {
            e.stopPropagation();
            var targetQid = this.dataset.jumpQid;
            if (targetQid) jumpToQid(targetQid, true);
          };
        });

        list.querySelectorAll('button.rc-btn-unlink').forEach(function(btn) {
          btn.onclick = function(e) {
            e.stopPropagation();
            var targetQid = this.dataset.unlinkQid;
            var curQid = getCurrentQid();
            var myTopics = getTopicsForQid(curQid);
            var topicNames = myTopics.map(function(t) { return t.name; }).join('、');
            var qMeta = getQuestionMeta(targetQid);
            var qTitle = qMeta ? (qMeta.bookName + ' ' + qMeta.chapterShort + ' ' + qMeta.label) : targetQid;

            function doUnlink() {
              myTopics.forEach(function(t) {
                removeQuestionFromTopic(t.id, targetQid);
              });
              if (window.storageSync && typeof window.storageSync.showToast === 'function') {
                window.storageSync.showToast('已将该同类题移出共同考点', 'info');
              }
              renderRelatedQuestions();
              renderNav();
              if (relatedModalOpen) renderModalWorkbench();
            }

            if (typeof window.showConfirmModal === 'function') {
              window.showConfirmModal({
                title: '移出同类题关联',
                message: '确定要将「' + qTitle + '」从当前题目的共同考点（' + (topicNames || '考点') + '）中移出吗？\n\n移出后该题将不再作为此题的同类题展示。',
                confirmText: '确认移出',
                cancelText: '取消',
                danger: true
              }).then(function(confirmed) {
                if (confirmed) doUnlink();
              });
            } else {
              doUnlink();
            }
          };
        });

        list.querySelectorAll('.rc-img-box img').forEach(function(img) {
          img.onclick = function(e) {
            e.stopPropagation();
            if (this.src && !this.src.endsWith('/')) {
              openLightbox(this.src);
            }
          };
        });

        list.querySelectorAll('.rc-sol-box').forEach(function(box) {
          box.onclick = function(e) {
            var img = e.target.closest('img');
            if (img && img.src && !img.src.endsWith('/')) {
              e.stopPropagation();
              openLightbox(img.src);
            }
          };
        });

        // 绑定共同考点标签点击与右键重命名事件
        list.querySelectorAll('.rc-topic-tag').forEach(function(tag) {
          tag.onclick = function(e) {
            e.stopPropagation();
            var tid = this.dataset.tid;
            if (tid) renameRelatedTopic(tid);
          };
          tag.oncontextmenu = function(e) {
            e.preventDefault();
            e.stopPropagation();
            var tid = this.dataset.tid;
            if (tid) renameRelatedTopic(tid);
          };
        });

        list.querySelectorAll('.related-card').forEach(function(card) {
          card.onclick = function(e) {
            if (e.target.closest('button') || e.target.closest('img') || e.target.closest('.rc-drag-handle') || e.target.closest('.rc-topic-tag') || e.target.closest('.rc-topics')) return;
            var targetQid = this.dataset.qid;
            if (targetQid) jumpToQid(targetQid, true);
          };
        });
      } else {
        list.innerHTML = '<div class="related-empty-hint">暂无关联同类题，可点击右侧「关联同类题 (L)」随时进行跨书归类与考点关联</div>';
      }

      if (typeof window.renderCognitiveBadges === 'function') {
        window.renderCognitiveBadges();
      }
    }

    // 4. 跨书/跨章无缝跳转与返回栈管理
    function jumpToQid(targetQid, pushStack) {
      var target = parseQid(targetQid);
      if (!target) return;
      autoSaveNotes();

      if (pushStack) {
        var curQid = getCurrentQid();
        var curMeta = getQuestionMeta(curQid);
        jumpReturnStack.push({ qid: curQid, meta: curMeta });
      }

      if (target.subjectId !== curSubjectId) {
        switchSubject(target.subjectId);
      }
      var targetChapterId = target.chapterId;
      var targetIdx = target.idx;

      // 伴章智能路由：若目标题目属于伴章（1000题或李范习题），必须自动路由到挂载它的母章（基础30讲/强化36讲/李范全书）
      var allChs = (typeof CHAPTERS !== 'undefined' && CHAPTERS && CHAPTERS.length > 0)
        ? CHAPTERS
        : ((typeof window !== 'undefined' && window.CHAPTERS) ? window.CHAPTERS : []);
      if (!allChs || allChs.length === 0) {
        var curSub = (typeof curSubject !== 'undefined' && curSubject)
          ? curSubject
          : ((typeof window !== 'undefined' && window.curSubject) ? window.curSubject : null);
        if (curSub && curSub.chapters) allChs = curSub.chapters;
      }

      var hostCh = null;
      if (allChs && allChs.length > 0) {
        for (var hi = 0; hi < allChs.length; hi++) {
          if (allChs[hi].q1000Id === targetChapterId) {
            hostCh = allChs[hi];
            break;
          }
        }
      }

      if (hostCh) {
        targetChapterId = hostCh.id;
        targetIdx = (hostCh.ownTotal || 0) + target.idx;
      }

      var curChId = (typeof currentChapterId !== 'undefined')
        ? currentChapterId
        : ((typeof window !== 'undefined' && window.currentChapterId) ? window.currentChapterId : '');

      if (targetChapterId !== curChId) {
        switchChapter(targetChapterId);
      }
      switchTo(targetIdx);
      updateJumpReturnBar();

      // 跳转到同类题时，页面与工作台自动平滑滚动到最上方
      requestAnimationFrame(function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        var mainArea = document.getElementById('mainArea') || document.querySelector('.main-content');
        if (mainArea && typeof mainArea.scrollTo === 'function') {
          mainArea.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }

    function returnToPreviousQuestion() {
      if (jumpReturnStack.length === 0) return;
      var prev = jumpReturnStack.pop();
      if (prev && prev.qid) {
        jumpToQid(prev.qid, false);
      }
      updateJumpReturnBar();
    }

    function closeJumpReturnBar() {
      jumpReturnStack = [];
      updateJumpReturnBar();
    }

    function updateJumpReturnBar() {
      var bar = document.getElementById('jumpReturnBar');
      var txt = document.getElementById('jumpBackText');
      if (!bar) return;
      if (jumpReturnStack.length > 0) {
        var top = jumpReturnStack[jumpReturnStack.length - 1];
        var title = top.meta ? top.meta.displayTitle : top.qid;
        if (txt) txt.textContent = '返回原题：' + title;
        bar.style.display = 'flex';
      } else {
        bar.style.display = 'none';
      }
    }

    // 6. 考点主题名称渲染（完整支持 Markdown 语法与 $LaTeX$ / $$LaTeX$$ 数学公式，与笔记引擎 100% 统一）
    function renderTopicTextHtml(text) {
      if (window.MarkdownLatexEngine && typeof window.MarkdownLatexEngine.renderInline === 'function') {
        return window.MarkdownLatexEngine.renderInline(text);
      }
      if (!text) return '';
      // 纯文本极速直出快道：若无 LaTeX 标记与 Markdown 语法符号，直接 escapeHtml 输出，省去 marked + KaTeX 重型引擎开销
      if (!text.includes('$') && !text.includes('\\') && !/[*_`~\[\]<>]/.test(text)) {
        return escapeHtml(text);
      }
      try {
        if (typeof renderNotesMarkdown === 'function') {
          var html = renderNotesMarkdown(text);
          if (typeof html === 'string') {
            html = html.trim();
            // 如果为单段落，剥离外层 <p>...</p> 以便在按钮、胶囊徽标等行内元素中原生流式展示
            if (html.startsWith('<p>') && html.endsWith('</p>') && html.indexOf('<p>', 3) === -1) {
              html = html.substring(3, html.length - 4);
            }
            return html;
          }
        }
      } catch(e) {}
      return escapeHtml(text);
    }

    // 辅助：向通用输入框插入 LaTeX 代码片段并定位光标（统一委托至 MarkdownLatexEngine）
    function insertSnippetIntoField(inputEl, snippet, onUpdate) {
      if (!inputEl) return;
      if (window.MarkdownLatexEngine && typeof window.MarkdownLatexEngine.insertSnippet === 'function') {
        return window.MarkdownLatexEngine.insertSnippet(inputEl, snippet, onUpdate);
      }
      var start = inputEl.selectionStart !== undefined ? inputEl.selectionStart : inputEl.value.length;
      var end = inputEl.selectionEnd !== undefined ? inputEl.selectionEnd : start;
      var val = inputEl.value;
      var selected = val.substring(start, end);
      var insertText = snippet;
      var targetCursor = start + snippet.length;

      if (snippet.indexOf('|') !== -1) {
        if (selected) {
          insertText = snippet.replace('|', selected);
          targetCursor = start + insertText.length;
        } else {
          var pipeIdx = snippet.indexOf('|');
          insertText = snippet.replace('|', '');
          targetCursor = start + pipeIdx;
        }
      }

      inputEl.value = val.substring(0, start) + insertText + val.substring(end);
      inputEl.selectionStart = targetCursor;
      inputEl.selectionEnd = targetCursor;
      inputEl.focus();
      if (typeof onUpdate === 'function') onUpdate(inputEl.value);
    }

    // 考点主题重命名弹窗控制（抛弃原生 prompt，统一现代玻璃质感与实时公式预览）
    var activeRenameTopicId = null;
    var topicRenameModalOpen = false;

    function openRenameTopicModal(topicId) {
      var t = relatedTopics[topicId];
      if (!t) return false;
      activeRenameTopicId = topicId;
      topicRenameModalOpen = true;
      document.body.classList.add('modal-open');
      var modal = document.getElementById('topicRenameModal');
      var input = document.getElementById('inputRenameTopicName');
      var preview = document.getElementById('renameTopicPreview');
      if (!modal || !input) return false;
      input.value = t.name || '';
      if (preview) preview.innerHTML = renderTopicTextHtml(input.value) || '<span style="color:var(--text-muted)">（暂无输入内容）</span>';
      var clearBtn = document.getElementById('btnClearRenameTopic');
      if (clearBtn) clearBtn.style.display = input.value ? 'inline-flex' : 'none';
      modal.style.display = 'flex';
      setTimeout(function() {
        input.focus();
        input.select();
      }, 50);
      return true;
    }

    function closeRenameTopicModal() {
      topicRenameModalOpen = false;
      activeRenameTopicId = null;
      if (!relatedModalOpen) {
        document.body.classList.remove('modal-open');
      }
      var modal = document.getElementById('topicRenameModal');
      if (modal) modal.style.display = 'none';
    }

    function submitRenameTopic() {
      if (!activeRenameTopicId) return false;
      var t = relatedTopics[activeRenameTopicId];
      if (!t) { closeRenameTopicModal(); return false; }
      var input = document.getElementById('inputRenameTopicName');
      if (!input) return false;
      var newName = input.value.trim();
      if (!newName) {
        if (window.storageSync && typeof window.storageSync.showToast === 'function') {
          window.storageSync.showToast('考点主题名称不能为空', 'warning');
        }
        return false;
      }
      if (newName === t.name) {
        closeRenameTopicModal();
        return true;
      }
      var oldName = t.name;
      t.name = newName;
      saveRelatedTopics();
      renderRelatedModalTopics();
      renderRelatedQuestions();
      renderNav();
      if (typeof renderModalNav === 'function') renderModalNav();
      if (typeof renderModalViewer === 'function') renderModalViewer();
      if (window.storageSync && typeof window.storageSync.showToast === 'function') {
        window.storageSync.showToast('已重命名考点：“' + oldName + '” → “' + newName + '”', 'success');
      }
      closeRenameTopicModal();
      return true;
    }

    function renameRelatedTopic(topicId, newName) {
      if (typeof newName !== 'undefined') {
        var t = relatedTopics[topicId];
        if (!t) return false;
        t.name = newName.trim();
        saveRelatedTopics();
        renderRelatedModalTopics();
        renderRelatedQuestions();
        renderNav();
        return true;
      }
      return openRenameTopicModal(topicId);
    }

    // 主题彻底删除
    function deleteRelatedTopic(topicId, skipConfirm) {
      var t = relatedTopics[topicId];
      if (!t) return Promise.resolve ? Promise.resolve(false) : false;

      function doDelete() {
        delete relatedTopics[topicId];
        saveRelatedTopics();
        renderRelatedModalTopics();
        renderRelatedQuestions();
        renderNav();
        if (typeof renderModalWorkbench === 'function') renderModalWorkbench();
        if (typeof renderModalNav === 'function') renderModalNav();
        if (window.storageSync && typeof window.storageSync.showToast === 'function') {
          window.storageSync.showToast('已彻底删除考点主题“' + t.name + '”', 'info');
        }
        return true;
      }

      if (skipConfirm) {
        return doDelete();
      }

      if (typeof window.showConfirmModal === 'function') {
        return window.showConfirmModal({
          title: '彻底删除考点',
          message: '确定要彻底删除考点主题“' + t.name + '”吗？\n该操作将清除此主题下所有题目的关联。',
          danger: true,
          confirmText: '彻底删除',
          cancelText: '取消',
          onConfirm: doDelete
        });
      }
      return doDelete();
    }

    // 7. 同类题弹窗交互与跨书做题浏览工作台（仿照主页面三级下拉与全宽展开）
    var pickerSubjectId = 'math';
    var pickerWb = '';
    var pickerSubj = '';
    var pickerChapterId = '';
    var pickerQIdx = 0;
    var pickerSolShown = false;

    function openRelatedModal() {
      if (!_topicsLoaded) loadRelatedTopics();
      relatedModalOpen = true;
      document.body.classList.add('modal-open');
      var modal = document.getElementById('relatedModal');
      if (!modal) return;
      var curQid = getCurrentQid();
      var curMeta = getQuestionMeta(curQid);
      var curText = document.getElementById('relatedModalCurQText');
      if (curText && curMeta) {
        curText.textContent = '当前做题：' + curMeta.displayTitle;
      }
      renderRelatedModalTopics();
      initVisualQuestionPicker();
      renderRelatedModalRecent();
      modal.style.display = 'flex';
      setTimeout(function() {
        var navSection = document.getElementById('rmNavSection');
        if (navSection) {
          var curBtn = navSection.querySelector('button.active');
          if (curBtn) curBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }, 50);
    }

    function closeRelatedModal() {
      relatedModalOpen = false;
      if (!topicRenameModalOpen) {
        document.body.classList.remove('modal-open');
      }
      var modal = document.getElementById('relatedModal');
      if (!modal) return;
      modal.style.display = 'none';
      closeAllModalTitlePanels();
      renderRelatedQuestions();
      renderNav();
    }

    function closeAllModalTitlePanels() {
      var bar = document.getElementById('rmTitleBar');
      if (!bar) return;
      bar.querySelectorAll('.title-panel.open').forEach(function(p) { p.classList.remove('open'); });
      bar.querySelectorAll('.title-trigger.open').forEach(function(t) { t.classList.remove('open'); });
    }

    function setupModalPanelToggle(trigId, panelId) {
      var trig = document.getElementById(trigId);
      var panel = document.getElementById(panelId);
      if (!trig || !panel) return;
      trig.onclick = function(e) {
        e.stopPropagation();
        var isOpen = panel.classList.contains('open');
        closeAllModalTitlePanels();
        if (!isOpen) {
          panel.classList.add('open');
          trig.classList.add('open');
        }
      };
    }

    function renderRelatedModalTopics() {
      var curQid = getCurrentQid();
      var myTopics = getTopicsForQid(curQid);
      var container = document.getElementById('rmCurrentTopics');
      if (!container) return;

      // 1. 渲染当前题已加入的主题（单 ✕ 图标移出，点击或右键重命名）
      if (myTopics.length > 0) {
        container.innerHTML = myTopics.map(function(t) {
          return '<span class="rm-topic-tag" data-tid="' + escapeHtml(t.id) + '" title="点击或右键可重命名考点">' +
            '<span class="rm-topic-name" data-rename-tid="' + escapeHtml(t.id) + '">' + renderTopicTextHtml(t.name) + '</span>' +
            '<button type="button" class="rm-topic-del" data-del-tid="' + escapeHtml(t.id) + '" title="将当前题目移出该考点">✕</button>' +
          '</span>';
        }).join('');

        container.querySelectorAll('button[data-del-tid]').forEach(function(btn) {
          btn.onclick = function(e) {
            e.stopPropagation();
            var tid = this.dataset.delTid;
            if (tid) {
              removeQuestionFromTopic(tid, curQid);
              if (window.storageSync && typeof window.storageSync.showToast === 'function') {
                window.storageSync.showToast('已将当前题目移出考点', 'info');
              }
              renderRelatedModalTopics();
              renderRelatedQuestions();
              renderNav();
              renderModalNav();
              renderModalViewer();
            }
          };
        });

        container.querySelectorAll('.rm-topic-tag').forEach(function(tag) {
          tag.onclick = function(e) {
            if (e.target.closest('button.rm-topic-del')) return;
            var tid = this.dataset.tid;
            if (tid) renameRelatedTopic(tid);
          };
          tag.oncontextmenu = function(e) {
            if (e.target.closest('button.rm-topic-del')) return;
            e.preventDefault();
            e.stopPropagation();
            var tid = this.dataset.tid;
            if (tid) renameRelatedTopic(tid);
          };
        });
      } else {
        container.innerHTML = '<span class="related-empty-hint">当前题目尚未归入任何考点，请点击下方已有考点加入，或新建考点</span>';
      }

      // 2. 渲染全库已有考点主题（支持过滤、点击加入、重命名与彻底删除）
      var availContainer = document.getElementById('rmAvailableTopics');
      var availWrap = document.getElementById('rmAvailableTopicsWrap');
      var filterInput = document.getElementById('inputFilterTopics');
      var filterVal = filterInput ? filterInput.value.trim().toLowerCase() : '';

      if (availContainer) {
        var myTopicIds = myTopics.map(function(t) { return t.id; });
        var allTopicsList = [];
        for (var tid in relatedTopics) {
          if (!Object.prototype.hasOwnProperty.call(relatedTopics, tid)) continue;
          var tObj = relatedTopics[tid];
          if (!filterVal || tObj.name.toLowerCase().indexOf(filterVal) !== -1) {
            allTopicsList.push(tObj);
          }
        }

        if (allTopicsList.length > 0) {
          allTopicsList = sortTopicsList(allTopicsList);
          if (availWrap) availWrap.style.display = 'flex';
          availContainer.innerHTML = allTopicsList.map(function(t) {
            var isLinked = myTopicIds.indexOf(t.id) !== -1;
            var count = (t.members ? t.members.length : 0);
            return '<div class="rm-avail-tag-wrap' + (isLinked ? ' linked' : '') + '" data-tid="' + escapeHtml(t.id) + '">' +
              '<button type="button" class="rm-avail-btn' + (isLinked ? ' linked' : '') + '" data-toggle-tid="' + escapeHtml(t.id) + '" title="' + (isLinked ? '当前题已归入此考点（点击移出）' : '点击将当前题目加入此考点') + '">' +
                '<span style="font-size:12px;font-weight:bold;margin-right:2px;' + (isLinked ? 'color:var(--mastered);' : '') + '">' + (isLinked ? '✓' : '+') + '</span>' +
                '<span>' + renderTopicTextHtml(t.name) + '</span>' +
                '<span class="rm-avail-count">' + (isLinked ? '(已归入 · ' + count + '题)' : '(' + count + '题)') + '</span>' +
              '</button>' +
              '<button type="button" class="rm-topic-trash-btn" data-trash-tid="' + escapeHtml(t.id) + '" title="彻底删除此考点主题">✕</button>' +
            '</div>';
          }).join('');

          availContainer.querySelectorAll('button[data-toggle-tid]').forEach(function(btn) {
            btn.onclick = function(e) {
              e.stopPropagation();
              var targetTid = this.dataset.toggleTid;
              if (targetTid) {
                var isLinked = myTopicIds.indexOf(targetTid) !== -1;
                if (isLinked) {
                  removeQuestionFromTopic(targetTid, curQid);
                } else {
                  addQuestionToTopic(targetTid, curQid);
                }
                renderRelatedModalTopics();
                renderRelatedQuestions();
                renderNav();
                renderModalNav();
                renderModalViewer();
              }
            };
          });

          availContainer.querySelectorAll('button[data-trash-tid]').forEach(function(btn) {
            btn.onclick = function(e) {
              e.stopPropagation();
              var targetTid = this.dataset.trashTid;
              if (targetTid) deleteRelatedTopic(targetTid);
            };
          });

          availContainer.querySelectorAll('.rm-avail-tag-wrap').forEach(function(tag) {
            tag.oncontextmenu = function(e) {
              if (e.target.closest('button.rm-topic-trash-btn')) return;
              e.preventDefault();
              e.stopPropagation();
              var tid = this.dataset.tid;
              if (tid) renameRelatedTopic(tid);
            };
          });
        } else {
          if (availWrap) {
            var totalCount = Object.keys(relatedTopics).length;
            if (totalCount === 0) {
              availContainer.innerHTML = '<span class="related-empty-hint">暂无已有考点，请在下方新建</span>';
            } else if (filterVal) {
              availContainer.innerHTML = '<span class="related-empty-hint">未找到匹配的考点</span>';
            } else {
              availContainer.innerHTML = '<span class="related-empty-hint">暂无考点</span>';
            }
          }
        }
      }
    }

    // 8. 跨书题目浏览器（仿照主页面三级下拉与全宽展开）
    function initVisualQuestionPicker() {
      pickerSubjectId = curSubjectId || 'math';
      var curCh = getChapter();
      pickerWb = curCh ? (curCh.wb || curSubject.name) : '基础30讲';
      pickerSubj = curCh ? (curCh.subj || '高数') : '高数';
      pickerChapterId = currentChapterId;
      pickerQIdx = current;
      pickerSolShown = false;

      setupModalPanelToggle('trigModalWb', 'panelModalWb');
      setupModalPanelToggle('trigModalSubj', 'panelModalSubj');
      setupModalPanelToggle('trigModalChapter', 'panelModalChapter');

      renderModalTitleBar();
      renderModalNav();
      renderModalViewer();
    }

    // 提取全库书籍：当前学科的书籍排在前面，异科沉底排在最后！
    function getModalAllBooks() {
      var curBooks = [];
      var otherBooks = [];

      SUBJECTS.forEach(function(s) {
        if (!s.chapters || s.chapters.length === 0) return;
        var wbMap = {};
        s.chapters.forEach(function(c) {
          var wb = c.wb || s.name;
          if (!wbMap[wb]) {
            wbMap[wb] = true;
            var item = {
              subjectId: s.id,
              subjectName: s.name,
              wb: wb,
              label: (s.id === 'math' ? getWbLabel(wb) : wb)
            };
            if (s.id === curSubjectId) curBooks.push(item);
            else otherBooks.push(item);
          }
        });
      });

      return curBooks.concat(otherBooks);
    }

    function renderModalTitleBar() {
      var txtWb = document.getElementById('txtModalWb');
      var txtSubj = document.getElementById('txtModalSubj');
      var txtChapter = document.getElementById('txtModalChapter');
      var ddSubj = document.getElementById('ddModalSubj');
      var badge = document.getElementById('rmProgressBadge');

      var allBooks = getModalAllBooks();
      var activeBook = allBooks.find(function(b) {
        return b.subjectId === pickerSubjectId && b.wb === pickerWb;
      }) || allBooks[0];

      if (activeBook) {
        pickerSubjectId = activeBook.subjectId;
        pickerWb = activeBook.wb;
      }

      var s = SUBJECTS.find(function(sub) { return sub.id === pickerSubjectId; }) || curSubject;
      var bookChapters = s ? s.chapters.filter(function(c) { return (c.wb || s.name) === pickerWb; }) : [];

      // 提取模块（学科）
      var subjs = [];
      bookChapters.forEach(function(c) {
        if (c.subj && subjs.indexOf(c.subj) === -1) subjs.push(c.subj);
      });
      if (subjs.indexOf(pickerSubj) === -1) {
        pickerSubj = subjs.length > 0 ? subjs[0] : '';
      }

      var curSubjChapters = subjs.length > 0 ? bookChapters.filter(function(c) { return c.subj === pickerSubj; }) : bookChapters;
      if (!curSubjChapters.some(function(c) { return c.id === pickerChapterId; })) {
        pickerChapterId = curSubjChapters.length > 0 ? curSubjChapters[0].id : '';
        pickerQIdx = 0;
      }

      var activeCh = curSubjChapters.find(function(c) { return c.id === pickerChapterId; });

      if (txtWb && activeBook) txtWb.textContent = activeBook.label;
      if (txtSubj) txtSubj.textContent = pickerSubj || '全部';
      if (txtChapter && activeCh) txtChapter.textContent = activeCh.short || activeCh.name;
      if (ddSubj) ddSubj.style.display = (subjs.length > 1) ? '' : 'none';

      if (badge && activeCh) {
        badge.textContent = '共 ' + activeCh.total + ' 题 · 当前 第 ' + (pickerQIdx + 1) + ' 题';
      }

      // 填充书籍下拉面板
      var pWb = document.getElementById('panelModalWb');
      if (pWb) {
        pWb.innerHTML = allBooks.map(function(b) {
          var isActive = (b.subjectId === pickerSubjectId && b.wb === pickerWb);
          var prefix = (b.subjectId !== curSubjectId) ? '[' + escapeHtml(b.subjectName) + '] ' : '';
          return '<button type="button" class="title-option' + (isActive ? ' active' : '') + '" data-subj-id="' + escapeHtml(b.subjectId) + '" data-wb="' + escapeHtml(b.wb) + '">' +
            prefix + escapeHtml(b.label) +
          '</button>';
        }).join('');

        pWb.querySelectorAll('button.title-option').forEach(function(btn) {
          btn.onclick = function(e) {
            e.stopPropagation();
            pickerSubjectId = this.dataset.subjId;
            pickerWb = this.dataset.wb;
            closeAllModalTitlePanels();
            var targetS = SUBJECTS.find(function(sub) { return sub.id === pickerSubjectId; });
            var targetChs = targetS ? targetS.chapters.filter(function(c) { return (c.wb || targetS.name) === pickerWb; }) : [];
            if (targetChs.length > 0) {
              pickerSubj = targetChs[0].subj || '';
              pickerChapterId = targetChs[0].id;
              pickerQIdx = 0;
            }
            renderModalTitleBar();
            renderModalNav();
            renderModalViewer();
          };
        });
      }

      // 填充学科/模块下拉面板
      var pSubj = document.getElementById('panelModalSubj');
      if (pSubj) {
        pSubj.innerHTML = subjs.map(function(subjName) {
          var isActive = (subjName === pickerSubj);
          return '<button type="button" class="title-option' + (isActive ? ' active' : '') + '" data-subj-name="' + escapeHtml(subjName) + '">' +
            escapeHtml(subjName) +
          '</button>';
        }).join('');

        pSubj.querySelectorAll('button.title-option').forEach(function(btn) {
          btn.onclick = function(e) {
            e.stopPropagation();
            pickerSubj = this.dataset.subjName;
            closeAllModalTitlePanels();
            var targetChs = bookChapters.filter(function(c) { return c.subj === pickerSubj; });
            if (targetChs.length > 0) {
              pickerChapterId = targetChs[0].id;
              pickerQIdx = 0;
            }
            renderModalTitleBar();
            renderModalNav();
            renderModalViewer();
          };
        });
      }

      // 填充章节下拉面板
      var pChapter = document.getElementById('panelModalChapter');
      if (pChapter) {
        pChapter.innerHTML = curSubjChapters.map(function(c) {
          var isActive = (c.id === pickerChapterId);
          return '<button type="button" class="title-option' + (isActive ? ' active' : '') + '" data-cid="' + escapeHtml(c.id) + '">' +
            escapeHtml(c.short || c.name) + ' (' + c.total + '题)' +
          '</button>';
        }).join('');

        pChapter.querySelectorAll('button.title-option').forEach(function(btn) {
          btn.onclick = function(e) {
            e.stopPropagation();
            pickerChapterId = this.dataset.cid;
            pickerQIdx = 0;
            closeAllModalTitlePanels();
            renderModalTitleBar();
            renderModalNav();
            renderModalViewer();
          };
        });
      }
    }

    function getChapterSectionsForModal(s, ch) {
      if (!ch || !ch.labels || ch.labels.length === 0) return [];

      if (ch.wb === '老姚高数' && ch.sections && ch.sections.length > 0) {
        return ch.sections.map(function(sec) {
          var indices = [];
          for (var i = sec.start; i < sec.start + sec.count && i < ch.total; i++) {
            indices.push(i);
          }
          return { title: sec.type, indices: indices };
        });
      }

      if (ch.sections && ch.sections.length > 0) {
        return ch.sections.map(function(sec) {
          var indices = [];
          for (var i = sec.start; i < sec.start + sec.count && i < ch.total; i++) {
            indices.push(i);
          }
          return { title: sec.type, indices: indices };
        });
      }

      // 默认按分类划分（例题、习题、1000题）
      var parts = [];
      var curPart = null;
      for (var i = 0; i < ch.labels.length; i++) {
        var label = ch.labels[i];
        var cat = (s.classifyLabel ? s.classifyLabel(label) : (label.startsWith('例') ? '例题' : '习题'));
        if (!curPart || curPart.title !== cat) {
          curPart = { title: cat, indices: [i] };
          parts.push(curPart);
        } else {
          curPart.indices.push(i);
        }
      }
      return parts;
    }

    // 获取指定科目与章节的全部存储数据（状态、错图、实书不符、笔记、图片标注）
    function getChapterStorageData(s, ch) {
      var srcs = [{ ch: ch, offset: 0, len: ch.ownTotal || ch.total }];
      if (ch.q1000Total && ch.q1000Id) {
        var companion = s.chapters.find(function(c) { return c.id === ch.q1000Id; });
        if (companion) {
          srcs.push({ ch: companion, offset: ch.ownTotal, len: ch.q1000Total });
        }
      }

      var statuses = {};
      var qBad = {};
      var sBad = {};
      var bookMismatch = {};

      srcs.forEach(function(src) {
        var engine = window.StorageEngine;
        if (engine && src.ch && src.ch.uid) {
          var store = new engine.ChapterStore(src.ch);
          store.readIntoMemory({
            statuses: statuses,
            qBad: qBad,
            sBad: sBad,
            bookMismatch: bookMismatch
          }, src.offset);
        }
      });

      var notesMap = {};
      srcs.forEach(function(src) {
        var engine = window.StorageEngine;
        if (engine && src.ch && src.ch.uid) {
          var store = new engine.ChapterStore(src.ch);
          store.readIntoMemory({ notes: notesMap }, 0);
        }
      });

      return {
        statuses: statuses,
        qBad: qBad,
        sBad: sBad,
        bookMismatch: bookMismatch,
        hasNote: function(idx) {
          var label = ch.labels[idx];
          var cid = (ch.q1000Total && idx >= ch.ownTotal) ? ch.q1000Id : ch.id;
          return !!notesMap[cid + '::' + label];
        },
        hasAnnot: function(idx) {
          var path = s.getImgPath(ch, ch.labels[idx]);
          var base = normalizeAnnotSrc(path);
          return Object.keys(imgAnnotations).some(function(k) { return k.indexOf(base) === 0; });
        }
      };
    }

    var modalCollapsedSections = new Set();

    function renderModalNav() {
      var nav = document.getElementById('rmNavSection');
      var badge = document.getElementById('rmProgressBadge');
      if (!nav) return;
      nav.innerHTML = '';

      var s = SUBJECTS.find(function(sub) { return sub.id === pickerSubjectId; }) || curSubject;
      var ch = s ? s.chapters.find(function(c) { return c.id === pickerChapterId; }) : null;
      if (!ch || !ch.labels || ch.labels.length === 0) {
        nav.innerHTML = '<span class="related-empty-hint" style="grid-column:1/-1;">该章节暂无题目</span>';
        if (badge) badge.textContent = '共 0 题';
        return;
      }

      ensureGroups(ch);
      const cols = 5;
      nav.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';

      pickerQIdx = Math.max(0, Math.min(pickerQIdx, ch.total - 1));
      if (badge) {
        badge.textContent = '共 ' + ch.total + ' 题 · 当前 第 ' + (pickerQIdx + 1) + ' 题';
      }

      const labels = ch.labels;
      const curGroup = ch.groupForIdx ? ch.groupForIdx[pickerQIdx] : null;
      const curQid = getCurrentQid();
      const myTopics = getTopicsForQid(curQid);

      const chData = getChapterStorageData(s, ch);
      const statuses = chData.statuses;
      const qBad = chData.qBad;
      const sBad = chData.sBad;
      const bookMismatch = chData.bookMismatch;

      function appendBadges(btn, i) {
        let groupHasNote = false, groupHasAnnot = false, groupHasRelated = false;
        const g0 = ch.groupForIdx[i];
        const start = g0 ? g0.startIdx : i;
        const count = g0 ? g0.count : 1;
        for (var k = 0; k < count; k++) {
          const idx = start + k;
          if (chData.hasNote(idx)) groupHasNote = true;
          if (chData.hasAnnot(idx)) groupHasAnnot = true;
          const qid = getQid(s.id, ch.id, idx);
          if (getTopicsForQid(qid).length > 0) groupHasRelated = true;
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

      var parts = [];
      var curPart = null;
      var partOrder = getPartOrder(ch, s);
      for (var i = 0; i < labels.length; i++) {
        var cat = partOfIdx(i, ch);
        if (!curPart || curPart.label !== cat) {
          if (curPart) curPart.endIdx = i;
          curPart = { label: cat, startIdx: i, endIdx: -1 };
          parts.push(curPart);
        }
      }
      if (curPart) curPart.endIdx = labels.length;

      parts.sort(function(a, b) {
        var ia = partOrder.indexOf(a.label);
        var ib = partOrder.indexOf(b.label);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });

      const curPartLabel = partOfIdx(pickerQIdx, ch);
      const curSecKey = (s.id || 'default') + '::' + ch.id + '::' + curPartLabel;
      modalCollapsedSections.delete(curSecKey);

      parts.forEach(function(part) {
        var secGroups = [];
        ch.subGroups.forEach(function(g) {
          if (g.startIdx >= part.startIdx && g.startIdx < part.endIdx) {
            secGroups.push(g);
          }
        });

        if (secGroups.length === 0) return;

        const secKey = (s.id || 'default') + '::' + ch.id + '::' + part.label;
        const isCollapsed = modalCollapsedSections.has(secKey);

        let totalSecQuestions = 0;
        let completedSecQuestions = 0;
        secGroups.forEach(function(g) {
          for (var k = 0; k < g.count; k++) {
            totalSecQuestions++;
            if (statuses[g.startIdx + k]) completedSecQuestions++;
          }
        });

        var secTitle = document.createElement('div');
        secTitle.className = 'section-header' + (isCollapsed ? ' collapsed' : '');
        secTitle.title = isCollapsed ? '点击展开本分区题号' : '点击收起本分区题号';
        secTitle.innerHTML = '<div class="sec-header-left">' +
          '<span class="sec-arrow">' + (isCollapsed ? '▸' : '▾') + '</span>' +
          '<span class="sec-title-text">' + escapeHtml(part.label) + '</span>' +
          '</div>' +
          '<span class="sec-badge">' + completedSecQuestions + '/' + totalSecQuestions + '</span>';

        secTitle.onclick = function(e) {
          e.stopPropagation();
          if (modalCollapsedSections.has(secKey)) {
            modalCollapsedSections.delete(secKey);
          } else {
            modalCollapsedSections.add(secKey);
          }
          renderModalNav();
        };
        nav.appendChild(secTitle);

        if (isCollapsed) return;

        var curSubType = null;
        secGroups.forEach(function(g) {
          if (ch.wb === '老姚高数' && ch.sections) {
            var sc = ch.sections.find(function(sec) { return g.startIdx >= sec.start && g.startIdx < sec.start + sec.count; });
            var rawLabel = ch.labels[g.startIdx] || '';
            var subType;
            if (sc && sc.subSections) {
              var sub = sc.subSections.find(function(ss) { return g.startIdx >= ss.start && g.startIdx < ss.start + ss.count; });
              subType = sub ? sub.type : ((g.startIdx < sc.start + (sc.exampleCount || 0)) ? '例题' : '补充练习');
            } else if (sc && sc.exampleCount !== undefined) {
              subType = (g.startIdx < sc.start + sc.exampleCount) ? '例题' : '补充练习';
            } else {
              subType = /例/.test(rawLabel) ? '例题' : '补充练习';
            }
            if (subType !== curSubType) {
              curSubType = subType;
              var subTitle = document.createElement('div');
              subTitle.className = 'subsection-header';
              subTitle.textContent = subType;
              nav.appendChild(subTitle);
            }
          } else if (ch.sections) {
            var matchingSec = ch.sections.find(function(sc) { return sc.start === g.startIdx; });
            if (matchingSec) {
              var subTitle = document.createElement('div');
              subTitle.className = 'subsection-header';
              subTitle.textContent = matchingSec.type;
              nav.appendChild(subTitle);
            }
          }

          var dispLabel = (ch.displayLabels && ch.displayLabels[g.startIdx]) ? ch.displayLabels[g.startIdx] : g.parentLabel;
          var secInfo = ch.sections ? ch.sections.find(function(sc) { return g.startIdx >= sc.start && g.startIdx < sc.start + sc.count; }) : null;
          var isK = ch.isKnowledge && ch.isKnowledge[g.startIdx];
          var desc = ch.itemDescs && ch.itemDescs[g.startIdx];

          var btn = document.createElement('button');
          btn.setAttribute('data-group-start', g.startIdx);
          if (desc) {
            btn.title = (secInfo ? secInfo.type + ' · ' : '') + desc;
          } else if (secInfo) {
            var subSecTitle = '';
            if (secInfo.subSections) {
              var matchedSub = secInfo.subSections.find(function(ss) { return g.startIdx >= ss.start && g.startIdx < ss.start + ss.count; });
              if (matchedSub) subSecTitle = ' · ' + matchedSub.type;
            }
            btn.title = secInfo.type + subSecTitle + (isK ? ' · ' : ' 第') + dispLabel + (isK ? '' : '题') + ' (' + g.parentLabel + ')';
          } else {
            btn.title = g.parentLabel;
          }

          var inCurGroup = (curGroup === g);
          var cls = 'nav-btn';
          if (isK) cls += ' is-knowledge';
          if (inCurGroup) cls += ' active';

          var groupLinked = false;
          for (var k = 0; k < g.count; k++) {
            var qid_k = getQid(s.id, ch.id, g.startIdx + k);
            if (myTopics.some(function(t) {
              return t.members && t.members.some(function(m) { return m.qid === qid_k; });
            })) {
              groupLinked = true;
              break;
            }
          }
          if (groupLinked) cls += ' linked';

          if (g.isParent) {
            cls += ' has-subs';
            var anyStatus = false;
            for (var k = 0; k < g.count; k++) {
              if (statuses[g.startIdx + k]) { anyStatus = true; break; }
            }
            if (anyStatus) cls += ' has-color';
            btn.className = cls.trim();

            for (var k = 0; k < g.count; k++) {
              var idx = g.startIdx + k;
              var bar = document.createElement('span');
              bar.className = 'sub-bar';
              var st = statuses[idx];
              if (st) bar.classList.add(st);
              if (inCurGroup && idx === pickerQIdx) bar.classList.add('active-sub');
              bar.style.width = (100 / g.count) + '%';
              bar.style.left = (k * 100 / g.count) + '%';
              bar.title = dispLabel + ' (' + (k + 1) + ')';
              bar.onclick = (function(targetIdx) {
                return function(e) {
                  e.stopPropagation();
                  pickerQIdx = targetIdx;
                  renderModalNav();
                  renderModalViewer();
                };
              })(idx);
              btn.appendChild(bar);
            }

            var textSpan = document.createElement('span');
            textSpan.className = 'btn-text';
            textSpan.textContent = dispLabel;
            btn.appendChild(textSpan);
          } else {
            cls += ' ' + (statuses[g.startIdx] || '');
            btn.className = cls.trim();
            btn.textContent = dispLabel;
          }

          appendBadges(btn, g.startIdx);

          btn.onclick = function() {
            pickerQIdx = g.startIdx;
            renderModalNav();
            renderModalViewer();
          };

          nav.appendChild(btn);
        });
      });

      var curActiveBtn = nav.querySelector('button.active, button.has-subs.active, .sub-bar.active-sub');
      if (curActiveBtn) {
        var targetEl = curActiveBtn.closest('button') || curActiveBtn;
        targetEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }

    // 跨学科跨书籍跨伴章精准图片路径基址解析（与主页面 getImgPath 100% 对齐）
    function getImgBaseForSubjectChapterIdx(s, ch, idx) {
      if (!s || !ch || !ch.labels || idx < 0 || idx >= ch.labels.length) return '';
      if (ch.q1000Total && ch.q1000Id && idx >= ch.ownTotal) {
        var qc = s.chapters ? s.chapters.find(function(c) { return c.id === ch.q1000Id; }) : null;
        if (qc && qc.labels && (idx - ch.ownTotal) < qc.labels.length) {
          return s.getImgPath(qc, qc.labels[idx - ch.ownTotal]);
        }
      }
      return s.getImgPath(ch, ch.labels[idx]);
    }

    var _modalSolutionImgGen = 0;
    function setModalSolutionImages(base, container, isDarkFilter) {
      if (!container) return;
      container.innerHTML = '';
      if (!base) {
        container.innerHTML = '<span style="font-size:12px;color:var(--text-muted);padding:8px;text-align:center;">暂无解析路径</span>';
        return;
      }
      var gen = ++_modalSolutionImgGen;
      function tryAdd(n) {
        var src = n === 1 ? base + '_solution.png' : base + '_solution_' + n + '.png';
        var img = document.createElement('img');
        img.alt = '解析' + (n > 1 ? ' (' + n + ')' : '');
        img.title = '点击放大查看高清图 (Alt 开启画笔标注)';
        img.style.cursor = 'zoom-in';
        img.onclick = function () {
          if (this.src && !this.src.endsWith('/')) openLightbox(this.src);
        };
        if (isDarkFilter) img.classList.add('dark-filter');
        img.onload = function () {
          if (gen !== _modalSolutionImgGen) return;
          container.appendChild(img);
          tryAdd(n + 1);
        };
        img.onerror = function () {
          if (gen === _modalSolutionImgGen && n === 1 && container.children.length === 0) {
            var ph = document.createElement('span');
            ph.style.cssText = 'font-size:12px;color:var(--text-muted);padding:8px;text-align:center;';
            ph.textContent = '暂无解析图片';
            container.appendChild(ph);
          }
        };
        img.src = src;
      }
      tryAdd(1);
    }

    function renderModalViewer() {
      var qTitleEl = document.getElementById('rmViewerQTitle');
      var qImgEl = document.getElementById('rmViewerQImg');
      var solAreaEl = document.getElementById('rmViewerSolArea');
      var solImgsEl = document.getElementById('rmViewerSolImgs');
      var btnToggleSol = document.getElementById('rmBtnToggleSol');
      var btnLinkCurrent = document.getElementById('rmBtnLinkCurrent');
      if (!qTitleEl || !qImgEl) return;

      var s = SUBJECTS.find(function(sub) { return sub.id === pickerSubjectId; }) || curSubject;
      var ch = s ? s.chapters.find(function(c) { return c.id === pickerChapterId; }) : null;
      if (!ch || !ch.labels || ch.labels.length === 0) {
        qTitleEl.textContent = '该章节暂无题目';
        qImgEl.style.display = 'none';
        if (solAreaEl) solAreaEl.style.display = 'none';
        return;
      }

      pickerQIdx = Math.max(0, Math.min(pickerQIdx, ch.total - 1));
      ensureGroups(ch);
      var label = ch.labels[pickerQIdx];
      var targetQid = getQid(s.id, ch.id, pickerQIdx);
      var curQid = getCurrentQid();
      var isCurrent = (targetQid === curQid);
      var myTopics = getTopicsForQid(curQid);
      var isLinked = myTopics.some(function(t) {
        return t.members && t.members.some(function(m) { return m.qid === targetQid; });
      });

      var base = getImgBaseForSubjectChapterIdx(s, ch, pickerQIdx);
      var qImgSrc = base ? base + '_question.png' : '';

      var g = ch.groupForIdx ? ch.groupForIdx[pickerQIdx] : null;
      var secInfo = ch.sections ? ch.sections.find(function(sec) { return pickerQIdx >= sec.start && pickerQIdx < sec.start + sec.count; }) : null;
      var isK = ch.isKnowledge && ch.isKnowledge[pickerQIdx];
      var desc = ch.itemDescs && ch.itemDescs[pickerQIdx];
      var qLabelText = '';
      if (desc) {
        qLabelText = (secInfo ? secInfo.type + ' · ' : '') + desc;
      } else if (secInfo && ch.displayLabels && ch.displayLabels[pickerQIdx] !== undefined) {
        qLabelText = secInfo.type + (isK ? ' · ' : ' 第') + ch.displayLabels[pickerQIdx] + (isK ? '' : '题');
      } else {
        qLabelText = label;
      }

      var bookDisplayName = (s.id === 'math' ? getWbLabel(pickerWb) : (ch.wb || s.name));
      qTitleEl.textContent = bookDisplayName + ' · ' + (ch.short || ch.name) + ' · ' + qLabelText + (isCurrent ? ' (当前做题)' : '');

      if (qImgSrc) {
        qImgEl.style.display = 'block';
        qImgEl.src = qImgSrc;
        qImgEl.alt = label;
        qImgEl.title = '点击放大查看高清题目 (Alt 开启画笔标注)';
        qImgEl.style.cursor = 'zoom-in';
        qImgEl.onclick = function () {
          if (this.src && !this.src.endsWith('/')) openLightbox(this.src);
        };
      } else {
        qImgEl.style.display = 'none';
      }

      var isDarkFilter = getIsDarkFilter();
      qImgEl.classList.toggle('dark-filter', isDarkFilter);

      setModalSolutionImages(base, solImgsEl, isDarkFilter);

      if (solAreaEl) {
        solAreaEl.style.display = pickerSolShown ? 'flex' : 'none';
      }
      if (btnToggleSol) {
        btnToggleSol.innerHTML = pickerSolShown ? '隐藏解析 <span class="key">Space</span>' : '显示解析 <span class="key">Space</span>';
      }

      if (btnLinkCurrent) {
        if (isCurrent) {
          btnLinkCurrent.textContent = '当前正在做';
          btnLinkCurrent.disabled = true;
          btnLinkCurrent.className = 'gel-btn btn-sm';
        } else if (isLinked) {
          btnLinkCurrent.textContent = '移出关联';
          btnLinkCurrent.disabled = false;
          btnLinkCurrent.className = 'gel-btn btn-sm rc-btn-unlink';
        } else {
          btnLinkCurrent.textContent = '关联此题到考点';
          btnLinkCurrent.disabled = false;
          btnLinkCurrent.className = 'gel-btn btn-sm';
        }
      }
    }

    function renderModalWorkbench() {
      renderModalNav();
      renderModalViewer();
    }

    function modalPickerPrevQ() {
      if (pickerQIdx > 0) {
        pickerQIdx--;
        renderModalNav();
        renderModalViewer();
      }
    }

    function modalPickerNextQ() {
      var s = SUBJECTS.find(function(sub) { return sub.id === pickerSubjectId; }) || curSubject;
      var ch = s ? s.chapters.find(function(c) { return c.id === pickerChapterId; }) : null;
      if (ch && pickerQIdx < ch.total - 1) {
        pickerQIdx++;
        renderModalNav();
        renderModalViewer();
      }
    }

    function modalPickerUpQ() {
      if (pickerQIdx - 5 >= 0) {
        pickerQIdx -= 5;
      } else {
        pickerQIdx = 0;
      }
      renderModalNav();
      renderModalViewer();
    }

    function modalPickerDownQ() {
      var s = SUBJECTS.find(function(sub) { return sub.id === pickerSubjectId; }) || curSubject;
      var ch = s ? s.chapters.find(function(c) { return c.id === pickerChapterId; }) : null;
      if (ch) {
        if (pickerQIdx + 5 < ch.total) {
          pickerQIdx += 5;
        } else {
          pickerQIdx = ch.total - 1;
        }
        renderModalNav();
        renderModalViewer();
      }
    }

    function toggleModalPickerSol() {
      pickerSolShown = !pickerSolShown;
      renderModalViewer();
    }

    function toggleModalPickerLinkCurrent() {
      var s = SUBJECTS.find(function(sub) { return sub.id === pickerSubjectId; }) || curSubject;
      var ch = s ? s.chapters.find(function(c) { return c.id === pickerChapterId; }) : null;
      if (!ch || !ch.labels) return;

      var targetQid = getQid(s.id, ch.id, pickerQIdx);
      var curQid = getCurrentQid();
      if (targetQid === curQid) return;

      var myTopics = getTopicsForQid(curQid);
      var isLinked = myTopics.some(function(t) {
        return t.members && t.members.some(function(m) { return m.qid === targetQid; });
      });

      if (isLinked) {
        myTopics.forEach(function(t) {
          removeQuestionFromTopic(t.id, targetQid);
        });
      } else {
        ensureAndLinkTargetQuestion(targetQid);
      }

      renderRelatedModalTopics();
      renderRelatedModalRecent();
      renderModalNav();
      renderModalViewer();
      renderRelatedQuestions();
      renderNav();
    }

    function previewQidInModal(qid) {
      var parsed = parseQid(qid);
      if (!parsed) return;
      var s = SUBJECTS.find(function(sub) { return sub.id === parsed.subjectId; });
      if (!s) return;
      var ch = s.chapters ? s.chapters.find(function(c) { return c.id === parsed.chapterId; }) : null;
      if (!ch) return;

      pickerSubjectId = parsed.subjectId;
      pickerChapterId = parsed.chapterId;
      pickerQIdx = parsed.qIdx;
      if (s.id === 'math') {
        pickerWb = getWbForChapter(ch);
      }
      renderModalWorkbench();
    }

    function renderRelatedModalRecent() {
      var list = document.getElementById('rmRecentList');
      if (!list) return;
      var curQid = getCurrentQid();
      var candidates = recentQuestionsHistory.filter(function(q) { return q !== curQid; });
      var myTopics = getTopicsForQid(curQid);

      if (candidates.length === 0) {
        list.innerHTML = '<span class="related-empty-hint">暂无最近浏览的其他题目</span>';
        return;
      }

      var isDarkFilter = getIsDarkFilter();
      var imgFilterClass = isDarkFilter ? ' dark-filter' : '';

      list.innerHTML = candidates.map(function(qid) {
        var meta = getQuestionMeta(qid);
        if (!meta) return '';
        var imgSrc = getImgPathForQid(qid);
        var alreadyIn = myTopics.some(function(t) {
          return t.members && t.members.some(function(m) { return m.qid === qid; });
        });
        var dotHtml = meta.status ? '<span class="rm-item-dot ' + escapeHtml(meta.status) + '" title="掌握度: ' + escapeHtml(meta.status) + '"></span>' : '';

        return '<div class="rm-item-row" data-row-qid="' + escapeHtml(qid) + '" title="点击在下方查看器中预览此题">' +
          '<div class="rm-item-info">' +
            (imgSrc ? '<img src="' + escapeHtml(imgSrc) + '" class="rm-item-thumb' + imgFilterClass + '" loading="lazy" alt="题目">' : '') +
            '<span class="rm-item-book">' + escapeHtml(meta.bookName) + '</span>' +
            '<span class="rm-item-title">' + escapeHtml(meta.chapterShort + ' ' + meta.label) + '</span>' +
            dotHtml +
          '</div>' +
          (alreadyIn ?
            '<span style="font-size:11.5px; color:#10b981; font-weight:700">已关联</span>' :
            '<button type="button" class="gel-btn btn-sm" data-link-qid="' + escapeHtml(qid) + '">+ 关联到当前题</button>'
          ) +
        '</div>';
      }).join('');

      list.querySelectorAll('button[data-link-qid]').forEach(function(btn) {
        btn.onclick = function(e) {
          e.stopPropagation();
          var targetQid = this.dataset.linkQid;
          ensureAndLinkTargetQuestion(targetQid);
          renderRelatedModalRecent();
          renderModalWorkbench();
        };
      });

      list.querySelectorAll('.rm-item-row').forEach(function(row) {
        row.onclick = function(e) {
          if (e.target.closest('button')) return;
          var qid = this.dataset.rowQid;
          if (qid) previewQidInModal(qid);
        };
      });
    }

    function ensureAndLinkTargetQuestion(targetQid, note) {
      var curQid = getCurrentQid();
      var myTopics = getTopicsForQid(curQid);
      var topic = null;

      if (myTopics.length > 0) {
        topic = myTopics[0];
      } else {
        var curMeta = getQuestionMeta(curQid);
        var autoName = (curMeta ? curMeta.displayTitle : '同类题考点') + ' 关联组';
        topic = createRelatedTopic(autoName, curQid);
      }

      addQuestionToTopic(topic.id, curQid);
      addQuestionToTopic(topic.id, targetQid, note || '');
      renderRelatedModalTopics();
      renderRelatedModalRecent();
      renderRelatedQuestions();
      renderNav();
      renderModalWorkbench();
    }

    function initRelatedModal() {
      var btnOpen = document.getElementById('btnOpenRelatedModal');
      if (btnOpen) btnOpen.onclick = openRelatedModal;
      var btnClose = document.getElementById('btnCloseRelatedModal');
      if (btnClose) btnClose.onclick = closeRelatedModal;
      var btnDone = document.getElementById('btnDoneRelatedModal');
      if (btnDone) btnDone.onclick = closeRelatedModal;

      // 点击模态框外部遮罩层直接关闭
      var modal = document.getElementById('relatedModal');
      if (modal) {
        modal.addEventListener('click', function(e) {
          if (e.target === modal) {
            closeRelatedModal();
          }
        });
      }

      // 主页面快速关联考点浮层绑定
      var btnQuickAdd = document.getElementById('btnQuickAddTopic');
      if (btnQuickAdd) btnQuickAdd.onclick = function(e) {
        e.stopPropagation();
        toggleQuickTopicPopover();
      };
      // 点击非浮层区域自动关闭快速关联考点浮层
      document.addEventListener('click', function(e) {
        var pop = document.getElementById('quickTopicPopover');
        if (pop && pop.style.display !== 'none') {
          var btnQuick = document.getElementById('btnQuickAddTopic');
          if (!pop.contains(e.target) && (!btnQuick || !btnQuick.contains(e.target))) {
            pop.style.display = 'none';
          }
        }
      });
      var btnCloseQuick = document.getElementById('btnCloseQuickTopic');
      if (btnCloseQuick) btnCloseQuick.onclick = function(e) {
        e.stopPropagation();
        var pop = document.getElementById('quickTopicPopover');
        if (pop) pop.style.display = 'none';
      };
      var inputQuickSearch = document.getElementById('inputQuickTopicSearch');
      var quickPreviewRow = document.getElementById('quickTopicPreviewRow');
      var quickPreviewContent = document.getElementById('quickTopicPreview');
      var updateQuickPreview = function() {
        if (!inputQuickSearch) return;
        var val = inputQuickSearch.value.trim();
        if (quickPreviewRow && quickPreviewContent) {
          if (val && (val.includes('$') || val.includes('\\') || /[*_`~\[\]<>]/.test(val))) {
            quickPreviewRow.style.display = 'flex';
            quickPreviewContent.innerHTML = renderTopicTextHtml(val);
          } else {
            quickPreviewRow.style.display = 'none';
            quickPreviewContent.innerHTML = '';
          }
        }
      };
      if (inputQuickSearch) {
        inputQuickSearch.addEventListener('input', function() {
          renderQuickTopicPopover();
          updateQuickPreview();
        });
        inputQuickSearch.onkeydown = function(e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            var btnCreate = document.getElementById('btnQuickCreateTopic');
            if (btnCreate) btnCreate.click();
          }
        };
      }
      var btnQuickCreate = document.getElementById('btnQuickCreateTopic');
      if (btnQuickCreate) {
        btnQuickCreate.onclick = function(e) {
          e.stopPropagation();
          var name = inputQuickSearch ? inputQuickSearch.value.trim() : '';
          if (!name) {
            if (inputQuickSearch) inputQuickSearch.focus();
            return;
          }
          createRelatedTopic(name, getCurrentQid());
          if (inputQuickSearch) inputQuickSearch.value = '';
          updateQuickPreview();
          renderRelatedQuestions();
          renderNav();
          renderQuickTopicPopover();
          if (window.storageSync && typeof window.storageSync.showToast === 'function') {
            window.storageSync.showToast('已创建并关联考点：“' + name + '”', 'success');
          }
        };
      }
      var btnQuickL = document.getElementById('btnQuickOpenLModal');
      if (btnQuickL) {
        btnQuickL.onclick = function(e) {
          e.stopPropagation();
          var pop = document.getElementById('quickTopicPopover');
          if (pop) pop.style.display = 'none';
          openRelatedModal();
        };
      }

      // 点击页面其他位置收起快速考点浮层
      document.addEventListener('click', function(e) {
        var pop = document.getElementById('quickTopicPopover');
        var btnQuickAdd = document.getElementById('btnQuickAddTopic');
        if (pop && pop.style.display !== 'none') {
          if (!pop.contains(e.target) && e.target !== btnQuickAdd && !btnQuickAdd.contains(e.target)) {
            pop.style.display = 'none';
          }
        }
      });

      // 模态框左侧全库考点搜索过滤
      var inputFilter = document.getElementById('inputFilterTopics');
      var btnClearFilter = document.getElementById('btnClearFilterTopics');
      if (inputFilter) {
        inputFilter.addEventListener('input', function() {
          if (btnClearFilter) btnClearFilter.style.display = this.value ? 'inline-flex' : 'none';
          renderRelatedModalTopics();
        });
        if (btnClearFilter) {
          btnClearFilter.onclick = function(e) {
            e.stopPropagation();
            inputFilter.value = '';
            btnClearFilter.style.display = 'none';
            renderRelatedModalTopics();
            inputFilter.focus();
          };
        }
      }

      var btnToggleSol = document.getElementById('rmBtnToggleSol');
      if (btnToggleSol) btnToggleSol.onclick = toggleModalPickerSol;
      var btnLinkCurrent = document.getElementById('rmBtnLinkCurrent');
      if (btnLinkCurrent) btnLinkCurrent.onclick = toggleModalPickerLinkCurrent;

      var btnJumpBack = document.getElementById('btnJumpBack');
      if (btnJumpBack) btnJumpBack.onclick = returnToPreviousQuestion;
      var btnJumpClose = document.getElementById('btnJumpClose');
      if (btnJumpClose) btnJumpClose.onclick = closeJumpReturnBar;

      // 新建主题按钮、实时公式预览与快捷输入工具栏
      var btnCreate = document.getElementById('btnCreateTopic');
      var inputName = document.getElementById('inputNewTopicName');
      var btnClearNew = document.getElementById('btnClearNewTopic');
      var newPreviewWrap = document.getElementById('rmTopicPreviewWrap');
      var newPreviewEl = document.getElementById('rmTopicPreview');
      var newToolbar = document.getElementById('rmNewTopicToolbar');

      var updateNewPreview = function() {
        if (!inputName || !newPreviewEl) return;
        var val = inputName.value.trim();
        if (btnClearNew) btnClearNew.style.display = inputName.value ? 'inline-flex' : 'none';
        if (val) {
          if (newPreviewWrap) newPreviewWrap.style.display = 'flex';
          newPreviewEl.innerHTML = renderTopicTextHtml(val);
        } else {
          if (newPreviewWrap) newPreviewWrap.style.display = 'none';
          newPreviewEl.innerHTML = '';
        }
      };

      if (inputName) {
        inputName.addEventListener('input', updateNewPreview);
        inputName.onkeydown = function(e) {
          if (e.key === 'Enter') { e.preventDefault(); doCreate(); }
        };
        if (btnClearNew) {
          btnClearNew.onclick = function(e) {
            e.stopPropagation();
            inputName.value = '';
            btnClearNew.style.display = 'none';
            updateNewPreview();
            inputName.focus();
          };
        }
      }

      if (newToolbar && inputName) {
        newToolbar.addEventListener('click', function(e) {
          var btn = e.target.closest('.tqt-btn');
          if (!btn) return;
          var snippet = btn.dataset.insert;
          if (snippet) {
            e.preventDefault();
            insertSnippetIntoField(inputName, snippet, updateNewPreview);
          }
        });
      }

      if (btnCreate && inputName) {
        var doCreate = function() {
          var name = inputName.value.trim();
          if (!name) {
            inputName.focus();
            if (window.storageSync && typeof window.storageSync.showToast === 'function') {
              window.storageSync.showToast('请输入考点主题名称', 'warning');
            }
            return;
          }
          createRelatedTopic(name, getCurrentQid());
          inputName.value = '';
          updateNewPreview();
          renderRelatedModalTopics();
          renderRelatedQuestions();
          renderNav();
          renderModalWorkbench();
          if (window.storageSync && typeof window.storageSync.showToast === 'function') {
            window.storageSync.showToast('已创建考点主题：“' + name + '”', 'success');
          }
        };
        btnCreate.onclick = doCreate;
      }

      // 考点重命名模态框控件绑定
      var btnCloseRename = document.getElementById('btnCloseRenameTopic');
      if (btnCloseRename) btnCloseRename.onclick = closeRenameTopicModal;
      var btnCancelRename = document.getElementById('btnCancelRenameTopic');
      if (btnCancelRename) btnCancelRename.onclick = closeRenameTopicModal;
      var btnConfirmRename = document.getElementById('btnConfirmRenameTopic');
      if (btnConfirmRename) btnConfirmRename.onclick = submitRenameTopic;

      var inputRename = document.getElementById('inputRenameTopicName');
      var btnClearRename = document.getElementById('btnClearRenameTopic');
      var previewRename = document.getElementById('renameTopicPreview');
      var updateRenamePreview = function() {
        if (!inputRename || !previewRename) return;
        var val = inputRename.value.trim();
        if (btnClearRename) btnClearRename.style.display = inputRename.value ? 'inline-flex' : 'none';
        previewRename.innerHTML = val ? renderTopicTextHtml(val) : '<span style="color:var(--text-muted)">（暂无输入内容）</span>';
      };
      if (inputRename) {
        inputRename.addEventListener('input', updateRenamePreview);
        inputRename.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            submitRenameTopic();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            closeRenameTopicModal();
          }
        });
        if (btnClearRename) {
          btnClearRename.onclick = function(e) {
            e.stopPropagation();
            inputRename.value = '';
            btnClearRename.style.display = 'none';
            updateRenamePreview();
            inputRename.focus();
          };
        }
      }

      var renameToolbar = document.getElementById('renameQuickToolbar');
      if (renameToolbar && inputRename) {
        renameToolbar.addEventListener('click', function(e) {
          var btn = e.target.closest('.tqt-btn');
          if (!btn) return;
          var snippet = btn.dataset.insert;
          if (snippet) {
            e.preventDefault();
            insertSnippetIntoField(inputRename, snippet, updateRenamePreview);
          }
        });
      }

      // Tab 切换
      var tabs = document.querySelectorAll('.rm-tab-btn');
      tabs.forEach(function(btn) {
        btn.onclick = function() {
          tabs.forEach(function(b) { b.classList.remove('active'); });
          this.classList.add('active');
          var tabKey = this.dataset.tab;
          var pPicker = document.getElementById('rmTabPicker');
          var pRecent = document.getElementById('rmTabRecent');
          var pSearch = document.getElementById('rmTabSearch');
          if (pPicker) pPicker.style.display = (tabKey === 'picker') ? 'flex' : 'none';
          if (pRecent) pRecent.style.display = (tabKey === 'recent') ? 'flex' : 'none';
          if (pSearch) pSearch.style.display = (tabKey === 'search') ? 'flex' : 'none';
        };
      });

      // 搜索题号
      var searchInput = document.getElementById('inputRelatedSearch');
      var btnClearSearch = document.getElementById('btnClearRelatedSearch');
      var searchResults = document.getElementById('rmSearchResults');
      if (searchInput && searchResults) {
        var doSearch = function() {
          var q = searchInput.value.trim().toLowerCase();
          if (btnClearSearch) btnClearSearch.style.display = searchInput.value ? 'inline-flex' : 'none';
          if (!q) { searchResults.innerHTML = ''; return; }
          var curQid = getCurrentQid();
          var matches = [];

          SUBJECTS.forEach(function(s) {
            if (!s.chapters) return;
            s.chapters.forEach(function(c) {
              if (!c.labels) return;
              c.labels.forEach(function(l, idx) {
                var qid = getQid(s.id, c.id, idx);
                if (qid === curQid) return;
                var fullStr = ((c.wb || s.name) + ' ' + (c.short || c.name) + ' ' + l).toLowerCase();
                if (fullStr.indexOf(q) !== -1 || l.toLowerCase().indexOf(q) !== -1) {
                  matches.push(qid);
                }
              });
            });
          });

          if (matches.length === 0) {
            searchResults.innerHTML = '<span class="related-empty-hint">未找到匹配的题目</span>';
            return;
          }

          var myTopics = getTopicsForQid(curQid);
          var isDarkFilter = getIsDarkFilter();
          var imgFilterClass = isDarkFilter ? ' dark-filter' : '';

          searchResults.innerHTML = matches.slice(0, 20).map(function(qid) {
            var meta = getQuestionMeta(qid);
            if (!meta) return '';
            var imgSrc = getImgPathForQid(qid);
            var alreadyIn = myTopics.some(function(t) {
              return t.members && t.members.some(function(m) { return m.qid === qid; });
            });
            var dotHtml = meta.status ? '<span class="rm-item-dot ' + escapeHtml(meta.status) + '" title="掌握度: ' + escapeHtml(meta.status) + '"></span>' : '';

            return '<div class="rm-item-row" data-row-qid="' + escapeHtml(qid) + '" title="点击在下方查看器中预览此题">' +
              '<div class="rm-item-info">' +
                (imgSrc ? '<img src="' + escapeHtml(imgSrc) + '" class="rm-item-thumb' + imgFilterClass + '" loading="lazy" alt="题目">' : '') +
                '<span class="rm-item-book">' + escapeHtml(meta.bookName) + '</span>' +
                '<span class="rm-item-title">' + escapeHtml(meta.chapterShort + ' ' + meta.label) + '</span>' +
                dotHtml +
              '</div>' +
              (alreadyIn ?
                '<span style="font-size:11.5px; color:#10b981; font-weight:700">已关联</span>' :
                '<button type="button" class="gel-btn btn-sm" data-search-qid="' + escapeHtml(qid) + '">+ 关联此题</button>'
              ) +
            '</div>';
          }).join('');

          searchResults.querySelectorAll('button[data-search-qid]').forEach(function(btn) {
            btn.onclick = function(e) {
              e.stopPropagation();
              var targetQid = this.dataset.searchQid;
              ensureAndLinkTargetQuestion(targetQid);
              renderModalWorkbench();
            };
          });

          searchResults.querySelectorAll('.rm-item-row').forEach(function(row) {
            row.onclick = function(e) {
              if (e.target.closest('button')) return;
              var qid = this.dataset.rowQid;
              if (qid) previewQidInModal(qid);
            };
          });
        };

        searchInput.oninput = doSearch;
        if (btnClearSearch) {
          btnClearSearch.onclick = function(e) {
            e.stopPropagation();
            searchInput.value = '';
            btnClearSearch.style.display = 'none';
            doSearch();
            searchInput.focus();
          };
        }
      }

      // ===== L 面板滚轮彻底隔离机制 =====
      function isolateWheelScroll(element) {
        if (!element) return;
        element.addEventListener('wheel', function(e) {
          var scrollTop = this.scrollTop;
          var scrollHeight = this.scrollHeight;
          var height = this.clientHeight;
          var delta = e.deltaY;
          var up = delta < 0;

          var prevent = false;
          if (up && scrollTop <= 0) {
            prevent = true;
          } else if (!up && scrollTop + height >= scrollHeight - 1) {
            prevent = true;
          }

          if (prevent) {
            e.preventDefault();
            e.stopPropagation();
          }
        }, { passive: false });
      }

      function setupModalWheelIsolation(backdropEl) {
        if (!backdropEl) return;
        backdropEl.addEventListener('wheel', function(e) {
          if (e.target === backdropEl) {
            e.preventDefault();
            e.stopPropagation();
          }
        }, { passive: false });
      }

      setupModalWheelIsolation(document.getElementById('relatedModal'));
      setupModalWheelIsolation(document.getElementById('topicRenameModal'));
      isolateWheelScroll(document.getElementById('rmNavSection'));
      isolateWheelScroll(document.getElementById('rmAvailableTopics'));
      isolateWheelScroll(document.getElementById('rmViewerBody'));
      isolateWheelScroll(document.getElementById('rmRecentList'));
      isolateWheelScroll(document.getElementById('rmSearchResults'));
      isolateWheelScroll(document.getElementById('renameTopicPreview'));
      isolateWheelScroll(document.getElementById('quickTopicList'));

      document.addEventListener('click', function(e) {
        if (!relatedModalOpen) return;
        var bar = document.getElementById('rmTitleBar');
        if (bar && !bar.contains(e.target)) {
          closeAllModalTitlePanels();
        }
      });
    }


  function formatQidDisplay(qid) {
    var meta = getQuestionMeta(qid);
    return meta ? meta.displayTitle : (qid || '');
  }

  // 暴露全局 TopicManager 命名空间
  window.TopicManager = {
    getRelatedTopics: function () {
      if (!_topicsLoaded) loadRelatedTopics();
      return relatedTopics;
    },
    getRelatedAffinity: function () { return relatedAffinity; },
    loadTopics: loadRelatedTopics,
    saveTopics: saveRelatedTopics,
    loadAffinity: loadRelatedAffinity,
    saveAffinity: saveRelatedAffinity,
    recordRecentQuestion: recordRecentQuestion,
    getTopicsForQid: getTopicsForQid,
    getRelatedQuestionsForQid: getRelatedQuestionsForQid,
    renderRelatedQuestions: renderRelatedQuestions,
    jumpToQid: jumpToQid,
    openModal: openRelatedModal,
    closeModal: closeRelatedModal,
    initModal: initRelatedModal,
    isModalOpen: function () { return relatedModalOpen; },
    isRenameModalOpen: function () { return topicRenameModalOpen; },
    getQid: getQid,
    getCurrentQid: getCurrentQid,
    parseQid: parseQid,
    formatQidDisplay: formatQidDisplay,
    createTopic: createRelatedTopic,
    addQuestion: addQuestionToTopic,
    removeQuestion: removeQuestionFromTopic,
    getPairKey: getPairKey,
    getAffinityPairKey: getPairKey,
    normalizeSubjectId: normalizeSubjectId,
    getAffinity: function (q1, q2) {
      var pKey = getPairKey(q1, q2);
      return (relatedAffinity.pairs && relatedAffinity.pairs[pKey]) || 0;
    },
    getTopicAffinity: function (q1, q2) {
      var pKey = getPairKey(q1, q2);
      return (relatedAffinity.pairs && relatedAffinity.pairs[pKey]) || 0;
    },
    recordAffinity: function (q1, q2, delta) {
      var pKey = getPairKey(q1, q2);
      if (!relatedAffinity.pairs) relatedAffinity.pairs = {};
      relatedAffinity.pairs[pKey] = ((relatedAffinity.pairs[pKey] || 0) + (delta || 1));
      saveRelatedAffinity();
    },
    recordTopicAffinity: function (q1, q2, delta) {
      var pKey = getPairKey(q1, q2);
      if (!relatedAffinity.pairs) relatedAffinity.pairs = {};
      relatedAffinity.pairs[pKey] = ((relatedAffinity.pairs[pKey] || 0) + (delta || 1));
      saveRelatedAffinity();
    },
    getQuestionData: function (qid) {
      var res = getRelatedQuestionsForQid(qid);
      return res || { topics: [], relatedQuestions: [] };
    },
    getQuestionRelatedData: function (qid) {
      var res = getRelatedQuestionsForQid(qid);
      return res || { topics: [], relatedQuestions: [] };
    },
    parseTopicAndSubTopic: parseTopicAndSubTopic,
    modalPickerPrevQ: modalPickerPrevQ,
    modalPickerNextQ: modalPickerNextQ,
    modalPickerUpQ: modalPickerUpQ,
    modalPickerDownQ: modalPickerDownQ,
    toggleModalPickerSol: toggleModalPickerSol,
    toggleModalPickerLinkCurrent: toggleModalPickerLinkCurrent,
    closeRenameTopicModal: closeRenameTopicModal,
    closeQuickTopicPopover: closeQuickTopicPopover,
    sortTopicsList: sortTopicsList,
    hasTopicsForQid: hasTopicsForQid,
    invalidateTopicIndex: invalidateTopicCache
  };

  // 全局接口互通别名（动态 Getter/Setter 保证多模块读写强一致）
  try {
    Object.defineProperty(window, 'relatedTopics', {
      get: function () { return relatedTopics; },
      set: function (v) { relatedTopics = v || {}; invalidateTopicCache(); },
      configurable: true
    });
    Object.defineProperty(window, 'relatedAffinity', {
      get: function () { return relatedAffinity; },
      set: function (v) { relatedAffinity = v || { pairs: {}, customOrders: {} }; },
      configurable: true
    });
  } catch (e) {
    window.relatedTopics = relatedTopics;
    window.relatedAffinity = relatedAffinity;
  }
  window.loadRelatedTopics = loadRelatedTopics;
  window.saveRelatedTopics = saveRelatedTopics;
  window.getQid = getQid;
  window.getCurrentQid = getCurrentQid;
  window.parseQid = parseQid;
  window.formatQidDisplay = formatQidDisplay;
  window.recordRecentQuestion = recordRecentQuestion;
  window.renderRelatedQuestions = renderRelatedQuestions;
  window.jumpToQid = jumpToQid;
  window.openRelatedModal = openRelatedModal;
  window.closeRelatedModal = closeRelatedModal;
  window.initRelatedModal = initRelatedModal;
  window.createRelatedTopic = createRelatedTopic;
  window.deleteRelatedTopic = deleteRelatedTopic;
  window.addQuestionToTopic = addQuestionToTopic;
  window.removeQuestionFromTopic = removeQuestionFromTopic;
  window.getPairKey = getPairKey;
  window.parseTopicAndSubTopic = parseTopicAndSubTopic;
  window.getTopicsForQid = getTopicsForQid;
  window.hasTopicsForQid = hasTopicsForQid;
  window.invalidateTopicIndex = invalidateTopicCache;
  window.getRelatedQuestionsForQid = getRelatedQuestionsForQid;
  window.modalPickerPrevQ = modalPickerPrevQ;
  window.modalPickerNextQ = modalPickerNextQ;
  window.modalPickerUpQ = modalPickerUpQ;
  window.modalPickerDownQ = modalPickerDownQ;
  window.toggleModalPickerSol = toggleModalPickerSol;
  window.toggleModalPickerLinkCurrent = toggleModalPickerLinkCurrent;
  window.closeRenameTopicModal = closeRenameTopicModal;
  window.closeQuickTopicPopover = closeQuickTopicPopover;
  window.sortTopicsList = sortTopicsList;

  try {
    Object.defineProperty(window, 'relatedModalOpen', {
      get: function () { return relatedModalOpen; },
      set: function (v) { relatedModalOpen = !!v; },
      configurable: true
    });
    Object.defineProperty(window, 'topicRenameModalOpen', {
      get: function () { return topicRenameModalOpen; },
      set: function (v) { topicRenameModalOpen = !!v; },
      configurable: true
    });
  } catch (e) {}

  // 脚本载入立即自我水合，彻底杜绝切科目/刷新导致的考点空对象问题
  try {
    loadRelatedTopics();
  } catch (eInit) {}

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        if (!_topicsLoaded) loadRelatedTopics();
      });
    }
  }

})();
