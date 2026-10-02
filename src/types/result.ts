import type { QuestionType, Difficulty } from './common'
import type { AnswerDetail } from './exam'

/** 学生成绩汇总 —— StudentScoreSummaryVO */
export interface ResultSummary {
  totalCount: number
  averageScore: number
  highestScore: number
  lowestScore: number
  totalAccuracy: number
}

/**
 * 成绩列表项 —— ScoreVO
 * 后端字段：
 *   totalScore（实际得分，不是试卷满分！）
 *   scorePercentage（百分制归一化）
 *   paperTotalScore（试卷满分）
 */
export interface ExamResultItem {
  id: number
  examId: number
  userId?: number
  username?: string
  realName?: string
  englishName?: string
  avatar?: string
  sessionId?: number
  sessionName?: string
  paperId?: number
  paperName?: string
  totalScore: number
  paperTotalScore?: number
  scorePercentage?: number
  passScore?: number
  passed?: boolean
  correctCount?: number
  wrongCount?: number
  createTime?: string
  submitTime?: string
  durationSeconds?: number
  correctRate?: number
  classRank?: number
  totalCount?: number
}

/** 成绩明细（GET /results/{resultId}/detail）—— ExamRecordVO */
export interface ResultDetail {
  id: number
  sessionId: number
  sessionName?: string
  paperId?: number
  paperName?: string
  userId?: number
  realName?: string
  username?: string
  startTime?: string
  submitTime?: string
  durationSeconds?: number
  submitStatus?: 0 | 1 | 2
  totalScore: number
  scorePercentage?: number
  paperTotalScore?: number
  correctCount: number
  wrongCount: number
  answers: AnswerDetail[]
}

/**
 * 错题本条目 —— GET /results/wrong-book
 */
export interface WrongBookItem {
  questionId: number
  /** EXAM / PRACTICE */
  source: 'EXAM' | 'PRACTICE'
  sourceName?: string
  categoryId?: number
  categoryName: string
  questionType: QuestionType
  difficulty: Difficulty
  stem: string
  userAnswer?: string
  standardAnswer: string
  analysis?: string
  firstWrongTime: string
  options?: Array<{
    optionLabel: string
    optionContent: string
    sortNo: number
  }>
  /** 阅读理解：复盘时必须能看到当时的文章 */
  passageId?: number
  passageTitle?: string
  passageContent?: string
  passageWordCount?: number
}

/** 错题本查询参数（请求 DTO, 可选字段放宽 undefined, 见 src/api/admin.ts 顶部说明） */
export interface WrongBookQuery {
  source?: 'ALL' | 'EXAM' | 'PRACTICE' | undefined
  categoryId?: number | undefined
  questionType?: QuestionType | undefined
  difficulty?: Difficulty | undefined
  pageNum?: number | undefined
  pageSize?: number | undefined
}
