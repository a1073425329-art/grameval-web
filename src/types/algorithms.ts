import type { PracticeRecord } from '@/types/question'
import type { QuestionUnit } from '@/types/reading'

/** 策略仅影响模板题库组卷；默认路径保持随机抽题。 */
export type AlgorithmPaperStrategy = 'RANDOM' | 'OPTIMIZED'

export type AlgorithmDataStatus = 'OK' | 'INSUFFICIENT_SAMPLE' | 'INCOMPLETE_DATA' | 'NO_DATA'

export interface AlgorithmQuestionQualityQuery {
  categoryId?: number | undefined
  studentIds?: number[] | undefined
  startTime?: string | undefined
  endTime?: string | undefined
}

export interface AlgorithmQuestionQualityFilters {
  categoryId?: number | null
  studentIds?: number[]
  startTime?: string | null
  endTime?: string | null
}

export interface AlgorithmQuestionQualityCoverage {
  eligibleResponses: number
  observedResponses: number
  missingRows: number
  coverageRate: number | null
  status: AlgorithmDataStatus
}

export interface AlgorithmQuestionOptionQuality {
  key: string
  selectedCount: number
  selectionRate: number | null
  highGroupRate: number | null
  lowGroupRate: number | null
  isCorrect: boolean
}

export interface AlgorithmQuestionQualityItem {
  questionId: number
  questionType: string
  sampleCount: number
  p: number | null
  d: number | null
  itemRestCorrelation: number | null
  correlationMethod: 'POINT_BISERIAL' | 'PEARSON_ITEM_REST' | string | null
  qualityScore: number | null
  qualityLevel: string | null
  status: AlgorithmDataStatus
  options: AlgorithmQuestionOptionQuality[]
}

export interface AlgorithmQuestionReliability {
  paperId: number
  sessionId: number
  alpha: number | null
  sampleCount: number
  itemCount: number
  status: AlgorithmDataStatus
}

export interface AlgorithmQuestionQualityResult {
  source: 'EXAM'
  filters: AlgorithmQuestionQualityFilters
  coverage: AlgorithmQuestionQualityCoverage
  items: AlgorithmQuestionQualityItem[]
  reliability: AlgorithmQuestionReliability[]
}

export interface AlgorithmPaperOptimization {
  strategy: AlgorithmPaperStrategy
  energyBefore: number | null
  energyAfter: number | null
  iterations: number
  constraintsSatisfied: boolean
  difficultyBandDeviation: number | null
  meanDiscrimination: number | null
  tagCoverage: number | null
  calibrationCoverage: number | null
  warnings: string[]
}

export interface AlgorithmPaperGenerateResult {
  paperId: number
  paperName: string
  totalScore: number
  questionCount: number
  status: string
  warnings?: string[]
  optimization?: AlgorithmPaperOptimization
}

export interface AlgorithmBktParameters {
  pL0: number
  pT: number
  pG: number
  pS: number
  forgettingLambda: number
  fitSequenceCount: number
}

export interface AlgorithmBktItem {
  tagId: number
  tagName: string
  categoryId: number | null
  observations: number
  masteryProbability: number | null
  status: AlgorithmDataStatus
  lastAnswerTime: string | null
  parameterSource: string
  parameters: AlgorithmBktParameters
}

export interface AlgorithmBktStudentResult {
  userId: number
  modelVersion: string
  items: AlgorithmBktItem[]
}

export interface AlgorithmBktStudentQuery {
  studentIds?: number[] | undefined
  startTime?: string | undefined
  endTime?: string | undefined
}

export interface AlgorithmBktBatchResult {
  modelVersion: string
  students: AlgorithmBktStudentResult[]
}

export type AlgorithmAdaptiveStopReason =
  | 'TARGET_SE_REACHED'
  | 'MAX_ITEMS_REACHED'
  | 'CONTENT_POOL_EXHAUSTED'
  | 'NO_AVAILABLE_QUESTION'

export interface AlgorithmAdaptivePracticeResult {
  practice: PracticeRecord
  question: QuestionUnit | null
  theta: number | null
  standardError: number | null
  answeredCount: number
  maxQuestionCount: number
  targetStandardError: number
  finished: boolean
  stopReason: AlgorithmAdaptiveStopReason | null
  calibrationStatus: string
  calibrationSampleCount: number
  modelVersion: string
}

export const algorithmStatusLabel = (status: AlgorithmDataStatus): string => ({
  OK: '样本可用',
  INSUFFICIENT_SAMPLE: '样本不足',
  INCOMPLETE_DATA: '数据不全',
  NO_DATA: '暂无观测',
})[status]

export const algorithmRateDisplay = (value: number | null | undefined): string =>
  value == null || !Number.isFinite(value) ? '暂无数据' : `${(value * 100).toFixed(1)}%`

const adaptiveStopLabels: Record<AlgorithmAdaptiveStopReason, string> = {
  TARGET_SE_REACHED: '达到精度目标',
  MAX_ITEMS_REACHED: '达到最大题数，尚未达到精度目标',
  CONTENT_POOL_EXHAUSTED: '题目资源已用尽',
  NO_AVAILABLE_QUESTION: '当前无可用题目',
}

export const algorithmAdaptiveStopLabel = (reason: AlgorithmAdaptiveStopReason | null): string =>
  reason ? adaptiveStopLabels[reason] : ''

export const algorithmMetricDisplay = (
  value: number | null | undefined,
  status: AlgorithmDataStatus,
  digits = 3,
): string => {
  if (value == null || !Number.isFinite(value)) return status === 'OK' ? '—' : algorithmStatusLabel(status)
  return value.toFixed(digits)
}
