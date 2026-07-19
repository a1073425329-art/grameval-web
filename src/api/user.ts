import request from '@/utils/request'
import type { ApiResponse, LoginForm, UserInfo } from '@/types/user'

export const login = (data: LoginForm) => {
  return request.post<ApiResponse<{ token: string }>>('/auth/login', data)
}

export const getUserInfo = () => {
  return request.get<ApiResponse<UserInfo>>('/auth/userinfo')
}