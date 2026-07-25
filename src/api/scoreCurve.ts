import request from '@/utils/request'
import type { ApiResponse } from '@/types/common'
import type { ScoreCurve } from '@/types/scoreCurve'

export interface ScoreCurveQuery {
  startDate?: string
  endDate?: string
}

export const getStudentScoreTrend = (userId: number, params?: ScoreCurveQuery) =>
  request.get<ApiResponse<ScoreCurve[]>>(`/score-curve/student/${userId}`, { params })

export const getMyScoreTrend = (params?: ScoreCurveQuery) =>
  request.get<ApiResponse<ScoreCurve[]>>('/score-curve/my', { params })
