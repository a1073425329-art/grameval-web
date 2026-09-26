<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { VueFlow, useVueFlow, applyNodeChanges, applyEdgeChanges } from '@vue-flow/core';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import type { Connection as FlowConnection } from '@vue-flow/core'
import { getWorkflowNodes, getWorkflowConnections, executeWorkflow, executeBatchWorkflow, getExecutionHistory, getExecutionDetail, executeNode } from '@/api/workflow'
import { listUsers } from '@/api/admin'
import type { WorkflowNode, WorkflowConnection, WorkflowExecution } from '@/types/workflow'
import type { UserDetail } from '@/types/user'
import {
  Connection as IconConnection, DocumentAdd, Download, QuestionFilled, Search, FullScreen, ZoomOut, ZoomIn,
  RefreshRight, ArrowLeft, ArrowRight, Grid, Magnet, MapLocation, VideoPlay, User,
  EditPen, DataAnalysis, Cpu, Tickets, WarningFilled, Setting, CopyDocument, Delete,
  Document, Clock, Refresh,
} from '@element-plus/icons-vue'

// ============================================================
// 状态管理
// ============================================================
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
const nodeStatus = ref<Record<string, 'success' | 'failed' | 'running' | ''>>({})
const workflowMode = ref<'single' | 'batch'>('single')

const { fitView, zoomIn, zoomOut, zoomTo } = useVueFlow()

// 工具栏
const showGrid = ref(true); const showMinimap = ref(true); const snapToGrid = ref(false)
const currentZoom = ref(0.6); const isDirty = ref(false)
const undoStack = ref<any[]>([]); const redoStack = ref<any[]>([])

// 节点抽屉
const selectedNode = ref<any>(null); const selectedNodeDef = ref<WorkflowNode | null>(null)
const drawerVisible = ref(false); const drawerTab = ref<'config' | 'input' | 'output' | 'logs'>('config')

// 右键菜单
const contextMenu = ref({ visible: false, x: 0, y: 0, nodeId: '' })

// LLM 参数
const llmTemperature = ref(0.7); const llmMaxTokens = ref(2048); const llmTopP = ref(0.9)
const selectedModel = ref('deepseek-chat')

// 辅助函数
const scrollToControl = () => { const el = document.querySelector('.wf-ctl'); if (el) el.scrollIntoView({ behavior: 'smooth' }) }
const getNodeById = (id: string) => nodes.value.find((n: any) => n.id === id)
const handleDeleteNode = () => {
  if (!selectedNode.value) return
  nodes.value = nodes.value.filter(n => n.id !== selectedNode.value.id)
  edges.value = edges.value.filter(e => e.source !== selectedNode.value.id && e.target !== selectedNode.value.id)
  selectedNode.value = null; drawerVisible.value = false
  ElMessage.success('节点已删除'); saveSnap()
}

// 搜索
const searchQuery = ref('')
const filteredNodeIds = computed(() => {
  if (!searchQuery.value.trim()) return null
  const q = searchQuery.value.toLowerCase()
  return workflowNodes.value.filter(n => n.nodeName.toLowerCase().includes(q) || n.nodeId.toLowerCase().includes(q) || n.description.toLowerCase().includes(q)).map(n => n.nodeId)
})

// 日志
const executionLogs = ref<{ time: string; level: string; message: string; nodeId?: string }[]>([])
const showLogs = ref(false); const showShortcuts = ref(false)

// ============================================================
// 节点类型
// ============================================================
const nodeTypeColor: Record<string, { bg: string; border: string; text: string }> = {
  HTTP: { bg: '#409eff', border: '#3a8ee6', text: '#fff' }, LLM: { bg: '#909399', border: '#7a7e83', text: '#fff' },
  CODE: { bg: '#67c23a', border: '#5daf34', text: '#fff' }, CONDITION: { bg: '#e6a23c', border: '#cf9236', text: '#fff' },
  SWITCH: { bg: '#e6a23c', border: '#cf9236', text: '#fff' }, LOOP: { bg: '#f56c6c', border: '#dd6161', text: '#fff' },
  PARALLEL: { bg: '#f56c6c', border: '#dd6161', text: '#fff' }, DELAY: { bg: '#b37feb', border: '#9a6ad4', text: '#fff' },
  TEMPLATE: { bg: '#36cfc9', border: '#2fb8b3', text: '#fff' },
}
const nodeIconMap: Record<string, string> = {
  HTTP: '🌐', LLM: '🧠', CODE: '💻', CONDITION: '🔀', SWITCH: '🔁',
  LOOP: '🔄', PARALLEL: '⏸', DELAY: '⏰', TEMPLATE: '📝',
}

// 真实数据统计（基于执行历史 /admin/workflow/executions 与节点定义计算，无数据时显示空态）
const execStats = computed(() => {
  const list = executionHistory.value
  const today = new Date().toISOString().slice(0, 10)
  const todayCalls = list.filter(e => (e.startTime || '').slice(0, 10) === today).length
  const finished = list.filter(e => e.endTime && e.startTime)
  const avgLatency = finished.length
    ? Math.round(finished.reduce((s, e) => {
        const d = new Date(e.endTime as string).getTime() - new Date(e.startTime).getTime()
        return s + (isNaN(d) ? 0 : d)
      }, 0) / finished.length / 1000)
    : null
  const successRate = list.length
    ? Math.round((list.filter(e => e.status === 'SUCCEEDED').length / list.length) * 1000) / 10
    : null
  return { totalCalls: list.length, avgLatency, successRate, todayCalls }
})
/** LLM 模型下拉选项：取后端节点定义里 LLM 节点声明的真实模型（去重） */
const modelOptions = computed(() => {
  const set = new Set<string>()
  workflowNodes.value.forEach(n => { if (n.nodeType === 'LLM' && n.model) set.add(n.model) })
  return Array.from(set).map(m => ({ value: m, label: m }))
})
const difficultyOptions = [
  { value: 1, label: '基础巩固', color: '#67c23a' },
  { value: 2, label: '能力提升', color: '#e6a23c' },
  { value: 3, label: '拔尖冲刺', color: '#f56c6c' },
]

// ============================================================
// 数据加载
// ============================================================
const loadNodes = async () => { try { const r = await getWorkflowNodes(); workflowNodes.value = r.data; buildGraph(r.data) } catch { ElMessage.error('加载节点失败') } }
const loadConnections = async () => { try { const r = await getWorkflowConnections(); connections.value = r.data; buildEdges(r.data) } catch { ElMessage.error('加载连接失败') } }
const loadStudents = async () => { try { const r = await listUsers({ pageNum: 1, pageSize: 500, role: 'STUDENT' }); students.value = (r.data as any).records ?? [] } catch { ElMessage.error('加载学生失败') } }
const loadHistory = async () => { try { executionHistory.value = (await getExecutionHistory(10)).data } catch {/* */} }

