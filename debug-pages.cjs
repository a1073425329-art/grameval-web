/**
 * 调试 3：检查 3 个失败页面的实际内容
 */
const { chromium } = require('@playwright/test');

const PAGES = [
  { name: '学习笔记', path: '/#/student/notes', expectHeading: '学习笔记', expectBtn: '新建笔记' },
  { name: '学习小组', path: '/#/student/groups', expectHeading: '学习小组', expectBtn: '创建小组' },
  { name: '在线考试', path: '/#/student/exams', expectHeading: '在线考试', expectBtn: '查看成绩详情' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 登录
  await page.goto('http://localhost:9000/#/login/student', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.fill('input[autocomplete="username"]', 'user01');
  await page.fill('input[autocomplete="current-password"]', '123456');
  await page.click('button.el-button--primary');
  await page.waitForTimeout(3000);
  console.log('登录完成，URL =', page.url(), '\n');

  for (const p of PAGES) {
    console.log(`===== ${p.name}  (${p.path}) =====`);
    await page.goto('http://localhost:9000' + p.path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    console.log(`  URL = ${page.url()}`);

    // 所有可见标题
    const heads = await page.$$eval('h1,h2,h3,h4,.page-title,.el-card__header', (els) =>
      els.map((e) => e.textContent.trim().replace(/\s+/g, ' ').slice(0, 30)).filter(Boolean).slice(0, 8)
    );
    console.log(`  标题元素 = ${JSON.stringify(heads)}`);

    // 所有按钮
    const btns = await page.$$eval('button', (els) =>
      els.map((e) => e.textContent.trim().replace(/\s+/g, ' ').slice(0, 16)).filter(Boolean).slice(0, 12)
    );
    console.log(`  按钮 = ${JSON.stringify(btns)}`);

    // 是否有弹窗
    const dlg = await page.locator('.el-dialog').count();
    console.log(`  弹窗数量 = ${dlg}`);
    console.log('');
  }

  await browser.close();
})().catch((e) => { console.error('脚本出错:', e.message); process.exit(1); });
