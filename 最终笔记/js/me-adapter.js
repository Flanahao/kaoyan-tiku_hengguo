/**
 * Knowledge Graph → Mind Elixir data
 */
(function (root) {
  'use strict';

  function graphToMindElixir(graph) {
    var S = root.NoteSchema;
    var nodes = graph.nodes || [];
    var tree = S.toTree(nodes);

    // 若出现多个根（异常数据），以第一个 chapter 为根，其余挂为其子节点
    var rootNode = tree.find(function (n) { return n.type === S.TYPES.CHAPTER; }) || tree[0];
    if (!rootNode) {
      rootNode = {
        id: graph.chapterId || 'root',
        title: graph.title || '知识树',
        type: 'chapter',
        bodyId: graph.chapterId,
        children: []
      };
    } else if (tree.length > 1) {
      rootNode.children = (rootNode.children || []).concat(
        tree.filter(function (n) { return n !== rootNode; })
      );
    }

    function walk(node, expandedDepth, depth) {
      var me = {
        id: node.id,
        topic: node.title || node.id,
        data: {
          type: node.type,
          bodyId: node.bodyId,
          summary: node.summary || '',
          level: node.level
        },
        expanded: depth < expandedDepth,
        children: []
      };
      if (node.type === 'sync') {
        me.topic = '↔ ' + me.topic;
        me.data.isSync = true;
      }
      (node.children || []).forEach(function (c) {
        me.children.push(walk(c, expandedDepth, depth + 1));
      });
      if (!me.children.length) delete me.children;
      return me;
    }

    return {
      nodeData: walk(rootNode, 2, 0),
      direction: 2
    };
  }

  /** 树节点 id → 线性正文锚点 */
  function bodyIdForNode(graph, nodeId) {
    var nodes = graph.nodes || [];
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].id === nodeId) return nodes[i].bodyId || nodes[i].id;
    }
    return null;
  }

  root.MeAdapter = {
    graphToMindElixir: graphToMindElixir,
    bodyIdForNode: bodyIdForNode
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
