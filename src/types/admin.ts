/**
 * 管理端专用类型 —— 对齐后端 /api/admin/* 系列接口
 */

/**
 * 管理端专用类型 —— 对齐后端 /api/admin/* 系列接口
 */

/** Dashboard 数据 —— AdminDashboardVO（强化版） */
export interface AdminDashboardData {
  // 统计卡片 - 基础
  studentCount: number
  adminCount: number
  questionCount: number
  categoryCount?: number
  paperCount: number
  sessionCount: number
  examRecordCount: number
  practiceCount: number

  // 统计卡片 - 今日指标
  todayActiveStudents?: number
  todayExamSubmissions?: number
  overallAccuracy?: number
  averageScore?: number
  passRate?: number
  passageCount?: number
  totalWrongQuestions?: number

  /** 近 7 日考试提交趋势 */
  recentTrend: Array<{ date: string; count: number }>

  /** 近 7 日平均分趋势 */
  avgScoreTrend?: Array<{ date: string; avgScore: number }>

  /** 近 7 日活跃度趋势 */
  activityTrend?: Array<{ date: string; count: number }>

  /** 难度分布 */
  difficultyDistribution?: {
    easyCount: number
    mediumCount: number
    hardCount: number
  }

  /** 分数段分布 */
  scoreDistribution?: Array<{
    range: string
    count: number
    percentage: number
  }>

  /** 各语法分类题目数量 */
  categoryDistribution?: Array<{
    categoryId: number
    categoryName: string
    questionCount: number
    accuracy: number
  }>

  /** 各题型数量分布 */
  questionTypeDistribution?: Array<{
    questionType: string
    questionTypeName: string
    count: number
  }>

  /** 错题最多的语法分类 Top N */
  topWrongCategories?: Array<{
    categoryId: number
    categoryName: string
    wrongCount: number
    errorRate: number
  }>

  /** 错题最多的题目 Top N */
  topWrongQuestions?: Array<{
    questionId: number
    stem: string
    wrongCount: number
    errorRate: number
  }>

  /** 错题掌握情况统计 */
  wrongMasteryStat?: {
    notReviewed: number
    pendingReview: number
    reviewed: number
    mastered: number
  }

  /** 优等生 Top 5（按平均分） */
  topStudents?: Array<{
    userId: number
    realName: string
    englishName?: string
    examCount: number
    avgScore: number
    accuracy: number
    wrongCount: number
  }>

  /** 待进步学生 Top 5（按平均分） */
  bottomStudents?: Array<{
    userId: number
    realName: string
    englishName?: string
    examCount: number
    avgScore: number
    accuracy: number
    wrongCount: number
  }>

  /** 各语法分类学习进度概览 */
  learningProgressOverview?: Array<{
    categoryId: number
    categoryName: string
    totalCount: number
    completedCount: number
    correctCount: number
    masteryRate: number
  }>

  /** 最近 5 场考试概况 */
  recentSessions?: Array<{
    sessionId: number
    sessionName: string
    status: number        // 0草稿 1已发布 2已结束
    attendedCount: number
    avgScore: number
    passRate: number
    examDate?: string
  }>

  /** 最近提交的考试记录 */
  recentExams?: Array<{
    examId: number
    studentName: string
    sessionName: string
    score: number
    accuracy: number
    submitTime: string
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

/** 聚合行（分类/题型/子题型共用结构） */
export interface AnalyticsAggRow {
  questionCount: number
  totalAttempts: number
  totalCorrect: number
  accuracy: number
}

/** 题目质量分析 —— QuestionAnalyticsVO（字段与后端 VO 对齐） */
export interface QuestionAnalytics {
  /** 逐题正确率 */
  questions: QuestionAnalyticsRow[]
  /** 分类聚合 */
  categoryStats: Array<AnalyticsAggRow & { categoryId: number; categoryName: string }>
  /** 难度聚合 */
  difficultyStats: Array<AnalyticsAggRow & { difficulty: 1 | 2 | 3; label: string }>
  /** 总体 KPI */
  kpi?: {
    totalQuestions: number
    attemptedQuestions: number
    neverAttempted: number
    totalAttempts: number
    totalCorrect: number
    overallAccuracy: number
    categoryCount: number
    typeCount: number
  }
  /** 题型聚合 */
  typeStats?: Array<AnalyticsAggRow & { questionType: string; label: string }>
  /** 阅读子题型聚合 */
  subtypeStats?: Array<AnalyticsAggRow & { subtype: string; label: string }>
  /** 正确率区间分布 */
  accuracyBuckets?: Array<{ label: string; count: number }>
}

export interface QuestionAnalyticsRow {
  questionId: number
  stemPreview: string
  categoryId?: number
  categoryName?: string
  questionType: string
  difficulty: 1 | 2 | 3
  attemptCount: number
  correctCount: number
  accuracy: number
  usageCount?: number
}

/** 操作日志 */
export interface OperationLog {
  id: number
  userId: number
  realName?: string
  englishName?: string
  username: string
  userRole?: string
  httpMethod?: string
  operationType: string
  targetType?: string
  targetId?: number
  detail?: string
  requestUri?: string
  requestParams?: string
  requestBody?: string
  responseBody?: string
  clientIp?: string
  userAgent?: string
  referer?: string
  resultCode?: string
  errorMessage?: string
  errorStackTrace?: string
  traceId?: string
  threadName?: string
  durationMs?: number
  memoryUsedBytes?: number
  createTime: string
}
