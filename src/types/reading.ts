import type { Difficulty, PageResult } from './common'
import type { Question, QuestionOption } from './question'

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
  questionCount?: number
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

export interface ReadingPassageForm {
  categoryId?: number | undefined
  title?: string | undefined
  content: string
  difficulty: Difficulty
  passageType?: string | undefined
  topic?: string | undefined
  source?: string | undefined
  summary?: string | undefined
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