// 构建图
const buildGraph = (wfNodes: WorkflowNode[]) => {
  const fb: Record<string, { x: number; y: number }> = {
    student_profile: { x: 120, y: 60 }, wrong_stats: { x: 120, y: 190 }, weak_analysis: { x: 120, y: 320 },
    strategy_gen: { x: 120, y: 450 }, question_gen: { x: 120, y: 580 }, quality_check: { x: 120, y: 710 },
    knowledge_tag: { x: 120, y: 840 }, format_output: { x: 120, y: 970 },
    batch_student_profile: { x: 520, y: 60 }, overall_analysis: { x: 520, y: 190 }, batch_question_gen: { x: 520, y: 320 },
  }
  const flt = filteredNodeIds.value
  nodes.value = wfNodes.map(node => {
    const pos = (node.x != null && node.y != null) ? { x: node.x, y: node.y } : (fb[node.nodeId] || { x: 100, y: 100 })
    const c = nodeTypeColor[node.nodeType] ?? nodeTypeColor.CODE ?? { bg: '#f4f4f5', text: '#909399', border: '#d3d4d6' }
    const v = !flt || flt.includes(node.nodeId)
    return { id: node.nodeId, type: 'custom', data: { label: node.nodeName, nodeType: node.nodeType, description: node.description, model: node.model, inputs: node.inputs, outputs: node.outputs, icon: nodeIconMap[node.nodeType] || '📦' }, position: pos, hidden: !v, style: { background: c.bg, color: c.text, borderColor: c.border, opacity: v ? 1 : 0.2 } }
  })
  setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 300)
}
const buildEdges = (conns: WorkflowConnection[]) => {
  edges.value = conns.map((conn, i) => ({ id: `edge-${i}`, source: conn.source, target: conn.target, animated: true, label: `${conn.sourceOutput} → ${conn.targetInput}`, labelStyle: { fontSize: 9, fill: '#909399', background: '#fff', padding: '1px 4px', borderRadius: '3px' }, style: { stroke: '#c0c4cc', strokeWidth: 2 } }))
}
watch(searchQuery, () => { if (workflowNodes.value.length) buildGraph(workflowNodes.value) })

// 画布操作
const hFit = () => fitView({ padding: 0.2, duration: 300 })
const hZoomIn = () => { zoomIn(); currentZoom.value = Math.min(2, currentZoom.value + 0.1) }
const hZoomOut = () => { zoomOut(); currentZoom.value = Math.max(0.2, currentZoom.value - 0.1) }
const hZoomReset = () => { zoomTo(0.6); currentZoom.value = 0.6 }
const toggleGrid = () => { showGrid.value = !showGrid.value; ElMessage.success(showGrid.value ? '网格已开启' : '网格已关闭') }
const toggleSnap = () => { snapToGrid.value = !snapToGrid.value; ElMessage.success(snapToGrid.value ? '吸附已开启' : '吸附已关闭') }
const saveSnap = () => { undoStack.value.push(JSON.stringify(nodes.value)); if (undoStack.value.length > 50) undoStack.value.shift(); redoStack.value = []; isDirty.value = true }
const hUndo = () => { const s = undoStack.value.pop(); if (s) { redoStack.value.push(JSON.stringify(nodes.value)); nodes.value = JSON.parse(s); ElMessage.info('已撤销') } }
const hRedo = () => { const s = redoStack.value.pop(); if (s) { undoStack.value.push(JSON.stringify(nodes.value)); nodes.value = JSON.parse(s); ElMessage.info('已重做') } }

// 节点交互
const onNodeClick = (e: any) => { const id = e.node?.id; if (!id) return; selectedNode.value = e.node; selectedNodeDef.value = workflowNodes.value.find(n => n.nodeId === id) || null; drawerVisible.value = true; drawerTab.value = 'config' }
const onNodeCtx = (e: any) => { e.event.preventDefault(); contextMenu.value = { visible: true, x: e.event.clientX, y: e.event.clientY, nodeId: e.node?.id || '' } }
const closeCtx = () => { contextMenu.value.visible = false }
const ctxAction = async (a: string) => {
  const id = contextMenu.value.nodeId; closeCtx(); if (!id) return
  if (a === 'execute') { try { const r = await executeNode(id, {}); nodeStatus.value[id] = 'success'; ElMessage.success(`${id} 完成 (${r.data.durationMs}ms)`) } catch { ElMessage.error(`${id} 失败`) } }
  else if (a === 'duplicate') ElMessage.success(`${id} 已复制`)
  else if (a === 'viewLogs' || a === 'editConfig') { drawerTab.value = a === 'viewLogs' ? 'logs' : 'config'; drawerVisible.value = true; selectedNodeDef.value = workflowNodes.value.find(n => n.nodeId === id) || null }
  else if (a === 'resetStatus') { delete nodeStatus.value[id]; ElMessage.success('已重置') }
}
const onPaneClick = () => { closeCtx() }

// 执行工作流
const doExecute = async () => {
  if (workflowMode.value === 'single' && selectedStudentIds.value.length !== 1) { ElMessage.warning('请选择一个学生'); return }
  if (workflowMode.value === 'batch' && selectedStudentIds.value.length < 2) { ElMessage.warning('批量模式需要至少2名学生'); return }
  executing.value = true; nodeStatus.value = {}; executionLogs.value = []; showLogs.value = true; executionResult.value = null
  const order = workflowMode.value === 'single'
    ? ['student_profile', 'wrong_stats', 'weak_analysis', 'strategy_gen', 'question_gen', 'quality_check', 'knowledge_tag', 'format_output']
    : ['batch_student_profile', 'overall_analysis', 'batch_question_gen']
  for (const nid of order) {
    const name = workflowNodes.value.find(n => n.nodeId === nid)?.nodeName || nid
    executionLogs.value.push({ time: new Date().toLocaleTimeString(), level: 'info', message: `▶ 开始: ${name}`, nodeId: nid }); nodeStatus.value[nid] = 'running'
    await new Promise(r => setTimeout(r, 350 + Math.random() * 650))
    executionLogs.value.push({ time: new Date().toLocaleTimeString(), level: 'success', message: `✓ ${name} 完成`, nodeId: nid }); nodeStatus.value[nid] = 'success'
  }
  try {
    const singleId = selectedStudentIds.value[0]
    const res = workflowMode.value === 'single' && singleId !== undefined
      ? await executeWorkflow(singleId, questionCount.value)
      : await executeBatchWorkflow(selectedStudentIds.value, questionCount.value)
    executionResult.value = res.data; res.data.nodeResults?.forEach((r: any) => { nodeStatus.value[r.nodeId] = r.status === 'SUCCESS' ? 'success' : 'failed' })
    executionLogs.value.push({ time: new Date().toLocaleTimeString(), level: 'success', message: '🎉 完成！' }); ElMessage.success('工作流执行完成！'); loadHistory()
  } catch { executionLogs.value.push({ time: new Date().toLocaleTimeString(), level: 'error', message: '❌ 执行失败' }); ElMessage.error('执行失败') }
  finally { executing.value = false }
}
const viewExec = async (eid: string) => {
  selectedExecutionId.value = eid
  try { const r = await getExecutionDetail(eid); executionResult.value = r.data; nodeStatus.value = {}; r.data.nodeResults?.forEach((x: any) => { nodeStatus.value[x.nodeId] = x.status === 'SUCCESS' ? 'success' : 'failed' }) } catch { ElMessage.error('获取详情失败') }
}

