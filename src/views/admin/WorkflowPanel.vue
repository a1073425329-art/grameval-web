<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { VueFlow, useVueFlow, addEdge, applyNodeChanges, applyEdgeChanges } from '@vue-flow/core';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import type { Node, Edge, Connection } from '@vue-flow/core'
import { getWorkflowNodes, getWorkflowConnections, executeWorkflow, executeBatchWorkflow, getExecutionHistory, getExecutionDetail } from '@/api/workflow'
import { listUsers } from '@/api/admin'
import type { WorkflowNode, WorkflowConnection, WorkflowExecution } from '@/types/workflow'
import type { UserDetail } from '@/types/user'

// === 状态管理 ===
const nodes = ref<any[]>([])
const edges = ref<any[]>([])
const workflowNodes = ref<WorkflowNode[]>([])
const connections = ref<WorkflowConnection[]>([])
const students = ref<UserDetail[]>([])
const selectedStudentIds = ref<number[]>([])
const questionCount = ref(30)
const executing = ref(false)
const executionResult = ref<WorkflowExecution | null>(null)
const executionHistory = ref<WorkflowExecution[]>([])
const selectedExecutionId = ref<string | undefined>(undefined)
const nodeOutputs = ref<Record<string, any>>({})
const nodeStatus = ref<Record<string, 'success' | 'failed' | 'running' | ''>>({})
const workflowMode = ref<'single' | 'batch'>('single') // 单个学生模式 / 批量学生模式
const { project, onNodesChange, onEdgesChange, onConnect } = useVueFlow()

// === 节点类型颜色 ===
const nodeTypeColor: Record<string, { bg: string; border: string; text: string }> = {
  HTTP: { bg: '#409eff', border: '#3a8ee6', text: '#fff' },
  LLM: { bg: '#909399', border: '#7a7e83', text: '#fff' },
  CODE: { bg: '#67c23a', border: '#5daf34', text: '#fff' },
}

// === 加载数据 ===
const loadNodes = async () => {
  try {
    const res = await getWorkflowNodes()
    workflowNodes.value = res.data
    buildGraph(res.data)
  } catch (e) {
    ElMessage.error('加载节点定义失败')
  }
}

const loadConnections = async () => {
  try {
    const res = await getWorkflowConnections()
    connections.value = res.data
    buildEdges(res.data)
  } catch (e) {
    ElMessage.error('加载连接关系失败')
  }
}

const loadStudents = async () => {
  try {
    const res = await listUsers({ pageNum: 1, pageSize: 500, role: 'STUDENT' })
    students.value = res.data.records ?? []
  } catch (e) {
    ElMessage.error('加载学生列表失败')
  }
}

const loadHistory = async () => {
  try {
    const res = await getExecutionHistory(10)
    executionHistory.value = res.data
  } catch (e) {
    ElMessage.error('加载执行历史失败')
  }
}

// === 构建图形 ===
const buildGraph = (workflowNodes: WorkflowNode[]) => {
  const nodePositions: Record<string, { x: number; y: number }> = {
    // 单个学生工作流节点位置
    student_profile: { x: 100, y: 80 },
    wrong_stats: { x: 100, y: 200 },
    weak_analysis: { x: 100, y: 320 },
    strategy_gen: { x: 350, y: 130 },
    question_gen: { x: 600, y: 130 },
    quality_check: { x: 600, y: 250 },
    knowledge_tag: { x: 600, y: 370 },
    format_output: { x: 850, y: 250 },
    // 批量学生工作流节点位置
    batch_student_profile: { x: 100, y: 500 },
    overall_analysis: { x: 400, y: 500 },
    batch_question_gen: { x: 700, y: 500 },
  }
  const result: Node[] = []
  workflowNodes.forEach((node) => {
    result.push({
      id: node.nodeId,
      type: 'custom',
      data: {
        label: node.nodeName,
        nodeType: node.nodeType,
        description: node.description,
        model: node.model,
        inputs: node.inputs,
        outputs: node.outputs,
      },
      position: nodePositions[node.nodeId] || { x: 100, y: 100 },
      style: {
        background: nodeTypeColor[node.nodeType]?.bg || '#909399',
        color: nodeTypeColor[node.nodeType]?.text || '#fff',
        borderColor: nodeTypeColor[node.nodeType]?.border || '#7a7e83',
      },
    })
  })
  nodes.value = result
}

