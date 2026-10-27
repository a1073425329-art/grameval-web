/** 考试异常监控事件 */
export interface ExamMonitorEvent {
  id: number
  examId: number
  studentName?: string
  monitorType: string
  monitorTypeLabel?: string
  severity: 0 | 1 | 2 | 3
  severityLabel?: string
  eventTime: string
  durationSeconds?: number
  clientInfo?: string
  detail?: string
  handled: boolean
  handledBy?: number
  handledByName?: string
  handleTime?: string
  handleNote?: string
  createTime: string
}

export interface ExamMonitorReportForm {
  examId: number
  monitorType: string
  severity?: number
  durationSeconds?: number
  clientInfo?: string
  detail?: string
}
