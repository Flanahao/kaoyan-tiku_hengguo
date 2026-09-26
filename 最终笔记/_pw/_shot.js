const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const url = "http://127.0.0.1:8765/%E6%9C%80%E7%BB%88%E7%AC%94%E8%AE%B0/index.html";
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.locator("#note-pane").evaluate(el => { el.scrollTop = 900; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "D:/tj/822/考研题库/最终笔记/_shot_note_scrolled.png" });
  await page.click('[data-view-btn="tree"]');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "D:/tj/822/考研题库/最终笔记/_shot_tree.png" });
  await page.click('[data-view-btn="split"]');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "D:/tj/822/考研题库/最终笔记/_shot_split.png" });
  console.log("shots ok");
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
