import request from '@/utils/request'
import type { ApiResponse, PageQuery, PageResult, QuestionType, Difficulty } from '@/types/common'
import type {
  UserDetail,
  UserCreateForm,
} from '@/types/user'
import type { Category, CategoryForm } from '@/types/category'
import type {
  Question,
  QuestionCoverage,
  QuestionCoverageQuery,
  QuestionForm,
  QuestionUsageStats,
  QuestionAuditStatus,
  QuestionAuditStats,
  QuestionAuditResult,
  AiQuestionAuditResult,
} from '@/types/question'
import type { ReadingPassage, ReadingPassageForm, ReadingQuestionItem } from '@/types/reading'
import type { Paper, PaperForm, PaperSummaryStats } from '@/types/paper'
import type { ExamSession, SessionForm, ExamRecord, SessionSummaryStats } from '@/types/exam'
import type { ExamResultItem } from '@/types/result'
import type {
  AdminDashboardData,
  ExamMonitor,
  SessionStatistics,
  QuestionAnalytics,
  OperationLog,
  PaperUsageStats,
} from '@/types/admin'

/**
 * ⚠️ 后端路径约定：
 *   资源级 CRUD 挂在资源路径下：/users、/categories、/questions、/papers、/sessions
 *   管理端专用操作挂在：/admin/*
 * 前端 API 层遵循这个约定；无需再自己加 /admin/ 前缀。
 */

/* ============================================================ *
 *  1. 用户管理 /users
 * ============================================================ */

/* 说明（exactOptionalPropertyTypes）:
 * 以下「请求 DTO」的可选字段统一写成 `?: T | undefined`。
 * 原因: HTTP/JSON 传输层不存在 undefined, 显式传 undefined 与省略该键语义等价,
 * 调用方按表单值拼参数时天然会得到 `string | undefined`, 逐个调用点剔除键既啰嗦又易漏。
 * 注意: 该放宽只用于「入参」; 响应实体/业务模型的精确性保持不变。 */
export interface UserListQuery extends PageQuery {
  username?: string | undefined
  realName?: string | undefined
  role?: string | undefined
  status?: number | undefined
}

export const listUsers = (params: UserListQuery) =>
  request.get<ApiResponse<PageResult<UserDetail>>>('/users', { params })

export const createUser = (data: UserCreateForm) =>
  request.post<ApiResponse<UserDetail>>('/users', data)

// [2026-09-26] exactOptionalPropertyTypes 下 Partial<T> 只把属性变可选，并不允许把 undefined
// 赋给「原本必填」的属性（如 realName）；更新类接口需要「可选且允许 undefined」的映射类型。
export const updateUser = (id: number, data: { [K in keyof UserDetail]?: UserDetail[K] | undefined }) =>
  request.put<ApiResponse<UserDetail>>(`/users/${id}`, data)

export const deleteUser = (id: number) =>
  request.delete<ApiResponse<void>>(`/users/${id}`)

/** 管理员重置密码 —— PUT /users/{id}/password/reset  body: { newPassword } */
export const resetUserPassword = (id: number, newPassword = '123456') =>
  request.put<ApiResponse<void>>(`/users/${id}/password/reset`, { newPassword })

/* ============================================================ *
 *  2. 语法分类 /categories
 * ============================================================ */

export const listCategoryTree = (includeDisabled = false) =>
  request.get<ApiResponse<Category[]>>('/categories/tree', {
    params: includeDisabled ? { includeDisabled: true } : undefined,
  })

export const createCategory = (data: CategoryForm) =>
  request.post<ApiResponse<Category>>('/categories', data)

export const updateCategory = (id: number, data: CategoryForm) =>
  request.put<ApiResponse<Category>>(`/categories/${id}`, data)

export const deleteCategory = (id: number) =>
  request.delete<ApiResponse<void>>(`/categories/${id}`)

/* ============================================================ *
 *  3. 题目管理 /questions
 * ============================================================ */

export interface AdminQuestionQuery extends PageQuery {
  categoryId?: number | undefined
  questionType?: QuestionType | undefined
  difficulty?: Difficulty | undefined
  keyword?: string | undefined
  status?: number | undefined
  auditStatus?: QuestionAuditStatus | undefined
  createBy?: number | undefined
  studentId?: number | undefined
  studentIds?: number[] | undefined
  onlyWrong?: boolean | undefined
  // [2026-10-28] 后端 question.usage_count 列已清除，且这两个「引用次数区间」参数后端从来不认（失效筛选），已删除
  total?: number | undefined
}

