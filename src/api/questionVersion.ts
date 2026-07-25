import request from '@/utils/request'
import type { ApiResponse } from '@/types/common'
import type { QuestionVersion } from '@/types/questionVersion'

export const getQuestionVersions = (questionId: number) =>
  request.get<ApiResponse<QuestionVersion[]>>(`/question-versions/question/${questionId}`)

export const createQuestionVersion = (params: {
  questionId: number
  changes: string
  reason?: string
  snapshot?: string
}) => request.post<ApiResponse<QuestionVersion>>('/question-versions', null, { params })
