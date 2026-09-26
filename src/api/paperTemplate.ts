import request from '@/utils/request'
import type { ApiResponse, PageQuery, PageResult } from '@/types/common'
import type { PaperTemplate, PaperTemplateForm } from '@/types/paperTemplate'

/* 请求 DTO, 可选字段放宽 undefined, 见 src/api/admin.ts 顶部说明 */
export interface PaperTemplateQuery extends PageQuery {
  templateName?: string | undefined
  status?: number | undefined
  gradeLevel?: string | undefined
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

// [2026-09-26 前后端路由对齐核查] 后端 PaperTemplateController 只有
//   POST /api/paper-templates/{id}/generate
// 没有 /use 路由，调用必 404；且页面实际用的是下方 generatePaperFromTemplate。
// 故此函数停用（代码保留备查，不删除），避免误引入造成死链。
// export const useTemplate = (id: number) =>
//   request.post<ApiResponse<void>>(`/paper-templates/${id}/use`)

/** 根据模板自动生成试卷 */
export const generatePaperFromTemplate = (id: number, paperName?: string) =>
  request.post<ApiResponse<{ paperId: number; paperName: string; totalScore: number; questionCount: number; status: string }>>(`/paper-templates/${id}/generate`, null, { params: { paperName } })
