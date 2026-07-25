import request from '@/utils/request'
import type { ApiResponse, PageQuery, PageResult, QuestionType, Difficulty } from '@/types/common'
import type { Category } from '@/types/category'
import type {
  Question,
  QuickPracticeForm,
  QuickPracticeResult,
  PracticeRecord,
  PracticeAnswerForm,
} from '@/types/question'
import type {
  AvailableExam,
  ExamPaperView,
  ExamRecord,
  SaveAnswerForm,
} from '@/types/exam'
import type {
  ResultSummary,
  ExamResultItem,
  ResultDetail,
  WrongBookItem,
  WrongBookQuery,
} from '@/types/result'
import type {
  StudentStatistics,
  DimensionAnalysis,
  TrainingSchedule,
} from '@/types/stats'
import type { LearningProgress } from '@/types/progress'
import type { Notification } from '@/types/notification'
import type { LeaderboardItem, MyRank } from '@/types/leaderboard'

/* ============================================================ *
 *  1. 分类
 * ============================================================ */

/** 分类平铺列表（可 ?status=1） */
export const listCategories = (params?: { status?: number }) =>
  request.get<ApiResponse<Category[]>>('/categories', { params })

/** 分类树（含每个分类的题目数量） */
export const getCategoryTree = () =>
  request.get<ApiResponse<Category[]>>('/categories/tree')

/* ============================================================ *
 *  2. 题库
 * ============================================================ */

export interface QuestionListQuery extends PageQuery {
  keyword?: string
  categoryId?: number
  questionType?: QuestionType
  difficulty?: Difficulty
  status?: number
}

/** 题库分页 */
export const listQuestions = (params: QuestionListQuery) =>
  request.get<ApiResponse<PageResult<Question>>>('/questions', { params })

/** 题目详情（管理员含答案，学生不含） */
export const getQuestionDetail = (id: number) =>
  request.get<ApiResponse<Question>>(`/questions/${id}`)

/** 学习模式（含答案+解析） */
export const getQuestionStudyMode = (id: number) =>
  request.get<ApiResponse<Question>>(`/questions/${id}/study-mode`)

/* ============================================================ *
 *  3. 专项练习
 * ============================================================ */

/** 按分类随机取题（默认 10 道，不含答案） */
export const getPracticeQuestions = (categoryId: number, count = 10) =>
  request.get<ApiResponse<Question[]>>('/practices/questions', {
    params: { categoryId, count },
  })

/** 无状态快速判题（UC03 别名） */
export const submitPractice = (data: QuickPracticeForm) =>
  request.post<ApiResponse<QuickPracticeResult>>('/practice/submit', data)

/** 开始一次练习会话 —— POST /practices/start/{categoryId} */
export const startPractice = (categoryId: number) =>
  request.post<ApiResponse<PracticeRecord>>(`/practices/start/${categoryId}`)

/** 练习中提交单题答案 */
export const answerInPractice = (practiceId: number, data: PracticeAnswerForm) =>
  request.post<ApiResponse<QuickPracticeResult>>(
    `/practices/${practiceId}/answers`,
    data
  )

/** 结束练习 */
export const finishPractice = (practiceId: number) =>
  request.post<ApiResponse<PracticeRecord>>(`/practices/${practiceId}/finish`)

/** 练习详情 */
export const getPracticeDetail = (id: number) =>
  request.get<ApiResponse<PracticeRecord>>(`/practices/${id}`)

/** 分页查询练习记录 */
export interface PracticeListQuery extends PageQuery {
  categoryId?: number
  status?: number
}
export const listPractices = (params: PracticeListQuery) =>
  request.get<ApiResponse<PageResult<PracticeRecord>>>('/practices', { params })

/* ============================================================ *
 *  4. 考试流程（三段式）
 * ============================================================ */

/** 获取可参加的考试 */
export const getAvailableExams = () =>
  request.get<ApiResponse<AvailableExam[]>>('/exams/available')

/** 开始考试（幂等，重复调用返回同一 examRecord） */
export const startExam = (sessionId: number) =>
  request.post<ApiResponse<ExamRecord>>(`/exams/start/${sessionId}`)

/** 加载试卷题目（隐答案 + 已保存答案） */
export const getExamQuestions = (examId: number) =>
  request.get<ApiResponse<ExamPaperView>>(`/exams/${examId}/questions`)

/** 保存单题答案 —— POST /exams/{examId}/answers */
export const saveAnswer = (examId: number, data: SaveAnswerForm) =>
  request.post<ApiResponse<void>>(`/exams/${examId}/answers`, data)

/** 保存单题答案 别名路径（UC04）—— POST /exams/save-answer */
export const saveAnswerAlias = (data: SaveAnswerForm & { examId: number }) =>
  request.post<ApiResponse<void>>('/exams/save-answer', data)

/** 提交考试（幂等，返回成绩+明细） */
export const submitExam = (examId: number) =>
  request.post<ApiResponse<ExamRecord>>(`/exams/${examId}/submit`)

/** 提交考试 别名路径（UC05） */
export const submitExamAlias = (examId: number) =>
  request.post<ApiResponse<ExamRecord>>('/exams/submit', null, {
    params: { examId },
  })

