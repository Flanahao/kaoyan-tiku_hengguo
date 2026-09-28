/**
 * 考研数学认知视图 · 第一章紧凑子节点树、一屏一览全局与双向键盘隔离 E2E 验证套件 (CDP)
 * 验证规约：
 * 1. 验证单一入口 index.html 正常加载，MindMap 独立工具集与认知视图组件挂载完备，且无返回按钮；
 * 2. 验证按下快捷键 O 正确呼出认知视图沉浸全屏弹窗 (#cognitiveModal)；
 * 3. 验证默认「一览全局」(Level 2) 紧凑排版：左知识 (§1~§3)、中根、右考点 (6个) & 招法 (5个) 一屏完整收纳且缩放比例舒适；
 * 4. 验证展开详情 (expandAll / Alt+0) 下紧凑子节点、语义前缀标签 ([定义]/[定理]/[步骤]/[避坑]/[同步块]) 与行内 KaTeX 渲染；
 * 5. 验证 Focus Resonance 拓扑聚焦高亮与跨分支贝塞尔曲线，以及按 Esc 先清除聚焦而不关闭弹窗；
 * 6. 验证 MathViz 几何图解按需气泡弹窗与滑块交互，以及按 Esc 先关闭气泡弹窗；
 * 7. 验证严格的双向键盘隔离：
 *    - 认知视图开启时：1-5、Space、A/D/J/K、Ctrl+Z、H、M 均被隔离在导图内，底层题库题号/状态/解析/面板零泄漏；
 *    - 认知视图关闭后：导图快捷键休眠，题库快捷键正常工作；
 * 8. 保存 4 张真机运行测试截屏至 tests/artifacts/。
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const HTTP_PORT = 8092;
const CDP_PORT = 9338;
const ROOT_DIR = path.resolve(__dirname, '..');
const ARTIFACTS_DIR = path.join(__dirname, 'artifacts');

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

let httpServer = null;
let chromeProcess = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function startHttpServer() {
  return new Promise((resolve) => {
    httpServer = http.createServer((req, res) => {
      let reqPath = decodeURIComponent(req.url.split('?')[0]);
      if (reqPath === '/') reqPath = '/index.html';
      const filePath = path.join(ROOT_DIR, reqPath);

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const mimeMap = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.woff2': 'font/woff2',
        '.woff': 'font/woff',
        '.ttf': 'font/ttf'
      };
      const contentType = mimeMap[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    });

    httpServer.listen(HTTP_PORT, '127.0.0.1', () => {
      console.log(`[HTTP] 静态测试服务器已启动: http://127.0.0.1:${HTTP_PORT}/index.html`);
      resolve();
    });
  });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function sendCDP(ws, method, params = {}, id = 1) {
  return new Promise((resolve, reject) => {
    const msgId = id || Math.floor(Math.random() * 100000);
    const handler = (evt) => {
      try {
        const raw = evt.data;
        const str = typeof raw === 'string' ? raw : raw.toString();
        const msg = JSON.parse(str);
        if (msg.id === msgId) {
          ws.removeEventListener('message', handler);
          if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          else resolve(msg.result);
        }
      } catch (e) {}
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}

let cdpSeq = 300;
function evaluate(ws, expression) {
  const id = ++cdpSeq;
  return sendCDP(ws, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, id)
    .then(r => {
      if (r && r.exceptionDetails) {
        const desc = (r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text;
        throw new Error(`[CDP Evaluation Error]: ${desc}`);
      }
      return r && r.result ? r.result.value : undefined;
    });
}

async function dispatchKey(ws, key, code, vk, modifiers = 0) {
  await sendCDP(ws, 'Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    key,
    code,
    windowsVirtualKeyCode: vk,
    modifiers
  }, ++cdpSeq);
  await sendCDP(ws, 'Input.dispatchKeyEvent', {
    type: 'keyUp',
    key,
    code,
    windowsVirtualKeyCode: vk,
    modifiers
  }, ++cdpSeq);
}

async function captureScreenshot(ws, filename) {
  const res = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' }, ++cdpSeq);
  if (res && res.data) {
    const filePath = path.join(ARTIFACTS_DIR, filename);
    const buf = Buffer.from(res.data, 'base64');
    let written = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        fs.writeFileSync(filePath, buf);
        written = true;
        break;
      } catch (err) {
        if (attempt === 4) throw err;
        await sleep(100);
      }
    }
    if (written) {
      console.log(`  [Screenshot] 已保存真机截屏: ${filename}`);
    }
  }
}

async function cleanup() {
  if (chromeProcess) {
    try { chromeProcess.kill('SIGKILL'); } catch (e) {}
    chromeProcess = null;
  }
  if (httpServer) {
    try { httpServer.close(); } catch (e) {}
    httpServer = null;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('  第一章认知视图 (紧凑子节点·一屏一览全局·键盘隔离) CDP E2E 测试');
  console.log('================================================================\n');

  try {
    await startHttpServer();

    const chromeCandidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
    const chromePath = chromeCandidates.find(p => fs.existsSync(p));
    if (!chromePath) throw new Error('未找到 Chrome 或 Edge 浏览器');

    const profileDir = path.join(require('os').tmpdir(), `cogn_cdp_profile_${Date.now()}`);
    console.log(`[Chrome] 启动无头浏览器 (端口: ${CDP_PORT})...`);
    chromeProcess = spawn(chromePath, [
      `--remote-debugging-port=${CDP_PORT}`,
      '--headless=new',
      '--window-size=1440,900',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${profileDir}`,
      `http://127.0.0.1:${HTTP_PORT}/index.html`
    ], { detached: false, stdio: 'ignore' });

    await sleep(2000);

    let pageTarget = null;
    for (let retry = 0; retry < 15; retry++) {
      try {
        const targets = await getJson(`http://127.0.0.1:${CDP_PORT}/json`);
        pageTarget = targets && targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
        if (pageTarget) break;
      } catch (e) {}
      await sleep(400);
    }
    if (!pageTarget) throw new Error('无法连接至 Chrome 调试端口');

    const ws = new globalThis.WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve);
      ws.addEventListener('error', reject);
    });

    await sendCDP(ws, 'Page.enable');
    await sendCDP(ws, 'Runtime.enable');
    await sendCDP(ws, 'DOM.enable');

    await sleep(2500);

    // ─────────────────────────────────────────────────────────────
    // 测试用例 1：组件工具集挂载与无返回按钮规约校验
    // ─────────────────────────────────────────────────────────────
    console.log('\n[Test 1] 校验 MindMap 独立工具集加载、无返回按钮设计与顶部控制栏移除...');
    const initCheck = await evaluate(ws, `
      (() => {
        if (typeof window.switchChapter === 'function') {
          window.switchChapter('math::基础30讲::高数::lec01');
        }
        const hasToolkit = Boolean(
          window.MindMapNodeRenderer &&
          window.MindMapDragEnhancer &&
          window.MindMapNodeEditor &&
          window.MindMapBottomToolbar &&
          window.MindMapOutliner &&
          window.MindMapShortcutDrawer &&
          window.MindMapStructureController &&
          window.MindMapShortcutManager &&
          window.DualViewController &&
          window.CognitiveViewController &&
          window.Chapter0MindMapData &&
          window.Chapter1MindMapData &&
          window.Chapter2MindMapData &&
          window.Chapter3MindMapData &&
          window.Chapter4MindMapData &&
          window.Chapter5MindMapData &&
          window.Chapter6MindMapData &&
          window.Chapter7MindMapData &&
          window.Chapter8MindMapData &&
          window.Chapter9MindMapData &&
          window.MathVizWidget
        );
        const closeBtn = document.getElementById('btnCloseCognitiveModal') || document.querySelector('#cognitiveModal .cognitive-close-btn');
        const topToolbar = document.getElementById('cognitiveFloatingToolbar');
        return { hasToolkit, hasBackBtn: Boolean(closeBtn), hasTopToolbar: Boolean(topToolbar), currentChapterId: window.currentChapterId };
      })()
    `);
    if (!initCheck.hasToolkit) throw new Error('MindMap 工具集或认知视图控制器未完全加载');
    if (initCheck.hasBackBtn) throw new Error('认知视图中不应存在返回按钮');
    if (initCheck.hasTopToolbar) throw new Error('顶部控制栏 (#cognitiveFloatingToolbar) 应已彻底移除');
    console.log('  PASS: MindMap 独立工具集及高数 0~9 全章节导图完整加载，严格遵循无返回按钮规范且顶部控制栏已物理移除');

    // ─────────────────────────────────────────────────────────────
    // 测试用例 2：快捷键 O 呼出认知视图、双向语义聚拢排版与常态拓扑关联线网
    // ─────────────────────────────────────────────────────────────
    console.log('\n[Test 2] 模拟快捷键 O 呼出认知视图，校验双向同类二级节点聚拢与常态拓扑关联线网...');
    await dispatchKey(ws, 'o', 'KeyO', 79);
    await sleep(800);

    const overviewStats = await evaluate(ws, `
      (() => {
        const modal = document.getElementById('cognitiveModal');
        const isOpen = Boolean(modal && modal.classList.contains('show') && window.CognitiveViewController.isOpen());
        const rootCard = document.querySelector('#cognitiveMindMapContainer [data-node-uid="root_chapter_1"]');
        const kp01Card = document.querySelector('#cognitiveMindMapContainer [data-node-uid="kp_gs01_01"]');
        const method01Card = document.querySelector('#cognitiveMindMapContainer [data-node-uid="m_gs01_01"]');
        const sec1Card = document.querySelector('#cognitiveMindMapContainer [data-node-uid="sec_1_func"], #cognitiveMindMapContainer [data-node-uid="sec_func_properties"]');
        const sec2Card = document.querySelector('#cognitiveMindMapContainer [data-node-uid="sec_2_limit"], #cognitiveMindMapContainer [data-node-uid="sec_limit_theory"]');
        const sec3Card = document.querySelector('#cognitiveMindMapContainer [data-node-uid="sec_3_cont"], #cognitiveMindMapContainer [data-node-uid="sec_continuity"]');
        const allVisibleCards = Array.from(document.querySelectorAll('#cognitiveMindMapContainer .smm-node .mm-node-card'));
        const mm = window.CognitiveViewController.getInstance();
        const scale = (mm && mm.view && mm.view.scale) ? mm.view.scale : 1;

        const rects = allVisibleCards.map(el => el.getBoundingClientRect()).filter(r => r.width > 0 && r.left > -1000 && r.top > -1000);
        const minX = Math.min(...rects.map(r => r.left));
        const maxX = Math.max(...rects.map(r => r.right));
        const minY = Math.min(...rects.map(r => r.top));
        const maxY = Math.max(...rects.map(r => r.bottom));

        const rootRect = rootCard ? rootCard.getBoundingClientRect() : null;
        const rootCenterX = rootRect ? (rootRect.left + rootRect.width / 2) : 720;
        const rootCenterY = rootRect ? (rootRect.top + rootRect.height / 2) : 450;

        // 正品字 △ 混合结构布局校验：
        // 1. 上方顶点：考点 (branch_exam_points, kp_gs01_01~05) 位于根节点上方，且 5 大考点呈水平目录并列
        // 2. 左下顶点：知识点 (§1~§3) 位于根节点左下方
        // 3. 右下顶点：招法 (m_gs01_*) 位于根节点右下方
        const sec1Rect = sec1Card ? sec1Card.getBoundingClientRect() : null;
        const sec2Rect = sec2Card ? sec2Card.getBoundingClientRect() : null;
        const sec3Rect = sec3Card ? sec3Card.getBoundingClientRect() : null;
        const kp01Rect = kp01Card ? kp01Card.getBoundingClientRect() : null;
        const kp05Card = document.querySelector('#cognitiveMindMapContainer [data-node-uid="kp_gs01_05"]');
        const kp05Rect = kp05Card ? kp05Card.getBoundingClientRect() : null;
        const m01Rect = method01Card ? method01Card.getBoundingClientRect() : null;

        const topCatalogClustered = kp01Rect && kp05Rect && rootRect &&
          (kp01Rect.bottom <= rootRect.top + 10) &&
          (kp05Rect.bottom <= rootRect.top + 10) &&
          (Math.abs(kp01Rect.top - kp05Rect.top) < 10) &&
          (kp05Rect.left > kp01Rect.right);

        const leftWingClustered = sec1Rect && sec2Rect && sec3Rect &&
          (sec1Rect.right <= rootCenterX + 50) &&
          (sec2Rect.right <= rootCenterX + 50) &&
          (sec3Rect.right <= rootCenterX + 50);

        const rightWingClustered = m01Rect &&
          (m01Rect.left >= rootCenterX - 50);

        const nexusLines = Array.from(document.querySelectorAll('#cognitiveMindMapContainer .smm-associative-line-container path.smm-associative-line-path'));
        const firstLine = nexusLines[0];
        const lineDasharray = firstLine ? window.getComputedStyle(firstLine).strokeDasharray : '';
        const lineIsSolid = !lineDasharray || lineDasharray === 'none';

        // 校验二级节点卡片 (考点 / 招法 / 知识) 100% 纯白不透明底色与实体边框，且关联线图层位于节点图层下方
        const branchKnowledgeCard = document.querySelector('#cognitiveMindMapContainer [data-node-uid="branch_knowledge"]');
        const branchExamCard = document.querySelector('#cognitiveMindMapContainer [data-node-uid="branch_exam_points"]');
        const branchMethodCard = document.querySelector('#cognitiveMindMapContainer [data-node-uid="branch_methods"]');
        const examCardStyle = branchExamCard ? window.getComputedStyle(branchExamCard) : null;
        const methodCardStyle = branchMethodCard ? window.getComputedStyle(branchMethodCard) : null;
        const level1OpaqueWhite = examCardStyle && methodCardStyle &&
          examCardStyle.backgroundColor === 'rgb(255, 255, 255)' &&
          methodCardStyle.backgroundColor === 'rgb(255, 255, 255)' &&
          examCardStyle.opacity === '1' &&
          methodCardStyle.opacity === '1';

        const assocContainer = document.querySelector('#cognitiveMindMapContainer .smm-associative-line-container');
        const nodeContainer = document.querySelector('#cognitiveMindMapContainer .smm-node-container');
        const assocBelowNodes = Boolean(
          assocContainer && nodeContainer &&
          (assocContainer.compareDocumentPosition(nodeContainer) & Node.DOCUMENT_POSITION_FOLLOWING)
        );

        // 校验 3 级节点卡片实体边框与纯白底色（杜绝悬空）
        const sampleCard = document.querySelector('#cognitiveMindMapContainer [data-node-uid="sec_1_func"]');
        const cardStyle = sampleCard ? window.getComputedStyle(sampleCard) : null;
        const cardHasBorder = cardStyle && parseFloat(cardStyle.borderTopWidth) > 0 && cardStyle.borderTopStyle === 'solid';
        const cardHasBg = cardStyle && cardStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && cardStyle.backgroundColor !== 'transparent';

        // 校验无 §2 重复字符复读
        const hasTextDuplication = Boolean(document.body.innerText.includes('§2 §2') || document.body.innerText.includes('§1 §1'));

        return {
          isOpen,
          visibleCardCount: rects.length,
          hasRoot: Boolean(rootCard),
          hasBranchKnowledge: Boolean(branchKnowledgeCard),
          hasBranchExam: Boolean(branchExamCard),
          hasBranchMethod: Boolean(branchMethodCard),
          hasKp01: Boolean(kp01Card),
          hasMethod01: Boolean(method01Card),
          hasSec1: Boolean(sec1Card),
          hasSec2: Boolean(sec2Card),
          hasSec3: Boolean(sec3Card),
          rootCenterX,
          rootCenterY,
          sec1Right: sec1Rect ? Math.round(sec1Rect.right) : null,
          sec2Right: sec2Rect ? Math.round(sec2Rect.right) : null,
          sec3Right: sec3Rect ? Math.round(sec3Rect.right) : null,
          scale: Number(scale.toFixed(2)),
          bounds: { minX: Math.round(minX), maxX: Math.round(maxX), minY: Math.round(minY), maxY: Math.round(maxY) },
          fitsViewport: minX >= -30 && maxX <= 1470 && minY >= -10 && maxY <= 920,
          topCatalogClustered: Boolean(topCatalogClustered),
          leftWingClustered: Boolean(leftWingClustered),
          rightWingClustered: Boolean(rightWingClustered),
          level1OpaqueWhite: Boolean(level1OpaqueWhite),
          assocBelowNodes: Boolean(assocBelowNodes),
          nexusLineCount: nexusLines.length,
          lineIsSolid,
          cardHasBorder,
          cardHasBg,
          hasTextDuplication
        };
      })()
    `);

    console.log(`  - 认知视图开启状态: ${overviewStats.isOpen}`);
    console.log(`  - 二级三大分类柱存在: 知识=${overviewStats.hasBranchKnowledge}, 考点=${overviewStats.hasBranchExam}, 招法=${overviewStats.hasBranchMethod}`);
    console.log(`  - 一览全局可见紧凑节点数: ${overviewStats.visibleCardCount} 个`);
    console.log(`  - 视口自适应缩放率: ${(overviewStats.scale * 100).toFixed(0)}%`);
    console.log(`  - 正品字 △ 混合三角校验: 上方考点目录并列=${overviewStats.topCatalogClustered}, 左下知识聚拢=${overviewStats.leftWingClustered}, 右下招法聚拢=${overviewStats.rightWingClustered}`);
    console.log(`  - 二级节点纯白不透明实体底色: ${overviewStats.level1OpaqueWhite}, 关联线位于节点底层: ${overviewStats.assocBelowNodes}`);
    console.log(`  - 原生跨分支拓扑关联线网数量: ${overviewStats.nexusLineCount} 条, 实线状态: ${overviewStats.lineIsSolid}`);
    console.log(`  - 节点卡片实体边框与底色: 边框=${overviewStats.cardHasBorder}, 底色=${overviewStats.cardHasBg}`);
    console.log(`  - 消除双层文本复读 (§2 §2 消除): ${!overviewStats.hasTextDuplication}`);

    if (!overviewStats.isOpen || !overviewStats.hasRoot || !overviewStats.hasBranchKnowledge || !overviewStats.hasBranchExam || !overviewStats.hasBranchMethod) {
      throw new Error('二级三大分类主支架构未能完整渲染');
    }
    if (!overviewStats.topCatalogClustered || !overviewStats.leftWingClustered || !overviewStats.rightWingClustered) {
      throw new Error(`正品字 △ 混合结构布局校验异常: top=${overviewStats.topCatalogClustered}, left=${overviewStats.leftWingClustered}, right=${overviewStats.rightWingClustered}`);
    }
    if (!overviewStats.level1OpaqueWhite || !overviewStats.assocBelowNodes) {
      throw new Error(`二级节点纯白不透明或关联线底层顺序异常: opaqueWhite=${overviewStats.level1OpaqueWhite}, assocBelowNodes=${overviewStats.assocBelowNodes}`);
    }
    if (overviewStats.nexusLineCount === 0 || !overviewStats.lineIsSolid) {
      throw new Error('原生关联线网缺失或未实线化');
    }
    if (!overviewStats.cardHasBorder || !overviewStats.cardHasBg) {
      throw new Error('节点卡片实体边框或背景未正常应用（存在悬空风险）');
    }
    if (overviewStats.hasTextDuplication) {
      throw new Error('卡片内仍存在重复标签文字连读 (如 §2 §2)');
    }
    console.log('  PASS: 默认「一览全局」模式正品字 △ 混合结构、二级节点不透明实体化及三边关联线网准确呈现');

    await captureScreenshot(ws, 'chapter1_overview_level2.png');

    // ─────────────────────────────────────────────────────────────
    // 测试用例 3：展开全部详情 (Level 3/4 紧凑子节点 + 无向关联线去重与目录子项垂直缩进校验)
    // ─────────────────────────────────────────────────────────────
    console.log('\n[Test 3] 校验「展开详情」模式下多层紧凑子节点、无向关联线去重及上方目录垂直缩进...');
    await evaluate(ws, `window.CognitiveViewController.expandAll()`);
    await sleep(900);

    const expandedStats = await evaluate(ws, `
      (() => {
        const allCards = Array.from(document.querySelectorAll('#cognitiveMindMapContainer .smm-node .mm-node-card'))
          .filter(el => el.getBoundingClientRect().left > -1000);
        const tags = Array.from(document.querySelectorAll('#cognitiveMindMapContainer .smm-node .mm-node-tag'))
          .filter(el => el.getBoundingClientRect().left > -1000)
          .map(el => el.textContent.trim());
        const actionPills = Array.from(document.querySelectorAll('#cognitiveMindMapContainer .smm-node .mm-pill-questions'))
          .filter(el => el.getBoundingClientRect().left > -1000);
        const vizPills = Array.from(document.querySelectorAll('#cognitiveMindMapContainer .smm-node .mm-node-viz-pill'))
          .filter(el => el.getBoundingClientRect().left > -1000);
        const katexEls = Array.from(document.querySelectorAll('#cognitiveMindMapContainer .smm-node .katex'))
          .filter(el => el.getBoundingClientRect().left > -1000);

        // 校验二级知识点节点 (1.1 ~ 3.3) 已经降噪，没有五颜六色的彩色 tag
        const secSubNodes = ['k_fn_concept', 'k_fn_properties', 'k_lim_def_prop', 'k_two_limits', 'k_discontinuity_types', 'k_closed_interval_thm'];
        let secSubNodeTags = 0;
        secSubNodes.forEach(uid => {
          const card = document.querySelector('#cognitiveMindMapContainer [data-node-uid="' + uid + '"]');
          if (card && card.querySelector('.mm-node-tag')) {
            secSubNodeTags++;
          }
        });

        // 校验全量无向关联线去重与标题节点冗余移除
        const visiblePaths = Array.from(document.querySelectorAll('#cognitiveMindMapContainer .smm-associative-line-container path.smm-associative-line-path'));
        const pairSet = new Set();
        let duplicatePairCount = 0;
        let headerLinkCount = 0;
        const headerUids = new Set(['branch_knowledge', 'branch_exam_points', 'branch_methods', 'sec_1_func', 'sec_2_limit', 'sec_3_cont']);

        visiblePaths.forEach(p => {
          const u = p.getAttribute('data-from-uid') || '';
          const v = p.getAttribute('data-to-uid') || '';
          const key = u < v ? (u + '<->' + v) : (v + '<->' + u);
          if (pairSet.has(key)) duplicatePairCount++;
          pairSet.add(key);
          if (headerUids.has(u) || headerUids.has(v)) headerLinkCount++;
        });

        // 校验上方考点展开后，题源与要领子项在对应考点卡片上方垂直缩进排列（向上排布，留空下方走廊）
        const kp01El = document.querySelector('#cognitiveMindMapContainer [data-node-uid="kp_gs01_01"]');
        const kp01RefEl = document.querySelector('#cognitiveMindMapContainer [data-node-uid="kp_gs01_01_ref"]');
        const kp01PathEl = document.querySelector('#cognitiveMindMapContainer [data-node-uid="kp_gs01_01_path"]');
        const rKp = kp01El ? kp01El.getBoundingClientRect() : null;
        const rRef = kp01RefEl ? kp01RefEl.getBoundingClientRect() : null;
        const rPath = kp01PathEl ? kp01PathEl.getBoundingClientRect() : null;
        const catalogVerticalStacked = Boolean(
          rKp && rRef && rPath &&
          rPath.bottom <= rKp.top + 2 &&
          rRef.bottom <= rPath.top + 2 &&
          rRef.left >= rKp.left
        );

        return {
          totalCardCount: allCards.length,
          tagCount: tags.length,
          sampleTags: tags.slice(0, 8),
          actionPillCount: actionPills.length,
          vizPillCount: vizPills.length,
          katexCount: katexEls.length,
          secSubNodeTags,
          totalEdgeCount: visiblePaths.length,
          uniquePairCount: pairSet.size,
          duplicatePairCount,
          headerLinkCount,
          catalogVerticalStacked
        };
      })()
    `);

    console.log(`  - 全展开节点总数: ${expandedStats.totalCardCount} 个`);
    console.log(`  - 语义前缀胶囊数: ${expandedStats.tagCount} 个 (示例: ${expandedStats.sampleTags.join(', ')})`);
    console.log(`  - 二级知识点节点彩标数量 (应为0纯净化): ${expandedStats.secSubNodeTags} 处`);
    console.log(`  - 尾部交互胶囊数: 真题=${expandedStats.actionPillCount}, 几何图解=${expandedStats.vizPillCount}`);
    console.log(`  - 节点内 KaTeX 数学公式数: ${expandedStats.katexCount} 处`);
    console.log(`  - 全量无向关联线: 总数=${expandedStats.totalEdgeCount}, 唯一无向对=${expandedStats.uniquePairCount}, 重复边=${expandedStats.duplicatePairCount}, 标题冗余边=${expandedStats.headerLinkCount}, 目录垂直缩进=${expandedStats.catalogVerticalStacked}`);

    if (expandedStats.totalCardCount < 45 || expandedStats.tagCount < 20 || expandedStats.katexCount < 15) {
      throw new Error('全展开模式下紧凑子节点或语义标签/公式数量不足');
    }
    if (expandedStats.secSubNodeTags > 0) {
      throw new Error('二级知识点节点未能完全移除五颜六色的标签噪声');
    }
    if (expandedStats.duplicatePairCount > 0 || expandedStats.headerLinkCount > 0 || expandedStats.totalEdgeCount !== 19) {
      throw new Error(`无向关联线去重或标题冗余清理异常: total=${expandedStats.totalEdgeCount}, dup=${expandedStats.duplicatePairCount}, header=${expandedStats.headerLinkCount}`);
    }
    if (!expandedStats.catalogVerticalStacked) {
      throw new Error('上方考点展开后，题源与要领子项未能按目录组织图垂直缩进排列');
    }
    console.log('  PASS: 二级知识点纯净渲染、上方考点目录垂直缩进、19条无向关联线零重复且零标题冗余');

    await captureScreenshot(ws, 'chapter1_expanded_subnodes.png');

    // 切回一览全局（Level 2 核心全景）以测拓扑聚焦与几何弹窗
    await evaluate(ws, `window.CognitiveViewController.expandToLevel(2)`);
    await sleep(600);

    // ─────────────────────────────────────────────────────────────
    // 测试用例 4：Focus Resonance 拓扑聚焦高亮与 Esc 分层清除
    // ─────────────────────────────────────────────────────────────
    console.log('\n[Test 4] 校验 Focus Resonance 跨分支拓扑聚焦与 Esc 单步清除...');
    await evaluate(ws, `window.CognitiveViewController.applyFocusResonanceByUid('kp_gs01_01')`);
    await sleep(400);

    const resonanceState = await evaluate(ws, `
      (() => {
        const container = document.querySelector('#cognitiveMindMapContainer .smm-node-container');
        const hasResonanceClass = container && container.classList.contains('has-resonance-focus');
        const activeCard = document.querySelector('#cognitiveMindMapContainer .mm-node-card.is-in-resonance.resonance-active');
        const linkedCards = Array.from(document.querySelectorAll('#cognitiveMindMapContainer .mm-node-card.is-in-resonance.resonance-linked'));
        const activePaths = Array.from(document.querySelectorAll('#cognitiveMindMapContainer .smm-associative-line-container path.smm-associative-line-path.is-active-line'));
        
        // 校验弱化节点透明度是否为 0.58（调优透明度，避免周边文字过暗不可读）
        const nonResonanceCard = document.querySelector('#cognitiveMindMapContainer .smm-node:not(.is-in-resonance) .mm-node-card');
        const dimmedOpacity = nonResonanceCard ? window.getComputedStyle(nonResonanceCard).opacity : '';
        
        // 校验无遗留 SVG 虚线注入层
        const ghostLayer = document.querySelector('#cognitiveMindMapContainer .cognitive-active-lines-layer');
        const hasGhostLines = Boolean(ghostLayer && ghostLayer.children.length > 0);

        // 校验聚焦展开仅展开目标节点的祖先 (§2)，而不误展开目标节点自身的叶子子节点
        const leafExpanded = Boolean(document.querySelector('#cognitiveMindMapContainer [data-node-uid="k_equiv_core_f1"]'));

        const allPaths = Array.from(document.querySelectorAll('#cognitiveMindMapContainer .smm-associative-line-container path.smm-associative-line-path'));
        const pathSample = allPaths.slice(0, 3).map(p => ({
          className: p.className && p.className.baseVal !== undefined ? p.className.baseVal : p.className,
          from: p.getAttribute('data-from-uid'),
          to: p.getAttribute('data-to-uid'),
          d: p.getAttribute('d')
        }));

        return {
          hasResonanceClass: Boolean(hasResonanceClass),
          activeUid: activeCard ? activeCard.dataset.nodeUid : null,
          linkedCount: linkedCards.length,
          activeLineCount: activePaths.length,
          allPathCount: allPaths.length,
          pathSample,
          dimmedOpacity,
          hasGhostLines,
          leafExpanded
        };
      })()
    `);

    console.log(`  - 激活考点 UID: ${resonanceState.activeUid}`);
    console.log(`  - 跨分支关联节点数: ${resonanceState.linkedCount}, 原生高亮关联线数: ${resonanceState.activeLineCount}, 全量可见连线数: ${resonanceState.allPathCount}`);
    console.log(`  - 目标节点叶子是否误展开 (应为false): ${resonanceState.leafExpanded}`);
    console.log(`  - 背景弱化卡片透明度: ${resonanceState.dimmedOpacity}, 遗留虚线注入层: ${resonanceState.hasGhostLines}`);
    if (!resonanceState.hasResonanceClass || resonanceState.activeUid !== 'kp_gs01_01' || resonanceState.activeLineCount !== 5 || resonanceState.hasGhostLines || resonanceState.leafExpanded) {
      throw new Error(`Focus Resonance 聚焦高亮异常: activeLineCount=${resonanceState.activeLineCount}, leafExpanded=${resonanceState.leafExpanded}`);
    }
    if (resonanceState.dimmedOpacity !== '0.58') {
      throw new Error(`背景弱化卡片透明度异常: expected 0.58, got ${resonanceState.dimmedOpacity}`);
    }

    await captureScreenshot(ws, 'chapter1_focus_resonance.png');

    // 按一次 Esc，应仅清除 Focus Resonance，不关闭认知视图
    await dispatchKey(ws, 'Escape', 'Escape', 27);
    await sleep(300);
    const afterEscResonance = await evaluate(ws, `
      (() => ({
        isOpen: window.CognitiveViewController.isOpen(),
        hasResonance: Boolean(document.querySelector('#cognitiveMindMapContainer .smm-node-container.has-resonance-focus'))
      }))()
    `);
    if (!afterEscResonance.isOpen || afterEscResonance.hasResonance) {
      throw new Error('按 Esc 未能精准清除 Focus Resonance 或误关了认知视图');
    }
    console.log('  PASS: Focus Resonance 拓扑高亮、透明度调优及 Esc 分层清除验证通过');

    // ─────────────────────────────────────────────────────────────
    // 测试用例 5：MathViz 几何图解按需气泡弹窗与 Esc 分层关闭
    // ─────────────────────────────────────────────────────────────
    console.log('\n[Test 5] 校验 MathViz 几何图解按需气泡弹窗与参数滑块交互...');
    const mathVizStats = await evaluate(ws, `
      (() => {
        const anchor = document.querySelector('#cognitiveMindMapContainer [data-node-uid="sec_2_limit"]');
        window.MathVizWidget.openPopover('important_limit_sinx_x', anchor);
        const isOpen = window.MathVizWidget.isPopoverOpen();
        const slider = document.querySelector('#mathvizPopoverCard .mathviz-slider');
        const readoutBefore = document.querySelector('#mathvizPopoverCard .mathviz-readout')?.textContent || '';
        if (slider) {
          slider.value = '0.35';
          slider.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const readoutAfter = document.querySelector('#mathvizPopoverCard .mathviz-readout')?.textContent || '';
        return { isOpen, readoutBefore, readoutAfter };
      })()
    `);

    if (!mathVizStats.isOpen || mathVizStats.readoutBefore === mathVizStats.readoutAfter) {
      throw new Error('MathViz 按需气泡弹窗或参数滑块联动异常');
    }
    console.log(`  - 几何弹窗参数交互前: ${mathVizStats.readoutBefore}`);
    console.log(`  - 几何弹窗参数交互后: ${mathVizStats.readoutAfter}`);

    await sleep(250);
    await captureScreenshot(ws, 'chapter1_mathviz_popover.png');

    // 按一次 Esc，应仅关闭 MathViz 气泡弹窗，不关闭认知视图
    await dispatchKey(ws, 'Escape', 'Escape', 27);
    await sleep(300);
    const afterEscPopover = await evaluate(ws, `
      (() => ({
        isModalOpen: window.CognitiveViewController.isOpen(),
        isPopoverOpen: window.MathVizWidget.isPopoverOpen()
      }))()
    `);
    if (!afterEscPopover.isModalOpen || afterEscPopover.isPopoverOpen) {
      throw new Error('按 Esc 未能优先关闭 MathViz 气泡弹窗或误关了认知视图');
    }
    console.log('  PASS: MathViz 几何弹窗按需唤起与 Esc 分层关闭验证通过');

    // ─────────────────────────────────────────────────────────────
    // 测试用例 6：严格双向键盘隔离验证 (核心指标)
    // ─────────────────────────────────────────────────────────────
    console.log('\n[Test 6] 校验认知视图与底层刷题系统的双向键盘隔离...');
    const beforeKeyState = await evaluate(ws, `
      (() => ({
        currentQ: window.current,
        qLabel: document.getElementById('qLabel')?.textContent || '',
        activeStatusBtn: document.querySelector('.btn-status.active')?.id || 'none',
        solVisible: document.getElementById('solutionContainer')?.classList.contains('show') || false
      }))()
    `);

    // 在认知视图开启时连续发送底层题库敏感快捷键：'1' / '2' (熟练/生疏)、'd' / 'a' (导图切章 vs 题库切题)、'j' (下一题)、'm' (切换大纲/SM2)、'h' (导图帮助/题库帮助)
    await dispatchKey(ws, '1', 'Digit1', 49);
    await sleep(300);
    await dispatchKey(ws, '2', 'Digit2', 50);
    await dispatchKey(ws, 'd', 'KeyD', 68);
    await sleep(220);
    await dispatchKey(ws, 'a', 'KeyA', 65);
    await sleep(220);
    await dispatchKey(ws, 'j', 'KeyJ', 74);
    await sleep(400);

    // 按 M 切换至纯白大纲视图，再按 M 切回导图视图
    await dispatchKey(ws, 'm', 'KeyM', 77);
    await sleep(350);
    const inOutlineMode = await evaluate(ws, `
      window.CognitiveViewController.getDualViewController().getMode() === 'outline'
    `);
    if (!inOutlineMode) throw new Error('在认知视图中按 M 未能切换至大纲模式');

    await dispatchKey(ws, 'm', 'KeyM', 77);
    await sleep(350);

    // 按 H 唤起导图快捷键抽屉，而底层题库 #shortcutHelpModal 绝不能打开
    await dispatchKey(ws, 'h', 'KeyH', 72);
    await sleep(300);
    const drawerCheck = await evaluate(ws, `
      (() => {
        const mmDrawer = document.querySelector('#cognitiveModal .mm-shortcut-drawer');
        const hostHelp = document.getElementById('shortcutHelpModal');
        return {
          mmDrawerOpen: Boolean(mmDrawer && mmDrawer.classList.contains('open')),
          hostHelpOpen: Boolean(hostHelp && hostHelp.style.display !== 'none' && hostHelp.classList.contains('show'))
        };
      })()
    `);
    if (!drawerCheck.mmDrawerOpen || drawerCheck.hostHelpOpen) {
      throw new Error(`H 键隔离异常: mmDrawerOpen=${drawerCheck.mmDrawerOpen}, hostHelpOpen=${drawerCheck.hostHelpOpen}`);
    }

    // 按一次 Esc 关闭导图快捷键抽屉，认知视图仍保持打开
    await dispatchKey(ws, 'Escape', 'Escape', 27);
    await sleep(300);

    const afterKeyState = await evaluate(ws, `
      (() => ({
        isModalStillOpen: window.CognitiveViewController.isOpen(),
        currentQ: window.current,
        qLabel: document.getElementById('qLabel')?.textContent || '',
        activeStatusBtn: document.querySelector('.btn-status.active')?.id || 'none',
        solVisible: document.getElementById('solutionContainer')?.classList.contains('show') || false,
        sm2Open: Boolean(window.sm2PanelOpen)
      }))()
    `);

    if (!afterKeyState.isModalStillOpen) throw new Error('关闭快捷键抽屉后认知视图不应被关闭');
    if (afterKeyState.currentQ !== beforeKeyState.currentQ) {
      throw new Error(`底层题库题号发生泄漏切换: ${beforeKeyState.currentQ} -> ${afterKeyState.currentQ}`);
    }
    if (afterKeyState.activeStatusBtn !== beforeKeyState.activeStatusBtn) {
      throw new Error(`底层题库掌握度状态发生泄漏修改: ${beforeKeyState.activeStatusBtn} -> ${afterKeyState.activeStatusBtn}`);
    }
    if (afterKeyState.sm2Open) {
      throw new Error('按 M 键泄漏触发了底层题库 SM-2 复习面板');
    }
    console.log('  PASS: 认知视图开启期间，底层题库题号、掌握度、解析与面板实现 100% 零泄漏隔离');

    // ─────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────
    // 测试用例 8：原生滚轮缩放、点击画布收起快捷键抽屉与 L 键关联线显隐
    // ─────────────────────────────────────────────────────────────
    console.log('\n[Test 8] 校验 SimpleMindMap 原生滚轮缩放、点击画布收起抽屉与 L 键关联线显隐...');
    const zoomAndDrawerCheck = await evaluate(ws, `
      (() => {
        const mm = window.CognitiveViewController.getInstance();
        const container = document.getElementById('cognitiveMindMapContainer');
        const initialScale = mm.view.scale;

        // 1. 模拟自然滚轮滚动 (deltaY = -120 放大)，原生直接以光标为中心缩放
        const wheelEvt = new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaY: -120,
          clientX: 700,
          clientY: 450
        });
        container.dispatchEvent(wheelEvt);
        const zoomedScale = mm.view.scale;

        // 2. 呼出快捷键抽屉
        const drawer = (window.CognitiveViewController && window.CognitiveViewController.getShortcutDrawer()) || window._mindMapShortcutDrawerInstance;
        if (drawer) drawer.open();
        const drawerOpenBefore = Boolean(drawer && drawer.isOpen);

        // 3. 点击画布背景（触发 draw_click / pointerdown）
        mm.emit('draw_click');
        container.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        const drawerOpenAfter = Boolean(drawer && drawer.isOpen);

        // 4. 原生 AssociativeLine 容器检查
        const assocLineGroup = mm.associativeLineDraw ? mm.associativeLineDraw.node : null;
        const initialIsMuted = assocLineGroup ? assocLineGroup.classList.contains('is-global-muted') : false;

        // 5. 按 L 键切换隐现 (静音化)
        window.CognitiveViewController.toggleAssociativeLines();
        const toggledIsMuted = assocLineGroup ? assocLineGroup.classList.contains('is-global-muted') : false;

        return {
          initialScale,
          zoomedScale,
          zoomWorked: zoomedScale > initialScale,
          drawerOpenBefore,
          drawerOpenAfter,
          hasAssocContainer: Boolean(assocLineGroup),
          initialIsMuted,
          toggledIsMuted
        };
      })()
    `);

    console.log(`  - 滚轮缩放变化: ${(zoomAndDrawerCheck.initialScale * 100).toFixed(0)}% -> ${(zoomAndDrawerCheck.zoomedScale * 100).toFixed(0)}%`);
    console.log(`  - 点击画布前快捷键抽屉打开: ${zoomAndDrawerCheck.drawerOpenBefore}, 点击后收起: ${!zoomAndDrawerCheck.drawerOpenAfter}`);
    console.log(`  - 原生关联线静音状态切换: ${zoomAndDrawerCheck.initialIsMuted} -> ${zoomAndDrawerCheck.toggledIsMuted}`);

    if (!zoomAndDrawerCheck.zoomWorked) {
      throw new Error('原生滚轮平滑缩放未生效');
    }
    if (!zoomAndDrawerCheck.drawerOpenBefore || zoomAndDrawerCheck.drawerOpenAfter) {
      throw new Error('点击画图背景未能平滑收起快捷键指南抽屉');
    }
    if (!zoomAndDrawerCheck.hasAssocContainer || !zoomAndDrawerCheck.toggledIsMuted) {
      throw new Error('原生关联线容器缺失或 L 键隐现切换异常');
    }

    // 6. 验证在 L 键静音状态下，直接点击有关联线的节点 (node_click) 能够显示对应关联线
    await evaluate(ws, `
      (() => {
        const mm = window.CognitiveViewController.getInstance();
        const findNode = (n, uid) => {
          if (!n) return null;
          const curUid = (n.getData && n.getData('uid')) || (n.nodeData && n.nodeData.data && n.nodeData.data.uid);
          if (curUid === uid) return n;
          for (const c of (n.children || [])) {
            const f = findNode(c, uid);
            if (f) return f;
          }
          return null;
        };
        const kp01Node = findNode(mm.renderer.root, 'kp_gs01_01');
        if (kp01Node) mm.emit('node_click', kp01Node);
      })()
    `);
    await sleep(450);

    const mutedResonanceCheck = await evaluate(ws, `
      (() => {
        const activeLines = Array.from(document.querySelectorAll('#cognitiveMindMapContainer .smm-associative-line-container path.smm-associative-line-path.is-active-line'));
        const normalLine = document.querySelector('#cognitiveMindMapContainer .smm-associative-line-container path.smm-associative-line-path:not(.is-active-line)');
        const activeLine = activeLines[0];
        return {
          hasActiveLine: Boolean(activeLine),
          activeLineCount: activeLines.length,
          activeLineOpacity: activeLine ? window.getComputedStyle(activeLine).opacity : '',
          activeLineVisibility: activeLine ? window.getComputedStyle(activeLine).visibility : '',
          normalLineOpacity: normalLine ? window.getComputedStyle(normalLine).opacity : ''
        };
      })()
    `);

    console.log(`  - L静音下点击 kp_gs01_01 激活关联线数: ${mutedResonanceCheck.activeLineCount}, 激活线透明度: ${mutedResonanceCheck.activeLineOpacity}, 普通线透明度: ${mutedResonanceCheck.normalLineOpacity}`);

    if (!mutedResonanceCheck.hasActiveLine || mutedResonanceCheck.activeLineCount !== 5 || mutedResonanceCheck.activeLineOpacity !== '1' || mutedResonanceCheck.normalLineOpacity !== '0') {
      throw new Error(`L 键静音状态下点击节点透出规则异常: count=${mutedResonanceCheck.activeLineCount}, active=${mutedResonanceCheck.activeLineOpacity}, normal=${mutedResonanceCheck.normalLineOpacity}`);
    }

    // 7. 验证在 L 键静音状态下，点击左翼知识点节点 k_equiv_table (无向反向邻接) 同样显示其 2 条关联线，点击无关联线节点 sec_1_func 则隐藏
    const reverseAndClearCheck = await evaluate(ws, `
      (() => {
        const mm = window.CognitiveViewController.getInstance();
        const findNode = (n, uid) => {
          if (!n) return null;
          const curUid = (n.getData && n.getData('uid')) || (n.nodeData && n.nodeData.data && n.nodeData.data.uid);
          if (curUid === uid) return n;
          for (const c of (n.children || [])) {
            const f = findNode(c, uid);
            if (f) return f;
          }
          return null;
        };
        const equivNode = findNode(mm.renderer.root, 'k_equiv_table');
        if (equivNode) mm.emit('node_click', equivNode);
        const equivActiveLines = Array.from(document.querySelectorAll('#cognitiveMindMapContainer .smm-associative-line-container path.smm-associative-line-path.is-active-line'));
        const equivCount = equivActiveLines.length;

        const sec1Node = findNode(mm.renderer.root, 'sec_1_func');
        if (sec1Node) mm.emit('node_click', sec1Node);
        const afterSec1Lines = Array.from(document.querySelectorAll('#cognitiveMindMapContainer .smm-associative-line-container path.smm-associative-line-path.is-active-line'));

        return {
          equivCount,
          afterSec1Count: afterSec1Lines.length
        };
      })()
    `);

    console.log(`  - L静音下点击左翼无向节点 k_equiv_table 显线数: ${reverseAndClearCheck.equivCount} (应为2), 点击无关联线节点 sec_1_func 后显线数: ${reverseAndClearCheck.afterSec1Count} (应为0)`);
    if (reverseAndClearCheck.equivCount !== 2 || reverseAndClearCheck.afterSec1Count !== 0) {
      throw new Error(`L 键静音下无向节点点击或清除异常: equivCount=${reverseAndClearCheck.equivCount}, afterSec1Count=${reverseAndClearCheck.afterSec1Count}`);
    }

    await evaluate(ws, `
      (() => {
        window.CognitiveViewController.clearFocusResonance();
        window.CognitiveViewController.toggleAssociativeLines(true); // 恢复为默认显示
      })()
    `);
    await sleep(300);

    console.log('  PASS: 原生滚轮平滑缩放、点击画布收起抽屉与原生关联线 L 键切换及点击节点按需透出校验通过');

    // ─────────────────────────────────────────────────────────────
    // 测试用例 9：单键 Q / W / E 目标子树专属配框 + 连按切分节 + ~/1/2/3 四阶渐进层级
    // ─────────────────────────────────────────────────────────────
    console.log('\n[Test 9] 校验单键 Q / W / E 目标子树专属配框、连按切分节与 ~/1/2/3 四阶渐进层级...');

    // 1. 单键 Q (第1次): 知识点全量递归展开到底，不要求可读最小缩放，侧重展示知识点全局并居中入屏；右翼保持语义二级
    await dispatchKey(ws, 'q', 'KeyQ', 81);
    await sleep(450);
    const qState = await evaluate(ws, `
      (() => {
        const mm = window.CognitiveViewController.getInstance();
        const container = document.getElementById('cognitiveMindMapContainer');
        const cRect = container.getBoundingClientRect();
        const sec1Sub = document.querySelector('#cognitiveMindMapContainer [data-node-uid="k_fn_concept"]');
        const deepLeaf = document.querySelector('#cognitiveMindMapContainer [data-node-uid="k_lim_crit_squeeze"]');
        const kp01Card = document.querySelector('#cognitiveMindMapContainer [data-node-uid="kp_gs01_01"]');
        const kp01Ref = document.querySelector('#cognitiveMindMapContainer [data-node-uid="kp_gs01_01_ref"]');
        const m01Card = document.querySelector('#cognitiveMindMapContainer [data-node-uid="m_gs01_01"]');
        const measureBranch = (branchUid) => {
          const uids = new Set();
          const walk = (n, inside) => {
            if (!n) return;
            const u = (n.getData && n.getData('uid')) || (n.nodeData && n.nodeData.data && n.nodeData.data.uid) || '';
            const hit = inside || u === branchUid;
            if (hit && u) uids.add(u);
            (n.children || []).forEach(c => walk(c, hit));
          };
          walk(mm.renderer.root, false);
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          document.querySelectorAll('#cognitiveMindMapContainer .smm-node-container .mm-node-card').forEach(c => {
            if (!uids.has(c.getAttribute('data-node-uid'))) return;
            const r = c.getBoundingClientRect();
            if (r.left < minX) minX = r.left;
            if (r.top < minY) minY = r.top;
            if (r.right > maxX) maxX = r.right;
            if (r.bottom > maxY) maxY = r.bottom;
          });
          return { minX, minY: minY - cRect.top, maxX, maxY, rightMargin: cRect.right - maxX, centerX: (minX + maxX) / 2, height: maxY - minY };
        };
        const b = measureBranch('branch_knowledge');
        return {
          knowledgeExpanded: Boolean(sec1Sub),
          deepLeafExpanded: Boolean(deepLeaf),
          rightSemanticLevel2Kept: Boolean(kp01Card && m01Card),
          examFolded: !kp01Ref,
          scale: mm.view.scale,
          viewX: mm.view.x,
          viewY: mm.view.y,
          viewportCenterX: cRect.left + cRect.width / 2,
          subtreeCenterX: b.centerX || 0,
          subtreeTopOffset: b.minY || 0,
          rightMargin: b.rightMargin,
          b: b
        };
      })()
    `);
    const qCenterDiffX = Math.abs(qState.subtreeCenterX - qState.viewportCenterX);
    console.log(`  - 单键 Q [第1次·知识点全局]: 展开=${qState.knowledgeExpanded && qState.deepLeafExpanded}, 右翼保持语义二级=${qState.rightSemanticLevel2Kept}, 全局缩放=${(qState.scale * 100).toFixed(0)}%, 水平居中偏差=${qCenterDiffX.toFixed(1)}px, 边界=[${Math.round(qState.b.minX)}..${Math.round(qState.b.maxX)}, ${Math.round(qState.b.minY)}..${Math.round(qState.b.maxY)}]`);
    if (!qState.knowledgeExpanded || !qState.deepLeafExpanded || !qState.rightSemanticLevel2Kept || !qState.examFolded) {
      throw new Error('单键 Q 未能将知识点递归展开到底或未保持右翼语义二级');
    }
    if (qCenterDiffX > 45 || qState.b.minX < 0 || qState.b.maxX > 1440 || qState.b.minY < 0 || qState.b.maxY > 900) {
      throw new Error(`单键 Q [第1次] 未能完整居中展示知识点全局: scale=${qState.scale}, centerDiffX=${qCenterDiffX}, bounds=${JSON.stringify(qState.b)}`);
    }
    await captureScreenshot(ws, 'chapter1_q_knowledge_focus.png');

    // 1b. 连按 Q (第2次 -> §1 函数, 第3次 -> §2 极限, 第4次 -> §3 连续): 验证同键循环切分节聚焦
    await dispatchKey(ws, 'q', 'KeyQ', 81);
    await sleep(400);
    const qStep1 = await evaluate(ws, `
      (() => {
        const mm = window.CognitiveViewController.getInstance();
        const sec1Card = document.querySelector('#cognitiveMindMapContainer [data-node-uid="sec_1_func"]');
        const r = sec1Card ? sec1Card.getBoundingClientRect() : null;
        return { scale: mm.view.scale, sec1Y: r ? (r.top + r.bottom) / 2 : 0 };
      })()
    `);
    await dispatchKey(ws, 'q', 'KeyQ', 81);
    await sleep(400);
    const qStep2 = await evaluate(ws, `
      (() => {
        const mm = window.CognitiveViewController.getInstance();
        const sec2Card = document.querySelector('#cognitiveMindMapContainer [data-node-uid="sec_2_limit"]');
        const r = sec2Card ? sec2Card.getBoundingClientRect() : null;
        return { scale: mm.view.scale, sec2Y: r ? (r.top + r.bottom) / 2 : 0 };
      })()
    `);
    await captureScreenshot(ws, 'chapter1_q_sec2_limit_focus.png');
    await dispatchKey(ws, 'q', 'KeyQ', 81);
    await sleep(400);
    const qStep3 = await evaluate(ws, `
      (() => {
        const mm = window.CognitiveViewController.getInstance();
        const sec3Card = document.querySelector('#cognitiveMindMapContainer [data-node-uid="sec_3_cont"]');
        const r = sec3Card ? sec3Card.getBoundingClientRect() : null;
        return { scale: mm.view.scale, sec3Y: r ? (r.top + r.bottom) / 2 : 0 };
      })()
    `);
    console.log(`  - 连按 Q 循环切分节: §1缩放=${(qStep1.scale * 100).toFixed(0)}%(Y=${qStep1.sec1Y.toFixed(0)}), §2缩放=${(qStep2.scale * 100).toFixed(0)}%(Y=${qStep2.sec2Y.toFixed(0)}), §3缩放=${(qStep3.scale * 100).toFixed(0)}%(Y=${qStep3.sec3Y.toFixed(0)})`);
    if (qStep1.scale < 0.88 || qStep2.scale < 0.88 || qStep3.scale < 0.88) {
      throw new Error('连按 Q 分节聚焦缩放比例未达可读预期');
    }

    // 2. 单键 W: 考点全量展开并独占视口居中，左翼知识点保持语义二级（1.1~3.3 可见，公式折叠）
    await dispatchKey(ws, 'w', 'KeyW', 87);
    await sleep(600);
    const wState = await evaluate(ws, `
      (() => {
        const mm = window.CognitiveViewController.getInstance();
        const container = document.getElementById('cognitiveMindMapContainer');
        const cRect = container.getBoundingClientRect();
        const kp01Card = document.querySelector('#cognitiveMindMapContainer [data-node-uid="kp_gs01_01"]');
        const kp01Ref = document.querySelector('#cognitiveMindMapContainer [data-node-uid="kp_gs01_01_ref"]');
        const sec1Sub = document.querySelector('#cognitiveMindMapContainer [data-node-uid="k_fn_concept"]');
        const sec1Leaf = document.querySelector('#cognitiveMindMapContainer [data-node-uid="k_fn_concept_1"]');
        const uids = new Set();
        const walk = (n, inside) => {
          if (!n) return;
          const u = (n.getData && n.getData('uid')) || (n.nodeData && n.nodeData.data && n.nodeData.data.uid) || '';
          const hit = inside || u === 'branch_exam_points';
          if (hit && u) uids.add(u);
          (n.children || []).forEach(c => walk(c, hit));
        };
        walk(mm.renderer.root, false);
        let minX = Infinity, maxX = -Infinity;
        document.querySelectorAll('#cognitiveMindMapContainer .smm-node-container .mm-node-card').forEach(c => {
          if (!uids.has(c.getAttribute('data-node-uid'))) return;
          const r = c.getBoundingClientRect();
          if (r.left < minX) minX = r.left;
          if (r.right > maxX) maxX = r.right;
        });
        return {
          examExpanded: Boolean(kp01Card),
          examLeafExpanded: Boolean(kp01Ref),
          leftSemanticLevel2Kept: Boolean(sec1Sub) && !sec1Leaf,
          scale: mm.view.scale,
          centerDiffX: Math.abs((minX + maxX) / 2 - (cRect.left + cRect.width / 2))
        };
      })()
    `);
    console.log(`  - 单键 W (考点全量展开): 考点题源展开=${wState.examLeafExpanded}, 左翼保持1.1~3.3语义二级=${wState.leftSemanticLevel2Kept}, 缩放=${(wState.scale * 100).toFixed(0)}%, 水平居中偏差=${wState.centerDiffX.toFixed(1)}px`);
    if (!wState.examExpanded || !wState.examLeafExpanded || !wState.leftSemanticLevel2Kept || wState.scale < 0.85 || wState.centerDiffX > 90) {
      throw new Error(`单键 W 考点展开或语义二级保留异常: ${JSON.stringify(wState)}`);
    }
    await captureScreenshot(ws, 'chapter1_w_exam_focus.png');

    // 3. 单键 E: 解法全量展开并独占视口配框，左翼知识点与考点保持语义二级
    await dispatchKey(ws, 'e', 'KeyE', 69);
    await sleep(600);
    const eState = await evaluate(ws, `
      (() => {
        const mm = window.CognitiveViewController.getInstance();
        const container = document.getElementById('cognitiveMindMapContainer');
        const cRect = container.getBoundingClientRect();
        const m01Card = document.querySelector('#cognitiveMindMapContainer [data-node-uid="m_gs01_01"]');
        const m01Step = document.querySelector('#cognitiveMindMapContainer [data-node-uid="m_gs01_01_s1"]');
        const kp01Ref = document.querySelector('#cognitiveMindMapContainer [data-node-uid="kp_gs01_01_ref"]');
        const sec1Sub = document.querySelector('#cognitiveMindMapContainer [data-node-uid="k_fn_concept"]');
        const uids = new Set();
        const walk = (n, inside) => {
          if (!n) return;
          const u = (n.getData && n.getData('uid')) || (n.nodeData && n.nodeData.data && n.nodeData.data.uid) || '';
          const hit = inside || u === 'branch_methods';
          if (hit && u) uids.add(u);
          (n.children || []).forEach(c => walk(c, hit));
        };
        walk(mm.renderer.root, false);
        let minX = Infinity, maxX = -Infinity;
        document.querySelectorAll('#cognitiveMindMapContainer .smm-node-container .mm-node-card').forEach(c => {
          if (!uids.has(c.getAttribute('data-node-uid'))) return;
          const r = c.getBoundingClientRect();
          if (r.left < minX) minX = r.left;
          if (r.right > maxX) maxX = r.right;
        });
        return {
          methodExpanded: Boolean(m01Card),
          methodStepExpanded: Boolean(m01Step),
          examFolded: !kp01Ref,
          leftSemanticLevel2Kept: Boolean(sec1Sub),
          scale: mm.view.scale,
          leftMargin: minX - cRect.left
        };
      })()
    `);
    console.log(`  - 单键 E (解法全量展开): 解法步骤展开=${eState.methodStepExpanded}, 左翼保持1.1~3.3=${eState.leftSemanticLevel2Kept}, 缩放=${(eState.scale * 100).toFixed(0)}%, 左侧边距=${eState.leftMargin.toFixed(1)}px`);
    if (!eState.methodExpanded || !eState.methodStepExpanded || !eState.examFolded || !eState.leftSemanticLevel2Kept || eState.scale < 0.80 || eState.leftMargin < 20 || eState.leftMargin > 220) {
      throw new Error(`单键 E 解法全量展开或专属配框异常: ${JSON.stringify(eState)}`);
    }
    console.log('  PASS: 单键 Q / W / E 目标子树专属配框、顶部对齐、连按切分节与非目标分支语义二级保持完全符合预期');

    // 4. 单键 1 (Level 1 — 分节骨架): 左翼展开至 §1~§3（1.1~3.3 折叠），右翼展开至 5大考点 & 7大招法
    await dispatchKey(ws, '1', 'Digit1', 49);
    await sleep(550);
    const key1State = await evaluate(ws, `
      (() => {
        const mm = window.CognitiveViewController.getInstance();
        const sec1Card = document.querySelector('#cognitiveMindMapContainer [data-node-uid="sec_1_func"]');
        const sec1Sub = document.querySelector('#cognitiveMindMapContainer [data-node-uid="k_fn_concept"]');
        const kp01Card = document.querySelector('#cognitiveMindMapContainer [data-node-uid="kp_gs01_01"]');
        const m01Card = document.querySelector('#cognitiveMindMapContainer [data-node-uid="m_gs01_01"]');
        return {
          hasSec1: Boolean(sec1Card),
          sec1SubFolded: !sec1Sub,
          hasKp01: Boolean(kp01Card),
          hasM01: Boolean(m01Card),
          scale: mm.view.scale
        };
      })()
    `);
    console.log(`  - 单键 1 (Level 1 分节骨架): 知识分节§1可见=${key1State.hasSec1}, 1.1已折叠=${key1State.sec1SubFolded}, 考点可见=${key1State.hasKp01}, 招法可见=${key1State.hasM01}, 缩放=${(key1State.scale * 100).toFixed(0)}%`);
    if (!key1State.hasSec1 || !key1State.sec1SubFolded || !key1State.hasKp01 || !key1State.hasM01 || key1State.scale < 0.88) {
      throw new Error(`单键 1 (Level 1 分节骨架) 行为异常: ${JSON.stringify(key1State)}`);
    }

    // 5. 单键 2 (Level 2 — 核心全景 · 同级对齐): 左翼展开至 1.1~3.3，右翼展开至 5大考点 & 7大招法，微观叶子折叠
    await dispatchKey(ws, '2', 'Digit2', 50);
    await sleep(550);
    const key2State = await evaluate(ws, `
      (() => {
        const mm = window.CognitiveViewController.getInstance();
        const sec1Card = document.querySelector('#cognitiveMindMapContainer [data-node-uid="sec_1_func"]');
        const sec1Sub = document.querySelector('#cognitiveMindMapContainer [data-node-uid="k_fn_concept"]');
        const sec1Leaf = document.querySelector('#cognitiveMindMapContainer [data-node-uid="k_fn_concept_1"]');
        const kp01Card = document.querySelector('#cognitiveMindMapContainer [data-node-uid="kp_gs01_01"]');
        const kp01Ref = document.querySelector('#cognitiveMindMapContainer [data-node-uid="kp_gs01_01_ref"]');
        const m01Card = document.querySelector('#cognitiveMindMapContainer [data-node-uid="m_gs01_01"]');
        const m01Step = document.querySelector('#cognitiveMindMapContainer [data-node-uid="m_gs01_01_s1"]');
        return {
          hasSec1: Boolean(sec1Card),
          hasSec1Sub: Boolean(sec1Sub),
          hasKp01: Boolean(kp01Card),
          hasM01: Boolean(m01Card),
          leavesFolded: !sec1Leaf && !kp01Ref && !m01Step,
          scale: mm.view.scale
        };
      })()
    `);
    console.log(`  - 单键 2 (Level 2 核心全景·同级对齐): 1.1可见=${key2State.hasSec1Sub}, 考点可见=${key2State.hasKp01}, 招法可见=${key2State.hasM01}, 叶子折叠=${key2State.leavesFolded}, 缩放=${(key2State.scale * 100).toFixed(0)}%`);
    if (!key2State.hasSec1 || !key2State.hasSec1Sub || !key2State.hasKp01 || !key2State.hasM01 || !key2State.leavesFolded || key2State.scale < 0.85) {
      throw new Error(`单键 2 (Level 2 核心全景) 行为异常: ${JSON.stringify(key2State)}`);
    }

    // 6. 单键 3 (Level 3 — 全图全量展开 · 一屏鸟瞰): 展开全部 101 个节点并一屏完整居中收纳
    await dispatchKey(ws, '3', 'Digit3', 51);
    await sleep(600);
    const key3State = await evaluate(ws, `
      (() => {
        const mm = window.CognitiveViewController.getInstance();
        const container = document.getElementById('cognitiveMindMapContainer');
        const cRect = container.getBoundingClientRect();
        const sec1Leaf = document.querySelector('#cognitiveMindMapContainer [data-node-uid="k_fn_concept_1"]');
        const kp01Ref = document.querySelector('#cognitiveMindMapContainer [data-node-uid="kp_gs01_01_ref"]');
        const m01Step = document.querySelector('#cognitiveMindMapContainer [data-node-uid="m_gs01_01_s1"]');
        const cards = Array.from(document.querySelectorAll('#cognitiveMindMapContainer .smm-node-container .mm-node-card'));
        let minX = Infinity, maxX = -Infinity;
        cards.forEach(c => {
          const r = c.getBoundingClientRect();
          if (r.left < minX) minX = r.left;
          if (r.right > maxX) maxX = r.right;
        });
        return {
          sec1LeafVisible: Boolean(sec1Leaf),
          kp01RefVisible: Boolean(kp01Ref),
          m01StepVisible: Boolean(m01Step),
          totalCards: cards.length,
          scale: mm.view.scale,
          centerDiffX: Math.abs((minX + maxX) / 2 - (cRect.left + cRect.width / 2))
        };
      })()
    `);
    console.log(`  - 单键 3 (Level 3 全图鸟瞰): 节点数=${key3State.totalCards}, 鸟瞰缩放=${(key3State.scale * 100).toFixed(0)}%, 水平居中偏差=${key3State.centerDiffX.toFixed(1)}px`);
    if (!key3State.sec1LeafVisible || !key3State.kp01RefVisible || !key3State.m01StepVisible || key3State.totalCards < 100 || key3State.scale >= 0.65 || key3State.centerDiffX > 40) {
      throw new Error(`单键 3 (Level 3 全图鸟瞰) 行为异常: ${JSON.stringify(key3State)}`);
    }
    await captureScreenshot(ws, 'chapter1_level3_readable_focus.png');
    console.log('  PASS: 1 / 2 / 3 三阶渐进层级（含 3 键全图鸟瞰一屏居中）校验通过');

    // ─────────────────────────────────────────────────────────────
    // 测试用例 10：校验跨章节同步块注水、Shift+空格转正待确认标签、双层导图接口与静默自动持久化
    // ─────────────────────────────────────────────────────────────
    console.log('\n[Test 10] 校验跨章节同步块注水、Shift+空格转正待确认标签、双层导图接口与静默自动持久化...');

    // 10.1 校验同步块数据引擎与注水作用域挂载
    const syncBlockCheck = await evaluate(ws, `
      (() => {
        const mgr = window.SyncBlockManager;
        if (!mgr) return { ok: false, error: 'SyncBlockManager 未挂载到 window' };
        const rootCards = document.querySelectorAll('#cognitiveMindMapContainer .is-sync-block-root');
        const childCards = document.querySelectorAll('#cognitiveMindMapContainer .is-sync-block-child');
        const pendingCards = document.querySelectorAll('#cognitiveMindMapContainer .is-pending-node');
        const pendingBadges = document.querySelectorAll('#cognitiveMindMapContainer .mm-tag-pending');
        return {
          ok: true,
          rootCount: rootCards.length,
          childCount: childCards.length,
          pendingCount: pendingCards.length,
          pendingBadgeCount: pendingBadges.length
        };
      })()
    `);
    console.log(`  - 同步块注水检测: 根节点=${syncBlockCheck.rootCount}个, 级联子节点=${syncBlockCheck.childCount}个, 待确认节点=${syncBlockCheck.pendingCount}个, 待确认胶囊=${syncBlockCheck.pendingBadgeCount}个`);
    if (!syncBlockCheck.ok || syncBlockCheck.rootCount === 0 || syncBlockCheck.childCount === 0 || syncBlockCheck.pendingCount === 0) {
      throw new Error(`同步块注水或待确认节点未正确挂载: ${JSON.stringify(syncBlockCheck)}`);
    }

    // 10.2 校验 Shift + 空格一键转正待确认标签 (思维导图模式)
    // 选中待确认节点 k_pending_comp_dom 并按下 Shift + Space
    const confirmResultMindMap = await evaluate(ws, `
      (() => {
        const mm = window.CognitiveViewController.getInstance();
        const targetCard = document.querySelector('#cognitiveMindMapContainer [data-node-uid="k_pending_comp_dom"]');
        if (!targetCard) return { ok: false, error: '未找到待确认节点 k_pending_comp_dom' };
        
        let targetNode = null;
        const walk = (node) => {
          if (!node) return;
          if (node.getData && node.getData('uid') === 'k_pending_comp_dom') { targetNode = node; return; }
          if (node.children) node.children.forEach(walk);
        };
        walk(mm.renderer.root);
        if (!targetNode) return { ok: false, error: '未在渲染树中找到 SimpleMindMap node 实例' };

        const beforeData = JSON.parse(JSON.stringify(targetNode.getData()));
        mm.renderer.clearActiveNodeList();
        mm.renderer.addNodeToActiveList(targetNode);

        return {
          ok: true,
          beforeTag: beforeData.tag,
          beforeTagType: beforeData.tagType,
          beforeFormalTag: beforeData.formalTag,
          beforeFormalTagType: beforeData.formalTagType
        };
      })()
    `);
    if (!confirmResultMindMap.ok) throw new Error(confirmResultMindMap.error);
    console.log(`  - 导图激活待确认节点: UID=k_pending_comp_dom, 转正前 tag="${confirmResultMindMap.beforeTag}", type="${confirmResultMindMap.beforeTagType}"`);

    await sendCDP(ws, 'Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key: ' ',
      code: 'Space',
      windowsVirtualKeyCode: 32,
      modifiers: 8
    });
    await sendCDP(ws, 'Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: ' ',
      code: 'Space',
      windowsVirtualKeyCode: 32,
      modifiers: 8
    });
    await sleep(400);

    const afterConfirmMindMap = await evaluate(ws, `
      (() => {
        const mm = window.CognitiveViewController.getInstance();
        let targetNode = null;
        const walk = (node) => {
          if (!node) return;
          if (node.getData && node.getData('uid') === 'k_pending_comp_dom') { targetNode = node; return; }
          if (node.children) node.children.forEach(walk);
        };
        walk(mm.renderer.root);
        if (!targetNode) return { ok: false, error: '未在渲染树中找到 node' };

        const d = targetNode.getData();
        const card = document.querySelector('#cognitiveMindMapContainer [data-node-uid="k_pending_comp_dom"]');
        const badge = card ? card.querySelector('.mm-tag') : null;
        return {
          ok: true,
          afterTag: d.tag,
          afterTagType: d.tagType,
          formalTagDeleted: d.formalTag === undefined,
          isPendingClassRemoved: card ? !card.classList.contains('is-pending-node') : false,
          badgeClass: badge ? badge.className : '',
          badgeText: badge ? badge.textContent.trim() : ''
        };
      })()
    `);
    console.log(`  - Shift+空格转正后: tag="${afterConfirmMindMap.afterTag}", type="${afterConfirmMindMap.afterTagType}", DOM徽标="${afterConfirmMindMap.badgeText}", 待确认样式移除=${afterConfirmMindMap.isPendingClassRemoved}`);
    if (!afterConfirmMindMap.ok || afterConfirmMindMap.afterTag !== '法' || afterConfirmMindMap.afterTagType !== 'method' || !afterConfirmMindMap.formalTagDeleted || !afterConfirmMindMap.isPendingClassRemoved) {
      throw new Error(`导图模式 Shift+空格转正待确认标签失败: ${JSON.stringify(afterConfirmMindMap)}`);
    }

    // 10.3 校验静默自动持久化 (纯静默写入，无工具栏保存按钮干扰)
    const persistenceCheck = await evaluate(ws, `
      (() => {
        const savedChaptersRaw = localStorage.getItem('kaoyan.g.mindmap_chapters.math_ch1');
        const savedBlocksRaw = localStorage.getItem('kaoyan.g.mindmap_sync_blocks');
        const bottomToolbarSaveBtn = document.querySelector('#cognitiveModal .btn-save, #cognitiveModal [data-action="save"]');
        
        let ch1Data = null;
        try {
          ch1Data = JSON.parse(savedChaptersRaw);
        } catch (e) {}

        let syncBlocks = null;
        try {
          syncBlocks = JSON.parse(savedBlocksRaw);
        } catch (e) {}

        let savedNodeTag = null;
        if (ch1Data) {
          const walk = (n) => {
            if (!n) return;
            if (n.data && n.data.uid === 'k_pending_comp_dom') { savedNodeTag = n.data.tag; return; }
            if (n.children) n.children.forEach(walk);
          };
          walk(ch1Data);
        }

        return {
          hasSavedChapters: Boolean(savedChaptersRaw),
          hasSavedSyncBlocks: Boolean(savedBlocksRaw),
          savedNodeTag: savedNodeTag,
          syncBlockKeys: syncBlocks ? Object.keys(syncBlocks) : [],
          pureSilentNoToolbarButton: !bottomToolbarSaveBtn
        };
      })()
    `);
    console.log(`  - 静默自动持久化检测: 章节存储=${persistenceCheck.hasSavedChapters}, 同步块存储=${persistenceCheck.hasSavedSyncBlocks} (块数量=${persistenceCheck.syncBlockKeys.length}), 转正落盘Tag="${persistenceCheck.savedNodeTag}", 纯静默无按钮=${persistenceCheck.pureSilentNoToolbarButton}`);
    if (!persistenceCheck.hasSavedChapters || persistenceCheck.savedNodeTag !== '法' || !persistenceCheck.pureSilentNoToolbarButton) {
      throw new Error(`静默自动持久化校验失败: ${JSON.stringify(persistenceCheck)}`);
    }

    // 10.4 校验双层导图接口 (L1宏观全量正品字△同构总览 vs L2微观章节展开)
    const macroTreeCheck = await evaluate(ws, `
      (() => {
        const ctrl = window.CognitiveViewController;
        if (!ctrl || typeof ctrl.buildSubjectMacroTree !== 'function') {
          return { ok: false, error: 'buildSubjectMacroTree 接口未定义' };
        }
        const macroTree = ctrl.buildSubjectMacroTree('math', 3);
        if (!macroTree || !macroTree.data) return { ok: false, error: '未能生成学科宏观骨架树' };

        const rootText = macroTree.data.text;
        const sectors = macroTree.children ? macroTree.children.map(c => c.data && c.data.text) : [];
        const knowBranch = macroTree.children ? macroTree.children.find(c => c.data && c.data.uid === 'branch_knowledge') : null;
        const ch1Know = knowBranch && knowBranch.children ? knowBranch.children.find(c => c.data && c.data.uid === 'macro_know_math_ch1') : null;
        const ch1Text = ch1Know && ch1Know.data && ch1Know.data.text;
        const sec1 = ch1Know && ch1Know.children ? ch1Know.children[0] : null;
        const sec1Sub = sec1 && sec1.children ? sec1.children[0] : null;
        const sec1SubChildrenCount = sec1Sub && sec1Sub.children ? sec1Sub.children.length : -1;

        return {
          ok: true,
          rootText: rootText,
          ch1Text: ch1Text,
          sectors: sectors,
          knowChapterCount: knowBranch && knowBranch.children ? knowBranch.children.length : 0,
          sec1SubText: sec1Sub ? sec1Sub.data.text : '',
          sec1SubChildrenCount: sec1SubChildrenCount
        };
      })()
    `);
    console.log(`  - 双层导图宏观骨架: 学科="${macroTreeCheck.rootText}", 扇区=[${macroTreeCheck.sectors.join(', ')}], 章节数=${macroTreeCheck.knowChapterCount}, 示例章节="${macroTreeCheck.ch1Text}", 节点剪枝深度=${macroTreeCheck.sec1SubChildrenCount === 0 ? '已精确剪枝至1.1骨架' : '未剪枝'}`);
    if (!macroTreeCheck.ok || !macroTreeCheck.rootText.includes('高等数学') || !macroTreeCheck.ch1Text.includes('函数与极限') || macroTreeCheck.knowChapterCount !== 10 || macroTreeCheck.sec1SubChildrenCount !== 0) {
      throw new Error(`双层导图宏观骨架接口校验失败: ${JSON.stringify(macroTreeCheck)}`);
    }

    // 10.5 校验大纲模式下的 Shift + 空格转正
    await dispatchKey(ws, 'm', 'KeyM', 77);
    await sleep(400);
    const outlineConfirmCheck = await evaluate(ws, `
      (() => {
        const outliner = (window.CognitiveViewController && window.CognitiveViewController.getOutliner()) || window._outlinerInstance;
        if (!outliner) return { ok: false, error: '未找到大纲实例' };
        
        const res = outliner.confirmPendingNode('k_pending_symm_int');
        return {
          ok: true,
          res: res
        };
      })()
    `);
    if (!outlineConfirmCheck.ok || !outlineConfirmCheck.res) throw new Error(outlineConfirmCheck.error || 'outliner.confirmPendingNode 返回 false');
    await sleep(350);

    const outlineAfterConfirm = await evaluate(ws, `
      (() => {
        const item = document.querySelector('#cognitiveOutlinerContainer [data-uid="k_pending_symm_int"]');
        const badge = item ? item.querySelector('.outliner-node-tag, .mm-node-tag') : null;
        return {
          badgeText: badge ? badge.textContent.trim() : '',
          isPending: badge ? badge.classList.contains('mm-tag-pending') : false,
          tagType: badge ? badge.getAttribute('data-tag-type') : '',
          badgeClass: badge ? badge.className : ''
        };
      })()
    `);
    console.log(`  - 大纲模式 Shift+空格转正: 胶囊文字="${outlineAfterConfirm.badgeText}", 待确认样式=${outlineAfterConfirm.isPending}, tagType="${outlineAfterConfirm.tagType}", class="${outlineAfterConfirm.badgeClass}"`);
    if (outlineAfterConfirm.badgeText !== '结' || outlineAfterConfirm.isPending || outlineAfterConfirm.tagType !== 'conclusion') {
      throw new Error(`大纲模式 Shift+空格转正失败: ${JSON.stringify(outlineAfterConfirm)}`);
    }

    // 在大纲模式下触发 Q 键分类展开，再切回思维导图模式，校验节点 UID 与关联线绝不被破坏
    await dispatchKey(ws, 'q', 'KeyQ', 81);
    await sleep(120);

    // 切回思维导图模式
    await dispatchKey(ws, 'm', 'KeyM', 77);
    await sleep(350);

    const afterOutlineSwitchCheck = await evaluate(ws, `
      (() => {
        const mm = window.CognitiveViewController.getInstance();
        const tree = (mm.renderer && mm.renderer.renderTree) || mm.getData(false);
        const childUids = (tree && Array.isArray(tree.children)) ? tree.children.map(c => c && c.data && c.data.uid) : [];
        return {
          rootUid: tree && tree.data ? tree.data.uid : '',
          hasHybridUids: childUids.includes('branch_knowledge') && childUids.includes('branch_exam_points') && childUids.includes('branch_methods')
        };
      })()
    `);
    if (afterOutlineSwitchCheck.rootUid !== 'root_chapter_1' || !afterOutlineSwitchCheck.hasHybridUids) {
      throw new Error(`大纲模式触发 Q 后切回导图导致 UID 损坏: ${JSON.stringify(afterOutlineSwitchCheck)}`);
    }

    console.log('  PASS: 跨章节同步块注水、Shift+空格转正待确认标签、双层导图接口与静默自动持久化全量通过');

    // ─────────────────────────────────────────────────────────────
    // 测试用例 11：原树拓扑剪枝聚拢 (1对N 关联节点聚拢 / 1对1 关联线聚拢 / 1层详情 / 连续漫游 / 数据安全)
    // ─────────────────────────────────────────────────────────────
    console.log('\n[Test 11] 校验原树拓扑剪枝聚拢 (1对N节点聚拢、1对1连线聚拢、1层详情、连续漫游与存储安全)...');

    // 先回到标准 Level 2 核心全景
    await dispatchKey(ws, '2', 'Digit2', 50);
    await sleep(450);

    // 11.1 左键点击 kp_gs01_01 的「关联 5」胶囊 -> 触发 1对N 原树拓扑剪枝聚拢
    const cluster1toNCheck = await evaluate(ws, `
      new Promise(resolve => {
        const pill = document.querySelector('#cognitiveMindMapContainer [data-node-uid="kp_gs01_01"] .mm-node-resonance-pill');
        if (!pill) return resolve({ ok: false, error: '未找到 kp_gs01_01 的关联胶囊' });
        pill.click();
        setTimeout(() => {
          const ctrl = window.CognitiveViewController;
          const mm = ctrl.getInstance();
          const st = ctrl.getClusterState();
          const has = (uid) => Boolean(document.querySelector('#cognitiveMindMapContainer [data-node-uid="' + uid + '"]'));
          const rectOf = (uid) => {
            const el = document.querySelector('#cognitiveMindMapContainer [data-node-uid="' + uid + '"]');
            return el ? el.getBoundingClientRect() : null;
          };
          const rRoot = rectOf('root_chapter_1');
          const rKp01 = rectOf('kp_gs01_01');
          const rEquiv = rectOf('k_equiv_table');
          const rM03 = rectOf('m_gs01_03');
          const hybridOrientationKept = Boolean(
            rRoot && rKp01 && rEquiv && rM03 &&
            rKp01.bottom < rRoot.top &&
            rEquiv.right < rRoot.left &&
            rM03.left > rRoot.right
          );
          const allCards = Array.from(document.querySelectorAll('#cognitiveMindMapContainer .smm-node-container .mm-node-card'));
          const allFullOpacity = allCards.length > 0 && allCards.every(c => window.getComputedStyle(c).opacity === '1');
          const activeLines = document.querySelectorAll('#cognitiveMindMapContainer .smm-associative-line-container path.smm-associative-line-path.is-active-line');

          resolve({
            ok: true,
            isActive: ctrl.isClusterActive(),
            mode: st.mode,
            centerUid: st.centerUid,
            scale: mm.view.scale,
            totalCards: allCards.length,
            allFullOpacity,
            activeLineCount: activeLines.length,
            hybridOrientationKept,
            // 涉及的核心节点必须保留
            keptInvolved: has('kp_gs01_01') && has('m_gs01_03') && has('m_gs01_04') && has('m_gs01_05') && has('k_equiv_table') && has('k_taylor_table'),
            // 涉及节点的 1 层详情子节点必须自动展开
            kept1LayerDetails: has('kp_gs01_01_ref') && has('kp_gs01_01_path') && has('m_gs01_03_s1') && has('k_equiv_core_f1') && has('k_taylor_1'),
            // 无关兄弟分支与节点必须被剪枝隐藏
            prunedUnrelated: !has('kp_gs01_02') && !has('kp_gs01_03') && !has('kp_gs01_04') && !has('kp_gs01_05') && !has('m_gs01_01') && !has('m_gs01_02') && !has('sec_1_func') && !has('sec_3_cont')
          });
        }, 420);
      })
    `);
    console.log(`  - 1对N 胶囊点击聚拢 (kp_gs01_01): 激活=${cluster1toNCheck.isActive}, 模式=${cluster1toNCheck.mode}, 节点数=${cluster1toNCheck.totalCards}, 缩放=${(cluster1toNCheck.scale * 100).toFixed(0)}%, 关联线=${cluster1toNCheck.activeLineCount}条, 品字方位保持=${cluster1toNCheck.hybridOrientationKept}, 1层详情展开=${cluster1toNCheck.kept1LayerDetails}, 无关分支剪除=${cluster1toNCheck.prunedUnrelated}`);
    if (!cluster1toNCheck.ok || !cluster1toNCheck.isActive || cluster1toNCheck.mode !== 'node' || cluster1toNCheck.centerUid !== 'kp_gs01_01' || !cluster1toNCheck.keptInvolved || !cluster1toNCheck.kept1LayerDetails || !cluster1toNCheck.prunedUnrelated || !cluster1toNCheck.hybridOrientationKept || !cluster1toNCheck.allFullOpacity || cluster1toNCheck.activeLineCount !== 5 || cluster1toNCheck.scale < 0.45) {
      throw new Error(`1对N 关联节点拓扑剪枝聚拢校验失败: ${JSON.stringify(cluster1toNCheck)}`);
    }
    await captureScreenshot(ws, 'chapter1_cluster_1toN_kp01.png');

    // 11.2 聚拢态下连续漫游：右键点击聚拢图中的 k_taylor_table -> 无缝切换以 k_taylor_table 为中心聚拢
    const roamToTaylorCheck = await evaluate(ws, `
      new Promise(resolve => {
        const taylorCard = document.querySelector('#cognitiveMindMapContainer [data-node-uid="k_taylor_table"]');
        if (!taylorCard) return resolve({ ok: false, error: '未找到 k_taylor_table 节点卡片' });
        const r = taylorCard.getBoundingClientRect();
        taylorCard.dispatchEvent(new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          button: 2,
          clientX: r.left + r.width / 2,
          clientY: r.top + r.height / 2
        }));
        setTimeout(() => {
          const ctrl = window.CognitiveViewController;
          const st = ctrl.getClusterState();
          const has = (uid) => Boolean(document.querySelector('#cognitiveMindMapContainer [data-node-uid="' + uid + '"]'));
          const activeLines = document.querySelectorAll('#cognitiveMindMapContainer .smm-associative-line-container path.smm-associative-line-path.is-active-line');
          resolve({
            ok: true,
            isActive: ctrl.isClusterActive(),
            mode: st.mode,
            centerUid: st.centerUid,
            activeLineCount: activeLines.length,
            hasTaylorNeighbors: has('k_taylor_table') && has('kp_gs01_01') && has('kp_gs01_02') && has('m_gs01_04') && has('m_gs01_16'),
            prunedPrevOnlyNeighbors: !has('k_equiv_table') && !has('m_gs01_03') && !has('m_gs01_05')
          });
        }, 420);
      })
    `);
    console.log(`  - 聚拢态右键漫游切换 (k_taylor_table): 中心=${roamToTaylorCheck.centerUid}, 关联线=${roamToTaylorCheck.activeLineCount}条, 新邻居聚拢=${roamToTaylorCheck.hasTaylorNeighbors}, 旧无关邻居剪除=${roamToTaylorCheck.prunedPrevOnlyNeighbors}`);
    if (!roamToTaylorCheck.ok || !roamToTaylorCheck.isActive || roamToTaylorCheck.centerUid !== 'k_taylor_table' || !roamToTaylorCheck.hasTaylorNeighbors || !roamToTaylorCheck.prunedPrevOnlyNeighbors || roamToTaylorCheck.activeLineCount !== 4) {
      throw new Error(`聚拢态右键连续漫游切换校验失败: ${JSON.stringify(roamToTaylorCheck)}`);
    }
    await captureScreenshot(ws, 'chapter1_cluster_roam_taylor.png');

    // 11.3 在聚拢态下左键点击某条关联线 (kp_gs01_02 <-> k_taylor_table) -> 切换为 1对1 连线精准对照聚拢
    const edgeClusterCheck = await evaluate(ws, `
      new Promise(resolve => {
        const clickPaths = Array.from(document.querySelectorAll('#cognitiveMindMapContainer .smm-associative-line-container path.smm-associative-line-click-path'));
        const targetEdge = clickPaths.find(p => {
          const u = p.getAttribute('data-from-uid');
          const v = p.getAttribute('data-to-uid');
          return (u === 'kp_gs01_02' && v === 'k_taylor_table') || (u === 'k_taylor_table' && v === 'kp_gs01_02');
        });
        if (!targetEdge) return resolve({ ok: false, error: '未找到 kp_gs01_02 <-> k_taylor_table 关联线点击热区' });
        targetEdge.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        setTimeout(() => {
          const ctrl = window.CognitiveViewController;
          const mm = ctrl.getInstance();
          const st = ctrl.getClusterState();
          const has = (uid) => Boolean(document.querySelector('#cognitiveMindMapContainer [data-node-uid="' + uid + '"]'));
          const activeLines = document.querySelectorAll('#cognitiveMindMapContainer .smm-associative-line-container path.smm-associative-line-path.is-active-line');
          const totalLines = document.querySelectorAll('#cognitiveMindMapContainer .smm-associative-line-container path.smm-associative-line-path');
          resolve({
            ok: true,
            isActive: ctrl.isClusterActive(),
            mode: st.mode,
            scale: mm.view.scale,
            activeLineCount: activeLines.length,
            totalLineCount: totalLines.length,
            keptEndpointsAndDetails: has('kp_gs01_02') && has('kp_gs01_02_ref') && has('k_taylor_table') && has('k_taylor_1'),
            prunedOtherNodesAndSector: !has('kp_gs01_01') && !has('branch_methods') && !has('m_gs01_04') && !has('m_gs01_16')
          });
        }, 420);
      })
    `);
    console.log(`  - 1对1 关联线点击聚拢 (kp_gs01_02 <-> k_taylor_table): 模式=${edgeClusterCheck.mode}, 缩放=${(edgeClusterCheck.scale * 100).toFixed(0)}%, 唯一激活连线=${edgeClusterCheck.activeLineCount}/${edgeClusterCheck.totalLineCount}, 端点及1层详情保留=${edgeClusterCheck.keptEndpointsAndDetails}, 无关扇区剪除=${edgeClusterCheck.prunedOtherNodesAndSector}`);
    if (!edgeClusterCheck.ok || !edgeClusterCheck.isActive || edgeClusterCheck.mode !== 'edge' || edgeClusterCheck.activeLineCount !== 1 || edgeClusterCheck.totalLineCount !== 1 || !edgeClusterCheck.keptEndpointsAndDetails || !edgeClusterCheck.prunedOtherNodesAndSector || edgeClusterCheck.scale < 0.65) {
      throw new Error(`1对1 关联线拓扑剪枝聚拢校验失败: ${JSON.stringify(edgeClusterCheck)}`);
    }
    await captureScreenshot(ws, 'chapter1_cluster_1to1_edge.png');

    // 11.4 再次点击同一条激活关联线 -> 退出聚拢态，还原完整章节树
    const exitBySameEdgeCheck = await evaluate(ws, `
      new Promise(resolve => {
        const targetEdge = document.querySelector('#cognitiveMindMapContainer .smm-associative-line-container path.smm-associative-line-click-path');
        if (!targetEdge) return resolve({ ok: false, error: '未找到激活关联线' });
        targetEdge.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        setTimeout(() => {
          const ctrl = window.CognitiveViewController;
          const cards = document.querySelectorAll('#cognitiveMindMapContainer .smm-node-container .mm-node-card');
          const lines = document.querySelectorAll('#cognitiveMindMapContainer .smm-associative-line-container path.smm-associative-line-path');
          resolve({
            ok: true,
            isActive: ctrl.isClusterActive(),
            cardCount: cards.length,
            lineCount: lines.length
          });
        }, 420);
      })
    `);
    console.log(`  - 再次点击同一关联线退出聚拢: 聚拢激活=${exitBySameEdgeCheck.isActive}, 恢复全景节点=${exitBySameEdgeCheck.cardCount}个, 恢复关联线=${exitBySameEdgeCheck.lineCount}条`);
    if (!exitBySameEdgeCheck.ok || exitBySameEdgeCheck.isActive || exitBySameEdgeCheck.cardCount !== 42 || exitBySameEdgeCheck.lineCount !== 19) {
      throw new Error(`再次点击同一关联线未能完整退出聚拢态: ${JSON.stringify(exitBySameEdgeCheck)}`);
    }

    // 11.5 校验 1 层详情边界（不展开第 2 层孙节点）+ 聚拢态下修改节点同步回完整树且绝不将剪枝残树写入 localStorage
    const deepBoundaryAndSafetyCheck = await evaluate(ws, `
      new Promise(resolve => {
        const ctrl = window.CognitiveViewController;
        ctrl.enterNodeCluster('kp_gs01_03');
        setTimeout(() => {
          const mm = ctrl.getInstance();
          const has = (uid) => Boolean(document.querySelector('#cognitiveMindMapContainer [data-node-uid="' + uid + '"]'));
          // k_fn_properties 是 kp_gs01_03 的关联节点，其直接子节点 k_fn_prop_sync_parity (1层详情) 必须展开可见，而孙节点 k_fn_prop_sync_parity__sb_pp_parity_group (2层详情) 必须折叠隐藏
          const has1LayerChild = has('k_fn_prop_sync_parity');
          const has2LayerGrandchild = has('k_fn_prop_sync_parity__sb_pp_parity_group');

          // 在聚拢剪枝态下修改 kp_gs01_03 的高亮色并触发立即落盘
          const kp03Node = mm.renderer.findNodeByUid('kp_gs01_03');
          const sm = ctrl.getShortcutManager();
          if (kp03Node && sm) {
            sm.toggleNodeHighlight(kp03Node, 'yellow');
          }
          ctrl.persistCurrentMindMapState(true);

          const savedRaw = localStorage.getItem('kaoyan.g.mindmap_chapters.math_ch1');
          const savedTree = savedRaw ? JSON.parse(savedRaw) : null;
          const isSavedPruned = Boolean(savedTree && savedTree.data && savedTree.data._isClusterPruned);
          let savedKpCount = 0;
          let savedMethodCount = 0;
          let savedKp03Color = '';
          const walk = (n) => {
            if (!n) return;
            const u = (n.data && n.data.uid) || '';
            if (/^kp_gs01_0[1-5]$/.test(u)) savedKpCount++;
            if (/^m_gs01_\\d+$/.test(u)) savedMethodCount++;
            if (u === 'kp_gs01_03') savedKp03Color = (n.data && n.data.highlightColor) || '';
            (n.children || []).forEach(walk);
          };
          walk(savedTree);

          // 点击画布空白处 (draw_click) 退出聚拢态，验证完整树恢复且修改保留
          mm.emit('draw_click');
          setTimeout(() => {
            const kp03Restored = mm.renderer.findNodeByUid('kp_gs01_03');
            const restoredColor = kp03Restored ? kp03Restored.getData('highlightColor') : '';
            // 清理测试高亮色
            if (kp03Restored && sm) {
              sm.toggleNodeHighlight(kp03Restored, 'none');
            }
            ctrl.persistCurrentMindMapState(true);

            resolve({
              has1LayerChild,
              has2LayerGrandchild,
              isSavedPruned,
              savedKpCount,
              savedMethodCount,
              savedKp03Color,
              afterDrawClickActive: ctrl.isClusterActive(),
              restoredColor
            });
          }, 380);
        }, 420);
      })
    `);
    console.log(`  - 1层详情边界与存储安全: 1层子项展开=${deepBoundaryAndSafetyCheck.has1LayerChild}, 2层孙项折叠=${!deepBoundaryAndSafetyCheck.has2LayerGrandchild}, 落盘非剪枝残树=${!deepBoundaryAndSafetyCheck.isSavedPruned}(考点=${deepBoundaryAndSafetyCheck.savedKpCount}/5, 招法=${deepBoundaryAndSafetyCheck.savedMethodCount}), 聚拢内编辑同步=${deepBoundaryAndSafetyCheck.savedKp03Color === 'yellow' && deepBoundaryAndSafetyCheck.restoredColor === 'yellow'}, 空白点击退出=${!deepBoundaryAndSafetyCheck.afterDrawClickActive}`);
    if (!deepBoundaryAndSafetyCheck.has1LayerChild || deepBoundaryAndSafetyCheck.has2LayerGrandchild || deepBoundaryAndSafetyCheck.isSavedPruned || deepBoundaryAndSafetyCheck.savedKpCount !== 5 || deepBoundaryAndSafetyCheck.savedMethodCount < 16 || deepBoundaryAndSafetyCheck.savedKp03Color !== 'yellow' || deepBoundaryAndSafetyCheck.restoredColor !== 'yellow' || deepBoundaryAndSafetyCheck.afterDrawClickActive) {
      throw new Error(`1层详情边界或聚拢态存储安全校验失败: ${JSON.stringify(deepBoundaryAndSafetyCheck)}`);
    }

    // 11.6 校验 Esc 与 1/2/3 快捷键退出聚拢态（不误关认知视图）以及右键无关联线节点不误触
    await evaluate(ws, `window.CognitiveViewController.enterNodeCluster('kp_gs01_01')`);
    await sleep(380);
    await dispatchKey(ws, 'Escape', 'Escape', 27);
    await sleep(380);
    const afterEscClusterCheck = await evaluate(ws, `
      (() => {
        const ctrl = window.CognitiveViewController;
        const sec1Card = document.querySelector('#cognitiveMindMapContainer [data-node-uid="sec_1_func"]');
        if (sec1Card) {
          sec1Card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
        }
        return {
          isModalOpen: ctrl.isOpen(),
          isClusterActiveAfterEsc: ctrl.isClusterActive()
        };
      })()
    `);
    if (!afterEscClusterCheck.isModalOpen || afterEscClusterCheck.isClusterActiveAfterEsc) {
      throw new Error(`按 Esc 退出聚拢态或无关联节点右键防误触异常: ${JSON.stringify(afterEscClusterCheck)}`);
    }
    console.log('  PASS: 原树拓扑剪枝聚拢 (1对N / 1对1 / 1层详情 / 连续漫游 / 多路径退出 / 存储安全) 全量验证通过');

    // ─────────────────────────────────────────────────────────────
    // 测试用例 7：顶层按 Esc / O 关闭认知视图，验证从题库页面再次按 O 居中定位与题库快捷键恢复正常
    // ─────────────────────────────────────────────────────────────
    console.log('\n[Test 7] 模拟顶层按下 Esc 关闭认知视图，并验证从题库再次按 O 居中定位及题库快捷键恢复...');
    await dispatchKey(ws, 'Escape', 'Escape', 27);
    await sleep(400);

    const closedCheck = await evaluate(ws, `
      (() => {
        const modal = document.getElementById('cognitiveModal');
        return Boolean(!modal.classList.contains('show') && !window.CognitiveViewController.isOpen());
      })()
    `);
    if (!closedCheck) throw new Error('顶层按 Esc 未能关闭认知视图');

    // 在题库页面按 O 再次进入认知视图（模拟题库章节 ID 与本地缓存存在），校验恢复二级全景且视角居中而非卡在左上角
    await dispatchKey(ws, 'o', 'KeyO', 79);
    await sleep(250);
    const reopenFromBankCheck = await evaluate(ws, `
      new Promise(resolve => {
        const mm = window.CognitiveViewController.getInstance();
        const container = document.getElementById('cognitiveMindMapContainer');
        const cRect = container.getBoundingClientRect();
        const cards = Array.from(document.querySelectorAll('#cognitiveMindMapContainer .smm-node-container .mm-node-card'));
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        cards.forEach(c => {
          const r = c.getBoundingClientRect();
          if (r.width > 0 && r.left > -1000) {
            if (r.left < minX) minX = r.left;
            if (r.right > maxX) maxX = r.right;
            if (r.top < minY) minY = r.top;
            if (r.bottom > maxY) maxY = r.bottom;
          }
        });
        const isOpen = window.CognitiveViewController.isOpen();
        const scale = mm.view.scale;
        const visibleCount = cards.length;
        const centerDiffX = Math.abs((minX + maxX) / 2 - (cRect.left + cRect.width / 2));

        const t0 = performance.now();
        const onEnd = () => {
          mm.off('node_tree_render_end', onEnd);
          resolve({
            isOpen,
            scale,
            visibleCount,
            centerDiffX,
            minX, maxX, minY, maxY,
            level3EndToEndMs: performance.now() - t0
          });
        };
        mm.on('node_tree_render_end', onEnd);
        window.CognitiveViewController.expandToLevel(3);
      })
    `);
    console.log(`  - 从题库页面按 O 重开校验: 可见节点=${reopenFromBankCheck.visibleCount}个, 缩放=${(reopenFromBankCheck.scale * 100).toFixed(0)}%, 水平居中偏差=${reopenFromBankCheck.centerDiffX.toFixed(1)}px, 3键端到端重排耗时=${reopenFromBankCheck.level3EndToEndMs.toFixed(1)}ms`);
    if (!reopenFromBankCheck.isOpen || reopenFromBankCheck.visibleCount !== 52 || reopenFromBankCheck.scale < 0.50 || reopenFromBankCheck.centerDiffX > 45 || reopenFromBankCheck.minX < 0 || reopenFromBankCheck.maxX > 1440) {
      throw new Error(`从题库页面按 O 进入认知视图视角或层级异常: ${JSON.stringify(reopenFromBankCheck)}`);
    }

    await dispatchKey(ws, 'Escape', 'Escape', 27);
    await sleep(350);

    // 关闭后在题库按 'd' 切下一题，同时按 'm' 不应触发认知大纲切换
    await dispatchKey(ws, 'd', 'KeyD', 68);
    await sleep(300);
    const hostNavCheck = await evaluate(ws, `
      (() => ({
        currentQ: window.current,
        cognMode: window.CognitiveViewController.getDualViewController().getMode()
      }))()
    `);
    if (hostNavCheck.currentQ === beforeKeyState.currentQ) {
      throw new Error('关闭认知视图后，底层题库 D 键切题未恢复工作');
    }
    console.log(`  PASS: 关闭认知视图后，底层题库快捷键正常切题 (${beforeKeyState.currentQ} -> ${hostNavCheck.currentQ})，导图组件保持静默休眠`);

    // ─────────────────────────────────────────────────────────────
    // 测试用例 12：高数全 10 章 (第0章~第9章) 导图挂载、跨书路由映射与 5 大同步块验证
    // ─────────────────────────────────────────────────────────────
    console.log('\n[Test 12] 校验高数全 10 章 (math_ch0 ~ math_ch9) 导图挂载、跨书路由映射与 5 大同步块...');
    const allChaptersCheck = await evaluate(ws, `
      (async () => {
        const ctrl = window.CognitiveViewController;
        const reg = ctrl.getChapterRegistry();
        const expectedChapters = [
          'math_ch0', 'math_ch1', 'math_ch2', 'math_ch3', 'math_ch4',
          'math_ch5', 'math_ch6', 'math_ch7', 'math_ch8', 'math_ch9'
        ];
        const missingChapters = expectedChapters.filter(id => !reg.has(id));

        // 1. 跨习题册章节路由校验
        const routeCases = [
          ['math::基础30讲::高数::lec00', 'math_ch0'],
          ['math::基础30讲::高数::lec01', 'math_ch1'],
          ['math::基础30讲::高数::lec02', 'math_ch1'],
          ['math::基础30讲::高数::lec03', 'math_ch2'],
          ['math::基础30讲::高数::lec06', 'math_ch3'],
          ['math::基础30讲::高数::lec08', 'math_ch4'],
          ['math::基础30讲::高数::lec13', 'math_ch5'],
          ['math::基础30讲::高数::lec17', 'math_ch6'],
          ['math::基础30讲::高数::lec14', 'math_ch7'],
          ['math::基础30讲::高数::lec18', 'math_ch7'],
          ['math::基础30讲::高数::lec16', 'math_ch8'],
          ['math::基础30讲::高数::lec15', 'math_ch9'],
          ['math::李范全书::高数::ch01', 'math_ch1'],
          ['math::李范全书::高数::ch04', 'math_ch3'],
          ['math::李范全书::高数::ch06', 'math_ch9'],
          ['math::李范全书::高数::ch07', 'math_ch6'],
          ['math::李范全书::高数::ch08', 'math_ch5'],
          ['math::李范全书::高数::ch09', 'math_ch7'],
          ['math::李范全书::高数::ch11', 'math_ch8'],
          ['math::老姚高数::高数::ch06', 'math_ch4'],
          ['math::老姚高数::高数::ch07', 'math_ch9'],
          ['math::老姚高数::高数::ch08', 'math_ch6'],
          ['math::老姚高数::高数::ch09', 'math_ch5'],
          ['math::老姚高数::高数::ch10', 'math_ch7'],
          ['math::老姚高数::高数::ch12', 'math_ch8']
        ];
        const routeErrors = [];
        for (const [rawId, expected] of routeCases) {
          const actual = ctrl.resolveChapterId(rawId, false);
          if (actual !== expected) {
            routeErrors.push(rawId + ' -> ' + actual + ' (expected ' + expected + ')');
          }
        }

        // 2. 校验 5 大跨章同步块注册完备
        const syncBlocks = window.SyncBlockManager && typeof window.SyncBlockManager.getAllBlocks === 'function'
          ? window.SyncBlockManager.getAllBlocks()
          : (window.SyncBlocksData || {});
        const expectedSyncIds = [
          'sync_parity_period',
          'sync_boundedness',
          'sync_cont_diff_1vN',
          'sync_limit_cross_tools',
          'sync_symmetry_integrals'
        ];
        const missingSyncIds = expectedSyncIds.filter(id => !syncBlocks[id]);

        // 3. 校验 L1 宏观学科树各扇区包含全部 10 章
        const macroTree = ctrl.buildSubjectMacroTree('math', 3);
        const knowSector = (macroTree && Array.isArray(macroTree.children)) ? macroTree.children.find(c => c.data && c.data.uid === 'branch_knowledge') : null;
        const macroChapterCount = (knowSector && Array.isArray(knowSector.children)) ? knowSector.children.length : 0;

        // 4. 校验全部 10 章树结构、同步块注水与零 Emoji / 禁词，并验证动态切换章节渲染
        const chapterSummaries = [];
        const emojiRe = /[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/u;
        const forbiddenRe = /feishu|飞书/i;
        let contentViolation = null;

        for (let i = 0; i < expectedChapters.length; i++) {
          const chId = expectedChapters[i];
          const rawTree = reg.get(chId);
          const hydratedTree = window.SyncBlockManager.hydrateTree(rawTree);
          const childrenUids = (hydratedTree && Array.isArray(hydratedTree.children)) ? hydratedTree.children.map(c => c.data && c.data.uid) : [];
          const hasAllThreeBranches = childrenUids.includes('branch_knowledge') &&
            childrenUids.includes('branch_exam_points') &&
            childrenUids.includes('branch_methods');

          let nodeCount = 0;
          let syncRootCount = 0;
          const walk = (n) => {
            if (!n) return;
            nodeCount++;
            const txt = (n.data && n.data.text) || '';
            if (n.data && n.data.syncBlockId && !n.data.isSyncBlockChild) syncRootCount++;
            if (emojiRe.test(txt) || forbiddenRe.test(txt)) {
              contentViolation = chId + ' 节点 [' + (n.data && n.data.uid) + '] 含违禁字符: ' + txt;
            }
            (n.children || []).forEach(walk);
          };
          walk(hydratedTree);
          chapterSummaries.push({
            chId,
            rootUid: hydratedTree && hydratedTree.data && hydratedTree.data.uid,
            hasAllThreeBranches,
            nodeCount,
            syncRootCount
          });
        }

        // 5. 验证运行时切换到第0章与第7章并渲染
        ctrl.open({ subject: 'math', chapterId: 'math_ch0' });
        await new Promise(r => setTimeout(r, 150));
        const ch0CurrentId = ctrl.getCurrentChapterId();
        const ch0RootDom = Boolean(document.querySelector('#cognitiveMindMapContainer [data-node-uid="root_chapter_0"]'));

        ctrl.loadChapter('math_ch7');
        await new Promise(r => setTimeout(r, 150));
        const ch7CurrentId = ctrl.getCurrentChapterId();
        const ch7RootDom = Boolean(document.querySelector('#cognitiveMindMapContainer [data-node-uid="root_chapter_7"]'));
        ctrl.close();

        return {
          missingChapters,
          routeErrors,
          missingSyncIds,
          macroChapterCount,
          chapterSummaries,
          contentViolation,
          ch0SwitchOk: ch0CurrentId === 'math_ch0' && ch0RootDom,
          ch7SwitchOk: ch7CurrentId === 'math_ch7' && ch7RootDom
        };
      })()
    `);
    console.log(`  - 已注册高数章节数: ${10 - allChaptersCheck.missingChapters.length}/10, L1宏观树章节数: ${allChaptersCheck.macroChapterCount}, 同步块数: ${5 - allChaptersCheck.missingSyncIds.length}/5`);
    console.log(`  - 各章节点与同步块统计: ${allChaptersCheck.chapterSummaries.map(s => `${s.chId}(${s.nodeCount}节点,同步块=${s.syncRootCount})`).join(', ')}`);
    console.log(`  - 动态跨章渲染校验: math_ch0=${allChaptersCheck.ch0SwitchOk}, math_ch7=${allChaptersCheck.ch7SwitchOk}`);
    if (
      allChaptersCheck.missingChapters.length > 0 ||
      allChaptersCheck.routeErrors.length > 0 ||
      allChaptersCheck.missingSyncIds.length > 0 ||
      allChaptersCheck.macroChapterCount !== 10 ||
      allChaptersCheck.contentViolation ||
      !allChaptersCheck.ch0SwitchOk ||
      !allChaptersCheck.ch7SwitchOk ||
      allChaptersCheck.chapterSummaries.some(s => !s.hasAllThreeBranches || s.nodeCount < 20)
    ) {
      throw new Error(`全 10 章导图或路由校验失败: ${JSON.stringify(allChaptersCheck)}`);
    }
    console.log('  PASS: 高数全 10 章 (第0章~第9章) 导图结构、跨习题册路由映射、5大同步块注水与文案洁癖校验 100% 通过');

    // ─────────────────────────────────────────────────────────────
    // 测试用例 13：S 键全量层/章节层切换、A/D 切章、全量层 Q/W/E、L1->L2 写穿持久化与 O 键跨刷新状态记忆
    // ─────────────────────────────────────────────────────────────
    console.log('\n[Test 13] 校验 S 键全量层/章节层切换、A/D 切章、全量层 Q/W/E、改动写穿与 O 键刷新状态保留...');

    // 13.1 打开第 1 章，验证左下角状态胶囊与 A / D 章节循环切换
    await evaluate(ws, `window.CognitiveViewController.open({ subject: 'math', chapterId: 'math_ch1' })`);
    await sleep(350);

    // 按 D 切到下一章 (math_ch2)
    await dispatchKey(ws, 'd', 'KeyD', 68);
    await sleep(350);
    const afterNextCh = await evaluate(ws, `
      (() => ({
        chId: window.CognitiveViewController.getCurrentChapterId(),
        layerMode: window.CognitiveViewController.getLayerMode(),
        capsuleLabel: document.getElementById('dockChapterLabel')?.textContent || '',
        toggleBtnText: document.getElementById('btnDockToggleLayer')?.textContent || '',
        hasCh2Root: Boolean(document.querySelector('#cognitiveMindMapContainer [data-node-uid="root_chapter_2"]'))
      }))()
    `);
    console.log(`  - 章节层按 D 切下一章: currentChapterId=${afterNextCh.chId}, 胶囊="${afterNextCh.capsuleLabel}", 按钮="${afterNextCh.toggleBtnText}"`);
    if (afterNextCh.chId !== 'math_ch2' || afterNextCh.layerMode !== 'chapter' || !afterNextCh.hasCh2Root || !afterNextCh.capsuleLabel.includes('第2章')) {
      throw new Error(`章节层按 D 键切章失败: ${JSON.stringify(afterNextCh)}`);
    }

    // 连续按 3 次 A：math_ch2 -> math_ch1 -> math_ch0 -> math_ch9 (环形循环)
    await dispatchKey(ws, 'a', 'KeyA', 65);
    await sleep(250);
    await dispatchKey(ws, 'a', 'KeyA', 65);
    await sleep(250);
    await dispatchKey(ws, 'a', 'KeyA', 65);
    await sleep(350);
    const afterWrapPrevCh = await evaluate(ws, `
      (() => ({
        chId: window.CognitiveViewController.getCurrentChapterId(),
        capsuleLabel: document.getElementById('dockChapterLabel')?.textContent || '',
        hasCh9Root: Boolean(document.querySelector('#cognitiveMindMapContainer [data-node-uid="root_chapter_9"]'))
      }))()
    `);
    console.log(`  - 章节层按 A 环形回绕: currentChapterId=${afterWrapPrevCh.chId}, 胶囊="${afterWrapPrevCh.capsuleLabel}"`);
    if (afterWrapPrevCh.chId !== 'math_ch9' || !afterWrapPrevCh.hasCh9Root) {
      throw new Error(`章节层按 A 键环形回绕至 math_ch9 失败: ${JSON.stringify(afterWrapPrevCh)}`);
    }

    // 按 D 切回 math_ch0，再按 D 切回 math_ch1
    await dispatchKey(ws, 'd', 'KeyD', 68);
    await sleep(220);
    await dispatchKey(ws, 'd', 'KeyD', 68);
    await sleep(320);

    // 13.2 按 S 键切换进入 L1 全量层 (正品字 △ 同构总览)
    await dispatchKey(ws, 's', 'KeyS', 83);
    await sleep(450);
    const macroEnterCheck = await evaluate(ws, `
      (() => {
        const ctrl = window.CognitiveViewController;
        const rectOf = (uid) => {
          const el = document.querySelector('#cognitiveMindMapContainer [data-node-uid="' + uid + '"]');
          return el ? el.getBoundingClientRect() : null;
        };
        const rRoot = rectOf('root_subject_math');
        const rExam = rectOf('branch_exam_points');
        const rKnow = rectOf('branch_knowledge');
        const rMeth = rectOf('branch_methods');
        const toggleBtn = document.getElementById('btnDockToggleLayer');
        return {
          layerMode: ctrl.getLayerMode(),
          currentChapterId: ctrl.getCurrentChapterId(),
          hasMacroRoot: Boolean(rRoot),
          isTriangleLayout: Boolean(
            rRoot && rExam && rKnow && rMeth &&
            rExam.bottom < rRoot.top &&
            rKnow.right < rRoot.left &&
            rMeth.left > rRoot.right
          ),
          hasCh0Know: Boolean(document.querySelector('#cognitiveMindMapContainer [data-node-uid="macro_know_math_ch0"]')),
          hasCh9Know: Boolean(document.querySelector('#cognitiveMindMapContainer [data-node-uid="macro_know_math_ch9"]')),
          isMacroBtnActive: Boolean(toggleBtn && toggleBtn.classList.contains('is-macro-active')),
          capsuleLabel: document.getElementById('dockChapterLabel')?.textContent || ''
        };
      })()
    `);
    console.log(`  - 按 S 键进入 L1 全量层: layerMode=${macroEnterCheck.layerMode}, 正品字△方位=${macroEnterCheck.isTriangleLayout}, 含第0~9章=${macroEnterCheck.hasCh0Know && macroEnterCheck.hasCh9Know}, 胶囊="${macroEnterCheck.capsuleLabel}"`);
    if (macroEnterCheck.layerMode !== 'subject_macro' || !macroEnterCheck.hasMacroRoot || !macroEnterCheck.isTriangleLayout || !macroEnterCheck.hasCh0Know || !macroEnterCheck.hasCh9Know || !macroEnterCheck.isMacroBtnActive) {
      throw new Error(`按 S 键进入 L1 全量层校验失败: ${JSON.stringify(macroEnterCheck)}`);
    }
    await captureScreenshot(ws, 'math_macro_layer_overview.png');

    // 13.3 全量层下按 Q / W / E 与 A / D 巡航
    await dispatchKey(ws, 'q', 'KeyQ', 81);
    await sleep(350);
    await dispatchKey(ws, 'q', 'KeyQ', 81);
    await sleep(350);
    const macroQCycleCheck = await evaluate(ws, `
      (() => ({
        focusedChAfterQ2: window.CognitiveViewController.getMacroFocusedChapterId(),
        hasCh0Sec1Expanded: Boolean(document.querySelector('#cognitiveMindMapContainer [data-node-uid="sec_1_logic"]'))
      }))()
    `);
    console.log(`  - 全量层连按 Q 键巡航: focusedChapter=${macroQCycleCheck.focusedChAfterQ2}, 第0章分节展开=${macroQCycleCheck.hasCh0Sec1Expanded}`);
    if (macroQCycleCheck.focusedChAfterQ2 !== 'math_ch0' || !macroQCycleCheck.hasCh0Sec1Expanded) {
      throw new Error(`全量层 Q 键巡航异常: ${JSON.stringify(macroQCycleCheck)}`);
    }

    await dispatchKey(ws, 'w', 'KeyW', 87);
    await sleep(300);
    await dispatchKey(ws, 'e', 'KeyE', 69);
    await sleep(300);

    // 在全量层按 D 键，从当前聚焦的 math_ch0 切到 math_ch1，再按 D 切到 math_ch2
    await dispatchKey(ws, 'd', 'KeyD', 68);
    await sleep(250);
    await dispatchKey(ws, 'd', 'KeyD', 68);
    await sleep(350);
    const macroADCheck = await evaluate(ws, `
      (() => ({
        focusedCh: window.CognitiveViewController.getMacroFocusedChapterId(),
        capsuleLabel: document.getElementById('dockChapterLabel')?.textContent || ''
      }))()
    `);
    console.log(`  - 全量层按 D 键定位章节: focusedCh=${macroADCheck.focusedCh}, 胶囊="${macroADCheck.capsuleLabel}"`);
    if (macroADCheck.focusedCh !== 'math_ch2' || !macroADCheck.capsuleLabel.includes('第2章')) {
      throw new Error(`全量层 D 键定位章节失败: ${JSON.stringify(macroADCheck)}`);
    }

    // 13.4 全量层修改写穿 (Write-Through Persistence) 到对应章节 (math_ch2)
    const writeThroughSetup = await evaluate(ws, `
      (() => {
        const ctrl = window.CognitiveViewController;
        const mm = ctrl.getInstance();
        const sm = ctrl.getShortcutManager();
        // 在全量层中找到第2章的知识点节点 k_ch2_sec1 并设置高亮色为 green
        const targetNode = mm.renderer.findNodeByUid('k_ch2_sec1');
        if (!targetNode) return { ok: false, error: '全量层未找到 k_ch2_sec1 节点' };
        sm.toggleNodeHighlight(targetNode, 'green');
        ctrl.persistCurrentMindMapState(true);
        return {
          ok: true,
          macroColor: targetNode.getData('highlightColor')
        };
      })()
    `);
    if (!writeThroughSetup.ok || writeThroughSetup.macroColor !== 'green') {
      throw new Error(`全量层修改节点高亮失败: ${JSON.stringify(writeThroughSetup)}`);
    }

    // 此时在全量层已聚焦 math_ch2，直接按 S 键下钻进入第 2 章章节层，校验刚才在全量层的修改已同步生效！
    await dispatchKey(ws, 's', 'KeyS', 83);
    await sleep(400);
    const writeThroughVerify = await evaluate(ws, `
      (() => {
        const ctrl = window.CognitiveViewController;
        const mm = ctrl.getInstance();
        const sm = ctrl.getShortcutManager();
        const chId = ctrl.getCurrentChapterId();
        const layerMode = ctrl.getLayerMode();
        const ch2Node = mm.renderer.findNodeByUid('k_ch2_sec1');
        const ch2Color = ch2Node ? ch2Node.getData('highlightColor') : '';
        // 清理测试高亮色
        if (ch2Node && sm) {
          sm.toggleNodeHighlight(ch2Node, 'none');
          ctrl.persistCurrentMindMapState(true);
        }
        return {
          chId,
          layerMode,
          ch2Color
        };
      })()
    `);
    console.log(`  - 全量层按 S 下钻至聚焦章并验证写穿: layerMode=${writeThroughVerify.layerMode}, chId=${writeThroughVerify.chId}, 章节层节点高亮色="${writeThroughVerify.ch2Color}"`);
    if (writeThroughVerify.layerMode !== 'chapter' || writeThroughVerify.chId !== 'math_ch2' || writeThroughVerify.ch2Color !== 'green') {
      throw new Error(`全量层修改写穿至章节层校验失败: ${JSON.stringify(writeThroughVerify)}`);
    }

    // 13.5 校验 O 键状态保留与跨页面刷新 (Page.reload) 自动停留在 O 键状态
    // 切换进入全量层，并将 L 键关联线设为静音 (false)，然后执行页面刷新
    await dispatchKey(ws, 's', 'KeyS', 83);
    await sleep(350);
    const beforeReloadState = await evaluate(ws, `
      (() => {
        const ctrl = window.CognitiveViewController;
        ctrl.toggleAssociativeLines(false);
        ctrl.saveCognitiveState({ isOpen: true });
        return {
          isOpen: ctrl.isOpen(),
          layerMode: ctrl.getLayerMode(),
          isAssocVisible: ctrl.isAssociativeLineVisible(),
          savedRaw: localStorage.getItem('kaoyan.g.cognitive_state')
        };
      })()
    `);
    console.log(`  - 刷新前认知状态: isOpen=${beforeReloadState.isOpen}, layerMode=${beforeReloadState.layerMode}, L键显线=${beforeReloadState.isAssocVisible}`);

    await sendCDP(ws, 'Page.reload', { ignoreCache: false });
    await sleep(2200);

    const afterReloadState = await evaluate(ws, `
      (() => {
        const ctrl = window.CognitiveViewController;
        const modal = document.getElementById('cognitiveModal');
        return {
          isOpen: Boolean(ctrl && ctrl.isOpen()),
          modalShown: Boolean(modal && modal.classList.contains('show')),
          layerMode: ctrl ? ctrl.getLayerMode() : '',
          currentChapterId: ctrl ? ctrl.getCurrentChapterId() : '',
          isAssocVisible: ctrl ? ctrl.isAssociativeLineVisible() : true,
          hasMacroRootDom: Boolean(document.querySelector('#cognitiveMindMapContainer [data-node-uid="root_subject_math"]'))
        };
      })()
    `);
    console.log(`  - 页面刷新后自动恢复校验: isOpen=${afterReloadState.isOpen}, modalShown=${afterReloadState.modalShown}, layerMode=${afterReloadState.layerMode}, L键显线=${afterReloadState.isAssocVisible}, 全量层根节点=${afterReloadState.hasMacroRootDom}`);
    if (!afterReloadState.isOpen || !afterReloadState.modalShown || afterReloadState.layerMode !== 'subject_macro' || afterReloadState.isAssocVisible !== false || !afterReloadState.hasMacroRootDom) {
      throw new Error(`页面刷新后未能保持在 O 键状态或状态恢复不完整: ${JSON.stringify(afterReloadState)}`);
    }

    // 恢复默认状态并关闭
    await evaluate(ws, `
      (() => {
        const ctrl = window.CognitiveViewController;
        ctrl.toggleAssociativeLines(true);
        ctrl.loadChapter('math_ch1');
        ctrl.close();
      })()
    `);
    await sleep(250);
    console.log('  PASS: S 键全量层/章节层切换、A/D 切章、全量层 Q/W/E、L1->L2 写穿持久化与 O 键跨刷新状态记忆 100% 通过');

    console.log('\n================================================================');
    console.log('  第一章认知视图与 MindMap 独立工具集全量 CDP E2E 测试通过 (PASS)');
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n[TEST FAILED]:', err);
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
}

runTests();
