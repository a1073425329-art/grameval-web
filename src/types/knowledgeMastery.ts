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
  // [2026-10-28 清除] 后端 knowledge_mastery.consecutive_correct / max_consecutive_correct 列已删除，
  //   连对统计功能按用户拍板一并砍掉（原字段 consecutiveCorrect / maxConsecutiveCorrect 移除，
  //   消费它的「连续正确」列同步删除）。熟练度公式改为 accuracy*70 + volume*30，不再依赖连对。
  lastPracticeTime?: string
  lastCorrectTime?: string
  proficiencyScore?: number
  weakPointCount: number
  recommendedNextLevel?: number
  studySuggestions?: string
  createTime: string
  updateTime?: string
}
