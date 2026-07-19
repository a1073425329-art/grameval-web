import type { Question } from './question'

/**
 * 学生分析请求 —— POST /admin/ai/analyze-student?targetUserId=xxx
 * 请求只有 query 参数 targetUserId
 */

/** 学生分析响应 */
export interface StudentAnalysis {
  /** 一句话学习建议（AI 生成，教师可编辑） */
  analysis: string
  /** 分类错题统计 */
  categoryStats: Array<{
    categoryId: number
    categoryName: string
    totalCount: number
    correctCount: number
    wrongCount: number
    accuracy: number
  }>
  /** Dify workflow run id */
  workflowRunId?: string
}

/**
 * AI 出题预览请求 —— POST /admin/ai/generate-paper/preview
 * 后端字段对齐 GeneratePaperRequest
 */
export interface GeneratePaperForm {
  targetUserId: number
  /** 教师编辑后的学情分析（作为 prompt 一部分） */
  analysisText?: string
  /** 语法分类多选 */
  categoryIds: number[]
  /** 三档难度百分比（合计 100） */
  easyPct: number
  mediumPct: number
  hardPct: number
  /** 陷阱干扰开关 */
  withTrap: boolean
  /** 针对薄弱点加强 */
  focusWeak: boolean
  /** 题量 20-200 */
  questionCount: number
  /** 题型占比（合计 100） */
  singleWeight?: number
  multipleWeight?: number
  readingWeight?: number
}

/** AI 出题预览响应 */
export interface GeneratePaperPreview {
  /** 出题日志 ID（用于确认时引用） */
  logId: number
  /** 生成耗时 ms */
  durationMs?: number
  /** 阅读理解文章列表 */
  passages?: Array<{
    tempId: string
    title?: string
    content: string
    wordCount?: number
  }>
  /** 题目列表 */
  questions: Question[]
  /** 教师编辑用的分析文本 */
  analysisText?: string
}

/** 确认入库 */
export interface ConfirmPaperForm {
  logId: number
  paperName: string
  /** 考试时长（分钟）*/
  duration: number
  /** 场次名称，可选 */
  sessionName?: string
  /** 起止时间 */
  startTime?: string
  endTime?: string
}

/** 确认入库响应 */
export interface ConfirmPaperResult {
  paperId: number
  sessionId?: number
  status: 'PREVIEW' | 'CONFIRMED' | 'FAILED'
}

/** AI 出题日志 */
export interface PaperGenerationLog {
  id: number
  teacherId: number
  teacherName?: string
  targetUserId: number
  targetUserName?: string
  requestParams?: string
  analysisText?: string
  generatedJson?: string
  paperId?: number
  sessionId?: number
  status: 'PREVIEW' | 'CONFIRMED' | 'FAILED'
  errorMessage?: string
  difyWorkflowId?: string
  durationMs?: number
  createTime: string
  updateTime?: string
}
