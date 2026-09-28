/**
 * 思维导图结构与分支线搭配控制器 (MindMapStructureController)
 * 职责：
 * 1. 在视口左下角构建一体化控制区 (垂直导航栏 + 水平画布缩放与居中控制条)
 *    - 垂直栏：撤销、U型圆弧重做、结构搭配切换、缩放数字显示
 *    - 水平栏：缩小、缩放滑动条 (20%~200%)、放大、定位到中心节点
 * 2. 渲染结构与分支线全量平铺搭配卡片 (7 种结构 + 4 种分支线全部直观展示)
 * 3. 分支线以平滑圆弧曲线 (curve) 与圆角折线 (straight) 为核心
 * 4. 支持挂载到任意指定宿主容器
 */
(function (global) {
  'use strict';

  class MindMapStructureController {
    constructor(mindMap, options = {}) {
      if (!mindMap) {
        throw new Error('[MindMapStructureController] 必须传入有效的 MindMap 实例');
      }

      this.mindMap = mindMap;
      this.options = Object.assign({
        defaultLayout: 'logicalStructure',
        defaultLineStyle: 'straight',
        container: null,
        onLayoutChange: null
      }, options);

      this.mountContainer = this.options.container || document.body;
      this.currentLayout = this.mindMap.getLayout() || this.options.defaultLayout;
      this.currentLineStyle = this.mindMap.getThemeConfig('lineStyle') || this.options.defaultLineStyle;
      this.isPopoverVisible = false;

      this.initDom();
      this.bindEvents();
      this.updateActiveStates();
      this.updateZoomDisplay();
    }

    initDom() {
      // 避免重复挂载
      const oldWrapper = this.mountContainer.querySelector('#mmBottomDockWrapper');
      if (oldWrapper) oldWrapper.remove();
      const oldDock = this.mountContainer.querySelector('#mmBottomDock');
      if (oldDock) oldDock.remove();
      const oldPopover = this.mountContainer.querySelector('#mmStructurePopover');
      if (oldPopover) oldPopover.remove();

      // 1. 左下角一体化控制区：垂直栏 + 水平缩放居中控制条
      const dockWrapper = document.createElement('div');
      dockWrapper.id = 'mmBottomDockWrapper';
      dockWrapper.className = 'mm-bottom-dock-wrapper';
      dockWrapper.innerHTML = `
        <!-- 左侧垂直浮动控制条 (撤销/重做/结构/缩放比) -->
        <div class="mm-bottom-dock" id="mmBottomDock">
          <button type="button" class="mm-dock-btn" id="btnDockUndo" title="撤销 (Ctrl+Z)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 14 4 9l5-5"></path>
              <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"></path>
            </svg>
          </button>
          <button type="button" class="mm-dock-btn" id="btnDockRedo" title="重做 (Ctrl+Y)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m15 14 5-5-5-5"></path>
              <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13"></path>
            </svg>
          </button>
          <button type="button" class="mm-dock-btn" id="btnDockStructure" title="切换结构与分支线">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="9" width="5" height="6" rx="1"></rect>
              <path d="M8 12h5"></path>
              <path d="M13 6v12"></path>
              <path d="M13 6h3"></path>
              <path d="M13 12h3"></path>
              <path d="M13 18h3"></path>
              <rect x="16" y="4" width="5" height="4" rx="1"></rect>
              <rect x="16" y="10" width="5" height="4" rx="1"></rect>
              <rect x="16" y="16" width="5" height="4" rx="1"></rect>
            </svg>
          </button>
          <div class="mm-dock-zoom" id="dockZoomText" title="缩放比例">100%</div>
        </div>

        <!-- 水平合并的画布大小调整条 (缩小 / 滑动条 / 放大 / 定位到中心节点) -->
        <div class="mm-zoom-slider-bar" id="mmZoomSliderBar">
          <button type="button" class="zoom-action-btn" id="btnDockZoomOut" title="缩小">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </button>

          <div class="zoom-slider-track-wrap">
            <input type="range" class="zoom-slider-input" id="dockZoomSlider" min="20" max="200" value="100" step="1" title="滑动调整缩放比例">
          </div>

          <button type="button" class="zoom-action-btn" id="btnDockZoomIn" title="放大">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="11" y1="8" x2="11" y2="14"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </button>

          <div class="locate-center-wrap">
            <button type="button" class="zoom-action-btn btn-locate-center" id="btnDockLocateCenter" aria-label="定位到中心节点">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M5 9V5h4M15 5h4v4M19 15v4h-4M9 19H5v-4" stroke="#3370ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>
                <circle cx="12" cy="12" r="2.2" fill="#3370ff"></circle>
              </svg>
            </button>
            <div class="locate-tooltip">定位到中心节点</div>
          </div>
        </div>

        <!-- 左下角章节与层级切换胶囊 (A/D 切章 · S 全量/章节切换) -->
        <div class="mm-layer-status-capsule" id="mmLayerStatusCapsule">
          <button type="button" class="mm-capsule-nav-btn" id="btnDockPrevChapter" title="上一章 (A)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <span class="mm-capsule-chapter-label" id="dockChapterLabel" title="当前章节 / 定焦章节 (A/D 切换)">第1章 函数、极限、连续</span>
          <button type="button" class="mm-capsule-nav-btn" id="btnDockNextChapter" title="下一章 (D)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
          <span class="mm-capsule-divider"></span>
          <button type="button" class="mm-capsule-layer-btn" id="btnDockToggleLayer" title="切换全量层 / 章节层 (S)">全量层 (S)</button>
        </div>
      `;
      this.mountContainer.appendChild(dockWrapper);
      this.dockWrapper = dockWrapper;
      this.dockEl = dockWrapper.querySelector('#mmBottomDock');
      this.zoomSliderBar = dockWrapper.querySelector('#mmZoomSliderBar');
      this.layerStatusCapsule = dockWrapper.querySelector('#mmLayerStatusCapsule');

      // 2. 结构与分支线全量平铺卡片
      const popoverEl = document.createElement('div');
      popoverEl.id = 'mmStructurePopover';
      popoverEl.className = 'mm-structure-popover';
      popoverEl.innerHTML = `
        <div class="popover-section-title">结构</div>
        <div class="popover-grid structure-grid structure-grid-all">
          <!-- 1. 向右展开 (逻辑结构图) -->
          <button type="button" class="structure-btn" data-layout="logicalStructure" title="向右逻辑图">
            <svg class="structure-icon" width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="3" y="10" width="7" height="8" rx="2" fill="currentColor"></rect>
              <path d="M10 14h5c2 0 2-6 4-6h6M15 14h10M10 14h5c2 0 2 6 4 6h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path>
              <circle cx="25" cy="8" r="1.5" fill="currentColor"></circle>
              <circle cx="25" cy="14" r="1.5" fill="currentColor"></circle>
              <circle cx="25" cy="20" r="1.5" fill="currentColor"></circle>
            </svg>
          </button>
          <!-- 2. 向左展开 (向左逻辑图) -->
          <button type="button" class="structure-btn" data-layout="logicalStructureLeft" title="向左逻辑图">
            <svg class="structure-icon" width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="18" y="10" width="7" height="8" rx="2" fill="currentColor"></rect>
              <path d="M18 14h-5c-2 0-2-6-4-6H3M13 14H3M18 14h-5c-2 0-2 6-4 6H3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path>
              <circle cx="3" cy="8" r="1.5" fill="currentColor"></circle>
              <circle cx="3" cy="14" r="1.5" fill="currentColor"></circle>
              <circle cx="3" cy="20" r="1.5" fill="currentColor"></circle>
            </svg>
          </button>
          <!-- 3. 左右平衡 (双向思维导图) -->
          <button type="button" class="structure-btn" data-layout="mindMap" title="双向思维导图">
            <svg class="structure-icon" width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="10" y="10" width="8" height="8" rx="2" fill="currentColor"></rect>
              <path d="M10 14H6c-1.5 0-1.5-5-3-5M10 14H6c-1.5 0-1.5 5-3 5M18 14h4c1.5 0 1.5-5 3-5M18 14h4c1.5 0 1.5 5 3 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path>
              <circle cx="3" cy="9" r="1.5" fill="currentColor"></circle>
              <circle cx="3" cy="19" r="1.5" fill="currentColor"></circle>
              <circle cx="25" cy="9" r="1.5" fill="currentColor"></circle>
              <circle cx="25" cy="19" r="1.5" fill="currentColor"></circle>
            </svg>
          </button>
          <!-- 4. 向下展开 (目录组织图) -->
          <button type="button" class="structure-btn" data-layout="catalogOrganization" title="目录组织图">
            <svg class="structure-icon" width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="9" y="3" width="10" height="6" rx="2" fill="currentColor"></rect>
              <path d="M14 9v5M5 14h18M6 14v10M6 17h5M6 21h5M22 14v10M22 17h5M22 21h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path>
            </svg>
          </button>
          <!-- 5. 组织架构图 -->
          <button type="button" class="structure-btn" data-layout="organizationStructure" title="组织架构图">
            <svg class="structure-icon" width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="9" y="3" width="10" height="6" rx="2" fill="currentColor"></rect>
              <path d="M14 9v4M4 13h20M4 13v6M14 13v6M24 13v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path>
              <rect x="2" y="19" width="5" height="5" rx="1" fill="currentColor"></rect>
              <rect x="11.5" y="19" width="5" height="5" rx="1" fill="currentColor"></rect>
              <rect x="21" y="19" width="5" height="5" rx="1" fill="currentColor"></rect>
            </svg>
          </button>
          <!-- 6. 水平时间轴 -->
          <button type="button" class="structure-btn" data-layout="timeline" title="时间轴">
            <svg class="structure-icon" width="28" height="28" viewBox="0 0 28 28" fill="none">
              <line x1="3" y1="14" x2="25" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
              <circle cx="7" cy="14" r="2.2" fill="currentColor"></circle>
              <circle cx="14" cy="14" r="2.2" fill="currentColor"></circle>
              <circle cx="21" cy="14" r="2.2" fill="currentColor"></circle>
              <path d="M7 6v5M14 17v5M21 6v5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path>
            </svg>
          </button>
          <!-- 7. 鱼骨图 -->
          <button type="button" class="structure-btn" data-layout="fishbone" title="鱼骨图">
            <svg class="structure-icon" width="28" height="28" viewBox="0 0 28 28" fill="none">
              <line x1="3" y1="14" x2="22" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
              <polygon points="21,11 25,14 21,17" fill="currentColor"></polygon>
              <line x1="7" y1="7" x2="11" y2="14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></line>
              <line x1="14" y1="7" x2="18" y2="14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></line>
              <line x1="7" y1="21" x2="11" y2="14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></line>
              <line x1="14" y1="21" x2="18" y2="14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></line>
            </svg>
          </button>
        </div>

        <div class="popover-section-title">分支线</div>
        <div class="popover-grid line-style-grid line-style-grid-all">
          <!-- 1. 圆角直角折线 (-C) -->
          <button type="button" class="line-style-btn" data-line-style="straight" title="圆角直角折线">
            <svg class="line-icon" width="48" height="22" viewBox="0 0 48 22" fill="none">
              <path d="M6 11H18C23 11 23 5 28 5H42" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
              <path d="M18 11C23 11 23 17 28 17H42" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
            </svg>
          </button>
          <!-- 2. 平滑圆弧曲线 (curve) -->
          <button type="button" class="line-style-btn" data-line-style="curve" title="平滑圆弧曲线">
            <svg class="line-icon" width="48" height="22" viewBox="0 0 48 22" fill="none">
              <path d="M6 11C16 11 20 5 42 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
              <path d="M6 11C16 11 20 17 42 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
            </svg>
          </button>
          <!-- 3. 水平折线 (polyline) -->
          <button type="button" class="line-style-btn" data-line-style="polyline" title="水平折线">
            <svg class="line-icon" width="48" height="22" viewBox="0 0 48 22" fill="none">
              <path d="M6 11H20V5H42" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
              <path d="M6 11H20V17H42" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
            </svg>
          </button>
          <!-- 4. 直连线 (direct) -->
          <button type="button" class="line-style-btn" data-line-style="direct" title="直连线">
            <svg class="line-icon" width="48" height="22" viewBox="0 0 48 22" fill="none">
              <path d="M8 11L40 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
              <path d="M8 11L40 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
            </svg>
          </button>
        </div>
      `;
      this.mountContainer.appendChild(popoverEl);
      this.popoverEl = popoverEl;
    }

    bindEvents() {
      // 1. 撤销 / 重做 (兼容 execCommand 与 exec)
      const btnUndo = this.dockWrapper.querySelector('#btnDockUndo');
      if (btnUndo) {
        btnUndo.addEventListener('click', (e) => {
          e.stopPropagation();
          if (typeof this.mindMap.execCommand === 'function') {
            this.mindMap.execCommand('BACK');
          } else if (typeof this.mindMap.exec === 'function') {
            this.mindMap.exec('UNDO');
          }
        });
      }

      const btnRedo = this.dockWrapper.querySelector('#btnDockRedo');
      if (btnRedo) {
        btnRedo.addEventListener('click', (e) => {
          e.stopPropagation();
          if (typeof this.mindMap.execCommand === 'function') {
            this.mindMap.execCommand('FORWARD');
          } else if (typeof this.mindMap.exec === 'function') {
            this.mindMap.exec('REDO');
          }
        });
      }

      // 2. 结构切换按钮唤起 Popover
      const btnStructure = this.dockWrapper.querySelector('#btnDockStructure');
      if (btnStructure) {
        btnStructure.addEventListener('click', (e) => {
          e.stopPropagation();
          this.togglePopover();
        });
      }

      // 3. 点击外部关闭 Popover
      document.addEventListener('click', (e) => {
        if (!this.popoverEl.contains(e.target) && !this.dockWrapper.contains(e.target)) {
          this.hidePopover();
        }
      });

      // 4. 结构与线条选择按钮事件委托
      this.popoverEl.addEventListener('click', (e) => {
        const structBtn = e.target.closest('.structure-btn');
        if (structBtn && structBtn.dataset.layout) {
          e.stopPropagation();
          this.setLayout(structBtn.dataset.layout);
          return;
        }

        const lineBtn = e.target.closest('.line-style-btn');
        if (lineBtn && lineBtn.dataset.lineStyle) {
          e.stopPropagation();
          this.setLineStyle(lineBtn.dataset.lineStyle);
          return;
        }
      });

      // 5. 水平合并缩放条：缩小
      const btnZoomOut = this.dockWrapper.querySelector('#btnDockZoomOut');
      if (btnZoomOut) {
        btnZoomOut.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.mindMap.view && typeof this.mindMap.view.narrow === 'function') {
            this.mindMap.view.narrow();
            this.updateZoomDisplay();
          }
        });
      }

      // 6. 水平合并缩放条：放大
      const btnZoomIn = this.dockWrapper.querySelector('#btnDockZoomIn');
      if (btnZoomIn) {
        btnZoomIn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.mindMap.view && typeof this.mindMap.view.enlarge === 'function') {
            this.mindMap.view.enlarge();
            this.updateZoomDisplay();
          }
        });
      }

      // 7. 缩放滑动条拖动交互
      const slider = this.dockWrapper.querySelector('#dockZoomSlider');
      if (slider) {
        slider.addEventListener('input', (e) => {
          e.stopPropagation();
          const pct = parseInt(e.target.value, 10);
          const scale = pct / 100;
          if (this.mindMap.view && typeof this.mindMap.view.setScale === 'function') {
            const cx = (this.mindMap.el && this.mindMap.el.clientWidth) ? this.mindMap.el.clientWidth / 2 : undefined;
            const cy = (this.mindMap.el && this.mindMap.el.clientHeight) ? this.mindMap.el.clientHeight / 2 : undefined;
            this.mindMap.view.setScale(scale, cx, cy);
          }
          this.updateZoomDisplay(scale);
        });
      }

      // 8. 定位到中心节点
      const btnLocateCenter = this.dockWrapper.querySelector('#btnDockLocateCenter');
      if (btnLocateCenter) {
        btnLocateCenter.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.mindMap.renderer && typeof this.mindMap.renderer.setRootNodeCenter === 'function') {
            this.mindMap.renderer.setRootNodeCenter();
          } else if (this.mindMap.view && typeof this.mindMap.view.reset === 'function') {
            this.mindMap.view.reset();
          }
          this.updateZoomDisplay();
        });
      }

      // 9. 点击缩放比例文本快速复位视口到 100%
      const zoomText = this.dockWrapper.querySelector('#dockZoomLevelText, #dockZoomText');
      if (zoomText) {
        zoomText.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.mindMap.view && typeof this.mindMap.view.reset === 'function') {
            this.mindMap.view.reset();
            this.updateZoomDisplay();
          }
        });
      }

      // 10. 监听 SimpleMindMap scale 事件更新缩放比率与滑动条
      if (this.mindMap.on) {
        this.mindMap.on('scale', (scale) => {
          this.updateZoomDisplay(scale);
        });
        this.mindMap.on('view_data_change', () => {
          this.updateZoomDisplay();
        });
      }

      // 11. 左下角章节与层级切换胶囊事件绑定 (A/D 切章 · S 全量/章节切换)
      const btnPrevChapter = this.dockWrapper.querySelector('#btnDockPrevChapter');
      if (btnPrevChapter) {
        btnPrevChapter.addEventListener('click', (e) => {
          e.stopPropagation();
          if (global.CognitiveViewController && typeof global.CognitiveViewController.navigateChapter === 'function') {
            global.CognitiveViewController.navigateChapter(-1);
          }
        });
      }

      const btnNextChapter = this.dockWrapper.querySelector('#btnDockNextChapter');
      if (btnNextChapter) {
        btnNextChapter.addEventListener('click', (e) => {
          e.stopPropagation();
          if (global.CognitiveViewController && typeof global.CognitiveViewController.navigateChapter === 'function') {
            global.CognitiveViewController.navigateChapter(1);
          }
        });
      }

      const btnToggleLayer = this.dockWrapper.querySelector('#btnDockToggleLayer');
      if (btnToggleLayer) {
        btnToggleLayer.addEventListener('click', (e) => {
          e.stopPropagation();
          if (global.CognitiveViewController && typeof global.CognitiveViewController.toggleLayerMode === 'function') {
            global.CognitiveViewController.toggleLayerMode();
          }
        });
      }
    }

    updateLayerStatus(statusInfo = {}) {
      if (!this.dockWrapper) return;
      const capsule = this.dockWrapper.querySelector('#mmLayerStatusCapsule');
      const labelEl = this.dockWrapper.querySelector('#dockChapterLabel');
      const toggleBtn = this.dockWrapper.querySelector('#btnDockToggleLayer');
      const prevBtn = this.dockWrapper.querySelector('#btnDockPrevChapter');
      const nextBtn = this.dockWrapper.querySelector('#btnDockNextChapter');
      if (!capsule) return;

      if (statusInfo.hidden) {
        capsule.style.display = 'none';
        return;
      }
      capsule.style.display = 'flex';

      const isMacro = statusInfo.layerMode === 'subject_macro';
      capsule.classList.toggle('is-macro-mode', isMacro);

      if (labelEl && statusInfo.labelText) {
        labelEl.textContent = statusInfo.labelText;
      }
      if (toggleBtn) {
        toggleBtn.textContent = isMacro ? '进章节 (S)' : '全量层 (S)';
        toggleBtn.classList.toggle('active', isMacro);
        toggleBtn.classList.toggle('is-macro-active', isMacro);
      }
      const navDisabled = Boolean(statusInfo.disableChapterNav);
      if (prevBtn) prevBtn.style.display = navDisabled ? 'none' : '';
      if (nextBtn) nextBtn.style.display = navDisabled ? 'none' : '';
    }

    togglePopover() {
      if (this.isPopoverVisible) {
        this.hidePopover();
      } else {
        this.showPopover();
      }
    }

    showPopover() {
      this.popoverEl.classList.add('visible');
      const btnStructure = this.dockWrapper.querySelector('#btnDockStructure');
      if (btnStructure) btnStructure.classList.add('active');
      this.isPopoverVisible = true;
      this.updateActiveStates();
    }

    hidePopover() {
      this.popoverEl.classList.remove('visible');
      const btnStructure = this.dockWrapper.querySelector('#btnDockStructure');
      if (btnStructure) btnStructure.classList.remove('active');
      this.isPopoverVisible = false;
    }

    // 核心切换逻辑：结构切换
    setLayout(layoutName) {
      if (!layoutName) return;
      this.currentLayout = layoutName;
      if (typeof this.mindMap.setLayout === 'function') {
        this.mindMap.setLayout(layoutName);
      }
      // 切换后自动平滑复位至视口中央
      if (this.mindMap.view && typeof this.mindMap.view.reset === 'function') {
        this.mindMap.view.reset();
      }
      this.updateActiveStates();

      if (typeof this.options.onLayoutChange === 'function') {
        this.options.onLayoutChange(layoutName);
      } else if (window._mindMapDragEnhancer && typeof window._mindMapDragEnhancer.onLayoutChange === 'function') {
        window._mindMapDragEnhancer.onLayoutChange(layoutName);
      }
    }

    // 核心切换逻辑：分支线风格切换
    setLineStyle(lineStyleName) {
      if (!lineStyleName) return;
      this.currentLineStyle = lineStyleName;
      const lineRadius = (lineStyleName === 'straight') ? 8 : 0;
      if (typeof this.mindMap.setThemeConfig === 'function') {
        this.mindMap.setThemeConfig({
          lineStyle: lineStyleName,
          lineRadius: lineRadius
        });
      }
      if (typeof this.mindMap.render === 'function') {
        this.mindMap.render();
      }
      this.updateActiveStates();
    }

    updateActiveStates() {
      const allStructBtns = this.popoverEl.querySelectorAll('.structure-btn');
      allStructBtns.forEach(btn => {
        if (btn.dataset.layout === this.currentLayout) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      const allLineBtns = this.popoverEl.querySelectorAll('.line-style-btn');
      allLineBtns.forEach(btn => {
        if (btn.dataset.lineStyle === this.currentLineStyle) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    // 更新缩放显示并同步更新水平滑动条
    updateZoomDisplay(scaleVal) {
      const zoomEl = this.dockWrapper ? this.dockWrapper.querySelector('#dockZoomLevelText, #dockZoomText') : null;
      let scale = (typeof scaleVal === 'number' && !isNaN(scaleVal)) ? scaleVal : null;
      if (scale === null && this.mindMap.view) {
        if (typeof this.mindMap.view.getTransformData === 'function') {
          const t = this.mindMap.view.getTransformData();
          if (t && t.state && typeof t.state.scale === 'number' && !isNaN(t.state.scale)) {
            scale = t.state.scale;
          } else if (t && typeof t.scaleX === 'number' && !isNaN(t.scaleX)) {
            scale = t.scaleX;
          }
        }
        if (scale === null && typeof this.mindMap.view.scale === 'number' && !isNaN(this.mindMap.view.scale)) {
          scale = this.mindMap.view.scale;
        }
      }
      if (typeof scale !== 'number' || isNaN(scale) || scale <= 0) {
        scale = 1;
      }
      const pct = Math.round(scale * 100);
      if (zoomEl) {
        zoomEl.textContent = `${pct}%`;
      }

      const slider = this.dockWrapper ? this.dockWrapper.querySelector('#dockZoomSlider') : null;
      if (slider) {
        slider.value = pct;
        const min = parseInt(slider.min, 10) || 20;
        const max = parseInt(slider.max, 10) || 200;
        const fillPct = Math.max(0, Math.min(100, ((pct - min) / (max - min)) * 100));
        slider.style.background = `linear-gradient(to right, #3370ff ${fillPct}%, #dee0e3 ${fillPct}%)`;
      }
    }
  }

  global.MindMapStructureController = MindMapStructureController;
})(typeof window !== 'undefined' ? window : this);
