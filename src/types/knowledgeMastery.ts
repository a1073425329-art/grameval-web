/** 知识点掌握度 */
export interface KnowledgeMastery {
  id: number
  userId: number
  studentName?: string
  tagId: number
  tagName?: string
  categoryName?: string
  totalAnswers: number
  correctCount: number
  accuracy?: number
  masteryLevel: 0 | 1 | 2 | 3 | 4 | 5
  masteryLevelLabel?: string
  consecutiveCorrect: number
  maxConsecutiveCorrect: number
  lastPracticeTime?: string
  lastCorrectTime?: string
  proficiencyScore?: number
  weakPointCount: number
  recommendedNextLevel?: number
  studySuggestions?: string
  createTime: string
  updateTime?: string
}