const buildEdges = (connections: WorkflowConnection[]) => {
  const result: Edge[] = []
  connections.forEach((conn, index) => {
    result.push({
      id: `edge-${index}`,
      source: conn.source,
      target: conn.target,
      animated: true,
      label: `${conn.sourceOutput} → ${conn.targetInput}`,
      labelStyle: { fontSize: 11, fill: '#909399' },
    })
  })
  edges.value = result
}

// === 执行工作流 ===
const doExecute = async () => {
  if (workflowMode.value === 'single') {
    if (selectedStudentIds.value.length !== 1) {
      return ElMessage.warning('请选择一个学生')
    }
  } else {
    if (selectedStudentIds.value.length < 2) {
      return ElMessage.warning('请选择多个学生（至少2个）')
    }
  }

  executing.value = true
  nodeStatus.value = {}
  nodeOutputs.value = {}
  executionResult.value = null

  try {
    let res
    if (workflowMode.value === 'single') {
      res = await executeWorkflow(selectedStudentIds.value[0], questionCount.value)
    } else {
      res = await executeBatchWorkflow(selectedStudentIds.value, questionCount.value)
    }

    executionResult.value = res.data

    // 更新节点状态
    res.data.nodeResults?.forEach((record) => {
      nodeStatus.value[record.nodeId] = record.status === 'SUCCESS' ? 'success' : 'failed'
    })

    ElMessage.success('工作流执行完成！')
    loadHistory()
  } catch (e) {
    ElMessage.error('工作流执行失败')
  } finally {
    executing.value = false
  }
}

// === 查看执行详情 ===
const viewExecution = async (executionId: string) => {
  selectedExecutionId.value = executionId
  try {
    const res = await getExecutionDetail(executionId)
    executionResult.value = res.data
    nodeStatus.value = {}
    res.data.nodeResults?.forEach((record) => {
      nodeStatus.value[record.nodeId] = record.status === 'SUCCESS' ? 'success' : 'failed'
    })
  } catch (e) {
    ElMessage.error('获取执行详情失败')
  }
}

// === Vue Flow 事件处理 ===
const onNodesChangeHandler = (changes: any[]) => {
  nodes.value = applyNodeChanges(changes, nodes.value)
}
const onEdgesChangeHandler = (changes: any[]) => {
  edges.value = applyEdgeChanges(changes, edges.value)
}
const onConnectHandler = (connection: Connection) => {
  const newEdge: Edge = {
    id: `edge-${Date.now()}`,
    source: connection.source,
    target: connection.target,
  }
  const newEdges = edges.value.slice()
  newEdges.push(newEdge)
  edges.value = newEdges
}

// === 格式化时间 ===
const formatTime = (dateStr?: string) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

// === 计算属性 ===
const selectedStudents = computed(() =>
  students.value.filter((s) => selectedStudentIds.value.includes(s.id))
)

// 获取生成的题目列表
const generatedQuestions = computed(() => {
  if (!executionResult.value?.result) return []
  const result = executionResult.value.result
  return result.taggedQuestions || result.validQuestions || result.questions || []
})

const statusLabel: Record<string, string> = {
  RUNNING: '执行中',
  SUCCEEDED: '成功',
  FAILED: '失败',
}

const statusColor: Record<string, string> = {
  RUNNING: 'warning',
  SUCCEEDED: 'success',
  FAILED: 'danger',
}

const modeLabel: Record<string, string> = {
  single: '单个学生',
  batch: '多个学生',
}

// === 辅助方法 ===
// 获取学生姓名
const getStudentName = (userId?: number) => {
  if (!userId) return '批量学生'
  return students.value.find((s) => s.id === userId)?.realName || students.value.find((s) => s.id === userId)?.username || userId.toString()
}

// 格式化题目类型
const formatQuestionType = (type?: string) => {
  if (!type) return '未知'
  const map: Record<string, string> = {
    SINGLE: '单选',
    MULTIPLE: '多选',
    JUDGE: '判断',
    FILL_BLANK: '填空',
    FILL_HINT: '提示填空',
    READING: '阅读理解',
  }
  return map[type.toUpperCase()] || type
}

// 格式化难度
const formatDifficulty = (level?: number) => {
  if (!level) return '未知'
  if (level === 1) return '简单'
  if (level === 2) return '中等'
  if (level === 3) return '困难'
  return level.toString()
}

// === 初始化 ===
onMounted(() => {
  Promise.all([loadNodes(), loadConnections(), loadStudents(), loadHistory()])
})
</script>

