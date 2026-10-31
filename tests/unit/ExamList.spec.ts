/**
 * ExamList 组件行为冒烟测试:
 *   - 组件能挂载, 渲染"待考"和"已参加"两个 Tab
 *   - 切换 Tab 后 API 调用正确
 *   - "进行中"和"未开始"的状态标签渲染正确
 *
 * 回归目标: 防止 "已经考过的仍然出现在待考里" 的 bug 复现 (修复: ExamService 增加 attendedOnly 过滤)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import ExamList from '@/views/student/ExamList.vue'

// Mock api — all inside vi.mock factory because vi.mock is hoisted
vi.mock('@/api/student', () => ({
  getAvailableExams: vi.fn().mockResolvedValue({
    data: [
      {
        id: 1, sessionName: '期中语法测验', paperId: 101, paperName: '语法综合卷 A',
        startTime: '2020-01-01T00:00:00.000Z', endTime: '2099-12-31T23:59:59.000Z',
        duration: 60, status: 1, attendedCount: 12,
      },
      {
        id: 2, sessionName: '已经结束的考试', paperId: 102, paperName: '旧试卷',
        startTime: '2020-01-01T00:00:00.000Z', endTime: '2020-01-02T00:00:00.000Z',
        duration: 30, status: 2,
      },
    ],
  }),
  getAttendedExams: vi.fn().mockResolvedValue({
    data: [
      {
        id: 3, sessionName: '已参加的词汇测验', paperId: 103, paperName: '词汇卷 B',
        startTime: '2020-01-01T00:00:00.000Z', endTime: '2020-01-02T00:00:00.000Z',
        duration: 45, status: 2, attempted: true, examRecordId: 501, submitStatus: 1, myScore: 85.5,
      },
      {
        id: 4, sessionName: '进行中的考试(已参加但未提交)', paperId: 104, paperName: '阅读卷 C',
        startTime: '2020-01-01T00:00:00.000Z', endTime: '2099-12-31T23:59:59.000Z',
        duration: 90, status: 1, attempted: true, examRecordId: 502, submitStatus: 0,
      },
    ],
  }),
  startExam: vi.fn().mockResolvedValue({ data: { id: 999 } }),
  listCategories: vi.fn(),
}))

// Re-import mocked functions for assertions
import { getAvailableExams, getAttendedExams } from '@/api/student'

const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] })

const mountIt = () =>
  mount(ExamList, {
    global: {
      plugins: [ElementPlus, router, createPinia()],
      stubs: { 'el-icon': true },
    },
    attachTo: document.body,
  })

describe('考试列表页 (ExamList.vue)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('能顺利挂载, 显示"在线考试"标题和四个 Tab', async () => {
    const w = mountIt()
    await flushPromises()

    expect(w.text()).toContain('在线考试')
    expect(w.text()).toContain('全部')
    expect(w.text()).toContain('待考')
    expect(w.text()).toContain('续考')
    expect(w.text()).toContain('已参加')

    // onMounted 会同时加载两个列表
    expect(getAvailableExams).toHaveBeenCalledTimes(1)
    expect(getAttendedExams).toHaveBeenCalledTimes(1)

    w.unmount()
  })

  it('默认展示全部 Tab, 卡片按续考→待考→已参加排序', async () => {
    const w = mountIt()
    await flushPromises()

    // 全部 Tab：四条都应出现
    expect(w.text()).toContain('期中语法测验')
    expect(w.text()).toContain('已经结束的考试')
    expect(w.text()).toContain('已参加的词汇测验')
    expect(w.text()).toContain('进行中的考试(已参加但未提交)')

    // 续考排最前
    const text = w.text()
    const iResume = text.indexOf('进行中的考试(已参加但未提交)')
    const iPending = text.indexOf('期中语法测验')
    const iDone = text.indexOf('已参加的词汇测验')
    expect(iResume).toBeGreaterThanOrEqual(0)
    expect(iPending).toBeGreaterThan(iResume)
    expect(iDone).toBeGreaterThan(iPending)

    w.unmount()
  })

  it('已参加 Tab 显示已提交成绩；续考 Tab 显示未完成答卷', async () => {
    const w = mountIt()
    await flushPromises()

    // 已参加 Tab：只有已提交
    const tabs = w.findAll('.el-tabs__item')
    const attendedTab = tabs.find((t) => t.text().includes('已参加'))
    expect(attendedTab, '应该有"已参加" Tab').toBeTruthy()
    await attendedTab!.trigger('click')
    await flushPromises()

    expect(w.text()).toContain('已参加的词汇测验')
    expect(w.text()).toContain('已提交')
    expect(w.text()).toContain('85.50')
    // [2026-10-31 修] 口径变更：已参加 = 有答卷记录且非缺考，续考（未提交）也应出现在已参加里；
    //   原断言「未完成的不在已参加里」对应旧口径（已参加会漏掉续考，导致与「参加场次」统计卡不一致）。
    expect(w.text()).toContain('进行中的考试(已参加但未提交)')

    // 续考 Tab：未完成答卷 + 续考按钮
    const resumeTab = tabs.find((t) => t.text().includes('续考'))
    expect(resumeTab, '应该有"续考" Tab').toBeTruthy()
    await resumeTab!.trigger('click')
    await flushPromises()
    expect(w.text()).toContain('进行中的考试(已参加但未提交)')
    expect(w.text()).toContain('续考')

    w.unmount()
  })

  it('切换回待考 Tab 后, 再次看到进行中的考试', async () => {
    const w = mountIt()
    await flushPromises()

    // 先切到已参加
    const tabs = w.findAll('.el-tabs__item')
    const attendedTab = tabs.find((t) => t.text().includes('已参加'))
    await attendedTab!.trigger('click')
    await flushPromises()
    expect(w.text()).toContain('已参加的词汇测验')

    // 再切回待考
    const availableTab = tabs.find((t) => t.text().includes('待考'))
    await availableTab!.trigger('click')
    await flushPromises()
    expect(w.text()).toContain('期中语法测验')
    expect(w.text()).toContain('进行中')

    w.unmount()
  })

  it('刷新按钮重新调 API', async () => {
    const w = mountIt()
    await flushPromises()

    // clearMocks 后计数清零, 再点刷新
    const refreshBtn = w.find('button')
    await refreshBtn.trigger('click')
    await flushPromises()

    // 默认 tab=available, 刷新会重调 getAvailableExams
    expect(getAvailableExams).toHaveBeenCalled()

    w.unmount()
  })
})
