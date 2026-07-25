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
  categoryId?: number
  title?: string
  content: string
  difficulty: Difficulty
  passageType?: string
  topic?: string
  source?: string
  summary?: string
  status?: 0 | 1
  isTemp?: boolean
  aiPrompt?: string
  questions?: ReadingQuestionItem[]
}

export interface ReadingQuestionItem {
  stem: string
  standardAnswer: string
  analysis?: string
  knowledgePoints?: string[]
  options?: QuestionOption[]
  defaultScore?: number
}

export type ReadingPassagePageResult = PageResult<ReadingPassage>
