import type { QuestionType, Difficulty } from './common'

export interface QuestionOptionVO {
  optionLabel: string
  optionContent: string
}

/**
 * 试卷试题关联 —— 对齐后端 PaperQuestionVO
 */
export interface PaperSubQuestionVO {
  questionId: number
  stem: string
  questionType: QuestionType
  difficulty: Difficulty
  questionScore: number
  questionOrder: number
  standardAnswer?: string
  analysis?: string
  options?: QuestionOptionVO[]
  categoryName?: string
  tagNames?: string[]
  /** 审核标签（0待审/1通过/2未通过），仅展示，不参与流程约束 */
  auditStatus?: number | null | undefined
}

export interface PaperQuestionVO {
  unitType: 'QUESTION' | 'READING'
  questionId?: number
  stem: string
  questionType: QuestionType
  difficulty?: Difficulty
  questionScore: number
  questionOrder: number
  standardAnswer?: string
  analysis?: string
  options?: QuestionOptionVO[]
  categoryName?: string
  tagNames?: string[]
  passageId?: number
  passageTitle?: string
  passageContent?: string
  passageWordCount?: number
  subQuestions?: PaperSubQuestionVO[]
  /** 审核标签（0待审/1通过/2未通过），仅展示，不参与流程约束 */
  auditStatus?: number | null | undefined
}

/** 试卷 —— 对齐后端 PaperVO */
export interface Paper {
  id: number
  paperName: string
  description?: string
  /** 试卷总分（自动求和） */
  totalScore: number
  passScore?: number
  questionCount: number
  /** 0草稿 / 1启用 / 2停用 */
  status: 0 | 1 | 2
  createBy?: number
  createTime?: string
  updateTime?: string
  questions?: PaperQuestionVO[]
  /** 归档状态：0未归档，1已归档 */
  archiveStatus?: number

  // ===== 多表与算法动态派生统计（零库表字段） =====
  avgDifficulty?: number
  difficultyLevel?: string
  categoryCount?: number
  categoryNames?: string[]
  suggestedDuration?: number
  typeCounts?: Record<string, number>
  typeScores?: Record<string, number>
  sessionCount?: number
  totalExamined?: number
  averageScore?: number
  highestScore?: number
  lowestScore?: number
  passRate?: number
}

/** 试卷大盘多维汇总统计 */
export interface PaperSummaryStats {
  totalPapers: number
  publishedPapers: number
  draftPapers: number
  disabledPapers: number
  referencedPapers: number
  referenceRate: number
  totalQuestionsInPapers: number
  avgPaperScore: number
  totalExaminees: number
  overallAvgScore: number
  overallPassRate: number
}

/** 试卷创建/更新请求 —— 对齐后端 PaperRequest */
export interface PaperQuestionUnitForm {
  questionId?: number
  questionScore?: number
  passageId?: number
  questions?: Array<{
    questionId: number
    questionScore: number
    questionOrder?: number
  }>
}

export interface PaperForm {
  paperName: string
  description?: string | undefined
  passScore?: number | undefined
  /** [2026-10-31 新增] 声明总分：填了后端必须与逐题分值合计一致才允许保存 */
  totalScore?: number | undefined
  status?: 0 | 1 | 2 | undefined
  questionUnits: PaperQuestionUnitForm[]
}
