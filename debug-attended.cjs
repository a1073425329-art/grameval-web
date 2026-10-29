/**
 * 调试 4：已参加 Tab 里的卡片实际有什么按钮
 */
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('http://localhost:9000/#/login/student', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.fill('input[autocomplete="username"]', 'user01');
  await page.fill('input[autocomplete="current-password"]', '123456');
  await page.click('button.el-button--primary');
  await page.waitForTimeout(3000);

  await page.goto('http://localhost:9000/#/student/exams', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // 切到"已参加"
  const attendedTab = page.getByRole('tab', { name: /已参加/ });
  await attendedTab.click();
  await page.waitForTimeout(2500);

  console.log('已参加 Tab 已选中 =', await attendedTab.getAttribute('aria-selected'));

  const cards = await page.locator('.exam-card.is-attended').count();
  console.log(`.exam-card.is-attended 数量 = ${cards}`);

  // 第一张卡片的完整文本
  if (cards > 0) {
    const first = page.locator('.exam-card.is-attended').first();
    const txt = await first.textContent();
    console.log('第一张卡片文本 =', JSON.stringify(txt.replace(/\s+/g, ' ').trim().slice(0, 200)));

    // 卡片内的按钮
    const btns = await first.locator('button').allTextContents();
    console.log('卡片内按钮 =', JSON.stringify(btns.map((b) => b.trim())));

    // 卡片内所有可点击元素
    const links = await first.locator('a, .el-link, [role="button"]').allTextContents();
    console.log('卡片内链接类 =', JSON.stringify(links.map((b) => b.trim()).filter(Boolean).slice(0, 10)));
  }

  // 全页面按钮
  const allBtns = await page.$$eval('button', (els) =>
    els.map((e) => e.textContent.trim().replace(/\s+/g, ' ').slice(0, 18)).filter(Boolean)
  );
  console.log('全页按钮(前 20) =', JSON.stringify(allBtns.slice(0, 20)));

  await page.screenshot({ path: 'debug-attended.png', fullPage: false });
  console.log('截图: debug-attended.png');

  await browser.close();
})().catch((e) => { console.error('脚本出错:', e.message); process.exit(1); });
