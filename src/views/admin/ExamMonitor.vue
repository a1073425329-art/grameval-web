<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getExamMonitor, forceSubmit } from '@/api/admin'
import type { ExamMonitor } from '@/types/admin'

const route = useRoute()
const router = useRouter()

const sessionId = Number(route.params.sessionId)

const monitor = ref<ExamMonitor | null>(null)
const loading = ref(false)
const submitting = ref(false)

/** 自动刷新（10s） */
const autoRefresh = ref(true)
let timer: number | null = null

const load = async (silent = false) => {
  if (!silent) loading.value = true
  try {
    const res = await getExamMonitor(sessionId)
    monitor.value = res.data
  } catch { /* handled */ } finally { loading.value = false }
}

const startAutoRefresh = () => {
  if (timer !== null) return
  timer = window.setInterval(() => load(true), 10_000)
}
const stopAutoRefresh = () => {
  if (timer !== null) { clearInterval(timer); timer = null }
}

const toggleAutoRefresh = (v: boolean) => {
  autoRefresh.value = v
  if (v) startAutoRefresh()
  else stopAutoRefresh()
}

/* ---------------- 强制收卷 ---------------- */
const doForceSubmit = async () => {
  if (!monitor.value) return
  try {
    await ElMessageBox.confirm(
      `将强制收卷《${monitor.value.sessionName}》全场进行中的考生（${monitor.value.ongoingCount} 人）。此操作不可撤销，确认？`,
      '强制收卷',
      { type: 'warning' }
    )
  } catch { return }
  submitting.value = true
  try {
    const res = await forceSubmit(sessionId)
    ElMessage.success(`已强制收卷 ${res.data.affectedCount ?? 0} 位考生`)
    await load()
  } catch { /* handled */ } finally { submitting.value = false }
}

/* ---------------- 状态映射 ---------------- */
const statusText = (s?: number) =>
  (s === 0 ? '进行中' : s === 1 ? '已提交' : s === 2 ? '超时提交' : '未参加')
const statusType = (s?: number): 'info' | 'success' | 'warning' | 'danger' =>
  s === 0 ? 'warning' : s === 1 ? 'success' : s === 2 ? 'danger' : 'info'

const scoreColor = (pct?: number) => {
  const p = pct ?? 0
  if (p >= 80) return '#67c23a'
  if (p >= 60) return '#e6a23c'
  return '#f56c6c'
}

/* ---------------- 生命周期 ---------------- */
onMounted(async () => {
  await load()
  startAutoRefresh()
})

onBeforeUnmount(stopAutoRefresh)

const attendedPct = computed(() =>
  monitor.value && monitor.value.assignedCount
    ? Math.round((monitor.value.attendedCount / monitor.value.assignedCount) * 100)
    : 0
)
const submittedPct = computed(() =>
  monitor.value && monitor.value.assignedCount
    ? Math.round((monitor.value.submittedCount / monitor.value.assignedCount) * 100)
    : 0
)
</script>

