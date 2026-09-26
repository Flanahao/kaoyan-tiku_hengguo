(function () {
  'use strict';

  // 1. 获取 MindMap 构造函数
  const MindMap = (window.simpleMindMap && (window.simpleMindMap.default || window.simpleMindMap)) || window.MindMap;
  if (!MindMap) {
    console.error('[Mindmap Sandbox] 无法找到 SimpleMindMap 构造函数，请检查 vendor 脚本是否正确加载。');
    return;
  }

  const container = document.getElementById('mindMapContainer');
  if (!container) {
    console.error('[Mindmap Sandbox] 找不到挂载容器 #mindMapContainer');
    return;
  }

  // 2. 注册现代清晰视觉主题 (居中直角折线与二级浅灰底色卡片规范)
  MindMap.defineTheme('mindmap_modern', {
    backgroundColor: '#f8f9fa',
    lineColor: '#3370ff',       // 品牌蓝分支连线
    lineWidth: 2,
    lineStyle: 'straight',      // 直角折线模式 (包含水平延伸与垂直拐角)
    lineRadius: 8,              // 折线拐角圆角 8px
    nodeUseLineStyle: false,    // 关闭下划线横线模式，使连线精准垂直居中对接
    root: {
      shape: 'rectangle',
      fillColor: '#3370ff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
      borderColor: 'transparent',
      borderWidth: 0,
      borderRadius: 8,
      paddingX: 20,
      paddingY: 12
    },
    second: {
      shape: 'rectangle',
      marginX: 64,
      marginY: 18,
      fillColor: '#eff0f1',     // 二级节点专属浅灰底色卡片
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      color: '#1f2329',
      fontSize: 14,
      fontWeight: '500',
      borderColor: 'transparent',
      borderWidth: 0,
      borderRadius: 6,
      hoverRectColor: '#3370ff',
      paddingX: 14,
      paddingY: 7
    },
    node: {
      shape: 'rectangle',
      marginX: 42,
      marginY: 10,
      fillColor: 'transparent', // 三级及以上纯文本无底色
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      color: '#1f2329',
      fontSize: 13,
      fontWeight: 'normal',
      borderColor: 'transparent',
      borderWidth: 0,
      borderRadius: 0,
      hoverRectColor: '#3370ff',
      paddingX: 8,
      paddingY: 4
    }
  });

  // 3. 实例化思维导图
  const mindMap = new MindMap({
    el: container,
    data: window.defaultMindMapData || { data: { text: '根节点' }, children: [] },
    layout: 'logicalStructure', // 经典逻辑结构图（向右水平展开）
    theme: 'mindmap_modern',    // 现代商务质感主题
    enableFreeDrag: false,      // 禁用自由散落拖拽，强制树状吸附
    autoMoveWhenMouseInEdgeOnDrag: true, // 拖动靠近视口边缘时自动滚动画布
    useLeftKeySelectionRightKeyDrag: true, // 空白处左键框选，右键拖拽平移画布
    mouseScaleCenterUseMousePosition: true, // 鼠标滚轮缩放以当前光标所在点为中心
    dragPlaceholderLineConfig: {
      color: '#3370ff',
      width: 2.5
    },
    dragPlaceholderRectFill: 'rgba(51, 112, 255, 0.15)',
    isUseCustomNodeContent: true,
    customCreateNodeContent: (node) => {
      if (window.MindMapNodeRenderer) {
        return window.MindMapNodeRenderer.render(node);
      }
      return null;
    }
  });

  // 4. 全局暴露实例供测试脚本与调试使用
  window._mindMapInstance = mindMap;

  // 5. 初始化磁吸拖拽增强器与原位编辑器
  if (window.MindMapDragEnhancer) {
    window._mindMapDragEnhancer = window._mindMapDragEnhancerInstance = new window.MindMapDragEnhancer(mindMap);
    console.log('[Mindmap Sandbox] 磁吸拖拽增强器已挂载并激活');
  }

  if (window.MindMapNodeEditor) {
    window._mindMapNodeEditorInstance = new window.MindMapNodeEditor(mindMap);
    console.log('[Mindmap Sandbox] 导图原位编辑与实时悬浮预览胶囊已激活');
  }

  // 6. 初始化大纲引擎与双向视图控制器
  const outlinerContainer = document.getElementById('outlinerContainer');
  let outliner = null;
  let dualViewController = null;

  if (window.MindMapOutliner && outlinerContainer) {
    outliner = new window.MindMapOutliner(outlinerContainer);
    window._outlinerInstance = outliner;
    console.log('[Mindmap Sandbox] 大纲引擎已初始化');
  }

  if (window.DualViewController && outliner) {
    dualViewController = new window.DualViewController(mindMap, outliner, {
      defaultView: 'mindmap'
    });
    window._dualViewControllerInstance = dualViewController;
    console.log('[Mindmap Sandbox] 双向视图控制器已挂载并激活');
  }

  // 7. 初始化快捷键指南抽屉、底部固定工具条与全局快捷键管理器
  let shortcutDrawer = null;
  if (window.MindMapShortcutDrawer) {
    shortcutDrawer = new window.MindMapShortcutDrawer();
    window._mindMapShortcutDrawerInstance = shortcutDrawer;
    console.log('[Mindmap Sandbox] 快捷键指南抽屉已就绪');
  }

  if (window.MindMapBottomToolbar) {
    window._mindMapBottomToolbarInstance = new window.MindMapBottomToolbar(mindMap, {
      shortcutDrawer: shortcutDrawer
    });
    console.log('[Mindmap Sandbox] 底部固定深色工具条已挂载并就绪');
  }

  if (window.MindMapShortcutManager) {
    window._mindMapShortcutManagerInstance = new window.MindMapShortcutManager(mindMap, {
      shortcutDrawer: shortcutDrawer,
      outliner: outliner
    });
    console.log('[Mindmap Sandbox] 全局快捷键交互管理器已挂载并激活');
  }

  // 8. 初始化左下角结构与分支线搭配控制器
  if (window.MindMapStructureController) {
    window._mindMapStructureController = window._mindMapStructureControllerInstance = new window.MindMapStructureController(mindMap);
    console.log('[Mindmap Sandbox] 结构与分支线搭配控制器已挂载并激活');
  }

  // 9. 视口大小自适应监听
  window.addEventListener('resize', () => {
    mindMap.resize();
  });

  // 10. 缩放比例文本显示联动
  const zoomText = document.getElementById('zoomLevelText');
  function updateZoomDisplay() {
    if (!zoomText || !mindMap.view) return;
    const transform = mindMap.view.getTransformData();
    const scale = (transform && transform.state && transform.state.scale) || (transform && transform.scale) || (mindMap.view.scale) || 1;
    zoomText.textContent = `${Math.round(scale * 100)}%`;
  }

  mindMap.on('scale', updateZoomDisplay);
  mindMap.on('view_data_change', updateZoomDisplay);
  mindMap.on('node_tree_render_end', updateZoomDisplay);

  // 11. 顶部悬浮控制栏原生命令绑定
  const btnInsertChild = document.getElementById('btnInsertChild');
  const btnInsertSibling = document.getElementById('btnInsertSibling');
  const btnDeleteNode = document.getElementById('btnDeleteNode');
  const btnUndo = document.getElementById('btnUndo');
  const btnRedo = document.getElementById('btnRedo');
  const btnResetView = document.getElementById('btnResetView');
  const btnFitView = document.getElementById('btnFitView');
  const btnZoomIn = document.getElementById('btnZoomIn');
  const btnZoomOut = document.getElementById('btnZoomOut');

  if (btnInsertChild) {
    btnInsertChild.addEventListener('click', () => {
      mindMap.execCommand('INSERT_CHILD_NODE');
    });
  }

  if (btnInsertSibling) {
    btnInsertSibling.addEventListener('click', () => {
      mindMap.execCommand('INSERT_NODE');
    });
  }

  if (btnDeleteNode) {
    btnDeleteNode.addEventListener('click', () => {
      mindMap.execCommand('REMOVE_NODE');
    });
  }

  if (btnUndo) {
    btnUndo.addEventListener('click', () => {
      mindMap.execCommand('BACK');
    });
  }

  if (btnRedo) {
    btnRedo.addEventListener('click', () => {
      mindMap.execCommand('FORWARD');
    });
  }

  if (btnResetView) {
    btnResetView.addEventListener('click', () => {
      mindMap.view.reset();
      updateZoomDisplay();
    });
  }

  if (btnFitView) {
    btnFitView.addEventListener('click', () => {
      mindMap.view.fit();
      updateZoomDisplay();
    });
  }

  const btnExpandAll = document.getElementById('btnExpandAll');
  const btnCollapseAll = document.getElementById('btnCollapseAll');

  if (btnExpandAll) {
    btnExpandAll.addEventListener('click', () => {
      if (window._mindMapShortcutManagerInstance) {
        window._mindMapShortcutManagerInstance.expandAll();
      } else {
        mindMap.execCommand('EXPAND_ALL');
      }
    });
  }

  if (btnCollapseAll) {
    btnCollapseAll.addEventListener('click', () => {
      if (window._mindMapShortcutManagerInstance) {
        window._mindMapShortcutManagerInstance.collapseAll();
      } else {
        mindMap.execCommand('UNEXPAND_ALL');
      }
    });
  }

  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', () => {
      mindMap.view.enlarge();
      updateZoomDisplay();
    });
  }

  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', () => {
      mindMap.view.narrow();
      updateZoomDisplay();
    });
  }

  // 12. 导出与导入纯文本导图数据
  const btnExportJson = document.getElementById('btnExportJson');
  const btnImportJson = document.getElementById('btnImportJson');
  const importFileInput = document.getElementById('importFileInput');

  if (btnExportJson) {
    btnExportJson.addEventListener('click', () => {
      const data = mindMap.getData(false);
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mindmap_export_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  if (btnImportJson && importFileInput) {
    btnImportJson.addEventListener('click', () => {
      importFileInput.click();
    });

    importFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const parsed = JSON.parse(evt.target.result);
          if (parsed && (parsed.data || parsed.root)) {
            mindMap.setData(parsed);
            mindMap.view.reset();
            updateZoomDisplay();
          } else {
            alert('导入失败：未识别到合法的思维导图节点数据结构');
          }
        } catch (err) {
          alert('导入失败：JSON 文件解析出错 - ' + err.message);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  }

  console.log('[Mindmap Sandbox] 思维导图实例初始化完成，挂载于 window._mindMapInstance');
})();
