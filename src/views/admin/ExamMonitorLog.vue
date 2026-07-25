<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, List, Grid, View, Warning, WarningFilled, InfoFilled, CircleCheck, Clock, Monitor, Check } from '@element-plus/icons-vue'
import { listMonitorEvents, getGlobalMonitorStats, handleMonitorEvent } from '@/api/monitor'
import { listExamRecords } from '@/api/admin'
import type { ExamMonitorEvent } from '@/types/monitor'
import type { ExamRecord } from '@/types/exam'
import { useViewMode } from '@/composables/useViewMode'

/* ---------------- 视图模式 ---------------- */
const { viewMode, toggleViewMode } = useViewMode('exam_monitor_log')

/* ---------------- 数据 ---------------- */
const events = ref<ExamMonitorEvent[]>([])
const total = ref(0)
const loading = ref(false)
const stats = ref<Record<string, number>>({})
const examRecords = ref<ExamRecord[]>([])

const query = reactive({
  pageNum: 1,
  pageSize: 20,
  examId: undefined as number | undefined,
  severity: undefined as number | undefined,
  handled: undefined as boolean | undefined,
})

const load = async () => {
  loading.value = true
  try {
    const res = await listMonitorEvents(query)
    events.value = res.data?.records ?? []
    total.value = res.data?.total ?? 0
  } finally {
    loading.value = false
  }
}

const loadStats = async () => {
  try {
    const res = await getGlobalMonitorStats()
    stats.value = res.data ?? {}
  } catch { /* ignore */ }
}

const loadExamRecords = async () => {
  try {
    const res = await listExamRecords({ pageNum: 1, pageSize: 200 })
    examRecords.value = res.data?.records ?? []
  } catch { /* ignore */ }
}

const search = () => {
  query.pageNum = 1
  load()
}

const reset = () => {
  query.examId = undefined
  query.severity = undefined
  query.handled = undefined
  query.pageNum = 1
  load()
}

onMounted(() => {
  load()
  loadStats()
  loadExamRecords()
})

/* ---------------- 考试记录 formatter ---------------- */
const examLabel = (id?: number) => {
  if (!id) return ''
  const r = examRecords.value.find(e => e.id === id)
  if (!r) return `#${id}`
  const who = r.realName || r.username || ''
  const paper = r.paperName || ''
  return `#${id} ${who}${paper ? ' · ' + paper : ''}`
}

/* ---------------- 考试记录选择器搜索 ---------------- */
const examFilter = ref('')
const filteredExams = computed(() => {
  if (!examFilter.value) return examRecords.value
  const kw = examFilter.value.toLowerCase()
  return examRecords.value.filter(e => examLabel(e.id).toLowerCase().includes(kw))
})
const filterExam = (val: string) => { examFilter.value = val }

/* ---------------- 表格排序方法 ---------------- */
const sortBySeverity = (a: ExamMonitorEvent, b: ExamMonitorEvent) =>
  (a.severity ?? 0) - (b.severity ?? 0)
const sortByHandled = (a: ExamMonitorEvent, b: ExamMonitorEvent) =>
  Number(a.handled ? 1 : 0) - Number(b.handled ? 1 : 0)
const sortByType = (a: ExamMonitorEvent, b: ExamMonitorEvent) =>
  String(a.monitorType || '').localeCompare(String(b.monitorType || ''))

/* ---------------- 字典 ---------------- */
const severityLabels: Record<number, string> = { 0: '信息', 1: '警告', 2: '严重', 3: '作弊嫌疑' }
const typeLabels: Record<string, string> = {
  SCREEN_OUT: '切屏',
  COPY: '复制',
  PASTE: '粘贴',
  WINDOW_MINIMIZE: '窗口最小化',
  NETWORK_ERROR: '网络中断',
  TAB_SWITCH: '标签页切换',
  RIGHT_CLICK: '右键',
  KEYBOARD_SHORTCUT: '快捷键',
  BROWSER_RESIZE: '窗口变化',
}

