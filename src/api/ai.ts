import request from '@/utils/request'
import type { ApiResponse, PageQuery, PageResult } from '@/types/common'
import type { UserDetail } from '@/types/user'
import type {
  StudentAnalysis,
  GeneratePaperForm,
  GeneratePaperPreview,
  ConfirmPaperForm,
  ConfirmPaperResult,
  PaperGenerationLog,
} from '@/types/ai'

/**
 * ① 分析单个学生历史 —— POST /admin/ai/analyze-student?targetUserId=xxx
 * 返回一句话学习建议 + 各分类错题统计（Dify + DeepSeek）
 */
export const analyzeStudent = (targetUserId: number) =>
  request.post<ApiResponse<StudentAnalysis>>('/admin/ai/analyze-student', null, {
    params: { targetUserId },
    timeout: 120_000,
  })

/**
 * ①-2 批量分析多个学生 —— POST /admin/ai/analyze-students
 * 返回整体学情分析、共同薄弱分类、教学建议等（多学生整体分析）
 */
export interface BatchStudentAnalysis {
  studentCount: number
  studentNames: string[]
  overallAnalysis: string
  avgExams: number
  avgScore: number
  avgAccuracy: number
  commonWeakCategories: Array<{
    categoryId: number
    categoryName: string
    affectedStudentCount: number
    totalWrongCount: number
    avgAccuracy: number
  }>
  studentDetails: StudentAnalysis[]
  teachingSuggestions: string
}

export const analyzeStudents = (targetUserIds: number[]) =>
  request.post<ApiResponse<BatchStudentAnalysis>>('/admin/ai/analyze-students', targetUserIds, {
    timeout: 180_000,
  })

/**
 * ② 生成预览 —— POST /admin/ai/generate-paper/preview
 * 不落库，可多次调用改参数（每次生成一条 log 记录）
 */
export const generatePreview = (data: GeneratePaperForm) =>
  request.post<ApiResponse<GeneratePaperPreview>>(
    '/admin/ai/generate-paper/preview',
    data,
    { timeout: 180_000 }
  )

/**
 * ③ 确认入库 —— POST /admin/ai/generate-paper/confirm
 * 自动建 试卷 + 场次 + 指派学生
 */
export const confirmPaper = (data: ConfirmPaperForm) =>
  request.post<ApiResponse<ConfirmPaperResult>>(
    '/admin/ai/generate-paper/confirm',
    data
  )

/** 出题日志分页 */
export interface AiLogQuery extends PageQuery {
  targetUserId?: number
  status?: 'PREVIEW' | 'CONFIRMED' | 'FAILED'
}

export const listGenerationLogs = (params: AiLogQuery) =>
  request.get<ApiResponse<PageResult<PaperGenerationLog>>>(
    '/admin/ai/generation-logs',
    { params }
  )

export const getGenerationLog = (logId: number) =>
  request.get<ApiResponse<PaperGenerationLog>>(`/admin/ai/generation-logs/${logId}`)

/**
 * AI验证题目 —— POST /admin/ai/validate-question
 * 验证题目答案和解析的正确性，提供修改建议
 */
export interface ValidateQuestionForm {
  questionType: string
  stem: string
  options?: Array<{ optionLabel: string; optionContent: string }> | undefined
  standardAnswer: string
  analysis?: string | undefined
}

export interface ValidateQuestionResult {
  isValid: boolean
  confidence: number
  suggestions: string[]
  correctedAnswer?: string
  improvedAnalysis?: string
}

export const validateQuestion = (data: ValidateQuestionForm) =>
  request.post<ApiResponse<ValidateQuestionResult>>('/admin/ai/validate-question', data, {
    timeout: 60_000,
  })

/**
 * AI 生成阅读理解文章+题目 —— POST /admin/ai/generate-reading
 * 调用 DeepSeek 生成阅读理解文章和配套选择题
 */
export interface ReadingSubQuestion {
  stem: string
  options: Array<{ optionLabel: string; optionContent: string; sortNo?: number }>
  standardAnswer: string
  analysis: string
  knowledgePoints: string[]
  defaultScore?: number
}

export interface AiReadingResult {
  title: string
  content: string
  summary: string
  questions: ReadingSubQuestion[]
}

export const generateReading = (params: {
  topic?: string | undefined
  passageType?: string | undefined
  difficulty?: number | undefined
  questionCount?: number | undefined
}) =>
  request.post<ApiResponse<AiReadingResult>>('/admin/ai/generate-reading', null, {
    params,
    timeout: 120_000,
  })

/**
 * 获取当前教师名下所有学生 —— GET /admin/ai/my-students
 */
export const getMyStudents = () =>
  request.get<ApiResponse<UserDetail[]>>('/admin/ai/my-students')

/**
 * 一键出卷 —— POST /admin/ai/generate-paper/direct
 * 直接生成题目并创建试卷+考试，一步到位
 */
export interface DirectGenerateParams {
  targetUserId: number
  targetUserIds?: number[]
  categoryIds: number[]
  easyPct: number
  mediumPct: number
  hardPct: number
  withTrap: boolean
  focusWeak: boolean
  questionCount: number
  singleWeight?: number
  multipleWeight?: number
  readingWeight?: number
  judgeWeight?: number
  fillWeight?: number
  analysisText?: string
  paperName: string
  sessionName?: string
  startTime?: string
  endTime?: string
  duration?: number
}

export const directGenerate = (data: DirectGenerateParams) => {
  const { paperName, sessionName, startTime, endTime, duration, ...generateParams } = data
  return request.post<ApiResponse<GeneratePaperPreview & { paperId: number; sessionId: number }>>(
    '/admin/ai/generate-paper/direct',
    generateParams,
    {
      params: { paperName, sessionName, startTime, endTime, duration: duration || 45 },
      timeout: 180_000,
    }
  )
}
