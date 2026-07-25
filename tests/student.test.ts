import { test, expect } from '@playwright/test'

test.describe('学生端API', () => {
  let token: string
  let userId: number

  test.beforeAll(async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: {
        username: 'user01',
        password: '123456',
      },
    })
    const data = await response.json()
    token = data.data.token
    userId = data.data.user.id
  })

  test('获取学生统计数据', async ({ request }) => {
    const response = await request.get(`/api/students/${userId}/statistics`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data.code).toBe(200)
    expect(data.data).toBeDefined()
  })

  test('获取考试列表', async ({ request }) => {
    const response = await request.get('/api/results/my-list', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data.code).toBe(200)
  })

  test('获取错题列表', async ({ request }) => {
    const response = await request.get('/api/results/wrong-book', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data.code).toBe(200)
  })

  test('获取成绩汇总', async ({ request }) => {
    const response = await request.get('/api/results/my-summary', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    expect(data.code).toBe(200)
  })
})
