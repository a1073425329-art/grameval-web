import request from '@/utils/request'
import type { ApiResponse } from '@/types/common'
import type { ExamComment, ExamCommentForm } from '@/types/examComment'

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
