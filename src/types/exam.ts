import type { QuestionType, Difficulty } from './common'

/**
 * 考试场次（Session）—— 对齐后端 SessionVO
 * 后端把"考试"称为 session；管理端专用操作路径叫 exams
 */
export interface ExamSession {
  id: number
  paperId: number
  paperName?: string
  sessionName: string
  startTime: string
  endTime: string
  duration: number
  answerPublishTime?: string
  maxAttempts?: number
  showScoreImmediately?: boolean
  /** 0草稿 / 1已发布 / 2已结束 */
  status: 0 | 1 | 2
  createBy?: number
  createTime?: string
  updateTime?: string
  attendedCount?: number
}

/** 场次创建/更新请求 —— 对齐后端 SessionRequest */
export interface SessionForm {
  paperId: number
  sessionName: string
  startTime: string
  endTime: string
  duration: number
  answerPublishTime?: string
  maxAttempts?: number
  showScoreImmediately?: boolean
  status?: 0 | 1 | 2
}

/**
 * 学生端"可参加的考试" —— SessionVO
 * （前端沿用 Exam 语义，后端返回结构同 SessionVO）
 */
export type AvailableExam = ExamSession

/**
 * 加载试卷的响应 —— 对齐后端 ExamPaperViewVO
 * 关键：扁平结构，questions 直接挂顶层
 */
export interface ExamPaperView {
  examId: number
  sessionId: number
  sessionName: string
  paperId: number
  paperName: string
  totalScore: number
  duration: number
  deadline: string
  remainingSeconds: number
  resumeCount: number
  answeredCount: number
  questions: ExamQuestion[]
}

/** 考试中的试题（隐藏 standardAnswer） */
export interface ExamQuestion {
  questionId: number
  questionType: QuestionType
  stem: string
  difficulty: Difficulty
  questionScore: number
  questionOrder: number
  options: Array<{
    id?: number
    optionLabel: string
    optionContent: string
    sortNo: number
  }>
  /** 学生已保存的答案（断点续答回填） */
  userAnswer?: string
  /** 阅读理解特有：文章 ID（前端可据此聚合渲染） */
  passageId?: number
  /** 阅读理解题：文章内容（如果后端返回） */
  passage?: {
    id: number
    title?: string
    content: string
  }
  /** 兼容旧字段 */
  passageTempId?: string
}

/** 保存答案 —— POST /exams/{examId}/answers */
export interface SaveAnswerForm {
  questionId: number
  userAnswer: string
  remainingSeconds?: number
}

/** 保存答案别名路径 —— POST /exams/save-answer */
export interface SaveAnswerAliasForm {
  examId: number
  questionId: number
  userAnswer: string
  remainingSeconds?: number
}

/**
 * 开始考试 / 断点续考的响应 —— ExamRecordVO
 * （前端在拿到 id 后传给 GET /exams/{examId}/questions）
 */
export interface ExamRecord {
  id: number
  sessionId: number
  userId: number
  startTime: string
  submitTime?: string
  durationSeconds?: number
  /** 0进行中 / 1已提交 / 2超时提交 */
  submitStatus: 0 | 1 | 2
  submitStatusText?: string
  remainingSeconds?: number
  resumeCount?: number
  totalScore?: number
  scorePercentage?: number
  correctCount?: number
  wrongCount?: number
  answers?: AnswerDetail[]
  sessionName?: string
  paperName?: string
  username?: string
  realName?: string
  englishName?: string
}

/** 逐题答题明细 */
export interface AnswerDetail {
  questionId: number
  stem: string
  questionType: QuestionType
  options?: Array<{
    optionLabel: string
    optionContent: string
    sortNo: number
  }>
  userAnswer?: string
  standardAnswer?: string
  /** 1对 0错 null未阅卷 */
  isCorrect?: 0 | 1 | null
  obtainedScore?: number
  analysis?: string
  difficulty?: Difficulty
  questionScore?: number
  questionOrder?: number
}
