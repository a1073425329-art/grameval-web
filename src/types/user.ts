export interface LoginForm {
  username: string
  password: string
}

export interface UserInfo {
  id: number
  username: string
  nickname: string
  avatar?: string
  role: string
  email?: string
}

export interface ApiResponse<T = unknown> {
  code: number
  data: T
  message: string
}