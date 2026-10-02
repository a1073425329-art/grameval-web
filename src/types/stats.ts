/**
 * 学生个人多维度统计 + 单场考试维度分析类型。
 * 对齐后端 StudentStatisticsVO 和 DimensionAnalysisVO。
 */

/* ============================================================ *
 *  StudentStatisticsVO（学生个人多维度统计）
 * ============================================================ */

export interface StudentStatistics {
  // basic 基本信息
  userId: number
  username: string
  realName?: string
  avatar?: string
  gender?: number
  email?: string
  phone?: string
  idCard?: string
  status?: number
  lastLoginTime?: string
  lastLoginIp?: string
  createTime?: string

  // exam 考试统计
  examCount?: number
  examCorrectCount?: number
  examWrongCount?: number
  examAverageScore?: number
  examHighestScore?: number
  examLowestScore?: number
  examAccuracy?: number

  // practice 练习统计
  practiceCount?: number
  practiceQuestionCount?: number
  practiceCorrectCount?: number
  practiceWrongCount?: number
  practiceAccuracy?: number

  // wrong 错题统计
  distinctWrongCount?: number

  // category 按语法大类分布
  categoryStats?: CategoryStat[]

  // difficulty 按难度分布
  difficultyStats?: DifficultyStat[]

  // tag 按考点标签错题分布（Top 20 最薄弱考点）
  tagStats?: TagStat[]

  // training 训练时间设置
  trainingSchedule?: TrainingSchedule
  trainedDays?: number
  daysRemaining?: number
}

export interface CategoryStat {
  categoryId: number
  categoryName: string
  total: number
  correct: number
  wrong: number
  accuracy: number
}

export interface DifficultyStat {
  difficulty: number
  difficultyLabel: string
  total: number
  correct: number
  wrong: number
  accuracy: number
}

export interface TagStat {
  tagId: number
  tagName: string
  total: number
  wrong: number
  /** 错误率 0-100 */
  errorRate: number
}

/** 训练时间设置（对齐后端 TrainingScheduleVO / TrainingScheduleRequest）
 * 同时用作请求与响应: 可选字段放宽 undefined 以便直接回填表单后提交,
 * 读取侧仍得到 `T | undefined`, 需显式收窄。 */
export interface TrainingSchedule {
  /** 训练计划开始日期，如 "2026-01-01" */
  trainingStartDate?: string | undefined
  /** 实际训练开始日期（老师/学生可手动改，如学生只能周末训练则改为最近周六） */
  actualStartDate?: string | undefined
  /** 训练计划结束日期 */
  trainingEndDate?: string | undefined
  /** 可训练星期（1-7 逗号分隔，如 "6,7" 表示仅周末可训练）*/
  trainingDays?: string | undefined
  /** 可训练星期中文名列表（后端直接返回，前端用来展示） */
  trainingDayNames?: string[] | undefined
  /** 每日训练时段-起 HH:mm */
  trainingTimeFrom?: string | undefined
  /** 每日训练时段-止 HH:mm */
  trainingTimeTo?: string | undefined
  /** 训练目标总时长（小时数） */
  trainingTargetHours?: number | undefined
  /** 训练备注 */
  trainingNotes?: string | undefined
}

/* ============================================================ *
 *  DimensionAnalysisVO（单场考试多维度分析）
 * ============================================================ */

export interface DimensionAnalysis {
  examId: number
  userId: number
  username?: string
  realName?: string
  paperName?: string
  scorePercentage?: number
  correctCount: number
  wrongCount: number

  /** 按考点标签对错 */
  byTag: TagDimension[]
  /** 按语法大类对错 */
  byCategory: CategoryDimension[]
  /** 按难度对错 */
  byDifficulty: DifficultyDimension[]
  /** 按题型对错 */
  byQuestionType: QuestionTypeDimension[]
  /** 按阅读子题型对错（细节/主旨/推断/词义/态度），按正确率升序 */
  bySubtype?: SubtypeDimension[] | undefined
}

export interface SubtypeDimension {
  subtype: string
  subtypeLabel: string
  total: number
  correct: number
  wrong: number
  accuracy: number
}

export interface TagDimension {
  tagId: number
  tagName: string
  total: number
  correct: number
  wrong: number
  accuracy: number
}

export interface CategoryDimension {
  categoryId: number
  categoryName: string
  total: number
  correct: number
  wrong: number
  accuracy: number
}

export interface DifficultyDimension {
  difficulty: number
  difficultyLabel: string
  total: number
  correct: number
  wrong: number
  accuracy: number
}

export interface QuestionTypeDimension {
  questionType: string
  questionTypeLabel: string
  total: number
  correct: number
  wrong: number
  accuracy: number
}
