import type { ApiResponse } from '@/types/common'
import request from '@/utils/request'

export interface QuestionTag {
  id: number
  tagName: string
  categoryId: number
  description?: string
  sortNo?: number
  status: 0 | 1
  createTime?: string
}

export interface QuestionTagForm {
  tagName: string
  categoryId: number
  description?: string
  sortNo?: number
  status?: 0 | 1
}

/** 查询考点标签列表 */
export const listQuestionTags = (categoryId?: number, status = 1) =>
  request.get<ApiResponse<QuestionTag[]>>('/tags/questions', { params: { categoryId, status } })

/** 创建考点标签（管理员） */
export const createQuestionTag = (data: QuestionTagForm) =>
  request.post<ApiResponse<QuestionTag>>('/tags/questions', data)

/** 更新考点标签（管理员） */
export const updateQuestionTag = (id: number, data: QuestionTagForm) =>
  request.put<ApiResponse<QuestionTag>>(`/tags/questions/${id}`, data)

/** 删除考点标签（管理员） */
export const deleteQuestionTag = (id: number) =>
  request.delete<ApiResponse<void>>(`/tags/questions/${id}`)
