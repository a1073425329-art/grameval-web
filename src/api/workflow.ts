import request from '@/utils/request'
import type { ApiResponse } from '@/types/common'
import type {
  WorkflowNode,
  WorkflowConnection,
  NodeExecutionResult,
  WorkflowExecution,
} from '@/types/workflow'

/**
 * 获取工作流节点定义列表。
 */
export const getWorkflowNodes = () =>
  request.get<ApiResponse<WorkflowNode[]>>('/admin/workflow/nodes')

/**
 * 获取工作流连接关系。
 */
export const getWorkflowConnections = () =>
  request.get<ApiResponse<WorkflowConnection[]>>('/admin/workflow/connections')

/**
 * 执行单个节点。
 */
export const executeNode = (nodeId: string, inputs: Record<string, any>) =>
  request.post<ApiResponse<NodeExecutionResult>>(`/admin/workflow/nodes/${nodeId}/execute`, inputs)

/**
 * 执行完整工作流（单个学生）。
 * @param totalScore [2026-10-16 新增] 试卷总分（100 或 150），
 *                   后端按「满分 ÷ 实际题量」精确分摊每题分值
 */
export const executeWorkflow = (userId: number, questionCount?: number, totalScore?: number) =>
  request.post<ApiResponse<WorkflowExecution>>('/admin/workflow/execute', null, {
    params: { userId, questionCount, totalScore },
    timeout: 300_000,
  })

/**
 * 执行批量工作流（多个学生）。
 */
export const executeBatchWorkflow = (userIds: number[], questionCount?: number) =>
  request.post<ApiResponse<WorkflowExecution>>('/admin/workflow/execute-batch', null, {
    params: { userIds, questionCount },
    timeout: 300_000,
  })

/**
 * 获取执行详情。
 */
export const getExecutionDetail = (executionId: string) =>
  request.get<ApiResponse<WorkflowExecution>>(`/admin/workflow/executions/${executionId}`)

/**
 * 获取执行历史。
 */
export const getExecutionHistory = (limit = 20) =>
  request.get<ApiResponse<WorkflowExecution[]>>('/admin/workflow/executions', {
    params: { limit },
  })
