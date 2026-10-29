const { chromium } = require('@playwright/test');

const ARTIFACT_DIR = 'C:/Users/li/.gemini/antigravity/brain/39e89645-4515-46f9-8662-99f97809bd90';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Login as admin
  await page.goto('http://localhost:9000/#/login/admin', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.fill('input[autocomplete="username"]', 'admin');
  await page.fill('input[autocomplete="current-password"]', '123456');
  await page.click('button.el-button--primary');
  await page.waitForTimeout(2500);

  // Message Center
  await page.goto('http://localhost:9000/#/admin/messages', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Click on "通知偏好" button
  const prefBtn = page.locator('button, span', { hasText: '通知偏好' }).first();
  await prefBtn.click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: `${ARTIFACT_DIR}/06-messages-preference-cleaned.png`, fullPage: false });
  console.log('Saved 06-messages-preference-cleaned.png with preference dialog');

  await browser.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
