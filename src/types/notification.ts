export interface Notification {
  id: number
  title: string
  content: string
  type: 'EXAM_PUBLISHED' | 'EXAM_REMIND' | 'SCORE_RELEASE' | 'SYSTEM'
  relatedId?: number
  isRead: boolean
  readTime?: string
  createTime: string
}

export const notificationTypeLabels: Record<string, string> = {
  EXAM_PUBLISHED: '考试发布',
  EXAM_REMIND: '考试提醒',
  SCORE_RELEASE: '成绩发布',
  SYSTEM: '系统通知',
}

export const notificationTypeColors: Record<string, string> = {
  EXAM_PUBLISHED: 'danger',
  EXAM_REMIND: 'warning',
  SCORE_RELEASE: 'success',
  SYSTEM: 'info',
}
