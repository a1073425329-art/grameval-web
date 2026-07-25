/**
 * 工作流节点定义。
 * 模拟 Dify workflow 的节点类型：HTTP节点、LLM节点、代码节点。
 */
export interface WorkflowNode {
  nodeId: string
  nodeName: string
  nodeType: 'HTTP' | 'LLM' | 'CODE'
  description: string
  icon: string
  model?: string
  inputs: WorkflowNodeInput[]
  outputs: WorkflowNodeOutput[]
}

export interface WorkflowNodeInput {
  name: string
  label: string
  type: 'number' | 'string' | 'boolean' | 'array' | 'object'
  required: boolean
  defaultValue?: string
}

export interface WorkflowNodeOutput {
  name: string
  label: string
  type: 'number' | 'string' | 'boolean' | 'array' | 'object'
}

/**
 * 节点连接关系。
 */
export interface WorkflowConnection {
  source: string
  target: string
  sourceOutput: string
  targetInput: string
}

/**
 * 节点执行结果。
 */
export interface NodeExecutionResult {
  nodeId: string
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED'
  outputs?: Record<string, any>
  errorMessage?: string
  durationMs: number
}

/**
 * 节点执行记录。
 */
export interface NodeResultRecord {
  nodeId: string
  status: string
  startTime: string
  endTime: string
  durationMs?: number
  errorMessage?: string
}

/**
 * 工作流执行记录。
 */
export interface WorkflowExecution {
  executionId: string
  userId?: number
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED'
  startTime: string
  endTime?: string
  errorMessage?: string
  nodeResults: NodeResultRecord[]
  result?: Record<string, any>
}

/**
 * 工作流执行请求（单个学生）。
 */
export interface ExecuteWorkflowRequest {
  userId: number
  questionCount?: number
}

/**
 * 工作流执行请求（多个学生）。
 */
export interface ExecuteBatchWorkflowRequest {
  userIds: number[]
  questionCount?: number
}

/**
 * 班级统计信息。
 */
export interface ClassStats {
  totalStudents: number
  totalExams: number
  averageScore: number
  averageAccuracy: number
  totalWrongQuestions: number
  avgExamsPerStudent: number
  avgWrongPerStudent: number
}

/**
 * 薄弱点分布。
 */
export interface WeakDistribution {
  categoryName: string
  totalWrong: number
  totalAttempt: number
  wrongRate: number
  studentCount: number
}

/**
 * 成绩分布。
 */
export interface ScoreDistribution {
  excellent: number
  good: number
  medium: number
  poor: number
  excellentRate: number
  goodRate: number
  mediumRate: number
  poorRate: number
}

/**
 * 个人分析。
 */
export interface IndividualAnalysis {
  userId: number
  username: string
  realName: string
  averageScore: number
  overallAccuracy: number
  totalExams: number
  totalWrong: number
  weakestCategory: string
  rank: number
}
