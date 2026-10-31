<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import { getAvailableExams, getAttendedExams, startExam } from '@/api/student'
import type { AvailableExam } from '@/types/exam'

const router = useRouter()

/** 当前 tab：all=全部 / available=待考 / resume=续考 / attended=已参加 */
const tab = ref<'all' | 'available' | 'resume' | 'attended' | 'missed'>('all')

const availableExams = ref<AvailableExam[]>([])
const attendedExams = ref<AvailableExam[]>([])
const loadingAvailable = ref(false)
const loadingAttended = ref(false)

const now = ref(Date.now())
let timer: number | null = null

const loadAvailable = async () => {
  loadingAvailable.value = true
  try {
    const res = await getAvailableExams()
    availableExams.value = Array.isArray(res.data) ? res.data : []
  } finally {
    loadingAvailable.value = false
  }
}

const loadAttended = async () => {
  loadingAttended.value = true
  try {
    const res = await getAttendedExams()
    attendedExams.value = Array.isArray(res.data) ? res.data : []
  } finally {
    loadingAttended.value = false
  }
}

const isOngoing = (e: AvailableExam) => {
  const s = Date.parse(e.startTime)
  const t = Date.parse(e.endTime)
  return now.value >= s && now.value <= t
}

const isNotStarted = (e: AvailableExam) => now.value < Date.parse(e.startTime)
const isEnded = (e: AvailableExam) => now.value > Date.parse(e.endTime)
/** 缺考 / 已过期未提交：场次已结束，且未参与或进入后未提交 */
const isMissed = (e: AvailableExam) => isEnded(e) && (e.submitStatus == null || e.submitStatus === 0)

/** 有未完成答卷（意外退出/断点）→ 列表按钮显示「续考」 */
const isResume = (e: AvailableExam) => e.submitStatus === 0 && e.examRecordId != null && !isEnded(e)

/** 严格模式：不允许续考 */
const cannotResume = (e: AvailableExam) => isResume(e) && e.allowResume === false

const statusInfo = (e: AvailableExam) => {
  if (isMissed(e)) return { text: '已缺考', type: 'danger' as const }
  if (isNotStarted(e)) return { text: '未开始', type: 'info' as const }
  if (isEnded(e)) return { text: '已结束', type: 'info' as const }
  return { text: '进行中', type: 'success' as const }
}

/** 已考 tab 的状态标签 */
const attendedStatusInfo = (e: AvailableExam) => {
  if (e.submitStatus === 0) return { text: '进行中(未提交)', type: 'warning' as const }
  if (e.submitStatus === 2) return { text: '超时提交', type: 'info' as const }
  if (e.submitStatus === 1) return { text: '已提交', type: 'success' as const }
  return { text: '已开始', type: 'info' as const }
}

/* ---------------- 汇总统计（客户端从已加载数据聚合） ---------------- */
const stats = computed(() => {
  const at = attendedExams.value
  const all = allExams.value
  const resumeCount = all.filter(isResume).length
  const liveCount = all.filter((e) => isOngoing(e) && !isResume(e)).length
  const notStartedCount = all.filter(isNotStarted).length
  const missedCount = all.filter(isMissed).length
  const submittedCount = at.filter((e) => e.submitStatus === 1 || e.submitStatus === 2).length
  const scoreList = at.map((e) => e.myScore).filter((s): s is number => s != null)
  const avgScore = scoreList.length
    ? scoreList.reduce((a, b) => a + b, 0) / scoreList.length
    : null
  return {
    available: all.filter((e) => isPending(e) && !isEnded(e)).length,
    resumeCount,
    liveCount,
    notStartedCount,
    missedCount,
    attended: at.length,
    submittedCount,
    avgScore,
  }
})

/* ---------------- 查询条件（客户端过滤） ---------------- */
const query = reactive({
  keyword: '',
  status: '' as '' | 'live' | 'not_started' | 'ended' | 'resume' | 'submitted' | 'unfinished' | 'missed',
})

const matchKeyword = (e: AvailableExam) => {
  const kw = query.keyword.trim().toLowerCase()
  if (!kw) return true
  return (
    (e.sessionName || '').toLowerCase().includes(kw) ||
    (e.paperName || '').toLowerCase().includes(kw)
  )
}

/** 排序权重：续考(0) → 待考(1) → 已参加(2)；组内待考按开始时间升序，已参加按开始时间降序 */
const tabRank = (e: AvailableExam) => {
  if (isResume(e)) return 0
  if (e.submitStatus == null) return 1 // 未开考（待考）
  return 2 // 已有记录且非续考 = 已参加（含已提交/超时）
}

