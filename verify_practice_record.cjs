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
  const tableTab = page.locator('.el-tabs__item', { hasText: '数据表' });
  await tableTab.click();
  await page.waitForTimeout(1500);

  // Search practice_record (in paper core tables or all)
  const kwInput = page.locator('input.el-input__inner[placeholder*="搜索表名"]');
  await kwInput.fill('practice_record');
  await page.waitForTimeout(1000);

  // Click expand
  const expandBtn = page.locator('.el-table__expand-icon').first();
  await expandBtn.click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: `${ARTIFACT_DIR}/13-practice-record-detailed-meanings.png`, fullPage: false });
  console.log('Saved 13-practice-record-detailed-meanings.png');

  await browser.close();
}

main().catch(console.error);
