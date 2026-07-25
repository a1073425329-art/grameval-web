/** 分数曲线 */
export interface ScoreCurve {
  id: number
  userId: number
  studentName?: string
  paperId: number
  paperName?: string
  sessionId?: number
  sessionName?: string
  examId?: number
  score: number
  totalScore: number
  scorePercentage?: number
  examDate: string
  classRank?: number
  gradeRank?: number
  classAvgScore?: number
  gradeAvgScore?: number
  progressAmount?: number
  examName?: string
  createTime: string
}