export type QuestionAuditStatsQuery = Pick<
  AdminQuestionQuery,
  | 'keyword'
  | 'categoryId'
  | 'questionType'
  | 'difficulty'
  | 'status'
  | 'createBy'
  | 'studentId'
  | 'studentIds'
  | 'onlyWrong'
>

export const listAdminQuestions = (params: AdminQuestionQuery) =>
  request.get<ApiResponse<PageResult<Question>>>('/questions', { params })

export const createQuestion = (data: QuestionForm) =>
  request.post<ApiResponse<Question>>('/questions', data)

export const updateQuestion = (id: number, data: QuestionForm) =>
  request.put<ApiResponse<Question>>(`/questions/${id}`, data)

export const deleteQuestion = (id: number) =>
  request.delete<ApiResponse<void>>(`/questions/${id}`)

/** 批量启停 —— POST /questions/batch-status  body: { ids:[], status:0|1 } */
export const batchStatusQuestions = (ids: number[], status: 0 | 1) =>
  request.post<ApiResponse<void>>('/questions/batch-status', { ids, status })

/** 批量删除 —— POST /questions/batch-delete  body: { ids:[] } */
export const batchDeleteQuestions = (ids: number[]) =>
  request.post<ApiResponse<void>>('/questions/batch-delete', { ids })

/** 人工审核单条或批量题目。 */
export const auditQuestions = (ids: number[], auditStatus: 1 | 2) =>
  request.post<ApiResponse<QuestionAuditResult>>('/admin/questions/audit', { ids, auditStatus })

/** AI 审核仅针对当前未审核记录。 */
export const aiAuditQuestions = (ids: number[]) =>
  request.post<ApiResponse<AiQuestionAuditResult>>('/admin/questions/audit/ai', { ids })

export const aiAuditQuestionsSequentially = async (
  ids: number[],
  onProgress?: (done: number, total: number) => void,
): Promise<AiQuestionAuditResult> => {
  const result: AiQuestionAuditResult = { approved: 0, rejected: 0, failed: 0, items: [] }
  let done = 0

  for (const id of ids) {
    try {
      const response = await aiAuditQuestions([id])
      const item = response.data.items?.find((candidate) => candidate.id === id)
      if (item) {
        result.items.push(item)
        if (item.auditStatus === 1) result.approved += 1
        else if (item.auditStatus === 2) result.rejected += 1
        else result.failed += 1
      } else {
        result.failed += 1
        result.items.push({ id, auditStatus: null, reason: '响应缺少该题审核结果，题目保持待审核' })
      }
    } catch {
      result.failed += 1
      result.items.push({ id, auditStatus: null, reason: '审核请求失败，题目保持待审核' })
    } finally {
      done += 1
      onProgress?.(done, ids.length)
    }
  }

  return result
}

export const getQuestionAuditStats = (params: QuestionAuditStatsQuery) =>
  request.get<ApiResponse<QuestionAuditStats>>('/admin/questions/audit-stats', { params })

/**
 * 单题使用统计（实时聚合，无统计表）
 * GET /api/admin/questions/{questionId}/usage-stats
 * 返回：被引用试卷数、考试场次数、答题次数、正确率、涉及学生数等
 */
export const getQuestionUsageStats = (questionId: number) =>
  request.get<ApiResponse<QuestionUsageStats>>(`/admin/questions/${questionId}/usage-stats`)

const serializeQuestionCoverageParams = (params: Record<string, unknown>): string => {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, String(item)))
    } else {
      query.append(key, String(value))
    }
  }
  return query.toString()
}

/** 全局题库作答覆盖统计；studentIds 会编码为同名重复查询参数。 */
export const getQuestionCoverage = (query: QuestionCoverageQuery) =>
  request.get<ApiResponse<QuestionCoverage>>('/admin/questions/coverage', {
    params: query,
    paramsSerializer: { serialize: serializeQuestionCoverageParams },
  })

/**
 * 试卷使用统计（实时聚合，无统计表）
 * GET /api/admin/papers/{paperId}/usage-stats
 * 返回：引用场次数、参考人次、利用率、平均分/最高/最低、及格率、每题型与每语法正确率
 */
export const getPaperUsageStats = (paperId: number) =>
  request.get<ApiResponse<PaperUsageStats>>(`/admin/papers/${paperId}/usage-stats`)

/** CSV 导入模板下载 */
export const downloadImportTemplate = () =>
  request.get('/questions/import/template', { responseType: 'blob' })

