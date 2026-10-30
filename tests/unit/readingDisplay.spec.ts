import { describe, expect, it } from 'vitest'
import {
  questionAnalysisDisplayText,
  readingKnowledgePointLabel,
  readingSubtypeLabel,
} from '@/utils/dict'

describe('reading question display labels', () => {
  it('maps known subtype codes to Chinese labels, ignoring code casing and whitespace', () => {
    expect(readingSubtypeLabel('INFERENCE')).toBe('推断题')
    expect(readingKnowledgePointLabel(' detail ')).toBe('细节题')
  })

  it('preserves non-code knowledge point text', () => {
    expect(readingKnowledgePointLabel('作者态度')).toBe('作者态度')
    expect(readingKnowledgePointLabel(null)).toBe('')
  })

  it('replaces only the generic placeholder and preserves authored explanations', () => {
    expect(questionAnalysisDisplayText('Grammar rule explanation.')).toBe('暂无有效解析')
    expect(questionAnalysisDisplayText(' Grammar rule explanation. ')).toBe(' Grammar rule explanation. ')
    expect(questionAnalysisDisplayText('grammar rule explanation.')).toBe('grammar rule explanation.')
    expect(questionAnalysisDisplayText('The answer is B because it states the cause.'))
      .toBe('The answer is B because it states the cause.')
    expect(questionAnalysisDisplayText(' ')).toBe('')
  })
})
