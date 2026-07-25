import request from '@/utils/request'
import type { ApiResponse, PageQuery, PageResult } from '@/types/common'
import type { PaperTemplate, PaperTemplateForm } from '@/types/paperTemplate'

export interface PaperTemplateQuery extends PageQuery {
  templateName?: string
  status?: number
  gradeLevel?: string
}

export const listTemplates = (params: PaperTemplateQuery) =>
  request.get<ApiResponse<PageResult<PaperTemplate>>>('/paper-templates', { params })

export const getTemplate = (id: number) =>
  request.get<ApiResponse<PaperTemplate>>(`/paper-templates/${id}`)

export const createTemplate = (data: PaperTemplateForm) =>
  request.post<ApiResponse<PaperTemplate>>('/paper-templates', data)

export const updateTemplate = (id: number, data: PaperTemplateForm) =>
  request.put<ApiResponse<PaperTemplate>>(`/paper-templates/${id}`, data)

export const deleteTemplate = (id: number) =>
  request.delete<ApiResponse<void>>(`/paper-templates/${id}`)

export const useTemplate = (id: number) =>
  request.post<ApiResponse<void>>(`/paper-templates/${id}/use`)

/** 根据模板自动生成试卷 */
export const generatePaperFromTemplate = (id: number, paperName?: string) =>
  request.post<ApiResponse<{ paperId: number; paperName: string; totalScore: number; questionCount: number; status: string }>>(`/paper-templates/${id}/generate`, null, { params: { paperName } })
