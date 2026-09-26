import request from '@/utils/request'
import type { ApiResponse, PageQuery, PageResult } from '@/types/common'
import type { ExamComment, ExamCommentForm } from '@/types/examComment'

/* 请求 DTO, 可选字段放宽 undefined, 见 src/api/admin.ts 顶部说明 */
export interface ExamCommentQuery extends PageQuery {
  commentType?: string | undefined
  isRead?: boolean | undefined
  teacherId?: number | undefined
  examId?: number | undefined
}

export const pageExamComments = (params: ExamCommentQuery) =>
  request.get<ApiResponse<PageResult<ExamComment>>>('/exam-comments', { params })

export const getExamCommentStats = () =>
  request.get<ApiResponse<Record<string, number>>>('/exam-comments/stats')

export const getExamComments = (examId: number) =>
  request.get<ApiResponse<ExamComment[]>>(`/exam-comments/exam/${examId}`)

export const createExamComment = (data: ExamCommentForm) =>
  request.post<ApiResponse<ExamComment>>('/exam-comments', data)

export const updateExamComment = (id: number, data: ExamCommentForm) =>
  request.put<ApiResponse<ExamComment>>(`/exam-comments/${id}`, data)

export const deleteExamComment = (id: number) =>
  request.delete<ApiResponse<void>>(`/exam-comments/${id}`)

export const markCommentRead = (id: number) =>
  request.put<ApiResponse<void>>(`/exam-comments/${id}/read`)

export const getUnreadCommentCount = (examId: number) =>
  request.get<ApiResponse<number>>(`/exam-comments/exam/${examId}/unread-count`)
