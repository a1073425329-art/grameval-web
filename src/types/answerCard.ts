/** 考试答题卡 */
export interface AnswerCard {
  id: number
  paperId?: number
  paperName?: string
  cardName?: string
  questionOrderConfig?: string  // JSON: {orderBy, typeOrder}
  styleConfig?: string  // JSON: {bgColor, fontSize, optionLayout}
  isDefault: boolean
  createBy?: number
  createTime: string
  updateTime?: string
}

export interface AnswerCardForm {
  paperId?: number | undefined
  cardName?: string | undefined
  questionOrderConfig?: string | undefined
  styleConfig?: string | undefined
  isDefault?: boolean | undefined
}
