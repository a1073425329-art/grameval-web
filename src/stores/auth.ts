import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as loginApi, register as registerApi, getMe } from '@/api/auth'
import type { LoginForm, RegisterForm, UserInfo, UserDetail } from '@/types/user'
import type { Role } from '@/types/common'

const TOKEN_KEY = 'token'
const USER_KEY = 'userInfo'
const ROLE_KEY = 'role'

function readUser(): UserInfo | null {
  const raw = localStorage.getItem(USER_KEY)
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
  const token = ref<string>(localStorage.getItem(TOKEN_KEY) || '')
  const userInfo = ref<UserInfo | null>(readUser())
  /** 完整用户资料（GET /auth/me 拉回） */
  const userDetail = ref<UserDetail | null>(null)

  const role = computed<Role | ''>(() => {
    if (userInfo.value?.role) return userInfo.value.role
    return (localStorage.getItem(ROLE_KEY) as Role) || ''
  })

  const isLoggedIn = computed(() => Boolean(token.value))
  const homePath = computed<string>(() => (role.value ? HOME_BY_ROLE[role.value as Role] : '/login'))

  const login = async (form: LoginForm) => {
    const res = await loginApi(form)
    const payload = res as unknown as { data: { token: string; user: UserInfo } }
    const { token: tk, user } = payload.data

    token.value = tk
    userInfo.value = user
    localStorage.setItem(TOKEN_KEY, tk)
    // 头像 base64 可能很长（几十 KB），
    // localStorage 通常只有 5MB 且存太多 base64 拖慢序列化。
    // 这里只存轻量身份字段，avatar 需要时从 /auth/me 拉。
    localStorage.setItem(USER_KEY, JSON.stringify({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    }))
    localStorage.setItem(ROLE_KEY, user.role)
    return user
  }

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
      localStorage.setItem(USER_KEY, JSON.stringify(userInfo.value))
    }
    return res.data
  }

  const logout = () => {
    token.value = ''
    userInfo.value = null
    userDetail.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(ROLE_KEY)
  }

  return {
    token,
    userInfo,
    userDetail,
    role,
    isLoggedIn,
    homePath,
    login,
    register,
    fetchMe,
    logout,
  }
})