<template>
  <div class="workflow-panel-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div>
        <h2 class="page-title">
          <el-icon><Connection /></el-icon>
          Dify 工作流编排面板
        </h2>
        <p class="page-subtitle">模拟 Dify workflow 的节点编排能力，支持单个学生出题、多个学生批量分析与出题</p>
      </div>
    </div>

    <div class="main-content">
      <!-- 左侧：工作流画布 -->
      <div class="left-panel">
        <el-card shadow="never" class="canvas-card">
          <template #header>
            <div class="card-head">
              <span><el-icon><Grid /></el-icon> 工作流画布</span>
              <div class="legend">
                <span class="legend-item"><span class="legend-dot" style="background:#409eff"></span> HTTP节点</span>
                <span class="legend-item"><span class="legend-dot" style="background:#909399"></span> LLM节点</span>
                <span class="legend-item"><span class="legend-dot" style="background:#67c23a"></span> 代码节点</span>
              </div>
            </div>
          </template>

          <div class="vue-flow-wrapper">
            <VueFlow
              v-model:nodes="nodes"
              v-model:edges="edges"
              :default-zoom="0.6"
              :default-center="{ x: 500, y: 350 }"
              :min-zoom="0.2"
              :max-zoom="2"
              @nodes-change="onNodesChangeHandler"
              @edges-change="onEdgesChangeHandler"
              @connect="onConnectHandler"
            >
              <Controls />
              <MiniMap />

              <!-- 自定义节点 -->
              <template #node-custom="{ data, id }">
                <div
                  class="custom-node"
                  :class="[`node-${data.nodeType.toLowerCase()}`, {
                    'node-success': nodeStatus[id] === 'success',
                    'node-failed': nodeStatus[id] === 'failed',
                    'node-running': nodeStatus[id] === 'running'
                  }]"
                >
                  <div class="node-header">
                    <span class="node-icon">{{ data.nodeType === 'HTTP' ? '🌐' : data.nodeType === 'LLM' ? '🧠' : '💻' }}</span>
                    <span class="node-name">{{ data.label }}</span>
                    <span v-if="data.model" class="node-model">{{ data.model }}</span>
                  </div>
                  <div class="node-body">
                    <div class="node-desc">{{ data.description }}</div>
                    <div class="node-io">
                      <div class="io-section">
                        <span class="io-label">输入:</span>
                        <span class="io-items">
                          <span v-for="input in data.inputs" :key="input.name" class="io-item">
                            {{ input.label }}<span v-if="input.required" class="required">*</span>
                          </span>
                        </span>
                      </div>
                      <div class="io-section">
                        <span class="io-label">输出:</span>
                        <span class="io-items">
                          <span v-for="output in data.outputs" :key="output.name" class="io-item">
                            {{ output.label }}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div v-if="nodeStatus[id]" class="node-status">
                    <span :class="`status-${nodeStatus[id]}`">{{ nodeStatus[id] === 'success' ? '✓ 成功' : nodeStatus[id] === 'failed' ? '✗ 失败' : '◐ 执行中' }}</span>
                  </div>
                </div>
              </template>
            </VueFlow>
          </div>
        </el-card>

        <!-- 执行控制 -->
        <el-card shadow="never" class="control-card">
          <template #header>
            <span><el-icon><VideoPlay /></el-icon> 执行控制</span>
          </template>

          <el-form label-width="100px" class="execute-form">
            <!-- 工作流模式切换 -->
            <el-form-item label="工作流模式">
              <el-radio-group v-model="workflowMode">
                <el-radio-button label="single">{{ modeLabel.single }}</el-radio-button>
                <el-radio-button label="batch">{{ modeLabel.batch }}</el-radio-button>
              </el-radio-group>
            </el-form-item>

            <!-- 学生选择 -->
            <el-form-item :label="workflowMode === 'single' ? '选择学生' : '选择学生（多选）'">
              <el-select
                v-model="selectedStudentIds"
                :multiple="workflowMode === 'batch'"
                filterable
                :placeholder="workflowMode === 'single' ? '搜索学生（姓名/用户名）' : '搜索学生（支持多选，至少选择2个）'"
                style="width: 100%"
              >
                <el-option
                  v-for="s in students"
                  :key="s.id"
                  :label="`${s.realName || s.username}（${s.username}）`"
                  :value="s.id"
                />
              </el-select>
              <div v-if="selectedStudentIds.length > 0" class="selected-students">
                <span class="selected-count">已选择 {{ selectedStudentIds.length }} 名学生</span>
                <span v-if="workflowMode === 'batch'" class="selected-names">{{ selectedStudents.map(s => s.realName || s.username).join('、') }}</span>
              </div>
            </el-form-item>

            <!-- 生成题量 -->
            <el-form-item label="生成题量">
              <el-slider v-model="questionCount" :min="10" :max="100" :step="5" show-input />
            </el-form-item>

            <div class="execute-button">
              <el-button
                type="primary"
                size="large"
                :loading="executing"
                :disabled="workflowMode === 'single' ? selectedStudentIds.length !== 1 : selectedStudentIds.length < 2"
                @click="doExecute"
              >
                <el-icon><VideoPlay /></el-icon>
                 {{ executing ? '执行中...' : workflowMode === 'single' ? '启动工作流' : '启动批量工作流' }}
              </el-button>
            </div>
          </el-form>
        </el-card>
      </div>

      <!-- 右侧：执行结果 -->
      <div class="right-panel">
        <!-- 执行结果展示 -->
        <el-card shadow="never" class="result-card">
          <template #header>
            <span><el-icon><Document /></el-icon> 执行结果</span>
          </template>

          <div v-if="!executionResult" class="empty-result">
            <el-empty description="选择学生并启动工作流查看结果" :image-size="80" />
          </div>

          <div v-else class="result-content">
            <!-- 执行概览 -->
            <div class="result-summary">
              <div class="summary-item">
                <span class="summary-label">执行ID</span>
                <span class="summary-value">{{ executionResult.executionId }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">工作流模式</span>
                <el-tag :type="workflowMode === 'single' ? 'primary' : 'success'">{{ modeLabel[workflowMode] }}</el-tag>
              </div>
              <div class="summary-item">
                <span class="summary-label">目标学生</span>
                <span class="summary-value">{{ workflowMode === 'single' ? getStudentName(executionResult.userId) : `${selectedStudentIds.length}名学生` }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">执行状态</span>
                <el-tag :type="statusColor[executionResult.status]">{{ statusLabel[executionResult.status] }}</el-tag>
              </div>
              <div class="summary-item">
                <span class="summary-label">开始时间</span>
                <span class="summary-value">{{ formatTime(executionResult.startTime) }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">结束时间</span>
                <span class="summary-value">{{ formatTime(executionResult.endTime) }}</span>
              </div>
            </div>

            <!-- 节点执行状态 -->
            <div class="node-status-list">
              <h4>节点执行状态</h4>
              <div v-for="record in executionResult.nodeResults" :key="record.nodeId" class="status-item">
                <div class="status-header">
                  <span class="status-node">{{ workflowNodes.find(n => n.nodeId === record.nodeId)?.nodeName }}</span>
                  <el-tag :type="record.status === 'SUCCESS' ? 'success' : 'danger'" size="small">
                    {{ record.status }}
                  </el-tag>
                </div>
                <div class="status-detail">
                  <span>耗时: {{ record.durationMs ? (record.durationMs / 1000).toFixed(1) + 's' : '-' }}</span>
                  <span v-if="record.errorMessage" class="error-msg">{{ record.errorMessage }}</span>
                </div>
              </div>
            </div>

            <!-- 单个学生结果 -->
            <template v-if="workflowMode === 'single' && executionResult.result">
              <!-- 生成试卷 -->
              <template v-if="executionResult.result.paper">
                <div class="final-result">
                  <h4>📝 生成试卷</h4>
                  <div class="paper-info">
                    <div class="paper-title">{{ executionResult.result.paper.title }}</div>
                    <div class="paper-stats">
                      <span>题目数: {{ executionResult.result.paper.questionCount }}</span>
                      <span>总分: {{ executionResult.result.paper.totalScore }}分</span>
                    </div>
                    <div v-if="executionResult.result.summary" class="paper-summary">{{ executionResult.result.summary }}</div>
                  </div>
                </div>
              </template>
              
              <!-- 题目保存状态 -->
              <template v-if="executionResult.result.savedQuestionCount !== undefined">
                <div class="save-status">
                  <h4>💾 题目保存状态</h4>
                  <div class="save-stats">
                    <div class="save-stat-item">
                      <span class="save-stat-label">生成题目数</span>
                      <span class="save-stat-value">{{ executionResult.result.generatedQuestionCount }}</span>
                    </div>
                    <div class="save-stat-item">
                      <span class="save-stat-label">成功保存</span>
                      <span class="save-stat-value success">{{ executionResult.result.savedQuestionCount }}</span>
                    </div>
                    <div class="save-stat-item">
                      <span class="save-stat-label">保存状态</span>
                      <el-tag :type="executionResult.result.savedQuestionCount > 0 ? 'success' : 'warning'">
                        {{ executionResult.result.savedQuestionCount > 0 ? '已保存到题库' : '未保存' }}
                      </el-tag>
                    </div>
                  </div>
                </div>
              </template>
              
              <!-- 生成的题目列表 -->
              <template v-if="executionResult.result.taggedQuestions?.length || executionResult.result.validQuestions?.length || executionResult.result.questions?.length">
                <div class="generated-questions">
                  <h4>📋 生成题目预览</h4>
                  <div class="questions-preview">
                    <div 
                      v-for="(q, idx) in generatedQuestions.slice(0, 5)" 
                      :key="idx" 
                      class="question-preview-item"
                    >
                      <div class="question-index">{{ idx + 1 }}</div>
                      <div class="question-content">
                        <div class="question-stem">{{ q.stem }}</div>
                        <div class="question-meta">
                          <span class="meta-item">题型: {{ formatQuestionType(q.questionType) }}</span>
                          <span class="meta-item">难度: {{ formatDifficulty(q.difficulty) }}</span>
                          <span class="meta-item">答案: {{ q.standardAnswer }}</span>
                        </div>
                        <div v-if="q.analysis" class="question-analysis">{{ q.analysis }}</div>
                      </div>
                    </div>
                  </div>
                  <div v-if="generatedQuestions.length > 5" class="more-hint">
                    还有 {{ generatedQuestions.length - 5 }} 道题目未显示...
                  </div>
                </div>
              </template>
            </template>

            <!-- 批量学生结果 - 班级统计 -->
            <template v-if="workflowMode === 'batch' && executionResult.result?.classStats">
              <div class="batch-result">
                <!-- 班级统计 -->
                <div class="class-stats">
                  <h4>📊 班级统计</h4>
                  <div class="stats-grid">
                    <div class="stat-card">
                      <div class="stat-value">{{ executionResult.result.classStats.totalStudents }}</div>
                      <div class="stat-label">学生总数</div>
                    </div>
                    <div class="stat-card">
                      <div class="stat-value">{{ executionResult.result.classStats.totalExams }}</div>
                      <div class="stat-label">总考试次数</div>
                    </div>
                    <div class="stat-card highlight">
                      <div class="stat-value">{{ executionResult.result.classStats.averageScore }}</div>
                      <div class="stat-label">平均成绩</div>
                    </div>
                    <div class="stat-card">
                      <div class="stat-value">{{ executionResult.result.classStats.averageAccuracy }}%</div>
                      <div class="stat-label">平均正确率</div>
                    </div>
                    <div class="stat-card">
                      <div class="stat-value">{{ executionResult.result.classStats.totalWrongQuestions }}</div>
                      <div class="stat-label">总错题数</div>
                    </div>
                    <div class="stat-card">
                      <div class="stat-value">{{ executionResult.result.classStats.avgWrongPerStudent }}</div>
                      <div class="stat-label">人均错题数</div>
                    </div>
                  </div>
                </div>

                <!-- 薄弱点分布 -->
                <div v-if="executionResult.result?.weakDistribution?.length" class="weak-distribution">
                  <h4>📈 薄弱知识点分布</h4>
                  <div class="distribution-list">
                    <div v-for="(item, i) in executionResult.result.weakDistribution.slice(0, 5)" :key="i" class="distribution-item">
                      <div class="dist-rank" :class="{ top3: Number(i) < 3 }">{{ Number(i) + 1 }}</div>
                      <div class="dist-info">
                        <div class="dist-name">{{ item.categoryName }}</div>
                        <div class="dist-bar">
                          <div class="dist-progress" :style="{ width: Math.min(Number(item.wrongRate), 100) + '%' }"></div>
                        </div>
                        <div class="dist-stats">
                          <span>{{ item.totalWrong }}人次出错</span>
                          <span>错误率 {{ item.wrongRate }}%</span>
                          <span>{{ item.studentCount }}人涉及</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 成绩分布 -->
                <div v-if="executionResult.result?.scoreDistribution" class="score-distribution">
                  <h4>📊 成绩分布</h4>
                  <div class="score-bars">
                    <div class="score-bar">
                      <span class="score-label">优秀(≥90)</span>
                      <div class="score-bar-track">
                        <div class="score-bar-fill excellent" :style="{ width: executionResult.result.scoreDistribution.excellentRate + '%' }"></div>
                      </div>
                      <span class="score-value">{{ executionResult.result.scoreDistribution.excellent }}人 ({{ executionResult.result.scoreDistribution.excellentRate }}%)</span>
                    </div>
                    <div class="score-bar">
                      <span class="score-label">良好(80-89)</span>
                      <div class="score-bar-track">
                        <div class="score-bar-fill good" :style="{ width: executionResult.result.scoreDistribution.goodRate + '%' }"></div>
                      </div>
                      <span class="score-value">{{ executionResult.result.scoreDistribution.good }}人 ({{ executionResult.result.scoreDistribution.goodRate }}%)</span>
                    </div>
                    <div class="score-bar">
                      <span class="score-label">中等(60-79)</span>
                      <div class="score-bar-track">
                        <div class="score-bar-fill medium" :style="{ width: executionResult.result.scoreDistribution.mediumRate + '%' }"></div>
                      </div>
                      <span class="score-value">{{ executionResult.result.scoreDistribution.medium }}人 ({{ executionResult.result.scoreDistribution.mediumRate }}%)</span>
                    </div>
                    <div class="score-bar">
                      <span class="score-label">不及格(&lt;60)</span>
                      <div class="score-bar-track">
                        <div class="score-bar-fill poor" :style="{ width: executionResult.result.scoreDistribution.poorRate + '%' }"></div>
                      </div>
                      <span class="score-value">{{ executionResult.result.scoreDistribution.poor }}人 ({{ executionResult.result.scoreDistribution.poorRate }}%)</span>
                    </div>
                  </div>
                </div>

                <!-- 个人分析 -->
                <div v-if="executionResult.result?.individualAnalysis?.length" class="individual-analysis">
                  <h4>🏆 学生排名分析</h4>
                  <div class="rank-list">
                    <div v-for="item in executionResult.result.individualAnalysis.slice(0, 10)" :key="item.userId" class="rank-item">
                      <div class="rank-num" :class="{ top3: item.rank <= 3 }">
                        {{ item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : item.rank }}
                      </div>
                      <div class="rank-info">
                        <div class="rank-name">{{ item.realName || item.username }}</div>
                        <div class="rank-desc">薄弱: {{ item.weakestCategory }}</div>
                      </div>
                      <div class="rank-score">
                        <div class="rank-score-value">{{ item.averageScore }}</div>
                        <div class="rank-score-label">平均分</div>
                      </div>
                      <div class="rank-accuracy">
                        <div class="rank-acc-value">{{ item.overallAccuracy }}%</div>
                        <div class="rank-acc-label">正确率</div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 教学建议 -->
                <div v-if="executionResult.result?.suggestions" class="suggestions">
                  <h4>💡 教学建议</h4>
                  <div class="suggestions-content">{{ executionResult.result.suggestions }}</div>
                </div>

                <!-- 批量出题结果 -->
                <div v-if="executionResult.result?.batchPapers?.length" class="batch-papers">
                  <h4>📝 批量试卷</h4>
                  <div class="papers-list">
                    <div v-for="paper in executionResult.result.batchPapers" :key="paper.studentIndex" class="paper-item">
                      <span class="paper-title">{{ paper.paperTitle }}</span>
                      <span class="paper-count">共{{ paper.questionCount }}题</span>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </el-card>

        <!-- 执行历史 -->
        <el-card shadow="never" class="history-card">
          <template #header>
            <span><el-icon><Clock /></el-icon> 执行历史</span>
          </template>

          <div class="history-list">
            <div
              v-for="item in executionHistory"
              :key="item.executionId"
              class="history-item"
              :class="{ 'is-selected': selectedExecutionId === item.executionId }"
              @click="viewExecution(item.executionId)"
            >
              <div class="history-header">
                <el-tag :type="statusColor[item.status]" size="small">{{ statusLabel[item.status] }}</el-tag>
                <span class="history-time">{{ formatTime(item.startTime) }}</span>
              </div>
              <div class="history-detail">
                <span>学生: {{ getStudentName(item.userId) }}</span>
                <span>节点: {{ item.nodeResults?.length || 0 }}个</span>
              </div>
            </div>
          </div>
        </el-card>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.workflow-panel-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: calc(100vh - 120px);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

.page-subtitle {
  margin: 4px 0 0;
  color: #909399;
  font-size: 13px;
}

.main-content {
  display: flex;
  gap: 16px;
  flex: 1;
  overflow: hidden;
}

.left-panel {
  flex: 1.5;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
}

.right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.canvas-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}

.legend {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #606266;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.vue-flow-wrapper {
  flex: 1;
  width: 100%;
  height: 500px;
  min-height: 400px;
  background: #f5f7fa;
  border-radius: 6px;
}

.custom-node {
  padding: 8px;
  border-radius: 8px;
  min-width: 180px;
  max-width: 220px;
  background: #909399;
  color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;

  &.node-http { background: #409eff; }
  &.node-llm { background: #909399; }
  &.node-code { background: #67c23a; }

  &.node-success { box-shadow: 0 0 12px rgba(103, 194, 58, 0.5); border: 2px solid #67c23a; }
  &.node-failed { box-shadow: 0 0 12px rgba(245, 108, 108, 0.5); border: 2px solid #f56c6c; }
  &.node-running { animation: pulse 1s infinite; }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.node-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.node-icon {
  font-size: 14px;
}

.node-name {
  font-size: 13px;
  font-weight: 600;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-model {
  font-size: 10px;
  background: rgba(255, 255, 255, 0.2);
  padding: 1px 4px;
  border-radius: 3px;
}

.node-body {
  font-size: 11px;
}

.node-desc {
  margin-bottom: 6px;
  opacity: 0.9;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.node-io {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.io-section {
  display: flex;
  gap: 4px;
  align-items: flex-start;
}

.io-label {
  color: rgba(255, 255, 255, 0.7);
  flex-shrink: 0;
}

.io-items {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.io-item {
  background: rgba(255, 255, 255, 0.2);
  padding: 1px 4px;
  border-radius: 3px;
}

.required {
  color: #ffcccc;
}

.node-status {
  margin-top: 6px;
  padding-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  text-align: center;
  font-size: 11px;
}

.status-success { color: #95de64; }
.status-failed { color: #ff7875; }
.status-running { color: #ffc53d; }

.control-card {
  flex-shrink: 0;
}

.execute-form {
  padding-top: 8px;
}

.selected-students {
  margin-top: 8px;
  padding: 8px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 12px;

  .selected-count {
    font-weight: 600;
    color: #409eff;
  }

  .selected-names {
    display: block;
    margin-top: 4px;
    color: #606266;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.execute-button {
  margin-top: 8px;
  text-align: center;
}

.result-card,
.history-card {
  flex-shrink: 0;
}

.empty-result {
  padding: 40px 0;
}

.result-content {
  padding-top: 8px;
}

.result-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
  margin-bottom: 16px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-label {
  font-size: 12px;
  color: #909399;
}

.summary-value {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  word-break: break-all;
}

.node-status-list {
  margin-bottom: 16px;
}

.node-status-list h4 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.status-item {
  padding: 10px 12px;
  background: #fafafa;
  border-radius: 6px;
  margin-bottom: 8px;
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.status-node {
  font-size: 13px;
  font-weight: 500;
}

.status-detail {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #909399;
}

.error-msg {
  color: #f56c6c;
}

/* 单个学生结果 */
.final-result {
  padding-top: 12px;
  border-top: 1px dashed #dcdfe6;
}

.final-result h4 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
}

.paper-info {
  background: #f0f9ff;
  padding: 12px;
  border-radius: 6px;
  border-left: 3px solid #409eff;
}

.paper-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}

.paper-stats {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #606266;
  margin-bottom: 8px;
}

.paper-summary {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  white-space: pre-wrap;
}

/* 批量学生结果 */
.batch-result {
  padding-top: 12px;
  border-top: 1px dashed #dcdfe6;
}

.batch-result h4 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

/* 班级统计 */
.class-stats {
  margin-bottom: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.stat-card {
  background: #fafafa;
  padding: 12px;
  border-radius: 6px;
  text-align: center;

  &.highlight {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;

    .stat-label {
      color: rgba(255, 255, 255, 0.8);
    }
  }

  .stat-value {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .stat-label {
    font-size: 12px;
    color: #909399;
  }
}

/* 薄弱点分布 */
.weak-distribution {
  margin-bottom: 16px;
}

.distribution-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.distribution-item {
  display: flex;
  gap: 10px;
  padding: 10px;
  background: #fafafa;
  border-radius: 6px;
}

.dist-rank {
  width: 24px;
  height: 24px;
  line-height: 24px;
  text-align: center;
  background: #e4e7ed;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 600;
  color: #606266;
  flex-shrink: 0;

  &.top3 {
    background: #409eff;
    color: #fff;
  }
}

.dist-info {
  flex: 1;
}

.dist-name {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 4px;
}

.dist-bar {
  height: 6px;
  background: #e4e7ed;
  border-radius: 3px;
  margin-bottom: 4px;
  overflow: hidden;
}

.dist-progress {
  height: 100%;
  background: linear-gradient(90deg, #f56c6c, #e6a23c);
  border-radius: 3px;
  transition: width 0.5s ease;
}

.dist-stats {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: #909399;
}

/* 成绩分布 */
.score-distribution {
  margin-bottom: 16px;
}

.score-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.score-bar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.score-label {
  width: 100px;
  font-size: 12px;
  color: #606266;
}

.score-bar-track {
  flex: 1;
  height: 16px;
  background: #f0f0f0;
  border-radius: 8px;
  overflow: hidden;
}

.score-bar-fill {
  height: 100%;
  border-radius: 8px;
  transition: width 0.5s ease;

  &.excellent { background: linear-gradient(90deg, #67c23a, #85ce61); }
  &.good { background: linear-gradient(90deg, #409eff, #66b1ff); }
  &.medium { background: linear-gradient(90deg, #e6a23c, #ebb563); }
  &.poor { background: linear-gradient(90deg, #f56c6c, #f89898); }
}

.score-value {
  width: 100px;
  font-size: 12px;
  color: #606266;
  text-align: right;
}

/* 个人分析 */
.individual-analysis {
  margin-bottom: 16px;
}

.rank-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rank-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: #fafafa;
  border-radius: 6px;
}

.rank-num {
  width: 28px;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  color: #909399;

  &.top3 {
    font-size: 18px;
  }
}

.rank-info {
  flex: 1;
}

.rank-name {
  font-size: 13px;
  font-weight: 500;
}

.rank-desc {
  font-size: 11px;
  color: #909399;
}

.rank-score,
.rank-accuracy {
  text-align: center;
  min-width: 60px;
}

.rank-score-value,
.rank-acc-value {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.rank-score-label,
.rank-acc-label {
  font-size: 11px;
  color: #909399;
}

/* 教学建议 */
.suggestions {
  margin-bottom: 16px;
}

.suggestions-content {
  background: #f0f9ff;
  padding: 12px;
  border-radius: 6px;
  border-left: 3px solid #409eff;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  color: #606266;
}

/* 批量试卷 */
.batch-papers {
  margin-bottom: 16px;
}

.papers-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.paper-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: #fafafa;
  border-radius: 4px;
  font-size: 13px;
}

.paper-count {
  color: #909399;
  font-size: 12px;
}

/* 历史记录 */
.history-list {
  max-height: 300px;
  overflow-y: auto;
}

.history-item {
  padding: 10px;
  background: #fafafa;
  border-radius: 6px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #f0f0f0;
  }

  &.is-selected {
    background: #e6f7ff;
    border: 1px solid #91d5ff;
  }
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.history-time {
  font-size: 12px;
  color: #909399;
}

.history-detail {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #606266;
}

/* 保存状态 */
.save-status {
  margin-bottom: 16px;
  padding-top: 12px;
  border-top: 1px dashed #dcdfe6;
}

.save-status h4 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.save-stats {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.save-stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.save-stat-label {
  font-size: 12px;
  color: #909399;
}

.save-stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #303133;

  &.success {
    color: #67c23a;
  }
}

/* 生成题目预览 */
.generated-questions {
  margin-bottom: 16px;
  padding-top: 12px;
  border-top: 1px dashed #dcdfe6;
}

.generated-questions h4 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.questions-preview {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.question-preview-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #fafafa;
  border-radius: 6px;
}

.question-index {
  width: 28px;
  height: 28px;
  line-height: 28px;
  text-align: center;
  background: #409eff;
  color: #fff;
  border-radius: 50%;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}

.question-content {
  flex: 1;
}

.question-stem {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  color: #303133;
}

.question-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}

.meta-item {
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 4px;
}

.question-analysis {
  font-size: 12px;
  color: #606266;
  line-height: 1.5;
  padding-left: 12px;
  border-left: 2px solid #409eff;
}

.more-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
  text-align: center;
}
</style>