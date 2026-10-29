# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\student-interactions.test.ts >> 学生端在线考试 Tab 交互 >> 默认展示待考 Tab; 已参加 Tab 有历史记录
- Location: tests\e2e\student-interactions.test.ts:72:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: /查看成绩详情/ }).first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('button', { name: /查看成绩详情/ }).first()

```

```yaml
- text: 英语语法专项在线考试系统
- img
- superscript: "10"
- button "张小明 学生":
  - img
  - text: 张小明 学生
  - img
- complementary:
  - img
  - text: GramEval
  - menubar:
    - menuitem "首页":
      - img
      - text: 首页
    - menuitem "学习数据":
      - img
      - text: 学习数据
    - menuitem "AI学习助手":
      - img
      - text: AI学习助手
    - menuitem "学习中心" [expanded]:
      - text: 学习中心
      - img
      - menu:
        - menuitem "语法题库":
          - img
          - text: 语法题库
        - menuitem "专项练习":
          - img
          - text: 专项练习
        - menuitem "错题本":
          - img
          - text: 错题本
        - menuitem "知识点掌握度":
          - img
          - text: 知识点掌握度
        - menuitem "学习笔记":
          - img
          - text: 学习笔记
    - menuitem "考试中心" [expanded]:
      - text: 考试中心
      - img
      - menu:
        - menuitem "在线考试":
          - img
          - text: 在线考试
        - menuitem "我的成绩":
          - img
          - text: 我的成绩
        - menuitem "成绩趋势":
          - img
          - text: 成绩趋势
- main:
  - heading "在线考试" [level=3]
  - button "刷新":
    - img
    - text: 刷新
  - tablist:
    - tab "待考 50":
      - text: 待考
      - superscript: "50"
    - tab "已参加 4" [selected]:
      - text: 已参加
      - superscript: "4"
  - tabpanel "已参加 4":
    - heading "2026 秋季·语法综合模拟考试（第一场）" [level=4]
    - text: 进行中(未提交)
    - img
    - text: 英语语法综合模拟卷（一）
    - img
    - text: 90 分钟
    - img
    - text: 开始：2026-10-01 08:00:00
    - img
    - text: 结束：2026-12-28 22:00:00
    - button "继续答题"
    - heading "2026 秋季·语法综合模拟考试（第三场）" [level=4]
    - text: 进行中(未提交)
    - img
    - text: 英语语法综合模拟卷（三）
    - img
    - text: 90 分钟
    - img
    - text: 开始：2026-10-01 08:00:00
    - img
    - text: 结束：2026-12-31 22:00:00
    - button "继续答题"
    - heading "从句专项测评" [level=4]
    - text: 进行中(未提交)
    - img
    - text: 从句专项测试卷
    - img
    - text: 60 分钟
    - img
    - text: 开始：2026-10-01 08:00:00
    - img
    - text: 结束：2026-12-25 22:00:00
    - button "继续答题"
    - heading "薄弱知识点强化测评（三）" [level=4]
    - text: 进行中(未提交)
    - img
    - text: 2026 秋季·薄弱知识点强化卷（三）
    - img
    - text: 70 分钟
    - img
    - text: 开始：2026-10-01 08:00:00
    - img
    - text: 结束：2026-12-25 22:00:00
    - button "继续答题"
