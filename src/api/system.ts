import request from '@/utils/request'
import type { ApiResponse } from '@/types/common'

/** 系统配置项 */
export interface SysConfig {
  id: number
  configKey: string
  configValue: string
  configGroup: string
  description: string
  isEncrypted: boolean
  valueType: string
  status: number
  sortOrder: number
  defaultValue: string
  options: string
  isPublic: boolean
  isReadonly: boolean
  placeholder: string
  validationRule: string
  createTime: string
  updateTime: string
}

/** AI 配置概览 */
export interface AiOverview {
  provider: string
  deepseekConfigured: boolean
  difyAnalyzeConfigured: boolean
  difyGenerateConfigured: boolean
  mockEnabled: boolean
  defaultModel: string
  currentModel?: string
  qianwenModel?: string
  qianwenConfigured?: boolean
  temperature?: number
  maxTokens?: number
  /** 当前选中的厂商档案（多厂商链路） */
  currentProfileId?: string
  currentProfileVendor?: string
  currentProfileModel?: string
  currentProfileBaseUrl?: string
}

/** 厂商模型档案（多厂商链路的最小配置项） */
export interface AiVendorProfile {
  id: string
  vendor: string
  protocol: 'openai' | 'ollama'
  baseUrl: string
  /** 脱敏后的 Key（前3***后3）；提交时原样回传表示「不修改」 */
  apiKey: string
  model: string
  models: string[]
  enabled: boolean
  /** 后端标记：当前生效的档案 */
  isCurrent?: boolean
  /** 后端标记：ai.current_profile 指向的档案（含被停用的） */
  isSelected?: boolean
}

/** 从上游拉取模型列表的结果 */
export interface AiVendorModelsResult {
  id: string
  model: string
  models: string[]
  fromUpstream: boolean
  message?: string
}

/** AI Provider 状态 */
export interface AiProviderStatus {
  id: string
  name: string
  configured: boolean
  model: string
  baseUrl: string
  providerType: string
}

/** AI 模型信息 */
export interface AiModel {
  id: string
  name: string
  description: string
  provider: string
}

/** AI 测试结果 */
export interface AiTestResult {
  success: boolean
  message: string
  latencyMs: number
  model?: string
  provider?: string
}

/** AI 问答请求（请求 DTO, 可选字段放宽 undefined, 见 src/api/admin.ts 顶部说明） */
export interface AiChatRequest {
  provider?: string | undefined
  message: string
  systemPrompt?: string | undefined
  model?: string | undefined
  temperature?: number | undefined
  maxTokens?: number | undefined
}

/** AI 多轮消息 */
export interface AiChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/** AI 问答响应 */
export interface AiChatResponse {
  content: string
  model: string
  provider: string
  latencyMs: number
  success: boolean
  message?: string
}

/** AI 分析场景 */
export interface AiScenario {
  code: string
  name: string
  description: string
  icon: string
  enabled: boolean
}

// ==================== 系统配置 ====================

/** 获取所有配置（按分组） */
export const getAllConfigs = () =>
  request.get<ApiResponse<Record<string, SysConfig[]>>>('/admin/system-config')

/** 按分组获取配置 */
export const getConfigsByGroup = (group: string) =>
  request.get<ApiResponse<SysConfig[]>>(`/admin/system-config/group/${group}`)

/** 获取单个配置 */
export const getConfig = (key: string) =>
  request.get<ApiResponse<SysConfig>>(`/admin/system-config/${key}`)

/** 更新单个配置 */
export const updateConfig = (key: string, value: string) =>
  request.put<ApiResponse<SysConfig>>(`/admin/system-config/${key}`, { value })

/** 批量更新配置 */
export const batchUpdateConfigs = (configs: Record<string, string>) =>
  request.put<ApiResponse<SysConfig[]>>('/admin/system-config/batch', configs)

/** 获取公开配置 */
export const getPublicConfigs = () =>
  request.get<ApiResponse<SysConfig[]>>('/admin/system-config/public')

/** 获取菜单配置 */
export const getMenuConfigs = () =>
  request.get<ApiResponse<Record<string, boolean>>>('/admin/system-config/menu')

/** 重置配置为默认值 */
export const resetConfig = (key: string) =>
  request.post<ApiResponse<SysConfig>>(`/admin/system-config/${key}/reset`)

/** 刷新配置缓存 */
export const refreshConfigs = () =>
  request.post<ApiResponse<string>>('/admin/system-config/refresh')

// ==================== AI 测试接口 ====================

/** 获取所有 Provider 状态 */
export const getAiProvidersStatus = () =>
  request.get<ApiResponse<AiProviderStatus[]>>('/admin/ai-test/providers/status')

/** 测试指定 Provider 连接 */
export const testAiProvider = (providerId: string, data?: { apiKey?: string; model?: string; baseUrl?: string }) =>
  request.post<ApiResponse<AiTestResult>>(`/admin/ai-test/providers/${providerId}/test`, data || {}, { timeout: 60_000 })

/** AI 单轮问答 */
export const aiChat = (data: AiChatRequest) =>
  request.post<ApiResponse<AiChatResponse>>('/admin/ai-test/chat', data, { timeout: 120_000 })

