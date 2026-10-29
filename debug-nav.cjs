/**
 * 调试 2：登录后如何正确导航到子页面（hash 路由 vs 完整路径）
 */
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 登录
  await page.goto('http://localhost:9000/login/student', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.fill('input[autocomplete="username"]', 'user01');
  await page.fill('input[autocomplete="current-password"]', '123456');
  await page.click('button.el-button--primary');
  await page.waitForTimeout(3000);
  console.log('登录后 URL =', page.url());
  console.log('sessionStorage 有 token =', await page.evaluate(() => !!sessionStorage.getItem('token')));

  // ---- 方式 A：测试现在的写法（无 # 的完整路径）----
  console.log('\n--- 方式 A: page.goto("/student/exams") ---');
  await page.goto('http://localhost:9000/student/exams', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  console.log('  URL =', page.url());
  console.log('  sessionStorage token =', await page.evaluate(() => !!sessionStorage.getItem('token')));
  const hA = await page.$$eval('h1,h2,h3,.page-title', (els) => els.map((e) => e.textContent.trim().slice(0, 20)).filter(Boolean).slice(0, 5));
  console.log('  页面标题类元素 =', JSON.stringify(hA));
  const onLoginA = await page.locator('input[autocomplete="username"]').count();
  console.log('  是否停在登录页(有用户名框) =', onLoginA > 0);

  // ---- 方式 B：hash 导航 ----
  console.log('\n--- 方式 B: page.goto("/#/student/exams") ---');
  await page.goto('http://localhost:9000/#/student/exams', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  console.log('  URL =', page.url());
  console.log('  sessionStorage token =', await page.evaluate(() => !!sessionStorage.getItem('token')));
  const hB = await page.$$eval('h1,h2,h3,.page-title', (els) => els.map((e) => e.textContent.trim().slice(0, 20)).filter(Boolean).slice(0, 5));
  console.log('  页面标题类元素 =', JSON.stringify(hB));
  const onLoginB = await page.locator('input[autocomplete="username"]').count();
  console.log('  是否停在登录页(有用户名框) =', onLoginB > 0);

  await page.screenshot({ path: 'debug-nav-compare.png' });
  await browser.close();
})().catch((e) => { console.error('脚本出错:', e.message); process.exit(1); });
