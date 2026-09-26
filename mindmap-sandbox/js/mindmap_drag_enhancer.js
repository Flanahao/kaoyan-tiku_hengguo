/**
 * 思维导图磁吸拖拽与意图仲裁引擎 (MindMapDragEnhancer - Unified Canvas Space Version)
 * 核心特性：
 * 1. 严格统一至 SVG Canvas 内部局部坐标系 (scale / pan 变换完全归一)
 * 2. 节点主体绝对优先命中与中心加权 (Body Hit Priority & Center Weighting)
 * 3. 空间 AABB + 宽域延展包络面 (AABB with Multi-Direction Apron)
 * 4. 严格兄弟物理间隙插槽仲裁 (Strict Sibling Gutter Slot Decider)
 * 5. 垂直居中直角圆角折线动态渲染 (Centered Step Orthogonal Magnetic Line)
 * 6. 迟滞脱离阈值防抖 (Hysteresis Snap Radius)
 */
(function (global) {
  'use strict';

  class MindMapDragEnhancer {
    constructor(mindMap, options = {}) {
      if (!mindMap || !mindMap.drag) {
        console.warn('[MindMapDragEnhancer] 无法获取 mindMap.drag 实例，增强器未激活');
        return;
      }

      this.mindMap = mindMap;
      this.drag = mindMap.drag;
      this.options = Object.assign({
        captureRadius: 80,   // 包络面外欧氏距离捕获阈值 (画布单位)
        releaseRadius: 140,  // 迟滞脱离阈值 (画布单位，防止临界值抖动)
        lineColor: '#3370ff',
        lineWidth: 2,
        highlightColor: '#3370ff',
        highlightFill: 'rgba(51, 112, 255, 0.08)'
      }, options);

      this.activeTargetNode = null;

      this.initSvgElements();
      this.hookDragLifecycle();
    }

    // 初始化 SVG 磁吸辅助绘图元素 (挂载于 otherDraw 顶层容器，与 draw 享受完全相同的 transform 矩阵)
    initSvgElements() {
      // 动态直角圆角折线磁吸连线
      this.magneticLine = this.mindMap.otherDraw.path()
        .stroke({
          color: this.options.lineColor,
          width: this.options.lineWidth,
          linecap: 'round',
          linejoin: 'round'
        })
        .fill('none')
        .hide();
      this.magneticLine.node.setAttribute('class', 'smm-mm-magnetic-line');

      // 候选父节点吸附高亮光晕边框
      this.parentHighlight = this.mindMap.otherDraw.rect()
        .radius(6)
        .stroke({
          color: this.options.highlightColor,
          width: 2
        })
        .fill({
          color: this.options.highlightFill
        })
        .hide();
      this.parentHighlight.node.setAttribute('class', 'smm-mm-parent-highlight');
    }

    // 挂接 SimpleMindMap 原生拖拽生命周期
    hookDragLifecycle() {
      const self = this;
      const originalOnMove = this.drag.onMove.bind(this.drag);
      const originalRemoveCloneNode = this.drag.removeCloneNode.bind(this.drag);

      // 增强 onMove：接管意图判定，重构 overlapNode、prevNode 与 nextNode
      this.drag.onMove = function (x, y, e) {
        originalOnMove(x, y, e);
        self.handleMove(x, y, e);
      };

      // 增强 removeCloneNode：复位所有磁吸效果
      this.drag.removeCloneNode = function () {
        self.cleanup();
        originalRemoveCloneNode();
      };

      // 监听导图拖拽结束事件
      this.mindMap.on('node_dragend', () => {
        this.cleanup();
      });
    }

    // 将视口容器像素坐标 (vx, vy) 准确映射至 SVG Canvas 内部局部坐标系
    toCanvasPos(vx, vy) {
      const transform = this.mindMap.draw.transform();
      const scaleX = transform.scaleX || 1;
      const scaleY = transform.scaleY || 1;
      const translateX = transform.translateX || 0;
      const translateY = transform.translateY || 0;

      return {
        x: (vx - translateX) / scaleX,
        y: (vy - translateY) / scaleY,
        scaleX,
        scaleY,
        translateX,
        translateY
      };
    }

    // 核心位移处理与意图仲裁机
    handleMove(cloneX, cloneY, e) {
      if (!this.drag.isDragging || !this.drag.clone) {
        return;
      }

      const draggedNode = this.drag.beingDragNodeList && this.drag.beingDragNodeList[0];
      if (!draggedNode) {
        return;
      }

      // 1. 获取当前视口变换矩阵 (平移与缩放)
      const transform = this.mindMap.draw.transform();
      const scaleX = transform.scaleX || 1;
      const scaleY = transform.scaleY || 1;
      const translateX = transform.translateX || 0;
      const translateY = transform.translateY || 0;

      // 2. 提取视口容器坐标 (vx, vy)
      const vx = (this.drag.mouseMoveX !== undefined) ? this.drag.mouseMoveX : (cloneX || 0);
      const vy = (this.drag.mouseMoveY !== undefined) ? this.drag.mouseMoveY : (cloneY || 0);

      // 3. 映射光标至统一 SVG 画布局部坐标系
      const cursorCanvasX = (vx - translateX) / scaleX;
      const cursorCanvasY = (vy - translateY) / scaleY;

      // 4. 映射克隆节点锚点至统一 SVG 画布局部坐标系
      const offX = (typeof this.drag.offsetX === 'number') ? this.drag.offsetX : 0;
      const offY = (typeof this.drag.offsetY === 'number') ? this.drag.offsetY : 0;

      const cloneCanvasX = (vx - offX - translateX) / scaleX;
      const cloneCanvasY = (vy - offY - translateY) / scaleY;

      const cloneAnchorX = cloneCanvasX;
      const cloneAnchorY = cloneCanvasY + (draggedNode.height / 2);

      // 5. 剪枝获取所有合法候选节点列表 (排除当前拖拽子树)
      const rawCandidates = this.drag.nodeList || [];
      const candidates = rawCandidates.filter((node) => {
        if (node.isGeneralization) return false;
        if (node.uid === draggedNode.uid) return false;
        if (draggedNode.isAncestor && draggedNode.isAncestor(node)) return false;
        return true;
      });

      // 判定 1: 严格同级插入插槽判定
      const siblingSlot = this.detectSiblingGutterSlot(candidates, cursorCanvasX, cursorCanvasY);
      if (siblingSlot) {
        this.drag.overlapNode = null;
        this.drag.prevNode = siblingSlot.prevNode;
        this.drag.nextNode = siblingSlot.nextNode;
        this.cleanup();

        if (this.drag.placeholder && typeof this.drag.setPlaceholderRect === 'function') {
          const refNode = siblingSlot.prevNode || siblingSlot.nextNode;
          if (refNode) {
            const pX = refNode.left;
            let pY;
            if (siblingSlot.prevNode && siblingSlot.nextNode) {
              pY = (siblingSlot.prevNode.top + siblingSlot.prevNode.height + siblingSlot.nextNode.top) / 2 - 5;
            } else if (siblingSlot.prevNode) {
              pY = siblingSlot.prevNode.top + siblingSlot.prevNode.height + 6;
            } else {
              pY = siblingSlot.nextNode.top - 14;
            }
            try {
              this.drag.setPlaceholderRect({
                x: pX,
                y: pY,
                dir: 'right'
              });
            } catch (err) {
              // 容错捕获
            }
          }
        }
        return;
      }

      // 判定 2: 卡片核心躯干命中
      let directBodyHitNode = null;
      let minBodyCenterDist = Infinity;

      for (let i = 0; i < candidates.length; i++) {
        const node = candidates[i];
        const padX = 4;
        const padY = -4;
        const bLeft = node.left - padX;
        const bRight = node.left + node.width + padX;
        const bTop = node.top - padY;
        const bBottom = node.top + node.height + padY;

        const isCursorInBody = (cursorCanvasX >= bLeft && cursorCanvasX <= bRight && cursorCanvasY >= bTop && cursorCanvasY <= bBottom);

        if (isCursorInBody) {
          const cX = node.left + node.width / 2;
          const cY = node.top + node.height / 2;
          const distToCenter = Math.hypot(cursorCanvasX - cX, cursorCanvasY - cY);
          if (distToCenter < minBodyCenterDist) {
            minBodyCenterDist = distToCenter;
            directBodyHitNode = node;
          }
        }
      }

      if (directBodyHitNode) {
        this.applyMagneticSnap(directBodyHitNode, cloneAnchorX, cloneAnchorY);
        return;
      }

      // 判定 3: 侧翼引流子级磁吸
      const bestCandidate = this.checkApronSnap(candidates, cursorCanvasX, cursorCanvasY, cloneAnchorX, cloneAnchorY);

      // 判定 4: 执行磁吸或复位
      if (bestCandidate) {
        this.applyMagneticSnap(bestCandidate, cloneAnchorX, cloneAnchorY);
      } else {
        this.drag.overlapNode = null;
        this.cleanup();
      }
    }

    // 获取当前布局下节点的子级自然引流朝向 (向右 / 向左 / 向下)
    getNodeDirection(node) {
      const layout = this.mindMap.getLayout();
      if (layout === 'logicalStructureLeft') return 'left';
      if (layout === 'organizationStructure' || layout === 'catalogOrganization') return 'bottom';
      if (layout === 'mindMap') {
        const root = this.mindMap.renderer && this.mindMap.renderer.root;
        if (root && node) {
          if (node.uid === root.uid) {
            return 'right';
          }
          return node.left >= root.left ? 'right' : 'left';
        }
      }
      return 'right';
    }

    onLayoutChange() {
      this.cleanup();
      this.activeTargetNode = null;
    }

    // 侧翼引流子级磁吸判定
    checkApronSnap(candidates, cursorCanvasX, cursorCanvasY, cloneAnchorX, cloneAnchorY) {
      let bestCandidate = null;
      let minScore = Infinity;

      for (let i = 0; i < candidates.length; i++) {
        const node = candidates[i];
        const hasChildren = Array.isArray(node.children) && node.children.length > 0;
        const apronW = hasChildren ? 40 : 80;
        const dir = this.getNodeDirection(node);

        let envLeft, envRight, envTop, envBottom, anchorX, anchorY;

        if (dir === 'left') {
          envLeft = node.left - apronW;
          envRight = node.left + node.width * 0.7;
          envTop = node.top;
          envBottom = node.top + node.height;
          anchorX = node.left;
          anchorY = node.top + (node.height / 2);
          if (cursorCanvasY < envTop || cursorCanvasY > envBottom) continue;
        } else if (dir === 'bottom') {
          envLeft = node.left;
          envRight = node.left + node.width;
          envTop = node.top + node.height * 0.3;
          envBottom = node.top + node.height + apronW;
          anchorX = node.left + (node.width / 2);
          anchorY = node.top + node.height;
          if (cursorCanvasX < envLeft || cursorCanvasX > envRight) continue;
        } else {
          envLeft = node.left + node.width * 0.3;
          envRight = node.left + node.width + apronW;
          envTop = node.top;
          envBottom = node.top + node.height;
          anchorX = node.left + node.width;
          anchorY = node.top + (node.height / 2);
          if (cursorCanvasY < envTop || cursorCanvasY > envBottom) continue;
        }

        const isCursorInEnv = (cursorCanvasX >= envLeft && cursorCanvasX <= envRight && cursorCanvasY >= envTop && cursorCanvasY <= envBottom);

        let distance;
        if (isCursorInEnv) {
          distance = 0;
        } else {
          const dx = Math.max(envLeft - cursorCanvasX, 0, cursorCanvasX - envRight);
          const dy = Math.max(envTop - cursorCanvasY, 0, cursorCanvasY - envBottom);
          distance = Math.hypot(dx, dy);
        }

        const isCurrentActive = (this.activeTargetNode && this.activeTargetNode.uid === node.uid);
        const effectiveRadius = isCurrentActive ? this.options.releaseRadius : this.options.captureRadius;

        if (distance <= effectiveRadius) {
          const rawDist = Math.hypot(cloneAnchorX - anchorX, cloneAnchorY - anchorY);
          const score = distance * 10 + rawDist;

          if (score < minScore) {
            minScore = score;
            bestCandidate = node;
          }
        }
      }

      return bestCandidate;
    }

    getNodeSubtreeBottom(node) {
      let maxBottom = node.top + node.height;
      if (Array.isArray(node.children) && node.children.length > 0) {
        node.children.forEach((child) => {
          maxBottom = Math.max(maxBottom, this.getNodeSubtreeBottom(child));
        });
      }
      return maxBottom;
    }

    getNodeSubtreeTop(node) {
      let minTop = node.top;
      if (Array.isArray(node.children) && node.children.length > 0) {
        node.children.forEach((child) => {
          minTop = Math.min(minTop, this.getNodeSubtreeTop(child));
        });
      }
      return minTop;
    }

    // 检测当前是否命中兄弟节点之间的物理间隙插槽
    detectSiblingGutterSlot(candidates, cursorCanvasX, cursorCanvasY) {
      const parentMap = new Map();
      candidates.forEach((node) => {
        if (node.isRoot || !node.parent) return;
        const pUid = node.parent.uid;
        if (!parentMap.has(pUid)) {
          parentMap.set(pUid, []);
        }
        parentMap.get(pUid).push(node);
      });

      for (const [pUid, siblings] of parentMap.entries()) {
        if (siblings.length === 0) continue;
        siblings.sort((a, b) => a.top - b.top);

        for (let i = 0; i < siblings.length; i++) {
          const current = siblings[i];

          // 1. 第一个兄弟节点上方的同级插入槽
          if (i === 0) {
            const slotTop = current.top - 20;
            const slotBottom = current.top + 6;
            const slotLeft = current.left - 20;
            const slotRight = current.left + current.width;
            if (cursorCanvasY >= slotTop && cursorCanvasY <= slotBottom && cursorCanvasX >= slotLeft && cursorCanvasX <= slotRight) {
              return { prevNode: null, nextNode: current };
            }
          }

          // 2. 两个相邻兄弟节点之间的物理缝隙槽
          if (i < siblings.length - 1) {
            const next = siblings[i + 1];
            const gapTop = current.top + current.height;
            const gapBottom = next.top;

            const slotTop = gapTop - 6;
            const slotBottom = gapBottom + 6;
            const slotLeft = Math.min(current.left, next.left) - 20;
            const slotRight = Math.max(current.left + current.width, next.left + next.width);

            if (cursorCanvasY >= slotTop && cursorCanvasY <= slotBottom && cursorCanvasX >= slotLeft && cursorCanvasX <= slotRight) {
              return { prevNode: current, nextNode: next };
            }
          }

          // 3. 最后一个兄弟节点下方的同级插入槽
          if (i === siblings.length - 1) {
            const currentBottom = current.top + current.height;
            const slotTop = currentBottom - 6;
            const slotBottom = currentBottom + 20;
            const slotLeft = current.left - 20;
            const slotRight = current.left + current.width;
            if (cursorCanvasY >= slotTop && cursorCanvasY <= slotBottom && cursorCanvasX >= slotLeft && cursorCanvasX <= slotRight) {
              return { prevNode: current, nextNode: null };
            }
          }
        }
      }

      return null;
    }

    // 激活并渲染磁吸状态
    applyMagneticSnap(targetParent, cloneAnchorX, cloneAnchorY) {
      this.activeTargetNode = targetParent;
      this.drag.overlapNode = targetParent;
      this.drag.prevNode = null;
      this.drag.nextNode = null;

      if (this.drag.placeholder) {
        this.drag.placeholder.size(0, 0);
      }
      if (this.drag.placeHolderLine) {
        this.drag.placeHolderLine.hide();
      }

      const dir = this.getNodeDirection(targetParent);
      let x1, y1;
      if (dir === 'left') {
        x1 = targetParent.left;
        y1 = targetParent.top + (targetParent.height / 2);
      } else if (dir === 'bottom') {
        x1 = targetParent.left + (targetParent.width / 2);
        y1 = targetParent.top + targetParent.height;
      } else {
        x1 = targetParent.left + targetParent.width;
        y1 = targetParent.top + (targetParent.height / 2);
      }
      const x2 = cloneAnchorX;
      const y2 = cloneAnchorY;

      let pathData;
      if (dir === 'bottom') {
        if (Math.abs(x2 - x1) < 2) {
          pathData = `M ${x1} ${y1} L ${x2} ${y2}`;
        } else {
          const midY = y1 + Math.max((y2 - y1) * 0.5, 16);
          pathData = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
        }
      } else if (dir === 'left') {
        if (x2 >= x1 - 4) {
          pathData = `M ${x1} ${y1} L ${x2} ${y2}`;
        } else if (Math.abs(y2 - y1) < 2) {
          pathData = `M ${x1} ${y1} L ${x2} ${y2}`;
        } else {
          const midX = x1 - Math.max((x1 - x2) * 0.5, 16);
          pathData = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
        }
      } else {
        if (x2 <= x1 + 4) {
          pathData = `M ${x1} ${y1} L ${x2} ${y2}`;
        } else if (Math.abs(y2 - y1) < 2) {
          pathData = `M ${x1} ${y1} L ${x2} ${y2}`;
        } else {
          const midX = x1 + Math.max((x2 - x1) * 0.5, 16);
          const radius = 8;
          const maxR = Math.min(radius, Math.abs(midX - x1) / 2, Math.abs(y2 - y1) / 2);
          const r = Math.max(maxR, 0);

          if (r < 2) {
            pathData = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
          } else {
            const isDown = y2 > y1;
            const dy1 = isDown ? r : -r;
            const dy2 = isDown ? -r : r;
            pathData = `M ${x1} ${y1} L ${midX - r} ${y1} Q ${midX} ${y1} ${midX} ${y1 + dy1} L ${midX} ${y2 + dy2} Q ${midX} ${y2} ${midX + r} ${y2} L ${x2} ${y2}`;
          }
        }
      }

      this.magneticLine.plot(pathData).show();

      this.parentHighlight
        .size(targetParent.width + 8, targetParent.height + 6)
        .move(targetParent.left - 4, targetParent.top - 3)
        .show();
    }

    cleanup() {
      this.activeTargetNode = null;
      if (this.magneticLine) {
        this.magneticLine.hide();
      }
      if (this.parentHighlight) {
        this.parentHighlight.hide();
      }
      if (this.drag && this.drag.placeholder) {
        this.drag.placeholder.size(0, 0);
      }
      if (this.drag && this.drag.placeHolderLine) {
        this.drag.placeHolderLine.hide();
      }
    }
  }

  global.MindMapDragEnhancer = MindMapDragEnhancer;
})(typeof window !== 'undefined' ? window : this);
