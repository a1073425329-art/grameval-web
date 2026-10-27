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
