/** 题目版本 */
export interface QuestionVersion {
  id: number
  questionId: number
  questionStem?: string
  versionNo: number
  changes: string
  changeReason?: string
  changedBy: number
  changedByName?: string
  changedTime: string
  isActive: boolean
  snapshot?: string
}