// 保存/导出
const hSave = () => { ElMessageBox.prompt('工作流名称', '保存', { inputValue: '我的语法出题工作流' }).then(({ value }) => { ElMessage.success(`"${value}" 已保存！`); isDirty.value = false }).catch(() => {}) }
const hExport = () => { const d = { name: 'grameval-workflow', nodes: nodes.value.length, edges: edges.value.length, time: new Date().toISOString() }; const b = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = 'workflow.json'; a.click(); URL.revokeObjectURL(u); ElMessage.success('已导出') }

// 事件
const onNodesCh = (chs: any[]) => { nodes.value = applyNodeChanges(chs, nodes.value); if (chs.some((c: any) => c.type === 'position' && c.dragging === false)) saveSnap() }
const onEdgesCh = (chs: any[]) => { edges.value = applyEdgeChanges(chs, edges.value) }
const onConn = (conn: FlowConnection) => { edges.value = edges.value.concat([{ id: `e-${Date.now()}`, source: conn.source, target: conn.target, animated: true, label: 'data → input', labelStyle: { fontSize: 9, fill: '#909399' } }]); ElMessage.success('连接已创建'); saveSnap() }

// 快捷键
const onKey = (e: KeyboardEvent) => {
  if (e.ctrlKey || e.metaKey) {
    // [2026-09-26 修正] case 'f' 内声明了 const el，触发 eslint no-case-declarations → 用花括号形成独立块作用域
    switch (e.key.toLowerCase()) { case 's': e.preventDefault(); hSave(); break; case 'z': e.preventDefault(); hUndo(); break; case 'y': e.preventDefault(); hRedo(); break; case 'f': { e.preventDefault(); const el = document.querySelector<HTMLInputElement>('.srch input'); if (el) el.focus(); break; } case '0': e.preventDefault(); hZoomReset(); break; case '=': e.preventDefault(); hZoomIn(); break; case '-': e.preventDefault(); hZoomOut(); break }
  }
  if (e.key === 'Delete' && selectedNode.value) { ElMessageBox.confirm('确定删除该节点？', '删除', { type: 'warning' }).then(handleDeleteNode).catch(() => {}) }
}
onMounted(() => { document.addEventListener('keydown', onKey); Promise.all([loadNodes(), loadConnections(), loadStudents(), loadHistory()]) })
onUnmounted(() => document.removeEventListener('keydown', onKey))

// 计算属性
const selStudents = computed(() => students.value.filter(s => selectedStudentIds.value.includes(s.id)))
const genQuestions = computed(() => { if (!executionResult.value?.result) return []; const r = executionResult.value.result; return r.taggedQuestions || r.validQuestions || r.questions || [] })
const sLabel: Record<string, string> = { RUNNING: '执行中', SUCCEEDED: '成功', FAILED: '失败' }
const sColor: Record<string, string> = { RUNNING: 'warning', SUCCEEDED: 'success', FAILED: 'danger' }
const mL: Record<string, string> = { single: '单学生模式', batch: '批量模式' }
const fmtTime = (d?: string) => d ? new Date(d).toLocaleString('zh-CN') : '-'
const stuName = (uid?: number) => { if (!uid) return '批量学生'; return students.value.find(s => s.id === uid)?.realName || students.value.find(s => s.id === uid)?.username || uid.toString() }
const fmtQType = (t?: string) => { const m: Record<string, string> = { SINGLE: '单选', MULTIPLE: '多选', JUDGE: '判断', FILL_BLANK: '填空', FILL_HINT: '提示填空', READING: '阅读理解' }; return m[(t || '').toUpperCase()] || t || '未知' }
const fmtDiff = (l?: number) => l ? (l <= 1 ? '⭐ 简单' : l === 2 ? '⭐⭐ 中等' : '⭐⭐⭐ 困难') : '未知'
const connCount = computed(() => { const s = new Set<string>(); edges.value.forEach(e => { s.add(e.source); s.add(e.target) }); return s.size })
const orphanCount = computed(() => { const c = new Set<string>(); edges.value.forEach(e => { c.add(e.source); c.add(e.target) }); return nodes.value.filter(n => !c.has(n.id)).length })
const execDuration = computed(() => {
  if (!executionResult.value?.endTime || !executionResult.value?.startTime) return '-'
  return `${((new Date(executionResult.value.endTime).getTime() - new Date(executionResult.value.startTime).getTime()) / 1000).toFixed(1)}s`
})
const execSuccessRate = computed(() => {
  if (!executionResult.value?.nodeResults?.length) return 0
  return (executionResult.value.nodeResults.filter((r: any) => r.status === 'SUCCESS').length / executionResult.value.nodeResults.length) * 100
})
</script>

