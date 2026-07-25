/** 试卷模板 */
export interface PaperTemplate {
  id: number
  templateName: string
  description?: string
  questionConfig: string  // JSON: [{type, count, score, difficulty}]
  difficultyDistribution?: string  // JSON: {easy, medium, hard}
  knowledgeRequirements?: string  // JSON: [{tagId, tagName, count}]
  gradeLevel?: string
  totalScore: number
  duration?: number
  questionCount: number
  createBy: number
  creatorName?: string
  usageCount: number
  lastUsedTime?: string
  status: 0 | 1
  createTime: string
  updateTime?: string
}

export interface PaperTemplateForm {
  templateName: string
  description?: string
  questionConfig: string
  difficultyDistribution?: string
  knowledgeRequirements?: string
  gradeLevel?: string
  totalScore: number
  duration?: number
  questionCount?: number
  status?: 0 | 1
}
