import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as loginApi, register as registerApi, getMe } from '@/api/auth'
import type { LoginForm, RegisterForm, UserInfo, UserDetail } from '@/types/user'
import type { Role } from '@/types/common'
import * as AUTH from '@/utils/authStorage'

// [2026-09-26 修改] 登录态存储 localStorage → sessionStorage（依据 05 决策 D12 第 4 条）
//   答辩演示需要同时开多个浏览器窗口（如管理员 + 学生各一），localStorage 是多窗口共享的，
//   后登录的窗口会覆盖前一个，导致演示串号；sessionStorage 按标签页隔离，正好满足需求。
//   行为差异：① F5 刷新仍保持登录（同标签页内）② 关标签页即登出 ③ 用链接/window.open 打开的
//   新标签页会复制一份 sessionStorage 初值，演示时请手动新开窗口（Ctrl+N）。
// [2026-09-27 补] 原先在此别名 AUTH.TOKEN_KEY/USER_KEY/ROLE_KEY 的三个常量已删除：
//   所有读写已统一走 authStorage 的 getToken/setToken/getRole/setRole/getUserRaw/setUserRaw/clearAuth，
//   三个别名无任何调用点（vue-tsc 的 noUnusedLocals 会拦截，勿再引入）。

function readUser(): UserInfo | null {
  const raw = AUTH.getUserRaw()
  if (!raw) return null
  try {
    return JSON.parse(raw) as UserInfo
  } catch {
    return null
  }
}

/** 角色 → 首页 */
export const HOME_BY_ROLE: Record<Role, string> = {
  ADMIN: '/dashboard',
  STUDENT: '/student/home',
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(AUTH.getToken())
  const userInfo = ref<UserInfo | null>(readUser())
  /** 完整用户资料（GET /auth/me 拉回） */
  const userDetail = ref<UserDetail | null>(null)

  const role = computed<Role | ''>(() => {
    if (userInfo.value?.role) return userInfo.value.role
    return (AUTH.getRole() as Role) || ''
  })

  const isLoggedIn = computed(() => Boolean(token.value))
  const homePath = computed<string>(() => (role.value ? HOME_BY_ROLE[role.value as Role] : '/login'))

  const login = async (form: LoginForm) => {
    const res = await loginApi(form)
    const payload = res as unknown as { data: { token: string; user: UserInfo } }
    const { token: tk, user } = payload.data

    token.value = tk
    userInfo.value = user
    AUTH.setToken(tk)
    // 头像 base64 可能很长（几十 KB），
    // sessionStorage 通常只有 5MB 且存太多 base64 拖慢序列化。
    // 这里只存轻量身份字段，avatar 需要时从 /auth/me 拉。
    AUTH.setUserRaw(JSON.stringify({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      // [2026-09-26 新增] 超管标记（仅 admin 账号为 true）→ 用于前端菜单分流（06 §9.1）
      superAdmin: (user as unknown as { superAdmin?: boolean }).superAdmin === true,
    }))
    AUTH.setRole(user.role)
    return user
  }

  // [2026-09-26 新增] 是否超管账号：教师/老师/管理员是同一角色，
  //   仅 admin 账号额外可见「系统配置 / 操作日志 / 用户管理 / 班级管理」4 个菜单（06 §9.1）
  const isSuperAdmin = computed<boolean>(
    () => (userInfo.value as unknown as { superAdmin?: boolean } | null)?.superAdmin === true,
  )

  const register = async (form: RegisterForm) => registerApi(form)

  /** 拉当前用户完整资料 */
  const fetchMe = async () => {
    const res = await getMe()
    userDetail.value = res.data
    // 顺带同步 userInfo（displayName 若为空可用 realName 兜底）
    if (userInfo.value && res.data.realName) {
      userInfo.value = {
        ...userInfo.value,
        displayName: res.data.realName || userInfo.value.displayName,
      }
      AUTH.setUserRaw(JSON.stringify(userInfo.value))
    }
    return res.data
  }

  const logout = () => {
    token.value = ''
    userInfo.value = null
    userDetail.value = null
    AUTH.clearAuth()
  }

  return {
    token,
    userInfo,
    userDetail,
    role,
    isLoggedIn,
    homePath,
    isSuperAdmin,
    login,
    register,
    fetchMe,
    logout,
  }
})
