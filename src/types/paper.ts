import type { QuestionType, Difficulty } from './common'

/**
 * 试卷试题关联 —— 对齐后端 PaperQuestionVO
 * 后端返回的是扁平结构（题干+题型+难度直接展开在 pq 上）
 */
export interface PaperSubQuestionVO {
  questionId: number
  stem: string
  questionType: QuestionType
  difficulty: Difficulty
  questionScore: number
  questionOrder: number
}

export interface PaperQuestionVO {
  unitType: 'QUESTION' | 'READING'
  questionId?: number
  stem: string
  questionType: QuestionType
  difficulty?: Difficulty
  questionScore: number
  questionOrder: number
  passageId?: number
  passageTitle?: string
  passageContent?: string
  passageWordCount?: number
  subQuestions?: PaperSubQuestionVO[]
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
  // [2026-10-28] 原「随机乱序」字段对应后端 exam_paper.shuffle_questions：取题排序代码完全不读该列，属假开关 ⇒ 删除
  /** 0草稿 / 1启用 / 2停用 */
  status: 0 | 1 | 2
  createBy?: number
  createTime?: string
  updateTime?: string
  questions?: PaperQuestionVO[]
  // [2026-10-28] 原「建议考试时长（分钟）」字段对应后端 exam_paper.suggested_duration：无写入点恒 NULL ⇒ 删除
  /** 归档状态：0未归档，1已归档 */
  archiveStatus?: number
}

/** 试卷创建/更新请求 —— 对齐后端 PaperRequest
 * （请求 DTO, 可选字段放宽 undefined, 见 src/api/admin.ts 顶部说明） */
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
  // [2026-10-28] 原「随机乱序」提交项：后端不读该列（假开关），随表单开关一并删除
  status?: 0 | 1 | 2 | undefined
  questionUnits: PaperQuestionUnitForm[]
}