/** AI 多轮对话 */
export const aiMultiChat = (data: { provider?: string; messages: AiChatMessage[]; systemPrompt?: string }) =>
  request.post<ApiResponse<AiChatResponse>>('/admin/ai-test/chat/multi', data, { timeout: 120_000 })

/** 获取 AI 可用模型列表 */
export const getAiModels = (provider?: string) =>
  request.get<ApiResponse<AiModel[]>>('/admin/ai-test/models', { params: provider ? { provider } : {} })

// ==================== 厂商模型档案（多厂商） ====================

/** 获取厂商档案列表（Key 已脱敏） */
export const getAiVendorProfiles = () =>
  request.get<ApiResponse<AiVendorProfile[]>>('/admin/ai-test/providers')

/** 保存厂商档案列表（整体覆盖；Key 传脱敏值表示不修改） */
export const saveAiVendorProfiles = (list: AiVendorProfile[]) =>
  request.put<ApiResponse<AiVendorProfile[]>>('/admin/ai-test/providers', list)

/** 设为当前使用的厂商档案（传 'none' 表示取消，回落到内置通路） */
export const setCurrentAiVendor = (id: string) =>
  request.post<ApiResponse<string>>(`/admin/ai-test/providers/${encodeURIComponent(id)}/current`)

/** 删除厂商档案 */
export const deleteAiVendor = (id: string) =>
  request.delete<ApiResponse<AiVendorProfile[]>>(`/admin/ai-test/providers/${encodeURIComponent(id)}`)

/** 从上游拉取厂商档案的模型列表 */
export const fetchAiVendorModels = (id: string) =>
  request.get<ApiResponse<AiVendorModelsResult>>(
    `/admin/ai-test/providers/${encodeURIComponent(id)}/models`,
    { timeout: 30_000 }
  )

// ==================== AI 相关 ====================

/** 测试 DeepSeek 连接 */
export const testDeepSeekConnection = (apiKey?: string) =>
  request.post<ApiResponse<{ success: boolean; message: string }>>(
    '/admin/system-config/test-deepseek',
    apiKey ? { apiKey } : {}
  )

/** 获取 AI 配置概览 */
export const getAiOverview = () =>
  request.get<ApiResponse<AiOverview>>('/admin/system-config/ai/overview')

/** 获取支持的 AI 分析场景列表 */
export const getAiScenarios = () =>
  request.get<ApiResponse<AiScenario[]>>('/admin/ai-analysis/scenarios')

// ==================== AI 分析接口 ====================

/** 单个学生学情分析 */
export const analyzeSingleStudent = (studentId: number) =>
  request.post<ApiResponse<any>>(`/admin/ai-analysis/student/${studentId}`, null, {
    timeout: 120_000,
  })

/** 批量学生学情分析 */
export const analyzeBatchStudents = (studentIds: number[]) =>
  request.post<ApiResponse<any>>('/admin/ai-analysis/batch', studentIds, {
    timeout: 180_000,
  })

/** 我的学生整体分析 */
export const analyzeMyStudents = () =>
  request.post<ApiResponse<any>>('/admin/ai-analysis/my-students', null, {
    timeout: 180_000,
  })

/** 错题智能解析 */
export const analyzeWrongQuestion = (data: {
  stem: string
  studentAnswer: string
  correctAnswer: string
  category: string
}) =>
  request.post<ApiResponse<{ analysis: string }>>(
    '/admin/ai-analysis/wrong-question',
    data
  )

/** 生成个性化学习建议 */
export const generateStudyAdvice = (studentId: number) =>
  request.post<ApiResponse<{ advice: string }>>(
    `/admin/ai-analysis/study-advice/${studentId}`,
    null,
    { timeout: 120_000 }
  )

/**
 * [2026-10-31 新增] 考试整卷 AI 解析（教师视角）
 * POST /api/admin/ai-analysis/exam/{sessionId}
 * 每次实时调用大模型，返回全班成绩分析文本。
 */
export const getExamAiAnalysisForTeacher = (sessionId: number) =>
  request.post<ApiResponse<{ analysis: string }>>(
    `/admin/ai-analysis/exam/${sessionId}`,
    null,
    { timeout: 120_000 }
  )

// ==================== 接口一键测试 ====================

/** 接口发现结果 */
export interface ApiEndpointInfo {
  method: string
  path: string
  summary: string
  operationId: string
  tag: string
}

/** 接口测试结果项 */
export interface ApiTestResultItem {
  path: string
  method: string
  url: string
  success: boolean
  statusCode: number
  latencyMs: number
  error: string | null
  responsePreview: string | null
}

/** 一键测试汇总 */
export interface ApiTestSummary {
  totalEndpoints: number
  successCount: number
  failedCount: number
  totalLatencyMs: number
  results: ApiTestResultItem[]
}

/** 发现所有接口 */
export const discoverEndpoints = () =>
  request.get<ApiResponse<ApiEndpointInfo[]>>('/admin/api-test/discover')

/** 一键测试所有接口 */
export const runAllApiTests = (params?: { skipAuth?: boolean; perTimeoutSeconds?: number }) =>
  request.post<ApiResponse<ApiTestSummary>>('/admin/api-test/run', null, {
    params,
    timeout: 300_000,
  })
