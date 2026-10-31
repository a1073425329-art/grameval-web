import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getAlgorithmAdaptiveNext,
  getAlgorithmBktForStudents,
  getAlgorithmQuestionQuality,
  getMyAlgorithmBkt,
  startAlgorithmAdaptivePractice,
  submitAlgorithmAdaptiveAnswer,
} from '@/api/algorithms'
import { generatePaperFromTemplate } from '@/api/paperTemplate'
import type {
  AlgorithmAdaptivePracticeResult,
  AlgorithmBktBatchResult,
  AlgorithmBktItem,
  AlgorithmBktStudentResult,
  AlgorithmPaperGenerateResult,
  AlgorithmQuestionQualityResult,
} from '@/types/algorithms'
import {
  algorithmAdaptiveStopLabel,
  algorithmMetricDisplay,
  algorithmRateDisplay,
  algorithmStatusLabel,
} from '@/types/algorithms'

const requestMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
const practiceApiMock = vi.hoisted(() => ({ submitPractice: vi.fn(), answerInPractice: vi.fn() }))

vi.mock('@/utils/request', () => ({ default: requestMock }))
vi.mock('@/api/student', () => practiceApiMock)

const bktItem = {
  tagId: 9,
  tagName: '一般现在时',
  categoryId: 2,
  observations: 4,
  masteryProbability: 0.72,
  status: 'OK',
  lastAnswerTime: '2026-10-31 12:00:00',
  parameterSource: 'DEFAULT',
  parameters: {
    pL0: 0.25,
    pT: 0.18,
    pG: 0.2,
    pS: 0.1,
    forgettingLambda: 0.02,
    fitSequenceCount: 0,
  },
} satisfies AlgorithmBktItem

const bktStudent = {
  userId: 12,
  modelVersion: 'bkt-v1',
  items: [bktItem],
} satisfies AlgorithmBktStudentResult

const catResult = {
  practice: {
    id: 88,
    userId: 12,
    categoryId: 2,
    startTime: '2026-10-31 12:00:00',
    questionCount: 0,
    correctCount: 0,
    wrongCount: 0,
    status: 0,
  },
  question: null,
  theta: 0,
  standardError: 1,
  answeredCount: 0,
  maxQuestionCount: 30,
  targetStandardError: 0.5,
  finished: false,
  stopReason: null,
  calibrationStatus: 'UNCALIBRATED',
  calibrationSampleCount: 0,
  modelVersion: 'cat-rasch-v1',
} satisfies AlgorithmAdaptivePracticeResult

describe('algorithm result display', () => {
  it('keeps unavailable measurement values distinct from numeric zero', () => {
    expect(algorithmMetricDisplay(null, 'INSUFFICIENT_SAMPLE')).toBe('样本不足')
    expect(algorithmMetricDisplay(null, 'INCOMPLETE_DATA')).toBe('数据不全')
    expect(algorithmMetricDisplay(0, 'OK')).toBe('0.000')
  })

  it('renders fractional rates as percentages and missing rates as unavailable', () => {
    expect(algorithmRateDisplay(0.625)).toBe('62.5%')
    expect(algorithmRateDisplay(0)).toBe('0.0%')
    expect(algorithmRateDisplay(null)).toBe('暂无数据')
  })

  it('labels BKT no-data separately from insufficient observations', () => {
    expect(algorithmStatusLabel('NO_DATA')).toBe('暂无观测')
    expect(algorithmStatusLabel('INSUFFICIENT_SAMPLE')).toBe('样本不足')
  })

  it('explains CAT maximum-item stopping without implying the accuracy target was met', () => {
    expect(algorithmAdaptiveStopLabel('MAX_ITEMS_REACHED')).toContain('尚未达到精度目标')
    expect(algorithmAdaptiveStopLabel('TARGET_SE_REACHED')).toBe('达到精度目标')
  })
})

