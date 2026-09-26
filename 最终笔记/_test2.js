const { chromium } = require("playwright");
(async () => {
  const url = process.argv[2];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(800);

  // 默认应是笔记视图，侧栏收起
  const view = await page.locator("#app").getAttribute("data-view");
  const sideCollapsed = await page.locator("#app").evaluate(el => el.classList.contains("side-collapsed"));
  const contentLen = (await page.locator("#content").innerText()).length;
  const h2 = await page.locator("#content h2").first().innerText().catch(() => "");

  // 打开知识树，点一个节点
  await page.click('[data-view-btn="tree"]');
  await page.waitForTimeout(1200);
  const mapBox = await page.locator("#mind-map").boundingBox();
  // 点击 me-tpc 文本
  const tpc = page.locator("#mind-map me-tpc").nth(2);
  const tpcText = await tpc.innerText().catch(() => "");
  await tpc.click({ force: true }).catch(() => {});
  await page.waitForTimeout(600);
  const detail = await page.locator("#node-detail").innerText();

  // 侧栏展开
  await page.click("#btn-side");
  await page.waitForTimeout(300);
  const sideOpen = !(await page.locator("#app").evaluate(el => el.classList.contains("side-collapsed")));
  const tocCount = await page.locator("#toc a").count();

  // 分屏下正文是否仍有内容
  await page.click('[data-view-btn="split"]');
  await page.waitForTimeout(800);
  const splitContentLen = (await page.locator("#content").innerText()).length;
  const splitMindNodes = await page.locator("#mind-map me-tpc").count();

  await page.screenshot({ path: "D:/tj/822/考研题库/最终笔记/_test_final.png" });
  console.log(JSON.stringify({
    view, sideCollapsed, contentLen, h2,
    mapBox, tpcText, detailHead: detail.slice(0, 150).replace(/\n/g, " | "),
    sideOpen, tocCount, splitContentLen, splitMindNodes, errors
  }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
