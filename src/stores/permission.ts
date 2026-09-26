import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { asyncRoutes } from '@/router/asyncRoutes'
import type { Role } from '@/types/common'

/**
 * 过滤 meta.roles，返回当前 role 能看到的路由。
 * meta.disabled === true 的路由直接跳过 —— 不注册、不进菜单、直达 URL 也不可达。
 * [2026-09-26 新增] meta.superOnly === true 的路由仅超管（admin 账号）可见 —— 06 §9.1 角色菜单分流。
 */
function filterRoutes(routes: RouteRecordRaw[], role: Role, superAdmin: boolean): RouteRecordRaw[] {
  const res: RouteRecordRaw[] = []
  routes.forEach((r) => {
    const tmp = { ...r }
    if (tmp.meta?.disabled === true) return
    if (tmp.meta?.superOnly === true && !superAdmin) return
    const roles = (tmp.meta?.roles as Role[] | undefined) ?? []
    if (roles.length === 0 || roles.includes(role)) {
      if (tmp.children) {
        tmp.children = filterRoutes(tmp.children, role, superAdmin)
      }
      res.push(tmp)
    }
  })
  return res
}

export const usePermissionStore = defineStore('permission', () => {
  /** 当前 role 可访问的动态子路由（挂在 layout 下） */
  const routes = ref<RouteRecordRaw[]>([])
  /** 是否已生成 */
  const generated = ref(false)

  const generateRoutes = (role: Role, superAdmin = false) => {
    const accessed = filterRoutes(asyncRoutes, role, superAdmin)
    routes.value = accessed
    generated.value = true
    return accessed
  }

  const reset = () => {
    routes.value = []
    generated.value = false
  }

  return {
    routes,
    generated,
    generateRoutes,
    reset,
  }
})
