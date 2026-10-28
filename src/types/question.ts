import type { Difficulty, QuestionType } from './common'

/**
 * 试题选项 —— 对齐后端 QuestionOption 表
 * 后端字段：optionLabel（A/B/C/D）+ optionContent
 */
export interface QuestionOption {
  id?: number
  optionLabel: string
  optionContent: string
  sortNo: number
}

/**
 * 试题 —— 对齐后端 QuestionVO
 * 字段变更（vs 之前）：
 *   type      → questionType
 *   content   → stem
 *   answer    → standardAnswer（一律大写，多选 A,B）
 *   options.key/text → optionLabel/optionContent
 *   difficulty: string → Integer 1/2/3
 */
export interface Question {
  id: number
  categoryId: number
  categoryName?: string
  questionType: QuestionType
  stem: string
  /** 标准答案。选择题类一律大写；填空类按 answerFormat 决定是否保留原样大小写 */
  standardAnswer?: string
  /**
   * 答案大小写要求（对齐后端 question.answer_format）：
   * CASE_INSENSITIVE(默认，忽略大小写) / CASE_SENSITIVE(区分大小写，仅填空类) /
   * WORD_ONLY(仅单词) / SENTENCE(整句)。选择题类恒为 CASE_INSENSITIVE。
   */
  answerFormat?: string
  analysis?: string
  /** 知识点标签列表 */
  knowledgePoints?: string[]
  difficulty: Difficulty
  defaultScore?: number
  status?: 0 | 1
  createBy?: number
  /** 创建人姓名（后端已按 realName → username 归一） */
  createByName?: string
  // [2026-10-28] 后端 question.usage_count 列已清除：**列表接口不再填值，单题详情接口仍返回实时计数**，
  // 故本字段按契约 #02 第 10 条保留（详情抽屉「引用 N 次」与详情弹窗「被引用 N 次」仍读它）。
  usageCount?: number
  /** 阅读理解题：所属文章 ID */
  passageId?: number
  /** 阅读文章标题（后端 passageId 非空时回填） */
  passageTitle?: string
  /** 阅读文章正文（后端 passageId 非空时回填） */
  passageContent?: string
  /** 阅读文章英文词数 */
  passageWordCount?: number
  /** 阅读文章中文翻译（可选） */
  passageTranslation?: string
  /** 阅读文章重点词汇 JSON 字符串（可选） */
  passageKeyVocabulary?: string
  /** 需要对多个作答位（多选、或多空阅读题）—— 决定渲染单选框还是复选框 */
  multiAnswer?: boolean
  // [2026-10-28] 后端 question.blank_count 列已清除，原同名字段删除（值由 AnswerJudge 从标准答案形态现算）
  /** 计分方式：FULL(全对才给分) / PARTIAL(多空按答对空数比例给分) */
  scoreType?: string
  /** 阅读子题型：DETAIL/MAIN_IDEA/INFERENCE/VOCABULARY/ATTITUDE */
  questionSubtype?: string
  /** 本题在所属文章题组中的题序 */
  passageQuestionOrder?: number
  hintText?: string
  createTime?: string
  updateTime?: string
  tagIds?: number[]
  primaryTagId?: number
  tags?: Array<{ tagId: number; tagName: string; isPrimary?: boolean }>
  options?: QuestionOption[]
}

/** 试题新增/编辑请求 —— 对齐后端 QuestionRequest
 * （请求 DTO, 可选字段放宽 undefined, 见 src/api/admin.ts 顶部说明） */
export interface QuestionForm {
  categoryId: number
  questionType: QuestionType
  stem: string
  standardAnswer: string
  /** 答案大小写要求：CASE_INSENSITIVE(默认)/CASE_SENSITIVE/WORD_ONLY/SENTENCE（仅填空类有意义） */
  answerFormat?: string | undefined
  analysis?: string | undefined
  /** 知识点标签列表 */
  knowledgePoints?: string[] | undefined
  difficulty: Difficulty
  defaultScore?: number | undefined
  status?: 0 | 1 | undefined
  passageId?: number | undefined
  /** 括号提示词（FILL_HINT） */
  hintText?: string | undefined
  /** 阅读子题型（仅 READING 有意义） */
  questionSubtype?: string | undefined
  /** 计分方式：FULL(全对才给分) / PARTIAL(多空题逐空给分)，仅多空题有意义 */
  scoreType?: string | undefined
  /** 考点标签 ID 列表 */
  tagIds?: number[] | undefined
  /** 主考点标签 ID */
  primaryTagId?: number | undefined
  options?: Array<{
    optionLabel: string
    optionContent: string
    sortNo: number
  }> | undefined
}

/** 无状态快速判题 —— POST /practice/submit（UC03 别名） */
export interface QuickPracticeForm {
  questionId: number
  userAnswer: string
}

/** 快速判题反馈 —— QuickPracticeResultVO */
export interface QuickPracticeResult {
  isCorrect: boolean
  userAnswer: string
  standardAnswer: string
  analysis?: string
}

/** 专项练习会话 —— PracticeVO */
export interface PracticeRecord {
  id: number
  userId: number
  categoryId: number
  categoryName?: string
  startTime: string
  finishTime?: string
  questionCount: number
  correctCount: number
  wrongCount: number
  accuracy?: number
  status: 0 | 1
}

/** 练习中提交单题答案 */
export interface PracticeAnswerForm {
  questionId: number
  userAnswer: string
}
