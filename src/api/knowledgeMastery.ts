import request from '@/utils/request'
import type { ApiResponse } from '@/types/common'
import type { KnowledgeMastery, KnowledgeInsights } from '@/types/knowledgeMastery'

export const getStudentMastery = (userId: number) =>
  request.get<ApiResponse<KnowledgeMastery[]>>(`/knowledge-mastery/student/${userId}`)

/**
 * 知识点学习画像（扩展统计）
 * 覆盖率 / 等级分布 / 熟练度分档 / 活跃度 / 薄弱 Top10 / 升级路径 / 近期vs历史 / 知识点×题型
 */
export const getStudentInsights = (userId: number) =>
  request.get<ApiResponse<KnowledgeInsights>>(`/knowledge-mastery/student/${userId}/insights`)

export const getMyWeakPoints = () =>
  request.get<ApiResponse<KnowledgeMastery[]>>('/knowledge-mastery/weak-points')

export const recordAnswer = (tagId: number, correct: boolean) =>
  request.post<ApiResponse<void>>('/knowledge-mastery/record', null, { params: { tagId, correct } })
