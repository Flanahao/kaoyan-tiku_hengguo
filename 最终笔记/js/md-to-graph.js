/**
 * Markdown → Knowledge Graph
 * 规则：按标题层级连续建树（不锁死两级）；缺层时挂到最近祖先；
 * 「同步块」引用抽为 sync 叶子节点；正文仍绑定标题锚点 bodyId。
 */
(function (root) {
  'use strict';

  function parseMdToGraph(md, options) {
    var opts = options || {};
    var chapterId = opts.chapterId || 'ch';
    var S = root.NoteSchema;
    if (!S) throw new Error('NoteSchema not loaded');

    var lines = String(md || '').split(/\r?\n/);
    var headings = [];
    var i, m, inFence = false;

    for (i = 0; i < lines.length; i++) {
      if (/^```/.test(lines[i])) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      m = /^(#{1,6})\s+(.+)$/.exec(lines[i]);
      if (!m) continue;
      var level = m[1].length;
      var rawTitle = m[2].trim();
      var title = rawTitle.replace(/[*`]/g, '').trim();
      var bodyId = S.slugify(level, title);
      headings.push({
        lineIndex: i,
        level: level,
        title: title,
        bodyId: bodyId,
        type: S.typeFromHeadingLevel(level, title)
      });
    }

    // 每段标题后的正文范围 + 抽取同步块
    var nodes = [];
    var usedIds = {};
    var stack = []; // {level, id}
    var orderCounter = 0;
    var rootId = null;
    var rootLevel = null;

    function uniqueId(base) {
      var id = base;
      var n = 2;
      while (usedIds[id]) {
        id = base + '-' + n;
        n++;
      }
      usedIds[id] = true;
      return id;
    }

    function rangeContent(startLine, endLine) {
      var buf = [];
      for (var k = startLine; k < endLine && k < lines.length; k++) buf.push(lines[k]);
      return buf.join('\n');
    }

    for (i = 0; i < headings.length; i++) {
      var h = headings[i];
      var end = i + 1 < headings.length ? headings[i + 1].lineIndex : lines.length;
      var bodyMd = rangeContent(h.lineIndex + 1, end);
      var isRoot = rootId === null;

      // 父节点：level 严格更小的最近祖先；不得弹出根
      while (stack.length && stack[stack.length - 1].level >= h.level) stack.pop();
      // 同级或更高级标题（如 # §1 与 # 第1章）→ 挂到章根
      var parentId;
      if (isRoot) {
        parentId = null;
        rootLevel = h.level;
      } else if (!stack.length || h.level <= rootLevel) {
        parentId = rootId;
      } else {
        parentId = stack[stack.length - 1].id;
      }

      var nodeId;
      if (isRoot) {
        nodeId = uniqueId(chapterId);
        rootId = nodeId;
      } else {
        nodeId = uniqueId(h.bodyId);
        h.bodyId = nodeId;
      }

      var summary = '';
      var firstPara = bodyMd.split(/\n\s*\n/).find(function (p) {
        var t = p.trim();
        return t && !/^```/.test(t) && !/^>/.test(t) && !/^\|/.test(t) && !/^#{1,6}\s/.test(t);
      });
      if (firstPara) {
        summary = firstPara
          .replace(/\$\$[\s\S]*?\$\$/g, ' … ')
          .replace(/\$[^$]+\$/g, '…')
          .replace(/[*`>]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 40);
      }

      var node = {
        id: nodeId,
        parentId: parentId,
        type: isRoot ? S.TYPES.CHAPTER : h.type,
        title: isRoot
          ? (h.title.replace(/^第\d+章\s*[　 ]*/, '') || h.title)
          : h.title,
        level: isRoot ? 1 : h.level,
        order: orderCounter++,
        bodyId: isRoot ? nodeId : h.bodyId,
        summary: summary,
        meta: {
          headingLevel: h.level,
          line: h.lineIndex + 1
        }
      };
      nodes.push(node);
      stack.push({ level: h.level, id: nodeId });

      var syncRe = /^>\s*(?:\*\*)?同步块(?:\*\*)?[：:]\s*(.+)$/gm;
      var sm;
      var syncCount = 0;
      while ((sm = syncRe.exec(bodyMd)) !== null) {
        var syncTitle = sm[1].replace(/\s+/g, ' ').trim();
        var syncId = uniqueId(nodeId + '.sync.' + syncCount++);
        nodes.push({
          id: syncId,
          parentId: nodeId,
          type: S.TYPES.SYNC,
          title: syncTitle.length > 28 ? syncTitle.slice(0, 28) + '…' : syncTitle,
          level: (node.level || 1) + 1,
          order: orderCounter++,
          bodyId: node.bodyId,
          summary: syncTitle,
          meta: { syncRef: syncTitle }
        });
      }
    }

    return {
      chapterId: chapterId,
      title: nodes[0] ? nodes[0].title : (opts.title || chapterId),
      nodes: nodes,
      generatedAt: new Date().toISOString()
    };
  }

  root.MdToGraph = {
    parse: parseMdToGraph
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
