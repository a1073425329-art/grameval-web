/**
 * 接口层冒烟测试: 覆盖前端 axios 里所有 request.get/post/put/delete 的路径,
 * 每个都返回 2xx 或业务预期 4xx (401/403/404/409), 5xx 一律 FAIL.
 *
 * 相比 grameval-java 目录下的 api-test.js 全量测试脚本, 本文件只覆盖
 * 前端真实调用的 URL 白名单, 用来在 CI 或本地快速 sanity check.
 *
 * 前置: 后端 9001 已启动, admin/user01 密码均为 123456.
 */
import { test, expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'

let adminToken = ''
let studentToken = ''
let studentId = 0

test.beforeAll(async ({ request }) => {
  const a = await request.post('/api/auth/login', { data: { username: 'admin', password: '123456' } })
  adminToken = (await a.json()).data.token
  const s = await request.post('/api/auth/login', { data: { username: 'user01', password: '123456' } })
  const student = (await s.json()).data
  studentToken = student.token
  studentId = student.user.id
})

/** 5xx 视为失败, 其它一律接受(2xx 通过 / 4xx 是接口正确的防御性回执). */
function assertNot5xx(status: number, path: string) {
  if (status >= 500) {
    throw new Error(`接口 ${path} 返回 5xx=${status} — 系统性 bug`)
  }
}

async function get(request: APIRequestContext, path: string, token: string) {
  const r = await request.get(path, { headers: { Authorization: `Bearer ${token}` } })
  assertNot5xx(r.status(), path)
  return r
}

test.describe('前端 axios 使用的 URL 白名单', () => {
  test('题库覆盖统计: 权限、来源筛选、重复学生参数与聚合口径', async ({ request }) => {
    const endpoint = '/api/admin/questions/coverage'
    const adminHeaders = { Authorization: `Bearer ${adminToken}` }
    const studentHeaders = { Authorization: `Bearer ${studentToken}` }

    const denied = await request.get(endpoint, { headers: studentHeaders })
    expect([401, 403]).toContain(denied.status())

    const allResponse = await request.get(endpoint, { headers: adminHeaders })
    expect(allResponse.status()).toBe(200)
    const allEnvelope = await allResponse.json()
    expect(allEnvelope.code).toBe(200)
    const all = allEnvelope.data
    expect(all.source).toBe('ALL')
    expect(all.inventory.totalUnits).toBe(
      all.inventory.ordinaryQuestionUnits + all.inventory.readingPassages,
    )
    expect(all.answers.attemptedUnits + all.answers.untouchedUnits).toBe(all.inventory.totalUnits)
    expect(all.answers.gradedCount + all.answers.ungradedCount).toBe(all.answers.attemptCount)
    expect(all.answers.correctCount).toBeLessThanOrEqual(all.answers.gradedCount)
    expect(all.reading.passageCount).toBe(all.inventory.readingPassages)
    expect(
      all.reading.fullyCoveredPassages +
        all.reading.partiallyCoveredPassages +
        all.reading.untouchedPassages,
    ).toBe(all.reading.passageCount)
    expect(all.byType.reduce((sum: number, row: { totalUnits: number }) => sum + row.totalUnits, 0)).toBe(
      all.inventory.totalUnits,
    )
    for (const alert of all.alerts) {
      expect(alert.totalUnits).toBeGreaterThan(0)
      expect(alert.untouchedUnits).toBe(0)
    }

    for (const source of ['EXAM', 'PRACTICE']) {
      const response = await request.get(`${endpoint}?source=${source}`, { headers: adminHeaders })
      expect(response.status(), `${source} coverage query`).toBe(200)
      const envelope = await response.json()
      expect(envelope.code).toBe(200)
      expect(envelope.data.source).toBe(source)
    }

    const filteredQuery = new URLSearchParams()
    filteredQuery.append('source', 'PRACTICE')
    filteredQuery.append('studentIds', String(studentId))
    filteredQuery.append('studentIds', String(studentId))
    filteredQuery.append('startTime', '2000-01-01 00:00:00')
    const filteredResponse = await request.get(`${endpoint}?${filteredQuery.toString()}`, {
      headers: adminHeaders,
    })
    expect(filteredResponse.status()).toBe(200)
    const filteredEnvelope = await filteredResponse.json()
    expect(filteredEnvelope.code).toBe(200)
    expect(filteredEnvelope.data.source).toBe('PRACTICE')
    expect(filteredEnvelope.data.studentIds).toEqual([studentId, studentId])
    expect(filteredEnvelope.data.startTime).toBe('2000-01-01 00:00:00')
  })

  test('学生端: 个人资料 / 周报 / 学习进度', async ({ request }) => {
    const t = studentToken
    // 个人资料 — 别名接口 my-profile 是刚补的
    await expect((await get(request, '/api/users/my-profile', t)).status()).toBe(200)
    await expect((await get(request, '/api/users/me', t)).status()).toBe(200)

    // 学习周报
    await expect((await get(request, '/api/weekly-report/current', t)).status()).toBe(200)
    await expect((await get(request, '/api/weekly-report/list?pageNum=1&pageSize=5', t)).status()).toBe(200)

    // 学习进度
    await expect((await get(request, '/api/learning-progress/me', t)).status()).toBe(200)
    await expect((await get(request, '/api/learning-progress/me/weak?limit=5', t)).status()).toBe(200)
    await expect((await get(request, '/api/learning-progress/me/strong?limit=5', t)).status()).toBe(200)
  })

  test('学生端考试相关: available / attended / 结果 / 错题', async ({ request }) => {
    const t = studentToken
    await expect((await get(request, '/api/exams/available', t)).status()).toBe(200)
    await expect((await get(request, '/api/exams/attended', t)).status()).toBe(200)
    await expect((await get(request, '/api/results/my-list?pageNum=1&pageSize=10', t)).status()).toBe(200)
    await expect((await get(request, '/api/results/my-summary', t)).status()).toBe(200)
    await expect((await get(request, '/api/results/wrong-book?pageNum=1&pageSize=10', t)).status()).toBe(200)
  })

  test('学生端 通知', async ({ request }) => {
    const t = studentToken
    await expect((await get(request, '/api/notifications?pageNum=1&pageSize=10', t)).status()).toBe(200)
    await expect((await get(request, '/api/notifications/unread-count', t)).status()).toBe(200)
    await expect((await get(request, '/api/notifications/preferences', t)).status()).toBe(200)
  })

  test('管理员端: dashboard / users / questions / papers / sessions', async ({ request }) => {
    const t = adminToken
    await expect((await get(request, '/api/admin/dashboard', t)).status()).toBe(200)
    await expect((await get(request, '/api/users?pageNum=1&pageSize=5', t)).status()).toBe(200)
    await expect((await get(request, '/api/questions?pageNum=1&pageSize=5', t)).status()).toBe(200)
    await expect((await get(request, '/api/papers?pageNum=1&pageSize=5', t)).status()).toBe(200)
    await expect((await get(request, '/api/sessions?pageNum=1&pageSize=5', t)).status()).toBe(200)
    await expect((await get(request, '/api/categories/tree', t)).status()).toBe(200)
    await expect((await get(request, '/api/reading-passages?pageNum=1&pageSize=5', t)).status()).toBe(200)
    await expect((await get(request, '/api/tags/questions', t)).status()).toBe(200)
    await expect((await get(request, '/api/tags/papers', t)).status()).toBe(200)
  })

  test('管理员端: 操作日志 / 系统设置', async ({ request }) => {
    const t = adminToken
    await expect((await get(request, '/api/admin/operation-logs?pageNum=1&pageSize=5', t)).status()).toBe(200)
    await expect((await get(request, '/api/admin/operation-logs/types', t)).status()).toBe(200)
    await expect((await get(request, '/api/admin/system-config', t)).status()).toBe(200)
    await expect((await get(request, '/api/admin/system-config/ai/overview', t)).status()).toBe(200)
  })

  test('管理员端: 工作流 / AI', async ({ request }) => {
    const t = adminToken
    await expect((await get(request, '/api/admin/workflow/nodes', t)).status()).toBe(200)
    await expect((await get(request, '/api/admin/workflow/connections', t)).status()).toBe(200)
    // AI 生成记录列表
    await expect((await get(request, '/api/admin/ai/generation-logs?pageNum=1&pageSize=5', t)).status()).toBe(200)
  })
})
