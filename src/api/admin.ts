import request from '@/utils/request'
import type { ApiResponse, PageQuery, PageResult, QuestionType, Difficulty } from '@/types/common'
import type {
  UserDetail,
  UserCreateForm,
} from '@/types/user'
import type { Category, CategoryForm } from '@/types/category'
import type { Question, QuestionForm } from '@/types/question'
import type { ReadingPassage, ReadingPassageForm, ReadingQuestionItem } from '@/types/reading'
import type { Paper, PaperForm } from '@/types/paper'
import type { ExamSession, SessionForm, ExamRecord } from '@/types/exam'
import type { ExamResultItem } from '@/types/result'
import type {
  AdminDashboardData,
  ExamMonitor,
  SessionStatistics,
  QuestionAnalytics,
  OperationLog,
  AdminStudent,
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

export const listCategoryTree = () =>
  request.get<ApiResponse<Category[]>>('/categories/tree')

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
  minUsageCount?: number | undefined
  maxUsageCount?: number | undefined
  hasTrap?: boolean | undefined
  total?: number | undefined
}

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
  aiGenerated?: boolean | undefined
  minQuestionCount?: number | undefined
  maxQuestionCount?: number | undefined
  minTotalScore?: number | undefined
  maxTotalScore?: number | undefined
}

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

/** 我的学生（管理员绑定） */
export const listMyStudents = () =>
  request.get<ApiResponse<AdminStudent[]>>('/admin/my-students')

/** 绑定学生（全量替换） —— PUT /admin/my-students */
export const bindMyStudents = (studentIds: number[]) =>
  request.put<ApiResponse<void>>('/admin/my-students', { studentIds })

/** 未绑定的学生 */
export const listUnassignedStudents = () =>
  request.get<ApiResponse<UserDetail[]>>('/admin/my-students/unassigned')

/** 查询学生所属管理员 */
export const listStudentAdmins = (studentId: number) =>
  request.get<ApiResponse<Array<{ id: number; username: string; realName?: string }>>>(
    `/admin/students/${studentId}/admins`
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
  source?: string | undefined
  status?: number | undefined
  includeTemp?: boolean | undefined
}

export const listReadingPassages = (params: ReadingPassageQuery) =>
  request.get<ApiResponse<PageResult<ReadingPassage>>>('/reading-passages', { params })

export const getReadingPassageDetail = (id: number, includeQuestions = true) =>
  request.get<ApiResponse<ReadingPassage>>(`/reading-passages/${id}`, {
    params: { includeQuestions },
  })

export const getPassageQuestions = (id: number) =>
  request.get<ApiResponse<Question[]>>(`/reading-passages/${id}/questions`)

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