const severityTag = (s: number): 'info' | 'warning' | 'danger' | '' => {
  if (s === 0) return 'info'
  if (s === 1) return 'warning'
  if (s >= 2) return 'danger'
  return ''
}

const severityColor = (s: number): string => {
  if (s === 0) return '#909399'
  if (s === 1) return '#E6A23C'
  if (s === 2) return '#F56C6C'
  if (s === 3) return '#B71C1C'
  return '#909399'
}

/* ---------------- 统计卡片 ---------------- */
const statsList = computed(() => [
  { label: '事件总数', value: stats.value.total ?? 0, color: '#409EFF', icon: Monitor },
  { label: '警告以上', value: stats.value.warnings ?? 0, color: '#E6A23C', icon: Warning },
  { label: '严重以上', value: stats.value.critical ?? 0, color: '#F56C6C', icon: WarningFilled },
  { label: '作弊嫌疑', value: stats.value.cheatSuspect ?? 0, color: '#B71C1C', icon: WarningFilled },
  { label: '待处理', value: stats.value.unhandled ?? 0, color: '#E6A23C', icon: Clock },
  { label: '已处理', value: stats.value.handled ?? 0, color: '#67C23A', icon: CircleCheck },
])

/* ---------------- 操作 ---------------- */
const handleEvent = async (id: number) => {
  await ElMessageBox.prompt('请输入处理备注', '标记处理', {
    confirmButtonText: '确认',
    cancelButtonText: '取消',
    inputPlaceholder: '例如：已联系学生确认',
    inputValue: '已确认处理',
  }).then(async ({ value }) => {
    await handleMonitorEvent(id, value || '已确认处理')
    ElMessage.success('已处理')
    load()
    loadStats()
  }).catch(() => { /* cancel */ })
}

const handlePageChange = () => load()
</script>

