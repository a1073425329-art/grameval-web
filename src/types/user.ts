import type { Role } from './common'

/** 登录请求 */
export interface LoginForm {
  username: string
  password: string
  /** 可选：登录入口指定的角色，传值时后端会校验账号角色是否匹配 */
  role?: Role
}

/** 注册请求 */
export interface RegisterForm {
  username: string
  password: string
  realName?: string
  email?: string
  phone?: string
  role?: Role
}

/**
 * 登录响应里的用户信息（LoginResponse.user）—— 精简
 */
export interface UserInfo {
  id: number
  username: string
  displayName: string
  role: Role
}

/**
 * 用户详情（GET /users/me、GET /users/{id}）—— UserVO
 * 完整字段，可用于个人资料页
 */
export interface UserDetail {
  id: number
  username: string
  realName: string
  gender?: 0 | 1 | 2
  email?: string
  phone?: string
  idCard?: string
  avatar?: string
  role: Role
  status: 0 | 1
  lastLoginTime?: string
  lastLoginIp?: string
  createTime: string
  updateTime?: string
}

/** 登录响应 —— 与后端 LoginResponse 对齐 */
export interface LoginResult {
  token: string
  tokenType: string
  expiresIn: number
  user: UserInfo
}

/** 用户资料修改 */
export interface UserUpdateForm {
  realName?: string
  gender?: number
  email?: string
  phone?: string
  idCard?: string
  avatar?: string
}

/** 修改密码 */
export interface PasswordChangeForm {
  oldPassword: string
  newPassword: string
}

/** 管理员创建用户 */
export interface UserCreateForm {
  username: string
  password: string
  realName?: string
  gender?: number
  email?: string
  phone?: string
  role?: Role
}
