/**
 * Knowledge Schema — 知识点节点规范
 * 线性笔记、知识树、后续题目标签共用同一套 id / 父子关系 / 正文锚点。
 */
(function (root) {
  'use strict';

  var TYPES = {
    CHAPTER: 'chapter',
    SECTION: 'section',
    POINT: 'point',
    METHOD: 'method',
    THEOREM: 'theorem',
    SYNC: 'sync'
  };

  /** 标题层级 → 默认节点类型（内容驱动，层级延续） */
  function typeFromHeadingLevel(level, title) {
    var t = String(title || '');
    // 章标题
    if (/^第\s*\d+\s*章/.test(t)) return TYPES.CHAPTER;
    // §k 一律为章下一级节目（即使 MD 里写成 #）
    if (/^§\s*\d+/.test(t)) return TYPES.SECTION;
    if (/同步块/.test(t)) return TYPES.SYNC;
    if (level <= 2) return TYPES.SECTION;
    if (/^（[一二三四五六七八九十]+）/.test(t) || /求极限的方法|利用.+求极限/.test(t)) {
      return TYPES.METHOD;
    }
    if (/【定义|【定理|【推论/.test(t)) return TYPES.THEOREM;
    return TYPES.POINT;
  }

  /** 稳定 slug：树节点 bodyId 与线性视图标题 id 共用 */
  function slugify(level, title) {
    var s = String(title || '')
      .replace(/[*`]/g, '')
      .replace(/[（(]/g, '-')
      .replace(/[）)]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^\w一-龥§-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
    return 'n-' + level + '-' + s;
  }

  /**
   * 扁平节点表 → 树
   * @param {Array} nodes [{id,parentId,title,level,type,bodyId,summary,order,meta}]
   */
  function toTree(nodes) {
    var map = {};
    var roots = [];
    nodes.forEach(function (n) { map[n.id] = Object.assign({ children: [] }, n); });
    nodes.forEach(function (n) {
      var node = map[n.id];
      if (n.parentId && map[n.parentId]) {
        map[n.parentId].children.push(node);
      } else {
        roots.push(node);
      }
    });
    function sortRec(list) {
      list.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      list.forEach(function (x) { sortRec(x.children || []); });
    }
    sortRec(roots);
    return roots;
  }

  function chapterRoot(treeOrNodes) {
    if (Array.isArray(treeOrNodes) && treeOrNodes.length && treeOrNodes[0].id && !treeOrNodes[0].children) {
      var t = toTree(treeOrNodes);
      return t[0] || null;
    }
    return treeOrNodes[0] || null;
  }

  function findById(nodes, id) {
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].id === id) return nodes[i];
    }
    return null;
  }

  /** 由 Graph 节点生成线性视图用的目录项 */
  function tocFromNodes(nodes) {
    return nodes
      .filter(function (n) { return n.type !== TYPES.SYNC; })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); })
      .map(function (n) {
        return {
          level: n.level,
          text: n.title,
          slug: n.bodyId || n.id,
          id: n.id,
          type: n.type
        };
      });
  }

  root.NoteSchema = {
    TYPES: TYPES,
    typeFromHeadingLevel: typeFromHeadingLevel,
    slugify: slugify,
    toTree: toTree,
    chapterRoot: chapterRoot,
    findById: findById,
    tocFromNodes: tocFromNodes
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