const bySort = (a: AvailableExam, b: AvailableExam) => {
  const ra = tabRank(a)
  const rb = tabRank(b)
  if (ra !== rb) return ra - rb
  const ta = Date.parse(a.startTime) || 0
  const tb = Date.parse(b.startTime) || 0
  // 续考：截止近的优先（endTime 升序）；待考：开始早的优先；已参加：最近的优先
  if (ra === 0) return (Date.parse(a.endTime) || 0) - (Date.parse(b.endTime) || 0)
  if (ra === 1) return ta - tb
  return tb - ta
}

/** 待考：可进入（未开考或开放中且无未完成答卷） */
const isPending = (e: AvailableExam) => !isResume(e) && e.submitStatus == null

const applyStatusFilter = (list: AvailableExam[]) => {
  if (!query.status) return list
  return list.filter((e) => {
    switch (query.status) {
      case 'live':
        return isOngoing(e) && !isResume(e)
      case 'not_started':
        return isNotStarted(e)
      case 'ended':
        return isEnded(e)
      case 'resume':
        return isResume(e)
      case 'submitted':
        return e.submitStatus === 1 || e.submitStatus === 2
      case 'unfinished':
        return e.submitStatus === 0
      case 'missed':
        return isMissed(e)
      default:
        return true
    }
  })
}

/** 合并 available + attended，按 id 去重（优先保留信息更全的一条） */
const allExams = computed(() => {
  const map = new Map<number, AvailableExam>()
  for (const e of availableExams.value) map.set(e.id, e)
  for (const e of attendedExams.value) {
    const prev = map.get(e.id)
    // attended 带 submitStatus/myScore，信息更全则覆盖
    if (!prev || (e.submitStatus != null && prev.submitStatus == null)) map.set(e.id, e)
  }
  return [...map.values()]
})

const filteredAll = computed(() =>
  applyStatusFilter(allExams.value.filter(matchKeyword)).sort(bySort)
)
const filteredAvailable = computed(() =>
  applyStatusFilter(allExams.value.filter((e) => matchKeyword(e) && isPending(e))).sort(bySort)
)
const filteredResume = computed(() =>
  applyStatusFilter(allExams.value.filter((e) => matchKeyword(e) && isResume(e))).sort(bySort)
)
const filteredAttended = computed(() =>
  applyStatusFilter(
    attendedExams.value.filter((e) => matchKeyword(e) && !isResume(e) && !isMissed(e))
  ).sort(bySort)
)
const filteredMissed = computed(() =>
  applyStatusFilter(allExams.value.filter((e) => matchKeyword(e) && isMissed(e))).sort(bySort)
)

/** 当前 tab 渲染列表 */
const currentList = computed(() => {
  switch (tab.value) {
    case 'all':
      return filteredAll.value
    case 'available':
      return filteredAvailable.value
    case 'resume':
      return filteredResume.value
    case 'attended':
      return filteredAttended.value
    case 'missed':
      return filteredMissed.value
    default:
      return filteredAll.value
  }
})

const search = () => {
  /* 纯客户端过滤，无需重拉 */
}
const reset = () => {
  query.keyword = ''
  query.status = ''
}

