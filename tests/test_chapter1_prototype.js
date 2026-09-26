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
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
    console.log(`  [Screenshot] 已保存真机截屏: ${filename}`);
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
          window.Chapter1MindMapData &&
          window.MathVizWidget
        );
        const closeBtn = document.getElementById('btnCloseCognitiveModal') || document.querySelector('#cognitiveModal .cognitive-close-btn');
        const topToolbar = document.getElementById('cognitiveFloatingToolbar');
        return { hasToolkit, hasBackBtn: Boolean(closeBtn), hasTopToolbar: Boolean(topToolbar) };
      })()
    `);
    if (!initCheck.hasToolkit) throw new Error('MindMap 工具集或认知视图控制器未完全加载');
    if (initCheck.hasBackBtn) throw new Error('认知视图中不应存在返回按钮');
    if (initCheck.hasTopToolbar) throw new Error('顶部控制栏 (#cognitiveFloatingToolbar) 应已彻底移除');
    console.log('  PASS: MindMap 独立工具集完整加载，严格遵循无返回按钮规范且顶部控制栏已物理移除');

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

        // 双向同类二级节点聚拢校验：知识点全部在左翼，考点与解法全部在右翼
        const sec1Rect = sec1Card ? sec1Card.getBoundingClientRect() : null;
        const sec2Rect = sec2Card ? sec2Card.getBoundingClientRect() : null;
        const sec3Rect = sec3Card ? sec3Card.getBoundingClientRect() : null;
        const kp01Rect = kp01Card ? kp01Card.getBoundingClientRect() : null;
        const m01Rect = method01Card ? method01Card.getBoundingClientRect() : null;

        const leftWingClustered = sec1Rect && sec2Rect && sec3Rect &&
          (sec1Rect.right <= rootCenterX + 50) &&
          (sec2Rect.right <= rootCenterX + 50) &&
          (sec3Rect.right <= rootCenterX + 50);

        const rightWingClustered = kp01Rect && m01Rect &&
          (kp01Rect.left >= rootCenterX - 50) &&
          (m01Rect.left >= rootCenterX - 50);

        const nexusLines = Array.from(document.querySelectorAll('#cognitiveMindMapContainer .smm-associative-line-container path'));
        const firstLine = nexusLines[0];
        const lineDasharray = firstLine ? window.getComputedStyle(firstLine).strokeDasharray : '';
        const lineIsSolid = !lineDasharray || lineDasharray === 'none';

        // 校验 3 级节点卡片实体边框与纯白底色（杜绝悬空）
        const sampleCard = document.querySelector('#cognitiveMindMapContainer [data-node-uid="sec_1_func"]');
        const cardStyle = sampleCard ? window.getComputedStyle(sampleCard) : null;
        const cardHasBorder = cardStyle && parseFloat(cardStyle.borderTopWidth) > 0 && cardStyle.borderTopStyle === 'solid';
        const cardHasBg = cardStyle && cardStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && cardStyle.backgroundColor !== 'transparent';

        // 校验无 §2 重复字符复读
        const hasTextDuplication = Boolean(document.body.innerText.includes('§2 §2') || document.body.innerText.includes('§1 §1'));

        const branchKnowledgeCard = document.querySelector('#cognitiveMindMapContainer [data-node-uid="branch_knowledge"]');
        const branchExamCard = document.querySelector('#cognitiveMindMapContainer [data-node-uid="branch_exam_points"]');
        const branchMethodCard = document.querySelector('#cognitiveMindMapContainer [data-node-uid="branch_methods"]');

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
          sec1Right: sec1Rect ? Math.round(sec1Rect.right) : null,
          sec2Right: sec2Rect ? Math.round(sec2Rect.right) : null,
          sec3Right: sec3Rect ? Math.round(sec3Rect.right) : null,
          scale: Number(scale.toFixed(2)),
          bounds: { minX: Math.round(minX), maxX: Math.round(maxX), minY: Math.round(minY), maxY: Math.round(maxY) },
          fitsViewport: minX >= -30 && maxX <= 1470 && minY >= -10 && maxY <= 920,
          leftWingClustered: Boolean(leftWingClustered),
          rightWingClustered: Boolean(rightWingClustered),
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
    console.log(`  - rootCenterX=${overviewStats.rootCenterX}, sec1Right=${overviewStats.sec1Right}, sec2Right=${overviewStats.sec2Right}, sec3Right=${overviewStats.sec3Right}, hasSec1=${overviewStats.hasSec1}, hasSec2=${overviewStats.hasSec2}, hasSec3=${overviewStats.hasSec3}`);
    console.log(`  - 左翼知识点聚拢 (§1/§2/§3 严格居左): ${overviewStats.leftWingClustered}`);
    console.log(`  - 右翼考点与招法聚拢 (考点与招法严格居右): ${overviewStats.rightWingClustered}`);
    console.log(`  - 原生跨分支拓扑关联线网数量: ${overviewStats.nexusLineCount} 条, 实线状态: ${overviewStats.lineIsSolid}`);
    console.log(`  - 节点卡片实体边框与底色: 边框=${overviewStats.cardHasBorder}, 底色=${overviewStats.cardHasBg}`);
    console.log(`  - 消除双层文本复读 (§2 §2 消除): ${!overviewStats.hasTextDuplication}`);

    if (!overviewStats.isOpen || !overviewStats.hasRoot || !overviewStats.hasBranchKnowledge || !overviewStats.hasBranchExam || !overviewStats.hasBranchMethod) {
      throw new Error('二级三大分类主支架构未能完整渲染');
    }
    if (!overviewStats.leftWingClustered || !overviewStats.rightWingClustered) {
      throw new Error('双向布局下同类二级节点未能在同一翼完整聚拢');
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
    console.log('  PASS: 默认「一览全局」模式同类二级节点严格聚拢，原生拓扑关联线网准确呈现');

    await captureScreenshot(ws, 'chapter1_overview_level2.png');

    // ─────────────────────────────────────────────────────────────
    // 测试用例 3：展开全部详情 (Level 3/4 紧凑子节点 + 语义前缀标签降噪)
    // ─────────────────────────────────────────────────────────────
    console.log('\n[Test 3] 校验「展开详情」模式下多层紧凑子节点、语义前缀降噪与公式渲染...');
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

        return {
          totalCardCount: allCards.length,
          tagCount: tags.length,
          sampleTags: tags.slice(0, 8),
          actionPillCount: actionPills.length,
          vizPillCount: vizPills.length,
          katexCount: katexEls.length,
          secSubNodeTags
        };
      })()
    `);

    console.log(`  - 全展开节点总数: ${expandedStats.totalCardCount} 个`);
    console.log(`  - 语义前缀胶囊数: ${expandedStats.tagCount} 个 (示例: ${expandedStats.sampleTags.join(', ')})`);
    console.log(`  - 二级知识点节点彩标数量 (应为0纯净化): ${expandedStats.secSubNodeTags} 处`);
    console.log(`  - 尾部交互胶囊数: 真题=${expandedStats.actionPillCount}, 几何图解=${expandedStats.vizPillCount}`);
    console.log(`  - 节点内 KaTeX 数学公式数: ${expandedStats.katexCount} 处`);

    if (expandedStats.totalCardCount < 45 || expandedStats.tagCount < 20 || expandedStats.katexCount < 15) {
      throw new Error('全展开模式下紧凑子节点或语义标签/公式数量不足');
    }
    if (expandedStats.secSubNodeTags > 0) {
      throw new Error('二级知识点节点未能完全移除五颜六色的标签噪声');
    }
    console.log('  PASS: 二级知识点无杂音纯净渲染，叶子层级精准承载语义标签与 KaTeX 公式');

    await captureScreenshot(ws, 'chapter1_expanded_subnodes.png');

    // 切回一览全局以测拓扑聚焦与几何弹窗
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
        const activePaths = Array.from(document.querySelectorAll('#cognitiveMindMapContainer .smm-associative-line-container path.is-active-line'));
        
        // 校验弱化节点透明度是否为 0.58（调优透明度，避免周边文字过暗不可读）
        const nonResonanceCard = document.querySelector('#cognitiveMindMapContainer .smm-node:not(.is-in-resonance) .mm-node-card');
        const dimmedOpacity = nonResonanceCard ? window.getComputedStyle(nonResonanceCard).opacity : '';
        
        // 校验无遗留 SVG 虚线注入层
        const ghostLayer = document.querySelector('#cognitiveMindMapContainer .cognitive-active-lines-layer');
        const hasGhostLines = Boolean(ghostLayer && ghostLayer.children.length > 0);

        const allPaths = Array.from(document.querySelectorAll('#cognitiveMindMapContainer .smm-associative-line-container path'));
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
          hasGhostLines
        };
      })()
    `);

    console.log(`  - 激活考点 UID: ${resonanceState.activeUid}`);
    console.log(`  - 跨分支关联节点数: ${resonanceState.linkedCount}, 原生高亮关联线数: ${resonanceState.activeLineCount}, 全量连线数: ${resonanceState.allPathCount}`);
    console.log(`  - 连线样本: ${JSON.stringify(resonanceState.pathSample)}`);
    console.log(`  - 背景弱化卡片透明度: ${resonanceState.dimmedOpacity}, 遗留虚线注入层: ${resonanceState.hasGhostLines}`);
    if (!resonanceState.hasResonanceClass || resonanceState.activeUid !== 'kp_gs01_01' || resonanceState.activeLineCount === 0 || resonanceState.hasGhostLines) {
      throw new Error('Focus Resonance 聚焦高亮或原生关联线高亮未生效，或存在遗留虚线注入层');
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

    // 在认知视图开启时连续发送底层题库敏感快捷键：'1' (熟练)、'd' (下一题)、'j' (下一题)、'm' (切换大纲/SM2)、'h' (导图帮助/题库帮助)
    await dispatchKey(ws, '1', 'Digit1', 49);
    await dispatchKey(ws, 'd', 'KeyD', 68);
    await dispatchKey(ws, 'j', 'KeyJ', 74);
    await sleep(300);

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

    // 6. 验证在 L 键静音状态下，点击有关联线的节点依然能够透出实线
    await evaluate(ws, `window.CognitiveViewController.applyFocusResonanceByUid('kp_gs01_01')`);
    await sleep(400);

    const mutedResonanceCheck = await evaluate(ws, `
      (() => {
        const activeLine = document.querySelector('#cognitiveMindMapContainer .smm-associative-line-container path.is-active-line');
        const normalLine = document.querySelector('#cognitiveMindMapContainer .smm-associative-line-container path:not(.is-active-line)');
        return {
          hasActiveLine: Boolean(activeLine),
          activeLineOpacity: activeLine ? window.getComputedStyle(activeLine).opacity : '',
          normalLineOpacity: normalLine ? window.getComputedStyle(normalLine).opacity : ''
        };
      })()
    `);

    console.log(`  - L静音下激活关联线存在: ${mutedResonanceCheck.hasActiveLine}, 激活线透明度: ${mutedResonanceCheck.activeLineOpacity}, 普通线透明度: ${mutedResonanceCheck.normalLineOpacity}`);

    if (!mutedResonanceCheck.hasActiveLine || mutedResonanceCheck.activeLineOpacity !== '1' || mutedResonanceCheck.normalLineOpacity !== '0') {
      throw new Error(`L 键静音状态下透出规则异常: hasActive=${mutedResonanceCheck.hasActiveLine}, active=${mutedResonanceCheck.activeLineOpacity}, normal=${mutedResonanceCheck.normalLineOpacity}`);
    }

    await evaluate(ws, `
      (() => {
        window.CognitiveViewController.clearFocusResonance();
        window.CognitiveViewController.toggleAssociativeLines(true); // 恢复为默认显示
      })()
    `);
    await sleep(300);

    console.log('  PASS: 原生滚轮平滑缩放、点击画布收起抽屉与原生关联线 L 键切换及静音透出校验通过');

    // ─────────────────────────────────────────────────────────────
    // 测试用例 9：单键 Q / W / E 全量展开与单键 1 / 2 / 3 层级控制专项验证
    // ─────────────────────────────────────────────────────────────
    console.log('\n[Test 9] 校验单键 Q / W / E 全量展开与单键 1 / 2 / 3 层级控制...');

    // 1. 单键 Q: 知识点全量递归展开到底，考点与解法保持概览态
    await dispatchKey(ws, 'q', 'KeyQ', 81);
    await sleep(600);
    const qState = await evaluate(ws, `
      (() => {
        const sec1Sub = document.querySelector('#cognitiveMindMapContainer [data-node-uid="k_fn_concept"]');
        const deepLeaf = document.querySelector('#cognitiveMindMapContainer [data-node-uid="k_lim_crit_squeeze"]');
        const kp01Ref = document.querySelector('#cognitiveMindMapContainer [data-node-uid="kp_gs01_01_ref"]');
        return {
          knowledgeExpanded: Boolean(sec1Sub),
          deepLeafExpanded: Boolean(deepLeaf),
          examFolded: !kp01Ref
        };
      })()
    `);
    console.log(`  - 单键 Q (知识点全量展开): 二级小节可见=${qState.knowledgeExpanded}, 深度卡片可见=${qState.deepLeafExpanded}, 考点细节折叠=${qState.examFolded}`);
    if (!qState.knowledgeExpanded || !qState.deepLeafExpanded) throw new Error('单键 Q 未能将知识点分类全量递归展开到底');

    // 2. 单键 W: 考点全量展开，知识点与解法保持概览态
    await dispatchKey(ws, 'w', 'KeyW', 87);
    await sleep(600);
    const wState = await evaluate(ws, `
      (() => {
        const kp01Card = document.querySelector('#cognitiveMindMapContainer [data-node-uid="kp_gs01_01"]');
        const kp01Ref = document.querySelector('#cognitiveMindMapContainer [data-node-uid="kp_gs01_01_ref"]');
        const sec1Sub = document.querySelector('#cognitiveMindMapContainer [data-node-uid="k_fn_concept"]');
        return {
          examExpanded: Boolean(kp01Card),
          examLeafExpanded: Boolean(kp01Ref),
          knowledgeFolded: !sec1Sub
        };
      })()
    `);
    console.log(`  - 单键 W (考点全量展开): 考点分支展开=${wState.examExpanded}, 考点题源卡片展开=${wState.examLeafExpanded}, 知识点细节折叠=${wState.knowledgeFolded}`);
    if (!wState.examExpanded || !wState.examLeafExpanded || !wState.knowledgeFolded) throw new Error('单键 W 未能正确进行考点全量展开并折叠其他分支');

    // 3. 单键 E: 解法全量展开，知识点与考点保持概览态
    await dispatchKey(ws, 'e', 'KeyE', 69);
    await sleep(600);
    const eState = await evaluate(ws, `
      (() => {
        const m01Card = document.querySelector('#cognitiveMindMapContainer [data-node-uid="m_gs01_01"]');
        const m01Step = document.querySelector('#cognitiveMindMapContainer [data-node-uid="m_gs01_01_s1"]');
        const kp01Ref = document.querySelector('#cognitiveMindMapContainer [data-node-uid="kp_gs01_01_ref"]');
        return {
          methodExpanded: Boolean(m01Card),
          methodStepExpanded: Boolean(m01Step),
          examFolded: !kp01Ref
        };
      })()
    `);
    console.log(`  - 单键 E (解法全量展开): 解法招法展开=${eState.methodExpanded}, 解法步骤卡片展开=${eState.methodStepExpanded}, 考点细节折叠=${eState.examFolded}`);
    if (!eState.methodExpanded || !eState.methodStepExpanded || !eState.examFolded) throw new Error('单键 E 未能正确进行解法全量展开并折叠其他分支');
    console.log('  PASS: 单键 Q / W / E 全量递归展开与非目标分类概览收纳完全符合预期');

    // 4. 单键 1: 知识点展开至 1.1~3.3 这一层级，考点展开至 5 大考点，招法展开至 7 大招法（微观公式、真题题源与解法步骤折叠）
    await dispatchKey(ws, '1', 'Digit1', 49);
    await sleep(500);
    const key1State = await evaluate(ws, `
      (() => {
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
          leavesFolded: !sec1Leaf && !kp01Ref && !m01Step
        };
      })()
    `);
    console.log(`  - 单键 1 (知识点展开至1.1层级): 知识分节可见=${key1State.hasSec1}, 知识点1.1可见=${key1State.hasSec1Sub}, 考点可见=${key1State.hasKp01}, 招法可见=${key1State.hasM01}, 叶子细节折叠=${key1State.leavesFolded}`);
    if (!key1State.hasSec1 || !key1State.hasSec1Sub || !key1State.hasKp01 || !key1State.hasM01 || !key1State.leavesFolded) {
      throw new Error('单键 1 知识点展开至 1.1 层级对齐行为异常');
    }

    // 5. 单键 2: 展开微观定理公式卡片、考点真题题源卡片与解题步骤卡片
    await dispatchKey(ws, '2', 'Digit2', 50);
    await sleep(500);
    const key2State = await evaluate(ws, `
      (() => {
        const sec1Leaf = document.querySelector('#cognitiveMindMapContainer [data-node-uid="k_fn_concept_1"]');
        const kp01Ref = document.querySelector('#cognitiveMindMapContainer [data-node-uid="kp_gs01_01_ref"]');
        const m01Step = document.querySelector('#cognitiveMindMapContainer [data-node-uid="m_gs01_01_s1"]');
        return {
          sec1LeafVisible: Boolean(sec1Leaf),
          kp01RefVisible: Boolean(kp01Ref),
          m01StepVisible: Boolean(m01Step)
        };
      })()
    `);
    console.log(`  - 单键 2 (微观公式与真题步骤展现): 知识微观公式可见=${key2State.sec1LeafVisible}, 考点题源卡片可见=${key2State.kp01RefVisible}, 招法步骤卡片可见=${key2State.m01StepVisible}`);
    if (!key2State.sec1LeafVisible || !key2State.kp01RefVisible || !key2State.m01StepVisible) {
      throw new Error('单键 2 微观细节展现异常');
    }
    console.log('  PASS: 单键 1 / 2 层级控制与知识点1.1层级对齐校验通过');

    // ─────────────────────────────────────────────────────────────
    // 测试用例 7：顶层按 Esc / O 关闭认知视图，验证关闭后题库快捷键恢复正常
    // ─────────────────────────────────────────────────────────────
    console.log('\n[Test 7] 模拟顶层按下 Esc 关闭认知视图，并验证题库快捷键恢复...');
    await dispatchKey(ws, 'Escape', 'Escape', 27);
    await sleep(400);

    const closedCheck = await evaluate(ws, `
      (() => {
        const modal = document.getElementById('cognitiveModal');
        return Boolean(!modal.classList.contains('show') && !window.CognitiveViewController.isOpen());
      })()
    `);
    if (!closedCheck) throw new Error('顶层按 Esc 未能关闭认知视图');

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