<template>
  <div class="page" v-loading="loading">
    <div class="page-header">
      <el-button link @click="router.push('/admin/exams')">
        <el-icon><ArrowLeft /></el-icon>返回考试列表
      </el-button>
      <h3 class="page-title">考试实时监控 · {{ monitor?.sessionName || '' }}</h3>
      <div class="page-header-right">
        <el-switch
          :model-value="autoRefresh"
          @change="(v: unknown) => toggleAutoRefresh(v as boolean)"
          active-text="自动刷新"
        />
        <el-button @click="load()">
          <el-icon><Refresh /></el-icon>手动刷新
        </el-button>
        <el-button
          type="danger"
         
          :disabled="!monitor?.ongoingCount"
          :loading="submitting"
          @click="doForceSubmit"
        >
          <el-icon><Finished /></el-icon>强制收卷
        </el-button>
        <el-button
          type="primary"
         
          @click="router.push(`/admin/exams/${sessionId}/statistics`)"
        >
          <el-icon><DataAnalysis /></el-icon>查看统计
        </el-button>
      </div>
    </div>

    <!-- 概览卡片 -->
    <el-row :gutter="16" class="overview">
      <el-col :span="6">
        <div class="ov-card">
          <div class="ov-label">试卷</div>
          <div class="ov-value paper">{{ monitor?.paperName || '-' }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="ov-card">
          <div class="ov-label">指派人数</div>
          <div class="ov-value">{{ monitor?.assignedCount ?? 0 }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="ov-card">
          <div class="ov-label">已进入 <span class="pct">({{ attendedPct }}%)</span></div>
          <div class="ov-value" style="color:#409eff">{{ monitor?.attendedCount ?? 0 }}</div>
          <el-progress
            :percentage="attendedPct"
            :stroke-width="4"
            :show-text="false"
            color="#409eff"
          />
        </div>
      </el-col>
      <el-col :span="6">
        <div class="ov-card">
          <div class="ov-label">已提交 <span class="pct">({{ submittedPct }}%)</span></div>
          <div class="ov-value" style="color:#67c23a">{{ monitor?.submittedCount ?? 0 }}</div>
          <el-progress
            :percentage="submittedPct"
            :stroke-width="4"
            :show-text="false"
            color="#67c23a"
          />
        </div>
      </el-col>
    </el-row>

    <el-card shadow="never">
      <template #header>
        <div class="card-head">
          <div>
            <el-icon><User /></el-icon>
            <span style="font-weight:600; margin-left:6px">考生列表</span>
            <el-tag type="warning" style="margin-left:8px" v-if="monitor?.ongoingCount">
              进行中 {{ monitor.ongoingCount }} 人
            </el-tag>
          </div>
        </div>
      </template>

      <el-table :data="monitor?.examinees ?? []" style="width:100%">
        <el-table-column type="index" label="#" width="60" />
        <el-table-column label="学生" min-width="180">
          <template #default="{ row }">
            <div class="student-cell">
              <span class="name">{{ row.realName || row.username }}</span>
              <span v-if="row.realName" class="uname">({{ row.username }})</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="startTime" label="开始时间" width="180" />
        <el-table-column prop="submitTime" label="提交时间" width="180" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusType(row.submitStatus)">
              {{ row.submitStatusText || statusText(row.submitStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="得分" width="140" align="center">
          <template #default="{ row }">
            <template v-if="row.totalScore != null">
              <span :style="{ color: scoreColor(row.scorePercentage), fontWeight: 600 }">
                {{ row.totalScore }}
              </span>
              <span v-if="row.scorePercentage != null" style="color:#909399; margin-left:4px">
                ({{ row.scorePercentage.toFixed(1) }})
              </span>
            </template>
            <span v-else style="color:#c0c4cc">-</span>
          </template>
        </el-table-column>
        <el-table-column label="正确率" width="110" align="center">
          <template #default="{ row }">
            <template v-if="row.correctCount != null && row.wrongCount != null">
              <span style="color:#67c23a">{{ row.correctCount }}</span> /
              <span style="color:#f56c6c">{{ row.wrongCount }}</span>
            </template>
            <span v-else style="color:#c0c4cc">-</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.page { display: flex; flex-direction: column; gap: 12px; }
.page-header {
  display: flex; align-items: center; gap: 12px;
  .page-title { margin: 0; font-size: 18px; font-weight: 600; flex: 1; }
  .page-header-right { display: flex; align-items: center; gap: 10px; }
}

.overview .ov-card {
  background: #fff; border-radius: 8px; padding: 16px 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  min-height: 92px;
}
.ov-label {
  color: #909399; font-size: 12px; margin-bottom: 6px;
  .pct { color: #c0c4cc; font-size: 11px; margin-left: 4px; }
}
.ov-value {
  font-size: 24px; font-weight: 700; color: #303133;
  &.paper { font-size: 15px; font-weight: 500; }
}

.card-head { display: flex; align-items: center; justify-content: space-between; }
.student-cell { display: flex; align-items: baseline; gap: 6px; }
.name { font-weight: 500; }
.uname { font-size: 12px; color: #909399; }
</style>
