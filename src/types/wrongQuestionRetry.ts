/** 错题重做记录 */
export interface WrongQuestionRetry {
  id: number
  wrongBookId: number
  questionStem?: string
  retryNumber: number
  userAnswer?: string
  correctAnswer?: string
  isCorrect?: number
  timeSpentSeconds?: number
  retryTime: string
  correctionMethod?: string
  correctionMethodLabel?: string
  correctionNote?: string
  sourceType?: string
}

export interface WrongQuestionRetryForm {
  wrongBookId: number
  userAnswer: string
  timeSpentSeconds?: number
  correctionMethod?: string
  correctionNote?: string
  sourceType?: string
  sourceId?: number
}
