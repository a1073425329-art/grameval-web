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
import type { MessageNotification, UnreadCount, MessageQuery, NotificationPreference, UnreadCountByCategory } from '@/types/notification'
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
 *  8. 消息中心（企业级）
 * ============================================================ */

/** 登录时触发消息计算 */
export const calculateMessages = () =>
  request.post<ApiResponse<UnreadCount>>('/notifications/calculate')

/** 消息列表（多维度过滤） */
export const getMyNotifications = (params?: MessageQuery) =>
  request.get<ApiResponse<PageResult<MessageNotification>>>('/notifications', { params })

/** 未读总数 + 紧急数 */
export const getUnreadCount = () =>
  request.get<ApiResponse<UnreadCount>>('/notifications/unread-count')

/** 按分类未读数 */
export const getUnreadCountByCategory = () =>
  request.get<ApiResponse<UnreadCountByCategory>>('/notifications/unread-count-by-category')

/** 标记已读 */
export const markNotificationRead = (id: number) =>
  request.put<ApiResponse<void>>(`/notifications/${id}/read`)

/** 标记未读 */
export const markNotificationUnread = (id: number) =>
  request.put<ApiResponse<void>>(`/notifications/${id}/unread`)

/** 切换收藏 */
export const toggleStar = (id: number) =>
  request.put<ApiResponse<void>>(`/notifications/${id}/star`)

/** 切换置顶 */
export const togglePin = (id: number) =>
  request.put<ApiResponse<void>>(`/notifications/${id}/pin`)

/** 归档 */
export const archiveNotification = (id: number) =>
  request.put<ApiResponse<void>>(`/notifications/${id}/archive`)

/** 取消归档 */
export const unarchiveNotification = (id: number) =>
  request.put<ApiResponse<void>>(`/notifications/${id}/unarchive`)

/** 删除（软删除） */
export const deleteNotification = (id: number) =>
  request.delete<ApiResponse<void>>(`/notifications/${id}`)

/** 全部已读 */
export const markAllRead = () =>
  request.put<ApiResponse<number>>('/notifications/mark-all-read')

/** 批量已读 */
export const batchMarkRead = (ids: number[]) =>
  request.put<ApiResponse<number>>('/notifications/batch-read', { ids })

/** 批量删除 */
export const batchDeleteNotifications = (ids: number[]) =>
  request.post<ApiResponse<number>>('/notifications/batch-delete', { ids })

/** 批量归档 */
export const batchArchiveNotifications = (ids: number[]) =>
  request.post<ApiResponse<number>>('/notifications/batch-archive', { ids })

/** 获取通知偏好 */
export const getNotificationPreferences = () =>
  request.get<ApiResponse<NotificationPreference>>('/notifications/preferences')

/** 更新通知偏好 */
export const updateNotificationPreferences = (data: Partial<NotificationPreference>) =>
  request.put<ApiResponse<NotificationPreference>>('/notifications/preferences', data)

/** 记录操作 */
export const recordNotificationAction = (id: number) =>
  request.post<ApiResponse<void>>(`/notifications/${id}/action`)

/** 提交反馈 */
export const submitNotificationFeedback = (id: number, rating: number, feedback?: string) =>
  request.put<ApiResponse<void>>(`/notifications/${id}/feedback`, { rating, feedback })

/** 更新反应 */
export const updateNotificationReaction = (id: number, reaction: string) =>
  request.put<ApiResponse<void>>(`/notifications/${id}/reaction`, { reaction })

/** 消息统计面板 */
export const getNotificationStats = () =>
  request.get<ApiResponse<any>>('/notifications/stats')

/** 获取线程/对话 */
export const getNotificationThread = (threadId: number) =>
  request.get<ApiResponse<MessageNotification[]>>(`/notifications/thread/${threadId}`)

/** 投递日志 */
export const getDeliveryLogs = (page?: number, size?: number) =>
  request.get<ApiResponse<any>>('/notifications/delivery-logs', { params: { page, size } })

/** 广播给全平台 */
export const broadcastNotification = (data: { title: string; content: string; summary?: string; priority?: number; actionUrl?: string; expireTime?: string }) =>
  request.post<ApiResponse<number>>('/notifications/broadcast', data)

