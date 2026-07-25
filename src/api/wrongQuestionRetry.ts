import request from '@/utils/request'
import type { ApiResponse } from '@/types/common'
import type { WrongQuestionRetry, WrongQuestionRetryForm } from '@/types/wrongQuestionRetry'

export const getRetryHistory = (wrongBookId: number) =>
  request.get<ApiResponse<WrongQuestionRetry[]>>(`/wrong-question-retry/${wrongBookId}`)

export const submitRetry = (data: WrongQuestionRetryForm) =>
  request.post<ApiResponse<WrongQuestionRetry>>('/wrong-question-retry', data)

export const getRetryStats = (wrongBookId: number) =>
  request.get<ApiResponse<{ totalRetries: number; correctRetries: number }>>(`/wrong-question-retry/${wrongBookId}/stats`)