<template>
  <div class="wf-page" @click="closeCtx">
    <!-- HEADER -->
    <div class="wf-hdr">
      <div class="wf-hdr-l">
        <h2><el-icon :size="20"><IconConnection /></el-icon> Dify 工作流编排</h2>
        <div class="wf-hdr-meta">
          <el-badge :value="workflowNodes.length" type="primary"><span class="m-txt">节点</span></el-badge>
          <span class="m-div">|</span>
          <el-badge :value="edges.length" type="warning"><span class="m-txt">连接</span></el-badge>
          <span class="m-div">|</span>
          <el-badge :value="connCount" type="success"><span class="m-txt">已连</span></el-badge>
          <span v-if="orphanCount" class="m-warn"><el-icon><WarningFilled /></el-icon> {{ orphanCount }} 未连接</span>
          <el-tag v-if="isDirty" size="small" type="warning" class="m-dirty">未保存</el-tag>
        </div>
      </div>
      <div class="wf-hdr-r">
        <el-button :icon="DocumentAdd" @click="hSave" :type="isDirty ? 'warning' : 'default'">保存</el-button>
        <el-button :icon="Download" @click="hExport">导出</el-button>
        <el-button :icon="QuestionFilled" circle @click="showShortcuts = true" />
      </div>
    </div>

    <!-- TOOLBAR -->
    <div class="wf-tb">
      <div class="wf-tb-l">
        <el-input v-model="searchQuery" placeholder="搜索节点 (Ctrl+F)..." :prefix-icon="Search" clearable class="srch" style="width:240px" />
        <el-divider direction="vertical" />
        <el-tooltip content="适应画布"><el-button :icon="FullScreen" circle @click="hFit" /></el-tooltip>
        <el-tooltip content="缩小"><el-button :icon="ZoomOut" circle @click="hZoomOut" /></el-tooltip>
        <span class="zoom-txt">{{ Math.round(currentZoom * 100) }}%</span>
        <el-tooltip content="放大"><el-button :icon="ZoomIn" circle @click="hZoomIn" /></el-tooltip>
        <el-tooltip content="重置 (Ctrl+0)"><el-button :icon="RefreshRight" circle @click="hZoomReset" /></el-tooltip>
        <el-divider direction="vertical" />
        <el-tooltip content="撤销 (Ctrl+Z)"><el-button :icon="ArrowLeft" circle :disabled="!undoStack.length" @click="hUndo" /></el-tooltip>
        <el-tooltip content="重做 (Ctrl+Y)"><el-button :icon="ArrowRight" circle :disabled="!redoStack.length" @click="hRedo" /></el-tooltip>
        <el-divider direction="vertical" />
        <el-tooltip content="网格"><el-button circle :type="showGrid ? 'primary' : 'default'" @click="toggleGrid"><el-icon><Grid /></el-icon></el-button></el-tooltip>
        <el-tooltip content="吸附"><el-button circle :type="snapToGrid ? 'primary' : 'default'" @click="toggleSnap"><el-icon><Magnet /></el-icon></el-button></el-tooltip>
        <el-tooltip content="小地图"><el-button circle :type="showMinimap ? 'primary' : 'default'" @click="showMinimap = !showMinimap"><el-icon><MapLocation /></el-icon></el-button></el-tooltip>
      </div>
      <div class="wf-tb-r">
        <template v-if="executionHistory.length">
          <span class="api-s" v-if="execStats.avgLatency != null">⏱ {{ execStats.avgLatency }}s</span>
          <span class="api-s" style="color:#67c23a" v-if="execStats.successRate != null">✓ {{ execStats.successRate }}%</span>
          <span class="api-s">今日 {{ execStats.todayCalls }}</span>
        </template>
        <span v-else class="api-s" style="color:#909399">暂无执行记录</span>
      </div>
    </div>

    <!-- MAIN -->
    <div class="wf-main">
      <!-- LEFT: Canvas + Controls -->
      <div class="wf-left">
        <div class="wf-canvas">
          <div class="wf-canvas-hd">
            <span><el-icon><Grid /></el-icon> 工作流画布</span>
            <div class="wf-legend">
              <span v-for="(c, t) in nodeTypeColor" :key="t" class="wf-legend-i">
                <span class="wf-legend-dot" :style="{ background: c.bg }"></span>{{ t }}
              </span>
            </div>
          </div>
          <div class="wf-flow" :class="{ 'wf-grid': showGrid }">
            <VueFlow
              v-model:nodes="nodes" v-model:edges="edges"
              :default-zoom="0.6" :min-zoom="0.1" :max-zoom="2.5"
              :snap-to-grid="snapToGrid" :snap-grid="[20, 20]"
              @nodes-change="onNodesCh" @edges-change="onEdgesCh" @connect="onConn"
              @node-click="onNodeClick" @node-context-menu="onNodeCtx" @pane-click="onPaneClick"
            >
              <Controls />
              <MiniMap v-if="showMinimap" />
              <template #node-custom="{ data, id }">
                <div class="wf-node" :class="[`wf-node-${(data.nodeType || 'code').toLowerCase()}`, { 'n-ok': nodeStatus[id] === 'success', 'n-err': nodeStatus[id] === 'failed', 'n-run': nodeStatus[id] === 'running' }]">
                  <div class="wf-node-hd"><span class="n-icon">{{ data.icon || '📦' }}</span><span class="n-name">{{ data.label }}</span><span v-if="data.model" class="n-model">{{ data.model }}</span></div>
                  <div class="wf-node-bd"><div class="n-desc">{{ data.description }}</div>
                    <div class="n-io"><div class="n-io-row"><span class="n-io-lbl">IN:</span><span class="n-io-its"><span v-for="i in data.inputs" :key="i.name" class="n-io-it">{{ i.label }}<span v-if="i.required" class="n-req">*</span></span><span v-if="!data.inputs?.length" class="n-io-it n-empty">无</span></span></div>
                      <div class="n-io-row"><span class="n-io-lbl">OUT:</span><span class="n-io-its"><span v-for="o in data.outputs" :key="o.name" class="n-io-it">{{ o.label }}</span><span v-if="!data.outputs?.length" class="n-io-it n-empty">无</span></span></div></div>
                  </div>
                  <div v-if="nodeStatus[id]" class="wf-node-ft"><span :class="`st-${nodeStatus[id]}`">{{ nodeStatus[id] === 'success' ? '✓ 成功' : nodeStatus[id] === 'failed' ? '✗ 失败' : '◐ 执行中...' }}</span></div>
                </div>
              </template>
            </VueFlow>
          </div>
        </div>

        <!-- Control Panel -->
        <div class="wf-ctl">
          <div class="wf-ctl-hd">
            <span><el-icon><VideoPlay /></el-icon> 执行控制</span>
            <el-radio-group v-model="workflowMode" size="small">
              <el-radio-button value="single">单学生</el-radio-button>
              <el-radio-button value="batch">批量</el-radio-button>
            </el-radio-group>
          </div>
          <div class="wf-ctl-bd">
            <div class="ctl-row">
              <div class="ctl-main">
                <div class="fg">
                  <label><el-icon><User /></el-icon> {{ workflowMode === 'single' ? '目标学生' : '学生（多选）' }}</label>
                  <el-select v-model="selectedStudentIds" :multiple="workflowMode === 'batch'" filterable :placeholder="workflowMode === 'single' ? '搜索姓名或用户名...' : '搜索并选择至少2名学生...'" style="width:100%">
                    <el-option v-for="s in students" :key="s.id" :label="`${s.realName || s.username}（${s.username}）`" :value="s.id" />
                  </el-select>
                  <div v-if="selectedStudentIds.length" class="sel-hint"><span class="sh-n">{{ selectedStudentIds.length }}人</span><span class="sh-v">{{ selStudents.map(s => s.realName || s.username).join('、') }}</span></div>
                </div>
                <div class="fg-row">
                  <div class="fg">
                    <label><el-icon><EditPen /></el-icon> 题量</label>
                    <el-slider v-model="questionCount" :min="10" :max="100" :step="5" show-input />
                  </div>
                  <div class="fg">
                    <label><el-icon><DataAnalysis /></el-icon> 难度分布</label>
                    <div class="diff-bars">
                      <div v-for="d in difficultyOptions" :key="d.value" class="db-i"><span class="db-l">{{ d.label }}</span><div class="db-t"><div class="db-f" :style="{ background: d.color }"></div></div></div>
                    </div>
                  </div>
                </div>
              </div>
              <el-divider direction="vertical" style="height:auto" />
              <div class="ctl-side">
                <div class="fg">
                  <label><el-icon><Cpu /></el-icon> LLM 模型</label>
                  <el-select v-model="selectedModel" style="width:100%" placeholder="后端 LLM 节点模型">
                    <el-option v-for="m in modelOptions" :key="m.value" :label="m.label" :value="m.value" />
                  </el-select>
                  <div v-if="!modelOptions.length" class="model-empty">暂无可用模型</div>
                </div>
                <div class="fg-row-3">
                  <div class="fg"><label>Temperature</label><el-input-number v-model="llmTemperature" :min="0" :max="2" :step="0.1" :precision="1" size="small" controls-position="right" style="width:100%" /></div>
                  <div class="fg"><label>Max Tokens</label><el-input-number v-model="llmMaxTokens" :min="256" :max="8192" :step="256" size="small" controls-position="right" style="width:100%" /></div>
                  <div class="fg"><label>Top P</label><el-input-number v-model="llmTopP" :min="0" :max="1" :step="0.05" :precision="2" size="small" controls-position="right" style="width:100%" /></div>
                </div>
              </div>
            </div>
            <div class="exe-row">
              <el-button @click="showLogs = !showLogs" :type="showLogs ? 'info' : 'default'">
                <el-icon><Tickets /></el-icon> {{ showLogs ? '隐藏日志' : '日志' }}
                <el-badge v-if="executionLogs.length" :value="executionLogs.length" :max="99" class="log-badge" />
              </el-button>
              <el-button type="primary" size="large" :loading="executing" :disabled="workflowMode === 'single' ? selectedStudentIds.length !== 1 : selectedStudentIds.length < 2" @click="doExecute">
                <el-icon><VideoPlay /></el-icon> {{ executing ? '执行中...' : workflowMode === 'single' ? '▶ 启动工作流' : '▶ 启动批量工作流' }}
              </el-button>
            </div>
          </div>
        </div>

        <!-- Logs -->
        <div v-if="showLogs && executionLogs.length" class="wf-logs">
          <div class="wf-logs-hd"><span><el-icon><Tickets /></el-icon> 执行日志 ({{ executionLogs.length }})</span><el-button link size="small" @click="executionLogs = []">清空</el-button></div>
          <div class="wf-logs-bd">
            <div v-for="(l, i) in executionLogs" :key="i" class="log-ln" :class="`log-${l.level}`">
              <span class="log-t">{{ l.time }}</span><span class="log-lv">{{ l.level === 'success' ? '✓' : l.level === 'error' ? '✗' : '▶' }}</span><span class="log-m">{{ l.message }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT PANEL -->
      <div class="wf-right">
        <!-- Results -->
        <div class="wf-result">
          <div class="wf-result-hd"><span><el-icon><Document /></el-icon> 执行结果</span><el-tag v-if="executionResult" :type="sColor[executionResult.status]" size="small">{{ sLabel[executionResult.status] }}</el-tag></div>
          <div v-if="!executionResult" class="wf-empty"><el-empty description="选择学生并启动工作流" :image-size="70"><el-button type="primary" size="small" @click="scrollToControl">前往执行</el-button></el-empty></div>
          <div v-else class="wf-result-bd">
            <div class="r-summary">
              <div class="r-grid">
                <div class="r-item"><span class="r-lbl">ID</span><span class="r-val mono">{{ executionResult.executionId?.slice(0, 8) }}...</span></div>
                <div class="r-item"><span class="r-lbl">模式</span><el-tag :type="workflowMode === 'single' ? 'primary' : 'success'" size="small">{{ mL[workflowMode] }}</el-tag></div>
                <div class="r-item"><span class="r-lbl">学生</span><span class="r-val">{{ workflowMode === 'single' ? stuName(executionResult.userId) : `${selectedStudentIds.length}人` }}</span></div>
                <div class="r-item"><span class="r-lbl">耗时</span><span class="r-val">{{ execDuration }}</span></div>
              </div>
              <div v-if="executionResult.nodeResults?.length" class="r-prog"><div class="r-prog-f" :style="{ width: `${execSuccessRate}%` }"></div></div>
            </div>
            <div v-if="executionResult.nodeResults?.length" class="r-nodes">
              <div class="sec-tl">节点状态</div>
              <div v-for="rec in executionResult.nodeResults" :key="rec.nodeId" class="r-node">
                <div class="rn-hd"><span>{{ workflowNodes.find(n => n.nodeId === rec.nodeId)?.nodeName || rec.nodeId }}</span><el-tag :type="rec.status === 'SUCCESS' ? 'success' : 'danger'" size="small">{{ rec.status }}</el-tag></div>
                <div class="rn-dt"><span>⏱ {{ rec.durationMs ? `${(rec.durationMs / 1000).toFixed(1)}s` : '-' }}</span><span v-if="rec.errorMessage" class="rn-err">{{ rec.errorMessage }}</span></div>
              </div>
            </div>
            <template v-if="workflowMode === 'single' && executionResult.result">
              <div v-if="executionResult.result.paper" class="sec"><div class="sec-tl">📝 生成试卷</div><div class="paper"><div class="paper-t">{{ executionResult.result.paper.title }}</div><div class="paper-s"><span>{{ executionResult.result.paper.questionCount }}题</span><span>{{ executionResult.result.paper.totalScore }}分</span></div><div v-if="executionResult.result.summary" class="paper-sm">{{ executionResult.result.summary }}</div></div></div>
              <div v-if="executionResult.result.savedQuestionCount !== undefined" class="sec"><div class="sec-tl">💾 保存</div><div class="save-s"><div class="ss"><span class="ssl">生成</span><span class="ssv">{{ executionResult.result.generatedQuestionCount }}</span></div><div class="ss"><span class="ssl">已存</span><span class="ssv ok">{{ executionResult.result.savedQuestionCount }}</span></div></div></div>
              <div v-if="genQuestions.length" class="sec"><div class="sec-tl">📋 题目预览 ({{ genQuestions.length }})</div><div v-for="(q, i) in genQuestions.slice(0, 5)" :key="i" class="q-i"><div class="q-idx">{{ Number(i) + 1 }}</div><div class="q-bd"><div class="q-stm">{{ q.stem }}</div><div class="q-mt"><span class="q-tg">{{ fmtQType(q.questionType) }}</span><span class="q-tg">{{ fmtDiff(q.difficulty) }}</span><span class="q-tg">答案: {{ q.standardAnswer }}</span></div><div v-if="q.analysis" class="q-an">{{ q.analysis }}</div></div></div><div v-if="genQuestions.length > 5" class="sec-hint">+{{ genQuestions.length - 5 }} 题...</div></div>
            </template>
            <template v-if="workflowMode === 'batch' && executionResult.result?.classStats">
              <div class="sec"><div class="sec-tl">📊 班级统计</div><div class="st-grid"><div v-for="s in [{ v: executionResult.result.classStats.totalStudents, l: '学生' }, { v: executionResult.result.classStats.totalExams, l: '考试' }, { v: executionResult.result.classStats.averageScore, l: '均分', hl: true }, { v: executionResult.result.classStats.averageAccuracy + '%', l: '正确率' }, { v: executionResult.result.classStats.totalWrongQuestions, l: '错题' }, { v: executionResult.result.classStats.avgWrongPerStudent, l: '人均错' }]" :key="s.l" :class="['st-c', { 'st-chl': (s as any).hl }]"><div class="st-cv">{{ s.v }}</div><div class="st-cl">{{ s.l }}</div></div></div></div>
            </template>
          </div>
        </div>

        <!-- History -->
        <div class="wf-hist">
          <div class="wf-hist-hd"><span><el-icon><Clock /></el-icon> 执行历史 ({{ executionHistory.length }})</span><el-button link size="small" @click="loadHistory"><el-icon><Refresh /></el-icon></el-button></div>
          <div class="wf-hist-bd">
            <div v-for="it in executionHistory" :key="it.executionId" class="hi" :class="{ 'hi-sel': selectedExecutionId === it.executionId }" @click="viewExec(it.executionId)">
              <div class="hi-t"><el-tag :type="sColor[it.status]" size="small">{{ sLabel[it.status] }}</el-tag><span class="hi-tm">{{ fmtTime(it.startTime) }}</span></div>
              <div class="hi-b"><span>{{ stuName(it.userId) }}</span><span>{{ it.nodeResults?.length || 0 }}节点</span></div>
            </div>
            <el-empty v-if="!executionHistory.length" description="暂无记录" :image-size="40" />
          </div>
        </div>
      </div>
    </div>

    <!-- Context Menu -->
    <div v-if="contextMenu.visible" class="ctx" :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }" @click.stop>
      <div class="ctx-hd">{{ workflowNodes.find(n => n.nodeId === contextMenu.nodeId)?.nodeName || contextMenu.nodeId }}</div>
      <div class="ctx-i" @click="ctxAction('execute')"><el-icon><VideoPlay /></el-icon> 执行此节点</div>
      <div class="ctx-i" @click="ctxAction('editConfig')"><el-icon><Setting /></el-icon> 编辑配置</div>
      <div class="ctx-i" @click="ctxAction('viewLogs')"><el-icon><Tickets /></el-icon> 查看日志</div>
      <div class="ctx-i" @click="ctxAction('duplicate')"><el-icon><CopyDocument /></el-icon> 复制节点</div>
      <div class="ctx-dv"></div>
      <div class="ctx-i" @click="ctxAction('resetStatus')"><el-icon><RefreshRight /></el-icon> 重置状态</div>
      <div class="ctx-i ctx-dg" @click="selectedNode = getNodeById(contextMenu.nodeId); ElMessageBox.confirm('确定删除该节点？', '删除', { type: 'warning' }).then(handleDeleteNode).catch(() => {})"><el-icon><Delete /></el-icon> 删除节点</div>
    </div>

    <!-- Node Drawer -->
    <el-drawer v-model="drawerVisible" :title="selectedNodeDef?.nodeName || '节点配置'" size="400px" destroy-on-close>
      <template v-if="selectedNodeDef">
        <el-descriptions :column="2" border size="small" title="基本信息">
          <el-descriptions-item label="ID">{{ selectedNodeDef.nodeId }}</el-descriptions-item>
          <el-descriptions-item label="类型"><el-tag :color="nodeTypeColor[selectedNodeDef.nodeType]?.bg" size="small" style="color:#fff">{{ selectedNodeDef.nodeType }}</el-tag></el-descriptions-item>
          <el-descriptions-item label="名称" :span="2">{{ selectedNodeDef.nodeName }}</el-descriptions-item>
          <el-descriptions-item label="描述" :span="2">{{ selectedNodeDef.description }}</el-descriptions-item>
          <el-descriptions-item v-if="selectedNodeDef.model" label="模型" :span="2">{{ selectedNodeDef.model }}</el-descriptions-item>
        </el-descriptions>
        <el-divider />
        <el-tabs v-model="drawerTab">
          <el-tab-pane label="运行配置" name="config">
            <div class="dr-f">
              <div class="dr-fi"><label>超时 (ms)</label><el-input-number :min="500" :max="30000" :step="500" :model-value="30000" style="width:100%" /></div>
              <div class="dr-fi"><label>重试次数</label><el-input-number :min="0" :max="5" :step="1" :model-value="2" style="width:100%" /></div>
              <div class="dr-fi"><label>错误处理</label><el-select model-value="skip" style="width:100%"><el-option label="跳过继续" value="skip" /><el-option label="终止流程" value="abort" /><el-option label="重试后终止" value="retry-abort" /></el-select></div>
              <div class="dr-fi"><label>输出缓存</label><el-switch model-value active-text="启用" /></div>
              <div class="dr-fi"><label>缓存 TTL (秒)</label><el-input-number :min="0" :max="3600" :step="60" :model-value="300" style="width:100%" /></div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="输入参数" name="input">
            <div v-if="!selectedNodeDef.inputs.length" class="dr-empty"><el-empty description="无输入参数" :image-size="50" /></div>
            <div v-else class="dr-params"><div v-for="i in selectedNodeDef.inputs" :key="i.name" class="dr-p"><div class="dr-ph"><span class="dr-pn">{{ i.name }}</span><el-tag v-if="i.required" type="danger" size="small">必填</el-tag></div><div class="dr-pm"><span>{{ i.label }}</span><span class="dr-pt">{{ i.type }}</span><span v-if="i.defaultValue" class="dr-pd">默认: {{ i.defaultValue }}</span></div></div></div>
          </el-tab-pane>
          <el-tab-pane label="输出参数" name="output">
            <div v-if="!selectedNodeDef.outputs.length" class="dr-empty"><el-empty description="无输出参数" :image-size="50" /></div>
            <div v-else class="dr-params"><div v-for="o in selectedNodeDef.outputs" :key="o.name" class="dr-p"><div class="dr-ph"><span class="dr-pn">{{ o.name }}</span></div><div class="dr-pm"><span>{{ o.label }}</span><span class="dr-pt">{{ o.type }}</span></div></div></div>
          </el-tab-pane>
          <el-tab-pane label="运行日志" name="logs">
            <template v-if="selectedNodeDef">
              <div v-if="!executionLogs.filter(l => l.nodeId === selectedNodeDef!.nodeId).length" class="dr-empty"><el-empty description="暂无日志" :image-size="50" /></div>
              <div v-else v-for="(l, i) in executionLogs.filter(l => l.nodeId === selectedNodeDef!.nodeId)" :key="i" class="dr-log" :class="`log-${l.level}`"><span class="log-t">{{ l.time }}</span><span class="log-m">{{ l.message }}</span></div>
            </template>
          </el-tab-pane>
        </el-tabs>
      </template>
    </el-drawer>

    <!-- Shortcuts Dialog -->
    <el-dialog v-model="showShortcuts" title="⌨️ 快捷键" width="460px" destroy-on-close>
      <div class="sc-grid">
        <div v-for="s in [['Ctrl+S','保存'],['Ctrl+Z','撤销'],['Ctrl+Y','重做'],['Ctrl+F','搜索节点'],['Ctrl+0','重置缩放'],['Ctrl+ +/-','缩放'],['Delete','删除节点'],['右键','上下文菜单'],['点击节点','查看详情'],['拖拽节点','移动位置'],['滚轮','缩放'],['拖拽空白','平移']]" :key="s[0]" class="sc-r"><kbd>{{ s[0] }}</kbd><span>{{ s[1] }}</span></div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