/** CSV 导入 */
export const importQuestions = (file: File) => {
  const fd = new FormData()
  fd.append('file', file)
  return request.post<ApiResponse<{ successCount: number; failedCount: number; errors?: string[] }>>(
    '/questions/import',
    fd,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
}

/* ============================================================ *
 *  4. 试卷 /papers
 * ============================================================ */

export interface PaperListQuery extends PageQuery {
  paperName?: string | undefined
  status?: number | undefined
  createBy?: number | undefined
  minQuestionCount?: number | undefined
  maxQuestionCount?: number | undefined
  minTotalScore?: number | undefined
  maxTotalScore?: number | undefined
}

export const getPaperSummaryStats = () =>
  request.get<ApiResponse<PaperSummaryStats>>('/papers/summary-stats')

export const copyPaper = (id: number) =>
  request.post<ApiResponse<Paper>>(`/papers/${id}/copy`)

export const listPapers = (params: PaperListQuery) =>
  request.get<ApiResponse<PageResult<Paper>>>('/papers', { params })

export const getPaperDetail = (id: number) =>
  request.get<ApiResponse<Paper>>(`/papers/${id}`)

export const createPaper = (data: PaperForm) =>
  request.post<ApiResponse<Paper>>('/papers', data)

export const updatePaper = (id: number, data: PaperForm) =>
  request.put<ApiResponse<Paper>>(`/papers/${id}`, data)

export const deletePaper = (id: number) =>
  request.delete<ApiResponse<void>>(`/papers/${id}`)

/** 发布/下架 —— PUT /admin/papers/{id}/status?status=0|1|2  （query param） */
export const updatePaperStatus = (id: number, status: 0 | 1 | 2) =>
  request.put<ApiResponse<void>>(`/admin/papers/${id}/status`, null, {
    params: { status },
  })

/* ============================================================ *
 *  5. 考试场次 /sessions
 * ============================================================ */

export interface SessionListQuery extends PageQuery {
  sessionName?: string | undefined
  paperId?: number | undefined
  status?: number | undefined
  startTimeFrom?: string | undefined
  endTimeTo?: string | undefined
}

export const getSessionSummaryStats = () =>
  request.get<ApiResponse<SessionSummaryStats>>('/sessions/summary-stats')

export const publishSessionAnswers = (id: number) =>
  request.post<ApiResponse<ExamSession>>(`/sessions/${id}/publish-answers`)

export const copySession = (id: number) =>
  request.post<ApiResponse<ExamSession>>(`/sessions/${id}/copy`)

export const listSessions = (params: SessionListQuery) =>
  request.get<ApiResponse<PageResult<ExamSession>>>('/sessions', { params })

export const getSessionDetail = (id: number) =>
  request.get<ApiResponse<ExamSession>>(`/sessions/${id}`)

export const createSession = (data: SessionForm) =>
  request.post<ApiResponse<ExamSession>>('/sessions', data)

export const updateSession = (id: number, data: SessionForm) =>
  request.put<ApiResponse<ExamSession>>(`/sessions/${id}`, data)

export const deleteSession = (id: number) =>
  request.delete<ApiResponse<void>>(`/sessions/${id}`)

/* ============================================================ *
 *  5.5 考试记录（ExamRecord）—— /exams（管理员可看全部）
 * ============================================================ */

export interface ExamRecordQuery extends PageQuery {
  userId?: number
  sessionId?: number
  submitStatus?: number
}

export const listExamRecords = (params: ExamRecordQuery) =>
  request.get<ApiResponse<PageResult<ExamRecord>>>('/exams', { params })

/* ============================================================ *
 *  5.6 教师 / 老师列表（用于选择器）
 * ============================================================ */

export const listTeachers = () =>
  request.get<ApiResponse<PageResult<UserDetail>>>('/users', {
    params: { pageNum: 1, pageSize: 200, role: 'TEACHER' },
  })

/* ============================================================ *
 *  6. 管理端专用操作 /admin/*
 * ============================================================ */

/** Dashboard */
export const getDashboard = () =>
  request.get<ApiResponse<AdminDashboardData>>('/admin/dashboard')

/** 场次学生指派 —— 查询 */
export const listExamStudents = (sessionId: number) =>
  request.get<ApiResponse<Array<{ id: number; username: string; realName?: string }>>>(
    `/admin/exams/${sessionId}/students`
  )

/** 场次学生指派 —— 全量替换 */
export const assignExamStudents = (sessionId: number, userIds: number[]) =>
  request.put<ApiResponse<void>>(`/admin/exams/${sessionId}/students`, { userIds })

/** 强制收卷 —— 整场所有进行中考生统一提交 */
export const forceSubmit = (sessionId: number) =>
  request.post<ApiResponse<{ affectedCount: number }>>(
    `/admin/exams/${sessionId}/force-submit`
  )

/** 实时监控 */
export const getExamMonitor = (sessionId: number) =>
  request.get<ApiResponse<ExamMonitor>>(`/admin/exams/${sessionId}/monitor`)

/** 场次统计 */
export const getSessionStatistics = (sessionId: number) =>
  request.get<ApiResponse<SessionStatistics>>(`/admin/exams/${sessionId}/statistics`)

/** 题目质量分析（可选 categoryId 过滤） */
export const getQuestionAnalytics = (categoryId?: number) =>
  request.get<ApiResponse<QuestionAnalytics>>('/admin/questions/analytics', {
    params: { categoryId },
  })

/** 多条件成绩查询 */
export interface AdminResultQuery extends PageQuery {
  userId?: number | undefined
  sessionId?: number | undefined
  paperId?: number | undefined
  minScore?: number | undefined
  maxScore?: number | undefined
  userName?: string | undefined
  paperName?: string | undefined
  minCorrectRate?: number | undefined
  maxCorrectRate?: number | undefined
  /** [2026-10-04 补全] 考试时间范围（对齐论文 §4.2.5「按……考试时间查询成绩」） */
  startTime?: string | undefined
  endTime?: string | undefined
}

export const listAdminResults = (params: AdminResultQuery) =>
  request.get<ApiResponse<PageResult<ExamResultItem>>>('/admin/results', { params })

/** 导出 CSV（UTF-8 BOM，Excel 可打开） */
export const exportResults = (params: AdminResultQuery) =>
  request.get('/admin/results/export', {
    params,
    responseType: 'blob',
  })

/** 操作日志 */
export interface OperationLogQuery extends PageQuery {
  operationType?: string | undefined
  userId?: number | undefined
  username?: string | undefined
  clientIp?: string | undefined
  resultCode?: string | undefined
  targetType?: string | undefined
  startTime?: string | undefined
  endTime?: string | undefined
  requestUri?: string | undefined
  httpMethod?: string | undefined
}

export const listOperationLogs = (params: OperationLogQuery) =>
  request.get<ApiResponse<PageResult<OperationLog>>>('/admin/operation-logs', { params })

export const getOperationLogDetail = (id: number) =>
  request.get<ApiResponse<OperationLog>>(`/admin/operation-logs/${id}`)

export const deleteOperationLog = (id: number) =>
  request.delete<ApiResponse<void>>(`/admin/operation-logs/${id}`)

export const clearAllOperationLogs = () =>
  request.delete<ApiResponse<void>>('/admin/operation-logs')

export const deleteOperationLogsByRange = (startTime: string, endTime: string) =>
  request.delete<ApiResponse<void>>('/admin/operation-logs/range', {
    params: { startTime, endTime },
  })

export const getOperationLogStatistics = (groupBy = 'operation_type') =>
  request.get<ApiResponse<{ groupBy: string; data: Array<[string, number]> }>>(
    '/admin/operation-logs/statistics',
    { params: { groupBy } }
  )

export const getOperationLogTypes = () =>
  request.get<ApiResponse<Array<{ value: string; label: string }>>>(
    '/admin/operation-logs/types'
  )

/* ============================================================ *
 *  7. 阅读理解文章库 /reading-passages
 * ============================================================ */

export interface ReadingPassageQuery extends PageQuery {
  keyword?: string | undefined
  categoryId?: number | undefined
  difficulty?: Difficulty | undefined
  passageType?: string | undefined
  topic?: string | undefined
  status?: number | undefined
  includeTemp?: boolean | undefined
  includeQuestions?: boolean | undefined
}

export const listReadingPassages = (params: ReadingPassageQuery) =>
  request.get<ApiResponse<PageResult<ReadingPassage>>>('/reading-passages', { params })

export const getReadingPassageDetail = (id: number, includeQuestions = true) =>
  request.get<ApiResponse<ReadingPassage>>(`/reading-passages/${id}`, {
    params: { includeQuestions },
  })

export const getPassageQuestions = (id: number) =>
  request.get<ApiResponse<ReadingPassage>>(`/reading-passages/${id}/questions`)

export const createReadingPassage = (data: ReadingPassageForm) =>
  request.post<ApiResponse<ReadingPassage>>('/reading-passages', data)

export const updateReadingPassage = (id: number, data: Partial<ReadingPassageForm>) =>
  request.put<ApiResponse<ReadingPassage>>(`/reading-passages/${id}`, data)

export const deleteReadingPassage = (id: number) =>
  request.delete<ApiResponse<void>>(`/reading-passages/${id}`)

export const addPassageQuestion = (passageId: number, data: ReadingQuestionItem) =>
  request.post<ApiResponse<Question>>(`/reading-passages/${passageId}/questions`, data)

export const batchStatusReadingPassages = (ids: number[], status: 0 | 1) =>
  request.post<ApiResponse<void>>('/reading-passages/batch-status', { ids, status })

export const batchDeleteReadingPassages = (ids: number[]) =>
  request.post<ApiResponse<number>>('/reading-passages/batch-delete', { ids })

// ==================== [2026-09-26 新增] 重新阅卷 ====================
// 依据：论文 L920 / L980 / L986（管理员修正题目后重新触发阅卷，记录修正原因和处理时间）
// 对应后端：POST /api/admin/results/{examId}/regrade（AdminController @RequestMapping("/api/admin")）
// [2026-09-26 修复] 原路径漏了 /admin 前缀，baseURL='/api' 下实际请求 /api/results/{id}/regrade → 404，
// 页面「重新阅卷」按钮点了无响应（前后端路由对齐核查发现）。
export const regradeResult = (examId: number, reason?: string) =>
  request.post<ApiResponse<unknown>>(`/admin/results/${examId}/regrade`, { reason })

// ==================== 班级（多对多：学生↔班级、老师↔班级） ====================
// 定位：班级只是「快速选择学生」的筛选维度，题目/试卷/考试/成绩均不挂班级。
// 后端：ClassGroupController @RequestMapping("/api/classes")

export interface ClassGroup {
  id: number
  className: string
  schoolName?: string
  teacherId?: number
  teacherName?: string
  teacherIds?: number[]
  teacherNames?: string[]
  grade?: string
  studentCount?: number
  description?: string
  status?: number
  createTime?: string
  students?: ClassStudent[]
}

export interface ClassStudent {
  id?: number
  classId?: number
  studentId: number
  studentName?: string
  username?: string
  studentNo?: string
  avatar?: string
  joinTime?: string
  remark?: string
  /** 一个学生可上多个班 */
  classNames?: string[]
  gender?: number
  email?: string
  phone?: string
  status?: number
  lastLoginTime?: string
  /** 学习概览（与后端学生列表同口径，供「按班级」Tab 渲染） */
  examCount?: number
  recentScore?: number
  averageScore?: number
  wrongCount?: number
}

export interface ClassTeacher {
  id: number
  classId: number
  teacherId: number
  createdAt?: string
}

/** 我带的班级（班主任 + 任课老师两种来源合并） */
export const listMyClasses = () =>
  request.get<ApiResponse<ClassGroup[]>>('/classes/my')

/** 我所带班级下的全部学生（跨班级去重，一人多班；classNames 列出其全部班级） */
export const listMyClassStudents = () =>
  request.get<ApiResponse<ClassStudent[]>>('/classes/my/students')

/** 某班级的学生 */
export const listClassStudents = (classId: number) =>
  request.get<ApiResponse<ClassStudent[]>>(`/classes/${classId}/students`)

/** 某班级的任课老师（主讲 + 助教） */
export const listClassTeachers = (classId: number) =>
  request.get<ApiResponse<ClassTeacher[]>>(`/classes/${classId}/teachers`)

/** 批量重设某班级的任课老师 */
export const assignClassTeachers = (classId: number, teacherIds: number[]) =>
  request.put<ApiResponse<void>>(`/classes/${classId}/teachers`, teacherIds)

/** 添加单个学生到班级 */
export const addClassStudent = (classId: number, studentId: number, studentNo?: string) =>
  request.post<ApiResponse<void>>(`/classes/${classId}/students/${studentId}`, null, { params: { studentNo } })

/** 从班级移除学生（只解绑该班，不影响其其他班级） */
export const removeClassStudent = (classId: number, studentId: number) =>
  request.delete<ApiResponse<void>>(`/classes/${classId}/students/${studentId}`)

/** 学生个人知识点掌握度（教师端可查任意学生） */
export const getStudentKnowledgeMastery = (userId: number) =>
  request.get<ApiResponse<any>>(`/knowledge-mastery/student/${userId}`)

/** 学生个人知识画像洞察 */
export const getStudentKnowledgeInsights = (userId: number) =>
  request.get<ApiResponse<any>>(`/knowledge-mastery/student/${userId}/insights`)

/** 学生个人历次成绩趋势曲线 */
export const getStudentScoreTrend = (userId: number) =>
  request.get<ApiResponse<any>>(`/score-curve/student/${userId}`)