describe('algorithm API contracts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries formal-exam quality with repeated student filters and the agreed response shape', async () => {
    const result = {
      source: 'EXAM',
      filters: { categoryId: 3, studentIds: [12, 14], startTime: '2026-10-01 00:00:00', endTime: null },
      coverage: { eligibleResponses: 20, observedResponses: 18, missingRows: 2, coverageRate: 0.9, status: 'INCOMPLETE_DATA' },
      items: [{
        questionId: 101,
        questionType: 'SINGLE',
        sampleCount: 18,
        p: null,
        d: null,
        itemRestCorrelation: null,
        correlationMethod: 'POINT_BISERIAL',
        qualityScore: null,
        qualityLevel: null,
        status: 'INCOMPLETE_DATA',
        options: [{ key: 'A', selectedCount: 9, selectionRate: 0.5, highGroupRate: 0.2, lowGroupRate: 0.7, isCorrect: true }],
      }],
      reliability: [{ paperId: 6, sessionId: 7, alpha: null, sampleCount: 0, itemCount: 10, status: 'INSUFFICIENT_SAMPLE' }],
    } satisfies AlgorithmQuestionQualityResult
    requestMock.get.mockResolvedValueOnce({ data: result })

    const response = await getAlgorithmQuestionQuality({
      categoryId: 3,
      studentIds: [12, 14],
      startTime: '2026-10-01 00:00:00',
    })

    expect(requestMock.get).toHaveBeenCalledTimes(1)
    expect(requestMock.get).toHaveBeenCalledWith('/admin/questions/quality', expect.objectContaining({
      params: { categoryId: 3, studentIds: [12, 14], startTime: '2026-10-01 00:00:00' },
    }))
    const config = requestMock.get.mock.calls[0]?.[1] as {
      params: Record<string, unknown>
      paramsSerializer: { serialize: (params: Record<string, unknown>) => string }
    }
    expect(config.paramsSerializer.serialize(config.params)).toBe('categoryId=3&studentIds=12&studentIds=14&startTime=2026-10-01+00%3A00%3A00')
    expect(response.data.items[0]?.correlationMethod).toBe('POINT_BISERIAL')
    expect(response.data.coverage.missingRows).toBe(2)
  })

  it('loads a student BKT result from the self endpoint with time filters', async () => {
    requestMock.get.mockResolvedValueOnce({ data: bktStudent })

    const response = await getMyAlgorithmBkt(12, {
      startTime: '2026-10-01 00:00:00',
      endTime: '2026-10-31 23:59:59',
    })

    expect(requestMock.get).toHaveBeenCalledWith('/knowledge-mastery/student/12/bkt', {
      params: { startTime: '2026-10-01 00:00:00', endTime: '2026-10-31 23:59:59' },
    })
    expect(response.data.items[0]?.parameters).toMatchObject({ pL0: 0.25, pT: 0.18, forgettingLambda: 0.02 })
  })

  it('queries admin BKT for repeated student IDs and returns per-student versions', async () => {
    const result = { modelVersion: 'bkt-v1', students: [bktStudent] } satisfies AlgorithmBktBatchResult
    requestMock.get.mockResolvedValueOnce({ data: result })

    const response = await getAlgorithmBktForStudents({ studentIds: [12, 14] })

    expect(requestMock.get).toHaveBeenCalledWith('/knowledge-mastery/bkt', expect.objectContaining({
      params: { studentIds: [12, 14] },
    }))
    const config = requestMock.get.mock.calls[0]?.[1] as {
      params: Record<string, unknown>
      paramsSerializer: { serialize: (params: Record<string, unknown>) => string }
    }
    expect(config.paramsSerializer.serialize(config.params)).toBe('studentIds=12&studentIds=14')
    expect(response.data.students[0]?.modelVersion).toBe('bkt-v1')
  })

  it('starts CAT through POST and returns the shared adaptive-practice shape', async () => {
    requestMock.post.mockResolvedValueOnce({ data: catResult })

    const response = await startAlgorithmAdaptivePractice(2)

    expect(requestMock.post).toHaveBeenCalledWith('/practices/adaptive/start/2')
    expect(response.data).toMatchObject({
      practice: { id: 88 }, question: null, answeredCount: 0, maxQuestionCount: 30,
      targetStandardError: 0.5, stopReason: null, modelVersion: 'cat-rasch-v1',
    })
  })

  it('requests the current CAT recommendation through GET', async () => {
    requestMock.get.mockResolvedValueOnce({ data: catResult })

    const response = await getAlgorithmAdaptiveNext(88)

    expect(requestMock.get).toHaveBeenCalledWith('/practices/88/adaptive/next')
    expect(response.data.question).toBeNull()
  })

  it('returns CAT grading feedback only after the session answer has been persisted', async () => {
    const answer = { questionId: 101, userAnswer: 'A' }
    const judgement = { data: { isCorrect: true, userAnswer: 'A', standardAnswer: 'A' } }
    practiceApiMock.submitPractice.mockResolvedValueOnce(judgement)
    practiceApiMock.answerInPractice.mockResolvedValueOnce({ data: undefined })

    const response = await submitAlgorithmAdaptiveAnswer(88, answer)

    expect(practiceApiMock.submitPractice).toHaveBeenCalledWith(answer)
    expect(practiceApiMock.answerInPractice).toHaveBeenCalledWith(88, answer)
    const gradeOrder = practiceApiMock.submitPractice.mock.invocationCallOrder[0] ?? 0
    const persistOrder = practiceApiMock.answerInPractice.mock.invocationCallOrder[0] ?? 0
    expect(gradeOrder).toBeLessThan(persistOrder)
    expect(response).toBe(judgement)
  })

  it('does not return CAT feedback when session persistence fails', async () => {
    practiceApiMock.submitPractice.mockResolvedValueOnce({
      data: { isCorrect: true, userAnswer: 'A', standardAnswer: 'A' },
    })
    practiceApiMock.answerInPractice.mockRejectedValueOnce(new Error('answer persistence failed'))

    await expect(submitAlgorithmAdaptiveAnswer(88, { questionId: 101, userAnswer: 'A' }))
      .rejects.toThrow('answer persistence failed')
  })

  it('keeps optimized generation explicit while RANDOM remains the default', async () => {
    const optimized = {
      paperId: 5,
      paperName: '优化卷',
      totalScore: 100,
      questionCount: 20,
      status: 'DRAFT',
      warnings: [],
      optimization: {
        strategy: 'OPTIMIZED',
        energyBefore: 2.1,
        energyAfter: 1.2,
        iterations: 20000,
        constraintsSatisfied: true,
        difficultyBandDeviation: 0.1,
        meanDiscrimination: 0.35,
        tagCoverage: 80,
        calibrationCoverage: 75,
        warnings: [],
      },
    } satisfies AlgorithmPaperGenerateResult
    requestMock.post.mockResolvedValueOnce({ data: optimized })

    await generatePaperFromTemplate(4, '优化卷', 'OPTIMIZED')
    expect(requestMock.post).toHaveBeenCalledWith('/paper-templates/4/generate', null, {
      params: { paperName: '优化卷', strategy: 'OPTIMIZED' },
    })

    const random = {
      paperId: 6,
      paperName: '随机卷',
      totalScore: 100,
      questionCount: 20,
      status: 'DRAFT',
    } satisfies AlgorithmPaperGenerateResult
    requestMock.post.mockResolvedValueOnce({ data: random })
    await generatePaperFromTemplate(4, '随机卷')
    expect(requestMock.post).toHaveBeenLastCalledWith('/paper-templates/4/generate', null, {
      params: { paperName: '随机卷', strategy: 'RANDOM' },
    })
  })
})