/** 按角色广播 */
export const broadcastByRole = (data: { role: string; title: string; content: string; priority?: number }) =>
  request.post<ApiResponse<number>>('/notifications/broadcast-role', data)

/* ============================================================ *
 *  9. 学生排行榜
 * ============================================================ */

/** 获取学生排行榜 */
export const getLeaderboard = (limit?: number) =>
  request.get<ApiResponse<LeaderboardItem[]>>('/leaderboard', { params: { limit } })

/** 获取我的排名 */
export const getMyRank = () =>
  request.get<ApiResponse<MyRank>>('/leaderboard/my-rank')

/* ============================================================ *
 *  10. 学习笔记
 * ============================================================ */

export interface StudyNote {
  id: number
  userId: number
  questionId?: number
  categoryId?: number
  title: string
  content: string
  noteType: 'QUESTION' | 'KNOWLEDGE' | 'REVIEW' | 'OTHER'
  tags: string
  isPublic: boolean
  viewsCount: number
  createTime: string
  updateTime?: string
}

export interface StudyNoteQuery extends PageQuery {
  noteType?: string
  categoryId?: number
  questionId?: number
  keyword?: string
}

/** 创建学习笔记 */
export const createStudyNote = (data: Omit<StudyNote, 'id' | 'userId' | 'viewsCount' | 'createTime' | 'updateTime'>) =>
  request.post<ApiResponse<StudyNote>>('/study-notes', data)

/** 更新学习笔记 */
export const updateStudyNote = (id: number, data: Partial<Omit<StudyNote, 'id' | 'userId' | 'viewsCount' | 'createTime'>>) =>
  request.put<ApiResponse<StudyNote>>(`/study-notes/${id}`, data)

/** 删除学习笔记 */
export const deleteStudyNote = (id: number) =>
  request.delete<ApiResponse<void>>(`/study-notes/${id}`)

/** 获取学习笔记详情 */
export const getStudyNote = (id: number) =>
  request.get<ApiResponse<StudyNote>>(`/study-notes/${id}`)

/** 分页查询我的笔记 */
export const listMyNotes = (params: StudyNoteQuery) =>
  request.get<ApiResponse<PageResult<StudyNote>>>('/study-notes/my-list', { params })

/** 获取公开笔记 */
export const listPublicNotes = (params: StudyNoteQuery & { userId?: number }) =>
  request.get<ApiResponse<PageResult<StudyNote>>>('/study-notes/public', { params })

/* ============================================================ *
 *  11. 学习打卡与目标
 * ============================================================ */

/** 学习打卡 */
export const checkIn = () =>
  request.post<ApiResponse<any>>('/users/check-in')

/** 获取我的资料 */
export const getMyProfile = () =>
  request.get<ApiResponse<any>>('/users/my-profile')

/** 更新我的资料 */
export const updateMyProfile = (data: Partial<any>) =>
  request.put<ApiResponse<any>>('/users/my-profile', data)

/* ============================================================ *
 *  12. 徽章系统
 * ============================================================ */

export interface UserBadge {
  id: number
  userId: number
  badgeCode: string
  badgeName: string
  icon: string
  earnedTime: string
  earnedDescription: string
}

/** 获取我的徽章列表 */
export const getMyBadges = () =>
  request.get<ApiResponse<UserBadge[]>>('/badges/my-badges')

/** 获取所有徽章定义 */
export const getAllBadges = () =>
  request.get<ApiResponse<any[]>>('/badges/all')

/* ============================================================ *
 *  13. 学习周报
 * ============================================================ */

export interface StudyWeeklyReport {
  id: number
  userId: number
  weekStart: string
  weekEnd: string
  totalStudyDays: number
  totalQuestionsDone: number
  totalCorrectCount: number
  accuracyRate: number
  studyHours: number
  categoryStats: Array<{
    categoryId: number
    categoryName: string
    questionsDone: number
    accuracy: number
  }>
  weakCategories: number[]
  strongCategories: number[]
  suggestions: string
  reportUrl?: string
  generatedAt: string
}

