export interface LearningProgress {
  id: number
  userId: number
  categoryId: number
  categoryName?: string
  completedCount: number
  correctCount: number
  totalCount: number
  masteryLevel: number
  accuracy: number
  lastStudyTime?: string
}
