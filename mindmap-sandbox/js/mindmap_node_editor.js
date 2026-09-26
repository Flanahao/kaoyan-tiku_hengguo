/**
 * 思维导图原位编辑与实时悬浮预览胶囊 (MindMapNodeEditor)
 * 职责：
 * 1. 拦截双击与 Enter/Space 快捷键，唤起原位自适应源码输入框
 * 2. 文本选区智能检测，原位正上方唤起“选区悬浮气泡菜单 (BubbleMenu)”
 * 3. 选区富文本排版算法：加粗 (B)、斜体 (I)、下划线 (U)、删除线 (S)、行内代码 (Code)、7 色高亮 (Color)、行内公式 (Math)
 * 4. 依附于节点正下方呈现“实时渲染胶囊 (Live Preview Capsule)”，毫秒级呈现 KaTeX 真实公式与局部排版
 * 5. 支持 options.container 与 options.isActiveCheck，实现宿主容器级隔离
 */
(function (global) {
  'use strict';

  function stripOuterParagraph(str) {
    if (!str || typeof str !== 'string') return '';
    let s = str.trim();
    if (s.startsWith('<p>') && s.endsWith('</p>') && s.indexOf('<p>', 3) === -1) {
      s = s.slice(3, -4);
    }
    return s;
  }

  const HIGHLIGHT_COLORS = [
    { key: 'red', name: '粉', hex: '#ffc5c0', shortcut: 'Alt+R' },
    { key: 'yellow', name: '黄', hex: '#ffe699', shortcut: 'Alt+Y' },
    { key: 'purple', name: '紫', hex: '#f6d5f8', shortcut: 'Alt+P' },
    { key: 'blue', name: '蓝', hex: '#badbff', shortcut: 'Alt+B' },
    { key: 'cyan', name: '青', hex: '#a8f0eb', shortcut: 'Alt+C' },
    { key: 'green', name: '绿', hex: '#e0f3a0', shortcut: 'Alt+G' },
    { key: 'gray', name: '灰', hex: '#dee2e6', shortcut: 'Alt+O' }
  ];

  class MindMapNodeEditor {
    constructor(mindMap, options = {}) {
      if (!mindMap) {
        throw new Error('[MindMapNodeEditor] 未传入 SimpleMindMap 实例');
      }
      this.mindMap = mindMap;
      this.options = Object.assign({
        container: document.body,
        isActiveCheck: null
      }, options);

      this.mindMap.mindMapNodeEditor = this;
      this.currentNode = null;
      this.isEditing = false;
      this.container = this.options.container || document.body;

      this.initDom();
      this.bindEvents();
    }

    isActive() {
      if (typeof this.options.isActiveCheck === 'function') {
        return !!this.options.isActiveCheck();
      }
      return true;
    }

    initDom() {
      // 1. 原位源码输入框
      this.inputWrap = document.createElement('div');
      this.inputWrap.className = 'mm-editor-wrap';
      this.inputWrap.style.display = 'none';

      this.textarea = document.createElement('textarea');
      this.textarea.className = 'mm-editor-input';
      this.textarea.spellcheck = false;
      this.textarea.rows = 1;
      this.inputWrap.appendChild(this.textarea);

      // 2. 悬浮实时渲染胶囊
      this.capsule = document.createElement('div');
      this.capsule.className = 'mm-preview-capsule';
      this.capsule.style.display = 'none';
      this.capsule.innerHTML = `<div class="capsule-content"></div>`;
      this.capsuleContent = this.capsule.querySelector('.capsule-content');

      // 3. 选区悬浮气泡菜单 (Bubble Menu)
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
          ${HIGHLIGHT_COLORS.map(c => `
            <button type="button" class="color-dot color-swatch-btn" data-color="${c.key}" title="${c.name}色 (${c.shortcut})" style="background-color: ${c.hex};">A</button>
          `).join('')}
          <button type="button" class="color-dot color-swatch-btn is-clear" data-color="none" title="清除高亮">&empty;</button>
        </div>
      `;
      this.bubblePopover = this.bubbleMenu.querySelector('.mm-bubble-popover');

      this.container.appendChild(this.inputWrap);
      this.container.appendChild(this.capsule);
      this.container.appendChild(this.bubbleMenu);
    }

    bindEvents() {
      // 1. 监听导图节点双击事件
      this.mindMap.on('node_dblclick', (node) => {
        if (!this.isActive()) return;
        this.show(node);
      });

      // 2. 监听回车键与空格键：当有节点处于选中态且未处于编辑态时唤起编辑
      window.addEventListener('keydown', (e) => {
        if (!this.isActive()) return;

        if (this.isEditing) {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            this.commitAndHide();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            this.cancelAndHide();
          }
          return;
        }

        // 非编辑态：选中节点按 Enter、F2 或 Space 唤起编辑
        if ((e.key === 'Enter' || e.key === 'F2' || e.code === 'Space') && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
          const activeList = (this.mindMap.renderer && this.mindMap.renderer.activeNodeList) || [];
          if (activeList.length === 1) {
            const activeNode = activeList[0];
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
              return;
            }
            e.preventDefault();
            e.stopPropagation();
            this.show(activeNode);
          }
        }
      }, true);

      // 3. 输入流实时双向渲染与自适应宽高
      this.textarea.addEventListener('input', () => {
        this.autoResize();
        this.updatePreview();
      });

      // 4. 选区变化检测
      const handleSelectionChange = () => {
        if (this.isEditing) {
          this.checkSelection();
        }
      };
      this.textarea.addEventListener('mouseup', handleSelectionChange);
      this.textarea.addEventListener('keyup', handleSelectionChange);
      this.textarea.addEventListener('select', handleSelectionChange);

      // 5. 气泡菜单防失焦
      this.bubbleMenu.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });

      // 6. 气泡菜单点击操作委托
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

      // 7. 画布缩放或平移时同步更新坐标
      const handleViewChange = () => {
        if (this.isEditing && this.currentNode) {
          this.updatePosition();
          if (this.bubbleMenu.style.display !== 'none') {
            this.showBubbleMenu();
          }
        }
      };
      this.mindMap.on('scale', handleViewChange);
      this.mindMap.on('translate', handleViewChange);
      this.mindMap.on('view_data_change', handleViewChange);

      // 8. 点击外部失焦提交
      window.addEventListener('mousedown', (e) => {
        if (!this.isEditing) return;
        if (this.inputWrap.contains(e.target) ||
            this.capsule.contains(e.target) ||
            this.bubbleMenu.contains(e.target)) {
          return;
        }
        const bottomToolbar = this.container.querySelector('.mm-bottom-toolbar') || document.querySelector('.mm-bottom-toolbar');
        if (bottomToolbar && bottomToolbar.contains(e.target)) {
          return;
        }
        this.commitAndHide();
      }, true);
    }

    show(node) {
      if (!node) return;
      if (this.isEditing) {
        this.commitAndHide();
      }

      if (this.currentNode && this.currentNode.group) {
        this.currentNode.group.removeClass('is-mm-editing');
        if (this.currentNode.hoverNode) this.currentNode.hoverNode.show();
      }

      this.currentNode = node;
      this.isEditing = true;
      this.hideBubbleMenu();

      if (node.group) {
        node.group.addClass('is-mm-editing');
      }
      if (node.hoverNode) {
        node.hoverNode.hide();
      }

      const rawData = (node.nodeData && node.nodeData.data) || {};
      let text = rawData.text || '';
      text = stripOuterParagraph(text);

      this.textarea.value = text;
      this.inputWrap.style.display = 'block';

      this.updatePosition();
      this.autoResize();
      this.updatePreview();

      this.textarea.focus();
      this.textarea.selectionStart = text.length;
      this.textarea.selectionEnd = text.length;
    }

    hasSelection() {
      if (!this.isEditing || !this.textarea) return false;
      const start = this.textarea.selectionStart;
      const end = this.textarea.selectionEnd;
      return (start !== undefined && end !== undefined && start !== end);
    }

    checkSelection() {
      if (!this.isEditing) {
        this.hideBubbleMenu();
        return;
      }
      if (this.hasSelection()) {
        this.showBubbleMenu();
      } else {
        this.hideBubbleMenu();
      }
    }

    showBubbleMenu() {
      if (!this.isEditing || !this.currentNode) return;
      const wrapRect = this.inputWrap.getBoundingClientRect();
      let left = wrapRect.left + wrapRect.width / 2;
      let top = wrapRect.top - 8;

      left = Math.max(160, Math.min(window.innerWidth - 160, left));
      if (top - 45 < 0) {
        const capsuleRect = this.capsule.getBoundingClientRect();
        top = (this.capsule.style.display !== 'none' ? capsuleRect.bottom : wrapRect.bottom) + 38;
      }

      this.bubbleMenu.style.left = `${Math.round(left)}px`;
      this.bubbleMenu.style.top = `${Math.round(top)}px`;
      this.bubbleMenu.style.display = 'flex';
    }

    hideBubbleMenu() {
      if (this.bubbleMenu) {
        this.bubbleMenu.style.display = 'none';
      }
      if (this.bubblePopover) {
        this.bubblePopover.classList.remove('show');
      }
    }

    formatSelection(type, extra, optStart, optEnd) {
      if (!this.isEditing || !this.textarea) return;
      const start = (typeof optStart === 'number') ? optStart : this.textarea.selectionStart;
      const end = (typeof optEnd === 'number') ? optEnd : this.textarea.selectionEnd;
      const val = this.textarea.value;

      if (start === end) {
        let insert = '';
        let cursorOffset = 0;
        if (type === 'bold') { insert = '****'; cursorOffset = 2; }
        else if (type === 'italic') { insert = '**'; cursorOffset = 1; }
        else if (type === 'underline') { insert = '<u></u>'; cursorOffset = 3; }
        else if (type === 'strikethrough') { insert = '~~~~'; cursorOffset = 2; }
        else if (type === 'code') { insert = '``'; cursorOffset = 1; }
        else if (type === 'math') { insert = '$$'; cursorOffset = 1; }
        else if (type === 'color' && extra && extra !== 'none') {
          insert = `<mark class="mm-inline-hl-${extra}"></mark>`;
          cursorOffset = 27 + extra.length;
        }

        if (insert) {
          this.textarea.value = val.substring(0, start) + insert + val.substring(end);
          this.textarea.selectionStart = start + cursorOffset;
          this.textarea.selectionEnd = start + cursorOffset;
          this.autoResize();
          this.updatePreview();
        }
        return;
      }

      const sel = val.substring(start, end);
      let newVal = val;
      let newStart = start;
      let newEnd = end;

      if (type === 'bold') {
        if (sel.startsWith('**') && sel.endsWith('**') && sel.length >= 4) {
          const unwrapped = sel.slice(2, -2);
          newVal = val.substring(0, start) + unwrapped + val.substring(end);
          newStart = start;
          newEnd = start + unwrapped.length;
        } else if (start >= 2 && val.substring(start - 2, start) === '**' && val.substring(end, end + 2) === '**') {
          newVal = val.substring(0, start - 2) + sel + val.substring(end + 2);
          newStart = start - 2;
          newEnd = newStart + sel.length;
        } else {
          const wrapped = `**${sel}**`;
          newVal = val.substring(0, start) + wrapped + val.substring(end);
          newStart = start + 2;
          newEnd = newStart + sel.length;
        }
      } else if (type === 'italic') {
        if (sel.startsWith('*') && !sel.startsWith('**') && sel.endsWith('*') && !sel.endsWith('**') && sel.length >= 2) {
          const unwrapped = sel.slice(1, -1);
          newVal = val.substring(0, start) + unwrapped + val.substring(end);
          newStart = start;
          newEnd = start + unwrapped.length;
        } else if (start >= 1 && val[start - 1] === '*' && val[start - 2] !== '*' && val[end] === '*' && val[end + 1] !== '*') {
          newVal = val.substring(0, start - 1) + sel + val.substring(end + 1);
          newStart = start - 1;
          newEnd = newStart + sel.length;
        } else {
          const wrapped = `*${sel}*`;
          newVal = val.substring(0, start) + wrapped + val.substring(end);
          newStart = start + 1;
          newEnd = newStart + sel.length;
        }
      } else if (type === 'underline') {
        if (sel.startsWith('<u>') && sel.endsWith('</u>') && sel.length >= 7) {
          const unwrapped = sel.slice(3, -4);
          newVal = val.substring(0, start) + unwrapped + val.substring(end);
          newStart = start;
          newEnd = start + unwrapped.length;
        } else if (start >= 3 && val.substring(start - 3, start) === '<u>' && val.substring(end, end + 4) === '</u>') {
          newVal = val.substring(0, start - 3) + sel + val.substring(end + 4);
          newStart = start - 3;
          newEnd = newStart + sel.length;
        } else {
          const wrapped = `<u>${sel}</u>`;
          newVal = val.substring(0, start) + wrapped + val.substring(end);
          newStart = start + 3;
          newEnd = newStart + sel.length;
        }
      } else if (type === 'strikethrough') {
        if (sel.startsWith('~~') && sel.endsWith('~~') && sel.length >= 4) {
          const unwrapped = sel.slice(2, -2);
          newVal = val.substring(0, start) + unwrapped + val.substring(end);
          newStart = start;
          newEnd = start + unwrapped.length;
        } else if (start >= 2 && val.substring(start - 2, start) === '~~' && val.substring(end, end + 2) === '~~') {
          newVal = val.substring(0, start - 2) + sel + val.substring(end + 2);
          newStart = start - 2;
          newEnd = newStart + sel.length;
        } else {
          const wrapped = `~~${sel}~~`;
          newVal = val.substring(0, start) + wrapped + val.substring(end);
          newStart = start + 2;
          newEnd = newStart + sel.length;
        }
      } else if (type === 'code') {
        if (sel.startsWith('`') && sel.endsWith('`') && sel.length >= 2) {
          const unwrapped = sel.slice(1, -1);
          newVal = val.substring(0, start) + unwrapped + val.substring(end);
          newStart = start;
          newEnd = start + unwrapped.length;
        } else if (start >= 1 && val[start - 1] === '`' && val[end] === '`') {
          newVal = val.substring(0, start - 1) + sel + val.substring(end + 1);
          newStart = start - 1;
          newEnd = newStart + sel.length;
        } else {
          const wrapped = `\`${sel}\``;
          newVal = val.substring(0, start) + wrapped + val.substring(end);
          newStart = start + 1;
          newEnd = newStart + sel.length;
        }
      } else if (type === 'math') {
        if (sel.startsWith('$') && sel.endsWith('$') && sel.length >= 2) {
          const unwrapped = sel.slice(1, -1);
          newVal = val.substring(0, start) + unwrapped + val.substring(end);
          newStart = start;
          newEnd = start + unwrapped.length;
        } else if (start >= 1 && val[start - 1] === '$' && val[end] === '$') {
          newVal = val.substring(0, start - 1) + sel + val.substring(end + 1);
          newStart = start - 1;
          newEnd = newStart + sel.length;
        } else {
          const wrapped = `$${sel}$`;
          newVal = val.substring(0, start) + wrapped + val.substring(end);
          newStart = start + 1;
          newEnd = newStart + sel.length;
        }
      } else if (type === 'color') {
        const res = this.applyHighlightToRange(val, start, end, extra);
        newVal = res.val;
        newStart = res.start;
        newEnd = res.end;
      }

      this.textarea.value = newVal;
      this.autoResize();
      this.updatePreview();
      this.textarea.focus();
      this.textarea.setSelectionRange(newStart, newEnd);
      this.showBubbleMenu();
    }

    applyHighlightToRange(val, start, end, colorKey) {
      if (!val) val = '';
      let normColor = colorKey;
      if (normColor === 'pink') normColor = 'red';

      if (start === end) {
        if (!normColor || normColor === 'none') return { val, start, end };
        const tagStart = `<mark class="mm-inline-hl-${normColor}">`;
        const tagEnd = `</mark>`;
        const newVal = val.substring(0, start) + tagStart + tagEnd + val.substring(end);
        const newPos = start + tagStart.length;
        return { val: newVal, start: newPos, end: newPos };
      }

      const mathRegex = /\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$/g;
      let mathMatch;
      while ((mathMatch = mathRegex.exec(val)) !== null) {
        const mStart = mathMatch.index;
        const mEnd = mStart + mathMatch[0].length;
        if (start < mEnd && end > mStart) {
          start = Math.min(start, mStart);
          end = Math.max(end, mEnd);
        }
      }

      const markTagRegex = /<(?:mark|span)\s+class="mm-(?:inline|text)-hl-([a-z]+)">([\s\S]*?)<\/(?:mark|span)>/gi;
      let tagMatch;
      let matchedTagEnclosing = null;

      while ((tagMatch = markTagRegex.exec(val)) !== null) {
        const tStart = tagMatch.index;
        const tEnd = tStart + tagMatch[0].length;
        const tagColor = tagMatch[1];
        const innerText = tagMatch[2];
        const openTag = tagMatch[0].substring(0, tagMatch[0].indexOf('>') + 1);
        const openTagLen = openTag.length;
        const contentStart = tStart + openTagLen;
        const contentEnd = contentStart + innerText.length;

        if (start >= tStart && end <= tEnd) {
          matchedTagEnclosing = {
            tStart, tEnd,
            contentStart, contentEnd,
            tagColor,
            innerText,
            openTagLen
          };
          break;
        } else if (start < tEnd && end > tStart) {
          start = Math.min(start, tStart);
          end = Math.max(end, tEnd);
        }
      }

      if (matchedTagEnclosing) {
        const { tStart, tEnd, contentStart, contentEnd, tagColor, innerText } = matchedTagEnclosing;
        if ((start <= contentStart && end >= contentEnd) || (start === tStart && end === tEnd)) {
          if (!normColor || normColor === 'none' || normColor === tagColor) {
            const newVal = val.substring(0, tStart) + innerText + val.substring(tEnd);
            return { val: newVal, start: tStart, end: tStart + innerText.length };
          } else {
            const newWrapped = `<mark class="mm-inline-hl-${normColor}">${innerText}</mark>`;
            const newVal = val.substring(0, tStart) + newWrapped + val.substring(tEnd);
            return { val: newVal, start: tStart, end: tStart + newWrapped.length };
          }
        }

        const relStart = Math.max(0, start - contentStart);
        const relEnd = Math.min(innerText.length, end - contentStart);
        const partBefore = innerText.substring(0, relStart);
        const partSelected = innerText.substring(relStart, relEnd);
        const partAfter = innerText.substring(relEnd);

        let middleFormatted = partSelected;
        if (normColor && normColor !== 'none' && normColor !== tagColor) {
          middleFormatted = `<mark class="mm-inline-hl-${normColor}">${partSelected}</mark>`;
        }

        let replacement = '';
        if (partBefore) {
          replacement += `<mark class="mm-inline-hl-${tagColor}">${partBefore}</mark>`;
        }
        replacement += middleFormatted;
        if (partAfter) {
          replacement += `<mark class="mm-inline-hl-${tagColor}">${partAfter}</mark>`;
        }

        const newVal = val.substring(0, tStart) + replacement + val.substring(tEnd);
        const newStart = tStart + (partBefore ? `<mark class="mm-inline-hl-${tagColor}">${partBefore}</mark>`.length : 0);
        const newEnd = newStart + middleFormatted.length;
        return { val: newVal, start: newStart, end: newEnd };
      }

      const sel = val.substring(start, end);
      const cleanInner = sel.replace(/<(?:mark|span)\s+class="mm-(?:inline|text)-hl-[a-z]+">/gi, '')
                            .replace(/<\/(?:mark|span)>/gi, '');

      if (!normColor || normColor === 'none') {
        const newVal = val.substring(0, start) + cleanInner + val.substring(end);
        return { val: newVal, start, end: start + cleanInner.length };
      }

      const wrapped = `<mark class="mm-inline-hl-${normColor}">${cleanInner}</mark>`;
      const newVal = val.substring(0, start) + wrapped + val.substring(end);
      return { val: newVal, start, end: start + wrapped.length };
    }

    updatePosition() {
      if (!this.currentNode) return;
      const foreignObj = this.currentNode.group && this.currentNode.group.findOne('foreignObject');
      let rect = null;
      if (foreignObj && foreignObj.node) {
        rect = foreignObj.node.getBoundingClientRect();
      }

      if (!rect) {
        const transform = this.mindMap.view.getTransformData();
        const scale = (transform && transform.state && transform.state.scale) || this.mindMap.view.scale || 1;
        const x = (transform && transform.state && transform.state.x) || 0;
        const y = (transform && transform.state && transform.state.y) || 0;
        const containerRect = this.mindMap.el.getBoundingClientRect();
        rect = {
          left: containerRect.left + x + this.currentNode.left * scale,
          top: containerRect.top + y + this.currentNode.top * scale,
          width: this.currentNode.width * scale,
          height: this.currentNode.height * scale
        };
      }

      const minW = Math.max(rect.width, 160);
      const minH = Math.max(rect.height, 30);

      this.inputWrap.style.left = `${Math.round(rect.left)}px`;
      this.inputWrap.style.top = `${Math.round(rect.top)}px`;
      this.inputWrap.style.minWidth = `${Math.round(minW)}px`;
      this.inputWrap.style.minHeight = `${Math.round(minH)}px`;

      const capsuleGap = 8;
      let capsuleTop = rect.bottom + capsuleGap;
      const estimatedCapsuleHeight = 50;
      if (capsuleTop + estimatedCapsuleHeight > window.innerHeight) {
        capsuleTop = Math.max(10, rect.top - estimatedCapsuleHeight - capsuleGap);
      }

      this.capsule.style.left = `${Math.round(rect.left)}px`;
      this.capsule.style.top = `${Math.round(capsuleTop)}px`;
    }

    autoResize() {
      if (!this.textarea) return;
      this.textarea.style.height = 'auto';
      const scrollHeight = this.textarea.scrollHeight;
      this.textarea.style.height = `${Math.max(scrollHeight, 26)}px`;

      const wrapRect = this.inputWrap.getBoundingClientRect();
      const capsuleGap = 8;
      let capsuleTop = wrapRect.bottom + capsuleGap;
      if (capsuleTop + 50 > window.innerHeight) {
        capsuleTop = Math.max(10, wrapRect.top - 58);
      }
      this.capsule.style.top = `${Math.round(capsuleTop)}px`;
    }

    updatePreview() {
      if (!this.capsuleContent) return;
      const text = this.textarea.value;

      if (!text || text.trim() === '') {
        this.capsule.style.display = 'none';
        this.capsuleContent.innerHTML = '';
        return;
      }

      let renderedHtml = '';
      if (global.MarkdownLatexEngine && typeof global.MarkdownLatexEngine.renderInline === 'function') {
        try {
          renderedHtml = global.MarkdownLatexEngine.renderInline(text);
        } catch (err) {
          renderedHtml = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
      } else {
        renderedHtml = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }

      this.capsuleContent.innerHTML = renderedHtml;
      this.capsule.style.display = 'block';
    }

    commitAndHide() {
      if (!this.isEditing || !this.currentNode) return;
      const newText = this.textarea.value.trim();
      const node = this.currentNode;

      this.hideBubbleMenu();

      if (node.group) {
        node.group.removeClass('is-mm-editing');
      }
      if (node.hoverNode) {
        node.hoverNode.show();
      }

      this.inputWrap.style.display = 'none';
      this.capsule.style.display = 'none';
      this.isEditing = false;
      this.currentNode = null;

      this.mindMap.execCommand('SET_NODE_TEXT', node, newText);
    }

    cancelAndHide() {
      this.hideBubbleMenu();
      if (this.currentNode) {
        if (this.currentNode.group) {
          this.currentNode.group.removeClass('is-mm-editing');
        }
        if (this.currentNode.hoverNode) {
          this.currentNode.hoverNode.show();
        }
      }
      this.inputWrap.style.display = 'none';
      this.capsule.style.display = 'none';
      this.isEditing = false;
      this.currentNode = null;
    }
  }

  global.MindMapNodeEditor = MindMapNodeEditor;
})(typeof window !== 'undefined' ? window : this);
