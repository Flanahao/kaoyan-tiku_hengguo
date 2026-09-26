/**
 * 考研数学认知视图 · MathViz 超轻量参数化数学几何动图微部件
 * 
 * 核心设计：
 * 1. 纯原生 SVG + Vanilla JS 矢量绘制，零第三方大型图表库依赖；
 * 2. 支持按需悬浮弹出 (Popover) 或内联挂载，支持交互式参数滑动与状态切换；
 * 3. 严格无任何表情符号，数学排版规范，保持导图节点紧凑轻盈。
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MathVizWidget = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function createSvgEl(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      for (var k in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, k)) {
          el.setAttribute(k, attrs[k]);
        }
      }
    }
    return el;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. 微部件 A：间断点分类展示 (Discontinuity Trio)
  // 依据 kaogang_figures.json DSL 打造：可去 · 跳跃 · 无穷
  // ─────────────────────────────────────────────────────────────────────────────
  function renderDiscontinuityWidget(container, options) {
    container.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.className = 'mathviz-widget mathviz-discontinuity';

    // 顶部切换栏
    var tabRow = document.createElement('div');
    tabRow.className = 'mathviz-tabs';

    var tabs = [
      { id: 'removable', label: '可去间断点 (x = -3)' },
      { id: 'jump', label: '跳跃间断点 (x = 0)' },
      { id: 'infinite', label: '无穷间断点 (x = 3)' }
    ];

    var currentTab = 'removable';

    var svgBox = document.createElement('div');
    svgBox.className = 'mathviz-svg-container';

    var descBox = document.createElement('div');
    descBox.className = 'mathviz-caption';

    function drawContent(tabId) {
      currentTab = tabId;
      svgBox.innerHTML = '';

      var width = 340;
      var height = 180;
      var svg = createSvgEl('svg', {
        viewBox: '0 0 ' + width + ' ' + height,
        width: '100%',
        height: '100%',
        class: 'mathviz-svg'
      });

      // 坐标轴系统 (原点设在 width/2, height/2 附近)
      var ox = width / 2;
      var oy = height / 2 + 10;
      var scaleX = 28;
      var scaleY = 22;

      // 坐标网格底线
      var axisX = createSvgEl('line', {
        x1: '15', y1: oy, x2: width - 15, y2: oy,
        stroke: '#d0d3d6', 'stroke-width': '1.2'
      });
      var axisY = createSvgEl('line', {
        x1: ox, y1: '12', x2: ox, y2: height - 12,
        stroke: '#d0d3d6', 'stroke-width': '1.2'
      });
      svg.appendChild(axisX);
      svg.appendChild(axisY);

      // 轴标签
      var labelX = createSvgEl('text', {
        x: width - 20, y: oy - 6,
        fill: '#8f959e', 'font-size': '11', 'font-family': 'sans-serif'
      });
      labelX.textContent = 'x';
      var labelY = createSvgEl('text', {
        x: ox + 8, y: '18',
        fill: '#8f959e', 'font-size': '11', 'font-family': 'sans-serif'
      });
      labelY.textContent = 'y';
      svg.appendChild(labelX);
      svg.appendChild(labelY);

      if (tabId === 'removable') {
        // 可去间断点: f(x) = (x+3)^2 * 0.2 + 1, x!= -3, f(-3) = 2.4
        var pathData = [];
        for (var x = -5.5; x <= -0.5; x += 0.15) {
          if (Math.abs(x - (-3)) < 0.1) continue;
          var y = 0.25 * Math.pow(x + 3, 2) + 0.8;
          var px = ox + x * scaleX;
          var py = oy - y * scaleY;
          pathData.push((pathData.length === 0 ? 'M' : 'L') + px.toFixed(1) + ',' + py.toFixed(1));
        }

        var curve = createSvgEl('path', {
          d: pathData.join(' '),
          fill: 'none',
          stroke: '#3370ff',
          'stroke-width': '2'
        });
        svg.appendChild(curve);

        // 空心圆环 (x = -3, y = 0.8)
        var hole = createSvgEl('circle', {
          cx: ox + (-3) * scaleX,
          cy: oy - 0.8 * scaleY,
          r: '4.5',
          fill: '#ffffff',
          stroke: '#3370ff',
          'stroke-width': '2'
        });
        svg.appendChild(hole);

        // 实心定义点 (x = -3, y = 2.2)
        var point = createSvgEl('circle', {
          cx: ox + (-3) * scaleX,
          cy: oy - 2.2 * scaleY,
          r: '4',
          fill: '#ff7d00'
        });
        svg.appendChild(point);

        var txtHole = createSvgEl('text', {
          x: ox + (-3) * scaleX - 28,
          y: oy - 0.8 * scaleY + 16,
          fill: '#646a73',
          'font-size': '10'
        });
        txtHole.textContent = '极限值';
        var txtPoint = createSvgEl('text', {
          x: ox + (-3) * scaleX + 8,
          y: oy - 2.2 * scaleY + 4,
          fill: '#ff7d00',
          'font-size': '10'
        });
        txtPoint.textContent = 'f(-3)';
        svg.appendChild(txtHole);
        svg.appendChild(txtPoint);

        descBox.textContent = '可去间断点：左右极限均存在且相等，但函数值未定义或不等于极限值。';
      } else if (tabId === 'jump') {
        // 跳跃间断点: x < 0 时 y = -1.2 + 0.2*x (实心点)，x > 0 时 y = 1.2 + 0.2*x (空心点)
        var lineLeft = createSvgEl('line', {
          x1: ox - 3.5 * scaleX, y1: oy - (-1.2 - 0.7) * scaleY,
          x2: ox, y2: oy - (-1.2) * scaleY,
          stroke: '#00b42a', 'stroke-width': '2'
        });
        var lineRight = createSvgEl('line', {
          x1: ox, y1: oy - 1.2 * scaleY,
          x2: ox + 3.5 * scaleX, y2: oy - (1.2 + 0.7) * scaleY,
          stroke: '#00b42a', 'stroke-width': '2'
        });
        svg.appendChild(lineLeft);
        svg.appendChild(lineRight);

        // 左端实心点
        var pLeft = createSvgEl('circle', {
          cx: ox, cy: oy - (-1.2) * scaleY, r: '4', fill: '#00b42a'
        });
        // 右端空心点
        var pHole = createSvgEl('circle', {
          cx: ox, cy: oy - 1.2 * scaleY, r: '4.5', fill: '#ffffff', stroke: '#00b42a', 'stroke-width': '2'
        });
        svg.appendChild(pLeft);
        svg.appendChild(pHole);

        // 跳跃落差虚线
        var jumpLine = createSvgEl('line', {
          x1: ox, y1: oy - (-1.2) * scaleY,
          x2: ox, y2: oy - 1.2 * scaleY,
          stroke: '#f53f3f', 'stroke-width': '1.5', 'stroke-dasharray': '3,3'
        });
        svg.appendChild(jumpLine);

        var txtJump = createSvgEl('text', {
          x: ox + 10, y: oy + 4, fill: '#f53f3f', 'font-size': '10'
        });
        txtJump.textContent = '落差 Δy';
        svg.appendChild(txtJump);

        descBox.textContent = '跳跃间断点：左右极限均存在但不相等，曲线在断口处出现有限阶跃。';
      } else if (tabId === 'infinite') {
        // 无穷间断点: x = 3 处为竖直渐近线, y = 0.8 / (x - 2.5)
        var asymX = ox + 2.5 * scaleX;
        var asymLine = createSvgEl('line', {
          x1: asymX, y1: 15, x2: asymX, y2: height - 15,
          stroke: '#86909c', 'stroke-width': '1.2', 'stroke-dasharray': '4,4'
        });
        svg.appendChild(asymLine);

        // 左侧冲向负无穷
        var ptsL = [];
        for (var xl = -1; xl <= 2.2; xl += 0.2) {
          var yl = 0.8 / (xl - 2.5);
          var cpxL = ox + xl * scaleX;
          var cpyL = oy - Math.max(Math.min(yl, 4), -4) * scaleY;
          ptsL.push((ptsL.length === 0 ? 'M' : 'L') + cpxL.toFixed(1) + ',' + cpyL.toFixed(1));
        }
        var curveL = createSvgEl('path', {
          d: ptsL.join(' '), fill: 'none', stroke: '#722ed1', 'stroke-width': '2'
        });
        svg.appendChild(curveL);

        // 右侧冲向正无穷
        var ptsR = [];
        for (var xr = 2.8; xr <= 5.5; xr += 0.2) {
          var yr = 0.8 / (xr - 2.5);
          var cpxR = ox + xr * scaleX;
          var cpyR = oy - Math.max(Math.min(yr, 4), -4) * scaleY;
          ptsR.push((ptsR.length === 0 ? 'M' : 'L') + cpxR.toFixed(1) + ',' + cpyR.toFixed(1));
        }
        var curveR = createSvgEl('path', {
          d: ptsR.join(' '), fill: 'none', stroke: '#722ed1', 'stroke-width': '2'
        });
        svg.appendChild(curveR);

        var txtAsym = createSvgEl('text', {
          x: asymX + 6, y: 30, fill: '#722ed1', 'font-size': '10'
        });
        txtAsym.textContent = 'x = 3';
        svg.appendChild(txtAsym);

        descBox.textContent = '无穷间断点：左右极限至少有一侧趋于无穷大，曲线以竖直虚线为渐近线。';
      }

      svgBox.appendChild(svg);
    }

    tabs.forEach(function (t) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mathviz-tab-btn' + (t.id === currentTab ? ' active' : '');
      btn.textContent = t.label;
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var allBtns = tabRow.querySelectorAll('.mathviz-tab-btn');
        allBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        drawContent(t.id);
      });
      tabRow.appendChild(btn);
    });

    drawContent('removable');

    wrap.appendChild(tabRow);
    wrap.appendChild(svgBox);
    wrap.appendChild(descBox);
    container.appendChild(wrap);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. 微部件 B：导数定义与割线逼近切线参数化微部件 (Derivative Tangent Limit)
  // 曲线 f(x) = 0.5 * x^2, 基准点 P(1, 0.5), 动点 Q(1 + dx, f(1+dx))
  // 拖动滑块调节 dx，观察割线动态旋转逼近切线，计算瞬时斜率 k -> 1.000
  // ─────────────────────────────────────────────────────────────────────────────
  function renderDerivativeWidget(container, options) {
    container.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.className = 'mathviz-widget mathviz-derivative';

    var header = document.createElement('div');
    header.className = 'mathviz-header-info';
    header.innerHTML = '<span class="mathviz-label">导数几何定义：割线趋于切线</span>';

    var svgBox = document.createElement('div');
    svgBox.className = 'mathviz-svg-container';

    var controlRow = document.createElement('div');
    controlRow.className = 'mathviz-slider-row';

    var sliderLabel = document.createElement('span');
    sliderLabel.className = 'mathviz-slider-label';
    sliderLabel.textContent = '自变量增量 Δx:';

    var slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'mathviz-slider';
    slider.min = '0.05';
    slider.max = '1.8';
    slider.step = '0.01';
    slider.value = '1.2';

    var readout = document.createElement('span');
    readout.className = 'mathviz-readout';

    controlRow.appendChild(sliderLabel);
    controlRow.appendChild(slider);
    controlRow.appendChild(readout);

    var width = 340;
    var height = 200;
    var ox = 60;
    var oy = height - 35;
    var scaleX = 85;
    var scaleY = 70;

    function f(x) {
      return 0.5 * x * x;
    }
    function df(x) {
      return x;
    }

    function update(dxVal) {
      var dx = parseFloat(dxVal);
      var x0 = 1.0;
      var y0 = f(x0);
      var x1 = x0 + dx;
      var y1 = f(x1);
      var secantSlope = (y1 - y0) / dx;
      var tangentSlope = df(x0); // 1.0

      readout.textContent = 'Δx = ' + dx.toFixed(2) + '  割线斜率 k = ' + secantSlope.toFixed(3);

      svgBox.innerHTML = '';
      var svg = createSvgEl('svg', {
        viewBox: '0 0 ' + width + ' ' + height,
        width: '100%',
        height: '100%',
        class: 'mathviz-svg'
      });

      // 坐标轴
      var axisX = createSvgEl('line', {
        x1: '20', y1: oy, x2: width - 20, y2: oy,
        stroke: '#d0d3d6', 'stroke-width': '1.2'
      });
      var axisY = createSvgEl('line', {
        x1: ox, y1: '15', x2: ox, y2: height - 15,
        stroke: '#d0d3d6', 'stroke-width': '1.2'
      });
      svg.appendChild(axisX);
      svg.appendChild(axisY);

      // 绘制抛物线 f(x) = 0.5 x^2
      var curvePts = [];
      for (var x = 0; x <= 2.9; x += 0.08) {
        var cx = ox + x * scaleX;
        var cy = oy - f(x) * scaleY;
        curvePts.push((curvePts.length === 0 ? 'M' : 'L') + cx.toFixed(1) + ',' + cy.toFixed(1));
      }
      var curve = createSvgEl('path', {
        d: curvePts.join(' '),
        fill: 'none',
        stroke: '#3370ff',
        'stroke-width': '2'
      });
      svg.appendChild(curve);

      // 绘制理论切线 (y - y0 = tangentSlope * (x - x0))
      var tanX1 = 0.2;
      var tanY1 = y0 + tangentSlope * (tanX1 - x0);
      var tanX2 = 2.6;
      var tanY2 = y0 + tangentSlope * (tanX2 - x0);
      var tangentLine = createSvgEl('line', {
        x1: ox + tanX1 * scaleX, y1: oy - tanY1 * scaleY,
        x2: ox + tanX2 * scaleX, y2: oy - tanY2 * scaleY,
        stroke: '#f53f3f', 'stroke-width': '1.5', 'stroke-dasharray': '4,4'
      });
      svg.appendChild(tangentLine);

      // 绘制实际割线 PQ 延长线
      var secX1 = 0.2;
      var secY1 = y0 + secantSlope * (secX1 - x0);
      var secX2 = 2.8;
      var secY2 = y0 + secantSlope * (secX2 - x0);
      var secantLine = createSvgEl('line', {
        x1: ox + secX1 * scaleX, y1: oy - secY1 * scaleY,
        x2: ox + secX2 * scaleX, y2: oy - secY2 * scaleY,
        stroke: '#ff7d00', 'stroke-width': '2'
      });
      svg.appendChild(secantLine);

      // 基准点 P
      var px = ox + x0 * scaleX;
      var py = oy - y0 * scaleY;
      var ptP = createSvgEl('circle', {
        cx: px, cy: py, r: '4.5', fill: '#3370ff'
      });
      var txtP = createSvgEl('text', {
        x: px - 18, y: py - 6, fill: '#3370ff', 'font-size': '11', 'font-weight': 'bold'
      });
      txtP.textContent = 'P(1, 0.5)';
      svg.appendChild(ptP);
      svg.appendChild(txtP);

      // 动点 Q
      var qx = ox + x1 * scaleX;
      var qy = oy - y1 * scaleY;
      var ptQ = createSvgEl('circle', {
        cx: qx, cy: qy, r: '4.5', fill: '#ff7d00'
      });
      var txtQ = createSvgEl('text', {
        x: qx + 6, y: qy + 4, fill: '#ff7d00', 'font-size': '11'
      });
      txtQ.textContent = 'Q';
      svg.appendChild(ptQ);
      svg.appendChild(txtQ);

      // 极限结论提示
      var labelLimit = createSvgEl('text', {
        x: width - 130, y: '30', fill: '#1d2129', 'font-size': '11'
      });
      labelLimit.textContent = 'lim Δx->0 = f\'(1) = 1.0';
      svg.appendChild(labelLimit);

      svgBox.appendChild(svg);
    }

    slider.addEventListener('input', function (e) {
      e.stopPropagation();
      update(slider.value);
    });

    update(slider.value);

    wrap.appendChild(header);
    wrap.appendChild(svgBox);
    wrap.appendChild(controlRow);
    container.appendChild(wrap);
  }

  function mountWidget(type, container, options) {
    if (!container) return;
    if (type === 'discontinuity_trio') {
      renderDiscontinuityWidget(container, options);
    } else if (type === 'derivative_tangent' || type === 'important_limit_sinx_x') {
      renderDerivativeWidget(container, options);
    }
  }

  function createDiscontinuityTrioWidget(options) {
    var c = document.createElement('div');
    renderDiscontinuityWidget(c, options);
    return c.firstElementChild || c;
  }

  function createDerivativeTangentWidget(options) {
    var c = document.createElement('div');
    renderDerivativeWidget(c, options);
    return c.firstElementChild || c;
  }

  var activePopoverEl = null;

  function closePopover() {
    if (activePopoverEl && activePopoverEl.parentNode) {
      activePopoverEl.parentNode.removeChild(activePopoverEl);
    }
    activePopoverEl = null;
  }

  function isPopoverOpen() {
    return Boolean(activePopoverEl && activePopoverEl.parentNode);
  }

  function openPopover(type, title, anchorEl, mountContainer) {
    closePopover();
    if (title && typeof title === 'object' && title.nodeType === 1) {
      mountContainer = anchorEl;
      anchorEl = title;
      title = '';
    }
    var host = mountContainer || document.getElementById('cognitiveModal') || document.body;

    var pop = document.createElement('div');
    pop.id = 'mathvizPopoverCard';
    pop.className = 'mathviz-floating-popover';
    pop.innerHTML =
      '<div class="mathviz-popover-header">' +
        '<span class="mathviz-popover-title">' + (title || '几何直观图解') + '</span>' +
        '<button type="button" class="mathviz-popover-close" title="关闭 (Esc)">&#x2715;</button>' +
      '</div>' +
      '<div class="mathviz-popover-body"></div>';

    var closeBtn = pop.querySelector('.mathviz-popover-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        closePopover();
      });
    }

    pop.addEventListener('mousedown', function (e) {
      e.stopPropagation();
    });

    var body = pop.querySelector('.mathviz-popover-body');
    mountWidget(type, body);

    host.appendChild(pop);
    activePopoverEl = pop;

    if (anchorEl && typeof anchorEl.getBoundingClientRect === 'function') {
      var rect = anchorEl.getBoundingClientRect();
      var left = Math.min(window.innerWidth - 390, Math.max(20, rect.left));
      var top = rect.bottom + 10;
      if (top + 280 > window.innerHeight) {
        top = Math.max(60, rect.top - 280);
      }
      pop.style.left = Math.round(left) + 'px';
      pop.style.top = Math.round(top) + 'px';
    }
    return pop;
  }

  return {
    mountWidget: mountWidget,
    createDiscontinuityTrioWidget: createDiscontinuityTrioWidget,
    createDerivativeTangentWidget: createDerivativeTangentWidget,
    openPopover: openPopover,
    closePopover: closePopover,
    isPopoverOpen: isPopoverOpen
  };
});
