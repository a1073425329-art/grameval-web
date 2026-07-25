import request from '@/utils/request'
import type { ApiResponse } from '@/types/common'
import type { AnswerCard, AnswerCardForm } from '@/types/answerCard'

export const listAnswerCards = (paperId?: number) =>
  request.get<ApiResponse<AnswerCard[]>>('/answer-cards', { params: { paperId } })

export const getDefaultAnswerCard = () =>
  request.get<ApiResponse<AnswerCard>>('/answer-cards/default')

export const createAnswerCard = (data: AnswerCardForm) =>
  request.post<ApiResponse<AnswerCard>>('/answer-cards', data)

export const updateAnswerCard = (id: number, data: AnswerCardForm) =>
  request.put<ApiResponse<AnswerCard>>(`/answer-cards/${id}`, data)

export const deleteAnswerCard = (id: number) =>
  request.delete<ApiResponse<void>>(`/answer-cards/${id}`)