<template>
  <div class="page-container">
    <!-- 顶部统计卡片 -->
    <el-row :gutter="12" class="stats-row">
      <el-col v-for="s in statsList" :key="s.label" :xs="12" :sm="8" :md="4" :lg="4">
        <el-card shadow="hover" class="stat-card" :style="{ '--accent': s.color }">
          <div class="stat-head">
            <el-icon :size="20" :color="s.color"><component :is="s.icon" /></el-icon>
            <div class="stat-value" :style="{ color: s.color }">{{ s.value }}</div>
          </div>
          <div class="stat-label">{{ s.label }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 查询条件 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="query" class="filter-form">
        <el-form-item label="考试记录">
          <el-select v-model="query.examId" placeholder="选择考试记录" clearable filterable style="width:280px" :filter-method="filterExam">
            <el-option v-for="e in filteredExams" :key="e.id" :label="examLabel(e.id)" :value="e.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="严重程度">
          <el-select v-model="query.severity" placeholder="全部" clearable style="width:140px">
            <el-option label="信息(0)" :value="0" />
            <el-option label="警告及以上(1+)" :value="1" />
            <el-option label="严重及以上(2+)" :value="2" />
            <el-option label="作弊嫌疑(3+)" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="处理状态">
          <el-select v-model="query.handled" placeholder="全部" clearable style="width:120px">
            <el-option label="未处理" :value="false" />
            <el-option label="已处理" :value="true" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="search"><el-icon><Search /></el-icon>查询</el-button>
          <el-button @click="reset"><el-icon><Refresh /></el-icon>重置</el-button>
          <el-button @click="toggleViewMode" :type="viewMode === 'card' ? 'primary' : 'default'" size="small">
            <el-icon><List v-if="viewMode === 'card'" /><Grid v-else /></el-icon>
            {{ viewMode === 'card' ? '表格' : '卡片' }}
          </el-button>
        </el-form-item>
      </el-form>
      <div class="help-tip">
        <el-icon><InfoFilled /></el-icon>
        <span>系统通过浏览器API检测考生的异常行为。严重程度：信息(0)记录、警告(1)关注、严重(2)核查、作弊嫌疑(3)立即处理。系统仅检测浏览器层面行为，不能检测第二设备。</span>
      </div>
    </el-card>

    <!-- 表格视图 -->
    <el-card shadow="never" v-loading="loading" v-if="viewMode === 'table'">
      <el-table :data="events" stripe border style="width:100%" :default-sort="{ prop: 'eventTime', order: 'descending' }">
        <el-table-column type="index" label="#" width="55" align="center" />
        <el-table-column prop="examId" label="考试ID" width="90" align="center" sortable />
        <el-table-column label="学生" width="130" prop="studentName" sortable>
          <template #default="{ row }">
            <div style="display:flex;align-items:center;gap:6px">
              <el-avatar :size="28"><el-icon><View /></el-icon></el-avatar>
              <span>{{ row.studentName || '-' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="事件类型" width="130" prop="monitorType" sortable :sort-method="sortByType">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ typeLabels[row.monitorType] ?? row.monitorType }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="严重程度" width="110" align="center" prop="severity" sortable :sort-method="sortBySeverity">
          <template #default="{ row }">
            <el-tag :type="severityTag(row.severity)" size="small">
              {{ severityLabels[row.severity] ?? row.severity }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="detail" label="详情" min-width="220" show-overflow-tooltip />
        <el-table-column prop="eventTime" label="发生时间" width="170" sortable />
        <el-table-column label="持续(s)" width="90" align="center" prop="durationSeconds" sortable>
          <template #default="{ row }">{{ row.durationSeconds ? row.durationSeconds + 's' : '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center" prop="handled" sortable :sort-method="sortByHandled">
          <template #default="{ row }">
            <el-tag :type="row.handled ? 'success' : 'danger'" size="small" effect="plain">
              {{ row.handled ? '已处理' : '待处理' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button v-if="!row.handled" size="small" type="primary" link @click="handleEvent(row.id)">
              <el-icon><Check /></el-icon>标记处理
            </el-button>
            <span v-else style="color:#67C23A;font-size:12px">
              {{ row.handledByName ? '由 ' + row.handledByName : '' }}处理
            </span>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="query.pageNum"
        v-model:page-size="query.pageSize"
        :total="total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @change="handlePageChange"
        style="margin-top:16px;justify-content:flex-end"
      />
    </el-card>

    <!-- 卡片视图 -->
    <div v-else v-loading="loading" class="card-grid">
      <el-card
        v-for="e in events"
        :key="e.id"
        shadow="hover"
        class="event-card"
        :style="{ '--accent': severityColor(e.severity) }"
      >
        <div class="card-head">
          <el-tag :type="severityTag(e.severity)" size="small">
            {{ severityLabels[e.severity] ?? e.severity }}
          </el-tag>
          <el-tag size="small" effect="plain">{{ typeLabels[e.monitorType] ?? e.monitorType }}</el-tag>
          <el-tag :type="e.handled ? 'success' : 'danger'" size="small" effect="plain">
            {{ e.handled ? '已处理' : '待处理' }}
          </el-tag>
        </div>
        <div class="card-detail">{{ e.detail || '无详情' }}</div>
        <div class="card-meta">
          <el-avatar :size="24"><el-icon><View /></el-icon></el-avatar>
          <span class="meta-name">{{ e.studentName || '学生' }}</span>
          <span class="meta-sep">·</span>
          <span>考试#{{ e.examId }}</span>
          <span v-if="e.durationSeconds" class="meta-sep">·</span>
          <span v-if="e.durationSeconds">{{ e.durationSeconds }}s</span>
        </div>
        <div class="card-time">
          <el-icon><Clock /></el-icon>
          {{ e.eventTime }}
        </div>
        <div v-if="e.handled && e.handleNote" class="card-note">
          处理备注：{{ e.handleNote }}
        </div>
        <div class="card-actions">
          <el-button v-if="!e.handled" size="small" type="primary" @click="handleEvent(e.id)">
            <el-icon><Check /></el-icon>标记处理
          </el-button>
          <span v-else class="handled-text">
            <el-icon><CircleCheck /></el-icon>
            {{ e.handledByName ? '由 ' + e.handledByName + ' 处理' : '已处理' }}
          </span>
        </div>
      </el-card>

      <el-empty v-if="!loading && events.length === 0" description="暂无监控事件" class="empty-state" />
    </div>
  </div>
</template>

<style scoped>
.page-container { padding: 16px; }

/* 统计卡片 */
.stats-row { margin-bottom: 12px; }
.stat-card {
  border-left: 4px solid var(--accent, #409EFF);
  transition: all 0.25s ease;
  margin-bottom: 8px;
}
.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(64, 158, 255, 0.18);
}
.stat-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.stat-value { font-size: 24px; font-weight: 700; line-height: 1.2; }
.stat-label { font-size: 13px; color: #909399; margin-top: 4px; }

/* 筛选 */
.filter-card { margin-bottom: 12px; }
.filter-form { display: flex; flex-wrap: wrap; gap: 0; }
.help-tip {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 10px;
  padding: 10px 12px;
  background: #f4f4f5;
  border-radius: 4px;
  font-size: 12px;
  color: #606266;
  line-height: 1.6;
}
.help-tip .el-icon { color: #909399; margin-top: 2px; }

/* 卡片网格 */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 14px;
}
.event-card {
  transition: all 0.25s ease;
  border: 1px solid #ebeef5;
  border-top: 3px solid var(--accent, #409EFF);
}
.event-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(64, 158, 255, 0.16);
}
.card-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.card-detail {
  font-size: 14px;
  line-height: 1.6;
  color: #303133;
  margin: 8px 0;
  max-height: 100px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}
.card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #606266;
  margin-top: 8px;
}
.meta-name { font-weight: 600; color: #303133; }
.meta-sep { color: #c0c4cc; }
.card-time {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
}
.card-note {
  margin-top: 8px;
  padding: 6px 10px;
  background: #f0f9eb;
  border-left: 3px solid #67C23A;
  font-size: 12px;
  color: #606266;
  border-radius: 2px;
}
.card-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed #ebeef5;
}
.handled-text {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #67C23A;
  font-size: 13px;
}
.empty-state { grid-column: 1 / -1; padding: 60px 0; }
</style>

<!-- 原始版本保留为注释（已迁移到上方扩展版）
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { listMonitorEvents, getMonitorStats, handleMonitorEvent } from '@/api/monitor'
import type { ExamMonitorEvent } from '@/types/monitor'

const events = ref<ExamMonitorEvent[]>([])
const loading = ref(false)
const total = ref(0)
const stats = ref<Record<string, number>>({})
const query = reactive({ pageNum: 1, pageSize: 20, examId: undefined as number | undefined, severity: undefined as number | undefined, handled: undefined as boolean | undefined })

const load = async () => {
  loading.value = true
  try {
    const res = await listMonitorEvents(query)
    events.value = res.data?.records ?? []
    total.value = res.data?.total ?? 0
  } finally { loading.value = false }
}

const loadStats = async () => {
  if (!query.examId) return
  try {
    const res = await getMonitorStats(query.examId)
    stats.value = res.data ?? {}
  } catch {  }
}

onMounted(load)

const handleEvent = async (id: number) => {
  await handleMonitorEvent(id, '已确认处理')
  ElMessage.success('已处理')
  load()
}

const severityTag = (s: number): 'info' | 'warning' | 'danger' | '' => {
  if (s === 0) return 'info'
  if (s === 1) return 'warning'
  if (s >= 2) return 'danger'
  return ''
}

const severityLabels: Record<number, string> = { 0: '信息', 1: '警告', 2: '严重', 3: '作弊嫌疑' }
const typeLabels: Record<string, string> = {
  SCREEN_OUT: '切屏', COPY: '复制', PASTE: '粘贴', WINDOW_MINIMIZE: '窗口最小化',
  NETWORK_ERROR: '网络中断', TAB_SWITCH: '标签页切换', RIGHT_CLICK: '右键', KEYBOARD_SHORTCUT: '快捷键', BROWSER_RESIZE: '窗口变化',
}
</script>

<template>
  <div class="page-container">
    <el-row :gutter="16" style="margin-bottom:16px" v-if="stats.total !== undefined">
      <el-col :span="6"><el-card shadow="hover"><el-statistic title="总事件" :value="stats.total ?? 0" /></el-card></el-col>
      <el-col :span="6"><el-card shadow="hover"><el-statistic title="警告+" :value="stats.warnings ?? 0" /></el-card></el-col>
      <el-col :span="6"><el-card shadow="hover"><el-statistic title="严重+" :value="stats.critical ?? 0" /></el-card></el-col>
      <el-col :span="6"><el-card shadow="hover"><el-statistic title="作弊嫌疑" :value="stats.cheatSuspect ?? 0"><template #suffix><span style="color:red;font-size:14px">⚠</span></template></el-statistic></el-card></el-col>
    </el-row>

    <el-card>
      <template #header>
        <div style="display:flex;align-items:center;gap:8px">
          <span>考试异常事件</span>
          <el-tooltip content="系统通过浏览器API检测考生的异常行为。切屏/粘贴/快捷键等行为会被记录。严重程度：信息(0)=记录、警告(1)=关注、严重(2)=核查、作弊嫌疑(3)=立即处理。系统仅检测浏览器层面行为，不能检测第二设备。" placement="bottom" effect="light">
            <el-icon style="cursor:help;color:#909399"><QuestionFilled /></el-icon>
          </el-tooltip>
        </div>
      </template>
      <div class="search-bar">
        <el-input v-model="query.examId" placeholder="考试记录ID" clearable style="width:160px" @keyup.enter="load(); loadStats()" />
        <el-select v-model="query.severity" placeholder="严重程度" clearable style="width:130px">
          <el-option label="信息" :value="0" /><el-option label="警告" :value="1" /><el-option label="严重" :value="2" /><el-option label="作弊嫌疑" :value="3" />
        </el-select>
        <el-select v-model="query.handled" placeholder="处理状态" clearable style="width:120px">
          <el-option label="未处理" :value="false" /><el-option label="已处理" :value="true" />
        </el-select>
        <el-button type="primary" @click="load(); loadStats()">搜索</el-button>
      </div>

      <el-table :data="events" v-loading="loading" stripe border>
        <el-table-column prop="studentName" label="学生" width="100" />
        <el-table-column label="类型" width="130">
          <template #default="{ row }">{{ typeLabels[row.monitorType] ?? row.monitorType }}</template>
        </el-table-column>
        <el-table-column label="严重程度" width="100">
          <template #default="{ row }"><el-tag :type="severityTag(row.severity)" size="small">{{ severityLabels[row.severity] }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="detail" label="详情" min-width="150" show-overflow-tooltip />
        <el-table-column prop="eventTime" label="时间" width="160" />
        <el-table-column label="已处理" width="80">
          <template #default="{ row }"><el-tag :type="row.handled ? 'success' : 'danger'" size="small">{{ row.handled ? '是' : '否' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button v-if="!row.handled" size="small" type="primary" @click="handleEvent(row.id)">标记处理</el-button>
            <span v-else style="color:#999">已处理</span>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="query.pageNum" v-model:page-size="query.pageSize"
        :total="total" :page-sizes="[20, 50, 100]" layout="total, sizes, prev, pager, next"
        @change="load" style="margin-top:16px;justify-content:flex-end"
      />
    </el-card>
  </div>
</template>

<style scoped>
.page-container { padding: 16px; }
.search-bar { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
</style>
-->
