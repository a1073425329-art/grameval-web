import type { Difficulty, QuestionType } from './common'

/**
 * 试题选项 —— 对齐后端 QuestionOption 表
 * 后端字段：optionLabel（A/B/C/D）+ optionContent
 */
export interface QuestionOption {
  id?: number
  optionLabel: string
  optionContent: string
  sortNo: number
}

/**
 * 试题 —— 对齐后端 QuestionVO
 * 字段变更（vs 之前）：
 *   type      → questionType
 *   content   → stem
 *   answer    → standardAnswer（一律大写，多选 A,B）
 *   options.key/text → optionLabel/optionContent
 *   difficulty: string → Integer 1/2/3
 */
export interface Question {
  id: number
  categoryId: number
  categoryName?: string
  questionType: QuestionType
  stem: string
  /** 标准答案，一律大写；多选 "A,B"；判断 "TRUE"/"FALSE" */
  standardAnswer?: string
  analysis?: string
  /** 知识点标签列表 */
  knowledgePoints?: string[]
  difficulty: Difficulty
  defaultScore?: number
  status?: 0 | 1
  createBy?: number
  usageCount?: number
  /** 阅读理解题：所属文章 ID */
  passageId?: number
  hasTrap?: boolean
  aiGenerated?: boolean
  targetUserId?: number
  trapNote?: string
  createTime?: string
  updateTime?: string
  options?: QuestionOption[]
}

/** 试题新增/编辑请求 —— 对齐后端 QuestionRequest */
export interface QuestionForm {
  categoryId: number
  questionType: QuestionType
  stem: string
  standardAnswer: string
  analysis?: string
  /** 知识点标签列表 */
  knowledgePoints?: string[]
  difficulty: Difficulty
  defaultScore?: number
  status?: 0 | 1
  passageId?: number
  hasTrap?: boolean
  trapNote?: string
  options?: Array<{
    optionLabel: string
    optionContent: string
    sortNo: number
  }>
}

/** 无状态快速判题 —— POST /practice/submit（UC03 别名） */
export interface QuickPracticeForm {
  questionId: number
  userAnswer: string
}

/** 快速判题反馈 —— QuickPracticeResultVO */
export interface QuickPracticeResult {
  isCorrect: boolean
  userAnswer: string
  standardAnswer: string
  analysis?: string
}

/** 专项练习会话 —— PracticeVO */
export interface PracticeRecord {
  id: number
  userId: number
  categoryId: number
  categoryName?: string
  startTime: string
  finishTime?: string
  questionCount: number
  correctCount: number
  wrongCount: number
  accuracy?: number
  status: 0 | 1
}

/** 练习中提交单题答案 */
export interface PracticeAnswerForm {
  questionId: number
  userAnswer: string
}
