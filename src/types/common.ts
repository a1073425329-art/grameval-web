export interface ApiResponse<T = unknown> {
  code: number
  data: T
  message: string
  timestamp?: string
}

/**
 * 分页查询 —— 使用后端字段名 pageNum / pageSize
 */
export interface PageQuery {
  pageNum?: number | undefined
  pageSize?: number | undefined
  [key: string]: unknown
}

export interface PageResult<T> {
  records: T[]
  total: number
  pageNum?: number | undefined
  pageSize?: number | undefined
  totalPages?: number
}

/** 角色 */
export type Role = 'ADMIN' | 'STUDENT'

/**
 * 题型 —— 与后端 QuestionType 枚举对齐
 *  - SINGLE   单选题
 *  - MULTIPLE 多选题（后端叫 MULTIPLE 不是 MULTI）
 *  - JUDGE    判断题（答案 TRUE / FALSE）
 *  - FILL_HINT 带括号提示的填空题（如 "My father ___ (get) up"）
 *  - READING  阅读理解（含 passageId）
 */
export type QuestionType = 'SINGLE' | 'MULTIPLE' | 'JUDGE' | 'FILL' | 'FILL_HINT' | 'READING'

/** 难度 —— 后端 Integer 1/2/3 */
export type Difficulty = 1 | 2 | 3

/** 题目/试卷/场次等的状态 */
export type StatusFlag = 0 | 1 | 2

/** 字典条目 */
export interface DictItem {
  value: string | number
  label: string
}
