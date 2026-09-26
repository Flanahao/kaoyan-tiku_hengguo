const { chromium } = require("playwright");
(async () => {
  const url = process.argv[2];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", e => console.log("PAGEERROR", e));
  page.on("console", m => { if (m.type()==="error") console.log("CONSOLE", m.text()); });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const diag = await page.evaluate(() => {
    const content = document.getElementById("content");
    const heads = [...content.querySelectorAll("h1,h2,h3,h4")].map(h => h.tagName + ":" + h.textContent.trim().slice(0,20));
    const kds = content.querySelectorAll(".katex").length;
    const pres = [...content.querySelectorAll("pre")].map(p => p.getBoundingClientRect().height);
    const bodyH = document.body.scrollHeight;
    const appH = document.getElementById("app").scrollHeight;
    const note = document.getElementById("note-pane");
    return {
      headsCount: heads.length,
      headsSample: heads.slice(0, 20),
      kds, pres,
      bodyH, appH,
      noteScrollH: note.scrollHeight,
      noteClientH: note.clientHeight,
      contentTextLen: content.innerText.length,
      hasSection2: content.innerText.includes("2.1 极限"),
      hasSection3: content.innerText.includes("3.3 连续")
    };
  });
  console.log(JSON.stringify(diag, null, 2));

  // 树节点点击：用 ME 的 bus 验证
  await page.click('[data-view-btn="tree"]');
  await page.waitForTimeout(1500);
  const treeInfo = await page.evaluate(() => {
    const map = document.getElementById("mind-map");
    const tpcs = [...map.querySelectorAll("me-tpc")];
    return {
      tpcCount: tpcs.length,
      samples: tpcs.slice(0, 5).map(t => ({
        text: (t.textContent||"").trim().slice(0,20),
        nodeid: t.getAttribute("data-nodeid") || t.getAttribute("data-id") || (t.nodeObj && t.nodeObj.id) || null,
        className: t.className
      })),
      mindReady: !!(window.__mind || document.querySelector("#mind-map me-root"))
    };
  });
  console.log("TREE", JSON.stringify(treeInfo, null, 2));

  // 在页面内直接调用 selectNode 并检查详情
  const selectResult = await page.evaluate(() => {
    // app.js 没有暴露 state；通过 DOM 点击 me-tpc
    const tpc = document.querySelectorAll("#mind-map me-tpc")[2];
    if (!tpc) return { err: "no tpc" };
    tpc.click();
    return new Promise(r => setTimeout(() => {
      r({
        detail: document.getElementById("node-detail").innerText.slice(0,200),
        activeHead: (document.querySelector(".me-active-heading")||{}).textContent
      });
    }, 500));
  });
  console.log("SELECT", JSON.stringify(selectResult, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
