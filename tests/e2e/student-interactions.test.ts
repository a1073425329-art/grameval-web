/**
 * E2E: 学生端"点击不响应"回归测试.
 *
 * 场景: /student/exams -> 应默认展示"待考" tab, 已考的不在里面; 切换到"已参加" tab 应能看到历史
 *
 * 每个测试都从登录页真实登录 user01/123456 起跳, 使用真实后端 (http://localhost:9001)
 */
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

async function loginAsStudent(page: Page) {
  // 注意：前端用 hash 路由（createWebHashHistory），导航路径必须带 "#"，
  // 否则 Router 会忽略 path 部分并保持上一次的 hash（2026-10-16 修复）
  await page.goto('/#/login/student')
  await page.fill('input[autocomplete="username"]', 'user01')
  await page.fill('input[autocomplete="current-password"]', '123456')
  // 注意：Element Plus 的 <el-button type="primary"> 渲染为
  //   <button class="el-button el-button--primary" type="button">
  // primary 是 CSS class，不是原生 type 属性 —— 所以必须用 class 选择器，
  // 写 button[type="primary"] 永远匹配不到（2026-10-16 修复）
  await page.click('button.el-button--primary')
  // 原写法 /home|student/ 会匹配 /login/student 本身，等于没等；
  // 改为等待真正跳到学生首页的 hash（2026-10-16 修复）
  await page.waitForURL(/#\/student\/home/, { timeout: 15_000 })
}

test.describe('学生端在线考试 Tab 交互', () => {
  test('默认展示待考 Tab; 已参加 Tab 有历史记录', async ({ page }) => {
    await loginAsStudent(page)
    await page.goto('/#/student/exams')
    await expect(page.getByRole('heading', { name: /在线考试/ })).toBeVisible()

    // 待考 tab 默认激活
    const availableTab = page.getByRole('tab', { name: /待考/ })
    await expect(availableTab).toHaveAttribute('aria-selected', 'true')

    // 切换到已参加 tab
    const attendedTab = page.getByRole('tab', { name: /已参加/ })
    await attendedTab.click()
    await expect(attendedTab).toHaveAttribute('aria-selected', 'true')

    // user01 有 155 场已参加, 应该看到"查看成绩详情"按钮或"我的得分"标签
    // 用 first 断言"至少一张卡"
    await expect(page.locator('.exam-card.is-attended').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: /查看成绩详情/ }).first()).toBeVisible()
  })
})
