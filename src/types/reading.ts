import type { Difficulty, PageResult } from './common'
import type { Question, QuestionOption } from './question'

/** 重点词汇项 */
export interface VocabularyItem {
  word: string
  phonetic?: string
  meaning: string
}

export interface ReadingPassage {
  id: number
  categoryId?: number
  categoryName?: string
  title?: string
  content: string
  wordCount?: number
  difficulty: Difficulty
  passageType?: string
  topic?: string
  source?: string
  summary?: string
  /** 全文中文翻译（可选） */
  translation?: string
  /** 重点词汇 */
  keyVocabulary?: VocabularyItem[]
  /** 文章级知识点标签 */
  knowledgePoints?: string[]
  questionCount?: number
  totalScore?: number
  usageCount?: number
  status?: 0 | 1
  isTemp?: boolean
  createBy?: number
  createByName?: string
  aiPrompt?: string
  createTime?: string
  updateTime?: string
  questions?: Question[]
}

export interface QuestionUnit {
  unitType: 'QUESTION' | 'READING'
  question?: Question
  passage?: ReadingPassage
}

export interface ReadingPassageForm {
  categoryId?: number | undefined
  title?: string | undefined
  content: string
  difficulty: Difficulty
  passageType?: string | undefined
  topic?: string | undefined
  source?: string | undefined
  summary?: string | undefined
  translation?: string | undefined
  keyVocabulary?: VocabularyItem[] | undefined
  knowledgePoints?: string[] | undefined
  status?: 0 | 1 | undefined
  isTemp?: boolean | undefined
  aiPrompt?: string | undefined
  questions?: ReadingQuestionItem[] | undefined
}

export interface ReadingQuestionItem {
  stem: string
  standardAnswer: string
  analysis?: string
  knowledgePoints?: string[]
  options?: QuestionOption[]
  defaultScore?: number
  /** 阅读子题型：DETAIL/MAIN_IDEA/INFERENCE/VOCABULARY/ATTITUDE */
  questionSubtype?: string | undefined
  /** 计分方式：FULL / PARTIAL（PARTIAL = 多空题按答对空数比例给分） */
  scoreType?: string | undefined
}

export type ReadingPassagePageResult = PageResult<ReadingPassage>
