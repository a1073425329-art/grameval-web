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
  screenshotPath?: string
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

/** 学生行为日志 */
export interface BehaviorLog {
  id: number
  examId: number
  questionId?: number
  behaviorType: string
  behaviorData?: string
  behaviorTime: string
  pageX?: number
  pageY?: number
  viewportWidth?: number
  viewportHeight?: number
  scrollPosition?: number
  durationMs?: number
  clientIp?: string
}

export interface BehaviorLogReportForm {
  examId: number
  questionId?: number
  behaviorType: string
  behaviorData?: string
  pageX?: number
  pageY?: number
  viewportWidth?: number
  viewportHeight?: number
  scrollPosition?: number
  durationMs?: number
}
