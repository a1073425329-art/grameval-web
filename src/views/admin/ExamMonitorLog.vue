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
  } catch { /* ignore */ }
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
    <!-- 统计卡片 -->
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