```

# Test source

```ts
  1  | /**
  2  |  * E2E: 学生端"点击不响应"回归测试.
  3  |  *
  4  |  * 场景 1: /student/notes -> 点击"新建笔记" -> 弹窗应可见
  5  |  * 场景 2: /student/groups -> 点击"创建小组" -> 弹窗应可见
  6  |  * 场景 3: /student/exams -> 应默认展示"待考" tab, 已考的不在里面; 切换到"已参加" tab 应能看到历史
  7  |  *
  8  |  * 每个测试都从登录页真实登录 user01/123456 起跳, 使用真实后端 (http://localhost:9001)
  9  |  */
  10 | import { test, expect } from '@playwright/test'
  11 | import type { Page } from '@playwright/test'
  12 | 
  13 | async function loginAsStudent(page: Page) {
  14 |   // 注意：前端用 hash 路由（createWebHashHistory），导航路径必须带 "#"，
  15 |   // 否则 Router 会忽略 path 部分并保持上一次的 hash（2026-10-16 修复）
  16 |   await page.goto('/#/login/student')
  17 |   await page.fill('input[autocomplete="username"]', 'user01')
  18 |   await page.fill('input[autocomplete="current-password"]', '123456')
  19 |   // 注意：Element Plus 的 <el-button type="primary"> 渲染为
  20 |   //   <button class="el-button el-button--primary" type="button">
  21 |   // primary 是 CSS class，不是原生 type 属性 —— 所以必须用 class 选择器，
  22 |   // 写 button[type="primary"] 永远匹配不到（2026-10-16 修复）
  23 |   await page.click('button.el-button--primary')
  24 |   // 原写法 /home|student/ 会匹配 /login/student 本身，等于没等；
  25 |   // 改为等待真正跳到学生首页的 hash（2026-10-16 修复）
  26 |   await page.waitForURL(/#\/student\/home/, { timeout: 15_000 })
  27 | }
  28 | 
  29 | test.describe('学生端弹窗回归 (曾因 :visible.sync 打不开)', () => {
  30 |   test('新建笔记 弹窗能弹出', async ({ page }) => {
  31 |     await loginAsStudent(page)
  32 |     await page.goto('/#/student/notes')
  33 |     // 等待页面渲染
  34 |     await expect(page.getByRole('heading', { name: /学习笔记/ })).toBeVisible()
  35 | 
  36 |     const btn = page.getByRole('button', { name: /新建笔记/ })
  37 |     await expect(btn).toBeVisible()
  38 |     await btn.click()
  39 | 
  40 |     // 弹窗打开后, 应看到标题"新建笔记"文字与"保存/取消"按钮
  41 |     const dialog = page.locator('.el-dialog:visible')
  42 |     await expect(dialog).toBeVisible({ timeout: 5_000 })
  43 |     await expect(dialog).toContainText('新建笔记')
  44 |     await expect(dialog.getByRole('button', { name: '保存' })).toBeVisible()
  45 |     await expect(dialog.getByRole('button', { name: '取消' })).toBeVisible()
  46 | 
  47 |     // 关闭弹窗
  48 |     await dialog.getByRole('button', { name: '取消' }).click()
  49 |     await expect(dialog).toBeHidden({ timeout: 5_000 })
  50 |   })
  51 | 
  52 |   test('创建小组 弹窗能弹出', async ({ page }) => {
  53 |     await loginAsStudent(page)
  54 |     await page.goto('/#/student/groups')
  55 |     await expect(page.getByRole('heading', { name: /学习小组/ })).toBeVisible()
  56 | 
  57 |     const btn = page.getByRole('button', { name: /创建小组/ })
  58 |     await expect(btn).toBeVisible()
  59 |     await btn.click()
  60 | 
  61 |     const dialog = page.locator('.el-dialog:visible')
  62 |     await expect(dialog).toBeVisible({ timeout: 5_000 })
  63 |     await expect(dialog).toContainText('创建学习小组')
  64 |     await expect(dialog.getByRole('button', { name: '创建' })).toBeVisible()
  65 | 
  66 |     await dialog.getByRole('button', { name: '取消' }).click()
  67 |     await expect(dialog).toBeHidden({ timeout: 5_000 })
  68 |   })
  69 | })
  70 | 
  71 | test.describe('学生端在线考试 Tab 交互', () => {
  72 |   test('默认展示待考 Tab; 已参加 Tab 有历史记录', async ({ page }) => {
  73 |     await loginAsStudent(page)
  74 |     await page.goto('/#/student/exams')
  75 |     await expect(page.getByRole('heading', { name: /在线考试/ })).toBeVisible()
  76 | 
  77 |     // 待考 tab 默认激活
  78 |     const availableTab = page.getByRole('tab', { name: /待考/ })
  79 |     await expect(availableTab).toHaveAttribute('aria-selected', 'true')
  80 | 
  81 |     // 切换到已参加 tab
  82 |     const attendedTab = page.getByRole('tab', { name: /已参加/ })
  83 |     await attendedTab.click()
  84 |     await expect(attendedTab).toHaveAttribute('aria-selected', 'true')
  85 | 
  86 |     // user01 有 155 场已参加, 应该看到"查看成绩详情"按钮或"我的得分"标签
  87 |     // 用 first 断言"至少一张卡"
  88 |     await expect(page.locator('.exam-card.is-attended').first()).toBeVisible({ timeout: 10_000 })
> 89 |     await expect(page.getByRole('button', { name: /查看成绩详情/ }).first()).toBeVisible()
     |                                                                        ^ Error: expect(locator).toBeVisible() failed
  90 |   })
  91 | })
  92 | 
```