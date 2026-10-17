import request from '@/utils/request'
import type { ApiResponse, PageQuery, PageResult } from '@/types/common'
import type { ExamMonitorEvent, ExamMonitorReportForm } from '@/types/monitor'

/* ===== 异常监控 ===== */

export const reportMonitorEvent = (data: ExamMonitorReportForm) =>
  request.post<ApiResponse<void>>('/monitor/report', data)

export const listMonitorEvents = (params: { examId?: number | undefined; severity?: number | undefined; handled?: boolean | undefined } & PageQuery) =>
  request.get<ApiResponse<PageResult<ExamMonitorEvent>>>('/monitor/events', { params })

export const getExamMonitorEvents = (examId: number) =>
  request.get<ApiResponse<ExamMonitorEvent[]>>(`/monitor/events/${examId}`)

export const getMonitorStats = (examId: number) =>
  request.get<ApiResponse<Record<string, number>>>(`/monitor/events/${examId}/stats`)

export const getGlobalMonitorStats = () =>
  request.get<ApiResponse<Record<string, number>>>('/monitor/events/stats')

export const handleMonitorEvent = (id: number, note?: string) =>
  request.put<ApiResponse<void>>(`/monitor/events/${id}/handle`, null, { params: { note } })
