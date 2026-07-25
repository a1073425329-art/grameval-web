/**
 * 学习小组页 (StudyGroups.vue) 冒烟测试:
 *   - 挂载不抛错
 *   - "创建小组" 按钮点击后 showCreateModal=true (回归 :visible.sync bug)
 *   - 创建流程能触发 handleCreate 并调用 API
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'

vi.mock('@/api/student', () => ({
  listMyGroups: vi.fn().mockResolvedValue({ data: [] }),
  searchGroups: vi.fn().mockResolvedValue({ data: [] }),
  getStudyGroup: vi.fn().mockResolvedValue({ data: { id: 1, groupName: 't', memberCount: 0, maxMembers: 10 } }),
  listGroupMembers: vi.fn().mockResolvedValue({ data: [] }),
  createStudyGroup: vi.fn().mockResolvedValue({ data: { id: 1 } }),
  joinGroup: vi.fn().mockResolvedValue({}),
  leaveGroup: vi.fn().mockResolvedValue({}),
  deleteStudyGroup: vi.fn().mockResolvedValue({}),
}))

import StudyGroups from '@/views/student/StudyGroups.vue'
import * as studentApi from '@/api/student'

const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] })

const mountIt = () =>
  mount(StudyGroups, {
    global: {
      plugins: [ElementPlus, router, createPinia()],
      stubs: { 'el-icon': true },
    },
    attachTo: document.body,
  })

describe('学习小组页 (StudyGroups.vue)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('能挂载', async () => {
    const w = mountIt()
    await flushPromises()
    expect(w.text()).toContain('学习小组')
    expect(w.text()).toContain('创建小组')
    w.unmount()
  })

  it('点击 "创建小组" 按钮, showCreateModal 变 true (回归 :visible.sync 打不开)', async () => {
    const w = mountIt()
    await flushPromises()
    const vm: any = w.vm
    expect(vm.showCreateModal).toBe(false)

    const btn = w.findAll('button').find((b) => b.text().includes('创建小组'))
    expect(btn, '页面应有 "创建小组" 按钮').toBeTruthy()
    await btn!.trigger('click')
    await flushPromises()
    expect(vm.showCreateModal).toBe(true)
    w.unmount()
  })

  it('handleCreate 在标题非空时会调用 createStudyGroup API', async () => {
    const w = mountIt()
    await flushPromises()
    const vm: any = w.vm
    vm.createForm.groupName = 'test-group'
    vm.createForm.description = 'test'
    vm.createForm.maxMembers = 5

    await vm.handleCreate()
    await flushPromises()
    expect((studentApi as any).createStudyGroup).toHaveBeenCalledOnce()
    // 创建成功后应关闭弹窗
    expect(vm.showCreateModal).toBe(false)
    w.unmount()
  })
})
