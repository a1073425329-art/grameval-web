import request from '@/utils/request'
import type { ApiResponse, PageQuery, PageResult } from '@/types/common'
import type {
  StudentAnalysis,
  GeneratePaperForm,
  GeneratePaperPreview,
  ConfirmPaperForm,
  ConfirmPaperResult,
  PaperGenerationLog,
} from '@/types/ai'

/**
 * ① 分析学生历史 —— POST /admin/ai/analyze-student?targetUserId=xxx
 * 返回一句话学习建议 + 各分类错题统计（Dify + DeepSeek）
 */
export const analyzeStudent = (targetUserId: number) =>
  request.post<ApiResponse<StudentAnalysis>>('/admin/ai/analyze-student', null, {
    params: { targetUserId },
    timeout: 120_000,
  })

/**
 * ② 生成预览 —— POST /admin/ai/generate-paper/preview
 * 不落库，可多次调用改参数（每次生成一条 log 记录）
 */
export const generatePreview = (data: GeneratePaperForm) =>
  request.post<ApiResponse<GeneratePaperPreview>>(
    '/admin/ai/generate-paper/preview',
    data,
    { timeout: 180_000 }
  )

/**
 * ③ 确认入库 —— POST /admin/ai/generate-paper/confirm
 * 自动建 试卷 + 场次 + 指派学生
 */
export const confirmPaper = (data: ConfirmPaperForm) =>
  request.post<ApiResponse<ConfirmPaperResult>>(
    '/admin/ai/generate-paper/confirm',
    data
  )

/** 出题日志分页 */
export interface AiLogQuery extends PageQuery {
  targetUserId?: number
  status?: 'PREVIEW' | 'CONFIRMED' | 'FAILED'
}

export const listGenerationLogs = (params: AiLogQuery) =>
  request.get<ApiResponse<PageResult<PaperGenerationLog>>>(
    '/admin/ai/generation-logs',
    { params }
  )

export const getGenerationLog = (logId: number) =>
  request.get<ApiResponse<PaperGenerationLog>>(`/admin/ai/generation-logs/${logId}`)
