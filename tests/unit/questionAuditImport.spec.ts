import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { QuestionDocumentImportItem } from '@/types/question'

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}))

vi.mock('@/utils/request', () => ({
  default: {
    get: getMock,
    post: postMock,
  },
}))

import {
  aiAuditQuestions,
  aiAuditQuestionsSequentially,
  auditQuestions,
  getQuestionAuditStats,
  listAdminQuestions,
} from '@/api/admin'
import {
  buildQuestionDocumentImportCommitItems,
  commitQuestionDocumentImport,
  previewQuestionDocumentImport,
  validateQuestionDocumentImportItems,
} from '@/api/questionImport'

const createQuestion = (overrides: Partial<QuestionDocumentImportItem> = {}): QuestionDocumentImportItem => ({
  index: 1,
  questionType: 'SINGLE',
  stem: 'She _____ to school every day.',
  standardAnswer: 'A',
  analysis: 'Simple present.',
  options: [
    { optionLabel: 'A', optionContent: 'goes', sortNo: 1 },
    { optionLabel: 'B', optionContent: 'go', sortNo: 2 },
  ],
  difficulty: 2,
  defaultScore: 2,
  answerFormat: 'CASE_INSENSITIVE',
  knowledgePoints: ['一般现在时'],
  tagIds: [7],
  primaryTagId: 7,
  errors: [],
  warnings: [],
  passageGroupKey: null,
  passageTitle: null,
  passageContent: null,
  passageKnowledgePoints: [],
  childItems: [],
  ...overrides,
})

describe('题库审核与旧卷导入 API 契约', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('调用契约指定的审核接口并传入精确请求体', () => {
    auditQuestions([1, 2], 1)
    aiAuditQuestions([3])
    const filters = {
      keyword: 'verb',
      categoryId: 4,
      questionType: 'SINGLE' as const,
      status: 1,
      createBy: 9,
      studentIds: [21, 22],
      onlyWrong: true,
    }
    getQuestionAuditStats(filters)
    listAdminQuestions({ ...filters, pageNum: 1, pageSize: 50, auditStatus: 0 })

    expect(postMock).toHaveBeenNthCalledWith(1, '/admin/questions/audit', {
      ids: [1, 2],
      auditStatus: 1,
    })
    expect(postMock).toHaveBeenNthCalledWith(2, '/admin/questions/audit/ai', { ids: [3] })
    expect(getMock).toHaveBeenCalledWith('/admin/questions/audit-stats', { params: filters })
    expect(getMock.mock.calls[0]?.[1]?.params).not.toHaveProperty('auditStatus')
    expect(getMock).toHaveBeenCalledWith('/questions', {
      params: { ...filters, pageNum: 1, pageSize: 50, auditStatus: 0 },
    })
  })

  it('逐题串行发送 AI 审核、合并结果，并在单题请求失败后继续', async () => {
    postMock
      .mockResolvedValueOnce({
        data: {
          approved: 1,
          rejected: 0,
          failed: 0,
          items: [{ id: 5, auditStatus: 1, reason: '置信度达标' }],
        },
      })
      .mockRejectedValueOnce(new Error('network failure'))
      .mockResolvedValueOnce({
        data: {
          approved: 0,
          rejected: 1,
          failed: 0,
          items: [{ id: 9, auditStatus: 2, reason: '题目答案不一致' }],
        },
      })
    const progress: Array<{ done: number; total: number }> = []

    const result = await aiAuditQuestionsSequentially([5, 7, 9], (done, total) => {
      progress.push({ done, total })
    })

    expect(postMock.mock.calls.map((call) => call[1])).toEqual([
      { ids: [5] },
      { ids: [7] },
      { ids: [9] },
    ])
    expect(progress).toEqual([
      { done: 1, total: 3 },
      { done: 2, total: 3 },
      { done: 3, total: 3 },
    ])
    expect(result).toEqual({
      approved: 1,
      rejected: 1,
      failed: 1,
      items: [
        { id: 5, auditStatus: 1, reason: '置信度达标' },
        { id: 7, auditStatus: null, reason: '审核请求失败，题目保持待审核' },
        { id: 9, auditStatus: 2, reason: '题目答案不一致' },
      ],
    })
  })

  it('预览使用 multipart file 与 categoryId 字段', () => {
    const file = new File(['# sample'], 'sample.md', { type: 'text/markdown' })
    previewQuestionDocumentImport(file, 12)

    const [path, body, config] = postMock.mock.calls[0] as [string, FormData, { headers: Record<string, string> }]
    expect(path).toBe('/admin/questions/document-import/preview')
    expect(body.get('file')).toBe(file)
    expect(body.get('categoryId')).toBe('12')
    expect(config.headers['Content-Type']).toBe('multipart/form-data')
  })

  it('提交体保留校正字段和阅读组 childItems 顺序，不发送预览诊断元数据', () => {
    const first = createQuestion({ index: 2, stem: 'First corrected question' })
    const second = createQuestion({ index: 3, stem: 'Second corrected question' })
    const group = createQuestion({
      questionType: 'READING',
      stem: '',
      standardAnswer: '',
      options: [],
      knowledgePoints: [],
      tagIds: [],
      primaryTagId: null,
      passageGroupKey: 'passage-1',
      passageTitle: 'An edited title',
      passageContent: 'Edited passage content.',
      passageKnowledgePoints: ['细节理解'],
      childItems: [first, second],
    })
    const payload = buildQuestionDocumentImportCommitItems([group])

    expect(payload[0]?.childItems.map((item) => item.stem)).toEqual([
      'First corrected question',
      'Second corrected question',
    ])
    expect(payload[0]).toMatchObject({
      passageGroupKey: 'passage-1',
      passageTitle: 'An edited title',
      passageKnowledgePoints: ['细节理解'],
    })
    expect(payload[0]).not.toHaveProperty('errors')
    expect(payload[0]?.childItems[0]).not.toHaveProperty('index')

    commitQuestionDocumentImport(12, [group])
    expect(postMock).toHaveBeenCalledWith('/admin/questions/document-import/commit', {
      categoryId: 12,
      items: payload,
    })
  })

  it('AI 缺失知识点或有效考点标签时阻止提交校验', () => {
    const item = createQuestion({ knowledgePoints: [], tagIds: [999], primaryTagId: 999 })

    expect(validateQuestionDocumentImportItems([item], [7])).toEqual([
      '第 1 组/题：请补充至少一个知识点',
      '第 1 组/题：请选择至少一个现有启用考点标签',
      '第 1 组/题：主考点必须从已选启用标签中选择',
    ])
    expect(validateQuestionDocumentImportItems([createQuestion()], [7])).toEqual([])
  })

  it('校验阅读组子题，并接受人工校正后的标签关系', () => {
    const group = createQuestion({
      questionType: 'READING',
      stem: '',
      standardAnswer: '',
      options: [],
      knowledgePoints: [],
      tagIds: [],
      primaryTagId: null,
      passageGroupKey: 'passage-1',
      passageTitle: 'Article',
      passageContent: 'Passage text.',
      childItems: [createQuestion({ tagIds: [8], primaryTagId: 8 })],
    })

    expect(validateQuestionDocumentImportItems([group], [8])).toEqual([])
    expect(validateQuestionDocumentImportItems([group], [7])).toContain(
      '第 1 组/题第 1 题：请选择至少一个现有启用考点标签',
    )
  })
})
