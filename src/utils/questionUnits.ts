import type { AnswerDetail, AnswerUnit, ExamQuestion, ExamQuestionUnit } from '@/types/exam'
import type { Question } from '@/types/question'
import type { QuestionUnit } from '@/types/reading'

export interface ExamQuestionItem extends ExamQuestion {
  passageId?: number | undefined
  passageTitle?: string | undefined
  passageContent?: string | undefined
  passageWordCount?: number | undefined
  readingGroupScore?: number | undefined
  readingGroupSize?: number | undefined
}

export interface AnswerReviewItem extends AnswerDetail {
  passageId?: number | undefined
  passageTitle?: string | undefined
  passageContent?: string | undefined
  passageWordCount?: number | undefined
  readingGroupScore?: number | undefined
  readingGroupObtainedScore?: number | undefined
  readingGroupSize?: number | undefined
}

export const flattenExamQuestionUnits = (units: ExamQuestionUnit[]): ExamQuestionItem[] =>
  units.flatMap((unit): ExamQuestionItem[] => {
    if (unit.unitType === 'READING') {
      return (unit.subQuestions ?? []).map((question) => ({
        ...question,
        passageId: unit.passageId,
        passageTitle: unit.passageTitle,
        passageContent: unit.passageContent,
        passageWordCount: unit.passageWordCount,
        readingGroupScore: unit.questionScore,
        readingGroupSize: unit.subQuestionCount ?? unit.subQuestions?.length ?? 0,
      }))
    }
    return unit.questionId == null ? [] : [{ ...unit, questionId: unit.questionId } as ExamQuestionItem]
  })

export const flattenAnswerUnits = (units: AnswerUnit[]): AnswerReviewItem[] =>
  units.flatMap((unit): AnswerReviewItem[] => {
    if (unit.unitType === 'READING') {
      return (unit.subQuestions ?? []).map((answer) => ({
        ...answer,
        passageId: unit.passageId,
        passageTitle: unit.passageTitle,
        passageContent: unit.passageContent,
        passageWordCount: unit.passageWordCount,
        readingGroupScore: unit.questionScore,
        readingGroupObtainedScore: unit.obtainedScore,
        readingGroupSize: unit.subQuestionCount ?? unit.subQuestions?.length ?? 0,
      }))
    }
    return unit.questionId == null ? [] : [{ ...unit, questionId: unit.questionId } as AnswerReviewItem]
  })
export type PracticeQuestionItem = Question & {
  readingGroupScore?: number | undefined
  readingGroupSize?: number | undefined
  readingGroupIndex?: number | undefined
}

export const flattenPracticeQuestionUnits = (units: QuestionUnit[]): PracticeQuestionItem[] =>
  units.flatMap((unit): PracticeQuestionItem[] => {
    if (unit.unitType === 'READING' && unit.passage) {
      const passage = unit.passage
      const children = passage.questions ?? []
      return children.map((question, index) => {
        const extra: {
          passageId?: number
          passageTitle?: string
          passageContent?: string
          passageWordCount?: number
          readingGroupScore?: number
          readingGroupSize?: number
          readingGroupIndex?: number
        } = {
          readingGroupSize: passage.questionCount ?? children.length,
          readingGroupIndex: index + 1,
        }
        if (passage.id != null) extra.passageId = passage.id
        if (passage.title != null) extra.passageTitle = passage.title
        if (passage.content != null) extra.passageContent = passage.content
        if (passage.wordCount != null) extra.passageWordCount = passage.wordCount
        if (passage.totalScore != null) extra.readingGroupScore = passage.totalScore
        return { ...question, ...extra }
      })
    }
    return unit.question ? [{ ...unit.question }] : []
  })
