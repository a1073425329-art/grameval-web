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
  /** 是否允许续考（断点恢复）：false=严格模式，离开后不可续考 */
  allowResume?: boolean
  /** 0草稿 / 1已发布 / 2已结束 */
  status: 0 | 1 | 2
  createBy?: number
  createTime?: string
  updateTime?: string
  attendedCount?: number
  assignedCount?: number
  submittedCount?: number
  averageScore?: number
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
  /** 是否允许续考（断点恢复）：false=严格模式，离开后不可续考 */
  allowResume?: boolean
  status?: 0 | 1 | 2
}

/**
 * 学生端"可参加的考试" —— SessionVO
 * （前端沿用 Exam 语义，后端返回结构同 SessionVO）
 * /api/exams/available 与 /api/exams/attended 都返回该结构。
 */
export type AvailableExam = ExamSession & {
  /** 当前学生是否已经开过该场考试 */
  attempted?: boolean
  /** 当前学生的考试记录 id（未开始为 undefined） */
  examRecordId?: number
  /** 提交状态 0进行中 1已提交 2超时提交 */
  submitStatus?: 0 | 1 | 2
  /** 学生本次得分（百分制），未出分为 undefined */
  myScore?: number
}

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
  /** 普通题数 + 阅读组内子题数 */
  questionCount: number
  /** 顶层独立题和阅读文章组的数量 */
  unitCount: number
  questions: ExamQuestionUnit[]
}

/** 考试中的试题（隐藏 standardAnswer） */
export interface ExamQuestionUnit {
  unitType: 'QUESTION' | 'READING'
  questionId?: number
  questionType: QuestionType
  stem?: string
  difficulty?: Difficulty
  /** 独立题分值或整篇阅读题组总分 */
  questionScore: number
  questionOrder: number
  options?: ExamQuestion['options']
  userAnswer?: string
  passageId?: number
  passageTitle?: string
  passageContent?: string
  passageWordCount?: number
  subQuestionCount?: number
  subQuestions?: ExamQuestion[]
}

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
  /** 需要对多个作答位（多选、或多空阅读题） */
  multiAnswer?: boolean
  /** 阅读子题型：DETAIL/MAIN_IDEA/INFERENCE/VOCABULARY/ATTITUDE */
  questionSubtype?: string
  /** 括号提示词（无选项阅读题的作答提示） */
  hintText?: string
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
  answers?: AnswerUnit[]
  sessionName?: string
  paperName?: string
  username?: string
  realName?: string
  englishName?: string
}

/** 逐题答题明细 */
export interface AnswerUnit extends Partial<AnswerDetail> {
  unitType: 'QUESTION' | 'READING'
  questionId?: number
  questionType: QuestionType
  passageId?: number
  passageTitle?: string
  passageContent?: string
  passageWordCount?: number
  subQuestionCount?: number
  correctCount?: number
  wrongCount?: number
  subQuestions?: AnswerDetail[]
}

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
  /** 答题用时（秒） */
  spentTimeSeconds?: number
  /** 是否标记：1已标记，0未标记 */
  markedFlag?: 0 | 1
  /** 修改次数 */
  modifyCount?: number
}
