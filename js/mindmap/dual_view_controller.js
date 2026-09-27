/**
 * 双向视图控制器 (DualViewController)
 * 职责：
 * 1. 挂载并渲染双向切换胶囊控件 [ 大纲 | 导图 ]
 * 2. 状态机管理：导图模式 (MindMap) 与大纲模式 (Outliner) 之间平滑无缝切换
 * 3. 双向数据模型全保真同步 (MindMap <-> Outliner 数据源双向无损互通)
 * 4. 键盘全局快捷键支持 (M 键快速在两重视图间切换，支持作用域隔离)
 */
(function (global) {
  'use strict';

  class DualViewController {
    constructor(mindMap, outliner, options = {}) {
      if (!mindMap) {
        throw new Error('[DualViewController] 必须传入有效的 MindMap 实例');
      }
      if (!outliner) {
        throw new Error('[DualViewController] 必须传入有效的 MindMapOutliner 实例');
      }

      this.mindMap = mindMap;
      this.outliner = outliner;
      this.options = Object.assign({
        defaultView: 'mindmap', // 'mindmap' | 'outline'
        container: document.body,
        mindMapContainer: null,
        outlinerContainer: null,
        isActiveCheck: null,
        mountSwitcher: true
      }, options);

      this.currentView = this.options.defaultView;
      this.listeners = {};

      this.initDom();
      this.bindEvents();

      // 同步初始数据至大纲
      this.syncMindMapToOutliner();
    }

    isActive() {
      if (typeof this.options.isActiveCheck === 'function') {
        return !!this.options.isActiveCheck();
      }
      return true;
    }

    // 初始化切换控件 DOM
    initDom() {
      this.mindMapContainer = this.options.mindMapContainer || document.getElementById('mindMapContainer');
      this.outlinerContainer = this.options.outlinerContainer || document.getElementById('outlinerContainer');

      if (!this.options.mountSwitcher) {
        this.switcherEl = null;
        this.btnOutline = null;
        this.btnMindMap = null;
        return;
      }

      // 避免重复挂载
      const existing = this.options.container.querySelector('.dual-view-switcher');
      if (existing) {
        existing.remove();
      }

      const switcherEl = document.createElement('div');
      switcherEl.className = 'dual-view-switcher';
      switcherEl.innerHTML = `
        <button type="button" class="view-switch-btn ${this.currentView === 'outline' ? 'active' : ''}" data-view="outline" title="切换到大纲笔记视图 (M)">
          <svg class="view-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
          <span>大纲</span>
        </button>
        <button type="button" class="view-switch-btn ${this.currentView === 'mindmap' ? 'active' : ''}" data-view="mindmap" title="切换到思维导图视图 (M)">
          <svg class="view-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="10" width="4" height="4" rx="1"></rect>
            <rect x="17" y="4" width="4" height="4" rx="1"></rect>
            <rect x="17" y="16" width="4" height="4" rx="1"></rect>
            <path d="M7 12h5a3 3 0 0 0 3-3V6"></path>
            <path d="M12 12a3 3 0 0 1 3 3v3"></path>
          </svg>
          <span>导图</span>
        </button>
      `;

      this.options.container.appendChild(switcherEl);
      this.switcherEl = switcherEl;
      this.btnOutline = switcherEl.querySelector('[data-view="outline"]');
      this.btnMindMap = switcherEl.querySelector('[data-view="mindmap"]');
    }

    // 绑定切换交互
    bindEvents() {
      if (this.btnOutline) {
        this.btnOutline.addEventListener('click', () => {
          this.switchView('outline');
        });
      }

      if (this.btnMindMap) {
        this.btnMindMap.addEventListener('click', () => {
          this.switchView('mindmap');
        });
      }

      // 快捷键 M 在非编辑态切换两种模式
      window.addEventListener('keydown', (e) => {
        if (!this.isActive()) return;
        if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const el = document.activeElement;
          const isTyping = el && (
            el.tagName === 'INPUT' ||
            el.tagName === 'TEXTAREA' ||
            (el.isContentEditable && (el.offsetParent !== null || el.style.display !== 'none'))
          );
          const isOutlinerFocused = !!(this.outliner && this.outliner.focusedUid);
          const editor = this.mindMap.mindMapNodeEditor || window._mindMapNodeEditorInstance;
          const isNodeEditorOpen = !!(editor && editor.isEditing);
          if (!isTyping && !isOutlinerFocused && !isNodeEditorOpen) {
            e.preventDefault();
            e.stopImmediatePropagation();
            this.toggleView();
          }
        }
      });
    }

    // 核心切换逻辑
    switchView(targetView) {
      if (targetView === this.currentView) return;

      if (targetView === 'outline') {
        // 1. 从导图同步最新树数据到大纲
        this.syncMindMapToOutliner();

        // 2. 隐藏导图画布，显示大纲容器
        if (this.mindMapContainer) {
          this.mindMapContainer.style.display = 'none';
        }
        if (this.outlinerContainer) {
          this.outlinerContainer.classList.add('active');
          this.outlinerContainer.scrollTop = 0;
        }
        this.options.container.classList.add('view-mode-outline');
        this.options.container.classList.remove('view-mode-mindmap');
        if (this.options.container === document.body) {
          document.body.classList.add('view-mode-outline');
          document.body.classList.remove('view-mode-mindmap');
        }

        // 3. 按钮高亮状态
        if (this.btnOutline) this.btnOutline.classList.add('active');
        if (this.btnMindMap) this.btnMindMap.classList.remove('active');

        this.currentView = 'outline';
        this.emit('view_change', 'outline');
      } else if (targetView === 'mindmap') {
        // 1. 先展示导图容器以使 SimpleMindMap 能够正确计算 SVG 盒模型尺寸
        if (this.mindMapContainer) {
          this.mindMapContainer.style.display = 'block';
        }
        if (this.outlinerContainer) {
          this.outlinerContainer.classList.remove('active');
        }
        this.options.container.classList.remove('view-mode-outline');
        this.options.container.classList.add('view-mode-mindmap');
        if (this.options.container === document.body) {
          document.body.classList.remove('view-mode-outline');
          document.body.classList.add('view-mode-mindmap');
        }

        // 2. 从大纲同步最新树数据到导图
        this.syncOutlinerToMindMap();

        // 3. 触发导图重绘与视口居中
        this.mindMap.resize();
        this.mindMap.view.reset();

        // 4. 按钮高亮状态
        if (this.btnMindMap) this.btnMindMap.classList.add('active');
        if (this.btnOutline) this.btnOutline.classList.remove('active');

        this.currentView = 'mindmap';
        this.emit('view_change', 'mindmap');
      }
    }

    // 在两种视图间轮流切换
    toggleView() {
      this.switchView(this.currentView === 'mindmap' ? 'outline' : 'mindmap');
    }

    getMode() {
      return this.currentView;
    }

    getView() {
      return this.currentView;
    }

    // 导图 -> 大纲 数据同步
    syncMindMapToOutliner() {
      const data = this.mindMap.getData(false);
      if (data) {
        this.outliner.setData(data);
      }
    }

    // 大纲 -> 导图 数据同步
    syncOutlinerToMindMap() {
      const data = this.outliner.getData();
      if (data) {
        this.mindMap.setData(data);
      }
    }

    // 获取当前视图状态
    getCurrentView() {
      return this.currentView;
    }

    // 事件订阅系统
    on(event, handler) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(handler);
    }

    emit(event, payload) {
      if (this.listeners[event]) {
        this.listeners[event].forEach(fn => fn(payload));
      }
    }
  }

  global.DualViewController = DualViewController;
})(typeof window !== 'undefined' ? window : this);
