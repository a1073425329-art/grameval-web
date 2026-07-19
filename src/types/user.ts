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
  /** base64 或 URL；过长时不宜存 localStorage，见 authStore.login() */
  avatar?: string
}

/**
 * 用户详情（GET /users/me、GET /users/{id}）—— 对齐后端 UserVO
 * 完整字段，可用于个人资料页。
 * 学生角色额外返回训练时间信息 + 所属老师信息。
 */
export interface UserDetail {
  id: number
  username: string
  realName: string
  /** 兼容别名：后端同时输出 realName 和 displayName */
  displayName?: string
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

  // ===== 学生训练信息（仅 STUDENT 角色返回） =====
  /** 训练计划开始日期，如 "2026-01-01" */
  trainingStartDate?: string
  /** 实际训练开始日期（可手动修改） */
  actualStartDate?: string
  /** 训练计划结束日期 */
  trainingEndDate?: string
  /** 可训练星期（逗号分隔 1-7） */
  trainingDays?: string

  // ===== 所属老师信息（仅 STUDENT 角色返回） =====
  teacher?: TeacherInfo
}

/** 老师基本信息（后端 UserVO.TeacherInfo） */
export interface TeacherInfo {
  id: number
  username: string
  realName: string
  displayName?: string
  phone?: string
  email?: string
  avatar?: string
  gender?: 0 | 1 | 2
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
