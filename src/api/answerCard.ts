import request from '@/utils/request'
import type { ApiResponse, PageQuery, PageResult } from '@/types/common'
import type { AnswerCard, AnswerCardForm } from '@/types/answerCard'

export interface AnswerCardPageQuery extends PageQuery {
  paperId?: number
  cardName?: string
  isDefault?: boolean
}

export const listAnswerCards = (paperId?: number) =>
  request.get<ApiResponse<AnswerCard[]>>('/answer-cards', { params: { paperId } })

export const pageAnswerCards = (params: AnswerCardPageQuery) =>
  request.get<ApiResponse<PageResult<AnswerCard>>>('/answer-cards/page', { params })

export const getAnswerCardStats = () =>
  request.get<ApiResponse<Record<string, number>>>('/answer-cards/stats')

export const getDefaultAnswerCard = () =>
  request.get<ApiResponse<AnswerCard>>('/answer-cards/default')

export const createAnswerCard = (data: AnswerCardForm) =>
  request.post<ApiResponse<AnswerCard>>('/answer-cards', data)

export const updateAnswerCard = (id: number, data: AnswerCardForm) =>
  request.put<ApiResponse<AnswerCard>>(`/answer-cards/${id}`, data)

export const deleteAnswerCard = (id: number) =>
  request.delete<ApiResponse<void>>(`/answer-cards/${id}`)
