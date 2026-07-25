import { test, expect } from '@playwright/test'

test.describe('登录功能', () => {
  test('管理员登录成功', async ({ page }) => {
    await page.goto('/login/admin')
    
    await page.fill('input[autocomplete="username"]', 'admin')
    await page.fill('input[autocomplete="current-password"]', '123456')
    await page.click('button[type="primary"]')
    
    await page.waitForURL(/dashboard/, { timeout: 10000 })
    await expect(page).toHaveURL(/dashboard/)
  })

  test('学生登录成功', async ({ page }) => {
    await page.goto('/login/student')
    
    await page.fill('input[autocomplete="username"]', 'user01')
    await page.fill('input[autocomplete="current-password"]', '123456')
    await page.click('button[type="primary"]')
    
    await page.waitForURL(/home/, { timeout: 10000 })
    await expect(page).toHaveURL(/home/)
  })

  test('登录失败 - 密码错误', async ({ page }) => {
    await page.goto('/login/admin')
    
    await page.fill('input[autocomplete="username"]', 'admin')
    await page.fill('input[autocomplete="current-password"]', 'wrongpassword')
    await page.click('button[type="primary"]')
    
    const errorMsg = page.locator('.el-message--error')
    await expect(errorMsg).toBeVisible({ timeout: 5000 })
  })

  test('登录失败 - 空账号密码', async ({ page }) => {
    await page.goto('/login/admin')
    
    await page.click('button[type="primary"]')
    
    const warningMsg = page.locator('.el-message--warning')
    await expect(warningMsg).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Dashboard页面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login/admin')
    await page.fill('input[autocomplete="username"]', 'admin')
    await page.fill('input[autocomplete="current-password"]', '123456')
    await page.click('button[type="primary"]')
    await page.waitForURL(/dashboard/, { timeout: 10000 })
  })

  test('Dashboard页面加载成功', async ({ page }) => {
    await expect(page.locator('.sidebar')).toBeVisible()
    await expect(page.locator('.header')).toBeVisible()
  })

  test('统计卡片显示数据', async ({ page }) => {
    const cards = page.locator('.stats-card')
    await expect(cards).toHaveCount(12)
  })

  test('学生总数卡片显示', async ({ page }) => {
    const studentCountCard = page.locator('.stats-card').first()
    await expect(studentCountCard).toContainText('学生总数')
  })
})

test.describe('API测试', () => {
  test('Dashboard API 返回成功', async ({ request }) => {
    const response = await request.get('/api/admin/dashboard')
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data.code).toBe(200)
    expect(data.data).toBeDefined()
    expect(data.data.studentCount).toBeGreaterThanOrEqual(0)
    expect(data.data.questionCount).toBeGreaterThanOrEqual(0)
    expect(data.data.paperCount).toBeGreaterThanOrEqual(0)
    expect(data.data.sessionCount).toBeGreaterThanOrEqual(0)
  })

  test('登录API返回token', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: {
        username: 'admin',
        password: '123456',
      },
    })
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data.code).toBe(200)
    expect(data.data.token).toBeDefined()
    expect(data.data.user).toBeDefined()
    expect(data.data.user.role).toBe('ADMIN')
  })
})
