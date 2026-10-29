const { chromium } = require('@playwright/test');

const ARTIFACT_DIR = 'C:/Users/li/.gemini/antigravity/brain/39e89645-4515-46f9-8662-99f97809bd90';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();

  // Login
  await page.goto('http://localhost:9000/#/login/admin', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.fill('input[autocomplete="username"]', 'admin');
  await page.fill('input[autocomplete="current-password"]', '123456');
  await page.click('button.el-button--primary');
  await page.waitForTimeout(2500);

  // Navigate to Architecture page
  await page.goto('http://localhost:9000/#/admin/architecture', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Click "数据表" tab
  console.log('Switching to 数据表 tab...');
  const tableTab = page.locator('.el-tabs__item', { hasText: '数据表' });
  await tableTab.click();
  await page.waitForTimeout(1500);

  // Screenshot 1: Paper Core tables tab (default)
  await page.screenshot({ path: `${ARTIFACT_DIR}/09-arch-tables-paper-view.png`, fullPage: false });
  console.log('Saved 09-arch-tables-paper-view.png');

  // Switch to "系统全部 · 32 张表"
  console.log('Switching to 系统全部 scope...');
  const allRadio = page.locator('.el-radio-button', { hasText: '系统全部' });
  await allRadio.click();
  await page.waitForTimeout(1500);

  // Search for operation_log and expand
  console.log('Searching operation_log...');
  const kwInput = page.locator('input.el-input__inner[placeholder*="搜索表名"]');
  await kwInput.fill('operation_log');
  await page.waitForTimeout(1000);

  // Click row or expand button
  const expandBtn = page.locator('.el-table__expand-icon').first();
  await expandBtn.click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: `${ARTIFACT_DIR}/10-arch-table-operation-log-expanded.png`, fullPage: false });
  console.log('Saved 10-arch-table-operation-log-expanded.png');

  // Search message_notification and expand
  console.log('Searching message_notification...');
  await kwInput.fill('message_notification');
  await page.waitForTimeout(1000);
  const expandBtn2 = page.locator('.el-table__expand-icon').first();
  await expandBtn2.click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: `${ARTIFACT_DIR}/11-arch-table-notification-expanded.png`, fullPage: false });
  console.log('Saved 11-arch-table-notification-expanded.png');

  // Search notification_preference and expand
  console.log('Searching notification_preference...');
  await kwInput.fill('notification_preference');
  await page.waitForTimeout(1000);
  const expandBtn3 = page.locator('.el-table__expand-icon').first();
  await expandBtn3.click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: `${ARTIFACT_DIR}/12-arch-table-preference-expanded.png`, fullPage: false });
  console.log('Saved 12-arch-table-preference-expanded.png');

  await browser.close();
  console.log('All architecture table expansion tests completed successfully!');
}

main().catch(err => {
  console.error('Error in test:', err);
  process.exit(1);
});
