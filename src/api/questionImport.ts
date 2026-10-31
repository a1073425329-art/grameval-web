import request from '@/utils/request'
import type { ApiResponse } from '@/types/common'
import type {
  QuestionDocumentImportCommitItem,
  QuestionDocumentImportCommitResult,
  QuestionDocumentImportItem,
  QuestionDocumentImportPreview,
} from '@/types/question'

export const previewQuestionDocumentImport = (file: File, categoryId: number) => {
  const form = new FormData()
  form.append('file', file)
  form.append('categoryId', String(categoryId))
  return request.post<ApiResponse<QuestionDocumentImportPreview>>(
    '/admin/questions/document-import/preview',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
}

const toCommitItem = (item: QuestionDocumentImportItem): QuestionDocumentImportCommitItem => ({
  questionType: item.questionType,
  stem: item.stem,
  standardAnswer: item.standardAnswer,
  analysis: item.analysis,
  options: item.options.map((option) => ({ ...option })),
  difficulty: item.difficulty,
  defaultScore: item.defaultScore,
  answerFormat: item.answerFormat,
  knowledgePoints: [...item.knowledgePoints],
  tagIds: [...item.tagIds],
  primaryTagId: item.primaryTagId,
  passageGroupKey: item.passageGroupKey,
  passageTitle: item.passageTitle,
  passageContent: item.passageContent,
  passageKnowledgePoints: [...item.passageKnowledgePoints],
  childItems: item.childItems.map(toCommitItem),
})

export const buildQuestionDocumentImportCommitItems = (
  items: QuestionDocumentImportItem[],
): QuestionDocumentImportCommitItem[] => items.map(toCommitItem)

export const commitQuestionDocumentImport = (
  categoryId: number,
  items: QuestionDocumentImportItem[],
) =>
  request.post<ApiResponse<QuestionDocumentImportCommitResult>>(
    '/admin/questions/document-import/commit',
    { categoryId, items: buildQuestionDocumentImportCommitItems(items) },
  )

export const validateQuestionDocumentImportItems = (
  items: QuestionDocumentImportItem[],
  enabledTagIds: number[],
): string[] => {
  const validTagIds = new Set(enabledTagIds)
  const errors: string[] = []

  const validateQuestion = (item: QuestionDocumentImportItem, label: string) => {
    if (!item.stem.trim()) errors.push(`${label}：题干不能为空`)
    if (!item.standardAnswer.trim()) errors.push(`${label}：标准答案不能为空`)
    if (['SINGLE', 'MULTIPLE'].includes(item.questionType) && item.options.length < 2) {
      errors.push(`${label}：选择题至少需要两个选项`)
    }
    if (item.questionType === 'JUDGE' && !['TRUE', 'FALSE'].includes(item.standardAnswer.trim().toUpperCase())) {
      errors.push(`${label}：判断题答案必须是 TRUE 或 FALSE`)
    }
    if (item.knowledgePoints.every((point) => !point.trim())) {
      errors.push(`${label}：请补充至少一个知识点`)
    }
    if (!item.tagIds.some((id) => validTagIds.has(id))) {
      errors.push(`${label}：请选择至少一个现有启用考点标签`)
    }
    if (item.primaryTagId == null || !item.tagIds.includes(item.primaryTagId) || !validTagIds.has(item.primaryTagId)) {
      errors.push(`${label}：主考点必须从已选启用标签中选择`)
    }
  }

  items.forEach((item, itemIndex) => {
    const label = `第 ${item.index || itemIndex + 1} 组/题`
    if (item.passageGroupKey) {
      if (!item.passageTitle?.trim()) errors.push(`${label}：阅读标题不能为空`)
      if (!item.passageContent?.trim()) errors.push(`${label}：阅读正文不能为空`)
      if (!item.childItems.length) errors.push(`${label}：阅读组至少需要一道子题`)
      item.childItems.forEach((child, childIndex) => validateQuestion(child, `${label}第 ${childIndex + 1} 题`))
    } else {
      validateQuestion(item, label)
    }
  })

  return errors
}
