import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 全局 UI 状态：侧边栏折叠、设备类型（响应式）
 */
export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = ref<boolean>(
    localStorage.getItem('sidebar-collapsed') === 'true'
  )

  const toggleSidebar = () => {
    sidebarCollapsed.value = !sidebarCollapsed.value
    localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed.value))
  }

  const setSidebar = (v: boolean) => {
    sidebarCollapsed.value = v
    localStorage.setItem('sidebar-collapsed', String(v))
  }

  return {
    sidebarCollapsed,
    toggleSidebar,
    setSidebar,
  }
})
