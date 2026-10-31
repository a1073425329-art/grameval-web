import { test, expect } from '@playwright/test'

test('管理员可以打开发布考试表单', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/#/login/admin')
  await page.fill('input[autocomplete="username"]', 'admin')
  await page.fill('input[autocomplete="current-password"]', '123456')
  await page.locator('button.el-button--primary').click()
  await page.waitForURL(/#\/dashboard/, { timeout: 15_000 })

  await page.goto('/#/admin/exams')
  const publishButton = page.getByRole('button', { name: '发布新考试' })
  await expect(publishButton).toBeVisible()
  await publishButton.click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('发布考试')
  await expect(dialog).toContainText('考试名称')
})
