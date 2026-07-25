import request from '@/utils/request'
import type { ApiResponse } from '@/types/common'
import type { KnowledgeMastery } from '@/types/knowledgeMastery'

export const getStudentMastery = (userId: number) =>
  request.get<ApiResponse<KnowledgeMastery[]>>(`/knowledge-mastery/student/${userId}`)

export const getMyWeakPoints = () =>
  request.get<ApiResponse<KnowledgeMastery[]>>('/knowledge-mastery/weak-points')

export const recordAnswer = (tagId: number, correct: boolean) =>
  request.post<ApiResponse<void>>('/knowledge-mastery/record', null, { params: { tagId, correct } })
