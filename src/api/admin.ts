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
import type { ExamSession, SessionForm } from '@/types/exam'
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

export interface UserListQuery extends PageQuery {
  username?: string
  realName?: string
  role?: string
  status?: number
}

export const listUsers = (params: UserListQuery) =>
  request.get<ApiResponse<PageResult<UserDetail>>>('/users', { params })

export const createUser = (data: UserCreateForm) =>
  request.post<ApiResponse<UserDetail>>('/users', data)

export const updateUser = (id: number, data: Partial<UserDetail>) =>
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
  categoryId?: number
  questionType?: QuestionType
  difficulty?: Difficulty
  keyword?: string
  status?: number
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
  paperName?: string
  status?: number
  createBy?: number
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
  sessionName?: string
  paperId?: number
  status?: number
  startTimeFrom?: string
  endTimeTo?: string
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
  userId?: number
  sessionId?: number
  paperId?: number
  minScore?: number
  maxScore?: number
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
  operationType?: string
  userId?: number
  username?: string
  clientIp?: string
  resultCode?: string
  targetType?: string
  startTime?: string
  endTime?: string
  requestUri?: string
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
  keyword?: string
  categoryId?: number
  difficulty?: Difficulty
  passageType?: string
  topic?: string
  source?: string
  status?: number
  includeTemp?: boolean
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
