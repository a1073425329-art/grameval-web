import type { Difficulty, QuestionType } from './common'
// [2026-10-16 对齐] preview.questions 实际后端返回 AiPreviewVO.QuestionVO（无 id/categoryId，用 tempId），
// 不是落库后的 Question，故不再直接引用 Question 类型；旧引用注释保留
// import type { Question } from './question'

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
    // [2026-10-16 对齐] 后端 AiAnalyzeVO.CategoryStat 实际返回 attemptCount/wrongCount/accuracy，
    // 旧类型臆造的 totalCount/correctCount 后端不返回，模板取 totalCount 恒为 undefined
    // totalCount: number
    // correctCount: number
    attemptCount: number
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
  /** 目标学生用户 ID 列表（多选时使用，批量分析和出题） */
  targetUserIds?: number[]
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
  /**
   * [2026-10-16 新增] 试卷满分（标准档位：100/120/150/710/9）
   * 后端按「满分 ÷ 实际落库题量」精确分摊每题分值，卷面总分恒等于档位值
   */
  totalScore?: number
  /** 题型占比（合计 100） */
  singleWeight?: number
  multipleWeight?: number
  readingWeight?: number
  judgeWeight?: number
  fillWeight?: number
}

/**
 * AI 出题预览题目 —— 对齐后端 AiPreviewVO.QuestionVO。
 *
 * [2026-10-16 对齐] 预览态题目尚未落库，后端不返回 id / categoryId，
 * 用 tempId 在预览阶段做前端渲染 key 与阅读题组关联；与落库后的
 * QuestionVO（Question 类型）字段不同，故单独建模，不再复用 Question。
 */
export interface PreviewQuestion {
  /** 预览阶段临时 ID（未落库，确认入库后才生成真实主键） */
  tempId?: string
  /** 题型：SINGLE/MULTIPLE/JUDGE/FILL_HINT/READING */
  questionType: QuestionType
  /** 知识点分类名（预览态后端只回分类名，无 categoryId） */
  categoryName?: string
  /** 难度 1/2/3（后端 AiPaperService.difficultyOf 恒返回 1/2/3，预览必带） */
  difficulty: Difficulty
  /** 题干 */
  stem: string
  /** 标准答案（选择题类大写；填空类按 answerFormat） */
  standardAnswer?: string
  /** 解析 */
  analysis?: string
  /** 是否陷阱题 */
  hasTrap?: boolean
  /** 陷阱说明 */
  trapNote?: string
  /** 阅读理解题：所属文章 tempId（关联 passages[].tempId） */
  passageTempId?: string
  /** 选择题选项（预览态无 optionId） */
  options?: Array<{
    optionLabel: string
    optionContent: string
  }>
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
  /** 题目列表（预览态结构，见 PreviewQuestion） */
  questions: PreviewQuestion[]
  /** 学生分析文本（后端 AiPreviewVO 字段名为 analysis，旧类型误写 analysisText，前端未消费故无功能影响） */
  // analysisText?: string
  analysis?: string
}

/** 确认入库 */
export interface ConfirmPaperForm {
  logId: number
  paperName: string
  /** 考试时长（分钟）*/
  duration: number
  /** 场次名称，可选 */
  sessionName?: string | undefined
  /** 起止时间 */
  startTime?: string | undefined
  endTime?: string | undefined
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
