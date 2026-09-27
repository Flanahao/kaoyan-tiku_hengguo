/**
 * 思维导图底部固定深色工具条 (MindMapBottomToolbar)
 * 职责：
 * 1. 固定居中于画布底部 (position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%))
 * 2. 保留核心排版 4 大按钮：
 *    - A: 7 色高亮色块与清除 (Alt + R, Y, P, B, C, O, G / Alt + H)
 *    - B: 加粗 (Ctrl + B)
 *    - I: 斜体 (Ctrl + I)
 *    - U: 下划线 (Ctrl + U)
 * 3. 支持 options.container 指定宿主挂载容器
 */
(function (global) {
  'use strict';

  const HIGHLIGHT_COLORS = [
    { key: 'red', name: '粉', hex: '#ffc5c0', shortcut: 'Alt+R' },
    { key: 'yellow', name: '黄', hex: '#ffe699', shortcut: 'Alt+Y' },
    { key: 'purple', name: '紫', hex: '#f6d5f8', shortcut: 'Alt+P' },
    { key: 'blue', name: '蓝', hex: '#badbff', shortcut: 'Alt+B' },
    { key: 'cyan', name: '青', hex: '#a8f0eb', shortcut: 'Alt+C' },
    { key: 'green', name: '绿', hex: '#e0f3a0', shortcut: 'Alt+G' },
    { key: 'gray', name: '灰', hex: '#dee2e6', shortcut: 'Alt+O' }
  ];

  class MindMapBottomToolbar {
    constructor(mindMap, options = {}) {
      if (!mindMap) {
        throw new Error('[MindMapBottomToolbar] 必须传入 SimpleMindMap 实例');
      }
      this.mindMap = mindMap;
      this.options = Object.assign({
        container: document.body
      }, options);
      this.container = this.options.container || document.body;
      this.activeNode = null;

      this.initDom();
      this.bindEvents();
    }

    initDom() {
      const existing = this.container.querySelector('.mm-bottom-toolbar');
      if (existing) existing.remove();

      this.toolbarEl = document.createElement('nav');
      this.toolbarEl.className = 'mm-bottom-toolbar';
      this.toolbarEl.innerHTML = `
        <!-- 1. 颜色与高亮选择器 (A) -->
        <button type="button" class="bar-btn" id="mmBtnColor" title="高亮标记 (Alt + R, Y, P, B, C, G, O)">
          <span style="font-weight: bold; border-bottom: 2px solid #3370ff; padding-bottom: 1px;">A</span>
        </button>

        <div class="mm-color-popover" id="mmColorPopover">
          ${HIGHLIGHT_COLORS.map(c => `
            <button type="button" class="color-dot color-swatch-btn" data-color="${c.key}" title="${c.name}色 (${c.shortcut})" style="background-color: ${c.hex};">A</button>
          `).join('')}
          <button type="button" class="color-dot color-swatch-btn is-clear" data-color="none" title="清除高亮">&empty;</button>
        </div>

        <div class="bar-divider"></div>

        <!-- 2. 加粗 (B) -->
        <button type="button" class="bar-btn" id="mmBtnBold" title="加粗 (Ctrl + B)">
          <strong style="font-size: 13px;">B</strong>
        </button>

        <!-- 3. 斜体 (I) -->
        <button type="button" class="bar-btn" id="mmBtnItalic" title="斜体 (Ctrl + I)">
          <em style="font-size: 13px; font-style: italic;">I</em>
        </button>

        <!-- 4. 下划线 (U) -->
        <button type="button" class="bar-btn" id="mmBtnUnderline" title="下划线 (Ctrl + U)">
          <span style="font-size: 13px; text-decoration: underline;">U</span>
        </button>
      `;

      this.container.appendChild(this.toolbarEl);

      this.btnColor = this.toolbarEl.querySelector('#mmBtnColor');
      this.colorPopover = this.toolbarEl.querySelector('#mmColorPopover');
      this.btnBold = this.toolbarEl.querySelector('#mmBtnBold');
      this.btnItalic = this.toolbarEl.querySelector('#mmBtnItalic');
      this.btnUnderline = this.toolbarEl.querySelector('#mmBtnUnderline');
    }

    bindEvents() {
      this.mindMap.on('node_active', (node, activeList) => {
        this.activeNode = (activeList && activeList.length === 1) ? activeList[0] : null;
        this.updateButtonStates();
      });

      this.btnColor.addEventListener('click', (e) => {
        e.stopPropagation();
        this.colorPopover.classList.toggle('show');
      });

      document.addEventListener('click', (e) => {
        if (!this.toolbarEl.contains(e.target)) {
          this.colorPopover.classList.remove('show');
        }
      });

      [this.btnBold, this.btnItalic, this.btnUnderline, this.btnColor, this.colorPopover].forEach((el) => {
        if (el) {
          el.addEventListener('mousedown', (e) => e.preventDefault());
        }
      });

      this.colorPopover.addEventListener('click', (e) => {
        const dot = e.target.closest('.color-dot');
        if (!dot) return;
        const color = dot.dataset.color;
        if (!this.dispatchTypographyCommand('color', color)) {
          this.setNodeHighlight(color === 'none' ? null : color);
        }
        this.colorPopover.classList.remove('show');
      });

      this.btnBold.addEventListener('click', () => {
        if (!this.dispatchTypographyCommand('bold')) {
          this.toggleNodeStyle('fontWeight', 'bold');
        }
      });
      this.btnItalic.addEventListener('click', () => {
        if (!this.dispatchTypographyCommand('italic')) {
          this.toggleNodeStyle('fontStyle', 'italic');
        }
      });
      this.btnUnderline.addEventListener('click', () => {
        if (!this.dispatchTypographyCommand('underline')) {
          this.toggleNodeStyle('textDecoration', 'underline');
        }
      });
    }

    dispatchTypographyCommand(formatType, extra = null) {
      const editor = this.mindMap.mindMapNodeEditor || this.options.nodeEditor || window._mindMapNodeEditorInstance;
      if (editor && editor.isEditing) {
        editor.formatSelection(formatType, extra);
        return true;
      }

      const outliner = this.options.outliner || window._outlinerInstance;
      if (outliner && outliner.focusedUid) {
        outliner.formatSelection(formatType, extra);
        return true;
      }

      return false;
    }

    setNodeHighlight(colorKey) {
      const activeList = (this.mindMap.renderer && this.mindMap.renderer.activeNodeList) || [];
      if (activeList.length === 0) return;

      activeList.forEach((node) => {
        const curColor = node.getData('highlightColor');
        const isClearing = (!colorKey || colorKey === 'none' || curColor === colorKey);
        const targetColor = isClearing ? null : colorKey;

        const nodeData = node.getData() || {};
        let text = nodeData.text || '';

        if (!targetColor && text) {
          text = text.replace(/<span class="mm-(?:text|inline)-hl-[a-z]+">([\s\S]+?)<\/span>/gi, '$1')
                     .replace(/<mark class="[^"]*">([\s\S]+?)<\/mark>/gi, '$1');
        }

        if (node.nodeData && node.nodeData.data) {
          if (targetColor) {
            node.nodeData.data.highlightColor = targetColor;
          } else {
            delete node.nodeData.data.highlightColor;
          }
        }

        this.mindMap.execCommand('SET_NODE_DATA', node, {
          highlightColor: targetColor,
          text: text
        });
      });
      this.mindMap.render();
      this.updateButtonStates();
    }

    toggleNodeStyle(key, value) {
      const activeList = (this.mindMap.renderer && this.mindMap.renderer.activeNodeList) || [];
      if (activeList.length === 0) return;

      activeList.forEach((node) => {
        const cur = node.getData(key);
        const target = (cur === value) ? '' : value;
        this.mindMap.execCommand('SET_NODE_DATA', node, { [key]: target });
      });
      this.mindMap.render();
      this.updateButtonStates();
    }

    updateButtonStates() {
      if (!this.activeNode) {
        this.btnBold.classList.remove('active');
        this.btnItalic.classList.remove('active');
        this.btnUnderline.classList.remove('active');
        return;
      }

      const isBold = this.activeNode.getData('fontWeight') === 'bold';
      const isItalic = this.activeNode.getData('fontStyle') === 'italic';
      const isUnderline = this.activeNode.getData('textDecoration') === 'underline';

      this.btnBold.classList.toggle('active', isBold);
      this.btnItalic.classList.toggle('active', isItalic);
      this.btnUnderline.classList.toggle('active', isUnderline);

      const color = this.activeNode.getData('highlightColor');
      const found = HIGHLIGHT_COLORS.find(c => c.key === color);
      const indicator = this.btnColor.querySelector('span');
      if (indicator) {
        indicator.style.borderBottomColor = found ? found.hex : '#3370ff';
      }
    }
  }

  global.MindMapBottomToolbar = MindMapBottomToolbar;
})(typeof window !== 'undefined' ? window : this);
