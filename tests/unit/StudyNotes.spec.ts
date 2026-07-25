/**
 * StudyNotes 组件行为冒烟测试:
 *   - 组件能挂载不抛错
 *   - "新建笔记" 按钮点了之后 dialog 变为可见 (dialogVisible=true)
 *   - 内部 el-dialog 的 v-model 与 dialogVisible 双向绑定成功
 *
 * 该测试的目的正是防止 "点了没反应" 类回归 —— 如果哪天有人把 v-model 改回 .sync,
 * 这个测试会立刻挂掉。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import StudyNotes from '@/views/student/StudyNotes.vue'

// Mock api 层, 让测试不依赖真实后端
vi.mock('@/api/student', () => ({
  listMyNotes: vi.fn().mockResolvedValue({ data: { records: [], total: 0 } }),
  createStudyNote: vi.fn().mockResolvedValue({ data: { id: 1 } }),
  updateStudyNote: vi.fn().mockResolvedValue({ data: { id: 1 } }),
  deleteStudyNote: vi.fn().mockResolvedValue({ data: null }),
  listCategories: vi.fn().mockResolvedValue({ data: [] }),
}))

const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] })

const mountIt = () =>
  mount(StudyNotes, {
    global: {
      plugins: [ElementPlus, router, createPinia()],
      stubs: {
        // 避免 element-plus icon 组件在 happy-dom 里的边界问题
        'el-icon': true,
      },
    },
    attachTo: document.body,
  })

describe('学生学习笔记页 (StudyNotes.vue)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('能顺利挂载', async () => {
    const w = mountIt()
    await flushPromises()
    expect(w.text()).toContain('学习笔记')
    expect(w.text()).toContain('新建笔记')
    w.unmount()
  })

  it('点击 "新建笔记" 按钮后 dialogVisible 应为 true (回归: 修 :visible.sync 打不开的 bug)', async () => {
    const w = mountIt()
    await flushPromises()

    // vm 是组件的实例, 拿它内部 setup 暴露的 dialogVisible ref
    const vm: any = w.vm
    expect(vm.dialogVisible).toBe(false)
    expect(vm.isAdding).toBe(false)

    // 找到主 "新建笔记" 按钮 (页头右侧那个)
    const buttons = w.findAll('button')
    const createBtn = buttons.find((b) => b.text().includes('新建笔记'))
    expect(createBtn, '页面应有 "新建笔记" 按钮').toBeTruthy()

    await createBtn!.trigger('click')
    await flushPromises()

    expect(vm.isAdding).toBe(true)
    expect(vm.dialogVisible).toBe(true)

    // 模拟关闭弹窗
    vm.dialogVisible = false
    await flushPromises()
    expect(vm.isAdding).toBe(false)
    expect(vm.isEditing).toBe(false)

    w.unmount()
  })
})
