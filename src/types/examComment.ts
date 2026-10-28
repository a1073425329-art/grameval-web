/** 考试评语 */
export interface ExamComment {
  id: number
  examId: number
  studentName?: string
  paperName?: string
  teacherId: number
  teacherName?: string
  commentType: 'OVERALL' | 'STRENGTHS' | 'IMPROVEMENT' | 'TARGET' | 'ENCOURAGEMENT'
  commentTypeLabel?: string
  content: string
  ratingLevel?: number
  isRead: boolean
  readTime?: string
  createTime: string
  updateTime?: string
}

export interface ExamCommentForm {
  examId: number
  commentType: string
  content: string
  ratingLevel?: number | undefined
}
