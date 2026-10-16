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

  // ===== 2026-10-16 新增：多维学情画像 =====
  // 全部为可选，老后端不返回时前端自动隐藏对应区块（向后兼容）
  overview?: ClassOverview | null
  typeStats?: TypeStat[] | null
  difficultyStats?: DifficultyStat[] | null
  knowledgeStats?: KnowledgeStat[] | null
  focusStudents?: FocusStudent[] | null
  topStudents?: FocusStudent[] | null
  dataWarnings?: string[] | null
}

/** 班级概览：分数分布与整体指标 */
export interface ClassOverview {
  maxScore?: number | null
  minScore?: number | null
  medianScore?: number | null
  /** 分数标准差，反映班级分化程度 */
  stdDevScore?: number | null
  /** 及格率 %（≥60 分） */
  passRate?: number | null
  /** 优秀率 %（≥85 分） */
  excellentRate?: number | null
  totalAnswers?: number | null
  totalCorrect?: number | null
  classAccuracy?: number | null
  /** 已阅卷的考试份数（成绩单条数，不是学生数） */
  scoredExamCount?: number | null
}

/** 题型维度正确率 */
export interface TypeStat {
  type: string
  typeName: string
  total: number
  correct: number
  accuracy: number
}

/** 难度维度正确率 */
export interface DifficultyStat {
  difficulty: number
  difficultyName: string
  total: number
  correct: number
  accuracy: number
}

/** 知识点维度薄弱项 */
export interface KnowledgeStat {
  name: string
  wrongCount: number
  total: number
  accuracy: number
  affectedStudentCount: number
}

/** 学生个体摘要（重点关注 / 表现优秀） */
export interface FocusStudent {
  studentId: number
  realName: string
  accuracy: number
  avgScore: number
  examCount: number
  weakestCategory?: string | null
  reason: string
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
    // 300s：实测 20 题 209s（think:false 提速后），原 180s 不够 —— 且必须覆盖
    // request.ts 默认 20s，否则 20s 就报「请求超时,请检查网络」（后端照常跑完）。
    { timeout: 300_000 }
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
  /** 阅读子题型：DETAIL/MAIN_IDEA/INFERENCE/VOCABULARY/ATTITUDE（可选） */
  questionSubtype?: string
}

export interface AiReadingResult {
  title: string
  content: string
  summary: string
  /** 全文中文翻译（可选） */
  translation?: string
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
  /** [2026-10-16 新增] 试卷满分（标准档位：100/120/150/710/9），随 body 传给后端 */
  totalScore?: number
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
      // 同 generatePreview：Dify 链路实测 209s，必须 > 300s 才不被默认 20s 截断
      timeout: 300_000,
    }
  )
}