/* ---------------- 进入 / 查看 ---------------- */
const entering = ref<number | null>(null)
const enterExam = async (e: AvailableExam) => {
  if (!isOngoing(e)) return
  if (cannotResume(e)) {
    ElMessage.warning('本场考试为严格模式，不允许续考')
    return
  }
  try {
    await ElMessageBox.confirm(
      isResume(e)
        ? `《${e.sessionName}》有未完成答卷，将从上次进度继续（剩余时间接着算）。确认续考？`
        : `即将进入《${e.sessionName}》，考试时长 ${e.duration} 分钟。进入后倒计时会开始，请提前准备好网络与安静环境。`,
      isResume(e) ? '续考' : '进入考试',
      { confirmButtonText: isResume(e) ? '续考' : '进入', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }

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

/** 已考 tab 卡片点击：跳到结果详情 */
const viewResult = (e: AvailableExam) => {
  if (e.examRecordId == null) return
  if (e.submitStatus === 0) {
    router.push(`/student/exam-room/${e.examRecordId}`)
  } else {
    router.push(`/student/results/${e.examRecordId}`)
  }
}

const refresh = () => {
  loadAvailable()
  loadAttended()
}

onMounted(() => {
  loadAvailable()
  loadAttended()
  timer = window.setInterval(() => (now.value = Date.now()), 30_000)
})

onBeforeUnmount(() => {
  if (timer != null) window.clearInterval(timer)
})

const allCount = computed(() => filteredAll.value.length)
const availableCount = computed(() => filteredAvailable.value.length)
const resumeCount = computed(() => filteredResume.value.length)
const attendedCount = computed(() => filteredAttended.value.length)
const missedCount = computed(() => filteredMissed.value.length)

/** 时间显示：去掉秒，统一短格式 */
const fmtTime = (v: string) => (v || '').slice(0, 16)
</script>

<template>
  <div class="page">
    <!-- ============================ 页头 ============================ -->
    <div class="page-header">
      <h3 class="page-title">在线考试</h3>
      <el-button @click="refresh"><el-icon><Refresh /></el-icon>刷新</el-button>
    </div>

    <!-- ============================ 汇总统计（纯客户端动态计算） ============================ -->
    <el-row :gutter="12" class="stat-row">
      <el-col :span="5">
        <div class="stat-card">
          <div class="stat-label">待考场次</div>
          <div class="stat-value text-primary">{{ stats.available }}</div>
          <div class="stat-sub">开放中 {{ stats.liveCount }} · 未开始 {{ stats.notStartedCount }}</div>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card">
          <div class="stat-label">可续考答卷</div>
          <div class="stat-value text-warning">{{ stats.resumeCount }}</div>
          <div class="stat-sub">{{ stats.resumeCount > 0 ? '进行中可继续' : '暂无未完答卷' }}</div>
        </div>
      </el-col>
      <el-col :span="5">
        <div class="stat-card">
          <div class="stat-label">参加场次</div>
          <div class="stat-value">{{ stats.attended }}</div>
          <div class="stat-sub">已提交 {{ stats.submittedCount }} 场</div>
        </div>
      </el-col>
      <el-col :span="5">
        <div class="stat-card">
          <div class="stat-label">缺考 / 已过期</div>
          <div class="stat-value text-danger" style="color:#f56c6c">{{ stats.missedCount }}</div>
          <div class="stat-sub">{{ stats.missedCount > 0 ? '场次已截止未参与' : '无缺考场次' }}</div>
        </div>
      </el-col>
      <el-col :span="5">
        <div class="stat-card">
          <div class="stat-label">平均得分</div>
          <div class="stat-value text-success">
            {{ stats.avgScore != null ? stats.avgScore.toFixed(1) : '—' }}
          </div>
          <div class="stat-sub">{{ stats.avgScore != null ? '百分制' : '暂无成绩' }}</div>
        </div>
      </el-col>
    </el-row>

    <!-- ============================ 查询条件 ============================ -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="query" @submit.prevent>
        <el-form-item label="考试名称">
          <el-input
            v-model="query.keyword"
            placeholder="搜索场次 / 试卷名称"
            clearable
            style="width: 220px"
            @keyup.enter="search"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" clearable placeholder="全部" style="width: 150px">
            <template v-if="tab === 'available'">
              <el-option label="可续考" value="resume" />
              <el-option label="进行中" value="live" />
              <el-option label="未开始" value="not_started" />
              <el-option label="已结束" value="ended" />
            </template>
            <template v-else>
              <el-option label="未提交" value="unfinished" />
              <el-option label="已提交" value="submitted" />
              <el-option label="可续考" value="resume" />
            </template>
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="search">查询</el-button>
          <el-button @click="reset">重置</el-button>
          <el-button @click="refresh">刷新</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- ============================ Tab 列表 ============================ -->
    <el-tabs v-model="tab" class="exam-tabs">
      <!-- ============================ 全部 ============================ -->
      <el-tab-pane :name="'all'">
        <template #label>
          <span class="tab-label">
            全部
            <el-badge :value="allCount" :max="999" :hidden="!allCount" class="tab-badge" />
          </span>
        </template>
        <div v-loading="loadingAvailable || loadingAttended">
          <el-empty
            v-if="!currentList.length && !(loadingAvailable || loadingAttended)"
            :description="query.keyword || query.status ? '没有符合条件的考试' : '暂无考试'"
          />
          <div class="exam-grid">
            <div
              v-for="e in currentList"
              :key="'all-' + e.id"
              class="exam-card"
              :class="{
                'is-live': isOngoing(e) && !isResume(e),
                'is-resume': isResume(e) && !cannotResume(e),
                'is-strict': cannotResume(e),
                'is-soon': isNotStarted(e) && !isResume(e),
                'is-attended': e.submitStatus != null && !isResume(e),
              }"
            >
              <div class="card-head">
                <h4 class="exam-name" :title="e.sessionName">{{ e.sessionName }}</h4>
                <div class="head-tags">
                  <el-tag v-if="isResume(e)" :type="e.allowResume === false ? 'danger' : 'warning'">
                    {{ e.allowResume === false ? '严格·不可续考' : '未完成' }}
                  </el-tag>
                  <el-tag
                    v-if="e.submitStatus != null && !isResume(e)"
                    :type="attendedStatusInfo(e).type"
                   
                  >{{ attendedStatusInfo(e).text }}</el-tag>
                  <el-tag v-else :type="statusInfo(e).type">{{ statusInfo(e).text }}</el-tag>
                </div>
              </div>
              <div class="card-body">
                <div class="row">
                  <el-icon><Document /></el-icon>
                  <span class="row-text" :title="e.paperName">{{ e.paperName || `试卷 #${e.paperId}` }}</span>
                </div>
                <div class="row">
                  <el-icon><Timer /></el-icon>
                  <span>{{ e.duration }} 分钟</span>
                </div>
                <div class="row">
                  <el-icon><Clock /></el-icon>
                  <span>{{ fmtTime(e.startTime) }}</span>
                </div>
                <div class="row">
                  <el-icon><Clock /></el-icon>
                  <span>{{ fmtTime(e.endTime) }}</span>
                </div>
                <div v-if="e.myScore != null" class="row score-row">
                  <el-icon><Medal /></el-icon>
                  <span>
                    我的得分：
                    <strong :class="Number(e.myScore) >= 60 ? 'score-ok' : 'score-ng'">{{ Number(e.myScore).toFixed(2) }}</strong>
                    分
                  </span>
                </div>
              </div>
              <div class="card-foot">
                <el-button
                  v-if="e.submitStatus != null && !isResume(e)"
                  type="primary"
                  :disabled="e.examRecordId == null"
                  style="width: 100%"
                  @click="viewResult(e)"
                >查看成绩详情</el-button>
                <el-button
                  v-else
                  type="primary"
                  :disabled="!isOngoing(e) || cannotResume(e)"
                  :loading="entering === e.id"
                  style="width: 100%"
                  @click="enterExam(e)"
                >
                  {{ cannotResume(e) ? '不可续考' : isResume(e) ? '续考' : isOngoing(e) ? '进入考试' : statusInfo(e).text }}
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- ============================ 待考 ============================ -->
      <el-tab-pane :name="'available'">
        <template #label>
          <span class="tab-label">
            待考
            <el-badge :value="availableCount" :max="99" :hidden="!availableCount" class="tab-badge" />
          </span>
        </template>
        <div v-loading="loadingAvailable || loadingAttended">
          <el-empty
            v-if="!currentList.length && !(loadingAvailable || loadingAttended)"
            :description="query.keyword || query.status ? '没有符合条件的考试' : '暂无可参加的考试'"
          />
          <div class="exam-grid">
            <div
              v-for="e in currentList"
              :key="'av-' + e.id"
              class="exam-card"
              :class="{
                'is-live': isOngoing(e),
                'is-soon': isNotStarted(e),
              }"
            >
              <div class="card-head">
                <h4 class="exam-name" :title="e.sessionName">{{ e.sessionName }}</h4>
                <div class="head-tags">
                  <el-tag :type="statusInfo(e).type">{{ statusInfo(e).text }}</el-tag>
                </div>
              </div>
              <div class="card-body">
                <div class="row">
                  <el-icon><Document /></el-icon>
                  <span class="row-text" :title="e.paperName">{{ e.paperName || `试卷 #${e.paperId}` }}</span>
                </div>
                <div class="row">
                  <el-icon><Timer /></el-icon>
                  <span>{{ e.duration }} 分钟</span>
                </div>
                <div class="row">
                  <el-icon><Clock /></el-icon>
                  <span>{{ fmtTime(e.startTime) }}</span>
                </div>
                <div class="row">
                  <el-icon><Clock /></el-icon>
                  <span>{{ fmtTime(e.endTime) }}</span>
                </div>
              </div>
              <div class="card-foot">
                <el-button
                  type="primary"
                  :disabled="!isOngoing(e)"
                  :loading="entering === e.id"
                  style="width: 100%"
                  @click="enterExam(e)"
                >{{ isOngoing(e) ? '进入考试' : statusInfo(e).text }}</el-button>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- ============================ 续考 ============================ -->
      <el-tab-pane :name="'resume'">
        <template #label>
          <span class="tab-label">
            续考
            <el-badge :value="resumeCount" :max="99" :hidden="!resumeCount" type="warning" class="tab-badge" />
          </span>
        </template>
        <div v-loading="loadingAvailable || loadingAttended">
          <el-empty
            v-if="!currentList.length && !(loadingAvailable || loadingAttended)"
            :description="query.keyword || query.status ? '没有符合条件的考试' : '没有未完成的答卷'"
          />
          <div class="exam-grid">
            <div
              v-for="e in currentList"
              :key="'rs-' + e.id"
              class="exam-card"
              :class="{ 'is-resume': !cannotResume(e), 'is-strict': cannotResume(e) }"
            >
              <div class="card-head">
                <h4 class="exam-name" :title="e.sessionName">{{ e.sessionName }}</h4>
                <div class="head-tags">
                  <el-tag :type="e.allowResume === false ? 'danger' : 'warning'">
                    {{ e.allowResume === false ? '严格·不可续考' : '未完成' }}
                  </el-tag>
                </div>
              </div>
              <div class="card-body">
                <div class="row">
                  <el-icon><Document /></el-icon>
                  <span class="row-text" :title="e.paperName">{{ e.paperName || `试卷 #${e.paperId}` }}</span>
                </div>
                <div class="row">
                  <el-icon><Timer /></el-icon>
                  <span>{{ e.duration }} 分钟</span>
                </div>
                <div class="row">
                  <el-icon><Clock /></el-icon>
                  <span>截止 {{ fmtTime(e.endTime) }}</span>
                </div>
              </div>
              <div class="card-foot">
                <el-button
                  type="primary"
                  :disabled="!isOngoing(e) || cannotResume(e)"
                  :loading="entering === e.id"
                  style="width: 100%"
                  @click="enterExam(e)"
                >{{ cannotResume(e) ? '不可续考' : isOngoing(e) ? '续考' : '已截止' }}</el-button>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- ============================ 已参加 ============================ -->
      <el-tab-pane :name="'attended'">
        <template #label>
          <span class="tab-label">
            已参加
            <el-badge :value="attendedCount" :max="99" :hidden="!attendedCount" type="info" class="tab-badge" />
          </span>
        </template>
        <div v-loading="loadingAttended">
          <el-empty
            v-if="!currentList.length && !loadingAttended"
            :description="query.keyword || query.status ? '没有符合条件的考试' : '还没有参加过任何考试'"
          />
          <div class="exam-grid">
            <div
              v-for="e in currentList"
              :key="'at-' + e.id"
              class="exam-card is-attended"
            >
              <div class="card-head">
                <h4 class="exam-name" :title="e.sessionName">{{ e.sessionName }}</h4>
                <div class="head-tags">
                  <el-tag :type="attendedStatusInfo(e).type">{{ attendedStatusInfo(e).text }}</el-tag>
                </div>
              </div>
              <div class="card-body">
                <div class="row">
                  <el-icon><Document /></el-icon>
                  <span class="row-text" :title="e.paperName">{{ e.paperName || `试卷 #${e.paperId}` }}</span>
                </div>
                <div class="row">
                  <el-icon><Timer /></el-icon>
                  <span>{{ e.duration }} 分钟</span>
                </div>
                <div class="row">
                  <el-icon><Clock /></el-icon>
                  <span>{{ fmtTime(e.startTime) }}</span>
                </div>
                <div v-if="e.myScore != null" class="row score-row">
                  <el-icon><Medal /></el-icon>
                  <span>
                    我的得分：
                    <strong :class="Number(e.myScore) >= 60 ? 'score-ok' : 'score-ng'">{{ Number(e.myScore).toFixed(2) }}</strong>
                    分
                  </span>
                </div>
              </div>
              <div class="card-foot">
                <el-button
                  type="primary"
                  :disabled="e.examRecordId == null"
                  style="width: 100%"
                  @click="viewResult(e)"
                >查看成绩详情</el-button>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>
      <!-- ============================ 缺考 ============================ -->
      <el-tab-pane :name="'missed'">
        <template #label>
          <span class="tab-label">
            缺考 / 已过期
            <el-badge :value="missedCount" :max="99" :hidden="!missedCount" class="tab-badge" type="danger" />
          </span>
        </template>
        <div v-loading="loadingAvailable || loadingAttended">
          <el-empty
            v-if="!currentList.length && !(loadingAvailable || loadingAttended)"
            description="没有缺考场次"
          />
          <div class="exam-grid">
            <div
              v-for="e in currentList"
              :key="'missed-' + e.id"
              class="exam-card is-ended"
            >
              <div class="card-head">
                <h4 class="exam-name" :title="e.sessionName">{{ e.sessionName }}</h4>
                <div class="head-tags">
                  <el-tag type="danger">已缺考</el-tag>
                </div>
              </div>
              <div class="card-body">
                <div class="row">
                  <el-icon><Document /></el-icon>
                  <span class="row-text" :title="e.paperName">{{ e.paperName || `试卷 #${e.paperId}` }}</span>
                </div>
                <div class="row">
                  <el-icon><Timer /></el-icon>
                  <span>{{ e.duration }} 分钟</span>
                </div>
                <div class="row">
                  <el-icon><Clock /></el-icon>
                  <span>{{ fmtTime(e.startTime) }}</span>
                </div>
                <div class="row">
                  <el-icon><Clock /></el-icon>
                  <span>{{ fmtTime(e.endTime) }} (已截止)</span>
                </div>
                <div class="row score-row">
                  <el-icon><Warning /></el-icon>
                  <span style="color:#f56c6c">状态：未在开放时间内参加 / 未交卷</span>
                </div>
              </div>
              <div class="card-foot">
                <el-button
                  v-if="e.examRecordId != null"
                  type="primary"
                  style="width: 100%"
                  @click="viewResult(e)"
                >查看答卷/成绩</el-button>
                <el-button
                  v-else
                  disabled
                  type="info"
                  style="width: 100%"
                >考试已截止（缺考）</el-button>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped lang="scss">
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

/* ---------- 统计卡 ---------- */
.stat-row {
  margin: 0 !important;
}
.stat-card {
  background: #fff;
  border-radius: 8px;
  padding: 18px 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  transition: all 0.2s;
  &:hover {
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
  }
}
.stat-label {
  color: #909399;
  font-size: 13px;
  margin-bottom: 6px;
}
.stat-value {
  font-size: 26px;
  font-weight: 600;
  color: #303133;
  line-height: 1.2;
}
.stat-sub {
  margin-top: 6px;
  font-size: 12px;
  color: #b0b3b9;
}
.text-primary {
  color: #409eff;
}
.text-warning {
  color: #e6a23c;
}
.text-success {
  color: #67c23a;
}

/* ---------- 筛选卡 ---------- */
.filter-card :deep(.el-card__body) {
  padding-bottom: 0;
}

/* ---------- Tabs ---------- */
.exam-tabs {
  background: #fff;
  border-radius: 8px;
  padding: 4px 16px 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}
.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.tab-badge {
  margin-left: 2px;
}

/* ---------- 卡片网格 ---------- */
.exam-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 14px;
  padding-top: 4px;
}

