/**
 * 调试：学生登录流程到底发生了什么
 * 运行: node debug-login.cjs   （在 grameval-web 目录）
 */
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', (m) => {
    const t = m.text();
    if (t && !t.includes('Download the Vue Devtools')) {
      console.log(`  [console.${m.type()}] ${t.slice(0, 160)}`);
    }
  });
  page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message.slice(0, 200)}`));
  page.on('requestfailed', (r) => console.log(`  [reqfail] ${r.url().slice(0, 100)} ${r.failure()?.errorText}`));
  page.on('response', (r) => {
    if (r.url().includes('/api/')) console.log(`  [api] ${r.status()} ${r.url().replace('http://localhost:9000', '')}`);
  });

  console.log('1. 打开登录页...');
  await page.goto('http://localhost:9000/login/student', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  console.log('   URL =', page.url());

  console.log('2. 填写表单...');
  await page.fill('input[autocomplete="username"]', 'user01');
  await page.fill('input[autocomplete="current-password"]', '123456');
  const u = await page.inputValue('input[autocomplete="username"]');
  const p = await page.inputValue('input[autocomplete="current-password"]');
  console.log(`   用户名框="${u}"  密码框长度=${p.length}`);

  console.log('3. 列出页面按钮...');
  const btns = await page.$$eval('button', (els) =>
    els.map((e) => ({ cls: e.className.slice(0, 60), type: e.getAttribute('type'), txt: e.textContent.trim().slice(0, 12) }))
  );
  btns.forEach((b, i) => console.log(`   [${i}] type=${b.type} cls="${b.cls}" txt="${b.txt}"`));

  const match = await page.$$('button.el-button--primary');
  console.log(`4. "button.el-button--primary" 匹配到 ${match.length} 个元素`);

  console.log('5. 点击登录...');
  await page.click('button.el-button--primary');
  await page.waitForTimeout(4000);
  console.log('   4 秒后 URL =', page.url());

  const storage = await page.evaluate(() => ({
    token: localStorage.getItem('token') ? '(有)' : '(无)',
    userInfo: localStorage.getItem('userInfo') ? '(有)' : '(无)',
  }));
  console.log('   localStorage:', JSON.stringify(storage));

  await page.screenshot({ path: 'debug-after-login.png', fullPage: false });
  console.log('6. 截图已存 debug-after-login.png');

  await browser.close();
})().catch((e) => {
  console.error('脚本出错:', e.message);
  process.exit(1);
});
