---
name: cdp-e2e-verification
description: >-
  Standard workflow for verifying frontend changes in index.html, question bank,
  and mindmap views using Chrome DevTools Protocol (CDP) automated scripts and
  view_file visual inspection. Activate this skill whenever testing or verifying UI,
  DOM state, keyboard shortcuts, or data integrity.
---

# CDP 自动化与视觉双重验证工作流 (CDP E2E & Visual Verification)

修改 [`index.html`](file:///d:/tj/822/考研题库/index.html)、`js/*.js` 或 `css/*.css` 后，必须通过 **「现有自动化测试套件 + CDP 状态/异常断言 + `view_file` 截图目视检查」** 验证无误后方可提交。

---

## 1. 现成自动化测试套件（优先运行）

在项目根目录下可直接运行以下测试脚本：
- `node tests/unit_tests.js`：章节配置完整性、伴章挂载、路由与数据结构单元测试。
- `node tests/storage_test.js`：`kaoyan_tiku_data.json` 存储引擎、状态流转与备份测试。
- `node tests/cdp_e2e_tests.js`：题库主界面端到端 CDP 自动化测试。
- `node tests/test_chapter1_prototype.js`：`O` 键认知思维导图、快捷键与关联线 CDP 测试。

---

## 2. 编写自定义 CDP 验证脚本规范

### 2.1 前置环境
- **Chrome 路径**：`C:/Program Files/Google/Chrome/Application/chrome.exe`
- **WebSocket 模块**：`C:/Users/Zhangwh/.claude/tmp-cdp/node_modules/ws`
- **视觉检查能力**：当前环境**支持 `view_file` 直接查看 PNG/JPG/PDF**。对布局、连线、排版、裁切图片的修改，可在 CDP 中调用 `Page.captureScreenshot` 保存到临时文件并用 `view_file` 目视核验。

### 2.2 标准 CDP 脚本骨架与三条命门

```javascript
const http = require('http');
const fs = require('fs');
const WS = require('C:/Users/Zhangwh/.claude/tmp-cdp/node_modules/ws');
const { execSync, spawn } = require('child_process');
const timeout = ms => new Promise(r => setTimeout(r, ms));

function getJson(url) {
  return new Promise((res, rej) => {
    http.get(url, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
}

(async () => {
  const PORT = 9225; // ★ 命门1：每次换端口避开 TIME_WAIT (9225/9226/9227...)
  const PROFILE = 'C:/Users/Zhangwh/.claude/tmp-cdp/chrome-profile-test';
  const URL = 'file:///D:/tj/822/考研题库/index.html';

  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
  const chrome = spawn(
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    [`--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--window-size=1440,900', '--no-first-run', '--disable-gpu', 'about:blank'],
    { stdio: 'ignore' }
  );
  // ★ 命门2：严禁 taskkill //IM chrome.exe（会误杀用户浏览器），只能按 PID 清理！
  const killMine = () => { try { execSync(`taskkill /F /PID ${chrome.pid} /T`, { stdio: 'ignore' }); } catch (e) {} };

  let page = null;
  for (let i = 0; i < 40; i++) {
    try {
      const list = await getJson(`http://127.0.0.1:${PORT}/json`);
      page = list.find(p => p.type === 'page' && p.url.startsWith('about:blank'));
      if (page) break;
    } catch (e) {}
    await timeout(300);
  }
  if (!page) { console.error('NO PAGE'); killMine(); process.exit(1); }

  // ★ 命门3：直接连接 page.webSocketDebuggerUrl（勿连 browser 级 ws）
  const ws = new WS(page.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  let nextId = 1;
  const pending = {};
  const exceptions = [];
  ws.on('message', m => {
    m = JSON.parse(m); // ★ 命门4：ws 消息是 Buffer，必须先 JSON.parse(m)
    if (m.id && pending[m.id]) { pending[m.id].resolve(m); delete pending[m.id]; }
    if (m.method === 'Runtime.exceptionThrown') {
      exceptions.push((m.params.exceptionDetails.exception?.description || '').slice(0, 200));
    }
  });
  function send(method, params) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending[id] = { resolve, reject };
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: URL }); // file:// 必须通过 Page.navigate 加载
  await timeout(2500);

  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.result?.exceptionDetails) return 'EXC:' + (r.result.exceptionDetails.exception?.description || '');
    return r.result?.result ? r.result.result.value : '__NOVAL__';
  };

  // ===== 在此编写业务断言 =====
  console.log('Exceptions count:', exceptions.length);

  try { ws.close(); } catch (e) {}
  killMine();
  process.exit(exceptions.length > 0 ? 1 : 0);
})();
```

---

## 3. 已知环境陷阱速查表

| 陷阱 | 现象 | 正确做法 |
| :--- | :--- | :--- |
| `ws` 消息未 `JSON.parse` | 所有 `Runtime.evaluate` 超时挂起 | `ws.on('message', m => { m = JSON.parse(m); ... })` |
| `Input.dispatchMouseEvent` `mouseWheel` | 在后台/无头窗口永久挂起 | 改用页面内派发：`document.dispatchEvent(new WheelEvent('wheel', { deltaX: 100, deltaY: 0, bubbles: true, cancelable: true }))`（注意必须挂在 `document` 而非 `window`） |
| `file://` 直接作为 Chrome CLI 参数 | 打开 Chrome 欢迎页而非目标页 | 启动参数传 `about:blank`，再用 `Page.navigate` 导航 |
| `fetch('file://...')` 验证图片 | 本地协议下 `fetch` 挂起或报错 | 使用 `new Image()` 探针检查 `img.complete && img.naturalWidth > 0` |
| CSS transition 动画未完成 | 模态框打开瞬间 `elementFromPoint` 穿透 | 测试时先注入 `el.style.transition = 'none'` 或等待动画时长 |
| 杀进程用 `/IM chrome.exe` | 误杀用户正在使用的日常浏览器 | 严格使用 `taskkill /F /PID ${chrome.pid} /T` |
