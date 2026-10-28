/** 试卷模板 */
export interface PaperTemplate {
  id: number
  templateName: string
  description?: string
  questionConfig: string  // JSON: [{type, count, score, difficulty}]
  difficultyDistribution?: string  // JSON: {easy, medium, hard}
  knowledgeRequirements?: string  // JSON: [{tagId, tagName, count}]
  gradeLevel?: string
  generateSource?: GenerateSource
  aiNotes?: string
  totalScore: number
  duration?: number
  questionCount: number
  createBy: number
  creatorName?: string
  // [2026-10-28] 后端 exam_paper_template.usage_count 列已清除（模板「N 次使用」展示功能砍掉），原同名字段删除
  lastUsedTime?: string
  status: 0 | 1
  createTime: string
  updateTime?: string
}

/** 题型配置行（表单结构化，提交前序列化为 questionConfig JSON） */
export interface QuestionConfigRow {
  type: string
  count: number
  score: number
  difficulty: number[]
}

/** 难度三档百分比（合计必须为 100） */
export interface DifficultyMix {
  easy: number
  medium: number
  hard: number
}

/** 生成源：题库抽题 / AI 造新题 / 混合 */
export type GenerateSource = 'BANK' | 'AI' | 'MIX'

export interface PaperTemplateForm {
  templateName: string
  description?: string
  questionConfig: string
  difficultyDistribution?: string
  knowledgeRequirements?: string
  gradeLevel?: string
  generateSource?: GenerateSource
  aiNotes?: string
  totalScore: number
  duration?: number
  questionCount?: number
  status?: 0 | 1
}