/** 获取本周周报 */
export const getWeeklyReport = () =>
  request.get<ApiResponse<StudyWeeklyReport>>('/weekly-report/current')

/** 获取历史周报列表 */
export const listWeeklyReports = (params?: PageQuery) =>
  request.get<ApiResponse<PageResult<StudyWeeklyReport>>>('/weekly-report/list', { params })

/** 生成周报 */
export const generateWeeklyReport = () =>
  request.post<ApiResponse<StudyWeeklyReport>>('/weekly-report/generate')

/* ============================================================ *
 *  14. AI学习助手
 * ============================================================ */

export interface ChatMessage {
  id: number
  userId: number
  role: 'USER' | 'ASSISTANT'
  content: string
  messageType: 'TEXT' | 'IMAGE' | 'DOCUMENT'
  createTime: string
}

export interface ChatSession {
  id: number
  userId: number
  title: string
  messageCount: number
  lastMessage?: string
  lastTime: string
  createTime: string
}

/** 创建聊天会话 */
export const createChatSession = (title?: string) =>
  request.post<ApiResponse<ChatSession>>('/assistant/sessions', { title })

/** 获取聊天会话列表 */
export const listChatSessions = () =>
  request.get<ApiResponse<ChatSession[]>>('/assistant/sessions')

/** 获取会话详情 */
export const getChatSession = (sessionId: number) =>
  request.get<ApiResponse<ChatSession>>(`/assistant/sessions/${sessionId}`)

/** 删除会话 */
export const deleteChatSession = (sessionId: number) =>
  request.delete<ApiResponse<void>>(`/assistant/sessions/${sessionId}`)

/** 获取会话消息列表 */
export const listChatMessages = (sessionId: number) =>
  request.get<ApiResponse<ChatMessage[]>>(`/assistant/sessions/${sessionId}/messages`)

/** 发送消息 */
export const sendChatMessage = (sessionId: number, content: string) =>
  request.post<ApiResponse<ChatMessage>>(`/assistant/sessions/${sessionId}/messages`, { content })

/* ============================================================ *
 *  15. 学习小组
 * ============================================================ */

export interface StudyGroup {
  id: number
  groupName: string
  description: string
  avatar?: string
  maxMembers: number
  memberCount: number
  status: 'ACTIVE' | 'INACTIVE'
  createTime: string
}

export interface GroupMember {
  id: number
  groupId: number
  userId: number
  username: string
  realName: string
  avatar?: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
  joinTime: string
}

/** 创建学习小组 */
export const createStudyGroup = (data: { groupName: string; description?: string; maxMembers?: number }) =>
  request.post<ApiResponse<StudyGroup>>('/study-groups', data)

/** 获取我的小组列表 */
export const listMyGroups = () =>
  request.get<ApiResponse<StudyGroup[]>>('/study-groups/my-groups')

/** 获取小组详情 */
export const getStudyGroup = (groupId: number) =>
  request.get<ApiResponse<StudyGroup>>(`/study-groups/${groupId}`)

/** 更新小组信息 */
export const updateStudyGroup = (groupId: number, data: Partial<StudyGroup>) =>
  request.put<ApiResponse<StudyGroup>>(`/study-groups/${groupId}`, data)

/** 删除小组 */
export const deleteStudyGroup = (groupId: number) =>
  request.delete<ApiResponse<void>>(`/study-groups/${groupId}`)

/** 获取小组成员 */
export const listGroupMembers = (groupId: number) =>
  request.get<ApiResponse<GroupMember[]>>(`/study-groups/${groupId}/members`)

/** 加入小组 */
export const joinGroup = (groupId: number) =>
  request.post<ApiResponse<void>>(`/study-groups/${groupId}/join`)

/** 退出小组 */
export const leaveGroup = (groupId: number) =>
  request.post<ApiResponse<void>>(`/study-groups/${groupId}/leave`)

/** 搜索小组 */
export const searchGroups = (keyword: string) =>
  request.get<ApiResponse<StudyGroup[]>>('/study-groups/search', { params: { keyword } })
