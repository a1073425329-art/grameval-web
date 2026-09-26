import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore, HOME_BY_ROLE } from '@/stores/auth'
import { usePermissionStore } from '@/stores/permission'
import { DISABLED_PATHS } from '@/router/asyncRoutes'
import type { Role } from '@/types/common'

/** 白名单：无需登录 */
const WHITE_LIST = ['/login', '/register']

/** 基础静态路由 */
export const constantRoutes: RouteRecordRaw[] = [
  {
    // 登录页
    // 支持三种进入方式：
    //   /login                  → 通用登录（用户在页面上选身份）
    //   /login/student          → 学生入口（页面预选、锁定 STUDENT）
    //   /login/admin            → 管理员入口
    // 也兼容 query：/login?role=student
    path: '/login/:role?',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', noAuth: true },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/register/index.vue'),
    meta: { title: '注册', noAuth: true },
  },
  {
    path: '/',
    name: 'Root',
    component: () => import('@/views/layout/index.vue'),
    children: [
      {
        path: 'redirect',
        name: 'Redirect',
        component: () => import('@/views/redirect/index.vue'),
        meta: { hidden: true },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    // 注意：不要给 noAuth: true。
    // 否则刷新动态路由（如 /dashboard）时，由于路由未注册会先命中此 catch-all，
    // to.meta.noAuth 继承为 true，导致守卫误判为白名单直接放行，
    // 跳过了动态路由生成逻辑，页面就永远卡在 404。
    meta: { title: '404' },
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes: constantRoutes,
})

/**
 * 全局路由守卫 —— Vue Router 4 推荐返回值模式：
 *   - return true / undefined  → 放行
 *   - return 路径字符串或对象    → 重定向
 *   - return false             → 取消导航
 *
 * 动态路由异步生成逻辑：
 *   首次进入时根据 role 过滤 asyncRoutes → addRoute('Root', ...) → return to.fullPath 重试
 *   第二次进入时路由已就绪，直接放行
 */
router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  const permissionStore = usePermissionStore()

  if (to.meta.title) {
    document.title = `${to.meta.title} - GramEval`
  }

  // 判断是否是登录路径（/login、/login/student、/login/admin）
  const isLoginRoute = to.path === '/login' || to.path.startsWith('/login/')
  const isWhitelisted = isLoginRoute || WHITE_LIST.includes(to.path) || to.meta.noAuth

  // ==================== 白名单放行 ====================
  if (isWhitelisted) {
    // 已登录用户访问登录页 → 直接跳角色首页
    if (isLoginRoute && authStore.token && authStore.role) {
      return authStore.homePath
    }
    return true
  }

  // ==================== 未登录 → 登录页 ====================
  if (!authStore.token) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  // ==================== 有 token 但无 role（异常）→ 清空重新登录 ====================
  if (!authStore.role) {
    authStore.logout()
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  // ==================== 动态路由生成 ====================
  if (!permissionStore.generated) {
    // [2026-09-26 修改] 传入超管标记：教师/老师/管理员同一角色，仅 admin 账号多 4 个管理菜单（06 §9.1）
    const accessed = permissionStore.generateRoutes(authStore.role as Role, authStore.isSuperAdmin)
    accessed.forEach((r) => {
      router.addRoute('Root', r)
    })

    const homePath = HOME_BY_ROLE[authStore.role as Role]

    // 访问根路径 → 重定向到角色首页
    if (to.path === '/' || to.path === '/redirect') {
      return { path: homePath, replace: true }
    }

    // 🔑 关键：返回 to.fullPath 字符串触发一次全新导航，
    // 让 Vue Router 用已注册的动态路由重新匹配 /dashboard 等路径。
    // 不要 return { ...to, replace: true }——to 里带着 name: 'NotFound'、
    // matched 等字段，spread 出来会让新导航继续按 NotFound 走，仍然 404。
    return to.fullPath
  }

  // ==================== 已禁用模块拦截 ====================
  // 这些模块的路由被 meta.disabled 过滤掉、不会注册（访问时命中 catch-all 即 404）。
  // 此处再拦一道，防止将来误把路由加回后仍能通过 URL 直达。
  if (DISABLED_PATHS.includes(to.path)) {
    return { path: '/404', replace: true }
  }

  // ==================== 放行 ====================
  return true
})

export default router
