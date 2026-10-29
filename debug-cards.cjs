/**
 * 调试 5：dump "已参加" Tab 全部卡片的文本与按钮
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
  await page.getByRole('tab', { name: /已参加/ }).click();
  await page.waitForTimeout(2500);

  const cards = page.locator('.exam-card.is-attended');
  const n = await cards.count();
  console.log(`共 ${n} 张 .exam-card.is-attended 卡片\n`);

  for (let i = 0; i < n; i++) {
    const c = cards.nth(i);
    const txt = (await c.textContent()).replace(/\s+/g, ' ').trim();
    const btns = (await c.locator('button').allTextContents()).map((b) => b.trim());
    const cls = await c.getAttribute('class');
    console.log(`[卡片 ${i + 1}]`);
    console.log(`  class = ${cls}`);
    console.log(`  文本  = ${txt.slice(0, 120)}`);
    console.log(`  按钮  = ${JSON.stringify(btns)}`);
    console.log('');
  }

  // 页面上的"已参加" tab 面板里，是否出现"查看成绩详情"字样
  const bodyTxt = await page.textContent('body');
  console.log('页面是否含"查看成绩详情" =', bodyTxt.includes('查看成绩详情'));
  console.log('页面是否含"我的得分"     =', bodyTxt.includes('我的得分'));
  console.log('页面是否含"继续答题"     =', bodyTxt.includes('继续答题'));

  await browser.close();
})().catch((e) => { console.error('脚本出错:', e.message); process.exit(1); });
