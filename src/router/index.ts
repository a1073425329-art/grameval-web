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
    // 真实存在的 404 落点 —— 已禁用模块重定向到这里（见守卫 DISABLED_PATHS 分支）。
    // 必须显式注册：若只写 return { path: '/404' } 而不注册该路径，会再次命中下面的
    // catch-all（name=NotFound），在守卫「无权即回首页」的新逻辑下被弹回首页，
    // 与 DISABLED 分支互相打架形成循环。
    path: '/404',
    name: 'NotFoundPage',
    component: () => import('@/views/error/404.vue'),
    meta: { title: '404', noAuth: true },
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
 * [2026-09-27 新增] 已注册动态路由的名字清单（只由本文件维护）。
 *
 * 动因：`router.addRoute()` 只增不减，而登录页与 Header 登出都**不刷新页面**，
 * 同一标签页切换账号时，上一个角色的路由会一直残留在 router 上 ——
 * 学生登出后再登录管理员，仍可直达 `/student/practice`（越权）。
 * 全项目此前从未调用过 `removeRoute()`，故在此按记录的名字精确注销。
 *
 * 为什么放这里而不是 `stores/permission.ts`：该文件若 import `@/router`
 * 会形成 `router → permission → router` 循环依赖，且 reset() 本身只该管
 * 「是否已生成」标志位。路由的物理增删属于 router 的职责。
 */
let registeredNames: string[] = []

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
    // [2026-09-27 新增] 生成前先注销上一个账号遗留的动态路由，杜绝切账号越权
    registeredNames.forEach((n) => {
      if (router.hasRoute(n)) router.removeRoute(n)
    })
    registeredNames = []

    // [2026-09-26 修改] 传入超管标记：教师/老师/管理员同一角色，仅 admin 账号多 4 个管理菜单（06 §9.1）
    const accessed = permissionStore.generateRoutes(authStore.role as Role, authStore.isSuperAdmin)
    accessed.forEach((r) => {
      router.addRoute('Root', r)
    })
    registeredNames = accessed
      .map((r) => r.name)
      .filter((n): n is string => typeof n === 'string')

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
  // 必须排在下面的 NotFound 兜底之前：两者都表现为未命中，但语义不同。
  if (DISABLED_PATHS.includes(to.path)) {
    // 带 disabled 标记 → 404.vue 据此显示「该功能已下线」而非「页面不存在」
    return { path: '/404', query: { disabled: '1' }, replace: true }
  }

  // ==================== 无权 / 路径不存在 → 回角色首页 ====================
  // [2026-09-27 修复] 走到这里说明目标路径没命中任何已注册路由（只剩 catch-all）。
  //
  // 根因（已实测复现）：登录页把 `?redirect=` 原样回放，而本守卫生成路由后
  //   从不校验目标是否属于当前账号，于是：
  //     · 学生 user01 回跳 /admin/categories  → 404（页面还弹着「登录成功」）
  //     · teacher01（ADMIN 非超管）回跳 /admin/users（superOnly）→ 404
  //     · 对照：admin 同一 URL → 正常进入「用户管理」
  //   此前第二次进入守卫时 generated 已为 true，直接 `return true` 放行，
  //   一路落到 catch-all —— 这就是「有时候登录就 404」的全部原因。
  if (to.name === 'NotFound') {
    return { path: HOME_BY_ROLE[authStore.role as Role], replace: true }
  }

  // ==================== 放行 ====================
  return true
})

export default router
