import request from '@/utils/request'
import type { ApiResponse } from '@/types/common'
import type {
  UserDetail,
  UserUpdateForm,
  PasswordChangeForm,
} from '@/types/user'

/** 获取当前用户完整资料 —— GET /users/me */
export const getMyProfile = () =>
  request.get<ApiResponse<UserDetail>>('/users/me')

/** 修改当前用户资料 —— PUT /users/me */
export const updateMyProfile = (data: UserUpdateForm) =>
  request.put<ApiResponse<UserDetail>>('/users/me', data)

/** 用户修改自己的密码 —— PUT /users/{id}/password */
export const changeMyPassword = (id: number, data: PasswordChangeForm) =>
  request.put<ApiResponse<void>>(`/users/${id}/password`, data)

/** 查询用户详情（管理员或本人）—— GET /users/{id} */
export const getUserDetail = (id: number) =>
  request.get<ApiResponse<UserDetail>>(`/users/${id}`)
