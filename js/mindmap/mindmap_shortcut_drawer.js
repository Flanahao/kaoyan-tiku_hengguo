/**
 * 思维导图快捷键指南抽屉 (MindMapShortcutDrawer)
 * 职责：
 * 1. 挂载于指定容器或界面右侧的滑出式面板 (Right Drawer)
 * 2. 呈现核心快捷键指南 (常用、节点样式、节点与层级操作、导航)
 * 3. 支持 H / Ctrl + / 唤起与切换，按 Esc 或点击关闭按钮平滑收起
 */
(function (global) {
  'use strict';

  class MindMapShortcutDrawer {
    constructor(options = {}) {
      this.options = options;
      this.mountContainer = options.container || document.body;
      this.isActiveCheck = typeof options.isActiveCheck === 'function' ? options.isActiveCheck : null;
      this.isOpen = false;
      this.initDom();
      this.bindEvents();
      global._mindMapShortcutDrawerInstance = this;
    }

    isActive() {
      if (this.isActiveCheck) {
        return !!this.isActiveCheck();
      }
      return true;
    }

    initDom() {
      const existing = this.mountContainer.querySelector('.mm-shortcut-drawer');
      if (existing) existing.remove();

      this.drawerEl = document.createElement('aside');
      this.drawerEl.className = 'mm-shortcut-drawer';
      this.drawerEl.innerHTML = `
        <div class="drawer-header">
          <div class="drawer-title" style="font-size: 15px; font-weight: 600; color: #1f2329;">快捷键指南</div>
          <button type="button" class="drawer-close-btn" title="关闭 (Esc)">&#x2715;</button>
        </div>
        <div class="drawer-body">
          <!-- 常用 -->
          <div class="shortcut-section">
            <div class="shortcut-section-title">常用</div>
            <div class="shortcut-item"><span>插入同级节点</span><kbd>Enter</kbd></div>
            <div class="shortcut-item"><span>插入子节点</span><kbd>Tab</kbd></div>
            <div class="shortcut-item"><span>插入父节点</span><kbd>Shift + Tab</kbd></div>
            <div class="shortcut-item"><span>进入节点编辑状态</span><kbd>空格</kbd></div>
            <div class="shortcut-item"><span>节点导航</span><kbd>&uarr; &darr; &larr; &rarr;</kbd></div>
            <div class="shortcut-item"><span>撤销</span><kbd>Ctrl + Z</kbd></div>
            <div class="shortcut-item"><span>重做</span><kbd>Ctrl + Y</kbd></div>
          </div>

          <!-- 节点样式 -->
          <div class="shortcut-section">
            <div class="shortcut-section-title">节点样式</div>
            <div class="shortcut-item"><span>高亮 (7色)</span><kbd>Alt + R, Y, P, B, C, O, G (Alt + H)</kbd></div>
            <div class="shortcut-item"><span>加粗</span><kbd>Ctrl + B</kbd></div>
            <div class="shortcut-item"><span>斜体</span><kbd>Ctrl + I</kbd></div>
            <div class="shortcut-item"><span>下划线</span><kbd>Ctrl + U</kbd></div>
          </div>

          <!-- 节点与层级操作 -->
          <div class="shortcut-section">
            <div class="shortcut-section-title">层级与分类展开</div>
            <div class="shortcut-item"><span>全量层 / 章节层切换</span><kbd>S</kbd></div>
            <div class="shortcut-item"><span>上一章 / 下一章</span><kbd>A / D</kbd></div>
            <div class="shortcut-item"><span>聚焦知识点 (连按巡航分节/章)</span><kbd>Q</kbd></div>
            <div class="shortcut-item"><span>聚焦核心考点 (连按巡航分组/章)</span><kbd>W</kbd></div>
            <div class="shortcut-item"><span>聚焦解题方法 (连按巡航招法/章)</span><kbd>E</kbd></div>
            <div class="shortcut-item"><span>分节骨架 (左至§1~§3)</span><kbd>1</kbd></div>
            <div class="shortcut-item"><span>核心全景 (同级对齐总览)</span><kbd>2</kbd></div>
            <div class="shortcut-item"><span>全图鸟瞰 (展开全部节点)</span><kbd>3</kbd></div>
            <div class="shortcut-item"><span>待确认标签一键转正</span><kbd>Shift + 空格</kbd></div>
            <div class="shortcut-item"><span>展开/折叠当前节点</span><kbd>Alt + .</kbd></div>
            <div class="shortcut-item"><span>复制 / 创建副本</span><kbd>Ctrl + C / Ctrl + D</kbd></div>
          </div>

          <!-- 导航与视图 -->
          <div class="shortcut-section">
            <div class="shortcut-section-title">导航与视图</div>
            <div class="shortcut-item"><span>光标为中心平滑缩放</span><kbd>鼠标滚轮</kbd></div>
            <div class="shortcut-item"><span>平移漫游画布</span><kbd>右键拖拽</kbd></div>
            <div class="shortcut-item"><span>开关关联线 (默认开)</span><kbd>L</kbd></div>
            <div class="shortcut-item"><span>退出认知视图</span><kbd>O / Esc</kbd></div>
            <div class="shortcut-item"><span>进入当前节点 (聚焦)</span><kbd>Ctrl + ]</kbd></div>
            <div class="shortcut-item"><span>返回上一级节点</span><kbd>Ctrl + [</kbd></div>
            <div class="shortcut-item"><span>视图切换 (大纲/导图)</span><kbd>M</kbd></div>
            <div class="shortcut-item"><span>快捷键面板 (点击画布收起)</span><kbd>H</kbd></div>
          </div>
        </div>
      `;

      this.mountContainer.appendChild(this.drawerEl);
      this.closeBtn = this.drawerEl.querySelector('.drawer-close-btn');
    }

    bindEvents() {
      // 点击关闭按钮
      this.closeBtn.addEventListener('click', () => {
        this.close();
      });

      // 点击抽屉外部（画布、节点、图表等）立即平滑收起抽屉
      document.addEventListener('pointerdown', (e) => {
        if (!this.isOpen || !this.isActive()) return;
        if (this.drawerEl && !this.drawerEl.contains(e.target)) {
          this.close();
        }
      }, true);

      // 按 Esc 关闭抽屉
      window.addEventListener('keydown', (e) => {
        if (!this.isActive()) return;
        if (e.key === 'Escape' && this.isOpen) {
          this.close();
        }
      });
    }

    open() {
      this.isOpen = true;
      this.drawerEl.classList.add('open');
    }

    close() {
      this.isOpen = false;
      this.drawerEl.classList.remove('open');
    }

    toggle() {
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    }
  }

  global.MindMapShortcutDrawer = MindMapShortcutDrawer;
})(typeof window !== 'undefined' ? window : this);
