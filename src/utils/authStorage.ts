/**
 * 登录态（token / role / userInfo）存取的**唯一入口**。
 *
 * [2026-09-26 决策 D12 第 4 条] 登录态一律放 sessionStorage：
 *   答辩演示要在一个浏览器里开多个窗口、分别登录不同账号（管理员 + 学生），
 *   localStorage 是多窗口共享的 → 后登录的窗口覆盖前一个 → 串号；
 *   sessionStorage 按标签页隔离，正好满足需求。
 *
 * 【铁律】任何模块要读写这三个 key，只能走本文件，
 * 严禁直接碰 localStorage / sessionStorage 的 token、role、userInfo ——
 * 否则读写两侧再次分裂（2026-09-27 就踩过：auth.ts 写 sessionStorage，
 * request.ts / websocket.ts 却读 localStorage，开了 JWT 后全站 401 且登录死循环）。
 *
 * 注意：本文件不能 import stores/auth（会形成 request → auth → api → request 循环依赖）。
 */

export const TOKEN_KEY = 'token'
export const USER_KEY = 'userInfo'
export const ROLE_KEY = 'role'

/** 读当前标签页的 token（无则空串） */
export const getToken = (): string => sessionStorage.getItem(TOKEN_KEY) || ''

/** 写 token */
export const setToken = (tk: string): void => {
  sessionStorage.setItem(TOKEN_KEY, tk)
}

/** 读角色 */
export const getRole = (): string => sessionStorage.getItem(ROLE_KEY) || ''

/** 写角色 */
export const setRole = (role: string): void => {
  sessionStorage.setItem(ROLE_KEY, role)
}

/** 读原始 userInfo JSON（解析交给 auth store） */
export const getUserRaw = (): string | null => sessionStorage.getItem(USER_KEY)

/** 写原始 userInfo JSON */
export const setUserRaw = (json: string): void => {
  sessionStorage.setItem(USER_KEY, json)
}

/** 清空登录态（401 / 登出共用，三把 key 一次清干净） */
export const clearAuth = (): void => {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
  sessionStorage.removeItem(ROLE_KEY)
}