/** 断点续考 —— POST /exams/{examId}/resume */
export const resumeExam = (examId: number) =>
  request.post<ApiResponse<ExamPaperView>>(`/exams/${examId}/resume`)

/** 查看考试记录详情 */
export const getExamRecord = (examId: number) =>
  request.get<ApiResponse<ExamRecord>>(`/exams/${examId}`)

/* ============================================================ *
 *  5. 学生成绩（UC07）
 * ============================================================ */

/** 我的汇总 */
export const getMySummary = () =>
  request.get<ApiResponse<ResultSummary>>('/results/my-summary')

/** 我的成绩列表 */
export interface MyResultQuery extends PageQuery {
  keyword?: string
}
export const getMyResults = (params: MyResultQuery) =>
  request.get<ApiResponse<PageResult<ExamResultItem>>>('/results/my-list', { params })

/** 成绩明细 */
export const getResultDetail = (resultId: number) =>
  request.get<ApiResponse<ResultDetail>>(`/results/${resultId}/detail`)

/** 错题本（合并考试+练习错题，按题目去重） */
export const getWrongBook = (params?: WrongBookQuery) =>
  request.get<ApiResponse<PageResult<WrongBookItem>>>('/results/wrong-book', { params })

/** 错题重做题目列表（不含答案） */
export const getRedoQuestions = (params?: { categoryId?: number; count?: number }) =>
  request.get<ApiResponse<Question[]>>('/results/wrong-book/redo', { params })

/* ============================================================ *
 *  6. 学生个人多维度统计
 * ============================================================ */

/**
 * 学生个人多维度统计 —— GET /api/students/{id}/statistics
 * @param id 学生 ID
 * @param include 逗号分隔的模块：basic,exam,practice,wrong,category,difficulty,tag,training
 *                不传或空字符串返回全部。
 */
export const getStudentStatistics = (id: number, include?: string) =>
  request.get<ApiResponse<StudentStatistics>>(`/students/${id}/statistics`, {
    params: include ? { include } : undefined,
  })

/**
 * 单场考试多维度对错分析 —— GET /api/students/exams/{examId}/dimension-analysis
 * 返回该场考试按考点标签/语法大类/难度/题型 的对错统计。
 */
export const getDimensionAnalysis = (examId: number) =>
  request.get<ApiResponse<DimensionAnalysis>>(`/students/exams/${examId}/dimension-analysis`)

/** 查询学生的训练时间设置 */
export const getTrainingSchedule = (id: number) =>
  request.get<ApiResponse<TrainingSchedule>>(`/students/${id}/training-schedule`)

/** 修改学生的训练时间设置（只传变更字段） */
export const updateTrainingSchedule = (id: number, data: Partial<TrainingSchedule>) =>
  request.put<ApiResponse<TrainingSchedule>>(`/students/${id}/training-schedule`, data)

/* ============================================================ *
 *  7. 学习进度
 * ============================================================ */

/** 获取当前用户学习进度 */
export const getMyLearningProgress = () =>
  request.get<ApiResponse<LearningProgress[]>>('/learning-progress/me')

/** 获取当前用户指定分类进度 */
export const getMyProgressByCategory = (categoryId: number) =>
  request.get<ApiResponse<LearningProgress>>(`/learning-progress/me/category/${categoryId}`)

/** 获取薄弱分类 */
export const getWeakCategories = (limit = 5) =>
  request.get<ApiResponse<LearningProgress[]>>('/learning-progress/me/weak', {
    params: { limit },
  })

/** 获取掌握较好的分类 */
export const getStrongCategories = (limit = 5) =>
  request.get<ApiResponse<LearningProgress[]>>('/learning-progress/me/strong', {
    params: { limit },
  })

/** 重置指定分类进度 */
export const resetProgress = (categoryId: number) =>
  request.post<ApiResponse<void>>(`/learning-progress/me/category/${categoryId}/reset`)

/* ============================================================ *
 *  8. 消息通知
 * ============================================================ */

/** 获取我的通知列表 */
export const getMyNotifications = (params?: { pageIndex?: number; pageSize?: number }) =>
  request.get<ApiResponse<PageResult<Notification>>>('/notifications', { params })

/** 获取未读通知数量 */
export const getUnreadCount = () =>
  request.get<ApiResponse<{ count: number }>>('/notifications/unread-count')

/** 标记全部已读 */
export const markAllRead = () =>
  request.post<ApiResponse<void>>('/notifications/mark-all-read')

/** 标记单条已读 */
export const markNotificationRead = (id: number) =>
  request.post<ApiResponse<void>>(`/notifications/${id}/mark-read`)

/* ============================================================ *
 *  9. 学生排行榜
 * ============================================================ */

/** 获取学生排行榜 */
export const getLeaderboard = (limit?: number) =>
  request.get<ApiResponse<LeaderboardItem[]>>('/leaderboard', { params: { limit } })

/** 获取我的排名 */
export const getMyRank = () =>
  request.get<ApiResponse<MyRank>>('/leaderboard/my-rank')
