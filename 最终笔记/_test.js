const { chromium } = require("playwright");
(async () => {
  const url = process.argv[2];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  const logs = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => logs.push(m.type() + ": " + m.text()));
  page.on("requestfailed", (r) => logs.push("REQFAIL " + r.url() + " " + (r.failure()||{}).errorText));
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);
  const contentText = await page.locator("#content").innerText().catch(() => "");
  const title = await page.locator("#doc-title").innerText().catch(() => "");
  const contentLen = contentText.length;
  // 切到知识树
  await page.click('[data-view-btn="tree"]');
  await page.waitForTimeout(2000);
  const treePaneHidden = await page.locator("#tree-pane").evaluate(el => el.classList.contains("hidden"));
  const mindHtmlLen = await page.locator("#mind-map").evaluate(el => el.innerHTML.length);
  const mindText = await page.locator("#mind-map").innerText().catch(() => "");
  const detail = await page.locator("#node-detail").innerText().catch(() => "");
  // 分屏
  await page.click('[data-view-btn="split"]');
  await page.waitForTimeout(1500);
  const splitMindLen = await page.locator("#mind-map").evaluate(el => el.innerHTML.length);
  await page.screenshot({ path: "D:/tj/822/考研题库/最终笔记/_test_split.png", fullPage: true });
  await page.click('[data-view-btn="tree"]');
  await page.waitForTimeout(800);
  await page.screenshot({ path: "D:/tj/822/考研题库/最终笔记/_test_tree.png", fullPage: true });
  await page.click('[data-view-btn="note"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: "D:/tj/822/考研题库/最终笔记/_test_note.png", fullPage: true });
  console.log(JSON.stringify({
    title, contentLen,
    contentHead: contentText.slice(0, 120).replace(/\n/g, " | "),
    treePaneHidden, mindHtmlLen,
    mindTextHead: mindText.slice(0, 200).replace(/\n/g, " | "),
    detailHead: detail.slice(0, 120).replace(/\n/g, " | "),
    splitMindLen,
    errors, logs: logs.slice(0, 40)
  }, null, 2));
  await browser.close();
})().catch((e) => { console.error("TEST_FAIL", e); process.exit(1); });