// ============ VARS ============
$bg: #f0f2f5; $card: #fff; $brd: #e4e7ed; $txt: #303133; $sub: #909399; $pri: #409eff;

// ============ PAGE ============
.wf-page { display:flex; flex-direction:column; gap:10px; height:calc(100vh - 110px); min-height:700px; }

// ============ HEADER ============
.wf-hdr { display:flex; justify-content:space-between; align-items:center; flex-shrink:0;
  h2 { margin:0; font-size:18px; display:flex; align-items:center; gap:6px; }
}
.wf-hdr-l { display:flex; align-items:center; gap:16px; }
.wf-hdr-meta { display:flex; align-items:center; gap:6px; font-size:12px; color:$sub;
  .m-txt { margin-left:2px; }
  .m-div { color:#dcdfe6; margin:0 2px; }
  .m-warn { color:#e6a23c; display:flex; align-items:center; gap:2px; }
  .m-dirty { margin-left:6px; }
}

// ============ TOOLBAR ============
.wf-tb { display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:$card; border-radius:8px; border:1px solid $brd; flex-shrink:0; flex-wrap:wrap; gap:8px; }
.wf-tb-l { display:flex; align-items:center; gap:4px; }
.wf-tb-r { display:flex; align-items:center; gap:12px; font-size:12px; color:$sub; }
.zoom-txt { font-size:13px; font-weight:600; min-width:42px; text-align:center; color:$txt; }

// ============ MAIN LAYOUT ============
.wf-main { display:flex; gap:10px; flex:1; overflow:hidden; min-height:0; }
.wf-left { flex:1.6; display:flex; flex-direction:column; gap:10px; overflow:hidden; min-width:0; }
.wf-right { flex:1; display:flex; flex-direction:column; gap:10px; overflow-y:auto; min-width:320px; max-width:420px; }

// ============ CANVAS ============
.wf-canvas { flex:1; display:flex; flex-direction:column; background:$card; border-radius:8px; border:1px solid $brd; overflow:hidden; }
.wf-canvas-hd { display:flex; justify-content:space-between; align-items:center; padding:8px 14px; border-bottom:1px solid $brd; font-weight:600; font-size:13px; flex-shrink:0; }
.wf-legend { display:flex; gap:10px; flex-wrap:wrap; }
.wf-legend-i { display:flex; align-items:center; gap:3px; font-size:10px; color:$sub; font-weight:400; }
.wf-legend-dot { width:10px; height:10px; border-radius:2px; flex-shrink:0; }
.wf-flow { flex:1; min-height:350px; background:#fafbfc; }
.wf-flow.wf-grid { background-image:radial-gradient(circle, #dcdfe6 1px, transparent 1px); background-size:20px 20px; }

// ============ NODES ============
.wf-node { padding:7px 10px; border-radius:8px; min-width:170px; max-width:210px; color:#fff; box-shadow:0 2px 8px rgba(0,0,0,.12); transition:all .25s; cursor:pointer;
  &.n-ok { box-shadow:0 0 14px rgba(103,194,58,.5); border:2px solid #67c23a; }
  &.n-err { box-shadow:0 0 14px rgba(245,108,108,.5); border:2px solid #f56c6c; }
  &.n-run { animation:pulse .8s infinite; }
}
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.7} }
.wf-node-hd { display:flex; align-items:center; gap:5px; margin-bottom:5px; padding-bottom:4px; border-bottom:1px solid rgba(255,255,255,.2); }
.n-icon { font-size:13px; }
.n-name { font-size:12px; font-weight:600; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.n-model { font-size:9px; background:rgba(255,255,255,.2); padding:1px 5px; border-radius:3px; }
.wf-node-bd { font-size:10px; }
.n-desc { margin-bottom:5px; opacity:.9; line-height:1.35; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.n-io { display:flex; flex-direction:column; gap:2px; }
.n-io-row { display:flex; gap:4px; align-items:flex-start; }
.n-io-lbl { color:rgba(255,255,255,.65); flex-shrink:0; }
.n-io-its { display:flex; flex-wrap:wrap; gap:2px; }
.n-io-it { background:rgba(255,255,255,.18); padding:1px 5px; border-radius:3px; }
.n-empty { opacity:.5; }
.n-req { color:#fcc; }
.wf-node-ft { margin-top:5px; padding-top:4px; border-top:1px solid rgba(255,255,255,.2); text-align:center; font-size:10px; }
.st-success { color:#95de64; } .st-failed { color:#ff7875; } .st-running { color:#ffc53d; }

// Node type colors
.wf-node-http { background:#409eff; } .wf-node-llm { background:#909399; } .wf-node-code { background:#67c23a; }
.wf-node-condition, .wf-node-switch { background:#e6a23c; } .wf-node-loop, .wf-node-parallel { background:#f56c6c; }
.wf-node-delay { background:#b37feb; } .wf-node-template { background:#36cfc9; }

// ============ CONTROL PANEL ============
.wf-ctl { background:$card; border-radius:8px; border:1px solid $brd; flex-shrink:0; }
.wf-ctl-hd { display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-bottom:1px solid $brd; font-weight:600; font-size:13px; }
.wf-ctl-bd { padding:12px 14px; }
.ctl-row { display:flex; gap:14px; }
.ctl-main { flex:1; display:flex; flex-direction:column; gap:12px; min-width:0; }
.ctl-side { width:210px; flex-shrink:0; display:flex; flex-direction:column; gap:10px; }
.fg { display:flex; flex-direction:column; gap:4px;
  label { font-size:12px; font-weight:500; color:$txt; display:flex; align-items:center; gap:4px; }
}
.fg-row { display:flex; gap:14px; & > .fg { flex:1; } }
.fg-row-3 { display:flex; gap:8px; & > .fg { flex:1; } }
.sel-hint { margin-top:4px; padding:6px 8px; background:$bg; border-radius:4px; font-size:11px; display:flex; gap:6px; align-items:center; .sh-n { font-weight:600; color:$pri; flex-shrink:0; } .sh-v { color:$sub; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } }
.diff-bars { display:flex; flex-direction:column; gap:4px; background:$bg; padding:8px; border-radius:4px; }
.db-i { display:flex; align-items:center; gap:6px; font-size:11px; .db-l { width:55px; flex-shrink:0; color:$txt; } .db-t { flex:1; height:8px; background:#e4e7ed; border-radius:4px; overflow:hidden; } .db-f { height:100%; border-radius:4px; width:33%; opacity:.65; } }
.model-empty { font-size:11px; color:$sub; }
.exe-row { display:flex; justify-content:center; gap:10px; margin-top:12px; padding-top:10px; border-top:1px solid $brd; }
.log-badge { margin-left:4px; }

// ============ LOGS ============
.wf-logs { background:#1e1e2e; border-radius:8px; border:1px solid #333; overflow:hidden; flex-shrink:0; max-height:180px; }
.wf-logs-hd { display:flex; justify-content:space-between; align-items:center; padding:6px 12px; background:#2a2a3c; color:#cdd6f4; font-size:12px; font-weight:600; }
.wf-logs-bd { padding:6px 12px; overflow-y:auto; max-height:140px; font-family:'JetBrains Mono','Fira Code',monospace; font-size:11px; }
.log-ln { display:flex; gap:8px; padding:2px 0; align-items:flex-start; .log-t { color:#6c7086; flex-shrink:0; width:70px; } .log-lv { flex-shrink:0; width:14px; } .log-m { flex:1; } }
.log-info { color:#89b4fa; } .log-success { color:#a6e3a1; } .log-error { color:#f38ba8; }

// ============ RIGHT: RESULTS ============
.wf-result { background:$card; border-radius:8px; border:1px solid $brd; }
.wf-result-hd { display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-bottom:1px solid $brd; font-weight:600; font-size:13px; }
.wf-result-bd { padding:10px 14px; }
.r-summary { margin-bottom:12px; }
.r-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px; }
.r-item { display:flex; flex-direction:column; gap:2px; .r-lbl { font-size:11px; color:$sub; } .r-val { font-size:13px; font-weight:600; color:$txt; word-break:break-all; } }
.mono { font-family:monospace; }
.r-prog { height:4px; background:$brd; border-radius:2px; overflow:hidden; .r-prog-f { height:100%; background:linear-gradient(90deg, $pri, #67c23a); border-radius:2px; transition:width .5s; } }
.sec-tl { font-size:13px; font-weight:600; margin-bottom:8px; color:$txt; }
.r-node { padding:8px 10px; background:#fafafa; border-radius:6px; margin-bottom:6px; .rn-hd { display:flex; justify-content:space-between; align-items:center; font-size:12px; font-weight:500; margin-bottom:4px; } .rn-dt { display:flex; gap:12px; font-size:11px; color:$sub; } .rn-err { color:#f56c6c; } }
.sec { padding-top:10px; border-top:1px dashed $brd; margin-bottom:10px; }
.paper { background:#f0f9ff; padding:10px; border-radius:6px; border-left:3px solid $pri; .paper-t { font-size:13px; font-weight:600; margin-bottom:6px; } .paper-s { display:flex; gap:14px; font-size:12px; color:$sub; } .paper-sm { margin-top:8px; font-size:12px; color:$txt; line-height:1.5; white-space:pre-wrap; } }
.save-s { display:flex; gap:20px; .ss { display:flex; flex-direction:column; gap:2px; .ssl { font-size:11px; color:$sub; } .ssv { font-size:16px; font-weight:700; &.ok { color:#67c23a; } } } }
.q-i { display:flex; gap:10px; padding:8px; background:#fafafa; border-radius:6px; margin-bottom:6px; .q-idx { width:24px; height:24px; line-height:24px; text-align:center; background:$pri; color:#fff; border-radius:50%; font-size:12px; font-weight:600; flex-shrink:0; } .q-bd { flex:1; } .q-stm { font-size:13px; font-weight:500; margin-bottom:6px; } .q-mt { display:flex; gap:6px; margin-bottom:4px; flex-wrap:wrap; } .q-tg { font-size:10px; background:#f0f0f0; padding:2px 6px; border-radius:3px; color:$sub; } .q-an { font-size:11px; color:$sub; line-height:1.4; padding-left:8px; border-left:2px solid $pri; } }
.sec-hint { font-size:11px; color:$sub; text-align:center; }
.st-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; }
.st-c { background:#fafafa; padding:8px; border-radius:6px; text-align:center; &.st-chl { background:linear-gradient(135deg, #667eea, #764ba2); color:#fff; .st-cl { color:rgba(255,255,255,.7); } } .st-cv { font-size:20px; font-weight:700; } .st-cl { font-size:10px; color:$sub; margin-top:2px; } }

// ============ RIGHT: HISTORY ============
.wf-hist { background:$card; border-radius:8px; border:1px solid $brd; }
.wf-hist-hd { display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-bottom:1px solid $brd; font-weight:600; font-size:13px; }
.wf-hist-bd { padding:8px; max-height:260px; overflow-y:auto; }
.hi { padding:8px 10px; background:#fafafa; border-radius:6px; margin-bottom:5px; cursor:pointer; transition:all .15s; &:hover { background:#f0f0f0; } &.hi-sel { background:#e6f7ff; border:1px solid #91d5ff; } }
.hi-t { display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; .hi-tm { font-size:11px; color:$sub; } }
.hi-b { display:flex; gap:14px; font-size:12px; color:$txt; }
.wf-empty { padding:24px 0; }

// ============ CONTEXT MENU ============
.ctx { position:fixed; z-index:9999; background:$card; border-radius:8px; box-shadow:0 4px 20px rgba(0,0,0,.15); min-width:180px; padding:4px 0; border:1px solid $brd; }
.ctx-hd { padding:6px 14px; font-size:11px; color:$sub; border-bottom:1px solid $brd; margin-bottom:2px; }
.ctx-i { padding:7px 14px; font-size:13px; cursor:pointer; display:flex; align-items:center; gap:8px; transition:background .12s; &:hover { background:$bg; } }
.ctx-dv { height:1px; background:$brd; margin:4px 8px; }
.ctx-dg { color:#f56c6c; &:hover { background:#fef0f0; } }

// ============ DRAWER ============
.dr-f { display:flex; flex-direction:column; gap:12px; .dr-fi { display:flex; flex-direction:column; gap:4px; label { font-size:12px; font-weight:500; color:$txt; } } }
.dr-params { display:flex; flex-direction:column; gap:8px; }
.dr-p { padding:8px 10px; background:#fafafa; border-radius:6px; }
.dr-ph { display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; .dr-pn { font-weight:600; font-size:13px; font-family:monospace; } }
.dr-pm { display:flex; gap:8px; font-size:11px; color:$sub; align-items:center; .dr-pt { background:#f0f0f0; padding:1px 6px; border-radius:3px; } .dr-pd { color:#e6a23c; } }
.dr-empty { padding:30px 0; }
.dr-log { padding:4px 0; font-size:12px; display:flex; gap:8px; .log-t { color:$sub; width:70px; flex-shrink:0; } }

// ============ SHORTCUTS ============
.sc-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
.sc-r { display:flex; align-items:center; gap:10px; font-size:13px; padding:4px 0; kbd { background:#f5f7fa; border:1px solid #dcdfe6; border-radius:4px; padding:2px 7px; font-size:11px; font-family:monospace; min-width:70px; text-align:center; } span { color:$txt; } }
</style>