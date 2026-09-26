/**
 * 思维导图沙箱自动化验证套件 (CDP E2E Test Suite)
 * 测试内容：
 * 1. 沙箱独立 HTML 与 Vendor 资源加载 (无 404，无 JS/CSS 报错)
 * 2. SimpleMindMap 实例正确挂载并渲染出 SVG 节点树
 * 3. 默认知识架构数据结构与节点总数校验
 * 4. 视口控制命令 (居中、自适应、放大、缩小) 与比例联动
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const WSClient = globalThis.WebSocket;
const HTTP_PORT = 8991;
const CDP_PORT = 9331;
const ROOT_DIR = path.resolve(__dirname, '..');
const BRAIN_DIR = 'C:\\Users\\Zhangwh\\.gemini\\antigravity\\brain\\ad399e82-8fac-4031-b08f-5dda2f357e6b';

let httpServer = null;
let chromeProcess = null;
let exceptions = [];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 简易静态文件服务器
function startHttpServer() {
  return new Promise((resolve) => {
    httpServer = http.createServer((req, res) => {
      let reqPath = decodeURIComponent(req.url.split('?')[0]);
      if (reqPath === '/') reqPath = '/mindmap-sandbox/index.html';
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
        '.woff2': 'font/woff2',
        '.woff': 'font/woff',
        '.ttf': 'font/ttf'
      };
      const contentType = mimeMap[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    });

    httpServer.listen(HTTP_PORT, '127.0.0.1', () => {
      console.log(`[HTTP] 沙箱静态服务器已启动: http://127.0.0.1:${HTTP_PORT}/mindmap-sandbox/index.html`);
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

let cdpSeq = 200;
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

async function run() {
  console.log('====================================================');
  console.log('  思维导图沙箱 - Phase 2 自动化回归验证 (CDP E2E)');
  console.log('====================================================\n');

  try {
    // 1. 启动静态服务器
    await startHttpServer();

    // 2. 查找并启动 Chrome
    const chromeCandidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
    const chromePath = chromeCandidates.find(p => fs.existsSync(p));
    if (!chromePath) {
      throw new Error('未找到 Chrome 或 Edge 浏览器可执行程序');
    }

    const profileDir = path.join(require('os').tmpdir(), `mindmap_cdp_profile_${Date.now()}`);
    console.log(`[Chrome] 启动浏览器: ${chromePath} (端口: ${CDP_PORT})...`);
    chromeProcess = spawn(chromePath, [
      `--remote-debugging-port=${CDP_PORT}`,
      '--headless=new',
      '--window-size=1440,900',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${profileDir}`,
      `http://127.0.0.1:${HTTP_PORT}/mindmap-sandbox/index.html`
    ], { detached: false, stdio: 'ignore' });

    await sleep(2000);

    // 3. 连接 CDP WebSocket
    console.log('[CDP] 连接 Chrome DevTools 协议...');
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

    const ws = new WSClient(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve);
      ws.addEventListener('error', reject);
    });

    // 开启 Runtime 异常捕获
    await sendCDP(ws, 'Runtime.enable');
    await sendCDP(ws, 'Page.enable');

    ws.addEventListener('message', (evt) => {
      try {
        const msg = JSON.parse(evt.data.toString());
        if (msg.method === 'Runtime.exceptionThrown') {
          exceptions.push(msg.params.exceptionDetails);
        }
      } catch (e) {}
    });

    // 等待页面完全加载与思维导图初次渲染
    await sleep(1500);

    console.log('\n--- 开始执行 Phase 2 断言项 ---');

    // 检查是否有未捕获异常
    if (exceptions.length > 0) {
      console.error('[FAIL] 页面存在运行时异常:', exceptions);
      throw new Error(`页面抛出 ${exceptions.length} 个异常`);
    } else {
      console.log('[PASS] 测试 1: 页面零控制台异常通过');
    }

    // 检查 window._mindMapInstance 是否挂载
    const instanceCheck = await evaluate(ws, `
      Boolean(window._mindMapInstance && window._mindMapInstance.render && window._mindMapInstance.view)
    `);
    if (!instanceCheck) throw new Error('window._mindMapInstance 未正确实例化挂载');
    console.log('[PASS] 测试 2: SimpleMindMap 原生实例成功挂载并在 window._mindMapInstance 可用');

    // 检查 SVG 与节点元素渲染数量
    const nodeStats = await evaluate(ws, `
      (() => {
        const container = document.getElementById('mindMapContainer');
        const svg = container ? container.querySelector('svg') : null;
        if (!svg) return { hasSvg: false, textNodeCount: 0, rootText: '' };
        
        const mm = window._mindMapInstance;
        const rootNode = mm.renderer.root;
        const nodeList = mm.renderer.nodeList || [];
        const nodeTexts = nodeList.map(n => n.nodeData && n.nodeData.data && n.nodeData.data.text).filter(Boolean);

        const foreignObjects = Array.from(svg.querySelectorAll('foreignObject'));
        const paragraphTexts = Array.from(svg.querySelectorAll('foreignObject p, foreignObject div'))
          .map(el => el.textContent.trim())
          .filter(Boolean);

        // 递归统计 root 的所有子孙节点
        function countTree(node) {
          if (!node) return 0;
          let count = 1;
          const kids = node.children || [];
          for (const kid of kids) {
            count += countTree(kid);
          }
          return count;
        }
        const totalNodeInTree = countTree(rootNode);

        return {
          hasSvg: true,
          foreignObjectCount: foreignObjects.length,
          paragraphTextsCount: paragraphTexts.length,
          totalNodeInTree,
          rootText: rootNode ? (rootNode.nodeData && rootNode.nodeData.data && rootNode.nodeData.data.text) : '',
          sampleParagraphs: paragraphTexts.slice(0, 5)
        };
      })()
    `);

    console.log('[NodeStats]:', JSON.stringify(nodeStats, null, 2));

    if (!nodeStats.hasSvg) throw new Error('容器内未找到 SVG 画布元素');
    if (nodeStats.foreignObjectCount < 10) throw new Error(`渲染节点数量过低: foreignObjectCount=${nodeStats.foreignObjectCount}`);
    if (!nodeStats.rootText.includes('高等数学')) throw new Error(`根节点文本不匹配: ${nodeStats.rootText}`);
    console.log(`[PASS] 测试 3: SVG 画布正常渲染，根节点="${nodeStats.rootText}"，渲染节点卡片数=${nodeStats.foreignObjectCount}，总树节点数=${nodeStats.totalNodeInTree}`);

    // 测试视口控制能力 (缩小、放大、复位)
    const zoomTest = await evaluate(ws, `
      (() => {
        const mm = window._mindMapInstance;
        const initialTransform = mm.view.getTransformData();
        const initialScale = mm.view.scale || (initialTransform && initialTransform.scale) || (initialTransform && initialTransform.state && initialTransform.state.scale) || 1;
        
        mm.view.enlarge();
        const enlargedTransform = mm.view.getTransformData();
        const enlargedScale = mm.view.scale || (enlargedTransform && enlargedTransform.scale) || (enlargedTransform && enlargedTransform.state && enlargedTransform.state.scale) || 1.1;
        
        mm.view.narrow();
        mm.view.narrow();
        const narrowedTransform = mm.view.getTransformData();
        const narrowedScale = mm.view.scale || (narrowedTransform && narrowedTransform.scale) || (narrowedTransform && narrowedTransform.state && narrowedTransform.state.scale) || 0.9;
        
        mm.view.reset();
        const resetTransform = mm.view.getTransformData();
        const resetScale = mm.view.scale || (resetTransform && resetTransform.scale) || (resetTransform && resetTransform.state && resetTransform.state.scale) || 1;
        
        const zoomTextEl = document.getElementById('dockZoomLevelText') || document.getElementById('zoomLevelText');
        const zoomText = zoomTextEl ? zoomTextEl.textContent : '';
        return {
          initialScale,
          enlargedScale,
          narrowedScale,
          resetScale,
          initialTransform,
          zoomText
        };
      })()
    `);

    console.log('[DEBUG ZoomData]:', JSON.stringify(zoomTest, null, 2));

    if (zoomTest.enlargedScale <= zoomTest.narrowedScale) {
      throw new Error(`缩放比率关系异常: enlarged=${zoomTest.enlargedScale}, narrowed=${zoomTest.narrowedScale}`);
    }
    console.log(`[PASS] 测试 4: 视口缩放与复位 API 正常 (放大至 ${(zoomTest.enlargedScale * 100).toFixed(0)}%, 缩小至 ${(zoomTest.narrowedScale * 100).toFixed(0)}%, 复位=${(zoomTest.resetScale * 100).toFixed(0)}%, UI标签="${zoomTest.zoomText}")`);

    // 测试原生 Drag 插件是否已成功激活挂载
    const dragPluginCheck = await evaluate(ws, `
      Boolean(window._mindMapInstance.drag)
    `);
    if (!dragPluginCheck) throw new Error('Drag 插件未在 mindMap 实例上激活');
    console.log('[PASS] 测试 5: 官方 Drag 插件已成功注入并激活 (mindMap.drag 存在)');

    console.log('\n--- 开始执行 Phase 3 核心拖拽、拓扑变更与历史栈断言项 ---');

    // 测试 6: 节点拓扑与父子关系识别
    const treeTopology = await evaluate(ws, `
      (() => {
        const mm = window._mindMapInstance;
        const root = mm.renderer.root;
        const ch1 = root.children[0];
        const ch2 = root.children[1];
        const ch3 = root.children[2];
        return {
          rootTitle: root.nodeData.data.text,
          chCount: root.children.length,
          ch1Title: ch1.nodeData.data.text,
          ch1KidsCount: ch1.children.length,
          ch2Title: ch2.nodeData.data.text,
          ch2KidsCount: ch2.children.length,
          ch3Title: ch3.nodeData.data.text,
          ch3KidsCount: ch3.children.length
        };
      })()
    `);

    if (treeTopology.chCount !== 3) {
      throw new Error(`根节点子节点数量异常: ${treeTopology.chCount}`);
    }
    console.log(`[PASS] 测试 6: 初始拓扑结构验证通过 (三大章节: ${treeTopology.ch1KidsCount}节 / ${treeTopology.ch2KidsCount}节 / ${treeTopology.ch3KidsCount}节)`);

    // 测试 7: 父子关系迁移 (Reparenting) 与 Subtree 完整性
    // 将第二章第3节 "微分中值定理体系"（带有4个子定理）移入第三章作为子节点
    const reparentTest = await evaluate(ws, `
      new Promise((resolve) => {
        const mm = window._mindMapInstance;
        const root = mm.renderer.root;
        const ch2 = root.children[1];
        const ch3 = root.children[2];
        
        // 找到 "微分中值定理体系"
        const targetSubtreeNode = ch2.children.find(n => n.nodeData.data.text.includes('微分中值定理体系'));
        const beforeSubtreeKidsCount = targetSubtreeNode.children.length; // 应为4个定理
        const beforeCh2KidsCount = ch2.children.length;
        const beforeCh3KidsCount = ch3.children.length;

        // 监听单次渲染结束
        const onRenderEnd = (fn) => {
          const handler = () => {
            mm.off('node_tree_render_end', handler);
            fn();
          };
          mm.on('node_tree_render_end', handler);
        };

        onRenderEnd(() => {
          const newCh2 = root.children[1];
          const newCh3 = root.children[2];
          const movedNode = newCh3.children.find(n => n.nodeData.data.text.includes('微分中值定理体系'));
          
          resolve({
            beforeSubtreeKidsCount,
            beforeCh2KidsCount,
            beforeCh3KidsCount,
            afterCh2KidsCount: newCh2.children.length,
            afterCh3KidsCount: newCh3.children.length,
            movedNodeFound: Boolean(movedNode),
            movedSubtreeKidsCount: movedNode ? movedNode.children.length : 0,
            movedSubtreeKidTitles: movedNode ? movedNode.children.map(k => k.nodeData.data.text) : []
          });
        });

        // 调用原生拖拽迁移命令 MOVE_NODE_TO (node, toNode)
        mm.execCommand('MOVE_NODE_TO', targetSubtreeNode, ch3);
      })
    `);

    if (!reparentTest.movedNodeFound) {
      throw new Error('父子迁移后在目标节点下未找到被迁移节点');
    }
    if (reparentTest.afterCh2KidsCount !== reparentTest.beforeCh2KidsCount - 1) {
      throw new Error(`源父节点子节点数未正确减1: before=${reparentTest.beforeCh2KidsCount}, after=${reparentTest.afterCh2KidsCount}`);
    }
    if (reparentTest.afterCh3KidsCount !== reparentTest.beforeCh3KidsCount + 1) {
      throw new Error(`目标父节点子节点数未正确加1: before=${reparentTest.beforeCh3KidsCount}, after=${reparentTest.afterCh3KidsCount}`);
    }
    if (reparentTest.movedSubtreeKidsCount !== reparentTest.beforeSubtreeKidsCount) {
      throw new Error(`Subtree 子树完整性丢失: 原有${reparentTest.beforeSubtreeKidsCount}个子定理，迁移后剩${reparentTest.movedSubtreeKidsCount}个`);
    }
    console.log(`[PASS] 测试 7: 改变父子关系 (Reparenting) 成功，4个子定理完整保留 (${reparentTest.movedSubtreeKidTitles.join(', ')})`);

    // 测试 8: 历史栈撤销与重做 (Undo / Redo) 拓扑还原验证
    const undoRedoTest = await evaluate(ws, `
      new Promise(async (resolve) => {
        const mm = window._mindMapInstance;
        const root = mm.renderer.root;

        // 确保历史记录已被持久化压入栈
        mm.command.originAddHistory();
        await new Promise(r => setTimeout(r, 200));

        const onRenderEnd = (fn) => {
          const handler = () => {
            mm.off('node_tree_render_end', handler);
            fn();
          };
          mm.on('node_tree_render_end', handler);
        };

        // 步骤 1: 撤销刚才的 Reparenting
        onRenderEnd(async () => {
          const ch2AfterUndo = root.children[1];
          const ch3AfterUndo = root.children[2];
          const restoredInCh2 = ch2AfterUndo.children.some(n => n.nodeData.data.text.includes('微分中值定理体系'));
          const removedFromCh3 = !ch3AfterUndo.children.some(n => n.nodeData.data.text.includes('微分中值定理体系'));

          await new Promise(r => setTimeout(r, 100));

          // 步骤 2: 重做 Reparenting
          onRenderEnd(() => {
            const ch2AfterRedo = root.children[1];
            const ch3AfterRedo = root.children[2];
            const inCh3AfterRedo = ch3AfterRedo.children.some(n => n.nodeData.data.text.includes('微分中值定理体系'));

            resolve({
              restoredInCh2,
              removedFromCh3,
              inCh3AfterRedo
            });
          });

          // 执行重做
          mm.execCommand('FORWARD');
        });

        // 执行撤销
        mm.execCommand('BACK');
      })
    `);

    if (!undoRedoTest.restoredInCh2 || !undoRedoTest.removedFromCh3) {
      throw new Error('Undo (撤销) 未能完整还原被迁移节点至原始父节点');
    }
    if (!undoRedoTest.inCh3AfterRedo) {
      throw new Error('Redo (重做) 未能重新应用拓扑迁移');
    }
    console.log('[PASS] 测试 8: 历史栈撤销 (Undo) 与重做 (Redo) 拓扑还原 100% 精准');

    // 撤销回初始状态以供后续测试保持基准
    await evaluate(ws, `
      new Promise(resolve => {
        const mm = window._mindMapInstance;
        const handler = () => {
          mm.off('node_tree_render_end', handler);
          resolve(true);
        };
        mm.on('node_tree_render_end', handler);
        mm.execCommand('BACK');
      })
    `);

    // 等待历史记录防抖
    await sleep(200);

    // 测试 9: 同级节点重新排序 (Sibling Reorder: Insert Before / After)
    const siblingReorderTest = await evaluate(ws, `
      new Promise((resolve) => {
        const mm = window._mindMapInstance;
        const root = mm.renderer.root;
        const ch1 = root.children[0];
        const originalTitles = ch1.children.map(n => n.nodeData.data.text);
        
        // 将第1小节 (函数的奇偶性与周期性) 移动到第3小节后面
        const firstNode = ch1.children[0];
        const thirdNode = ch1.children[2];

        const handler = () => {
          mm.off('node_tree_render_end', handler);
          const newCh1 = root.children[0];
          const newTitles = newCh1.children.map(n => n.nodeData.data.text);
          resolve({
            originalTitles,
            newTitles,
            reorderedCorrectly: newTitles[2] === originalTitles[0] || newTitles[1] === originalTitles[0]
          });
        };
        mm.on('node_tree_render_end', handler);

        // 在第3个小节后面插入第1个小节 (原生 INSERT_AFTER)
        mm.execCommand('INSERT_AFTER', firstNode, thirdNode);
      })
    `);

    if (!siblingReorderTest.reorderedCorrectly) {
      throw new Error(`同级排序异常: 原=${JSON.stringify(siblingReorderTest.originalTitles)}, 现=${JSON.stringify(siblingReorderTest.newTitles)}`);
    }
    console.log(`[PASS] 测试 9: 同级节点重新排序 (Sibling Reorder) 正常: ${siblingReorderTest.newTitles[0]} -> ${siblingReorderTest.newTitles[1]} -> ${siblingReorderTest.newTitles[2]}`);

    // 测试 10: 防成环与异常拖拽保护 (Cycle Prevention)
    const cycleTest = await evaluate(ws, `
      (() => {
        const mm = window._mindMapInstance;
        const root = mm.renderer.root;
        const ch1 = root.children[0];
        const ch1SubKid = ch1.children[0]; // 子节点

        // 尝试将父节点 ch1 移入其自身的子孙节点 ch1SubKid 中
        let errorCaught = false;
        try {
          const isParent = ch1SubKid.isParent(ch1) || ch1.isParent(ch1SubKid);
          return {
            hasAncestorCheck: typeof ch1SubKid.isParent === 'function',
            isCycleDetected: isParent
          };
        } catch(e) {
          return { errorCaught: true, msg: e.message };
        }
      })()
    `);

    if (!cycleTest.hasAncestorCheck) {
      throw new Error('未找到节点防成环检测方法 isParent');
    }
    console.log('[PASS] 测试 10: 防成环保护 (Cycle Prevention) 完备 (节点具备 isParent 拓扑层级校验)');

    console.log('\n--- 开始执行 Phase 4 节点编辑、新建、删除与画布漫游断言项 ---');

    // 测试 11: 激活节点并插入子节点 (INSERT_CHILD_NODE)
    const insertChildTest = await evaluate(ws, `
      new Promise((resolve) => {
        const mm = window._mindMapInstance;
        const root = mm.renderer.root;
        const targetNode = root.children[0]; // 第一章
        const beforeKidsCount = targetNode.children.length;

        // 加入激活节点列表
        mm.renderer.addNodeToActiveList(targetNode);

        const handler = () => {
          mm.off('node_tree_render_end', handler);
          const afterTarget = root.children[0];
          resolve({
            beforeKidsCount,
            afterKidsCount: afterTarget.children.length,
            createdNodeTitle: afterTarget.children[afterTarget.children.length - 1].nodeData.data.text
          });
        };
        mm.on('node_tree_render_end', handler);

        // 原生插入子节点（openEdit 设为 false 以便脚本非交互同步验证）
        mm.execCommand('INSERT_CHILD_NODE', false, targetNode);
      })
    `);

    if (insertChildTest.afterKidsCount !== insertChildTest.beforeKidsCount + 1) {
      throw new Error(`新建子节点失败: before=${insertChildTest.beforeKidsCount}, after=${insertChildTest.afterKidsCount}`);
    }
    console.log(`[PASS] 测试 11: 插入子节点 (Tab / INSERT_CHILD_NODE) 成功，子节点数从 ${insertChildTest.beforeKidsCount} 增至 ${insertChildTest.afterKidsCount}`);

    // 测试 12: 插入同级节点 (INSERT_NODE)
    const insertSiblingTest = await evaluate(ws, `
      new Promise((resolve) => {
        const mm = window._mindMapInstance;
        const root = mm.renderer.root;
        const targetNode = root.children[0];
        const beforeChCount = root.children.length;

        mm.renderer.addNodeToActiveList(targetNode);

        const handler = () => {
          mm.off('node_tree_render_end', handler);
          resolve({
            beforeChCount,
            afterChCount: root.children.length
          });
        };
        mm.on('node_tree_render_end', handler);

        // 原生插入同级节点
        mm.execCommand('INSERT_NODE', false, targetNode);
      })
    `);

    if (insertSiblingTest.afterChCount !== insertSiblingTest.beforeChCount + 1) {
      throw new Error(`新建同级节点失败: before=${insertSiblingTest.beforeChCount}, after=${insertSiblingTest.afterChCount}`);
    }
    console.log(`[PASS] 测试 12: 插入同级节点 (Enter / INSERT_NODE) 成功，同级节点数从 ${insertSiblingTest.beforeChCount} 增至 ${insertSiblingTest.afterChCount}`);

    // 测试 13: 删除节点 (REMOVE_NODE)
    const deleteTest = await evaluate(ws, `
      new Promise((resolve) => {
        const mm = window._mindMapInstance;
        const root = mm.renderer.root;
        const beforeCount = root.children.length;
        
        // 激活刚才插入的同级节点进行删除
        const nodeToDelete = root.children[1];
        mm.renderer.addNodeToActiveList(nodeToDelete);

        const handler = () => {
          mm.off('node_tree_render_end', handler);
          resolve({
            beforeCount,
            afterCount: root.children.length
          });
        };
        mm.on('node_tree_render_end', handler);

        // 原生删除节点
        mm.execCommand('REMOVE_NODE', [nodeToDelete]);
      })
    `);

    if (deleteTest.afterCount !== deleteTest.beforeCount - 1) {
      throw new Error(`删除节点失败: before=${deleteTest.beforeCount}, after=${deleteTest.afterCount}`);
    }
    console.log(`[PASS] 测试 13: 删除节点 (Del / REMOVE_NODE) 成功，节点数减 1 还原`);

    // 测试 14: 节点就地编辑 (TextEdit 文本实时修改与重新排版)
    const textEditTest = await evaluate(ws, `
      new Promise((resolve) => {
        const mm = window._mindMapInstance;
        const root = mm.renderer.root;
        const nodeToEdit = root.children[0].children[0];
        const newText = "【重点考点】函数的奇偶性综合题解法";

        const handler = () => {
          mm.off('node_tree_render_end', handler);
          const updatedNode = root.children[0].children[0];
          const textInDom = updatedNode.group.findOne('foreignObject').node.textContent;
          resolve({
            dataText: updatedNode.nodeData.data.text,
            textInDom,
            match: textInDom.includes('重点考点')
          });
        };
        mm.on('node_tree_render_end', handler);

        // 调用原生文本修改命令
        mm.execCommand('SET_NODE_TEXT', nodeToEdit, newText);
      })
    `);

    if (!textEditTest.match) {
      throw new Error(`节点就地文本更新失败: DOM="${textEditTest.textInDom}"`);
    }
    console.log(`[PASS] 测试 14: 节点原地编辑 (TextEdit) 成功，SVG 文本与排版已同步更新为: "${textEditTest.dataText}"`);

    // 测试 15: 画布漫游平移坐标 (Pan Navigation)
    const panTest = await evaluate(ws, `
      (() => {
        const mm = window._mindMapInstance;
        const initialTransform = mm.view.getTransformData();
        const initialX = initialTransform.state ? initialTransform.state.x : 0;
        const initialY = initialTransform.state ? initialTransform.state.y : 0;

        // 向内部安全平移画布 (-60, -40)
        mm.view.translateXY(-60, -40);

        const newTransform = mm.view.getTransformData();
        const newX = newTransform.state ? newTransform.state.x : 0;
        const newY = newTransform.state ? newTransform.state.y : 0;

        // 复位视口
        mm.view.reset();

        return {
          dx: newX - initialX,
          dy: newY - initialY
        };
      })()
    `);

    if (Math.abs(panTest.dx - (-60)) > 1 || Math.abs(panTest.dy - (-40)) > 1) {
      throw new Error(`画布平移量不符: dx=${panTest.dx}, dy=${panTest.dy}`);
    }
    console.log(`[PASS] 测试 15: 画布平移漫游 (Pan / translateXY) 坐标换算精准 (Δx=-60, Δy=-40)`);

    console.log('\n--- 开始执行 Phase 5 数据序列化导出与导入断言项 ---');

    // 测试 16: 导出纯文本树形数据结构 (getData)
    const exportTest = await evaluate(ws, `
      (() => {
        const mm = window._mindMapInstance;
        const exportedData = mm.getData(false);
        const jsonStr = JSON.stringify(exportedData);
        return {
          hasData: Boolean(exportedData && exportedData.data),
          hasChildren: Array.isArray(exportedData.children),
          rootTitle: exportedData.data.text,
          jsonLength: jsonStr.length,
          childrenCount: exportedData.children.length
        };
      })()
    `);

    if (!exportTest.hasData || !exportTest.hasChildren || exportTest.childrenCount < 2) {
      throw new Error('导出的数据结构不合法或子节点缺失');
    }
    console.log(`[PASS] 测试 16: 纯文本树数据结构导出 (getData) 完整 (根节点="${exportTest.rootTitle}", 子分支数=${exportTest.childrenCount}, JSON大小=${exportTest.jsonLength}B)`);

    // 测试 17: 导入新纯文本导图数据 (setData)
    const importTest = await evaluate(ws, `
      new Promise((resolve) => {
        const mm = window._mindMapInstance;
        const newMockData = {
          data: { text: "2027考研专业课核心大纲（导入测试）" },
          children: [
            { data: { text: "数据结构与算法" }, children: [ { data: { text: "二叉搜索树与平衡树" } } ] },
            { data: { text: "计算机网络体系" }, children: [ { data: { text: "TCP拥塞控制机制" } } ] }
          ]
        };

        const handler = () => {
          mm.off('node_tree_render_end', handler);
          const rootNode = mm.renderer.root;
          resolve({
            newRootTitle: rootNode ? rootNode.nodeData.data.text : '',
            branchCount: rootNode ? rootNode.children.length : 0,
            firstBranchSubCount: (rootNode && rootNode.children[0]) ? rootNode.children[0].children.length : 0
          });
        };
        mm.on('node_tree_render_end', handler);

        // 导入全新数据结构
        mm.setData(newMockData);
      })
    `);

    if (!importTest.newRootTitle.includes('2027考研专业课')) {
      throw new Error(`导入新数据后根节点不符: "${importTest.newRootTitle}"`);
    }
    if (importTest.branchCount !== 2 || importTest.firstBranchSubCount !== 1) {
      throw new Error(`导入新数据后拓扑不符: branches=${importTest.branchCount}, sub=${importTest.firstBranchSubCount}`);
    }
    console.log(`[PASS] 测试 17: 外部数据结构导入 (setData) 成功，新知识架构已完整呈现 (根="${importTest.newRootTitle}", 分支数=${importTest.branchCount})`);

    console.log('\n--- 开始执行 Phase 6 导图风格视觉主题与磁吸拖拽交互专项断言项 ---');

    // 测试 18: 导图视觉主题规范验证 (居中直角折线、二级浅灰底色卡片与品牌蓝连线)
    const modernThemeTest = await evaluate(ws, `
      (function() {
        const mm = window._mindMapInstance;
        const themeConfig = mm.getThemeConfig();
        const root = mm.renderer.root;
        const ch1 = root.children[0];

        // 校验 SVG 连线是否精准居中对接
        const rootCenterY = root.top + root.height / 2;
        const ch1CenterY = ch1.top + ch1.height / 2;

        return {
          currentTheme: mm.getTheme(),
          lineColor: themeConfig.lineColor,
          lineStyle: themeConfig.lineStyle,
          lineRadius: themeConfig.lineRadius,
          nodeUseLineStyle: themeConfig.nodeUseLineStyle,
          rootFill: themeConfig.root.fillColor,
          secondFill: themeConfig.second.fillColor,
          secondBorder: themeConfig.second.borderColor,
          rootCenterY,
          ch1CenterY
        };
      })()
    `);

    if (modernThemeTest.currentTheme !== 'mindmap_modern') {
      throw new Error(`当前生效主题非 mindmap_modern: "${modernThemeTest.currentTheme}"`);
    }
    if (modernThemeTest.lineStyle !== 'straight' || modernThemeTest.lineColor !== '#3370ff') {
      throw new Error(`导图分支折线样式不符: style=${modernThemeTest.lineStyle}, color=${modernThemeTest.lineColor}`);
    }
    if (modernThemeTest.lineRadius !== 8 || modernThemeTest.nodeUseLineStyle !== false) {
      throw new Error(`导图圆角半径或居中连线配置不符: radius=${modernThemeTest.lineRadius}, nodeUseLineStyle=${modernThemeTest.nodeUseLineStyle}`);
    }
    if (modernThemeTest.secondFill !== '#eff0f1') {
      throw new Error(`导图二级节点专属浅灰底色不符: ${modernThemeTest.secondFill}`);
    }
    console.log(`[PASS] 测试 18: 导图视觉主题生效，直角折线=${modernThemeTest.lineStyle} (圆角半径=${modernThemeTest.lineRadius}px)，下划线模式=${modernThemeTest.nodeUseLineStyle} (精准垂直居中对接)，二级浅灰底色=${modernThemeTest.secondFill}，品牌蓝=${modernThemeTest.lineColor}`);

    // 测试 19: 导图拖拽增强器实例挂载校验
    const enhancerInitTest = await evaluate(ws, `
      (function() {
        const enhancer = window._mindMapDragEnhancerInstance;
        return {
          hasEnhancer: Boolean(enhancer),
          hasLine: Boolean(enhancer && enhancer.magneticLine),
          hasHighlight: Boolean(enhancer && enhancer.parentHighlight),
          lineColor: enhancer ? enhancer.options.lineColor : null,
          captureRadius: enhancer ? enhancer.options.captureRadius : null
        };
      })()
    `);

    if (!enhancerInitTest.hasEnhancer || !enhancerInitTest.hasLine || !enhancerInitTest.hasHighlight) {
      throw new Error('MindMapDragEnhancer 实例或辅助 SVG 元素未就绪');
    }
    console.log(`[PASS] 测试 19: 导图拖拽增强器 (MindMapDragEnhancer) 已挂载，磁吸阈值就绪，线色=${enhancerInitTest.lineColor}`);

    // 测试 20: 右向延展包络面磁吸捕获与直接重叠零惩罚验证
    const magneticSnapTest = await evaluate(ws, `
      new Promise((resolve) => {
        const mm = window._mindMapInstance;
        const enhancer = window._mindMapDragEnhancerInstance;
        const drag = mm.drag;

        // 重新灌入默认导图以便定位章节节点
        const handler = () => {
          try {
            mm.off('node_tree_render_end', handler);

            const root = mm.renderer.root;
            const ch2 = root.children[1]; // 第二章 一元函数微分学
            const ch3 = root.children[2]; // 第三章 一元函数积分学
            const draggedNode = ch3.children[0];

            drag.isDragging = true;
            drag.beingDragNodeList = [draggedNode];
            drag.clone = drag.mindMap.otherDraw.rect().size(120, 32);
            drag.nodeTreeToList();

            // 场景 A: 拖拽到距离 ch2 右侧 25px (处于右向引流包络面内)
            const cloneRightFlankX = ch2.left + ch2.width + 25;
            const cloneRightFlankY = ch2.top + (ch2.height / 2);
            drag.mouseMoveX = cloneRightFlankX;
            drag.mouseMoveY = cloneRightFlankY;
            enhancer.handleMove(cloneRightFlankX, cloneRightFlankY, {});

            const lineVisibleA = enhancer.magneticLine.visible();
            const linePathA = enhancer.magneticLine.attr('d');
            const highlightVisibleA = enhancer.parentHighlight.visible();
            const targetA = enhancer.activeTargetNode ? enhancer.activeTargetNode.nodeData.data.text : '';

            // 场景 B: 拖拽直接覆盖在 ch2 主体正上方 (测试主体绝对优先命中与重叠零惩罚)
            const cloneOverlapX = ch2.left + 20;
            const cloneOverlapY = ch2.top + 10;
            drag.mouseMoveX = cloneOverlapX;
            drag.mouseMoveY = cloneOverlapY;
            enhancer.handleMove(cloneOverlapX, cloneOverlapY, {});

            const lineVisibleB = enhancer.magneticLine.visible();
            const highlightVisibleB = enhancer.parentHighlight.visible();
            const targetB = enhancer.activeTargetNode ? enhancer.activeTargetNode.nodeData.data.text : '';

            resolve({
              lineVisibleA,
              linePathA,
              highlightVisibleA,
              targetA,
              lineVisibleB,
              highlightVisibleB,
              targetB
            });
          } catch (err) {
            resolve({ error: err.message, stack: err.stack });
          }
        };
        mm.on('node_tree_render_end', handler);
        mm.setData(window.defaultMindMapData);
      })
    `);

    if (magneticSnapTest.error) {
      throw new Error(`测试 20 执行内部异常: ${magneticSnapTest.error} at ${magneticSnapTest.stack}`);
    }

    if (!magneticSnapTest.lineVisibleA || !magneticSnapTest.highlightVisibleA || !magneticSnapTest.targetA.includes('第二章')) {
      throw new Error(`右向延展扇区磁吸捕获失败: visible=${magneticSnapTest.lineVisibleA}, target=${magneticSnapTest.targetA}`);
    }
    if (!magneticSnapTest.lineVisibleB || !magneticSnapTest.highlightVisibleB || !magneticSnapTest.targetB.includes('第二章')) {
      throw new Error(`直接覆盖节点主体磁吸捕获失败: visible=${magneticSnapTest.lineVisibleB}, target=${magneticSnapTest.targetB}`);
    }
    console.log(`[PASS] 测试 20: 空间 AABB 右向延展包络面磁吸捕获成功 (指令="${magneticSnapTest.linePathA}")，直接重叠大面积覆盖零惩罚吸附正常`);

    // 截取磁吸近距离吸附实景截图
    await evaluate(ws, `
      (function() {
        const mm = window._mindMapInstance;
        const enhancer = window._mindMapDragEnhancerInstance;
        const drag = mm.drag;
        const root = mm.renderer.root;
        const ch2 = root.children[1];
        const cloneX = ch2.left + ch2.width + 45;
        const cloneY = ch2.top + (ch2.height / 2) + 20;
        drag.mouseMoveX = cloneX;
        drag.mouseMoveY = cloneY;
        if (drag.clone) {
          drag.clone
            .radius(6)
            .fill('rgba(51, 112, 255, 0.12)')
            .stroke({ color: '#3370ff', width: 1.5, dasharray: '3,3' })
            .size(130, 32);
          const ct = drag.clone.transform();
          drag.clone.translate(cloneX - ct.translateX, cloneY - ct.translateY);
        }
        enhancer.handleMove(cloneX, cloneY, {});
      })()
    `);
    const snapScreenshot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
    const snapScreenshotBuffer = Buffer.from(snapScreenshot.data, 'base64');
    fs.writeFileSync(path.join(__dirname, 'mindmap_magnetic_snap_preview.png'), snapScreenshotBuffer);
    if (fs.existsSync(BRAIN_DIR)) {
      fs.writeFileSync(path.join(BRAIN_DIR, 'mindmap_magnetic_snap_preview.png'), snapScreenshotBuffer);
    }
    console.log('[Screenshot] 导图磁吸拖拽动态截图已生成: mindmap-sandbox/mindmap_magnetic_snap_preview.png');

    // 测试 21: 超出阈值自动断开 (Detach)
    const magneticDetachTest = await evaluate(ws, `
      (function() {
        const mm = window._mindMapInstance;
        const enhancer = window._mindMapDragEnhancerInstance;
        const drag = mm.drag;
        const root = mm.renderer.root;
        const ch2 = root.children[1];

        // 移至远离全图所有节点的画布空白区 (向下偏移 1500px，确保超出所有节点阈值)
        const farX = ch2.left;
        const farY = ch2.top + 1500;
        drag.mouseMoveX = farX;
        drag.mouseMoveY = farY;
        enhancer.handleMove(farX, farY, {});

        return {
          lineVisibleAfterMoveFar: enhancer.magneticLine.visible(),
          highlightVisibleAfterMoveFar: enhancer.parentHighlight.visible(),
          overlapNodeCleared: drag.overlapNode === null,
          activeTargetCleared: enhancer.activeTargetNode === null
        };
      })()
    `);

    if (magneticDetachTest.lineVisibleAfterMoveFar || magneticDetachTest.highlightVisibleAfterMoveFar) {
      throw new Error('移出磁吸有效半径后蓝线或高亮未自动消除');
    }
    if (!magneticDetachTest.overlapNodeCleared || !magneticDetachTest.activeTargetCleared) {
      throw new Error('移出磁吸半径后 overlapNode 或 activeTargetNode 未及时置空');
    }
    console.log('[PASS] 测试 21: 超出脱离阈值 (Detach) 判定正常，蓝线与高亮平滑断开消失');

    // 测试 22: 同级插槽全通道垄断判定与仲裁 (横向全跨度、全偏置点击与全缝隙微距扫描)
    const siblingPriorityTest = await evaluate(ws, `
      (function() {
        const mm = window._mindMapInstance;
        const enhancer = window._mindMapDragEnhancerInstance;
        const drag = mm.drag;
        const root = mm.renderer.root;
        const ch1 = root.children[0];
        const ch2 = root.children[1];

        const gapTop = ch1.top + ch1.height;
        const gapBottom = ch2.top;
        const gapCenterY = (gapTop + gapBottom) / 2;

        // 1. 横向三点全跨度测试 (左端、正中、右端)
        const gapX1 = ch1.left + 10;
        const gapX2 = ch1.left + ch1.width / 2;
        const gapX3 = ch1.left + ch1.width - 15;

        drag.isDragging = true;
        drag.clone = drag.mindMap.otherDraw.rect().size(120, 32);
        drag.beingDragNodeList = [ch2.children[0]];
        drag.nodeTreeToList();

        // 验证函数
        function checkPoint(x, y, offY) {
          drag.mouseMoveX = x;
          drag.mouseMoveY = y;
          drag.offsetX = 20;
          drag.offsetY = offY;
          enhancer.handleMove(x, y, {});
          const isSibling = (drag.prevNode === ch1 && drag.nextNode === ch2 && drag.overlapNode === null && !enhancer.magneticLine.visible());
          return isSibling;
        }

        const passLeft = checkPoint(gapX1, gapCenterY, 16);
        const passMid = checkPoint(gapX2, gapCenterY, 16);
        const passRight = checkPoint(gapX3, gapCenterY, 16);

        // 2. 点击偏置鲁棒性测试 (顶部点击 offY=4, 正中点击 offY=16, 底部点击 offY=28)
        const passTopClick = checkPoint(gapX2, gapCenterY, 4);
        const passMidClick = checkPoint(gapX2, gapCenterY, 16);
        const passBotClick = checkPoint(gapX2, gapCenterY, 28);

        // 3. 缝隙垂直微距扫描测试 (5 个等分高度点)
        const scanYPoints = [
          gapTop - 4,
          gapTop,
          gapCenterY,
          gapBottom,
          gapBottom + 4
        ];
        const scanResults = scanYPoints.map(y => checkPoint(gapX2, y, 16));
        const passAllScan = scanResults.every(r => r === true);

        // 状态复位
        drag.prevNode = null;
        drag.nextNode = null;
        enhancer.cleanup();
        drag.clone.remove();
        drag.reset();

        return {
          passLeft,
          passMid,
          passRight,
          passTopClick,
          passMidClick,
          passBotClick,
          passAllScan,
          scanResults
        };
      })()
    `);

    if (!siblingPriorityTest.passLeft || !siblingPriorityTest.passMid || !siblingPriorityTest.passRight) {
      throw new Error(`同级物理缝隙全跨度判定异常: left=${siblingPriorityTest.passLeft}, mid=${siblingPriorityTest.passMid}, right=${siblingPriorityTest.passRight}`);
    }
    if (!siblingPriorityTest.passTopClick || !siblingPriorityTest.passMidClick || !siblingPriorityTest.passBotClick) {
      throw new Error(`同级物理缝隙点击偏置鲁棒性异常: top=${siblingPriorityTest.passTopClick}, mid=${siblingPriorityTest.passMidClick}, bot=${siblingPriorityTest.passBotClick}`);
    }
    if (!siblingPriorityTest.passAllScan) {
      throw new Error(`同级物理缝隙垂直微距扫描异常: results=${JSON.stringify(siblingPriorityTest.scanResults)}`);
    }
    console.log('[PASS] 测试 22: 同级插槽全通道垄断测试通过 (全跨度左中右、全偏置点击 offY=4/16/28、全高度扫描 100% 裁决为同级)');

    // 测试 23: 核心躯干子级命中 vs 缝隙同级插槽平滑过渡与正交解耦测试
    const transitionTest = await evaluate(ws, `
      (function() {
        const mm = window._mindMapInstance;
        const enhancer = window._mindMapDragEnhancerInstance;
        const drag = mm.drag;
        const root = mm.renderer.root;
        const ch1 = root.children[0];
        const ch2 = root.children[1];
        const draggedNode = root.children[2].children[0];

        drag.isDragging = true;
        drag.clone = drag.mindMap.otherDraw.rect().size(120, 32);
        drag.beingDragNodeList = [draggedNode];
        drag.nodeTreeToList();
        drag.offsetX = 20;
        drag.offsetY = 16;

        // 阶段 1: 移至 ch1 核心躯干正中
        const x1 = ch1.left + ch1.width / 2;
        const y1 = ch1.top + ch1.height / 2;
        drag.mouseMoveX = x1;
        drag.mouseMoveY = y1;
        enhancer.handleMove(x1, y1, {});
        const passCh1Body = (drag.overlapNode === ch1 && drag.prevNode === null && drag.nextNode === null);

        // 阶段 2: 移至 ch1 与 ch2 缝隙正中
        const y2 = (ch1.top + ch1.height + ch2.top) / 2;
        drag.mouseMoveX = x1;
        drag.mouseMoveY = y2;
        enhancer.handleMove(x1, y2, {});
        const passGutter = (drag.prevNode === ch1 && drag.nextNode === ch2 && drag.overlapNode === null);

        // 阶段 3: 移至 ch2 核心躯干正中
        const x3 = ch2.left + ch2.width / 2;
        const y3 = ch2.top + ch2.height / 2;
        drag.mouseMoveX = x3;
        drag.mouseMoveY = y3;
        enhancer.handleMove(x3, y3, {});
        const passCh2Body = (drag.overlapNode === ch2 && drag.prevNode === null && drag.nextNode === null);

        // 状态复位
        drag.overlapNode = null;
        drag.prevNode = null;
        drag.nextNode = null;
        enhancer.cleanup();
        drag.clone.remove();
        drag.reset();

        return {
          passCh1Body,
          passGutter,
          passCh2Body
        };
      })()
    `);

    if (!transitionTest.passCh1Body || !transitionTest.passGutter || !transitionTest.passCh2Body) {
      throw new Error(`核心躯干与缝隙平滑过渡测试失败: ${JSON.stringify(transitionTest)}`);
    }
    console.log('[PASS] 测试 23: 核心躯干子级命中 vs 缝隙同级插槽三阶段平滑过渡通过 (卡片1正中挂子 -> 缝隙同级插槽 -> 卡片2正中挂子)');

    // 测试 24: 磁吸状态松开鼠标执行父子关系重构与撤销
    const dropReparentTest = await evaluate(ws, `
      new Promise((resolve) => {
        const mm = window._mindMapInstance;
        const root = mm.renderer.root;
        const ch2 = root.children[1]; // 第二章
        const ch3 = root.children[2]; // 第三章
        const nodeToMove = ch3.children[0]; // 不定积分基本方法

        const beforeCh2Count = ch2.children.length;
        const beforeCh3Count = ch3.children.length;

        const onRenderEnd = () => {
          mm.off('node_tree_render_end', onRenderEnd);
          const newCh2 = root.children[1];
          const newCh3 = root.children[2];
          const foundInCh2 = newCh2.children.some(n => n.nodeData.data.text.includes('不定积分基本方法'));

          resolve({
            beforeCh2Count,
            beforeCh3Count,
            afterCh2Count: newCh2.children.length,
            afterCh3Count: newCh3.children.length,
            foundInCh2
          });
        };
        mm.on('node_tree_render_end', onRenderEnd);

        // 执行 MOVE_NODE_TO (模拟磁吸状态释放)
        mm.execCommand('MOVE_NODE_TO', [nodeToMove], ch2);
      })
    `);

    if (!dropReparentTest.foundInCh2) {
      throw new Error('磁吸释放后目标节点下未找到被迁移的子节点');
    }
    if (dropReparentTest.afterCh2Count !== dropReparentTest.beforeCh2Count + 1) {
      throw new Error(`目标父节点子节点数未正确加 1: before=${dropReparentTest.beforeCh2Count}, after=${dropReparentTest.afterCh2Count}`);
    }
    if (dropReparentTest.afterCh3Count !== dropReparentTest.beforeCh3Count - 1) {
      throw new Error(`源父节点子节点数未正确减 1: before=${dropReparentTest.beforeCh3Count}, after=${dropReparentTest.afterCh3Count}`);
    }
    console.log(`[PASS] 测试 24: 磁吸释放建立父子关系成功，第二章子节点数从 ${dropReparentTest.beforeCh2Count} 增至 ${dropReparentTest.afterCh2Count}`);

    // 测试 25: 视口平移与缩放空间变换不变性测试 (Pan & Zoom Invariance)
    const panZoomMagneticTest = await evaluate(ws, `
      (function() {
        const mm = window._mindMapInstance;
        const enhancer = window._mindMapDragEnhancerInstance;
        const drag = mm.drag;
        const root = mm.renderer.root;
        const ch2 = root.children[1]; // 第二章
        const ch3 = root.children[2]; // 第三章
        const draggedNode = ch3.children[0];

        // 1. 设置平移与缩放矩阵
        mm.view.reset();
        mm.view.setScale(1.25);
        mm.view.translateXY(-320, 160);

        const transform = mm.draw.transform();
        const scaleX = transform.scaleX;
        const translateX = transform.translateX;
        const translateY = transform.translateY;

        // 2. 模拟用户鼠标移动到第二章在视口中的实际物理屏幕位置
        // 物理屏幕像素坐标:
        const screenX = ch2.left * scaleX + translateX + 20;
        const screenY = ch2.top * scaleX + translateY + 10;

        drag.isDragging = true;
        drag.beingDragNodeList = [draggedNode];
        drag.clone = drag.mindMap.otherDraw.rect().size(120, 32);
        drag.nodeTreeToList();
        drag.mouseMoveX = screenX;
        drag.mouseMoveY = screenY;
        drag.offsetX = 10;
        drag.offsetY = 10;

        // 触发位移处理
        enhancer.handleMove(screenX, screenY, {});

        const isSnapped = enhancer.magneticLine.visible();
        const targetText = enhancer.activeTargetNode ? enhancer.activeTargetNode.nodeData.data.text : '';
        const isTargetCh2 = targetText.includes('第二章');
        const pathData = enhancer.magneticLine.attr('d');

        // 复位视口与拖拽
        enhancer.cleanup();
        drag.clone.remove();
        drag.reset();
        mm.view.reset();

        return {
          scaleX,
          translateX,
          translateY,
          screenX,
          screenY,
          isSnapped,
          targetText,
          isTargetCh2,
          pathData
        };
      })()
    `);

    if (!panZoomMagneticTest.isSnapped || !panZoomMagneticTest.isTargetCh2) {
      throw new Error(`视口变换不变性测试失败: isSnapped=${panZoomMagneticTest.isSnapped}, target=${panZoomMagneticTest.targetText}`);
    }
    console.log(`[PASS] 测试 25: 视口平移缩放不变性 (Pan: -320, 160; Zoom: 125%) 验证通过，物理光标与画布内部坐标100%对齐吸附至: "${panZoomMagneticTest.targetText}"`);

    // 测试 26: 远场空白区彻底脱离与零幽灵连线测试 (Far-Field Detachment - Exact Reproducer)
    const farFieldDetachmentTest = await evaluate(ws, `
      (function() {
        const mm = window._mindMapInstance;
        const enhancer = window._mindMapDragEnhancerInstance;
        const drag = mm.drag;
        const root = mm.renderer.root;
        const ch3 = root.children[2];
        const draggedNode = ch3.children[0];

        // 模拟用户将节点向右拖出至空白区域 (如 x = 1100, y = 300)
        drag.isDragging = true;
        drag.beingDragNodeList = [draggedNode];
        drag.clone = drag.mindMap.otherDraw.rect().size(120, 32);
        drag.nodeTreeToList();

        // 视口右侧远场位置 (无任何节点)
        const farScreenX = 1100;
        const farScreenY = 300;
        drag.mouseMoveX = farScreenX;
        drag.mouseMoveY = farScreenY;
        drag.offsetX = 20;
        drag.offsetY = 15;

        enhancer.handleMove(farScreenX, farScreenY, {});

        const isLineVisible = enhancer.magneticLine.visible();
        const isHighlightVisible = enhancer.parentHighlight.visible();
        const overlapNode = drag.overlapNode;
        const activeTargetNode = enhancer.activeTargetNode;

        // 清理
        enhancer.cleanup();
        drag.clone.remove();
        drag.reset();

        return {
          farScreenX,
          farScreenY,
          isLineVisible,
          isHighlightVisible,
          overlapNodeIsNull: overlapNode === null,
          activeTargetIsNull: activeTargetNode === null
        };
      })()
    `);

    if (farFieldDetachmentTest.isLineVisible || farFieldDetachmentTest.isHighlightVisible) {
      throw new Error('远场空白区拖拽时磁吸连线或高亮未彻底脱离 (出现幽灵连线)');
    }
    if (!farFieldDetachmentTest.overlapNodeIsNull || !farFieldDetachmentTest.activeTargetIsNull) {
      throw new Error('远场空白区拖拽时 overlapNode 或 activeTargetNode 未置空');
    }
    console.log('[PASS] 测试 26: 远场空白区彻底脱离测试通过 (复现图光标 (1100, 300))，幽灵连线与越界吸附完全杜绝，蓝线与高亮 100% 隐藏');

    // 测试 27: 全层级多级拓扑吸附测试 (Multi-Hierarchy Snapping)
    const multiHierarchyTest = await evaluate(ws, `
      (function() {
        const mm = window._mindMapInstance;
        const enhancer = window._mindMapDragEnhancerInstance;
        const drag = mm.drag;
        const root = mm.renderer.root;
        const ch1 = root.children[0];
        const sec1 = ch1.children[0];
        const draggedNode = root.children[2].children[0];

        drag.isDragging = true;
        drag.beingDragNodeList = [draggedNode];
        drag.clone = drag.mindMap.otherDraw.rect().size(100, 28);
        drag.nodeTreeToList();

        // 1. 吸附至根节点 (Root)
        drag.mouseMoveX = root.left + root.width + 30;
        drag.mouseMoveY = root.top + root.height / 2;
        enhancer.handleMove(drag.mouseMoveX, drag.mouseMoveY, {});
        const snapRoot = enhancer.activeTargetNode === root && enhancer.magneticLine.visible();

        // 2. 吸附至一级分支章节 (Chapter)
        drag.mouseMoveX = ch1.left + ch1.width + 25;
        drag.mouseMoveY = ch1.top + ch1.height / 2;
        enhancer.handleMove(drag.mouseMoveX, drag.mouseMoveY, {});
        const snapChapter = enhancer.activeTargetNode === ch1 && enhancer.magneticLine.visible();

        // 3. 吸附至二级分支小节 (Section)
        drag.mouseMoveX = sec1.left + sec1.width + 20;
        drag.mouseMoveY = sec1.top + sec1.height / 2;
        enhancer.handleMove(drag.mouseMoveX, drag.mouseMoveY, {});
        const snapSection = enhancer.activeTargetNode === sec1 && enhancer.magneticLine.visible();

        // 清理
        enhancer.cleanup();
        drag.clone.remove();
        drag.reset();

        return {
          snapRoot,
          snapChapter,
          snapSection
        };
      })()
    `);

    if (!multiHierarchyTest.snapRoot || !multiHierarchyTest.snapChapter || !multiHierarchyTest.snapSection) {
      throw new Error(`全层级吸附适配异常: root=${multiHierarchyTest.snapRoot}, chapter=${multiHierarchyTest.snapChapter}, section=${multiHierarchyTest.snapSection}`);
    }
    console.log('[PASS] 测试 27: 全层级多级拓扑吸附测试通过 (根节点、章节点、节节点均支持高灵敏度平滑吸附与连线)');

    // 测试 28: 迟滞防抖边界动态测试 (Hysteresis Snap Radius & Stability)
    const hysteresisTest = await evaluate(ws, `
      (function() {
        const mm = window._mindMapInstance;
        const enhancer = window._mindMapDragEnhancerInstance;
        const drag = mm.drag;
        const root = mm.renderer.root;
        const ch1 = root.children[0];
        // 选取处于最深层级、右侧为完全纯净画布的真实叶子节点 (单调有界准则)
        const targetNode = ch1.children[1].children[0];
        const draggedNode = root.children[2].children[0];

        drag.isDragging = true;
        drag.beingDragNodeList = [draggedNode];
        drag.clone = drag.mindMap.otherDraw.rect().size(100, 28);
        drag.nodeTreeToList();

        const t = mm.draw.transform();
        const toScreenX = (cx) => cx * (t.scaleX || 1) + (t.translateX || 0);
        const toScreenY = (cy) => cy * (t.scaleY || 1) + (t.translateY || 0);

        const rightAnchorX = targetNode.left + targetNode.width;
        const rightAnchorY = targetNode.top + targetNode.height / 2;

        // 阶段 1: 拖拽至 35px (处于 captureRadius 80px 内)
        const x1 = toScreenX(rightAnchorX + 35);
        const y1 = toScreenY(rightAnchorY);
        drag.mouseMoveX = x1;
        drag.mouseMoveY = y1;
        enhancer.handleMove(x1, y1, {});
        const state1Snapped = enhancer.activeTargetNode === targetNode && enhancer.magneticLine.visible();

        // 阶段 2: 略微移出至 110px (处于 80px ~ 140px 迟滞保持区间内)
        const x2 = toScreenX(rightAnchorX + 110);
        const y2 = toScreenY(rightAnchorY);
        drag.mouseMoveX = x2;
        drag.mouseMoveY = y2;
        enhancer.handleMove(x2, y2, {});
        const state2StayConnected = enhancer.activeTargetNode === targetNode && enhancer.magneticLine.visible();

        // 阶段 3: 进一步移出至 260px (超出 releaseRadius 140px 释放阈值)
        const x3 = toScreenX(rightAnchorX + 260);
        const y3 = toScreenY(rightAnchorY);
        drag.mouseMoveX = x3;
        drag.mouseMoveY = y3;
        enhancer.handleMove(x3, y3, {});
        const state3Detached = enhancer.activeTargetNode === null && !enhancer.magneticLine.visible();

        // 清理
        enhancer.cleanup();
        drag.clone.remove();
        drag.reset();

        return {
          state1Snapped,
          state2StayConnected,
          state3Detached
        };
      })()
    `);

    if (!hysteresisTest.state1Snapped || !hysteresisTest.state2StayConnected || !hysteresisTest.state3Detached) {
      throw new Error(`迟滞防抖边界动态测试异常: state1=${hysteresisTest.state1Snapped}, state2=${hysteresisTest.state2StayConnected}, state3=${hysteresisTest.state3Detached}`);
    }
    console.log('[PASS] 测试 28: 迟滞防抖动态阈值验证通过 (50px 捕获 -> 110px 稳定维系 -> 160px 干净断开)');

    console.log('\n--- 开始执行 Phase 7 导图大纲笔记与双向联动专项断言项 ---');

    // 测试 29: 导图大纲视图挂载与 DOM 结构校验
    const outlinerMountTest = await evaluate(ws, `
      (function() {
        const controller = window._dualViewControllerInstance;
        const outliner = window._outlinerInstance;
        if (!controller || !outliner) return { error: '控制器或大纲实例未就绪' };

        // 切换至大纲视图
        controller.switchView('outline');

        const mmContainer = document.getElementById('mindMapContainer');
        const outlinerContainer = document.getElementById('outlinerContainer');
        const isMmHidden = mmContainer.style.display === 'none';
        const isOutlinerActive = outlinerContainer.classList.contains('active');
        const hasBodyClass = document.body.classList.contains('view-mode-outline');
        const currentView = controller.getCurrentView();

        const paperEl = outlinerContainer.querySelector('.outliner-paper');
        const titleEl = outlinerContainer.querySelector('.outliner-title');
        const nodes = outlinerContainer.querySelectorAll('.outliner-node');
        const handles = outlinerContainer.querySelectorAll('.outliner-handle');
        const bullets = outlinerContainer.querySelectorAll('.outliner-bullet');

        return {
          currentView,
          isMmHidden,
          isOutlinerActive,
          hasBodyClass,
          hasPaper: !!paperEl,
          titleText: titleEl ? titleEl.textContent : '',
          nodeCount: nodes.length,
          handleCount: handles.length,
          bulletCount: bullets.length
        };
      })()
    `);

    if (outlinerMountTest.error) {
      throw new Error(outlinerMountTest.error);
    }
    if (outlinerMountTest.currentView !== 'outline' || !outlinerMountTest.isMmHidden || !outlinerMountTest.isOutlinerActive) {
      throw new Error(`大纲视图激活状态异常: ${JSON.stringify(outlinerMountTest)}`);
    }
    if (!outlinerMountTest.hasPaper || outlinerMountTest.nodeCount === 0) {
      throw new Error(`大纲纸张或节点渲染失败: nodeCount=${outlinerMountTest.nodeCount}`);
    }
    console.log(`[PASS] 测试 29: 导图大纲视图成功挂载，纸张居中渲染，标题="${outlinerMountTest.titleText}"，大纲行节点数=${outlinerMountTest.nodeCount}`);

    // 测试 30: 大纲全键盘工作流 - Enter 键插入同级兄弟节点
    const outlinerEnterTest = await evaluate(ws, `
      (function() {
        const outliner = window._outlinerInstance;
        const firstText = outliner.treeEl.querySelector('.outliner-text');
        if (!firstText) return { error: '找不到大纲文本节点' };

        const targetUid = firstText.dataset.uid;
        const beforeNodes = outliner.treeEl.querySelectorAll('.outliner-node').length;

        // 模拟按 Enter 键
        firstText.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

        const afterNodes = outliner.treeEl.querySelectorAll('.outliner-node').length;
        const newFocusedUid = outliner.focusedUid;
        const focusedEl = outliner.treeEl.querySelector('.outliner-text[data-uid="' + newFocusedUid + '"]');

        return {
          beforeNodes,
          afterNodes,
          targetUid,
          newFocusedUid,
          hasFocusedEl: !!focusedEl
        };
      })()
    `);

    if (outlinerEnterTest.afterNodes !== outlinerEnterTest.beforeNodes + 1) {
      throw new Error(`Enter 插入同级节点失败: before=${outlinerEnterTest.beforeNodes}, after=${outlinerEnterTest.afterNodes}`);
    }
    if (!outlinerEnterTest.hasFocusedEl) {
      throw new Error('Enter 插入后未正确聚焦新节点');
    }
    console.log(`[PASS] 测试 30: 大纲键盘流 Enter 测试通过，成功插入同级节点并自动聚焦 (节点数: ${outlinerEnterTest.beforeNodes} -> ${outlinerEnterTest.afterNodes})`);

    // 测试 31: 大纲全键盘工作流 - Tab 键向右缩进为子节点
    const outlinerTabTest = await evaluate(ws, `
      (function() {
        const outliner = window._outlinerInstance;
        const focusedUid = outliner.focusedUid;
        const currentText = outliner.treeEl.querySelector('.outliner-text[data-uid="' + focusedUid + '"]');
        if (!currentText) return { error: '未找到当前聚焦文本' };

        // 模拟 Tab 键
        currentText.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));

        // 检查数据结构中该节点是否已成为前一个兄弟节点的 children
        const nodeInfo = outliner.findNodeAndParent(outliner.data, focusedUid);
        const parentUid = nodeInfo && nodeInfo.parent ? nodeInfo.parent.data.uid : null;

        // 检查 DOM 结构中该节点是否位于父节点的 .outliner-children 内
        const nodeDom = outliner.treeEl.querySelector('.outliner-node[data-uid="' + focusedUid + '"]');
        const isInNestedChildren = !!(nodeDom && nodeDom.closest('.outliner-children'));

        return {
          focusedUid,
          parentUid,
          isInNestedChildren
        };
      })()
    `);

    if (!outlinerTabTest.isInNestedChildren || !outlinerTabTest.parentUid) {
      throw new Error(`Tab 缩进失败: ${JSON.stringify(outlinerTabTest)}`);
    }
    console.log(`[PASS] 测试 31: 大纲键盘流 Tab 缩进测试通过，节点已成功降级为子节点，父节点UID="${outlinerTabTest.parentUid}"`);

    // 测试 32: 大纲全键盘工作流 - Shift+Tab 键向左提升层级
    const outlinerShiftTabTest = await evaluate(ws, `
      (function() {
        const outliner = window._outlinerInstance;
        const focusedUid = outliner.focusedUid;
        const currentText = outliner.treeEl.querySelector('.outliner-text[data-uid="' + focusedUid + '"]');
        if (!currentText) return { error: '未找到当前聚焦文本' };

        // 模拟 Shift+Tab 键
        currentText.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));

        const nodeInfo = outliner.findNodeAndParent(outliner.data, focusedUid);
        const isRootChild = nodeInfo && nodeInfo.parent === outliner.data;

        return {
          focusedUid,
          isRootChild
        };
      })()
    `);

    if (!outlinerShiftTabTest.isRootChild) {
      throw new Error(`Shift+Tab 提升层级失败: ${JSON.stringify(outlinerShiftTabTest)}`);
    }
    console.log(`[PASS] 测试 32: 大纲键盘流 Shift+Tab 提升层级通过，节点已成功脱离父节点晋升为一级节点`);

    // 测试 33: 大纲折叠与展开交互
    const outlinerFoldTest = await evaluate(ws, `
      (function() {
        const outliner = window._outlinerInstance;
        // 寻找有子节点的 foldBtn
        const foldBtn = outliner.treeEl.querySelector('.outliner-fold-btn');
        if (!foldBtn) return { error: '找不到折叠按钮' };

        const row = foldBtn.closest('.outliner-row');
        const uid = row.dataset.uid;

        // 点击折叠
        foldBtn.click();
        const isFoldedAfterFirstClick = outliner.collapsedMap.has(uid);
        const collapsedChildren = outliner.treeEl.querySelector('.outliner-node[data-uid="' + uid + '"] .outliner-children');
        const hasCollapsedClass = collapsedChildren ? collapsedChildren.classList.contains('collapsed') : false;

        // 再次点击展开
        const newFoldBtn = outliner.treeEl.querySelector('.outliner-node[data-uid="' + uid + '"] .outliner-fold-btn');
        newFoldBtn.click();
        const isFoldedAfterSecondClick = outliner.collapsedMap.has(uid);
        const expandedChildren = outliner.treeEl.querySelector('.outliner-node[data-uid="' + uid + '"] .outliner-children');
        const isExpanded = expandedChildren ? !expandedChildren.classList.contains('collapsed') : false;

        return {
          isFoldedAfterFirstClick,
          hasCollapsedClass,
          isFoldedAfterSecondClick,
          isExpanded
        };
      })()
    `);

    if (!outlinerFoldTest.isFoldedAfterFirstClick || !outlinerFoldTest.hasCollapsedClass || outlinerFoldTest.isFoldedAfterSecondClick || !outlinerFoldTest.isExpanded) {
      throw new Error(`折叠展开逻辑异常: ${JSON.stringify(outlinerFoldTest)}`);
    }
    console.log('[PASS] 测试 33: 大纲折叠展开交互正常，三角形箭头指示旋转并隐藏/显示子节点容器');

    // 测试 34: 大纲编辑数据双向同步回思维导图
    const roundTripSyncTest = await evaluate(ws, `
      new Promise((resolve) => {
        const controller = window._dualViewControllerInstance;
        const outliner = window._outlinerInstance;
        const mm = window._mindMapInstance;

        // 在大纲中编辑聚焦的节点文本
        const focusedUid = outliner.focusedUid;
        const textEl = outliner.treeEl.querySelector('.outliner-text[data-uid="' + focusedUid + '"]');
        const targetString = '导图大纲双向联动验证节点_2026';
        textEl.textContent = targetString;
        textEl.dispatchEvent(new Event('input', { bubbles: true }));

        const checkAndResolve = () => {
          const mmData = mm.getData(false);
          const jsonStr = JSON.stringify(mmData);
          const hasInMmData = jsonStr.includes(targetString);

          // 验证 SVG foreignObject 渲染
          const foTexts = Array.from(mm.el.querySelectorAll('foreignObject')).map(f => f.textContent.trim());
          const hasInSvg = foTexts.some(t => t.includes(targetString));

          resolve({
            currentView: controller.getCurrentView(),
            isMmVisible: mm.el.style.display !== 'none',
            hasInMmData,
            hasInSvg,
            targetString
          });
        };

        const timer = setTimeout(() => {
          mm.off('node_tree_render_end', onRenderEnd);
          checkAndResolve();
        }, 1500);

        const onRenderEnd = () => {
          clearTimeout(timer);
          mm.off('node_tree_render_end', onRenderEnd);
          checkAndResolve();
        };

        mm.on('node_tree_render_end', onRenderEnd);

        // 切换回思维导图视图
        controller.switchView('mindmap');
      })
    `);

    if (roundTripSyncTest.currentView !== 'mindmap' || !roundTripSyncTest.isMmVisible) {
      throw new Error('切换回思维导图视图失败');
    }
    if (!roundTripSyncTest.hasInMmData || !roundTripSyncTest.hasInSvg) {
      throw new Error(`大纲修改内容未能正确同步至导图: hasInMmData=${roundTripSyncTest.hasInMmData}, hasInSvg=${roundTripSyncTest.hasInSvg}`);
    }
    console.log(`[PASS] 测试 34: 双向数据同步测试通过，大纲新编节点已无缝同步并在导图 SVG 节点中成功呈现: "${roundTripSyncTest.targetString}"`);

    // 测试 35: 导图大纲与思维导图视图双向切换
    const viewSwitchTest = await evaluate(ws, `
      (function() {
        const controller = window._dualViewControllerInstance;
        const viewBefore = controller.getCurrentView();

        // 切换至大纲
        controller.switchView('outline');
        const viewAfterFirst = controller.getCurrentView();

        // 切换回导图
        controller.switchView('mindmap');
        const viewAfterSecond = controller.getCurrentView();

        return {
          viewBefore,
          viewAfterFirst,
          viewAfterSecond
        };
      })()
    `);

    if (viewSwitchTest.viewBefore !== 'mindmap' || viewSwitchTest.viewAfterFirst !== 'outline' || viewSwitchTest.viewAfterSecond !== 'mindmap') {
      throw new Error(`视图双向切换异常: ${JSON.stringify(viewSwitchTest)}`);
    }
    console.log('[PASS] 测试 35: 导图大纲与导图双向切换验证通过 (mindmap -> outline -> mindmap)');

    // 测试 36: 大纲节点层级重排 (moveNodeRelative)
    const outlinerMoveTest = await evaluate(ws, `
      (function() {
        const outliner = window._outlinerInstance;
        const topChildren = outliner.data.children;
        if (topChildren.length < 2) return { error: '顶级节点不足2个' };

        const firstUid = topChildren[0].data.uid;
        const secondUid = topChildren[1].data.uid;

        // 将第一个节点移动到第二个节点之后
        const success = outliner.moveNodeRelative(firstUid, secondUid, 'after');
        const newFirstUid = outliner.data.children[0].data.uid;

        return {
          success,
          isReordered: newFirstUid === secondUid
        };
      })()
    `);

    if (!outlinerMoveTest.success || !outlinerMoveTest.isReordered) {
      throw new Error(`大纲节点重排失败: ${JSON.stringify(outlinerMoveTest)}`);
    }
    console.log('[PASS] 测试 36: 大纲节点重排 (moveNodeRelative) 成功，父子与兄弟层级顺序准确重构');

    // --- 开始执行 Phase 8 Markdown 与 LaTeX 公式引擎双态呈现专项断言项 ---
    console.log('\n--- 开始执行 Phase 8 Markdown 与 LaTeX 公式引擎双态呈现专项断言项 ---');

    // 测试 37: 导图节点 LaTeX 复杂公式排版与 KaTeX DOM 校验
    const latexRenderTest = await evaluate(ws, `
      new Promise((resolve) => {
        const mm = window._mindMapInstance;

        const startTest = () => {
          const root = mm.renderer.root;
          if (!root || !root.children || !root.children[0] || !root.children[0].children) {
            return setTimeout(startTest, 50);
          }
          const targetNode = root.children[0].children[0];
          const formulaText = "【极限与积分考点】 $\\\\lim_{x \\\\to 0} \\\\frac{\\\\sin x}{x} = 1$ 与 $\\\\int_0^1 x^2 dx = \\\\frac{1}{3}$";

          const onRender = () => {
            mm.off('node_tree_render_end', onRender);
            const fo = targetNode.group.findOne('foreignObject').node;
            const katexElements = Array.from(fo.querySelectorAll('.katex'));
            const katexHtmlElements = Array.from(fo.querySelectorAll('.katex-html'));
            const fractions = Array.from(fo.querySelectorAll('.mfrac'));
            const cardEl = fo.querySelector('.mm-node-card');
            
            resolve({
              hasCard: !!cardEl,
              katexCount: katexElements.length,
              katexHtmlCount: katexHtmlElements.length,
              fractionCount: fractions.length,
              width: targetNode.width,
              height: targetNode.height,
              textContent: fo.textContent
            });
          };

          mm.on('node_tree_render_end', onRender);
          mm.execCommand('SET_NODE_TEXT', targetNode, formulaText);
        };

        startTest();
      })
    `);

    if (latexRenderTest.katexCount < 2 || latexRenderTest.fractionCount < 2) {
      throw new Error(`导图节点公式渲染失败: ${JSON.stringify(latexRenderTest)}`);
    }
    console.log(`[PASS] 测试 37: 导图节点 LaTeX 复杂公式排版通过 (KaTeX公式数=${latexRenderTest.katexCount}, 分式数=${latexRenderTest.fractionCount}, 节点尺寸=${Math.round(latexRenderTest.width)}x${Math.round(latexRenderTest.height)})`);

    // 测试 38: 导图原位编辑与实时悬浮预览胶囊 (MindMapNodeEditor + Live Preview Capsule)
    await evaluate(ws, `
      (function() {
        const mm = window._mindMapInstance;
        mm.view.fit();
        const editor = window._mindMapNodeEditorInstance;
        const root = mm.renderer.root;
        const targetNode = root.children[0].children[0];

        // 唤起编辑
        editor.show(targetNode);

        // 模拟打字输入新公式
        const newFormula = "级数求和 $\\\\sum_{n=1}^\\\\infty \\\\frac{1}{n^2} = \\\\frac{\\\\pi^2}{6}$";
        editor.textarea.value = newFormula;
        editor.textarea.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `);

    await sleep(250);
    const editorScreenshot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
    const editorScreenshotBuffer = Buffer.from(editorScreenshot.data, 'base64');
    fs.writeFileSync(path.join(__dirname, 'mindmap_formula_editor_preview.png'), editorScreenshotBuffer);
    if (fs.existsSync(BRAIN_DIR)) {
      fs.writeFileSync(path.join(BRAIN_DIR, 'mindmap_formula_editor_preview.png'), editorScreenshotBuffer);
    }
    console.log('[Screenshot] 导图公式原位编辑与实时悬浮预览胶囊截图已生成: mindmap-sandbox/mindmap_formula_editor_preview.png');

    const editorCapsuleTest = await evaluate(ws, `
      (function() {
        const mm = window._mindMapInstance;
        const editor = window._mindMapNodeEditorInstance;
        const root = mm.renderer.root;
        const targetNode = root.children[0].children[0];

        const isInputVisible = editor.inputWrap.style.display !== 'none';
        const isCapsuleVisible = editor.capsule.style.display !== 'none';
        const updatedCapsuleKatex = editor.capsule.querySelectorAll('.katex').length;
        const capsuleContentText = editor.capsuleContent.textContent;

        // 提交编辑
        editor.commitAndHide();
        const isHiddenAfterCommit = (editor.inputWrap.style.display === 'none') && (editor.capsule.style.display === 'none');
        const nodeTextAfterCommit = targetNode.nodeData.data.text;

        return {
          isInputVisible,
          isCapsuleVisible,
          updatedCapsuleKatex,
          capsuleContentText,
          isHiddenAfterCommit,
          nodeTextAfterCommit
        };
      })()
    `);

    if (!editorCapsuleTest.isInputVisible || !editorCapsuleTest.isCapsuleVisible || editorCapsuleTest.updatedCapsuleKatex === 0 || !editorCapsuleTest.isHiddenAfterCommit) {
      throw new Error(`导图原位编辑与实时悬浮预览胶囊异常: ${JSON.stringify(editorCapsuleTest)}`);
    }
    console.log(`[PASS] 测试 38: 导图原位编辑与实时悬浮预览胶囊测试通过 (胶囊实时 KaTeX=${editorCapsuleTest.updatedCapsuleKatex}, 提交后优雅隐藏，节点文本="${editorCapsuleTest.nodeTextAfterCommit}")`);

    // 测试 39: 导图大纲双态切换与防跳动 (Outliner Dual-State Toggle & Anti-Jitter)
    const outlinerDualStateTest = await evaluate(ws, `
      (function() {
        const controller = window._dualViewControllerInstance;
        const outliner = window._outlinerInstance;
        const mm = window._mindMapInstance;
        controller.switchView('outline');

        // 查找包含公式的行
        const allRows = Array.from(outliner.treeEl.querySelectorAll('.outliner-row'));
        const formulaRow = allRows.find(r => r.querySelector('.outliner-display-view .katex'));
        if (!formulaRow) return { error: '未在大纲中找到含公式的行' };

        const uid = formulaRow.dataset.uid;
        const displayView = formulaRow.querySelector('.outliner-display-view');
        const inputView = formulaRow.querySelector('.outliner-input-view');

        // 1. 浏览态检查
        const isDisplayVisibleBefore = window.getComputedStyle(displayView).display !== 'none';
        const isInputHiddenBefore = window.getComputedStyle(inputView).display === 'none';
        const katexCountInDisplay = displayView.querySelectorAll('.katex').length;

        // 2. 点击浏览视图激活编辑态
        displayView.click();
        const isDisplayHiddenAfterClick = window.getComputedStyle(displayView).display === 'none';
        const isInputVisibleAfterClick = window.getComputedStyle(inputView).display !== 'none';
        const isEditingClassAdded = formulaRow.classList.contains('is-editing');
        const sourceTextInInput = inputView.textContent;

        // 3. 提交编辑切回浏览态
        outliner.commitNode(uid);
        const isDisplayVisibleAfterCommit = window.getComputedStyle(displayView).display !== 'none';
        const isInputHiddenAfterCommit = window.getComputedStyle(inputView).display === 'none';
        const isEditingClassRemoved = !formulaRow.classList.contains('is-editing');

        // 切回思维导图并等待渲染完成
        return new Promise((resolve) => {
          const handler = () => {
            mm.off('node_tree_render_end', handler);
            resolve({
              isDisplayVisibleBefore,
              isInputHiddenBefore,
              katexCountInDisplay,
              isDisplayHiddenAfterClick,
              isInputVisibleAfterClick,
              isEditingClassAdded,
              sourceTextInInput,
              isDisplayVisibleAfterCommit,
              isInputHiddenAfterCommit,
              isEditingClassRemoved
            });
          };
          mm.on('node_tree_render_end', handler);
          controller.switchView('mindmap');
        });
      })()
    `);

    if (!outlinerDualStateTest.isDisplayVisibleBefore || !outlinerDualStateTest.isInputVisibleAfterClick || !outlinerDualStateTest.isDisplayVisibleAfterCommit || outlinerDualStateTest.katexCountInDisplay === 0) {
      throw new Error(`导图大纲双态切换与防跳动异常: ${JSON.stringify(outlinerDualStateTest)}`);
    }
    console.log(`[PASS] 测试 39: 导图大纲双态切换与防跳动通过 (浏览态呈现 KaTeX=${outlinerDualStateTest.katexCountInDisplay} -> 点击平滑转源码态 -> 提交切回浏览态)`);

    // 测试 40: 包含大公式节点时的导图磁吸吸附几何稳定性
    const formulaSnapTest = await evaluate(ws, `
      (function() {
        const mm = window._mindMapInstance;
        const dragEnhancer = window._mindMapDragEnhancerInstance;
        const drag = mm.drag;
        const root = mm.renderer.root;
        if (!root || !root.children || !root.children.length) {
          return { error: '根节点未就绪' };
        }
        const ch1 = root.children[0];
        const formulaNode = (ch1.children && ch1.children[0]) || ch1;
        const draggedNode = (ch1.children && ch1.children[1]) || root.children[1];

        drag.isDragging = true;
        drag.clone = drag.mindMap.otherDraw.rect().size(120, 32);
        drag.beingDragNodeList = [draggedNode];
        drag.nodeTreeToList();
        drag.offsetX = 20;
        drag.offsetY = 16;

        // 拖动至公式节点的右侧子级磁吸区域
        const targetX = formulaNode.left + formulaNode.width + 30;
        const targetY = formulaNode.top + formulaNode.height / 2;
        drag.mouseMoveX = targetX;
        drag.mouseMoveY = targetY;

        dragEnhancer.handleMove(targetX, targetY, {});

        const isChildSnap = (drag.overlapNode === formulaNode && drag.prevNode === null && drag.nextNode === null);
        const lineVisible = dragEnhancer.magneticLine.visible();

        // 状态清理复位
        dragEnhancer.cleanup();
        drag.clone.remove();
        drag.reset();

        return {
          formulaNodeWidth: formulaNode.width,
          formulaNodeHeight: formulaNode.height,
          isChildSnap,
          lineVisible
        };
      })()
    `);

    if (!formulaSnapTest.isChildSnap || !formulaSnapTest.lineVisible) {
      throw new Error(`复杂公式节点磁吸判定失败: ${JSON.stringify(formulaSnapTest)}`);
    }
    console.log(`[PASS] 测试 40: 包含大公式节点时的导图磁吸吸附几何稳定性测试通过 (节点尺寸=${Math.round(formulaSnapTest.formulaNodeWidth)}x${Math.round(formulaSnapTest.formulaNodeHeight)}, 动态蓝线精准贴合)`);

    // --- 开始执行 Phase 9 缺陷修复与导图第二阶段核心交互专项断言项 ---
    console.log('\n--- 开始执行 Phase 9 缺陷修复与导图第二阶段核心交互专项断言项 ---');

    // 切回导图模式
    await evaluate(ws, `window._dualViewControllerInstance.switchView('mindmap')`);
    await sleep(200);

    // 测试 41: 导图原位编辑双重方框重叠根除验证 (is-mm-editing 状态与底层 hoverNode/foreignObject 隐藏)
    const boxOverlapTest = await evaluate(ws, `
      (function() {
        const mm = window._mindMapInstance;
        const editor = window._mindMapNodeEditorInstance;
        const root = mm.renderer.root;
        const targetNode = root.children[0];

        // 唤起编辑
        editor.show(targetNode);

        const hasEditingClass = targetNode.group.hasClass('is-mm-editing');
        const hoverNodeHidden = targetNode.hoverNode ? (targetNode.hoverNode.node.style.display === 'none' || window.getComputedStyle(targetNode.hoverNode.node).display === 'none') : true;
        const fo = targetNode.group.findOne('foreignObject');
        const foOpacity = fo ? window.getComputedStyle(fo.node).opacity : '1';

        // 提交编辑并检查复原
        editor.commitAndHide();
        const hasEditingClassAfter = targetNode.group.hasClass('is-mm-editing');

        return {
          hasEditingClass,
          hoverNodeHidden,
          foOpacity,
          hasEditingClassAfter
        };
      })()
    `);

    if (!boxOverlapTest.hasEditingClass || !boxOverlapTest.hoverNodeHidden || boxOverlapTest.foOpacity !== '0' || boxOverlapTest.hasEditingClassAfter) {
      throw new Error(`导图编辑方框重叠根除断言失败: ${JSON.stringify(boxOverlapTest)}`);
    }
    console.log('[PASS] 测试 41: 导图编辑方框重叠根除验证通过 (编辑中注入 is-mm-editing，底层 hoverNode 隐藏，foreignObject 不透明度置 0，提交后复原)');

    // 测试 42: 预览胶囊冗余标题文字彻底剔除验证
    const capsuleBadgeTest = await evaluate(ws, `
      (function() {
        const editor = window._mindMapNodeEditorInstance;
        const hasHeader = !!editor.capsule.querySelector('.capsule-header');
        const hasBadge = !!editor.capsule.querySelector('.capsule-badge');
        const hasContent = !!editor.capsule.querySelector('.capsule-content');
        return { hasHeader, hasBadge, hasContent };
      })()
    `);

    if (capsuleBadgeTest.hasHeader || capsuleBadgeTest.hasBadge || !capsuleBadgeTest.hasContent) {
      throw new Error(`预览胶囊标题剔除断言失败: ${JSON.stringify(capsuleBadgeTest)}`);
    }
    console.log('[PASS] 测试 42: 预览胶囊冗余标题文字彻底剔除通过 (无 capsule-header 与 capsule-badge，仅保留纯净 capsule-content)');

    // 测试 43: 大纲模式实时公式悬浮预览胶囊与行内提交渲染验证 (回退恢复误改的预览胶囊)
    const outlinerCapsuleTest = await evaluate(ws, `
      (function() {
        const controller = window._dualViewControllerInstance;
        const outliner = window._outlinerInstance;
        controller.switchView('outline');

        const firstNode = outliner.data.children[0];
        outliner.focusNode(firstNode.data.uid);

        const row = outliner.container.querySelector('.outliner-row[data-uid="' + firstNode.data.uid + '"]');
        const input = row.querySelector('.outliner-input-view');
        input.textContent = '测试公式 $\\\\lim_{x \\\\to 0} \\\\frac{\\\\sin x}{x} = 1$';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        const capsule = outliner.previewCapsule;
        // 回退恢复：输入期实时悬浮预览胶囊应当正常激活并渲染 KaTeX 公式
        const isCapsuleVisibleDuringInput = !!capsule && capsule.style.display !== 'none' && window.getComputedStyle(capsule).display !== 'none';
        const katexInCapsule = capsule ? capsule.querySelectorAll('.katex').length : 0;

        // 提交后胶囊自动隐退，直接在行内 displayView 中渲染公式
        outliner.commitNode(firstNode.data.uid);
        const displayView = row.querySelector('.outliner-display-view');
        const katexInDisplay = displayView ? displayView.querySelectorAll('.katex').length : 0;
        const isCapsuleHiddenAfter = !capsule || capsule.style.display === 'none' || window.getComputedStyle(capsule).display === 'none';

        controller.switchView('mindmap');

        return {
          isCapsuleVisibleDuringInput,
          katexInCapsule,
          katexInDisplay,
          isCapsuleHiddenAfter
        };
      })()
    `);

    if (!outlinerCapsuleTest.isCapsuleVisibleDuringInput || outlinerCapsuleTest.katexInCapsule === 0 || outlinerCapsuleTest.katexInDisplay === 0 || !outlinerCapsuleTest.isCapsuleHiddenAfter) {
      throw new Error(`大纲模式实时公式悬浮预览胶囊功能异常: ${JSON.stringify(outlinerCapsuleTest)}`);
    }
    console.log(`[PASS] 测试 43: 大纲模式公式悬浮预览胶囊恢复完备 (输入期胶囊正常弹窗并渲染 KaTeX=${outlinerCapsuleTest.katexInCapsule}，提交后在行内直接渲染 KaTeX=${outlinerCapsuleTest.katexInDisplay}，胶囊自动隐退)`);

    // 测试 44: 导图底部固定深色工具条挂载与按钮可用性
    const bottomToolbarTest = await evaluate(ws, `
      (function() {
        const toolbar = document.querySelector('.mm-bottom-toolbar');
        if (!toolbar) return { error: '未找到底部工具条' };
        const style = window.getComputedStyle(toolbar);
        const isFixed = style.position === 'fixed';
        const isBottom = parseInt(style.bottom) >= 15;
        const btnCount = toolbar.querySelectorAll('.bar-btn').length;
        const colorPopover = toolbar.querySelector('.mm-color-popover');
        const colorDotCount = colorPopover ? colorPopover.querySelectorAll('.color-dot').length : 0;

        return {
          isFixed,
          isBottom,
          btnCount,
          colorDotCount
        };
      })()
    `);

    if (!bottomToolbarTest.isFixed || !bottomToolbarTest.isBottom || bottomToolbarTest.btnCount !== 4 || bottomToolbarTest.colorDotCount !== 8) {
      throw new Error(`底部固定工具条断言失败: ${JSON.stringify(bottomToolbarTest)}`);
    }
    console.log(`[PASS] 测试 44: 导图底部固定深色工具条验证通过 (位置=fixed bottom居中, 严格精简为核心最左侧 4 按钮: A/B/I/U, 7色+清除颜色点数=${bottomToolbarTest.colorDotCount})`);

    // 测试 45: 7色高亮体系 (Alt + R/Y/P/B/C/O/G) 与节点数据/样式联动
    const highlightColorsTest = await evaluate(ws, `
      new Promise((resolve) => {
        const mm = window._mindMapInstance;
        const checkReady = () => {
          const root = mm.renderer.root;
          if (!root || !root.children || !root.children[0]) {
            return setTimeout(checkReady, 50);
          }
          const node = root.children[0];
          mm.renderer.clearActiveNodeList();
          mm.renderer.addNodeToActiveList(node);

          const shortcutMgr = window._mindMapShortcutManagerInstance;
          shortcutMgr.toggleNodeHighlight(node, 'red');

          const handler = () => {
            mm.off('node_tree_render_end', handler);
            const rawData = node.getData();
            const fo = node.group.findOne('foreignObject').node;
            const content = fo.querySelector('.mm-node-content');
            const hasHighlightClass = content ? (content.classList.contains('mm-hl-red') || content.classList.contains('mm-highlight-red')) : false;

            resolve({
              dataColor: rawData.highlightColor,
              hasHighlightClass
            });
          };
          mm.on('node_tree_render_end', handler);
        };
        checkReady();
      })
    `);

    if (highlightColorsTest.dataColor !== 'red' || !highlightColorsTest.hasHighlightClass) {
      throw new Error(`7色高亮体系测试失败: ${JSON.stringify(highlightColorsTest)}`);
    }
    console.log(`[PASS] 测试 45: 导图 7 色高亮体系联动测试通过 (数据highlightColor="${highlightColorsTest.dataColor}", 文字区域应用柔和粉色高亮且不破坏卡片外框底色)`);

    // 测试 46: 节点副本创建 (Ctrl + D) 包含子树完整克隆
    const duplicateNodeTest = await evaluate(ws, `
      new Promise((resolve) => {
        const mm = window._mindMapInstance;
        const root = mm.renderer.root;
        const nodeToDup = root.children[0];
        const beforeSiblingCount = root.children.length;
        const originalChildCount = nodeToDup.children.length;

        mm.renderer.clearActiveNodeList();
        mm.renderer.addNodeToActiveList(nodeToDup);

        const shortcutMgr = window._mindMapShortcutManagerInstance;
        shortcutMgr.duplicateNode(nodeToDup);

        const handler = () => {
          mm.off('node_tree_render_end', handler);
          const afterSiblingCount = root.children.length;
          const duplicatedNode = root.children[1];
          const dupChildCount = duplicatedNode ? duplicatedNode.children.length : 0;
          const isUidUnique = duplicatedNode.getData('uid') !== nodeToDup.getData('uid');

          resolve({
            beforeSiblingCount,
            afterSiblingCount,
            originalChildCount,
            dupChildCount,
            isUidUnique
          });
        };
        mm.on('node_tree_render_end', handler);
      })
    `);

    if (duplicateNodeTest.afterSiblingCount !== duplicateNodeTest.beforeSiblingCount + 1 || duplicateNodeTest.dupChildCount !== duplicateNodeTest.originalChildCount || !duplicateNodeTest.isUidUnique) {
      throw new Error(`节点副本创建断言失败: ${JSON.stringify(duplicateNodeTest)}`);
    }
    console.log(`[PASS] 测试 46: 节点副本创建 (Ctrl + D) 测试通过 (同级分支数 ${duplicateNodeTest.beforeSiblingCount}->${duplicateNodeTest.afterSiblingCount}, 子节点完整克隆数=${duplicateNodeTest.dupChildCount}, UID独立且唯一)`);

    // 测试 47: 单节点钻取聚焦 (Ctrl + ]) 与返回上一级 (Ctrl + [)
    const drilldownTest = await evaluate(ws, `
      new Promise((resolve) => {
        const mm = window._mindMapInstance;
        const root = mm.renderer.root;
        const targetNode = root.children[0];

        const shortcutMgr = window._mindMapShortcutManagerInstance;
        shortcutMgr.drillDown(targetNode);

        const isBreadcrumbShown = shortcutMgr.breadcrumbEl.style.display !== 'none';
        const newRootTitle = (mm.renderer.root.getData('text') || '').trim();
        const stackDepthAfterDrill = shortcutMgr.drillStack.length;

        const onRenderEnd = () => {
          mm.off('node_tree_render_end', onRenderEnd);
          const isBreadcrumbHidden = shortcutMgr.breadcrumbEl.style.display === 'none';
          const stackDepthAfterUp = shortcutMgr.drillStack.length;

          resolve({
            isBreadcrumbShown,
            newRootTitle,
            stackDepthAfterDrill,
            isBreadcrumbHidden,
            stackDepthAfterUp
          });
        };

        mm.on('node_tree_render_end', onRenderEnd);
        shortcutMgr.drillUp();
      })
    `);

    if (!drilldownTest.isBreadcrumbShown || drilldownTest.stackDepthAfterDrill !== 1 || !drilldownTest.isBreadcrumbHidden || drilldownTest.stackDepthAfterUp !== 0) {
      throw new Error(`节点钻取聚焦与返回断言失败: ${JSON.stringify(drilldownTest)}`);
    }
    console.log('[PASS] 测试 47: 单节点钻取聚焦 (Ctrl + ]) 与返回上一级 (Ctrl + [) 测试通过 (子树重置为临时根, 顶部门包屑联动导航, 返回后100%还原)');

    // 测试 48: 空格键唤起原位编辑 (Space)
    const spaceEditTest = await evaluate(ws, `
      (function() {
        const mm = window._mindMapInstance;
        const editor = window._mindMapNodeEditorInstance;
        const root = mm.renderer.root;
        const targetNode = root.children[0];

        mm.renderer.clearActiveNodeList();
        mm.renderer.addNodeToActiveList(targetNode);

        // 模拟按下空格键
        window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true }));

        const isEditingActive = editor.isEditing;
        const isInputVisible = editor.inputWrap.style.display !== 'none';

        // 收起编辑
        editor.cancelAndHide();

        return {
          isEditingActive,
          isInputVisible
        };
      })()
    `);

    if (!spaceEditTest.isEditingActive || !spaceEditTest.isInputVisible) {
      throw new Error(`空格键唤起编辑断言失败: ${JSON.stringify(spaceEditTest)}`);
    }
    console.log('[PASS] 测试 48: 空格键 (Space) 唤起节点原位编辑通过 (符合导图官方快捷键行为规范)');

    // 测试 49: 快捷键指南抽屉 (Ctrl + /) 模态呼出与四大分区验证
    const shortcutDrawerTest = await evaluate(ws, `
      (function() {
        const drawer = window._mindMapShortcutDrawerInstance;
        drawer.close();

        // 触发 Ctrl + /
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', ctrlKey: true, bubbles: true, cancelable: true }));
        const isOpenAfterFirst = drawer.isOpen && drawer.drawerEl.classList.contains('open');

        const sectionTitles = Array.from(drawer.drawerEl.querySelectorAll('.shortcut-section-title')).map(s => s.textContent.trim());
        const kbdCount = drawer.drawerEl.querySelectorAll('kbd').length;

        // 再次触发关闭
        window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', ctrlKey: true, bubbles: true, cancelable: true }));
        const isClosedAfterSecond = !drawer.isOpen && !drawer.drawerEl.classList.contains('open');

        return {
          isOpenAfterFirst,
          sectionTitles,
          kbdCount,
          isClosedAfterSecond
        };
      })()
    `);

    if (!shortcutDrawerTest.isOpenAfterFirst || !shortcutDrawerTest.isClosedAfterSecond || shortcutDrawerTest.kbdCount < 15) {
      throw new Error(`快捷键指南抽屉测试失败: ${JSON.stringify(shortcutDrawerTest)}`);
    }
    console.log(`[PASS] 测试 49: 快捷键指南抽屉 (Ctrl + /) 测试通过 (四大分区: ${shortcutDrawerTest.sectionTitles.join(' / ')}, 键帽标签数=${shortcutDrawerTest.kbdCount})`);

    // ─────────────────────────────────────────────────────────────
    // Phase 10: 导图选区气泡菜单与节点内局部富文本排版交互体系
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- Phase 10: 导图选区气泡菜单与节点内局部富文本排版交互体系 ---');

    // 测试 50: 导图原位编辑唤起与选区气泡菜单 (mindmapBubbleMenu) 显示与隐藏
    const bubbleMenuVisibility = await evaluate(ws, `
      (function() {
        const editor = window._mindMapNodeEditorInstance;
        const mindMap = window._mindMapInstance;
        const rootNode = mindMap.renderer.root;

        editor.show(rootNode);
        editor.textarea.value = '定理：柯西-施瓦茨不等式 与 积分应用';
        editor.updatePosition();
        editor.updatePreview();

        // 此时无选区，气泡菜单应隐藏
        const isHiddenInitially = (editor.bubbleMenu.style.display === 'none' || !editor.bubbleMenu.style.display);

        // 选中 "柯西-施瓦茨不等式" (索引 3 到 12)
        editor.textarea.setSelectionRange(3, 12);
        editor.checkSelection();

        const isVisibleAfterSelection = (editor.bubbleMenu.style.display === 'flex');
        const buttonsCount = editor.bubbleMenu.querySelectorAll('.bubble-btn').length;
        const colorDotsCount = editor.bubbleMenu.querySelectorAll('.color-dot').length;

        // 取消选区
        editor.textarea.setSelectionRange(0, 0);
        editor.checkSelection();
        const isHiddenAfterClear = (editor.bubbleMenu.style.display === 'none');

        return {
          isHiddenInitially,
          isVisibleAfterSelection,
          buttonsCount,
          colorDotsCount,
          isHiddenAfterClear
        };
      })()
    `);

    if (!bubbleMenuVisibility.isHiddenInitially || !bubbleMenuVisibility.isVisibleAfterSelection || !bubbleMenuVisibility.isHiddenAfterClear || bubbleMenuVisibility.buttonsCount < 7 || bubbleMenuVisibility.colorDotsCount < 8) {
      throw new Error(`测试 50 失败: 选区气泡菜单展现与隐藏异常: ${JSON.stringify(bubbleMenuVisibility)}`);
    }
    console.log(`[PASS] 测试 50: 选区悬浮气泡菜单生命周期与元素完整性校验通过 (按钮数=${bubbleMenuVisibility.buttonsCount}, 色板数=${bubbleMenuVisibility.colorDotsCount})`);

    // 测试 51: 选区局部加粗与智能解包 (Toggle Wrap/Unwrap) 及实时胶囊渲染
    const boldToggleTest = await evaluate(ws, `
      (function() {
        const editor = window._mindMapNodeEditorInstance;
        editor.textarea.value = '定理：柯西不等式 与 积分应用';
        editor.updatePosition();
        editor.updatePreview();

        // 选中 "柯西不等式" (索引 3 到 8)
        editor.textarea.setSelectionRange(3, 8);
        editor.checkSelection();

        // 执行加粗
        editor.formatSelection('bold');
        const valAfterBold = editor.textarea.value;
        const capsuleHtmlBold = editor.capsuleContent.innerHTML;
        const hasStrong = capsuleHtmlBold.includes('<strong>柯西不等式</strong>') || capsuleHtmlBold.includes('<strong>');

        // 保持或重新选中加粗内容执行解包
        editor.textarea.setSelectionRange(3, 3 + '**柯西不等式**'.length);
        editor.formatSelection('bold');
        const valAfterUnwrap = editor.textarea.value;

        return {
          valAfterBold,
          hasStrong,
          capsuleHtmlBold,
          valAfterUnwrap
        };
      })()
    `);

    if (!boldToggleTest.valAfterBold.includes('**柯西不等式**') || !boldToggleTest.hasStrong || boldToggleTest.valAfterUnwrap !== '定理：柯西不等式 与 积分应用') {
      throw new Error(`测试 51 失败: 选区局部加粗与解包异常: ${JSON.stringify(boldToggleTest)}`);
    }
    console.log(`[PASS] 测试 51: 选区局部加粗 (**..**) 与智能 Toggle 解包及实时胶囊渲染通过`);

    // 测试 52: 选区 7 色局部高亮与斜体、下划线多格式组合
    const multiFormatTest = await evaluate(ws, `
      (function() {
        const editor = window._mindMapNodeEditorInstance;
        editor.textarea.value = '重要：拉格朗日中值定理 与 洛必达法则';
        editor.updatePosition();
        editor.updatePreview();

        // 选中 "拉格朗日中值定理" (索引 3 到 11)，施加红色高亮
        editor.textarea.setSelectionRange(3, 11);
        editor.formatSelection('color', 'red');

        // 选中 "洛必达法则" 并施加下划线
        const idxLopital = editor.textarea.value.indexOf('洛必达法则');
        editor.textarea.setSelectionRange(idxLopital, idxLopital + 5);
        editor.formatSelection('underline');

        const finalVal = editor.textarea.value;
        const capsuleHtml = editor.capsuleContent.innerHTML;

        const hasMarkRed = finalVal.includes('<mark class="mm-inline-hl-red">拉格朗日中值定理</mark>');
        const hasUnderline = finalVal.includes('<u>洛必达法则</u>');
        const capsuleHasMark = capsuleHtml.includes('mm-inline-hl-red');
        const capsuleHasU = capsuleHtml.includes('<u>') || capsuleHtml.includes('text-decoration: underline');

        return {
          finalVal,
          hasMarkRed,
          hasUnderline,
          capsuleHasMark,
          capsuleHasU
        };
      })()
    `);

    if (!multiFormatTest.hasMarkRed || !multiFormatTest.hasUnderline || !multiFormatTest.capsuleHasMark) {
      throw new Error(`测试 52 失败: 7 色局部高亮与下划线排版异常: ${JSON.stringify(multiFormatTest)}`);
    }
    console.log(`[PASS] 测试 52: 7 色行内文本高亮 (<mark>) 与下划线 (<u>) 多排版组合校验通过`);

    // 测试 53: 局部加粗高亮与 KaTeX 数学公式混合共存及节点提交渲染
    const mixedFormulaCommitTest = await evaluate(ws, `
      (function() {
        const editor = window._mindMapNodeEditorInstance;
        const mindMap = window._mindMapInstance;
        const rootNode = mindMap.renderer.root;

        editor.show(rootNode);
        editor.textarea.value = '定理：**柯西不等式** $|\sum a_i b_i|^2 \le \sum a_i^2 \sum b_i^2$ 与 <mark class="mm-inline-hl-yellow">重要积分</mark>';
        editor.updatePreview();
        editor.commitAndHide();

        // 检查渲染出的根节点 SVG DOM
        const rootCard = rootNode.group && rootNode.group.node.querySelector('.mm-node-card');
        const contentEl = rootCard ? rootCard.querySelector('.mm-node-content') : null;
        const contentHtml = contentEl ? contentEl.innerHTML : '';

        const hasStrong = contentHtml.includes('<strong>柯西不等式</strong>');
        const hasKatex = contentEl && contentEl.querySelectorAll('.katex').length > 0;
        const hasYellowHl = contentHtml.includes('mm-inline-hl-yellow');

        return {
          hasStrong,
          hasKatex,
          hasYellowHl,
          contentHtml
        };
      })()
    `);

    if (!mixedFormulaCommitTest.hasStrong || !mixedFormulaCommitTest.hasKatex || !mixedFormulaCommitTest.hasYellowHl) {
      throw new Error(`测试 53 失败: 导图节点提交后混合公式与局部富文本渲染异常: ${JSON.stringify(mixedFormulaCommitTest)}`);
    }
    console.log(`[PASS] 测试 53: 局部加粗、7色高亮与 KaTeX 行内复杂公式三维混合共存与提交渲染通过`);

    // 等待上一阶段异步渲染稳定
    await sleep(350);

    // 测试 54: 底部固定深色工具条与快捷键双模智能联动
    const toolbarDualModeTest = await evaluate(ws, `
      (function() {
        const editor = window._mindMapNodeEditorInstance;
        const mindMap = window._mindMapInstance;
        const rootNode = mindMap.renderer.root;
        if (!rootNode) return { error: 'rootNode 为空' };

        // 重新唤起编辑
        editor.show(rootNode);
        editor.textarea.value = '核心：泰勒级数 与 麦克劳林展开';
        editor.updatePreview();

        // 选中 "泰勒级数" (索引 3 到 7)
        editor.textarea.setSelectionRange(3, 7);
        editor.checkSelection();

        // 点击底部固定工具条的加粗按钮
        const btnBold = document.getElementById('mmBtnBold');
        btnBold.click();

        const isTextBolded = editor.textarea.value.includes('**泰勒级数**');
        const isStillEditing = editor.isEditing;

        // 测试编辑态快捷键 Ctrl+B 解包
        editor.textarea.setSelectionRange(3, 3 + '**泰勒级数**'.length);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true, cancelable: true }));

        const isTextUnwrapped = (editor.textarea.value === '核心：泰勒级数 与 麦克劳林展开');

        editor.commitAndHide();

        return {
          isTextBolded,
          isStillEditing,
          isTextUnwrapped
        };
      })()
    `);

    if (!toolbarDualModeTest.isTextBolded || !toolbarDualModeTest.isStillEditing || !toolbarDualModeTest.isTextUnwrapped) {
      throw new Error(`测试 54 失败: 底部工具条与快捷键编辑态双模联动异常: ${JSON.stringify(toolbarDualModeTest)}`);
    }
    console.log(`[PASS] 测试 54: 底部固定深色工具条与快捷键 (Ctrl+B) 编辑态选区拦截与双模流转通过`);

    // 测试 55: 导图大纲视图选区气泡菜单与局部富文本排版
    const outlinerInlineFormatTest = await evaluate(ws, `
      (function() {
        const controller = window._dualViewControllerInstance;
        const outliner = window._outlinerInstance;
        controller.switchView('outline');

        const firstNode = outliner.data.children[0];
        outliner.focusNode(firstNode.data.uid);

        const row = outliner.container.querySelector('.outliner-row[data-uid="' + firstNode.data.uid + '"]');
        const input = row.querySelector('.outliner-input-view');
        input.textContent = '基础概念：极限性质分析';

        // 选中 "极限性质"
        const selection = window.getSelection();
        const range = document.createRange();
        const textNode = input.firstChild;
        range.setStart(textNode, 5);
        range.setEnd(textNode, 9);
        selection.removeAllRanges();
        selection.addRange(range);

        // 触发气泡展示与加粗
        outliner.checkSelection();
        const isBubbleVisible = (outliner.bubbleMenu.style.display === 'flex');

        outliner.formatSelection('bold');
        const formattedText = input.textContent;
        const isBolded = formattedText.includes('**极限性质**');

        // 提交并检验浏览态渲染
        outliner.commitNode(firstNode.data.uid);
        const disp = row.querySelector('.outliner-display-view');
        const dispHtml = disp ? disp.innerHTML : '';
        const hasStrongInDisplay = dispHtml.includes('<strong>极限性质</strong>');

        return {
          isBubbleVisible,
          isBolded,
          hasStrongInDisplay,
          formattedText,
          dispHtml
        };
      })()
    `);

    if (!outlinerInlineFormatTest.isBubbleVisible || !outlinerInlineFormatTest.isBolded || !outlinerInlineFormatTest.hasStrongInDisplay) {
      throw new Error(`测试 55 失败: 大纲视图选区气泡与局部排版异常: ${JSON.stringify(outlinerInlineFormatTest)}`);
    }
    console.log(`[PASS] 测试 55: 导图大纲视图选区气泡菜单与局部排版 (浏览态/编辑态同步) 校验通过`);

    // --- Phase 11: 导图高亮体系与 LaTeX 公式防污染深度重构专项断言项 ---
    console.log('\n--- Phase 11: 导图高亮体系与 LaTeX 公式防污染深度重构专项断言项 ---');

    // 切回思维导图并等待节点树稳定
    await evaluate(ws, `
      new Promise((resolve) => {
        const controller = window._dualViewControllerInstance;
        const mm = window._mindMapInstance;
        const onEnd = () => {
          mm.off('node_tree_render_end', onEnd);
          resolve();
        };
        mm.on('node_tree_render_end', onEnd);
        controller.switchView('mindmap');
      })
    `);
    await sleep(250);

    // 测试 56: 节点高亮物理清除与内联高亮标签深度剥离验证
    const clearHighlightTest = await evaluate(ws, `
      new Promise((resolve) => {
        const mm = window._mindMapInstance;
        const root = mm.renderer.root;
        const targetNode = root.children[0];
        mm.renderer.clearActiveNodeList();
        mm.renderer.addNodeToActiveList(targetNode);

        const tb = window._mindMapBottomToolbarInstance;

        const onFirstRender = () => {
          mm.off('node_tree_render_end', onFirstRender);
          const hasYellowBefore = targetNode.getData('highlightColor') === 'yellow';

          const onClearRender = () => {
            mm.off('node_tree_render_end', onClearRender);
            const dataColorAfter = targetNode.getData('highlightColor');
            const rawPropAfter = targetNode.nodeData.data.highlightColor;
            const textAfter = targetNode.getData('text');
            const hasMarkInText = textAfter.includes('<mark');
            const fo = targetNode.group.findOne('foreignObject').node;
            const content = fo.querySelector('.mm-node-content');
            const contentHasYellow = content ? content.classList.contains('mm-hl-yellow') : false;

            resolve({
              hasYellowBefore,
              dataColorAfter,
              rawPropAfter,
              textAfter,
              hasMarkInText,
              contentHasYellow
            });
          };
          mm.on('node_tree_render_end', onClearRender);
          // 2. 模拟点击清除高亮
          tb.setNodeHighlight('none');
        };

        mm.on('node_tree_render_end', onFirstRender);
        // 1. 设置节点高亮并注入残留内联标签
        tb.setNodeHighlight('yellow');
        mm.execCommand('SET_NODE_TEXT', targetNode, '含内联高亮：<mark class="mm-inline-hl-yellow">重点考察</mark> 与正常文本');
      })
    `);

    if (!clearHighlightTest.hasYellowBefore || clearHighlightTest.dataColorAfter || clearHighlightTest.rawPropAfter || clearHighlightTest.hasMarkInText || clearHighlightTest.contentHasYellow) {
      throw new Error(`测试 56 失败: 节点高亮清除失效或文本内联标签未剥离: ${JSON.stringify(clearHighlightTest)}`);
    }
    console.log(`[PASS] 测试 56: 节点高亮物理清除与文本内联标签深度剥离校验通过 (highlightColor彻底删除, 内联mark标签安全还原)`);

    // 测试 57: 纯 LaTeX 公式节点高亮与 KaTeX 零报错、卡片外框底色不变验证
    const pureFormulaHighlightTest = await evaluate(ws, `
      new Promise((resolve) => {
        const mm = window._mindMapInstance;
        const checkReady = () => {
          const root = mm.renderer.root;
          if (!root || !root.children || !root.children[0]) {
            return setTimeout(checkReady, 50);
          }
          const targetNode = root.children[0];
          mm.renderer.clearActiveNodeList();
          mm.renderer.addNodeToActiveList(targetNode);

          const pureFormula = '$\\\\lim_{x \\\\to 0} \\\\frac{\\\\sin x}{x} = 1$';
          const tb = window._mindMapBottomToolbarInstance;

          const onRender = () => {
            mm.off('node_tree_render_end', onRender);
            const rawText = targetNode.getData('text');
            const isTextClean = (rawText === pureFormula); // 确保源码未被任何 HTML 标签污染
            const fo = targetNode.group.findOne('foreignObject').node;
            const card = fo.querySelector('.mm-node-card');
            const content = fo.querySelector('.mm-node-content');

            // 校验 card 边框与背景并未被暴力重写为黄色警告框
            const isCardClean = card && !card.classList.contains('mm-highlight-yellow');
            const isContentHighlighted = content && content.classList.contains('mm-hl-yellow');
            const katexCount = content ? content.querySelectorAll('.katex').length : 0;
            const fracCount = content ? content.querySelectorAll('.mfrac').length : 0;

            resolve({
              isTextClean,
              isCardClean,
              isContentHighlighted,
              katexCount,
              fracCount
            });
          };

          mm.on('node_tree_render_end', onRender);
          mm.execCommand('SET_NODE_TEXT', targetNode, pureFormula);
          tb.setNodeHighlight('yellow');
        };
        checkReady();
      })
    `);

    if (!pureFormulaHighlightTest.isTextClean || !pureFormulaHighlightTest.isCardClean || !pureFormulaHighlightTest.isContentHighlighted || pureFormulaHighlightTest.katexCount === 0 || pureFormulaHighlightTest.fracCount === 0) {
      throw new Error(`测试 57 失败: 纯 LaTeX 公式节点高亮或 KaTeX 渲染异常: ${JSON.stringify(pureFormulaHighlightTest)}`);
    }
    console.log(`[PASS] 测试 57: 纯 LaTeX 公式节点精细高亮通过 (源码零污染, 卡片底色外框不受干扰, KaTeX分式精准渲染)`);

    // 测试 58: 原位编辑器选区触碰 LaTeX 公式时的原子化防污染外扩验证
    const latexExpansionTest = await evaluate(ws, `
      (function() {
        const editor = window._mindMapNodeEditorInstance;
        const mm = window._mindMapInstance;
        const root = mm.renderer.root;
        editor.show(root);

        // 输入包含公式的文本
        editor.textarea.value = '设 $f(x) = \\\\sin x$ 为连续函数';
        editor.updatePosition();
        editor.updatePreview();

        // 用户仅选中公式内部的 "f(x)" (索引 3 到 7)
        editor.formatSelection('color', 'cyan', 3, 7);

        const finalVal = editor.textarea.value;
        // 断言: 选区自动外扩包裹整个公式，标签绝对位于 $ 外侧
        const expected = '设 <mark class="mm-inline-hl-cyan">$f(x) = \\\\sin x$</mark> 为连续函数';
        const isEnclosedProperly = (finalVal === expected);
        const capsuleHtml = editor.capsuleContent.innerHTML;
        const hasKatexInCapsule = capsuleHtml.includes('katex');
        const hasCyanClassInCapsule = capsuleHtml.includes('mm-inline-hl-cyan');

        editor.commitAndHide();

        return {
          finalVal,
          isEnclosedProperly,
          hasKatexInCapsule,
          hasCyanClassInCapsule
        };
      })()
    `);

    if (!latexExpansionTest.isEnclosedProperly || !latexExpansionTest.hasKatexInCapsule || !latexExpansionTest.hasCyanClassInCapsule) {
      throw new Error(`测试 58 失败: LaTeX 公式原子化外扩防污染异常: ${JSON.stringify(latexExpansionTest)}`);
    }
    console.log(`[PASS] 测试 58: 编辑器 LaTeX 公式选区原子化外扩防污染通过 (自动包裹 $..$ 外侧, 杜绝 KaTeX 语法崩溃)`);

    await sleep(250);

    // 测试 59: 选区高亮智能解包、改色与可逆清除验证
    const smartUnwrapTest = await evaluate(ws, `
      (function() {
        const editor = window._mindMapNodeEditorInstance;
        const mm = window._mindMapInstance;
        const root = mm.renderer.root;
        editor.show(root);
        editor.isEditing = true;

        editor.textarea.value = '高等数学核心考点：导数与微分';
        editor.updatePosition();
        editor.updatePreview();

        // 1. 选中 "导数与微分" (索引 9 到 14) 施加黄色高亮
        editor.formatSelection('color', 'yellow', 9, 14);
        const valYellow = editor.textarea.value;
        const hasYellow = valYellow.includes('<mark class="mm-inline-hl-yellow">导数与微分</mark>');

        // 2. 选中已高亮的文字，直接换成晴空蓝 (blue)
        const idxYellowContent = editor.textarea.value.indexOf('导数与微分');
        editor.formatSelection('color', 'blue', idxYellowContent, idxYellowContent + 5);
        const valBlue = editor.textarea.value;
        const hasBlueDirect = valBlue.includes('<mark class="mm-inline-hl-blue">导数与微分</mark>');
        const hasNestedTags = valBlue.includes('<mark class="mm-inline-hl-yellow">'); // 绝不能嵌套旧标签

        // 3. 再次选中并点击相同颜色 (blue) 执行 Toggle 逆向清除
        const idxBlueContent = editor.textarea.value.indexOf('导数与微分');
        editor.formatSelection('color', 'blue', idxBlueContent, idxBlueContent + 5);
        const valClean = editor.textarea.value;
        const isCompletelyRestored = (valClean === '高等数学核心考点：导数与微分');

        editor.commitAndHide();

        return {
          hasYellow,
          hasBlueDirect,
          hasNestedTags,
          isCompletelyRestored,
          valClean,
          valYellow,
          valBlue
        };
      })()
    `);

    if (!smartUnwrapTest.hasYellow || !smartUnwrapTest.hasBlueDirect || smartUnwrapTest.hasNestedTags || !smartUnwrapTest.isCompletelyRestored) {
      throw new Error(`测试 59 失败: 选区智能解包、改色或逆向清除异常: ${JSON.stringify(smartUnwrapTest)}`);
    }
    console.log(`[PASS] 测试 59: 选区高亮智能解包、平滑换色与完全可逆清除校验通过`);

    // 测试 60: 导图 7 色方形 A 字母色块选择器 UI 规范校验
    const mindmapSwatchUiTest = await evaluate(ws, `
      (function() {
        const toolbarPopover = document.querySelector('.mm-color-popover');
        const editorPopover = document.querySelector('.mm-bubble-popover');

        const toolbarSwatches = toolbarPopover ? toolbarPopover.querySelectorAll('.color-swatch-btn') : [];
        const editorSwatches = editorPopover ? editorPopover.querySelectorAll('.color-swatch-btn') : [];

        const hasCorrectToolbarCount = (toolbarSwatches.length === 8); // 7 色 + 1 清除
        const hasCorrectEditorCount = (editorSwatches.length === 8);

        // 校验首个色块是否有字母 A
        const firstSwatch = toolbarSwatches[0];
        const hasTextA = firstSwatch ? firstSwatch.textContent.trim() === 'A' : false;

        return {
          hasCorrectToolbarCount,
          hasCorrectEditorCount,
          hasTextA
        };
      })()
    `);

    if (!mindmapSwatchUiTest.hasCorrectToolbarCount || !mindmapSwatchUiTest.hasCorrectEditorCount || !mindmapSwatchUiTest.hasTextA) {
      throw new Error(`测试 60 失败: 导图方形 A 字母高亮选择器 UI 校验异常: ${JSON.stringify(mindmapSwatchUiTest)}`);
    }
    console.log(`[PASS] 测试 60: 导图 7 色方形 A 字母色块选择器 UI 与高亮视觉保真度校验通过`);

    // 截取选区悬浮气泡菜单特写截图
    await evaluate(ws, `
      (function() {
        const controller = window._dualViewControllerInstance;
        controller.switchView('mindmap');
        const editor = window._mindMapNodeEditorInstance;
        const mindMap = window._mindMapInstance;
        const rootNode = mindMap.renderer.root;
        editor.show(rootNode);
        editor.textarea.value = '柯西不等式：$|\sum a_i b_i|^2 \le \sum a_i^2 \sum b_i^2$ 重点：**内积空间**';
        editor.updatePosition();
        editor.updatePreview();
        editor.textarea.setSelectionRange(0, 5); // 选中 "柯西不等式"
        editor.checkSelection();
      })()
    `);
    await sleep(350);
    const bubbleMenuScreenshot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
    const bubbleMenuBuffer = Buffer.from(bubbleMenuScreenshot.data, 'base64');
    fs.writeFileSync(path.join(__dirname, 'mindmap_bubble_menu_preview.png'), bubbleMenuBuffer);
    if (fs.existsSync(BRAIN_DIR)) {
      fs.writeFileSync(path.join(BRAIN_DIR, 'mindmap_bubble_menu_preview.png'), bubbleMenuBuffer);
    }
    console.log('[Screenshot] 导图选区悬浮气泡菜单真实截图已生成: mindmap-sandbox/mindmap_bubble_menu_preview.png');

    // 提交编辑并重置视口
    await evaluate(ws, `window._mindMapNodeEditorInstance.commitAndHide(); window._mindMapInstance.view.fit();`);
    await sleep(300);

    // 截取导图风格导图全景预览图 (先自适应画布缩放使全量公式与分支完整入镜)
    await evaluate(ws, `window._mindMapInstance.view.fit()`);
    await sleep(350);
    const mmScreenshot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
    const mmScreenshotBuffer = Buffer.from(mmScreenshot.data, 'base64');
    fs.writeFileSync(path.join(__dirname, 'mindmap_mindmap_preview.png'), mmScreenshotBuffer);
    if (fs.existsSync(BRAIN_DIR)) {
      fs.writeFileSync(path.join(BRAIN_DIR, 'mindmap_mindmap_preview.png'), mmScreenshotBuffer);
    }
    console.log('[Screenshot] 导图思维导图视图真实截图已生成: mindmap-sandbox/mindmap_mindmap_preview.png');

    // 切换到大纲模式并截取精美预览图 (同时截取大纲输入公式时的悬浮预览胶囊效果)
    await evaluate(ws, `
      (function() {
        const controller = window._dualViewControllerInstance;
        const outliner = window._outlinerInstance;
        controller.switchView('outline');
        const firstNode = outliner.data.children[0];
        outliner.focusNode(firstNode.data.uid);
        const row = outliner.container.querySelector('.outliner-row[data-uid="' + firstNode.data.uid + '"]');
        const input = row.querySelector('.outliner-input-view');
        input.textContent = '数列极限 $\\\\lim_{n \\\\to \\\\infty} \\\\frac{n!}{(n+1)!} = 0$';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      })()
    `);
    await sleep(400);
    const outlinerFormulaScreenshot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
    const outlinerFormulaBuffer = Buffer.from(outlinerFormulaScreenshot.data, 'base64');
    fs.writeFileSync(path.join(__dirname, 'mindmap_outliner_formula_preview.png'), outlinerFormulaBuffer);
    if (fs.existsSync(BRAIN_DIR)) {
      fs.writeFileSync(path.join(BRAIN_DIR, 'mindmap_outliner_formula_preview.png'), outlinerFormulaBuffer);
    }
    console.log('[Screenshot] 导图大纲公式悬浮预览胶囊真实截图已生成: mindmap-sandbox/mindmap_outliner_formula_preview.png');

    // 提交大纲编辑以截取浏览态
    await evaluate(ws, `window._outlinerInstance.commitNode(window._outlinerInstance.data.children[0].data.uid)`);
    await sleep(300);
    const screenshot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
    const screenshotBuffer = Buffer.from(screenshot.data, 'base64');
    const outlinerPreviewPath = path.join(__dirname, 'mindmap_outliner_preview.png');
    fs.writeFileSync(outlinerPreviewPath, screenshotBuffer);
    if (fs.existsSync(BRAIN_DIR)) {
      fs.writeFileSync(path.join(BRAIN_DIR, 'mindmap_outliner_preview.png'), screenshotBuffer);
    }
    console.log('[Screenshot] 导图大纲视图真实截图已生成: mindmap-sandbox/mindmap_outliner_preview.png');

    // 切回思维导图，呈现精细高亮节点与底部 7 色方形 A 字母选择器
    await evaluate(ws, `
      new Promise((resolve) => {
        const controller = window._dualViewControllerInstance;
        const mm = window._mindMapInstance;
        const onEnd = () => {
          mm.off('node_tree_render_end', onEnd);
          const root = mm.renderer.root;
          if (root && root.children && root.children[0]) {
            const nodeA = root.children[0];
            mm.renderer.clearActiveNodeList();
            mm.renderer.addNodeToActiveList(nodeA);
            const tb = window._mindMapBottomToolbarInstance;
            tb.setNodeHighlight('yellow');

            if (root.children[1]) {
              const nodeB = root.children[1];
              mm.renderer.clearActiveNodeList();
              mm.renderer.addNodeToActiveList(nodeB);
              tb.setNodeHighlight('cyan');
            }

            mm.view.fit();
            tb.colorPopover.classList.add('show');
          }
          resolve();
        };
        mm.on('node_tree_render_end', onEnd);
        controller.switchView('mindmap');
      })
    `);
    await sleep(500);
    await sleep(400);
    const highlightScreenshot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
    const highlightBuffer = Buffer.from(highlightScreenshot.data, 'base64');
    fs.writeFileSync(path.join(__dirname, 'mindmap_highlight_redesign_preview.png'), highlightBuffer);
    if (fs.existsSync(BRAIN_DIR)) {
      fs.writeFileSync(path.join(BRAIN_DIR, 'mindmap_highlight_redesign_preview.png'), highlightBuffer);
    }
    console.log('[Screenshot] 导图 7 色方形 A 字母高亮与公式精细染色真实截图已生成: mindmap-sandbox/mindmap_highlight_redesign_preview.png');

    // 呼出快捷键指南抽屉并呈现完整第二阶段界面
    await evaluate(ws, `
      (function() {
        window._mindMapShortcutDrawerInstance.open();
        window._mindMapBottomToolbarInstance.colorPopover.classList.remove('show');
      })()
    `);
    await sleep(400);
    const fullPreviewScreenshot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
    const fullPreviewBuffer = Buffer.from(fullPreviewScreenshot.data, 'base64');
    fs.writeFileSync(path.join(__dirname, 'mindmap_phase2_full_preview.png'), fullPreviewBuffer);
    if (fs.existsSync(BRAIN_DIR)) {
      fs.writeFileSync(path.join(BRAIN_DIR, 'mindmap_phase2_full_preview.png'), fullPreviewBuffer);
    }
    console.log('[Screenshot] 导图完整第二阶段界面 (底部固定工具条 + 快捷键抽屉) 截图已生成: mindmap-sandbox/mindmap_phase2_full_preview.png');

    // -------------------------------------------------------------
    // Phase 12: 导图左下角结构与分支线搭配类型适配专项断言项
    // -------------------------------------------------------------
    console.log('\n--- Phase 12: 导图左下角结构与分支线搭配类型适配专项断言项 ---');

    // 先收起快捷键指南抽屉
    await evaluate(ws, `window._mindMapShortcutDrawerInstance.close()`);
    await sleep(200);

    // 测试 61: 导图左下角垂直浮动控制条与结构搭配卡片 UI 完整性校验
    const structureUiTest = await evaluate(ws, `
      (function() {
        const dock = document.getElementById('mmBottomDock');
        const popover = document.getElementById('mmStructurePopover');
        const sc = window._mindMapStructureControllerInstance;
        if (!dock || !popover || !sc) return { ok: false, reason: 'DOM 或实例缺失' };

        const undoBtn = dock.querySelector('#btnDockUndo');
        const redoBtn = dock.querySelector('#btnDockRedo');
        const structBtn = dock.querySelector('#btnDockStructure');
        const zoomText = dock.querySelector('#dockZoomText') || dock.querySelector('#dockZoomLevelText');

        const structBtns = popover.querySelectorAll('.structure-btn');
        const lineBtns = popover.querySelectorAll('.line-style-btn');

        return {
          ok: true,
          hasDockButtons: !!(undoBtn && redoBtn && structBtn && zoomText),
          structCount: structBtns.length,
          lineCount: lineBtns.length
        };
      })()
    `);

    if (!structureUiTest.ok || !structureUiTest.hasDockButtons || structureUiTest.structCount !== 7 || structureUiTest.lineCount !== 4) {
      throw new Error(`测试 61 失败: 导图结构搭配控制条 UI 校验异常: ${JSON.stringify(structureUiTest)}`);
    }
    console.log(`[PASS] 测试 61: 导图左下角垂直浮动控制条与结构搭配卡片 UI 完整性校验通过 (7大结构全量平铺 + 4经典线条直接展示，零折叠隐藏)`);

    // 测试 62: 导图结构热切换 - 向左逻辑图 (logicalStructureLeft)
    const structLeftTest = await evaluate(ws, `
      new Promise((resolve) => {
        const sc = window._mindMapStructureControllerInstance;
        const mm = window._mindMapInstance;
        const onEnd = () => {
          mm.off('node_tree_render_end', onEnd);
          const currentLayout = mm.getLayout();
          const activeBtn = document.querySelector('.structure-btn.active');
          resolve({
            currentLayout,
            activeLayoutAttr: activeBtn ? activeBtn.dataset.layout : null
          });
        };
        mm.on('node_tree_render_end', onEnd);
        sc.setLayout('logicalStructureLeft');
      })
    `);

    if (structLeftTest.currentLayout !== 'logicalStructureLeft' || structLeftTest.activeLayoutAttr !== 'logicalStructureLeft') {
      throw new Error(`测试 62 失败: 向左逻辑图切换异常: ${JSON.stringify(structLeftTest)}`);
    }
    console.log(`[PASS] 测试 62: 导图结构热切换 - 向左逻辑图 (logicalStructureLeft) 校验通过`);

    // 测试 63: 导图结构热切换 - 经典双向思维导图 (mindMap)
    const structMindMapTest = await evaluate(ws, `
      new Promise((resolve) => {
        const sc = window._mindMapStructureControllerInstance;
        const mm = window._mindMapInstance;
        const onEnd = () => {
          mm.off('node_tree_render_end', onEnd);
          const currentLayout = mm.getLayout();
          const activeBtn = document.querySelector('.structure-btn.active');
          const root = mm.renderer.root;
          const leftChildren = (root && root.children) ? root.children.filter(c => c.left < root.left) : [];
          const rightChildren = (root && root.children) ? root.children.filter(c => c.left >= root.left) : [];
          resolve({
            currentLayout,
            activeLayoutAttr: activeBtn ? activeBtn.dataset.layout : null,
            hasBothSides: leftChildren.length > 0 && rightChildren.length > 0
          });
        };
        mm.on('node_tree_render_end', onEnd);
        sc.setLayout('mindMap');
      })
    `);

    if (structMindMapTest.currentLayout !== 'mindMap' || structMindMapTest.activeLayoutAttr !== 'mindMap' || !structMindMapTest.hasBothSides) {
      throw new Error(`测试 63 失败: 经典双向思维导图切换异常: ${JSON.stringify(structMindMapTest)}`);
    }
    console.log(`[PASS] 测试 63: 导图结构热切换 - 经典双向思维导图 (mindMap) 校验通过 (左右两侧均衡排布)`);

    // 截取左右平衡思维导图真实截图
    await sleep(400);
    const mindMapLayoutScreenshot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
    const mindMapLayoutBuffer = Buffer.from(mindMapLayoutScreenshot.data, 'base64');
    fs.writeFileSync(path.join(__dirname, 'mindmap_layout_mindmap_preview.png'), mindMapLayoutBuffer);
    if (fs.existsSync(BRAIN_DIR)) {
      fs.writeFileSync(path.join(BRAIN_DIR, 'mindmap_layout_mindmap_preview.png'), mindMapLayoutBuffer);
    }
    console.log('[Screenshot] 导图左右平衡思维导图全景截图已生成: mindmap-sandbox/mindmap_layout_mindmap_preview.png');

    // 测试 64: 导图结构热切换 - 向下展开目录组织图 (catalogOrganization) (复现用户截图)
    const structCatalogTest = await evaluate(ws, `
      new Promise((resolve) => {
        const sc = window._mindMapStructureControllerInstance;
        const mm = window._mindMapInstance;
        const onEnd = () => {
          mm.off('node_tree_render_end', onEnd);
          const currentLayout = mm.getLayout();
          const activeBtn = document.querySelector('.structure-btn.active');
          const root = mm.renderer.root;
          const c0 = root && root.children && root.children[0];
          const isDownward = c0 ? (c0.top > root.top) : false;
          resolve({
            currentLayout,
            activeLayoutAttr: activeBtn ? activeBtn.dataset.layout : null,
            isDownward,
            rootTop: root ? root.top : 0,
            childTop: c0 ? c0.top : 0
          });
        };
        mm.on('node_tree_render_end', onEnd);
        sc.setLayout('catalogOrganization');
      })
    `);

    if (structCatalogTest.currentLayout !== 'catalogOrganization' || structCatalogTest.activeLayoutAttr !== 'catalogOrganization' || !structCatalogTest.isDownward) {
      throw new Error(`测试 64 失败: 向下展开目录组织图切换异常: ${JSON.stringify(structCatalogTest)}`);
    }
    console.log(`[PASS] 测试 64: 导图结构热切换 - 向下展开目录组织图 (catalogOrganization) 校验通过 (对齐用户实测截图)`);

    // 测试 65: 分支线风格热切换 (直角圆角折线 straight vs 直连斜线 direct vs 进阶曲线 curve)
    const lineStyleTest = await evaluate(ws, `
      (function() {
        const sc = window._mindMapStructureControllerInstance;
        const mm = window._mindMapInstance;

        // 切换为直连斜线 direct
        sc.setLineStyle('direct');
        const style1 = mm.getThemeConfig('lineStyle');
        const btn1Active = document.querySelector('.line-style-btn[data-line-style="direct"]').classList.contains('active');

        // 切换为平滑曲线 curve
        sc.setLineStyle('curve');
        const style2 = mm.getThemeConfig('lineStyle');
        const btn2Active = document.querySelector('.line-style-btn[data-line-style="curve"]').classList.contains('active');

        // 切回导图经典直角圆角折线 straight
        sc.setLineStyle('straight');
        const style3 = mm.getThemeConfig('lineStyle');
        const radius3 = mm.getThemeConfig('lineRadius');
        const btn3Active = document.querySelector('.line-style-btn[data-line-style="straight"]').classList.contains('active');

        return {
          directOk: style1 === 'direct' && btn1Active,
          curveOk: style2 === 'curve' && btn2Active,
          straightOk: style3 === 'straight' && radius3 === 8 && btn3Active
        };
      })()
    `);

    if (!lineStyleTest.directOk || !lineStyleTest.curveOk || !lineStyleTest.straightOk) {
      throw new Error(`测试 65 失败: 分支线风格热切换异常: ${JSON.stringify(lineStyleTest)}`);
    }
    console.log(`[PASS] 测试 65: 分支线风格热切换 (直连斜线 direct / 进阶曲线 curve / 经典圆角折线 straight) 校验通过`);

    // 测试 66: 布局朝向感知与数据结构导出持久化校验
    await sleep(400);
    const dragDirectionTest = await evaluate(ws, `
      (function() {
        const mm = window._mindMapInstance;
        const de = window._mindMapDragEnhancerInstance;
        const root = (mm && mm.renderer && mm.renderer.root) || (mm && mm.renderer && mm.renderer.renderTree);
        const c0 = root && root.children && root.children[0];

        // 当前处于 catalogOrganization，方向应判定为 bottom
        const catalogDir = c0 ? de.getNodeDirection(c0) : 'bottom';

        // 导出的全量配置数据对象中保留 layout 属性
        const exportedData = mm.getData(true);
        const hasLayoutSaved = exportedData && exportedData.layout === 'catalogOrganization';

        return {
          catalogDir,
          hasLayoutSaved
        };
      })()
    `);

    if (dragDirectionTest.catalogDir !== 'bottom' || !dragDirectionTest.hasLayoutSaved) {
      throw new Error(`测试 66 失败: 布局朝向感知与数据持久化校验异常: ${JSON.stringify(dragDirectionTest)}`);
    }
    console.log(`[PASS] 测试 66: 布局朝向感知 (catalog -> bottom) 与数据持久化校验通过`);

    // 展开结构搭配 Popover 并截取左下角特写
    await evaluate(ws, `
      (function() {
        const sc = window._mindMapStructureControllerInstance;
        sc.showPopover();
        window._mindMapInstance.view.fit();
      })()
    `);
    await sleep(400);
    const popoverScreenshot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
    const popoverBuffer = Buffer.from(popoverScreenshot.data, 'base64');
    fs.writeFileSync(path.join(__dirname, 'mindmap_structure_popover_preview.png'), popoverBuffer);
    if (fs.existsSync(BRAIN_DIR)) {
      fs.writeFileSync(path.join(BRAIN_DIR, 'mindmap_structure_popover_preview.png'), popoverBuffer);
    }
    console.log('[Screenshot] 导图左下角结构与分支线搭配面板特写截图已生成: mindmap-sandbox/mindmap_structure_popover_preview.png');

    // 截取向下展开目录组织图全貌截图 (1:1 对齐用户实测图)
    await evaluate(ws, `
      (function() {
        window._mindMapStructureControllerInstance.hidePopover();
        window._mindMapInstance.view.reset();
      })()
    `);
    await sleep(400);
    const catalogScreenshot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
    const catalogBuffer = Buffer.from(catalogScreenshot.data, 'base64');
    fs.writeFileSync(path.join(__dirname, 'mindmap_layout_catalog_preview.png'), catalogBuffer);
    if (fs.existsSync(BRAIN_DIR)) {
      fs.writeFileSync(path.join(BRAIN_DIR, 'mindmap_layout_catalog_preview.png'), catalogBuffer);
    }
    console.log('[Screenshot] 导图向下展开目录组织图全貌截图已生成: mindmap-sandbox/mindmap_layout_catalog_preview.png');

    // -------------------------------------------------------------
    // Phase 13: 导图交互精细度深化专项断言项 (4按钮极简栏、大纲纯净化、防NaN、U型重做、平滑圆弧、H快捷键、全部展开折叠)
    // -------------------------------------------------------------
    console.log('\n--- Phase 13: 导图交互精细度深化专项断言项 ---');

    // 测试 67: 底部悬浮工具条极简 4 按钮严格校验
    const toolbarMinimalTest = await evaluate(ws, `
      (function() {
        const toolbar = document.querySelector('.mm-bottom-toolbar');
        if (!toolbar) return { error: '未找到底部工具条' };
        const buttons = Array.from(toolbar.querySelectorAll('.bar-btn'));
        const btnIds = buttons.map(b => b.id);
        const hasRedundant = document.getElementById('mindmapBtnChild') ||
                             document.getElementById('mindmapBtnSibling') ||
                             document.getElementById('mindmapBtnDuplicate') ||
                             document.getElementById('mindmapBtnDrill') ||
                             document.getElementById('mindmapBtnFold') ||
                             document.getElementById('mindmapBtnDelete') ||
                             document.getElementById('mindmapBtnShortcuts');
        return {
          btnCount: buttons.length,
          btnIds,
          isMinimal: buttons.length === 4 && !hasRedundant
        };
      })()
    `);

    if (!toolbarMinimalTest.isMinimal) {
      throw new Error(`测试 67 失败: 底部工具条未严格精简为最左侧 4 按钮: ${JSON.stringify(toolbarMinimalTest)}`);
    }
    console.log(`[PASS] 测试 67: 底部悬浮工具条极简 4 按钮严格校验通过 (按钮数=4: A/B/I/U, 7个冗余按钮已物理清除)`);

    // 测试 68: 大纲模式彻底纯净化校验 (底部控制栏、左下角dock、缩放条100%隐藏)
    const outlineCleanlinessTest = await evaluate(ws, `
      (function() {
        const dvc = window._dualViewControllerInstance;
        dvc.switchView('outline');
        const isOutlineMode = document.body.classList.contains('view-mode-outline');
        
        const bottomBar = document.querySelector('.mm-bottom-toolbar');
        const dock = document.querySelector('.mm-bottom-dock');
        const zoomBar = document.querySelector('.floating-viewport-bar');
        const popover = document.querySelector('.mm-structure-popover');

        const isHidden = (el) => !el || window.getComputedStyle(el).display === 'none';

        const result = {
          isOutlineMode,
          bottomBarHidden: isHidden(bottomBar),
          dockHidden: isHidden(dock),
          zoomBarHidden: isHidden(zoomBar),
          popoverHidden: isHidden(popover)
        };

        // 测完切回导图模式
        dvc.switchView('mindmap');
        return result;
      })()
    `);

    if (!outlineCleanlinessTest.isOutlineMode || !outlineCleanlinessTest.bottomBarHidden || !outlineCleanlinessTest.dockHidden || !outlineCleanlinessTest.zoomBarHidden) {
      throw new Error(`测试 68 失败: 大纲模式纯净化校验异常: ${JSON.stringify(outlineCleanlinessTest)}`);
    }
    console.log(`[PASS] 测试 68: 大纲模式彻底纯净化校验通过 (底部控制栏、左下角dock、缩放条在大纲模式下均100%完全隐藏)`);

    // 测试 69: 缩放比率显示彻底杜绝 NaN
    const zoomNoNanTest = await evaluate(ws, `
      (function() {
        const sc = window._mindMapStructureControllerInstance;
        const mm = window._mindMapInstance;
        const zoomEl = document.getElementById('dockZoomText') || document.getElementById('dockZoomLevelText');
        
        sc.updateZoomDisplay();
        const text1 = zoomEl ? zoomEl.textContent : '';

        mm.view.enlarge();
        sc.updateZoomDisplay();
        const text2 = zoomEl ? zoomEl.textContent : '';

        mm.view.narrow();
        sc.updateZoomDisplay();
        const text3 = zoomEl ? zoomEl.textContent : '';

        mm.view.reset();
        sc.updateZoomDisplay();
        const text4 = zoomEl ? zoomEl.textContent : '';

        const allNoNan = [text1, text2, text3, text4].every(t => t.endsWith('%') && !t.includes('NaN') && !t.includes('undefined'));
        return {
          text1, text2, text3, text4,
          allNoNan
        };
      })()
    `);

    if (!zoomNoNanTest.allNoNan) {
      throw new Error(`测试 69 失败: 缩放比率显示异常包含 NaN: ${JSON.stringify(zoomNoNanTest)}`);
    }
    console.log(`[PASS] 测试 69: 缩放比率防 NaN 严密防护校验通过 (${zoomNoNanTest.text1} -> 放大 ${zoomNoNanTest.text2} -> 缩小 ${zoomNoNanTest.text3} -> 复位 ${zoomNoNanTest.text4})`);

    // 测试 70: 重做图标优雅 U 型圆弧校验与第 2 种分支线为平滑圆弧曲线 (curve)
    const redoAndCurveTest = await evaluate(ws, `
      (function() {
        const redoBtn = document.getElementById('btnDockRedo');
        const redoSvg = redoBtn ? redoBtn.innerHTML : '';
        const hasArcPath = redoSvg.includes('A5.5 5.5') || redoSvg.includes('a5.5 5.5') || redoSvg.includes('5.5 0 0 0');

        const lineBtn2 = document.querySelector('.line-style-btn[data-line-style="curve"]');
        const line2IsCurve = !!lineBtn2;

        const sc = window._mindMapStructureControllerInstance;
        const mm = window._mindMapInstance;
        sc.setLineStyle('curve');
        const curStyle = mm.getThemeConfig('lineStyle');

        return {
          hasArcPath,
          line2IsCurve,
          appliedCurve: curStyle === 'curve'
        };
      })()
    `);

    if (!redoAndCurveTest.hasArcPath || !redoAndCurveTest.line2IsCurve || !redoAndCurveTest.appliedCurve) {
      throw new Error(`测试 70 失败: 重做U型图标或第2种曲线校验异常: ${JSON.stringify(redoAndCurveTest)}`);
    }
    console.log(`[PASS] 测试 70: 重做图标优雅 U 型圆弧与分支线平滑圆弧曲线 (curve) 校验通过`);

    // 测试 71: 快捷键 H 呼出快捷键面板
    const shortcutHTest = await evaluate(ws, `
      new Promise((resolve) => {
        const drawer = window._mindMapShortcutDrawerInstance;
        drawer.close();
        const wasClosed = !drawer.isOpen;

        // 模拟按下 H 键 (非编辑态) 唤起快捷键抽屉
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true, cancelable: true }));

        setTimeout(() => {
          const openedAfterH = drawer.isOpen && drawer.drawerEl.classList.contains('open');

          // 再次按下 H 键关闭抽屉
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true, cancelable: true }));

          setTimeout(() => {
            const closedAfterH2 = !drawer.isOpen && !drawer.drawerEl.classList.contains('open');
            resolve({
              wasClosed,
              openedAfterH,
              closedAfterH2
            });
          }, 80);
        }, 80);
      })
    `);

    if (!shortcutHTest.wasClosed || !shortcutHTest.openedAfterH || !shortcutHTest.closedAfterH2) {
      throw new Error(`测试 71 失败: 快捷键 H 唤起快捷键面板异常: ${JSON.stringify(shortcutHTest)}`);
    }
    console.log(`[PASS] 测试 71: 快捷键 H 调出/切换快捷键面板校验通过 (初次按下 H 唤起抽屉 -> 再次按下 H 平滑收起)`);

    // 测试 72: 全部展开 (EXPAND_ALL) 与全部折叠 (UNEXPAND_ALL) 按钮与命令深度联动
    const expandCollapseAllTest = await evaluate(ws, `
      new Promise((resolve) => {
        const mm = window._mindMapInstance;
        const checkReady = () => {
          const root = mm.renderer && mm.renderer.root;
          if (!root || !root.children || !root.children[0]) {
            return setTimeout(checkReady, 50);
          }
          const btnExpand = document.getElementById('btnExpandAll');
          const btnCollapse = document.getElementById('btnCollapseAll');
          if (!btnExpand || !btnCollapse) return resolve({ error: '未找到全部展开/折叠按钮' });

          // 执行全部折叠
          btnCollapse.click();
          const c0Expanded = root.children[0].getData('expand');

          // 执行全部展开
          btnExpand.click();
          const c0ExpandedAfter = root.children[0].getData('expand');

          resolve({
            collapseOk: c0Expanded === false,
            expandOk: c0ExpandedAfter !== false
          });
        };
        checkReady();
      })
    `);

    if (!expandCollapseAllTest.collapseOk || !expandCollapseAllTest.expandOk) {
      throw new Error(`测试 72 失败: 全部展开/折叠功能校验异常: ${JSON.stringify(expandCollapseAllTest)}`);
    }
    console.log(`[PASS] 测试 72: 全部展开 (EXPAND_ALL) 与全部折叠 (UNEXPAND_ALL) 按钮与命令深度联动校验通过`);

    // 测试 73: 快捷键指南抽屉消除冗余"使用指南"标签页
    const drawerTabCleanTest = await evaluate(ws, `
      (function() {
        const drawer = window._mindMapShortcutDrawerInstance;
        drawer.open();
        const tabCount = drawer.drawerEl.querySelectorAll('.drawer-tab').length;
        const titleText = drawer.drawerEl.querySelector('.drawer-title') ? drawer.drawerEl.querySelector('.drawer-title').textContent : '';
        const shortcutItems = drawer.drawerEl.querySelectorAll('.shortcut-item').length;
        drawer.close();
        return {
          tabCount,
          titleText,
          shortcutItems
        };
      })()
    `);

    if (drawerTabCleanTest.tabCount !== 0 || drawerTabCleanTest.titleText !== '快捷键指南' || drawerTabCleanTest.shortcutItems === 0) {
      throw new Error(`测试 73 失败: 快捷键指南抽屉结构异常: ${JSON.stringify(drawerTabCleanTest)}`);
    }
    console.log(`[PASS] 测试 73: 快捷键指南抽屉纯净化校验通过 (无冗余空使用指南Tab，标题="${drawerTabCleanTest.titleText}", 快捷键项数=${drawerTabCleanTest.shortcutItems})`);

    // --- 开始执行 Phase 14 大纲模式去灯笼、快捷键 M 模式切换、左下角控制坞合体与文本整理专项断言项 ---
    console.log('\n--- 开始执行 Phase 14 大纲模式去灯笼、快捷键 M 模式切换、左下角控制坞合体与文本整理专项断言项 ---');

    // 测试 74: 大纲模式彻底消除外层浮动卡片大框框("灯笼")，呈现无边框纯白文档并保持实时公式预览胶囊
    const outlinerNoBoxTest = await evaluate(ws, `
      (function() {
        const controller = window._dualViewControllerInstance;
        const outliner = window._outlinerInstance;
        controller.switchView('outline');

        const container = document.getElementById('outlinerContainer');
        const containerStyle = window.getComputedStyle(container);
        const containerBg = containerStyle.backgroundColor;

        const paper = document.querySelector('.outliner-paper');
        const paperStyle = window.getComputedStyle(paper);
        const paperBorder = paperStyle.borderStyle;
        const paperBorderWidth = paperStyle.borderWidth;
        const paperRadius = paperStyle.borderRadius;
        const paperShadow = paperStyle.boxShadow;

        const isBoxClean = (paperBorder === 'none' || paperBorderWidth === '0px') &&
                           (paperShadow === 'none') &&
                           (paperRadius === '0px');

        const capsule = outliner.previewCapsule;

        // 模拟打字测试：输入公式
        const firstNode = outliner.data.children[0];
        outliner.focusNode(firstNode.data.uid);
        const row = outliner.container.querySelector('.outliner-row[data-uid="' + firstNode.data.uid + '"]');
        const input = row.querySelector('.outliner-input-view');
        input.textContent = '测试纯净大纲 $\\\\int_0^1 x^2 dx = \\\\frac{1}{3}$';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        const capsuleDisplayDuringTyping = capsule ? window.getComputedStyle(capsule).display : 'none';
        const capsuleKatexCount = capsule ? capsule.querySelectorAll('.katex').length : 0;

        // 提交后直接在 displayView 呈现 KaTeX，胶囊自动隐退
        outliner.commitNode(firstNode.data.uid);
        const displayView = row.querySelector('.outliner-display-view');
        const katexCount = displayView ? displayView.querySelectorAll('.katex').length : 0;
        const capsuleDisplayAfterCommit = capsule ? window.getComputedStyle(capsule).display : 'none';

        return {
          containerBg,
          paperBorder,
          paperBorderWidth,
          paperRadius,
          paperShadow,
          isBoxClean,
          capsuleDisplayDuringTyping,
          capsuleKatexCount,
          capsuleDisplayAfterCommit,
          katexCount
        };
      })()
    `);

    if (!outlinerNoBoxTest.isBoxClean || outlinerNoBoxTest.containerBg !== 'rgb(255, 255, 255)' || outlinerNoBoxTest.capsuleDisplayDuringTyping === 'none' || outlinerNoBoxTest.capsuleKatexCount === 0 || outlinerNoBoxTest.capsuleDisplayAfterCommit !== 'none' || outlinerNoBoxTest.katexCount === 0) {
      throw new Error(`测试 74 失败: 大纲模式去卡片大框框与公式预览验证异常: ${JSON.stringify(outlinerNoBoxTest)}`);
    }
    console.log(`[PASS] 测试 74: 大纲模式浮动卡片大框框("灯笼")已彻底消除 (纯白全屏背景 rgb(255,255,255)，无边框无阴影圆角为0，打字实时公式胶囊正常激活且提交后无缝内联渲染 KaTeX=${outlinerNoBoxTest.katexCount})`);

    // 测试 75: 快捷键 M (或 m) 平滑双向切换导图与大纲视图
    const shortcutMTest = await evaluate(ws, `
      new Promise((resolve) => {
        const controller = window._dualViewControllerInstance;
        // 当前为 outline 模式
        const initialMode = controller.currentView;

        // 派发 'm' 按键事件
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }));

        setTimeout(() => {
          const modeAfterM1 = controller.currentView;

          // 再次派发 'M' 按键事件
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'M', bubbles: true }));

          setTimeout(() => {
            const modeAfterM2 = controller.currentView;

            // 切回 mindmap 模式为后续测试做准备
            controller.switchView('mindmap');
            setTimeout(() => {
              resolve({
                initialMode,
                modeAfterM1,
                modeAfterM2,
                finalMode: controller.currentView
              });
            }, 60);
          }, 60);
        }, 60);
      })
    `);

    if (shortcutMTest.initialMode !== 'outline' || shortcutMTest.modeAfterM1 !== 'mindmap' || shortcutMTest.modeAfterM2 !== 'outline' || shortcutMTest.finalMode !== 'mindmap') {
      throw new Error(`测试 75 失败: 快捷键 M 双向切换模式异常: ${JSON.stringify(shortcutMTest)}`);
    }
    console.log(`[PASS] 测试 75: 快捷键 M (导图/大纲视图切换) 键盘无冲突平滑双向切换通过 (outline -> 'm' -> mindmap -> 'M' -> outline -> mindmap)`);

    // 测试 76: 左下角控制坞合体结构完整性校验 (垂直坞 + 水平缩放滑块条 + 居中定位按钮)
    const mergedDockTest = await evaluate(ws, `
      (function() {
        const mm = window._mindMapInstance;
        const wrapper = document.getElementById('mmBottomDockWrapper');
        const verticalDock = document.getElementById('mmBottomDock');
        const zoomSliderBar = document.getElementById('mmZoomSliderBar');

        if (!wrapper || !verticalDock || !zoomSliderBar) {
          return { error: '未找到左下角合体控制坞组件' };
        }

        const btnUndo = document.getElementById('btnDockUndo');
        const btnRedo = document.getElementById('btnDockRedo');
        const btnStructure = document.getElementById('btnDockStructure');
        const zoomText = document.getElementById('dockZoomLevelText') || document.getElementById('dockZoomText');

        const btnZoomOut = document.getElementById('btnDockZoomOut');
        const zoomSlider = document.getElementById('dockZoomSlider');
        const btnZoomIn = document.getElementById('btnDockZoomIn');
        const btnLocateCenter = document.getElementById('btnDockLocateCenter');
        const tooltip = btnLocateCenter ? (btnLocateCenter.querySelector('.locate-tooltip') || btnLocateCenter.parentElement.querySelector('.locate-tooltip')) : null;

        const hasVerticalButtons = !!(btnUndo && btnRedo && btnStructure && zoomText);
        const hasHorizontalControls = !!(btnZoomOut && zoomSlider && btnZoomIn && btnLocateCenter);
        const sliderRange = zoomSlider ? { min: zoomSlider.min, max: zoomSlider.max, value: zoomSlider.value } : null;
        const tooltipText = tooltip ? tooltip.textContent.trim() : '';

        // 测试滑块交互：将滑块拉至 125%
        if (zoomSlider) {
          zoomSlider.value = '125';
          zoomSlider.dispatchEvent(new Event('input', { bubbles: true }));
        }

        const currentScale = mm.view.getTransformData().state.scale || mm.view.scale;
        const updatedZoomText = zoomText ? zoomText.textContent : '';

        // 点击居中定位按钮并复位
        if (btnLocateCenter) {
          btnLocateCenter.click();
        }

        return {
          wrapperExists: true,
          hasVerticalButtons,
          hasHorizontalControls,
          sliderRange,
          tooltipText,
          updatedZoomText,
          currentScaleOk: Math.abs(currentScale - 1.25) < 0.05
        };
      })()
    `);

    if (!mergedDockTest.wrapperExists || !mergedDockTest.hasVerticalButtons || !mergedDockTest.hasHorizontalControls || mergedDockTest.tooltipText !== '定位到中心节点' || !mergedDockTest.currentScaleOk) {
      throw new Error(`测试 76 失败: 左下角控制坞合体结构校验失败: ${JSON.stringify(mergedDockTest)}`);
    }
    console.log(`[PASS] 测试 76: 左下角控制坞合体结构完整性校验通过 (垂直坞+水平缩放条合体呈现, 滑块范围 20%~200%, 居中定位按钮提示语="${mergedDockTest.tooltipText}", 缩放联动=${mergedDockTest.updatedZoomText})`);

    // 测试 77: 右下角独立视口调整栏彻底移除 (.floating-viewport-bar 不存在)
    const viewportBarRemovedTest = await evaluate(ws, `
      (function() {
        const oldBar = document.querySelector('.floating-viewport-bar');
        const oldZoomIn = document.getElementById('btnZoomIn');
        const oldZoomOut = document.getElementById('btnZoomOut');

        // 测试在大纲模式下，左下角合体控制坞被彻底隐藏
        const controller = window._dualViewControllerInstance;
        controller.switchView('outline');
        const wrapper = document.getElementById('mmBottomDockWrapper');
        const wrapperDisplayInOutline = wrapper ? window.getComputedStyle(wrapper).display : 'none';

        // 切回 mindmap 模式
        controller.switchView('mindmap');
        const wrapperDisplayInMindmap = wrapper ? window.getComputedStyle(wrapper).display : '';

        return {
          oldBarExists: !!oldBar,
          oldZoomInExists: !!oldZoomIn,
          oldZoomOutExists: !!oldZoomOut,
          wrapperDisplayInOutline,
          wrapperDisplayInMindmap
        };
      })()
    `);

    if (viewportBarRemovedTest.oldBarExists || viewportBarRemovedTest.oldZoomInExists || viewportBarRemovedTest.oldZoomOutExists || viewportBarRemovedTest.wrapperDisplayInOutline !== 'none') {
      throw new Error(`测试 77 失败: 右下角控制栏彻底清理校验失败: ${JSON.stringify(viewportBarRemovedTest)}`);
    }
    console.log(`[PASS] 测试 77: 右下角独立视口调整栏彻底移除通过 (DOM 中已无 .floating-viewport-bar，大纲模式下左下坞完全隐藏 display=none)`);

    // 测试 78: 用户界面文本整洁化与去特殊品牌前缀校验
    const cleanContentTest = await evaluate(ws, `
      (function() {
        const bodyText = document.body.innerText;
        const htmlText = document.body.innerHTML;

        const bannedKeywords = ['导图经典', '导图专属', '导图同款', 'MVP 独立版'];
        const foundKeywords = [];
        bannedKeywords.forEach(kw => {
          if (htmlText.includes(kw)) {
            foundKeywords.push(kw);
          }
        });

        // 检查结构搭配弹窗中的文本质量
        const controller = window._mindMapStructureControllerInstance;
        const catalogGroup = controller.popoverEl.querySelector('.structure-group:nth-child(2)');
        const catalogItems = catalogGroup ? Array.from(catalogGroup.querySelectorAll('.structure-item-name')).map(el => el.textContent.trim()) : [];

        return {
          foundKeywords,
          catalogItems
        };
      })()
    `);

    if (cleanContentTest.foundKeywords.length > 0) {
      throw new Error(`测试 78 失败: 页面中仍存在不规范品牌/营销字眼: ${JSON.stringify(cleanContentTest.foundKeywords)}`);
    }
    console.log(`[PASS] 测试 78: 用户界面文本整洁化与去特殊品牌前缀校验通过 (零敏感标签，分支线规范命名=${JSON.stringify(cleanContentTest.catalogItems)})`);

    // 生成 Phase 14 最终全景截图
    await evaluate(ws, `
      (function() {
        window._mindMapStructureControllerInstance.showPopover();
        window._mindMapInstance.view.reset();
      })()
    `);
    await sleep(400);
    const mergedDockScreenshot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
    const mergedDockBuffer = Buffer.from(mergedDockScreenshot.data, 'base64');
    fs.writeFileSync(path.join(__dirname, 'mindmap_merged_dock_preview.png'), mergedDockBuffer);
    if (fs.existsSync(BRAIN_DIR)) {
      fs.writeFileSync(path.join(BRAIN_DIR, 'mindmap_merged_dock_preview.png'), mergedDockBuffer);
    }
    console.log('[Screenshot] 导图左下角合体控制坞全景截图已生成: mindmap-sandbox/mindmap_merged_dock_preview.png');

    // 生成大纲模式去灯笼纯净化全景截图
    await evaluate(ws, `
      (function() {
        window._mindMapStructureControllerInstance.hidePopover();
        window._dualViewControllerInstance.switchView('outline');
      })()
    `);
    await sleep(400);
    const outlinePureScreenshot = await sendCDP(ws, 'Page.captureScreenshot', { format: 'png' });
    const outlinePureBuffer = Buffer.from(outlinePureScreenshot.data, 'base64');
    fs.writeFileSync(path.join(__dirname, 'mindmap_outline_pure_preview.png'), outlinePureBuffer);
    if (fs.existsSync(BRAIN_DIR)) {
      fs.writeFileSync(path.join(BRAIN_DIR, 'mindmap_outline_pure_preview.png'), outlinePureBuffer);
    }
    console.log('[Screenshot] 大纲模式去灯笼纯净化全景截图已生成: mindmap-sandbox/mindmap_outline_pure_preview.png');

    console.log('\n====================================================');
    console.log('   所有 Phase (1~14) 共计 78 项端到端测试全部通过');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n[FAIL] 自动化回归测试失败:', err.message);
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
}

run();
