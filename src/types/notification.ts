export interface MessageNotification {
  id: number; userId: number
  title: string; content?: string; summary?: string
  type: string; typeLabel?: string; category: string; categoryLabel?: string
  priority: number; priorityLabel?: string; icon?: string; color?: string
  relatedId?: number; relatedType?: string
  senderName?: string
  isRead: boolean; readTime?: string
  isPinned: boolean; isStarred: boolean; isArchived: boolean; isDeleted: boolean
  isDismissed: boolean; isActedUpon: boolean
  actionUrl?: string; actionText?: string; actionType?: string
  secondaryActionUrl?: string; secondaryActionText?: string
  // [2026-10-28] 后端 message_notification.click_count 列已清除（通知点击计数功能砍掉），原同名字段删除
  deliveryChannels?: string; pushStatus?: string; emailStatus?: string
  expireTime?: string; isExpired?: boolean
  threadId?: number; threadDepth?: number
  reaction?: string; userRating?: number; userFeedback?: string
  createTime: string; updateTime?: string
}

export interface MessageQuery {
  pageNum?: number | undefined; pageSize?: number | undefined
  type?: string | undefined; category?: string | undefined; minPriority?: number | undefined
  unreadOnly?: boolean | undefined; starredOnly?: boolean | undefined; archivedOnly?: boolean | undefined
  keyword?: string | undefined; relatedType?: string | undefined; relatedId?: number | undefined
}

export interface NotificationPreference {
  id?: number; userId?: number
  notificationEnabled: boolean; quietHoursEnabled: boolean
  quietStartTime?: string; quietEndTime?: string
  inAppEnabled: boolean
  categorySettings?: string; typeSettings?: string
  soundEnabled: boolean; desktopNotificationEnabled: boolean
}

export type MessageCategory = 'INFO' | 'ALERT' | 'REMIND' | 'ACHIEVEMENT' | 'INTERACTION' | 'SYSTEM'

