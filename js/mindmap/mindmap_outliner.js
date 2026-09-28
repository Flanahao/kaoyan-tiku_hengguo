/**
 * 思维笔记大纲引擎 (MindMapOutliner)
 * 特性：
 * 1. 递归渲染树状大纲纸张列表 (• 圆点手柄 + 极细竖向导向线)
 * 2. 全键盘快捷工作流:
 *    - Enter: 创建同级兄弟节点并自动聚焦
 *    - Tab: 向右缩进降级为子节点
 *    - Shift + Tab: 向左提升层级
 *    - Backspace: 空节点回退与删除
 *    - Up / Down: 行间垂直跳转
 * 3. 圆点手柄支持拖拽重排与父子层级变更 (HTML5 Drag and Drop)
 * 4. 支持作为独立组件挂载于任意宿主容器，并提供键盘作用域隔离
 */
(function (global) {
  'use strict';

  function generateUid() {
    return 'node_' + Math.random().toString(36).substr(2, 9);
  }

  function stripOuterParagraph(str) {
    if (!str || typeof str !== 'string') return '';
    let s = str.trim();
    if (s.startsWith('<p>') && s.endsWith('</p>') && s.indexOf('<p>', 3) === -1) {
      s = s.slice(3, -4);
    }
    return s;
  }

  class MindMapOutliner {
    constructor(container, options = {}) {
      if (!container) {
        throw new Error('[MindMapOutliner] 未指定挂载容器');
      }

      this.container = container;
      this.options = Object.assign({
        placeholder: '输入内容...',
        titlePlaceholder: '输入导图根节点标题...',
        mountContainer: null,
        isActiveCheck: null
      }, options);

      this.mountContainer = this.options.mountContainer || this.container.parentElement || document.body;
      this.data = null;
      this.listeners = {};
      this.draggedUid = null;
      this.focusedUid = null;
      this.collapsedMap = new Set(); // 记录折叠状态的节点 uid

      this.initDom();
      this.bindEvents();
    }

    isActive() {
      if (typeof this.options.isActiveCheck === 'function') {
        return !!this.options.isActiveCheck();
      }
      return true;
    }

    // 初始化外部骨架
    initDom() {
      this.container.innerHTML = `
        <div class="outliner-paper">
          <h1 class="outliner-title" contenteditable="true" spellcheck="false"></h1>
          <div class="outliner-tree"></div>
        </div>
      `;

      this.paper = this.container.querySelector('.outliner-paper');
      this.titleEl = this.container.querySelector('.outliner-title');
      this.treeEl = this.container.querySelector('.outliner-tree');

      // 实时公式与排版悬浮预览胶囊
      this.previewCapsule = document.createElement('div');
      this.previewCapsule.className = 'outliner-preview-capsule';
      this.previewCapsule.style.display = 'none';
      this.previewCapsuleContent = document.createElement('div');
      this.previewCapsuleContent.className = 'capsule-content';
      this.previewCapsule.appendChild(this.previewCapsuleContent);
      this.mountContainer.appendChild(this.previewCapsule);

      // 选区悬浮气泡菜单 (Bubble Menu)
      this.bubbleMenu = document.createElement('div');
      this.bubbleMenu.className = 'mm-bubble-menu';
      this.bubbleMenu.innerHTML = `
        <button type="button" class="bubble-btn" data-action="bold" title="加粗 (Ctrl+B)">
          <strong style="font-size: 13px;">B</strong>
        </button>
        <button type="button" class="bubble-btn" data-action="italic" title="斜体 (Ctrl+I)">
          <em style="font-size: 13px; font-style: italic;">I</em>
        </button>
        <button type="button" class="bubble-btn" data-action="underline" title="下划线 (Ctrl+U)">
          <span style="font-size: 13px; text-decoration: underline;">U</span>
        </button>
        <button type="button" class="bubble-btn" data-action="strikethrough" title="删除线 (Ctrl+Shift+X)">
          <del style="font-size: 12px;">S</del>
        </button>
        <div class="bubble-divider"></div>
        <button type="button" class="bubble-btn" data-action="code" title="行内代码 (Ctrl+E)">
          <code style="font-size: 11px;">&lt;/&gt;</code>
        </button>
        <button type="button" class="bubble-btn" data-action="math" title="行内公式 ($)">
          <span style="font-size: 12px; font-style: italic;">$f_x$</span>
        </button>
        <div class="bubble-divider"></div>
        <button type="button" class="bubble-btn" data-action="color-trigger" title="局部文字高亮">
          <span style="font-weight: bold; border-bottom: 2px solid #3370ff; padding-bottom: 1px; font-size: 12px;">A</span>
        </button>
        <div class="mm-bubble-popover">
          <button type="button" class="color-dot color-swatch-btn" data-color="red" title="红色 (Alt+R)" style="background-color: #ffc5c0;">A</button>
          <button type="button" class="color-dot color-swatch-btn" data-color="yellow" title="黄色 (Alt+Y)" style="background-color: #ffe699;">A</button>
          <button type="button" class="color-dot color-swatch-btn" data-color="purple" title="紫色 (Alt+P)" style="background-color: #f6d5f8;">A</button>
          <button type="button" class="color-dot color-swatch-btn" data-color="blue" title="蓝色 (Alt+B)" style="background-color: #badbff;">A</button>
          <button type="button" class="color-dot color-swatch-btn" data-color="cyan" title="青色 (Alt+C)" style="background-color: #a8f0eb;">A</button>
          <button type="button" class="color-dot color-swatch-btn" data-color="green" title="绿色 (Alt+G)" style="background-color: #e0f3a0;">A</button>
          <button type="button" class="color-dot color-swatch-btn" data-color="gray" title="灰色 (Alt+O)" style="background-color: #dee2e6;">A</button>
          <button type="button" class="color-dot color-swatch-btn is-clear" data-color="none" title="清除高亮">&empty;</button>
        </div>
      `;
      this.bubblePopover = this.bubbleMenu.querySelector('.mm-bubble-popover');
      this.mountContainer.appendChild(this.bubbleMenu);
    }

    // 载入思维导图标准树数据并按需渲染（大纲不可见时仅同步数据与折叠映射，避免在导图打开瞬间同步阻塞渲染大纲 DOM）
    setData(treeData) {
      if (!treeData) return;
      this.data = JSON.parse(JSON.stringify(treeData, (key, val) => (key === '_node' || key === '_preRenderedCard' || key === '_preRenderedKey' ? undefined : val)));
      this.ensureUidsAndCleanText(this.data);
      this.syncCollapsedMapFromData(this.data);
      if (this.isVisible()) {
        this.render();
      }
    }

    // 根据树节点的 expand 属性同步大纲 collapsedMap
    syncCollapsedMapFromData(rootNode) {
      if (!rootNode) return;
      this.collapsedMap.clear();
      const walk = (n) => {
        if (!n) return;
        const d = n.data || {};
        if (d.uid && d.expand === false && Array.isArray(n.children) && n.children.length > 0) {
          this.collapsedMap.add(d.uid);
        }
        if (Array.isArray(n.children)) {
          n.children.forEach(walk);
        }
      };
      walk(rootNode);
    }

    // 获取当前大纲最新树形数据（同步 collapsedMap 至 expand 属性）
    getData() {
      if (!this.data) return null;
      const cloned = JSON.parse(JSON.stringify(this.data));
      const walk = (n, isRoot) => {
        if (!n) return;
        if (!n.data) n.data = {};
        if (isRoot) {
          n.data.expand = true;
        } else if (n.data.uid) {
          n.data.expand = !this.collapsedMap.has(n.data.uid);
        }
        if (Array.isArray(n.children)) {
          n.children.forEach(c => walk(c, false));
        }
      };
      walk(cloned, true);
      return cloned;
    }

    // 确保每个节点均拥有唯一 uid，并过滤可能的外层段落标签
    ensureUidsAndCleanText(node) {
      if (!node.data) node.data = {};
      if (!node.data.uid) node.data.uid = generateUid();
      if (typeof node.data.text === 'string') {
        node.data.text = stripOuterParagraph(node.data.text);
      }
      if (Array.isArray(node.children)) {
        node.children.forEach(child => this.ensureUidsAndCleanText(child));
      }
    }

    // 渲染全量大纲树
    render() {
      if (!this.data) return;

      // 渲染根节点标题
      const rootText = stripOuterParagraph(this.data.data.text || '未命名思维导图');
      this.titleEl.textContent = rootText;

      // 渲染子节点列表
      this.treeEl.innerHTML = '';
      const children = this.data.children || [];
      children.forEach((child) => {
        const childEl = this.renderNode(child, 1);
        this.treeEl.appendChild(childEl);
      });

      // 恢复焦点
      if (this.focusedUid) {
        this.focusNode(this.focusedUid);
      }
    }

    // 递归渲染单节点（双态结构：浏览态富文本/公式展示层 + 编辑态源码输入层）
    renderNode(nodeData, level = 1) {
      const uid = nodeData.data.uid;
      const text = stripOuterParagraph(nodeData.data.text || '');
      const tag = nodeData.data.tag || '';
      const tagType = nodeData.data.tagType || '';
      const hasChildren = Array.isArray(nodeData.children) && nodeData.children.length > 0;
      const isCollapsed = this.collapsedMap.has(uid);
      const isCurrentlyFocused = (this.focusedUid === uid);

      const nodeEl = document.createElement('div');
      nodeEl.className = `outliner-node level-${level}`;
      nodeEl.dataset.uid = uid;

      let rowClasses = `outliner-row ${isCurrentlyFocused ? 'is-editing' : ''}`;
      if (nodeData.data && nodeData.data.highlightColor) {
        rowClasses += ` mm-highlight-${nodeData.data.highlightColor}`;
      }

      const rowEl = document.createElement('div');
      rowEl.className = rowClasses;
      rowEl.dataset.uid = uid;

      // 折叠小箭头
      if (hasChildren) {
        const foldBtn = document.createElement('span');
        foldBtn.className = `outliner-fold-btn ${isCollapsed ? 'folded' : ''}`;
        foldBtn.innerHTML = '&#9660;';
        foldBtn.title = isCollapsed ? '展开子项' : '折叠子项';
        foldBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleCollapse(uid);
        });
        rowEl.appendChild(foldBtn);
      } else {
        const foldPlaceholder = document.createElement('span');
        foldPlaceholder.style.width = '14px';
        foldPlaceholder.style.height = '14px';
        foldPlaceholder.style.marginRight = '-4px';
        foldPlaceholder.style.flexShrink = '0';
        rowEl.appendChild(foldPlaceholder);
      }

      // 圆点拖拽手柄
      const handleEl = document.createElement('div');
      handleEl.className = 'outliner-handle';
      handleEl.title = '拖动调整顺序或层级';
      handleEl.draggable = true;

      const bulletEl = document.createElement('span');
      bulletEl.className = 'outliner-bullet';
      handleEl.appendChild(bulletEl);
      rowEl.appendChild(handleEl);

      // 双态文本区域容器
      const textWrap = document.createElement('div');
      textWrap.className = 'outliner-text-wrap';
      textWrap.dataset.uid = uid;

      // 1. 渲染呈现视图 (浏览态：KaTeX 数学公式与 Markdown 完美排版 + 语义前缀标签)
      let renderedHtml = '';
      if (global.MarkdownLatexEngine && typeof global.MarkdownLatexEngine.renderInline === 'function') {
        renderedHtml = global.MarkdownLatexEngine.renderInline(text);
      } else {
        renderedHtml = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }

      let tagPrefixHtml = '';
      if (tag) {
        const safeTag = String(tag).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        let safeType = String(tagType || '').replace(/[^a-z0-9_-]/gi, '');
        if (!safeType && safeTag.indexOf('待确认') === 0) safeType = 'pending';
        const pendingClass = (safeType === 'pending' || safeTag.indexOf('待确认') === 0) ? ' mm-tag-pending' : '';
        tagPrefixHtml = `<span class="mm-node-tag outliner-node-tag${pendingClass}" ${safeType ? `data-tag-type="${safeType}"` : ''}>${safeTag}</span>`;
      }

      const displayView = document.createElement('div');
      displayView.className = 'outliner-display-view';
      displayView.dataset.uid = uid;
      displayView.innerHTML = tagPrefixHtml + (renderedHtml || '&nbsp;');
      displayView.style.display = isCurrentlyFocused ? 'none' : 'inline-flex';

      // 单击浏览层平滑切入编辑态
      displayView.addEventListener('click', (e) => {
        e.stopPropagation();
        this.focusNode(uid);
      });

      // 2. 源码输入视图 (编辑态：保留 .outliner-text 兼容全键盘协议与自动化测试)
      const inputView = document.createElement('div');
      inputView.className = 'outliner-input-view outliner-text';
      inputView.contentEditable = 'true';
      inputView.spellcheck = false;
      inputView.dataset.uid = uid;
      inputView.textContent = text;
      inputView.style.display = isCurrentlyFocused ? 'block' : 'none';

      textWrap.appendChild(displayView);
      textWrap.appendChild(inputView);
      rowEl.appendChild(textWrap);

      nodeEl.appendChild(rowEl);

      // 子节点列表容器
      if (hasChildren) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = `outliner-children ${isCollapsed ? 'collapsed' : ''}`;
        nodeData.children.forEach(child => {
          childrenContainer.appendChild(this.renderNode(child, level + 1));
        });
        nodeEl.appendChild(childrenContainer);
      }

      return nodeEl;
    }

    // 折叠展开切换
    toggleCollapse(uid) {
      if (this.collapsedMap.has(uid)) {
        this.collapsedMap.delete(uid);
      } else {
        this.collapsedMap.add(uid);
      }
      this.render();
    }

    // 更新大纲行悬浮实时公式预览胶囊
    updatePreviewCapsule(uid) {
      if (!this.previewCapsule) return;
      const row = this.container.querySelector(`.outliner-row[data-uid="${uid}"]`);
      if (!row) {
        this.previewCapsule.style.display = 'none';
        return;
      }
      const input = row.querySelector('.outliner-input-view');
      if (!input) {
        this.previewCapsule.style.display = 'none';
        return;
      }
      const text = (input.textContent || '').trim();
      if (!text) {
        this.previewCapsule.style.display = 'none';
        this.previewCapsuleContent.innerHTML = '';
        return;
      }

      let renderedHtml = '';
      if (global.MarkdownLatexEngine && typeof global.MarkdownLatexEngine.renderInline === 'function') {
        try {
          renderedHtml = global.MarkdownLatexEngine.renderInline(text);
        } catch (e) {
          renderedHtml = text;
        }
      } else {
        renderedHtml = text;
      }

      this.previewCapsuleContent.innerHTML = renderedHtml;

      const rect = input.getBoundingClientRect();
      const top = rect.bottom + 6;
      const left = Math.max(16, rect.left);

      this.previewCapsule.style.top = `${Math.round(top)}px`;
      this.previewCapsule.style.left = `${Math.round(left)}px`;
      this.previewCapsule.style.display = 'block';
    }

    // 聚焦指定节点并激活编辑态
    focusNode(uid) {
      if (this.focusedUid && this.focusedUid !== uid) {
        this.commitNode(this.focusedUid);
      }
      this.focusedUid = uid;

      const row = this.container.querySelector(`.outliner-row[data-uid="${uid}"]`);
      if (row) {
        row.classList.add('is-editing');
        const disp = row.querySelector('.outliner-display-view');
        const input = row.querySelector('.outliner-input-view');
        if (disp) disp.style.display = 'none';
        if (input) {
          input.style.display = 'block';
          input.focus();
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(input);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
          this.updatePreviewCapsule(uid);
        }
      }
    }

    // 检测当前聚焦节点是否有文字选区
    hasSelection() {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
      if (!this.focusedUid) return false;
      const row = this.container.querySelector(`.outliner-row[data-uid="${this.focusedUid}"]`);
      if (!row) return false;
      const input = row.querySelector('.outliner-input-view');
      return !!(input && (input.contains(sel.anchorNode) || input === sel.anchorNode));
    }

    // 检测选区状态并控制气泡菜单展现
    checkSelection() {
      if (!this.focusedUid) {
        this.hideBubbleMenu();
        return;
      }
      if (this.hasSelection()) {
        this.showBubbleMenu();
      } else {
        this.hideBubbleMenu();
      }
    }

    // 显示选区悬浮气泡菜单并智能定位
    showBubbleMenu() {
      if (!this.focusedUid) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      let left = rect.left + rect.width / 2;
      let top = rect.top - 8;

      if (!rect.width && !rect.height) {
        const row = this.container.querySelector(`.outliner-row[data-uid="${this.focusedUid}"]`);
        if (!row) return;
        const rowRect = row.getBoundingClientRect();
        left = rowRect.left + 100;
        top = rowRect.top - 8;
      }

      left = Math.max(160, Math.min(window.innerWidth - 160, left));
      if (top - 45 < 0) {
        top = rect.bottom + 38;
      }

      this.bubbleMenu.style.left = `${Math.round(left)}px`;
      this.bubbleMenu.style.top = `${Math.round(top)}px`;
      this.bubbleMenu.style.display = 'flex';
    }

    // 隐藏气泡菜单
    hideBubbleMenu() {
      if (this.bubbleMenu) {
        this.bubbleMenu.style.display = 'none';
      }
      if (this.bubblePopover) {
        this.bubblePopover.classList.remove('show');
      }
    }

    // 选区富文本排版算法 (大纲 contenteditable)
    formatSelection(type, extra) {
      if (!this.focusedUid) return;
      const row = this.container.querySelector(`.outliner-row[data-uid="${this.focusedUid}"]`);
      if (!row) return;
      const input = row.querySelector('.outliner-input-view');
      if (!input) return;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const selectedText = range.toString();

      if (!selectedText) {
        let insert = '';
        if (type === 'bold') insert = '****';
        else if (type === 'italic') insert = '**';
        else if (type === 'underline') insert = '<u></u>';
        else if (type === 'strikethrough') insert = '~~~~';
        else if (type === 'code') insert = '``';
        else if (type === 'math') insert = '$$';
        else if (type === 'color' && extra && extra !== 'none') insert = `<mark class="mm-inline-hl-${extra}"></mark>`;

        if (insert) {
          const textNode = document.createTextNode(insert);
          range.insertNode(textNode);
          const newRange = document.createRange();
          newRange.setStart(textNode, insert.length / 2);
          newRange.setEnd(textNode, insert.length / 2);
          sel.removeAllRanges();
          sel.addRange(newRange);
          this.syncNodeTextFromInput(input);
        }
        return;
      }

      let formatted = selectedText;
      if (type === 'bold') {
        if (selectedText.startsWith('**') && selectedText.endsWith('**') && selectedText.length >= 4) {
          formatted = selectedText.slice(2, -2);
        } else {
          formatted = `**${selectedText}**`;
        }
      } else if (type === 'italic') {
        if (selectedText.startsWith('*') && !selectedText.startsWith('**') && selectedText.endsWith('*') && !selectedText.endsWith('**') && selectedText.length >= 2) {
          formatted = selectedText.slice(1, -1);
        } else {
          formatted = `*${selectedText}*`;
        }
      } else if (type === 'underline') {
        if (selectedText.startsWith('<u>') && selectedText.endsWith('</u>') && selectedText.length >= 7) {
          formatted = selectedText.slice(3, -4);
        } else {
          formatted = `<u>${selectedText}</u>`;
        }
      } else if (type === 'strikethrough') {
        if (selectedText.startsWith('~~') && selectedText.endsWith('~~') && selectedText.length >= 4) {
          formatted = selectedText.slice(2, -2);
        } else {
          formatted = `~~${selectedText}~~`;
        }
      } else if (type === 'code') {
        if (selectedText.startsWith('`') && selectedText.endsWith('`') && selectedText.length >= 2) {
          formatted = selectedText.slice(1, -1);
        } else {
          formatted = `\`${selectedText}\``;
        }
      } else if (type === 'math') {
        if (selectedText.startsWith('$') && selectedText.endsWith('$') && selectedText.length >= 2) {
          formatted = selectedText.slice(1, -1);
        } else {
          formatted = `$${selectedText}$`;
        }
      } else if (type === 'color') {
        const colorKey = extra;
        const markRegex = /^<mark class="mm-inline-hl-([a-z]+)">([\s\S]+?)<\/mark>$/;
        const match = selectedText.match(markRegex);
        if (match) {
          const curColor = match[1];
          const inner = match[2];
          if (colorKey === 'none' || colorKey === curColor) {
            formatted = inner;
          } else {
            formatted = `<mark class="mm-inline-hl-${colorKey}">${inner}</mark>`;
          }
        } else if (colorKey === 'none') {
          formatted = selectedText.replace(/<(?:mark|span)\s+class="mm-(?:inline|text)-hl-[a-z]+">([\s\S]*?)<\/(?:mark|span)>/gi, '$1');
        } else {
          const clean = selectedText.replace(/<(?:mark|span)\s+class="mm-(?:inline|text)-hl-[a-z]+">/gi, '').replace(/<\/(?:mark|span)>/gi, '');
          formatted = `<mark class="mm-inline-hl-${colorKey}">${clean}</mark>`;
        }
      }

      range.deleteContents();
      const newNode = document.createTextNode(formatted);
      range.insertNode(newNode);

      const newRange = document.createRange();
      newRange.selectNodeContents(newNode);
      sel.removeAllRanges();
      sel.addRange(newRange);

      this.syncNodeTextFromInput(input);
      this.showBubbleMenu();
    }

    syncNodeTextFromInput(input) {
      if (!input || !this.focusedUid) return;
      const text = input.textContent.trim();
      const found = this.findNode(this.focusedUid);
      if (found) {
        found.data.text = text;
        const row = input.closest('.outliner-row');
        if (row) {
          const disp = row.querySelector('.outliner-display-view');
          if (disp) {
            let tagPrefixHtml = '';
            if (found.data.tag) {
              const safeTag = String(found.data.tag).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
              let safeType = String(found.data.tagType || '').replace(/[^a-z0-9_-]/gi, '');
              if (!safeType && safeTag.indexOf('待确认') === 0) safeType = 'pending';
              const pendingClass = (safeType === 'pending' || safeTag.indexOf('待确认') === 0) ? ' mm-tag-pending' : '';
              tagPrefixHtml = `<span class="mm-node-tag outliner-node-tag${pendingClass}" ${safeType ? `data-tag-type="${safeType}"` : ''}>${safeTag}</span>`;
            }
            const rendered = (global.MarkdownLatexEngine && typeof global.MarkdownLatexEngine.renderInline === 'function')
              ? global.MarkdownLatexEngine.renderInline(text)
              : text;
            disp.innerHTML = tagPrefixHtml + (rendered || '&nbsp;');
          }
        }
        this.updatePreviewCapsule(this.focusedUid);
        this.emitChange();
      }
    }

    // 提交节点编辑内容并切换回浏览展示态
    commitNode(uid) {
      if (!uid) return;
      this.hideBubbleMenu();
      if (this.previewCapsule) {
        this.previewCapsule.style.display = 'none';
      }
      const row = this.container.querySelector(`.outliner-row[data-uid="${uid}"]`);
      if (row) {
        row.classList.remove('is-editing');
        const disp = row.querySelector('.outliner-display-view');
        const input = row.querySelector('.outliner-input-view');
        if (input) {
          const newText = input.textContent.trim();
          const found = this.findNode(uid);
          if (found && found.data.text !== newText) {
            found.data.text = newText;
            this.emitChange();
          }
          if (disp) {
            let tagPrefixHtml = '';
            if (found && found.data && found.data.tag) {
              const safeTag = String(found.data.tag).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
              let safeType = String(found.data.tagType || '').replace(/[^a-z0-9_-]/gi, '');
              if (!safeType && safeTag.indexOf('待确认') === 0) safeType = 'pending';
              const pendingClass = (safeType === 'pending' || safeTag.indexOf('待确认') === 0) ? ' mm-tag-pending' : '';
              tagPrefixHtml = `<span class="mm-node-tag outliner-node-tag${pendingClass}" ${safeType ? `data-tag-type="${safeType}"` : ''}>${safeTag}</span>`;
            }
            if (global.MarkdownLatexEngine && typeof global.MarkdownLatexEngine.renderInline === 'function') {
              disp.innerHTML = tagPrefixHtml + (global.MarkdownLatexEngine.renderInline(newText) || '&nbsp;');
            } else {
              disp.innerHTML = tagPrefixHtml + (newText || '&nbsp;');
            }
            disp.style.display = 'inline-flex';
          }
          input.blur();
          input.style.display = 'none';
        }
      }
      if (document.activeElement && (document.activeElement.classList.contains('outliner-input-view') || document.activeElement.classList.contains('outliner-text'))) {
        document.activeElement.blur();
      }
      if (this.focusedUid === uid) {
        this.focusedUid = null;
      }
    }

    // 绑定大纲编辑核心事件与键盘机制
    bindEvents() {
      // 0. 点击外部非编辑区域时提交当前正在编辑的节点
      document.addEventListener('mousedown', (e) => {
        if (!this.isActive() || !this.focusedUid) return;
        const row = this.container.querySelector(`.outliner-row[data-uid="${this.focusedUid}"]`);
        if (row && (row.contains(e.target) || this.bubbleMenu.contains(e.target))) {
          return;
        }
        const bottomToolbar = document.querySelector('.mm-bottom-toolbar');
        if (bottomToolbar && bottomToolbar.contains(e.target)) {
          return;
        }
        this.commitNode(this.focusedUid);
      });

      // 气泡菜单防失焦与点击委托
      this.bubbleMenu.addEventListener('mousedown', (e) => e.preventDefault());
      this.bubbleMenu.addEventListener('click', (e) => {
        const btn = e.target.closest('.bubble-btn');
        if (btn) {
          const action = btn.dataset.action;
          if (action === 'color-trigger') {
            this.bubblePopover.classList.toggle('show');
            return;
          }
          if (action) {
            this.formatSelection(action);
            this.bubblePopover.classList.remove('show');
          }
          return;
        }
        const dot = e.target.closest('.color-dot');
        if (dot) {
          const color = dot.dataset.color;
          this.formatSelection('color', color);
          this.bubblePopover.classList.remove('show');
        }
      });

      // 选区变化检测
      document.addEventListener('selectionchange', () => {
        if (this.isActive() && this.focusedUid) {
          this.checkSelection();
        }
      });

      // 滚动时隐藏预览胶囊
      this.container.addEventListener('scroll', () => {
        if (this.previewCapsule) this.previewCapsule.style.display = 'none';
      });

      // 1. 标题输入联动根节点文本
      this.titleEl.addEventListener('input', () => {
        if (!this.data) return;
        this.data.data.text = this.titleEl.textContent.trim();
        this.emitChange();
      });

      this.titleEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          // 在根节点回车，新增第一个一级节点
          const newUid = generateUid();
          const newNode = { data: { text: '新主题', uid: newUid }, children: [] };
          if (!this.data.children) this.data.children = [];
          this.data.children.unshift(newNode);
          this.focusedUid = newUid;
          this.render();
          this.emitChange();
        }
      });

      // 2. 文本域输入同步
      this.treeEl.addEventListener('input', (e) => {
        const target = e.target;
        if (!target.classList.contains('outliner-text')) return;
        this.syncNodeTextFromInput(target);
      });

      // 3. 全键盘协议 (Enter, Tab, Shift+Tab, Backspace, Arrows)
      this.treeEl.addEventListener('keydown', (e) => {
        const target = e.target;
        const rowEl = target && target.closest ? target.closest('[data-uid]') : null;
        const uid = (target && target.dataset && target.dataset.uid) || (rowEl && rowEl.dataset && rowEl.dataset.uid) || this.focusedUid;

        // Shift + Space: 将当前待确认节点一键转化为正式标签
        if (e.shiftKey && (e.code === 'Space' || e.key === ' ')) {
          if (uid && this.confirmPendingNode(uid)) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }

        if (!target.classList.contains('outliner-text')) return;

        // Enter 键：插入同级节点
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const newUid = generateUid();
          const newNode = { data: { text: '', uid: newUid }, children: [] };
          this.insertSiblingAfter(uid, newNode);
          this.focusedUid = newUid;
          this.render();
          this.emitChange();
          return;
        }

        // Tab 键：向右缩进为上一个兄弟节点的子项
        if (e.key === 'Tab' && !e.shiftKey) {
          e.preventDefault();
          const success = this.indentNode(uid);
          if (success) {
            this.focusedUid = uid;
            this.render();
            this.emitChange();
          }
          return;
        }

        // Shift + Tab 键：向左提升层级
        if (e.key === 'Tab' && e.shiftKey) {
          e.preventDefault();
          const success = this.outdentNode(uid);
          if (success) {
            this.focusedUid = uid;
            this.render();
            this.emitChange();
          }
          return;
        }

        // Backspace 键：空节点回退或删除
        if (e.key === 'Backspace') {
          const currentText = target.textContent.trim();
          if (currentText === '') {
            e.preventDefault();
            // 先尝试提升层级
            const outdentSuccess = this.outdentNode(uid);
            if (outdentSuccess) {
              this.focusedUid = uid;
              this.render();
              this.emitChange();
              return;
            }
            // 已经是顶级空节点，直接删除并聚焦上一项
            const prevTextEl = this.getPreviousTextEl(target);
            this.removeNode(uid);
            if (prevTextEl) {
              this.focusedUid = prevTextEl.dataset.uid;
            }
            this.render();
            this.emitChange();
            return;
          }
        }

        // 上下方向键：行间导航与双态流转
        if (e.key === 'ArrowUp') {
          const prevEl = this.getPreviousTextEl(target);
          if (prevEl && prevEl.dataset.uid) {
            e.preventDefault();
            this.focusNode(prevEl.dataset.uid);
          }
        } else if (e.key === 'ArrowDown') {
          const nextEl = this.getNextTextEl(target);
          if (nextEl && nextEl.dataset.uid) {
            e.preventDefault();
            this.focusNode(nextEl.dataset.uid);
          }
        }
      });

      // 4. 原生 HTML5 拖拽手柄支持
      this.bindDragAndDrop();
    }

    // 拖拽手柄监听
    bindDragAndDrop() {
      this.treeEl.addEventListener('dragstart', (e) => {
        const handle = e.target.closest('.outliner-handle');
        if (!handle) return;
        const row = handle.closest('.outliner-row');
        this.draggedUid = row.dataset.uid;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.draggedUid);
      });

      this.treeEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        const row = e.target.closest('.outliner-row');
        if (!row || row.dataset.uid === this.draggedUid) return;

        const rect = row.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        this.clearDragHoverClasses();

        if (offsetY < rect.height * 0.5) {
          row.classList.add('drag-over-top');
        } else {
          row.classList.add('drag-over-bottom');
        }
      });

      this.treeEl.addEventListener('dragleave', (e) => {
        const row = e.target.closest('.outliner-row');
        if (row) {
          row.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-child');
        }
      });

      this.treeEl.addEventListener('drop', (e) => {
        e.preventDefault();
        const row = e.target.closest('.outliner-row');
        if (!row || !this.draggedUid || row.dataset.uid === this.draggedUid) {
          this.clearDragHoverClasses();
          return;
        }

        const targetUid = row.dataset.uid;
        const isTop = row.classList.contains('drag-over-top');
        this.clearDragHoverClasses();

        this.moveNodeRelative(this.draggedUid, targetUid, isTop ? 'before' : 'after');
        this.focusedUid = this.draggedUid;
        this.render();
        this.emitChange();
        this.draggedUid = null;
      });

      this.treeEl.addEventListener('dragend', () => {
        this.clearDragHoverClasses();
        this.draggedUid = null;
      });
    }

    clearDragHoverClasses() {
      const rows = this.treeEl.querySelectorAll('.outliner-row');
      rows.forEach(r => r.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-child'));
    }

    // 获取上一个文本元素
    getPreviousTextEl(currentTextEl) {
      const allTextEls = Array.from(this.treeEl.querySelectorAll('.outliner-text'));
      const idx = allTextEls.indexOf(currentTextEl);
      return idx > 0 ? allTextEls[idx - 1] : null;
    }

    // 获取下一个文本元素
    getNextTextEl(currentTextEl) {
      const allTextEls = Array.from(this.treeEl.querySelectorAll('.outliner-text'));
      const idx = allTextEls.indexOf(currentTextEl);
      return idx >= 0 && idx < allTextEls.length - 1 ? allTextEls[idx + 1] : null;
    }

    // 将待确认节点转化为正式标签 (Shift + 空格)
    confirmPendingNode(uid) {
      const targetUid = uid || this.focusedUid;
      if (!targetUid) return false;
      const node = this.findNode(targetUid);
      if (node && node.data) {
        const isPending = node.data.tagType === 'pending' || (node.data.tag && String(node.data.tag).startsWith('待确认'));
        if (isPending) {
          node.data.tag = node.data.formalTag || '注';
          node.data.tagType = node.data.formalTagType || 'warn';
          delete node.data.formalTag;
          delete node.data.formalTagType;
          delete node.data.pendingSource;
          this.render();
          this.emitChange();
          return true;
        }
      }
      return false;
    }

    // 树形数据操作工具集
    findNode(uid) {
      const res = this.findNodeAndParent(this.data, uid);
      return res ? res.node : null;
    }

    findNodeAndParent(root, uid, parent = null) {
      if (root.data && root.data.uid === uid) {
        return { node: root, parent, index: parent ? parent.children.indexOf(root) : -1 };
      }
      if (root.children) {
        for (let i = 0; i < root.children.length; i++) {
          const found = this.findNodeAndParent(root.children[i], uid, root);
          if (found) return found;
        }
      }
      return null;
    }

    insertSiblingAfter(uid, newNode) {
      const found = this.findNodeAndParent(this.data, uid);
      if (!found || !found.parent) return false;
      found.parent.children.splice(found.index + 1, 0, newNode);
      return true;
    }

    indentNode(uid) {
      const found = this.findNodeAndParent(this.data, uid);
      if (!found || !found.parent || found.index === 0) return false;
      const prevSibling = found.parent.children[found.index - 1];
      found.parent.children.splice(found.index, 1);
      if (!prevSibling.children) prevSibling.children = [];
      prevSibling.children.push(found.node);
      // 展开目标节点以呈现新缩进项
      this.collapsedMap.delete(prevSibling.data.uid);
      return true;
    }

    outdentNode(uid) {
      const found = this.findNodeAndParent(this.data, uid);
      if (!found || !found.parent) return false;
      const grand = this.findNodeAndParent(this.data, found.parent.data.uid);
      if (!grand || !grand.parent) return false;
      found.parent.children.splice(found.index, 1);
      grand.parent.children.splice(grand.index + 1, 0, found.node);
      return true;
    }

    removeNode(uid) {
      const found = this.findNodeAndParent(this.data, uid);
      if (!found || !found.parent) return false;
      found.parent.children.splice(found.index, 1);
      return true;
    }

    moveNodeRelative(srcUid, targetUid, position) {
      const srcFound = this.findNodeAndParent(this.data, srcUid);
      const targetFound = this.findNodeAndParent(this.data, targetUid);
      if (!srcFound || !targetFound || !srcFound.parent || !targetFound.parent) return false;

      // 检查防成环保护：目标不能是源节点的子孙
      if (this.isDescendant(srcFound.node, targetFound.node)) return false;

      // 从原位置移除
      srcFound.parent.children.splice(srcFound.index, 1);

      // 重新查找目标位置（由于可能发生索引偏移）
      const refreshedTarget = this.findNodeAndParent(this.data, targetUid);
      const insertIdx = position === 'before' ? refreshedTarget.index : refreshedTarget.index + 1;
      refreshedTarget.parent.children.splice(insertIdx, 0, srcFound.node);
      return true;
    }

    isDescendant(ancestor, candidate) {
      if (!ancestor || !ancestor.children) return false;
      for (const child of ancestor.children) {
        if (child.data.uid === candidate.data.uid) return true;
        if (this.isDescendant(child, candidate)) return true;
      }
      return false;
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

    emitChange() {
      this.emit('change', this.getData());
    }

    isVisible() {
      if (!this.container) return false;
      if (this.container.id === 'cognitiveOutlinerContainer') {
        return this.container.classList.contains('active');
      }
      return this.container.offsetParent !== null || this.container.style.display !== 'none';
    }

    // 全部展开大纲节点
    expandAll() {
      this.collapsedMap.clear();
      if (this.isVisible()) {
        this.render();
      }
    }

    // 按指定深度展开大纲节点
    expandToLevel(maxDepth = 2) {
      this.collapsedMap.clear();
      const walk = (node, depth) => {
        if (!node) return;
        if (depth >= maxDepth && node.data && node.data.uid && Array.isArray(node.children) && node.children.length > 0) {
          this.collapsedMap.add(node.data.uid);
        }
        if (Array.isArray(node.children)) {
          node.children.forEach(child => walk(child, depth + 1));
        }
      };
      if (this.data && Array.isArray(this.data.children)) {
        this.data.children.forEach(child => walk(child, 1));
      }
      if (this.isVisible()) {
        this.render();
      }
    }

    // 全部折叠大纲节点 (折叠所有有一级子级及以上的行)
    collapseAll() {
      this.collapsedMap.clear();
      const walk = (node) => {
        if (node && node.data && node.data.uid) {
          if (Array.isArray(node.children) && node.children.length > 0) {
            this.collapsedMap.add(node.data.uid);
          }
        }
        if (node && Array.isArray(node.children)) {
          node.children.forEach(walk);
        }
      };
      if (this.data && Array.isArray(this.data.children)) {
        this.data.children.forEach(walk);
      }
      if (this.isVisible()) {
        this.render();
      }
    }
  }

  global.MindMapOutliner = MindMapOutliner;
})(typeof window !== 'undefined' ? window : this);
