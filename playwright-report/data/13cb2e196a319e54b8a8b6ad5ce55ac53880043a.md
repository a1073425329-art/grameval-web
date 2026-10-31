# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api\frontend-urls.test.ts >> 前端 axios 使用的 URL 白名单 >> 管理员端: dashboard / users / questions / papers / sessions
- Location: tests\api\frontend-urls.test.ts:130:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 404
```

# Test source

```ts
  40  |   test('题库覆盖统计: 权限、来源筛选、重复学生参数与聚合口径', async ({ request }) => {
  41  |     const endpoint = '/api/admin/questions/coverage'
  42  |     const adminHeaders = { Authorization: `Bearer ${adminToken}` }
  43  |     const studentHeaders = { Authorization: `Bearer ${studentToken}` }
  44  | 
  45  |     const denied = await request.get(endpoint, { headers: studentHeaders })
  46  |     expect([401, 403]).toContain(denied.status())
  47  | 
  48  |     const allResponse = await request.get(endpoint, { headers: adminHeaders })
  49  |     expect(allResponse.status()).toBe(200)
  50  |     const allEnvelope = await allResponse.json()
  51  |     expect(allEnvelope.code).toBe(200)
  52  |     const all = allEnvelope.data
  53  |     expect(all.source).toBe('ALL')
  54  |     expect(all.inventory.totalUnits).toBe(
  55  |       all.inventory.ordinaryQuestionUnits + all.inventory.readingPassages,
  56  |     )
  57  |     expect(all.answers.attemptedUnits + all.answers.untouchedUnits).toBe(all.inventory.totalUnits)
  58  |     expect(all.answers.gradedCount + all.answers.ungradedCount).toBe(all.answers.attemptCount)
  59  |     expect(all.answers.correctCount).toBeLessThanOrEqual(all.answers.gradedCount)
  60  |     expect(all.reading.passageCount).toBe(all.inventory.readingPassages)
  61  |     expect(
  62  |       all.reading.fullyCoveredPassages +
  63  |         all.reading.partiallyCoveredPassages +
  64  |         all.reading.untouchedPassages,
  65  |     ).toBe(all.reading.passageCount)
  66  |     expect(all.byType.reduce((sum: number, row: { totalUnits: number }) => sum + row.totalUnits, 0)).toBe(
  67  |       all.inventory.totalUnits,
  68  |     )
  69  |     for (const alert of all.alerts) {
  70  |       expect(alert.totalUnits).toBeGreaterThan(0)
  71  |       expect(alert.untouchedUnits).toBe(0)
  72  |     }
  73  | 
  74  |     for (const source of ['EXAM', 'PRACTICE']) {
  75  |       const response = await request.get(`${endpoint}?source=${source}`, { headers: adminHeaders })
  76  |       expect(response.status(), `${source} coverage query`).toBe(200)
  77  |       const envelope = await response.json()
  78  |       expect(envelope.code).toBe(200)
  79  |       expect(envelope.data.source).toBe(source)
  80  |     }
  81  | 
  82  |     const filteredQuery = new URLSearchParams()
  83  |     filteredQuery.append('source', 'PRACTICE')
  84  |     filteredQuery.append('studentIds', String(studentId))
  85  |     filteredQuery.append('studentIds', String(studentId))
  86  |     filteredQuery.append('startTime', '2000-01-01 00:00:00')
  87  |     const filteredResponse = await request.get(`${endpoint}?${filteredQuery.toString()}`, {
  88  |       headers: adminHeaders,
  89  |     })
  90  |     expect(filteredResponse.status()).toBe(200)
  91  |     const filteredEnvelope = await filteredResponse.json()
  92  |     expect(filteredEnvelope.code).toBe(200)
  93  |     expect(filteredEnvelope.data.source).toBe('PRACTICE')
  94  |     expect(filteredEnvelope.data.studentIds).toEqual([studentId, studentId])
  95  |     expect(filteredEnvelope.data.startTime).toBe('2000-01-01 00:00:00')
  96  |   })
  97  | 
  98  |   test('学生端: 个人资料 / 周报 / 学习进度', async ({ request }) => {
  99  |     const t = studentToken
  100 |     // 个人资料 — 别名接口 my-profile 是刚补的
  101 |     await expect((await get(request, '/api/users/my-profile', t)).status()).toBe(200)
  102 |     await expect((await get(request, '/api/users/me', t)).status()).toBe(200)
  103 | 
  104 |     // 学习周报
  105 |     await expect((await get(request, '/api/weekly-report/current', t)).status()).toBe(200)
  106 |     await expect((await get(request, '/api/weekly-report/list?pageNum=1&pageSize=5', t)).status()).toBe(200)
  107 | 
  108 |     // 学习进度
  109 |     await expect((await get(request, '/api/learning-progress/me', t)).status()).toBe(200)
  110 |     await expect((await get(request, '/api/learning-progress/me/weak?limit=5', t)).status()).toBe(200)
  111 |     await expect((await get(request, '/api/learning-progress/me/strong?limit=5', t)).status()).toBe(200)
  112 |   })
  113 | 
  114 |   test('学生端考试相关: available / attended / 结果 / 错题', async ({ request }) => {
  115 |     const t = studentToken
  116 |     await expect((await get(request, '/api/exams/available', t)).status()).toBe(200)
  117 |     await expect((await get(request, '/api/exams/attended', t)).status()).toBe(200)
  118 |     await expect((await get(request, '/api/results/my-list?pageNum=1&pageSize=10', t)).status()).toBe(200)
  119 |     await expect((await get(request, '/api/results/my-summary', t)).status()).toBe(200)
  120 |     await expect((await get(request, '/api/results/wrong-book?pageNum=1&pageSize=10', t)).status()).toBe(200)
  121 |   })
  122 | 
  123 |   test('学生端 通知', async ({ request }) => {
  124 |     const t = studentToken
  125 |     await expect((await get(request, '/api/notifications?pageNum=1&pageSize=10', t)).status()).toBe(200)
  126 |     await expect((await get(request, '/api/notifications/unread-count', t)).status()).toBe(200)
  127 |     await expect((await get(request, '/api/notifications/preferences', t)).status()).toBe(200)
  128 |   })
  129 | 
  130 |   test('管理员端: dashboard / users / questions / papers / sessions', async ({ request }) => {
  131 |     const t = adminToken
  132 |     await expect((await get(request, '/api/admin/dashboard', t)).status()).toBe(200)
  133 |     await expect((await get(request, '/api/users?pageNum=1&pageSize=5', t)).status()).toBe(200)
  134 |     await expect((await get(request, '/api/questions?pageNum=1&pageSize=5', t)).status()).toBe(200)
  135 |     await expect((await get(request, '/api/papers?pageNum=1&pageSize=5', t)).status()).toBe(200)
  136 |     await expect((await get(request, '/api/sessions?pageNum=1&pageSize=5', t)).status()).toBe(200)
  137 |     await expect((await get(request, '/api/categories/tree', t)).status()).toBe(200)
  138 |     await expect((await get(request, '/api/reading-passages?pageNum=1&pageSize=5', t)).status()).toBe(200)
  139 |     await expect((await get(request, '/api/tags/questions', t)).status()).toBe(200)
> 140 |     await expect((await get(request, '/api/tags/papers', t)).status()).toBe(200)
      |                                                                        ^ Error: expect(received).toBe(expected) // Object.is equality
  141 |   })
  142 | 
  143 |   test('管理员端: 操作日志 / 系统设置', async ({ request }) => {
  144 |     const t = adminToken
  145 |     await expect((await get(request, '/api/admin/operation-logs?pageNum=1&pageSize=5', t)).status()).toBe(200)
  146 |     await expect((await get(request, '/api/admin/operation-logs/types', t)).status()).toBe(200)
  147 |     await expect((await get(request, '/api/admin/system-config', t)).status()).toBe(200)
  148 |     await expect((await get(request, '/api/admin/system-config/ai/overview', t)).status()).toBe(200)
  149 |   })
  150 | 
  151 |   test('管理员端: 工作流 / AI', async ({ request }) => {
  152 |     const t = adminToken
  153 |     await expect((await get(request, '/api/admin/workflow/nodes', t)).status()).toBe(200)
  154 |     await expect((await get(request, '/api/admin/workflow/connections', t)).status()).toBe(200)
  155 |     // AI 生成记录列表
  156 |     await expect((await get(request, '/api/admin/ai/generation-logs?pageNum=1&pageSize=5', t)).status()).toBe(200)
  157 |   })
  158 | })
  159 | 
```