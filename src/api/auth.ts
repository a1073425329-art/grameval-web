import request from '@/utils/request'
import type { ApiResponse } from '@/types/common'
import type {
  LoginForm,
  RegisterForm,
  LoginResult,
  UserDetail,
} from '@/types/user'

/** 登录 —— POST /api/auth/login */
export const login = (data: LoginForm) =>
  request.post<ApiResponse<LoginResult>>('/auth/login', data)

/** 注册 —— POST /api/auth/register */
export const register = (data: RegisterForm) =>
  request.post<ApiResponse<UserDetail>>('/auth/register', data)

/** 健康检查 */
export const health = () =>
  request.get<ApiResponse<string>>('/auth/health')

/** 当前登录用户完整信息 —— GET /api/auth/me */
export const getMe = () =>
  request.get<ApiResponse<UserDetail>>('/auth/me')

/** 刷新 Token —— POST /api/auth/refresh */
export const refreshToken = () =>
  request.post<ApiResponse<LoginResult>>('/auth/refresh')

/** 退出登录（后端无状态，前端删本地 Token 即可，此接口仅记录日志） */
export const logout = () =>
  request.post<ApiResponse<void>>('/auth/logout')
