<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { getAvailableExams, startExam } from '@/api/student'
import type { AvailableExam } from '@/types/exam'

const router = useRouter()

const exams = ref<AvailableExam[]>([])
const loading = ref(false)

const load = async () => {
  loading.value = true
  try {
    const res = await getAvailableExams()
    exams.value = res.data ?? []
  } finally {
    loading.value = false
  }
}

const now = ref(Date.now())
setInterval(() => (now.value = Date.now()), 30_000)

const isOngoing = (e: AvailableExam) => {
  const s = Date.parse(e.startTime)
  const t = Date.parse(e.endTime)
  return now.value >= s && now.value <= t
}

/**
 * 进入考试：
 *  1. 先调 POST /exams/start/{sessionId} 拿到 examRecordId（幂等）
 *  2. 路由到 /student/exam-room/:examId （这里的 examId 是 examRecordId，不是 sessionId！）
 */
const entering = ref<number | null>(null)
const enterExam = async (e: AvailableExam) => {
  if (!isOngoing(e)) return
  try {
    await ElMessageBox.confirm(
      `即将进入《${e.sessionName}》，考试时长 ${e.duration} 分钟。进入后倒计时会开始，请提前准备好网络与安静环境。`,
      '进入考试',
      { confirmButtonText: '进入', cancelButtonText: '取消', type: 'warning' }
    )
  } catch { return }

  entering.value = e.id
  try {
    const res = await startExam(e.id)
    const examRecordId = res.data.id
    router.push(`/student/exam-room/${examRecordId}`)
  } catch {
    ElMessage.error('开始考试失败，请稍后再试')
  } finally {
    entering.value = null
  }
}

onMounted(load)

const statusInfo = (e: AvailableExam) => {
  const s = Date.parse(e.startTime)
  const t = Date.parse(e.endTime)
  if (now.value < s) return { text: '未开始', type: 'info' as const }
  if (now.value > t) return { text: '已结束', type: 'danger' as const }
  return { text: '进行中', type: 'success' as const }
}
</script>

<template>
  <div class="page" v-loading="loading">
    <div class="page-header">
      <h3 class="page-title">在线考试</h3>
      <el-button size="small" @click="load"><el-icon><Refresh /></el-icon>刷新</el-button>
    </div>

    <el-empty v-if="!exams.length && !loading" description="暂无可参加的考试" />

    <el-row :gutter="16">
      <el-col v-for="e in exams" :key="e.id" :span="8" style="margin-bottom: 16px">
        <div class="exam-card" :class="{ 'is-live': isOngoing(e) }">
          <div class="card-head">
            <h4 class="exam-name">{{ e.sessionName }}</h4>
            <el-tag :type="statusInfo(e).type" size="small">{{ statusInfo(e).text }}</el-tag>
          </div>
          <div class="card-body">
            <div class="row"><el-icon><Document /></el-icon><span>{{ e.paperName || `试卷 #${e.paperId}` }}</span></div>
            <div class="row"><el-icon><Timer /></el-icon><span>{{ e.duration }} 分钟</span></div>
            <div class="row"><el-icon><Clock /></el-icon><span>开始：{{ e.startTime }}</span></div>
            <div class="row"><el-icon><Clock /></el-icon><span>结束：{{ e.endTime }}</span></div>
            <div v-if="e.attendedCount != null" class="row"><el-icon><User /></el-icon><span>已考人数：{{ e.attendedCount }}</span></div>
          </div>
          <div class="card-foot">
            <el-button
              type="primary"
              :disabled="!isOngoing(e)"
              :loading="entering === e.id"
              style="width: 100%"
              @click="enterExam(e)"
            >
              {{ isOngoing(e) ? '进入考试' : statusInfo(e).text }}
            </el-button>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped lang="scss">
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.page-title { margin: 0; font-size: 18px; font-weight: 600; }

.exam-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: box-shadow 0.15s, transform 0.15s;
  border: 1px solid transparent;

  &:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); transform: translateY(-2px); }
  &.is-live { border-color: #67c23a; }
}
.card-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
.exam-name { margin: 0; font-size: 16px; font-weight: 600; flex: 1; padding-right: 8px; }

.card-body { color: #606266; font-size: 13px; }
.row { display: flex; align-items: center; gap: 6px; padding: 4px 0; }

.card-foot { margin-top: 16px; padding-top: 12px; border-top: 1px solid #f0f0f0; }
</style>
