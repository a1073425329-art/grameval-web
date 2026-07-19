/**
 * 管理端专用类型 —— 对齐后端 /api/admin/* 系列接口
 */

/**
 * 管理端专用类型 —— 对齐后端 /api/admin/* 系列接口
 */

/** Dashboard 数据 —— AdminDashboardVO（强化版） */
export interface AdminDashboardData {
  // 统计卡片
  studentCount: number
  adminCount: number
  questionCount: number
  categoryCount?: number
  paperCount: number
  sessionCount: number
  examRecordCount: number
  practiceCount: number

  // 今日指标
  todayActiveStudents?: number
  todayExamSubmissions?: number
  overallAccuracy?: number

  /** 近 7 日考试提交趋势 */
  recentTrend: Array<{ date: string; count: number }>

  /** 近 7 日平均分趋势 */
  avgScoreTrend?: Array<{ date: string; avgScore: number }>

  /** 难度分布 */
  difficultyDistribution?: {
    easyCount: number
    mediumCount: number
    hardCount: number
  }

  /** 各语法分类题目数量 */
  categoryDistribution?: Array<{
    categoryId: number
    categoryName: string
    questionCount: number
  }>

  /** 错题最多的语法分类 Top N */
  topWrongCategories?: Array<{
    categoryId: number
    categoryName: string
    wrongCount: number
    errorRate: number
  }>

  /** 最近 5 场考试概况 */
  recentSessions?: Array<{
    sessionId: number
    sessionName: string
    status: number        // 0草稿 1已发布 2已结束
    attendedCount: number
    avgScore: number
    passRate: number
  }>

  /** 优等生 Top 5（按平均分） */
  topStudents?: Array<{
    userId: number
    realName: string
    examCount: number
    avgScore: number
    accuracy: number
  }>
}

/** 考试实时监控（考生逐条状态） */
export interface ExamMonitor {
  sessionName: string
  paperName: string
  assignedCount: number
  attendedCount: number
  submittedCount: number
  ongoingCount: number
  examinees: ExamineeStatus[]
}

export interface ExamineeStatus {
  examId?: number
  userId: number
  username: string
  realName?: string
  submitStatus?: 0 | 1 | 2
  submitStatusText?: string
  startTime?: string
  submitTime?: string
  totalScore?: number
  scorePercentage?: number
  correctCount?: number
  wrongCount?: number
}

/** 场次统计 —— SessionStatisticsVO */
export interface SessionStatistics {
  sessionName: string
  paperName: string
  paperTotalScore: number
  paperPassScore?: number
  scoredCount: number
  averageScore: number
  highestScore: number
  lowestScore: number
  passCount: number
  passRate: number
  overallAccuracy: number
  distribution: Array<{ range: string; count: number }>
}

/** 题目质量分析 —— QuestionAnalyticsVO */
export interface QuestionAnalytics {
  /** 逐题正确率 */
  questions: QuestionAnalyticsRow[]
  /** 分类聚合 */
  byCategory: Array<{
    categoryId: number
    categoryName: string
    total: number
    correct: number
    wrong: number
    accuracy: number
  }>
  /** 难度聚合 */
  byDifficulty: Array<{
    difficulty: 1 | 2 | 3
    total: number
    correct: number
    wrong: number
    accuracy: number
  }>
}

export interface QuestionAnalyticsRow {
  questionId: number
  stem: string
  categoryName?: string
  questionType: string
  difficulty: 1 | 2 | 3
  totalCount: number
  correctCount: number
  wrongCount: number
  accuracy: number
}

/** 操作日志 */
export interface OperationLog {
  id: number
  userId: number
  username: string
  operationType: string
  targetType?: string
  targetId?: number
  detail?: string
  requestUri?: string
  clientIp?: string
  userAgent?: string
  resultCode?: string
  createTime: string
}

/** 我的学生（管理员绑定学生） */
export interface AdminStudent {
  id: number
  adminId: number
  studentId: number
  student: {
    id: number
    username: string
    realName?: string
    email?: string
    phone?: string
    avatar?: string
  }
  createdAt: string
  remark?: string
}