.exam-card {
  background: #fff;
  border-radius: 8px;
  padding: 18px 18px 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.15s, transform 0.15s;
  border: 1px solid #ebeef5;
  display: flex;
  flex-direction: column;

  &:hover {
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }

  &.is-live {
    border-color: #b3e19d;
    background: linear-gradient(180deg, #f8fff6 0%, #fff 48%);
  }
  &.is-resume {
    border-color: #f3d19e;
    background: linear-gradient(180deg, #fffaf2 0%, #fff 48%);
  }
  &.is-strict {
    border-color: #fab6b6;
    background: linear-gradient(180deg, #fff6f6 0%, #fff 48%);
  }
  &.is-soon {
    border-color: #d3dce6;
  }
  &.is-attended {
    border-color: #e4e7ed;
    background: #fafcff;
  }
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 12px;
  min-height: 40px;
}
.head-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: flex-end;
  flex-shrink: 0;
}
.exam-name {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  flex: 1;
  color: #303133;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-body {
  color: #606266;
  font-size: 13px;
  flex: 1;
}
.row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  .el-icon {
    color: #a0a6ad;
    flex-shrink: 0;
  }
}
.row-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.score-row {
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px dashed #ebeef5;
}
.score-ok {
  color: #67c23a;
  font-size: 16px;
}
.score-ng {
  color: #f56c6c;
  font-size: 16px;
}

.card-foot {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #f0f2f5;
}
</style>