// ===== 全部 40 种消息类型定义 =====
export const ALL_MESSAGE_TYPES = [
  // 学生端20种
  { type: 'EXAM_PUBLISHED',      label: '考试发布',     category: 'INFO',         icon: 'Document',        color: '#409EFF', role: 'STUDENT' },
  { type: 'EXAM_START_SOON',     label: '即将开始',     category: 'REMIND',       icon: 'AlarmClock',      color: '#E6A23C', role: 'STUDENT' },
  { type: 'EXAM_DEADLINE_SOON',  label: '即将截止',     category: 'ALERT',        icon: 'Warning',         color: '#F56C6C', role: 'STUDENT' },
  { type: 'EXAM_TIME_UP',        label: '自动提交',     category: 'ALERT',        icon: 'Timer',           color: '#909399', role: 'STUDENT' },
  { type: 'EXAM_NOT_STARTED',    label: '尚未开始',     category: 'REMIND',       icon: 'Calendar',        color: '#67C23A', role: 'STUDENT' },
  { type: 'EXAM_REVIEW_READY',   label: '解析可看',     category: 'INFO',         icon: 'Reading',         color: '#409EFF', role: 'STUDENT' },
  { type: 'SCORE_RELEASED',      label: '成绩发布',     category: 'INFO',         icon: 'Trophy',          color: '#409EFF', role: 'STUDENT' },
  { type: 'SCORE_IMPROVED',      label: '成绩进步',     category: 'ACHIEVEMENT',  icon: 'TrendCharts',     color: '#67C23A', role: 'STUDENT' },
  { type: 'SCORE_DECLINED',      label: '成绩退步',     category: 'ALERT',        icon: 'TrendCharts',     color: '#F56C6C', role: 'STUDENT' },
  { type: 'SCORE_RANK_TOP',      label: '名列前茅',     category: 'ACHIEVEMENT',  icon: 'Medal',           color: '#FFD700', role: 'STUDENT' },
  { type: 'TEACHER_COMMENT',     label: '老师评语',     category: 'INTERACTION',  icon: 'ChatDotRound',    color: '#9C27B0', role: 'STUDENT' },
  { type: 'TEACHER_REPLY',       label: '老师回复',     category: 'INTERACTION',  icon: 'ChatLineRound',   color: '#9C27B0', role: 'STUDENT' },
  { type: 'TARGET_ASSIGNED',     label: '学习目标',     category: 'INFO',         icon: 'Aim',             color: '#409EFF', role: 'STUDENT' },
  { type: 'TARGET_ACHIEVED',     label: '目标达成',     category: 'ACHIEVEMENT',  icon: 'TrophyBase',      color: '#FFD700', role: 'STUDENT' },
  { type: 'WRONG_QUESTION_DUE',  label: '错题复习',     category: 'REMIND',       icon: 'Notebook',        color: '#E6A23C', role: 'STUDENT' },
  { type: 'KNOWLEDGE_WEAK',      label: '薄弱提醒',     category: 'ALERT',        icon: 'WarningFilled',   color: '#F56C6C', role: 'STUDENT' },
  { type: 'PRACTICE_RECOMMEND',  label: '练习推荐',     category: 'INFO',         icon: 'MagicStick',      color: '#67C23A', role: 'STUDENT' },
  { type: 'STUDY_STREAK',        label: '学习打卡',     category: 'ACHIEVEMENT',  icon: 'Clock',           color: '#67C23A', role: 'STUDENT' },
  { type: 'WEEKLY_REPORT',       label: '每周报告',     category: 'INFO',         icon: 'DataAnalysis',    color: '#409EFF', role: 'STUDENT' },
  { type: 'SYSTEM_NOTICE',       label: '系统通知',     category: 'SYSTEM',       icon: 'Notification',    color: '#909399', role: 'STUDENT' },
  // 老师端20种
  { type: 'STUDENT_NEW_RESULT',  label: '新答卷',       category: 'INFO',         icon: 'DocumentChecked', color: '#409EFF', role: 'ADMIN' },
  { type: 'STUDENT_NOT_STARTED', label: '未开始考试',   category: 'ALERT',        icon: 'UserFilled',      color: '#E6A23C', role: 'ADMIN' },
  { type: 'EXAM_ALL_SUBMITTED',  label: '全员提交',     category: 'INFO',         icon: 'Select',          color: '#67C23A', role: 'ADMIN' },
  { type: 'EXAM_DEADLINE_NEAR',  label: '截止临近',     category: 'REMIND',       icon: 'AlarmClock',      color: '#E6A23C', role: 'ADMIN' },
  { type: 'STUDENT_ABNORMAL',    label: '异常行为',     category: 'ALERT',        icon: 'WarningFilled',   color: '#E6A23C', role: 'ADMIN' },
  { type: 'STUDENT_CHEAT_SUSPECT', label: '作弊嫌疑',   category: 'ALERT',        icon: 'WarningFilled',   color: '#F56C6C', role: 'ADMIN' },
  { type: 'CLASS_AVERAGE_LOW',   label: '均分偏低',     category: 'ALERT',        icon: 'TrendCharts',     color: '#E6A23C', role: 'ADMIN' },
  { type: 'CLASS_AVERAGE_HIGH',  label: '均分优秀',     category: 'ACHIEVEMENT',  icon: 'TrendCharts',     color: '#67C23A', role: 'ADMIN' },
  { type: 'STUDENT_PROGRESS',    label: '学生进步',     category: 'ACHIEVEMENT',  icon: 'TrendCharts',     color: '#67C23A', role: 'ADMIN' },
  { type: 'STUDENT_DECLINE',     label: '学生退步',     category: 'ALERT',        icon: 'TrendCharts',     color: '#F56C6C', role: 'ADMIN' },
  { type: 'STUDENT_INACTIVE',    label: '学生不活跃',   category: 'REMIND',       icon: 'Moon',            color: '#909399', role: 'ADMIN' },
  { type: 'QUESTION_REPORTED',   label: '题目反馈',     category: 'ALERT',        icon: 'QuestionFilled',  color: '#E6A23C', role: 'ADMIN' },
  { type: 'PAPER_READY',         label: '试卷就绪',     category: 'INFO',         icon: 'Files',           color: '#409EFF', role: 'ADMIN' },
  { type: 'SESSION_ENDING',      label: '场次将结束',   category: 'REMIND',       icon: 'Clock',           color: '#E6A23C', role: 'ADMIN' },
  { type: 'NEW_STUDENT_JOINED',  label: '新学生加入',   category: 'INFO',         icon: 'UserFilled',      color: '#67C23A', role: 'ADMIN' },
  { type: 'WEEKLY_TEACHING_REPORT', label: '教学周报',  category: 'INFO',         icon: 'DataAnalysis',    color: '#409EFF', role: 'ADMIN' },
  { type: 'BATCH_GRADING_DONE',  label: '阅卷完成',     category: 'INFO',         icon: 'Select',          color: '#67C23A', role: 'ADMIN' },
  { type: 'SCHEDULE_REMIND',     label: '训练提醒',     category: 'REMIND',       icon: 'Calendar',        color: '#E6A23C', role: 'ADMIN' },
  { type: 'SYSTEM_MAINTENANCE',  label: '系统维护',     category: 'SYSTEM',       icon: 'Setting',         color: '#F56C6C', role: 'ADMIN' },
  { type: 'ADMIN_BROADCAST',     label: '平台广播',     category: 'SYSTEM',       icon: 'Notification',    color: '#409EFF', role: 'ADMIN' },
] as const

export const CATEGORY_OPTIONS: { value: string; label: string; color: string; icon: string }[] = [
  { value: 'INFO', label: '信息', color: '#409EFF', icon: 'InfoFilled' },
  { value: 'ALERT', label: '告警', color: '#F56C6C', icon: 'WarningFilled' },
  { value: 'REMIND', label: '提醒', color: '#E6A23C', icon: 'AlarmClock' },
  { value: 'ACHIEVEMENT', label: '成就', color: '#67C23A', icon: 'Trophy' },
  { value: 'INTERACTION', label: '互动', color: '#9C27B0', icon: 'ChatDotRound' },
  { value: 'SYSTEM', label: '系统', color: '#909399', icon: 'Setting' },
]

// Backward compat
export type Notification = MessageNotification
export const notificationTypeLabels: Record<string, string> = {}
export const notificationTypeColors: Record<string, string> = {}
export const STUDENT_MESSAGE_TYPES = ALL_MESSAGE_TYPES.filter(t => t.role === 'STUDENT')
export const TEACHER_MESSAGE_TYPES = ALL_MESSAGE_TYPES.filter(t => t.role === 'ADMIN')

export interface UnreadCount { total: number; urgent: number }
export interface UnreadCountByCategory { INFO: number; ALERT: number; REMIND: number; ACHIEVEMENT: number; INTERACTION: number; SYSTEM: number }
