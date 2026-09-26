import type { QuestionType, Difficulty } from './common'

/**
 * 试卷试题关联 —— 对齐后端 PaperQuestionVO
 * 后端返回的是扁平结构（题干+题型+难度直接展开在 pq 上）
 */
export interface PaperQuestionVO {
  questionId: number
  stem: string
  questionType: QuestionType
  difficulty: Difficulty
  questionScore: number
  questionOrder: number
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
  shuffleQuestions?: boolean
  /** 0草稿 / 1启用 / 2停用 */
  status: 0 | 1 | 2
  createBy?: number
  aiGenerated?: boolean
  targetUserId?: number
  createTime?: string
  updateTime?: string
  questions?: PaperQuestionVO[]
  /** 建议考试时长（分钟） */
  suggestedDuration?: number
  /** 归档状态：0未归档，1已归档 */
  archiveStatus?: number
}

/** 试卷创建/更新请求 —— 对齐后端 PaperRequest
 * （请求 DTO, 可选字段放宽 undefined, 见 src/api/admin.ts 顶部说明） */
export interface PaperForm {
  paperName: string
  description?: string | undefined
  passScore?: number | undefined
  shuffleQuestions?: boolean | undefined
  status?: 0 | 1 | 2 | undefined
  questions: Array<{
    questionId: number
    questionScore: number
    questionOrder: number
  }>
}
