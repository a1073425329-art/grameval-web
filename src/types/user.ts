import type { Role } from './common'

/** 登录请求（请求 DTO, 可选字段放宽 undefined, 见 src/api/admin.ts 顶部说明） */
export interface LoginForm {
  username: string
  password: string
  /** 可选：登录入口指定的角色，传值时后端会校验账号角色是否匹配 */
  role?: Role | undefined | undefined
}

/** 注册请求 */
export interface RegisterForm {
  username: string
  password: string
  realName?: string | undefined
  englishName?: string | undefined
  email?: string | undefined
  phone?: string | undefined
  role?: Role | undefined
}

/** 登录响应里的用户信息（LoginResponse.user）—— 精简 */
export interface UserInfo {
  id: number
  username: string
  displayName: string
  englishName?: string | undefined
  role: Role
  /** base64 或 URL；过长时不宜存 localStorage，见 authStore.login() */
  avatar?: string | undefined
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
  englishName?: string | undefined
  /** 兼容别名：后端同时输出 realName 和 displayName */
  displayName?: string | undefined
  gender?: 0 | 1 | 2 | undefined
  email?: string | undefined
  phone?: string | undefined
  idCard?: string | undefined
  avatar?: string | undefined
  role: Role
  status: 0 | 1
  lastLoginTime?: string | undefined
  lastLoginIp?: string | undefined
  createTime: string
  updateTime?: string | undefined
  /** 学号（学生展示用，不做流程引用） */
  studentNumber?: string | undefined
  /** 师号/工号（教师展示用，不做流程引用） */
  teacherId?: string | undefined
  schoolName?: string | undefined
  className?: string | undefined
  grade?: string | undefined
  englishLevel?: string | undefined
  subject?: string | undefined
  teacherLevel?: string | undefined

  // ===== 所属老师信息（仅 STUDENT 角色返回） =====
  teacher?: TeacherInfo | undefined
}

/** 老师基本信息（后端 UserVO.TeacherInfo） */
export interface TeacherInfo {
  id: number
  username: string
  realName: string
  englishName?: string | undefined
  displayName?: string | undefined
  phone?: string | undefined
  email?: string | undefined
  avatar?: string | undefined
  gender?: 0 | 1 | 2 | undefined
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
  realName?: string | undefined
  englishName?: string | undefined
  gender?: number | undefined
  email?: string | undefined
  phone?: string | undefined
  idCard?: string | undefined
  avatar?: string | undefined
  studentNumber?: string | undefined
  teacherId?: string | undefined
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
  realName?: string | undefined | undefined
  englishName?: string | undefined | undefined
  gender?: number | undefined | undefined
  email?: string | undefined | undefined
  phone?: string | undefined | undefined
  role?: Role | undefined | undefined
  /** 学号（学生）/ 师号（教师），仅展示编辑，不进业务流程 */
  studentNumber?: string | undefined
  teacherId?: string | undefined
}
