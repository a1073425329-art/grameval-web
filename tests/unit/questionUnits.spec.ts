import { describe, expect, it } from 'vitest'
import {
  flattenAnswerUnits,
  flattenExamQuestionUnits,
  flattenPracticeQuestionUnits,
} from '@/utils/questionUnits'

describe('question unit projections', () => {
  it('flattens reading children for answer identity while retaining passage and group score', () => {
    const questions = flattenExamQuestionUnits([
      {
        unitType: 'QUESTION', questionId: 10, questionType: 'SINGLE', stem: 'Standalone',
        difficulty: 1, questionScore: 4, questionOrder: 1,
        options: [],
      },
      {
        unitType: 'READING', questionType: 'READING', questionScore: 5, questionOrder: 2,
        passageId: 200, passageTitle: 'Article', passageContent: 'Text', subQuestionCount: 2,
        subQuestions: [
          { questionId: 101, questionType: 'SINGLE', stem: 'First', difficulty: 2, questionScore: 2, questionOrder: 2, options: [] },
          { questionId: 102, questionType: 'READING', stem: 'Second', difficulty: 3, questionScore: 3, questionOrder: 3, options: [] },
        ],
      },
    ])

    expect(questions.map((question) => question.questionId)).toEqual([10, 101, 102])
    expect(questions[1]).toMatchObject({
      passageId: 200,
      passageTitle: 'Article',
      readingGroupScore: 5,
      readingGroupSize: 2,
    })
    expect(questions[2]?.questionScore).toBe(3)
  })

  it('retains passage group totals alongside each answer score', () => {
    const answers = flattenAnswerUnits([
      {
        unitType: 'READING', questionType: 'READING', passageId: 200,
        passageTitle: 'Article', questionScore: 5, obtainedScore: 4,
        subQuestionCount: 2,
        subQuestions: [
          { questionId: 101, stem: 'First', questionType: 'SINGLE', questionScore: 2, obtainedScore: 1 },
          { questionId: 102, stem: 'Second', questionType: 'READING', questionScore: 3, obtainedScore: 3 },
        ],
      },
    ])

    expect(answers.map((answer) => answer.questionId)).toEqual([101, 102])
    expect(answers[0]).toMatchObject({
      passageId: 200,
      passageTitle: 'Article',
      readingGroupScore: 5,
      readingGroupObtainedScore: 4,
      readingGroupSize: 2,
      questionScore: 2,
      obtainedScore: 1,
    })
  })

  it('flattens practice units without losing the article group context', () => {
    const questions = flattenPracticeQuestionUnits([
      {
        unitType: 'QUESTION',
        question: {
          id: 10, categoryId: 1, questionType: 'SINGLE', stem: 'Standalone', difficulty: 1,
        },
      },
      {
        unitType: 'READING',
        passage: {
          id: 200, title: 'Article', content: 'Text', difficulty: 2,
          questionCount: 2, totalScore: 5,
          questions: [
            { id: 101, categoryId: 1, questionType: 'SINGLE', stem: 'First', difficulty: 2, defaultScore: 2 },
            { id: 102, categoryId: 1, questionType: 'READING', stem: 'Second', difficulty: 3, defaultScore: 3 },
          ],
        },
      },
    ])

    expect(questions.map((question) => question.id)).toEqual([10, 101, 102])
    expect(questions[1]).toMatchObject({
      passageId: 200,
      readingGroupScore: 5,
      readingGroupSize: 2,
      readingGroupIndex: 1,
    })
    expect(questions[2]?.readingGroupIndex).toBe(2)
  })
})
