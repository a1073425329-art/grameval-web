/** 知识点掌握度 */
export interface KnowledgeMastery {
  id: number
  userId: number
  studentName?: string
  tagId: number
  tagName?: string
  /**
   * [2026-10-30] 语法分类 ID —— 按分类分页签用。
   * 注意不能用 categoryName 当分组键：grammar_category 里存在重名
   * （实测「同根词词性转换」有 2 个不同 id）。
   */
  categoryId?: number | null
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

/**
 * 知识点学习画像（扩展统计） —— 对齐后端 KnowledgeInsightsVO
 * GET /api/knowledge-mastery/student/{userId}/insights
 *
 * [2026-10-30] 全部实时聚合，数据库无统计列。
 */
export interface KnowledgeInsights {
  /** 覆盖率：已统计知识点 / 启用标签总数 */
  coverage: {
    covered: number
    totalActive: number
    percent: number
    neverTouched: number
  }
  /** 掌握等级分布（0-5 全档） */
  levelDistribution: Array<{ level: number; label: string; count: number; percent: number }>
  /** 熟练度分档（5 档） */
  scoreBands: Array<{ band: string; label: string; count: number }>
  /** 练习活跃度 */
  activity: { within7: number; within30: number; older: number; never: number }
  /** 薄弱标记 Top 10 */
  weakTop: Array<{
    tagId: number
    tagName: string
    categoryName?: string
    weakPointCount: number
    accuracy?: number
    proficiencyScore?: number
    masteryLevel: number
  }>
  /** 升级路径：距下一级还差多少分 */
  upgradePath: Array<{
    tagId: number
    tagName: string
    currentLevel: number
    currentLabel: string
    nextLevel: number
    nextLabel: string
    scoreGap: number
    proficiencyScore?: number
  }>
  /** 近期（30天） vs 历史正确率；delta 为正表示进步 */
  trend: Array<{
    tagId: number
    tagName: string
    recentAnswers: number
    recentAccuracy: number | null
    overallAccuracy: number
    delta: number | null
  }>
  /** 知识点 × 题型表现 */
  typeMatrix: Array<{
    tagId: number
    tagName: string
    cells: Array<{ questionType: string; label: string; total: number; correct: number; accuracy: number }>
  }>
}
