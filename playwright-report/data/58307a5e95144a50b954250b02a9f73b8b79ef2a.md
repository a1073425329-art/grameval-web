# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin.test.ts >> 登录功能 >> 登录失败 - 空账号密码
- Location: tests\admin.test.ts:37:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('button[type="primary"]')

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - heading "GramEval" [level=1] [ref=e5]
  - paragraph [ref=e6]: 英语语法专项在线考试系统
  - radiogroup "radio-group" [ref=e7]:
    - generic [ref=e8]:
      - radio "学生登录" [checked] [ref=e9]
      - generic [ref=e10] [cursor=pointer]: 学生登录
    - generic [ref=e11]:
      - radio "管理员登录" [ref=e12]
      - generic [ref=e13] [cursor=pointer]: 管理员登录
  - generic [ref=e14]:
    - textbox "输入学生账号" [ref=e23]
    - textbox "请输入密码" [ref=e33]
    - button "学生登录" [ref=e36] [cursor=pointer]
  - generic [ref=e38]:
    - generic [ref=e39]: 快捷登录
    - generic [ref=e40]:
      - button "演示学生" [ref=e41] [cursor=pointer]
      - button "李小红" [ref=e43] [cursor=pointer]
      - button "王小刚" [ref=e45] [cursor=pointer]
  - generic [ref=e48]:
    - text: 还没有账号？
    - generic [ref=e49] [cursor=pointer]: 立即注册
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test'
  2   | 
  3   | test.describe('登录功能', () => {
  4   |   test('管理员登录成功', async ({ page }) => {
  5   |     await page.goto('/login/admin')
  6   |     
  7   |     await page.fill('input[autocomplete="username"]', 'admin')
  8   |     await page.fill('input[autocomplete="current-password"]', '123456')
  9   |     await page.click('button[type="primary"]')
  10  |     
  11  |     await page.waitForURL(/dashboard/, { timeout: 10000 })
  12  |     await expect(page).toHaveURL(/dashboard/)
  13  |   })
  14  | 
  15  |   test('学生登录成功', async ({ page }) => {
  16  |     await page.goto('/login/student')
  17  |     
  18  |     await page.fill('input[autocomplete="username"]', 'user01')
  19  |     await page.fill('input[autocomplete="current-password"]', '123456')
  20  |     await page.click('button[type="primary"]')
  21  |     
  22  |     await page.waitForURL(/home/, { timeout: 10000 })
  23  |     await expect(page).toHaveURL(/home/)
  24  |   })
  25  | 
  26  |   test('登录失败 - 密码错误', async ({ page }) => {
  27  |     await page.goto('/login/admin')
  28  |     
  29  |     await page.fill('input[autocomplete="username"]', 'admin')
  30  |     await page.fill('input[autocomplete="current-password"]', 'wrongpassword')
  31  |     await page.click('button[type="primary"]')
  32  |     
  33  |     const errorMsg = page.locator('.el-message--error')
  34  |     await expect(errorMsg).toBeVisible({ timeout: 5000 })
  35  |   })
  36  | 
  37  |   test('登录失败 - 空账号密码', async ({ page }) => {
  38  |     await page.goto('/login/admin')
  39  |     
> 40  |     await page.click('button[type="primary"]')
      |                ^ Error: page.click: Test timeout of 30000ms exceeded.
  41  |     
  42  |     const warningMsg = page.locator('.el-message--warning')
  43  |     await expect(warningMsg).toBeVisible({ timeout: 5000 })
  44  |   })
  45  | })
  46  | 
  47  | test.describe('Dashboard页面', () => {
  48  |   test.beforeEach(async ({ page }) => {
  49  |     await page.goto('/login/admin')
  50  |     await page.fill('input[autocomplete="username"]', 'admin')
  51  |     await page.fill('input[autocomplete="current-password"]', '123456')
  52  |     await page.click('button[type="primary"]')
  53  |     await page.waitForURL(/dashboard/, { timeout: 10000 })
  54  |   })
  55  | 
  56  |   test('Dashboard页面加载成功', async ({ page }) => {
  57  |     await expect(page.locator('.sidebar')).toBeVisible()
  58  |     await expect(page.locator('.header')).toBeVisible()
  59  |   })
  60  | 
  61  |   test('统计卡片显示数据', async ({ page }) => {
  62  |     const cards = page.locator('.stats-card')
  63  |     await expect(cards).toHaveCount(12)
  64  |   })
  65  | 
  66  |   test('学生总数卡片显示', async ({ page }) => {
  67  |     const studentCountCard = page.locator('.stats-card').first()
  68  |     await expect(studentCountCard).toContainText('学生总数')
  69  |   })
  70  | })
  71  | 
  72  | test.describe('API测试', () => {
  73  |   test('Dashboard API 返回成功', async ({ request }) => {
  74  |     const response = await request.get('/api/admin/dashboard')
  75  |     expect(response.ok()).toBeTruthy()
  76  |     const data = await response.json()
  77  |     expect(data.code).toBe(200)
  78  |     expect(data.data).toBeDefined()
  79  |     expect(data.data.studentCount).toBeGreaterThanOrEqual(0)
  80  |     expect(data.data.questionCount).toBeGreaterThanOrEqual(0)
  81  |     expect(data.data.paperCount).toBeGreaterThanOrEqual(0)
  82  |     expect(data.data.sessionCount).toBeGreaterThanOrEqual(0)
  83  |   })
  84  | 
  85  |   test('登录API返回token', async ({ request }) => {
  86  |     const response = await request.post('/api/auth/login', {
  87  |       data: {
  88  |         username: 'admin',
  89  |         password: '123456',
  90  |       },
  91  |     })
  92  |     expect(response.ok()).toBeTruthy()
  93  |     const data = await response.json()
  94  |     expect(data.code).toBe(200)
  95  |     expect(data.data.token).toBeDefined()
  96  |     expect(data.data.user).toBeDefined()
  97  |     expect(data.data.user.role).toBe('ADMIN')
  98  |   })
  99  | })
  100 | 
```