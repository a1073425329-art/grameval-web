<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Calendar, Check, Cpu, TrendCharts, Odometer, DataLine, CircleClose } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getMySummary, getAvailableExams, getStudentStatistics, getMyResults, listPractices, getMyLearningProgress, getWeakCategories, checkIn, getMyProfile } from '@/api/student'
import { getMyScoreTrend } from '@/api/scoreCurve'
import type { ResultSummary, ExamResultItem } from '@/types/result'
import type { AvailableExam } from '@/types/exam'
import type { StudentStatistics } from '@/types/stats'
import type { PracticeRecord } from '@/types/question'
import type { LearningProgress } from '@/types/progress'
import type { PageResult } from '@/types/common'
import type { ScoreCurve } from '@/types/scoreCurve'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'

use([CanvasRenderer, LineChart, BarChart, PieChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent])

const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false)

const summary = ref<ResultSummary>({ totalCount: 0, averageScore: 0, highestScore: 0, lowestScore: 0, totalAccuracy: 0 })
const availableExams = ref<AvailableExam[]>([])
const stats = ref<StudentStatistics | null>(null)
const recentResults = ref<ExamResultItem[]>([])
const recentPractices = ref<PracticeRecord[]>([])
const learningProgress = ref<LearningProgress[]>([])
const weakProgress = ref<LearningProgress[]>([])

// 学习打卡状态
const streakDays = ref(0)
const totalStudyDays = ref(0)
const dailyTargetCount = ref(10)
/* [2026-10-17] 后端 /users/my-profile 实际不返回 totalQuestionsDone / totalCorrectCount，
   原先直接取 profile 导致首页「累计做题 0 题」。
   改为优先用 /students/{id}/statistics 的真实计数（练习 + 考试），profile 仅作兜底。 */
const profileTotalQuestions = ref(0)
const profileTotalCorrect = ref(0)
const isCheckedIn = ref(false)
const checkInLoading = ref(false)

const shortcuts = [
  { title: '语法题库', desc: '按专题浏览 + 学习模式看解析', path: '/student/question-bank', icon: 'Notebook', color: '#409eff' },
  { title: '专项练习', desc: '选专题刷题即时反馈', path: '/student/practice', icon: 'EditPen', color: '#67c23a' },
  { title: '在线考试', desc: '参加考试并答题', path: '/student/exams', icon: 'Document', color: '#e6a23c' },
  { title: '错题本', desc: '去重错题按考点分类', path: '/student/wrong-book', icon: 'CircleClose', color: '#f56c6c' },
  { title: '学习分析', desc: '趋势/雷达/班级对比/考点弱点', path: '/student/stats', icon: 'TrendCharts', color: '#409eff' },
  { title: '个人资料', desc: '查看和编辑个人信息', path: '/student/profile', icon: 'User', color: '#9c27b0' },
]

/* ---- 旧 load 函数（2026-10-16 首页改版，原实现整体保留备查） ----
// const load = async () => {
//   loading.value = true
//   try {
//     const uid = authStore.userInfo?.id
//     const tasks = [
//       getMySummary(),
//       getAvailableExams(),
//       uid ? getStudentStatistics(uid, 'basic,exam,practice,tag') : Promise.resolve(null),
//       getMyResults({ pageNum: 1, pageSize: 50 }),
//       listPractices({ pageNum: 1, pageSize: 50 }),
//       getMyLearningProgress(),
//       getWeakCategories(5),
//       getMyProfile(),
//     ]
//     // tasks 是数组而非元组，noUncheckedIndexedAccess 下解构出的每一项都可能是 undefined，需逐项守卫
//     const [s, e, st, r, p, lp, wp, prof] = await Promise.allSettled(tasks)
//     if (s?.status === 'fulfilled' && s.value) summary.value = (s.value as any).data
//     if (e?.status === 'fulfilled' && e.value) availableExams.value = (e.value as any).data ?? []
//     if (st?.status === 'fulfilled' && st.value) stats.value = (st.value as any).data
//     if (r?.status === 'fulfilled' && r.value) recentResults.value = (r.value as any).data?.records ?? []
//     if (p?.status === 'fulfilled' && p.value) recentPractices.value = (p.value as any).data?.records ?? []
//     if (lp?.status === 'fulfilled' && lp.value) learningProgress.value = (lp.value as any).data ?? []
//     if (wp?.status === 'fulfilled' && wp.value) weakProgress.value = (wp.value as any).data ?? []
//     if (prof?.status === 'fulfilled' && prof.value) {
//       const profile = (prof.value as any).data
//       streakDays.value = profile.streakDays || 0
//       totalStudyDays.value = profile.totalStudyDays || 0
//       dailyTargetCount.value = profile.dailyTargetCount || 10
//       totalQuestionsDone.value = profile.totalQuestionsDone || 0
//       totalCorrectCount.value = profile.totalCorrectCount || 0
//       // 判断今天是否已打卡
//       const lastDate = profile.lastStudyDate
//       if (lastDate) {
//         const today = new Date().toISOString().split('T')[0]
//         isCheckedIn.value = lastDate === today
//       }
//     }
//   } finally { loading.value = false }
// }
*/

/* ============================================================ *
 *  [2026-10-16 首页改版] 新增：Tab / 仪表盘统计 / 成绩曲线
 * ============================================================ */

/** 我的资料（后端 /users/my-profile 返回结构，字段按需取用） */
interface MyProfileLite {
  streakDays?: number
  totalStudyDays?: number
  dailyTargetCount?: number
  totalQuestionsDone?: number
  totalCorrectCount?: number
  lastStudyDate?: string
  avatar?: string
  realName?: string
  englishName?: string
}

const activeTab = ref('overview')
const myProfile = ref<MyProfileLite | null>(null)
const scoreCurve = ref<ScoreCurve[]>([])

/**
 * 统一解包响应负载。
 * 响应拦截器已把 AxiosResponse 换成 ApiResponse（见 utils/request.ts），
 * 运行时 r.value 即 ApiResponse，类型声明滞后于运行时，这里一次性收窄，
 * 避免整个文件散布 `as any`。
 */
const unwrap = <T>(r?: PromiseSettledResult<unknown>): T | undefined => {
  if (!r || r.status !== 'fulfilled' || r.value == null) return undefined
  return (r.value as { data?: T }).data
}

/** 新版 load：在原 8 个请求基础上追加「成绩曲线」，并多取 category/difficulty/wrong 维度 */
const load = async () => {
  loading.value = true
  try {
    const uid = authStore.userInfo?.id
    const tasks: Promise<unknown>[] = [
      getMySummary(),
      getAvailableExams(),
      uid ? getStudentStatistics(uid, 'basic,exam,practice,wrong,category,difficulty,tag') : Promise.resolve(null),
      getMyResults({ pageNum: 1, pageSize: 8 }),
      listPractices({ pageNum: 1, pageSize: 6 }),
      getMyLearningProgress(),
      getWeakCategories(5),
      getMyProfile(),
      getMyScoreTrend(),
    ]
    const [s, e, st, r, p, lp, wp, prof, sc] = await Promise.allSettled(tasks)
    summary.value = unwrap<ResultSummary>(s) ?? summary.value
    availableExams.value = unwrap<AvailableExam[]>(e) ?? []
    stats.value = unwrap<StudentStatistics>(st) ?? null
    recentResults.value = unwrap<PageResult<ExamResultItem>>(r)?.records ?? []
    recentPractices.value = unwrap<PageResult<PracticeRecord>>(p)?.records ?? []
    learningProgress.value = unwrap<LearningProgress[]>(lp) ?? []
    weakProgress.value = unwrap<LearningProgress[]>(wp) ?? []
    scoreCurve.value = unwrap<ScoreCurve[]>(sc) ?? []
    const profile = unwrap<MyProfileLite>(prof)
    if (profile) {
      myProfile.value = profile
      streakDays.value = profile.streakDays ?? 0
      totalStudyDays.value = profile.totalStudyDays ?? 0
      dailyTargetCount.value = profile.dailyTargetCount ?? 10
      profileTotalQuestions.value = profile.totalQuestionsDone ?? 0
      profileTotalCorrect.value = profile.totalCorrectCount ?? 0
      const lastDate = profile.lastStudyDate
      isCheckedIn.value = !!lastDate && lastDate === new Date().toISOString().split('T')[0]
    }
  } finally { loading.value = false }
}

onMounted(load)

const accuracyColor = (v?: number) => {
  if (v == null) return '#909399'
  if (v >= 80) return '#67c23a'
  if (v >= 60) return '#e6a23c'
  return '#f56c6c'
}

/** 弱点分类 mini 柱状图 */
const weakChartOption = computed(() => {
  const tags = stats.value?.tagStats?.slice(0, 5) ?? []
  if (!tags.length) return {}
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 0, right: 10, top: 5, bottom: 0 },
    xAxis: { show: false, type: 'value', max: 100 },
    yAxis: { type: 'category', data: tags.map(t => t.tagName.length > 6 ? t.tagName.slice(0, 6) + '…' : t.tagName).reverse(), axisLabel: { fontSize: 10 } },
    series: [{
      type: 'bar', data: tags.map(t => t.errorRate).reverse(),
      barMaxWidth: 14,
      itemStyle: {
        borderRadius: [0, 4, 4, 0],
        color: (p: any) => { const v = p.value ?? 0; return v <= 25 ? '#67c23a' : v <= 50 ? '#e6a23c' : '#f56c6c' },
      },
    }],
  }
})

// 近5次考试分数 mini 趋势
const scoreMiniOption = computed(() => {
  const list = recentResults.value
  if (!list.length) return {}
  const data = [...list].reverse()
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 0, right: 10, top: 5, bottom: 0 },
    xAxis: { show: false, type: 'category', data: data.map((_, i) => `#${i + 1}`) },
    yAxis: { show: false, type: 'value', min: 0, max: 100 },
    series: [{
      type: 'line', smooth: true, data: data.map(r => r.scorePercentage ?? 0),
      lineStyle: { color: '#409eff', width: 2 }, itemStyle: { color: '#409eff' },
      areaStyle: { color: 'rgba(64,158,255,0.15)' },
    }],
  }
})

const doCheckIn = async () => {
  if (isCheckedIn.value || checkInLoading.value) return
  checkInLoading.value = true
  try {
    const res = await checkIn()
    if (res && res.data) {
      streakDays.value = res.data.streakDays || streakDays.value
      totalStudyDays.value = res.data.totalStudyDays || totalStudyDays.value
      isCheckedIn.value = true
      ElMessage.success('打卡成功！继续保持！')
    }
  } catch {
    ElMessage.error('打卡失败')
  } finally {
    checkInLoading.value = false
  }
}

const examStatus = (e: AvailableExam) => {
  const now = Date.now()
  if (now < Date.parse(e.startTime)) return { text: '未开始', type: 'info' as const }
  if (now > Date.parse(e.endTime)) return { text: '已结束', type: 'danger' as const }
  return { text: '进行中', type: 'success' as const }
}

/* ---------------- 新版：文案与统计 ---------------- */

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '凌晨好'
  if (h < 12) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

const displayName = computed(
  () => authStore.userInfo?.displayName || authStore.userInfo?.username || '同学'
)

const myAvatar = computed(() => myProfile.value?.avatar || stats.value?.avatar || '')

const avatarInitial = computed(() => {
  const name = myProfile.value?.realName || myProfile.value?.englishName || displayName.value
  return name.slice(0, 1).toUpperCase()
})

/** 累计做题 = 练习作答 + 考试作答（statistics 真实计数，profile 兜底） */
const totalQuestionsDone = computed(() => {
  const st = stats.value
  const fromStats = (st?.practiceQuestionCount ?? 0) + (st?.examCorrectCount ?? 0) + (st?.examWrongCount ?? 0)
  return fromStats > 0 ? fromStats : profileTotalQuestions.value
})

/** 累计答对 = 练习答对 + 考试答对 */
const totalCorrectCount = computed(() => {
  const st = stats.value
  const fromStats = (st?.practiceCorrectCount ?? 0) + (st?.examCorrectCount ?? 0)
  return fromStats > 0 ? fromStats : profileTotalCorrect.value
})

/** 累计总正确率 */
const totalAccuracy = computed(() => {
  if (totalQuestionsDone.value <= 0) return 0
  return Math.round((totalCorrectCount.value / totalQuestionsDone.value) * 1000) / 10
})

/** 学习进度 tab 的指标条（只放有真实数据源的指标） */
const studyMetrics = computed(() => [
  { label: '练习次数', value: `${stats.value?.practiceCount ?? 0}`, suffix: '次', color: '#9c27b0' },
  { label: '累计做题', value: `${totalQuestionsDone.value}`, suffix: '题', color: '#409eff' },
  { label: '累计答对', value: `${totalCorrectCount.value}`, suffix: '题', color: '#67c23a' },
  { label: '累计正确率', value: `${totalAccuracy.value}`, suffix: '%', color: accuracyColor(totalAccuracy.value) },
  { label: '每日目标', value: `${dailyTargetCount.value}`, suffix: '题', color: '#e6a23c' },
])

/** 趋势数据：优先取成绩曲线（含班级平均），无则退回最近考试记录 */
const trendData = computed(() => {
  if (scoreCurve.value.length) {
    return scoreCurve.value.slice(-8).map(c => ({
      label: c.examDate?.slice(5) || '考试',
      mine: c.scorePercentage ?? 0,
      classAvg: c.classAvgScore ?? null,
    }))
  }
  // [2026-10-17] 兜底分支同样只取已出分记录，避免未提交记录在曲线上画成 0 分
  return [...recentResults.value]
    .filter(r => r.scorePercentage != null)
    .reverse()
    .slice(0, 8)
    .map((r, i) => ({
      label: r.submitTime?.slice(5, 10) || `#${i + 1}`,
      mine: r.scorePercentage ?? 0,
      classAvg: null,
    }))
})

const trendChartOption = computed(() => {
  const data = trendData.value
  if (!data.length) return {}
  const hasClass = data.some(d => d.classAvg != null)
  const series: any[] = [{
    name: '我的成绩', type: 'line', smooth: true, data: data.map(d => d.mine),
    lineStyle: { color: '#409eff', width: 3 }, itemStyle: { color: '#409eff' },
    areaStyle: {
      color: {
        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [{ offset: 0, color: 'rgba(64,158,255,0.28)' }, { offset: 1, color: 'rgba(64,158,255,0.02)' }],
      },
    },
    markLine: { silent: true, data: [{ type: 'average', name: '均分', lineStyle: { color: '#e6a23c', type: 'dashed' } }] },
  }]
  if (hasClass) {
    series.push({
      name: '班级平均', type: 'line', smooth: true, data: data.map(d => d.classAvg),
      lineStyle: { color: '#e6a23c', width: 2, type: 'dashed' },
      itemStyle: { color: '#e6a23c' }, symbol: 'circle', symbolSize: 5,
    })
  }
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: hasClass ? ['我的成绩', '班级平均'] : ['我的成绩'], bottom: 0, textStyle: { fontSize: 12 } },
    grid: { left: 40, right: 16, top: 16, bottom: 36 },
    xAxis: { type: 'category', data: data.map(d => d.label), axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
    series,
  }
})

/* [2026-10-17 职责划分] scoreDistOption（得分分布环形图）已随该卡片下线 ——
   分数段结构属诊断型内容，归 /student/stats 独占。
   如需恢复，从 git 历史取回（注意过滤 scorePercentage 为 null 的未提交记录）。 */

/* [2026-10-17 职责划分] categoryBarOption / difficultyBarOption 已随
   「薄弱语法大类」「按难度正确率」两块下线（归 /student/stats）。
   如需恢复旧版首页分析图，从 git 历史取回这两个 computed。 */

/** 可参加考试（按状态排序：进行中优先） */
const sortedExams = computed(() => {
  const rank: Record<string, number> = { 进行中: 0, 未开始: 1, 已结束: 2 }
  return [...availableExams.value].sort(
    (a, b) => (rank[examStatus(a).text] ?? 3) - (rank[examStatus(b).text] ?? 3)
  )
})
</script>

<template>
  <div class="student-home" v-loading="loading">
    <!-- ============================================================
         [2026-10-16 首页改版] 原学生首页整块下线，代码原样保留备查。
         恢复方式：删掉下面这行的 v-if="false" 即可回到旧版首页。
         新版首页在下方「新版首页」区块。
         ============================================================ -->
    <div class="legacy-home" v-if="false">
      <!-- Hero -->
      <div class="hero">
        <div class="hero-content">
          <h2>你好，{{ authStore.userInfo?.displayName || authStore.userInfo?.username || '同学' }} 👋</h2>
          <p class="hero-sub">坚持每天练习，语法能力会越来越强！</p>
        </div>
        <!-- [2026-09-26 下线] 学习打卡入口（06 清单 §8.3 O 档：论文 grep「打卡」0 命中）
             原代码整体保留备查，仅加 v-if="false" 隐藏；如需恢复，删掉该 v-if 即可。 -->
        <div class="hero-checkin" v-if="false">
          <div v-if="!isCheckedIn" class="checkin-btn-wrap">
            <el-button type="primary" @click="doCheckIn" :loading="checkInLoading" class="checkin-btn">
              <el-icon><Calendar /></el-icon>今日打卡
            </el-button>
          </div>
          <div v-else class="checkin-success">
            <el-icon color="#67c23a"><Check /></el-icon>
            <span>今日已打卡</span>
            <span class="streak-badge">🔥 连续 {{ streakDays }} 天</span>
          </div>
        </div>
      </div>

      <!-- ====== Stats Row ====== -->
      <el-row :gutter="16" class="stat-row">
        <el-col :span="4">
          <div class="mini-stat" @click="router.push('/student/results')">
            <div class="mini-num">{{ summary.totalCount }}</div>
            <div class="mini-label">考试次数</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="mini-stat">
            <div class="mini-num" :style="{ color: accuracyColor(summary.averageScore) }">{{ summary.averageScore?.toFixed(1) || '-' }}</div>
            <div class="mini-label">平均分</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="mini-stat">
            <div class="mini-num" style="color:#67c23a">{{ summary.highestScore || '-' }}</div>
            <div class="mini-label">最高分</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="mini-stat">
            <div class="mini-num" :style="{ color: accuracyColor(summary.totalAccuracy) }">{{ summary.totalAccuracy?.toFixed(1) || '-' }}%</div>
            <div class="mini-label">总正确率</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="mini-stat" @click="router.push('/student/practice')">
            <div class="mini-num">{{ stats?.practiceCount ?? '-' }}</div>
            <div class="mini-label">练习次数</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="mini-stat" @click="router.push('/student/wrong-book')">
            <div class="mini-num" style="color:#f56c6c">{{ stats?.distinctWrongCount ?? '-' }}</div>
            <div class="mini-label">错题数</div>
          </div>
        </el-col>
      </el-row>

      <!-- ====== 学习目标与打卡统计 ====== -->
      <el-row :gutter="16" class="stat-row">
        <!-- [2026-09-26 下线] 连续学习天数（打卡派生指标，06 §8.3 O 档）；原代码保留备查 -->
        <el-col :span="4" v-if="false">
          <div class="mini-stat">
            <div class="mini-num" style="color:#e6a23c">{{ streakDays }}</div>
            <div class="mini-label">连续学习天数</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="mini-stat">
            <div class="mini-num" style="color:#9c27b0">{{ totalStudyDays }}</div>
            <div class="mini-label">累计学习天数</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="mini-stat">
            <div class="mini-num" style="color:#409eff">{{ totalQuestionsDone }}</div>
            <div class="mini-label">累计做题数</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="mini-stat">
            <div class="mini-num" style="color:#67c23a">{{ totalCorrectCount }}</div>
            <div class="mini-label">累计正确数</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="mini-stat">
            <div class="mini-num" style="color:#f56c6c">{{ totalQuestionsDone > 0 ? ((totalCorrectCount / totalQuestionsDone) * 100).toFixed(1) : '0' }}%</div>
            <div class="mini-label">总正确率</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="mini-stat">
            <div class="mini-num" style="color:#10b981">{{ dailyTargetCount }}</div>
            <div class="mini-label">每日目标题数</div>
          </div>
        </el-col>
      </el-row>

      <!-- ====== 学习进度 ====== -->
      <el-row :gutter="16" v-if="learningProgress.length">
        <el-col :span="24">
          <el-card shadow="never">
            <template #header>
              <div class="card-head">
                <span class="card-title-text">📊 各分类学习进度</span>
                <div class="card-actions">
                  <el-link type="primary" :underline="false" @click="router.push('/student/question-bank')">去练习 →</el-link>
                </div>
              </div>
            </template>
            <div class="progress-grid">
              <div v-for="p in learningProgress" :key="p.categoryId" class="progress-item">
                <div class="pi-header">
                  <span class="pi-name">{{ p.categoryName || '未分类' }}</span>
                  <span class="pi-level" :style="{ color: accuracyColor(p.masteryLevel) }">{{ p.masteryLevel }}%</span>
                </div>
                <div class="pi-bar">
                  <el-progress :percentage="p.masteryLevel" :color="accuracyColor(p.masteryLevel)" :stroke-width="8" :show-text="false" />
                </div>
                <div class="pi-meta">
                  <span>完成 {{ p.completedCount }}/{{ p.totalCount }}</span>
                  <span>正确率 {{ p.accuracy }}%</span>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- ====== Charts Row: 弱点 + 趋势 + 考试 ====== -->
      <el-row :gutter="16">
        <!-- 弱点考点 mini 图 -->
        <el-col :span="8">
          <el-card shadow="never" class="mini-chart-card">
            <template #header><span class="card-title-text">⚠️ 薄弱考点 Top 5</span></template>
            <VChart v-if="weakChartOption.series" :option="weakChartOption" autoresize style="height:140px" />
            <el-empty v-else description="暂无数据" :image-size="60" />
          </el-card>
        </el-col>

        <!-- 最近考试趋势 -->
        <el-col :span="8">
          <el-card shadow="never" class="mini-chart-card">
            <template #header><span class="card-title-text">📈 最近考试趋势</span></template>
            <VChart v-if="scoreMiniOption.series" :option="scoreMiniOption" autoresize style="height:140px" />
            <el-empty v-else description="暂无考试记录" :image-size="60" />
          </el-card>
        </el-col>

        <!-- 快捷入口 -->
        <el-col :span="8">
          <el-card shadow="never" class="mini-chart-card">
            <template #header><span class="card-title-text">⚡ 快捷入口</span></template>
            <div class="shortcut-grid">
              <div v-for="s in shortcuts" :key="s.path" class="shortcut-item" @click="router.push(s.path)">
                <div class="sc-icon" :style="{ background: s.color + '18', color: s.color }">
                  <el-icon :size="18"><component :is="s.icon" /></el-icon>
                </div>
                <div class="sc-text">
                  <div class="sc-title">{{ s.title }}</div>
                  <div class="sc-desc">{{ s.desc }}</div>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- ====== Recent Exams + Practice ====== -->
      <el-row :gutter="16">
        <!-- 最近考试 -->
        <el-col :span="14">
          <el-card shadow="never">
            <template #header>
              <div class="card-head">
                <span class="card-title-text">📝 最近考试记录</span>
                <el-link type="primary" :underline="false" @click="router.push('/student/results')">全部 →</el-link>
              </div>
            </template>
            <el-table v-if="recentResults.length" :data="recentResults" size="small">
              <el-table-column prop="sessionName" label="考试" min-width="140" show-overflow-tooltip />
              <el-table-column label="提交时间" width="160">
                <template #default="{ row }">{{ row.submitTime?.slice(0, 16) || '-' }}</template>
              </el-table-column>
              <el-table-column label="得分" width="100" align="center">
                <template #default="{ row }">
                  <span :style="{ color: accuracyColor(row.scorePercentage), fontWeight: 600 }">{{ row.totalScore ?? '-' }}</span>
                </template>
              </el-table-column>
              <el-table-column label="正确率" width="80" align="center">
                <template #default="{ row }">{{ row.scorePercentage?.toFixed(0) ?? '-' }}%</template>
              </el-table-column>
              <el-table-column label="操作" width="80" align="center">
                <template #default="{ row }">
                  <el-button size="small" type="primary" link @click="router.push(`/student/results/${row.id}`)">详情</el-button>
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-else description="暂无考试记录" :image-size="80" />
          </el-card>
        </el-col>

        <!-- 最近练习 + 可用考试 -->
        <el-col :span="10">
          <!-- 最近练习 -->
          <el-card shadow="never" style="margin-bottom:16px">
            <template #header>
              <div class="card-head">
                <span class="card-title-text">🎯 最近练习</span>
                <el-link type="primary" :underline="false" @click="router.push('/student/practice')">去练习 →</el-link>
              </div>
            </template>
            <div v-if="recentPractices.length" class="practice-list">
              <div v-for="p in recentPractices" :key="p.id" class="practice-row">
                <span class="pr-name">{{ p.categoryName || '综合练习' }}</span>
                <span class="pr-stat">{{ p.correctCount }}/{{ p.questionCount }}</span>
                <!-- [2026-10-16] 仅补一个 `?.`：整块被 v-if="false" 包裹后 TS 视为不可达代码、
                     不再做 v-if 收窄，`p.accuracy` 恢复成 `number | undefined`；语义与原写法等价。 -->
                <span v-if="p.accuracy != null" class="pr-acc" :style="{ color: accuracyColor(p.accuracy) }">{{ p.accuracy?.toFixed(0) }}%</span>
                <span class="pr-time">{{ p.startTime?.slice(0, 10) }}</span>
              </div>
            </div>
            <el-empty v-else description="暂无练习记录" :image-size="60" />
          </el-card>

          <!-- 可参加考试 -->
          <el-card shadow="never">
            <template #header>
              <div class="card-head">
                <span class="card-title-text">📋 可参加的考试</span>
                <el-link type="primary" :underline="false" @click="router.push('/student/exams')">全部 →</el-link>
              </div>
            </template>
            <div v-if="availableExams.length" class="exam-mini-list">
              <div v-for="e in availableExams.slice(0, 3)" :key="e.id" class="exam-mini-row" @click="router.push(`/student/exam-room/${e.id}`)">
                <el-tag :type="examStatus(e).type" size="small">{{ examStatus(e).text }}</el-tag>
                <span class="em-name">{{ e.sessionName }}</span>
                <span class="em-meta">{{ e.duration }}分钟 · {{ e.startTime?.slice(5, 16) }}</span>
              </div>
            </div>
            <el-empty v-else description="暂无可参加的考试" :image-size="60" />
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- ===================== 新版首页（2026-10-16） ===================== -->

    <!-- Hero -->
    <div class="sh-hero">
      <div class="sh-hero-left">
        <el-avatar :size="58" :src="myAvatar" class="sh-avatar">{{ avatarInitial }}</el-avatar>
        <div class="sh-hero-text">
          <h2 class="sh-hello">{{ greeting }}，{{ displayName }} 👋</h2>
          <p class="sh-hero-sub">
            <el-icon><Cpu /></el-icon>
            <span v-if="stats?.lastLoginTime">上次登录 {{ stats.lastLoginTime.slice(0, 16) }}</span>
            <span v-else>欢迎回到英语语法专项训练系统</span>
          </p>
        </div>
      </div>

      <div class="sh-hero-metrics">
        <div class="sh-hm" @click="router.push('/student/results')">
          <div class="sh-hm-num">{{ summary.totalCount }}</div>
          <div class="sh-hm-lbl">考试次数</div>
        </div>
        <div class="sh-hm">
          <div class="sh-hm-num" :style="{ color: accuracyColor(summary.averageScore) }">{{ summary.averageScore?.toFixed(1) || '-' }}</div>
          <div class="sh-hm-lbl">平均分</div>
        </div>
        <div class="sh-hm" @click="router.push('/student/exams')">
          <div class="sh-hm-num" style="color:#ffd666">{{ availableExams.length }}</div>
          <div class="sh-hm-lbl">待参加考试</div>
        </div>
        <div class="sh-hero-actions">
          <el-button class="sh-hero-btn sh-hero-primary" @click="router.push('/student/practice')">继续练习</el-button>
          <el-button class="sh-hero-btn sh-hero-ghost" @click="router.push('/student/stats')">学习分析</el-button>
        </div>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="sh-tabs">
      <!-- ============ Tab 1 概览 ============ -->
      <el-tab-pane label="概览" name="overview">
        <div class="sh-kpi-grid">
          <div class="sh-kpi sh-kpi-blue" @click="router.push('/student/results')">
            <div class="sh-kpi-icon"><el-icon :size="20"><TrendCharts /></el-icon></div>
            <div class="sh-kpi-body">
              <div class="sh-kpi-num" :style="{ color: accuracyColor(stats?.examAccuracy) }">{{ stats?.examAccuracy?.toFixed(1) ?? '-' }}%</div>
              <div class="sh-kpi-lbl">考试正确率</div>
              <div class="sh-kpi-sub">{{ stats?.examCount ?? 0 }} 场 · 对 {{ stats?.examCorrectCount ?? 0 }} / 错 {{ stats?.examWrongCount ?? 0 }}</div>
            </div>
          </div>

          <div class="sh-kpi sh-kpi-green" @click="router.push('/student/practice')">
            <div class="sh-kpi-icon"><el-icon :size="20"><Odometer /></el-icon></div>
            <div class="sh-kpi-body">
              <div class="sh-kpi-num" :style="{ color: accuracyColor(stats?.practiceAccuracy) }">{{ stats?.practiceAccuracy?.toFixed(1) ?? '-' }}%</div>
              <div class="sh-kpi-lbl">练习正确率</div>
              <div class="sh-kpi-sub">{{ stats?.practiceCount ?? 0 }} 次 · {{ stats?.practiceQuestionCount ?? 0 }} 题</div>
            </div>
          </div>

          <div class="sh-kpi sh-kpi-orange">
            <div class="sh-kpi-icon"><el-icon :size="20"><DataLine /></el-icon></div>
            <div class="sh-kpi-body">
              <div class="sh-kpi-num">{{ totalQuestionsDone }}</div>
              <div class="sh-kpi-lbl">累计做题</div>
              <div class="sh-kpi-sub">答对 {{ totalCorrectCount }} 题 · 正确率 {{ totalAccuracy }}%</div>
            </div>
          </div>

          <div class="sh-kpi sh-kpi-red" @click="router.push('/student/wrong-book')">
            <div class="sh-kpi-icon"><el-icon :size="20"><CircleClose /></el-icon></div>
            <div class="sh-kpi-body">
              <div class="sh-kpi-num" style="color:#f56c6c">{{ stats?.distinctWrongCount ?? '-' }}</div>
              <div class="sh-kpi-lbl">去重错题</div>
              <div class="sh-kpi-sub" v-if="stats?.tagStats?.length">最弱考点：{{ stats.tagStats[0]?.tagName }}</div>
              <div class="sh-kpi-sub" v-else>暂无错题记录</div>
            </div>
          </div>
        </div>

        <!-- [2026-10-17 职责划分] 概览只保留「走势」这一层感知；
             得分分布（分数段结构）属诊断型内容，归 /student/stats 独占，首页不再重复摆环形图。 -->
        <el-card shadow="never" class="sh-card">
          <template #header>
            <div class="sh-card-head">
              <span class="sh-card-title">近期成绩走势</span>
              <span class="sh-card-tip" v-if="scoreCurve.length">最近 {{ trendData.length }} 场 · 含班级平均对比</span>
              <span class="sh-card-tip" v-else>最近 {{ trendData.length }} 场 · 含均分线</span>
            </div>
          </template>
          <VChart v-if="trendChartOption.series" :option="trendChartOption" autoresize style="height:240px" />
          <el-empty v-else description="暂无成绩数据" :image-size="70" />
        </el-card>

        <el-card shadow="never" class="sh-card">
          <template #header><span class="sh-card-title">快捷入口</span></template>
          <div class="sh-shortcut-grid">
            <div v-for="s in shortcuts" :key="s.path" class="sh-shortcut" @click="router.push(s.path)">
              <div class="sh-sc-icon" :style="{ background: s.color + '18', color: s.color }">
                <el-icon :size="20"><component :is="s.icon" /></el-icon>
              </div>
              <div class="sh-sc-text">
                <div class="sh-sc-title">{{ s.title }}</div>
                <div class="sh-sc-desc">{{ s.desc }}</div>
              </div>
            </div>
          </div>
        </el-card>
      </el-tab-pane>

      <!-- ============ Tab 2 学习进度 ============ -->
      <!-- [2026-10-17 职责划分] 本 Tab 只放「进度型」信息（我还差多少）；
           正确率分析、薄弱考点、难度分布等「诊断型」内容一律归 /student/stats，
           两页不重复展示同一张图。 -->
      <el-tab-pane label="学习进度" name="study" lazy>
        <div class="sh-metric-grid">
          <div v-for="m in studyMetrics" :key="m.label" class="sh-metric">
            <div class="sh-metric-num" :style="{ color: m.color }">{{ m.value }}<span class="sh-metric-suffix">{{ m.suffix }}</span></div>
            <div class="sh-metric-lbl">{{ m.label }}</div>
          </div>
        </div>

        <el-card shadow="never" class="sh-card" v-if="learningProgress.length">
          <template #header>
            <div class="sh-card-head">
              <span class="sh-card-title">各分类学习进度</span>
              <div class="sh-card-actions">
                <el-link type="primary" :underline="false" @click="router.push('/student/question-bank')">去练习 →</el-link>
              </div>
            </div>
          </template>
          <div class="sh-progress-grid">
            <div v-for="p in learningProgress" :key="p.categoryId" class="sh-progress-item">
              <div class="sh-pi-header">
                <span class="sh-pi-name">{{ p.categoryName || '未分类' }}</span>
                <span class="sh-pi-level" :style="{ color: accuracyColor(p.masteryLevel) }">{{ p.masteryLevel }}%</span>
              </div>
              <el-progress :percentage="p.masteryLevel" :color="accuracyColor(p.masteryLevel)" :stroke-width="8" :show-text="false" />
              <div class="sh-pi-meta">
                <span>完成 {{ p.completedCount }}/{{ p.totalCount }}</span>
                <span>正确率 {{ p.accuracy }}%</span>
              </div>
            </div>
          </div>
        </el-card>

        <!-- [2026-10-17 职责划分] 原「薄弱语法大类」「按难度正确率」「薄弱考点 Top 5」
             三张分析图已移出首页 —— 它们与 /student/stats 完全重复。
             首页只回答「我还差多少」（进度），诊断交给学习分析页。 -->
        <el-card shadow="never" class="sh-card sh-handoff">
          <div class="sh-handoff-body">
            <div class="sh-handoff-text">
              <div class="sh-handoff-title">想看正确率、薄弱考点和难度分布？</div>
              <div class="sh-handoff-desc">这些属于诊断分析，统一在学习分析页按维度查看，避免和首页重复。</div>
            </div>
            <el-button type="primary" plain size="small" @click="router.push('/student/stats')">
              去学习分析 →
            </el-button>
          </div>
        </el-card>
      </el-tab-pane>

      <!-- ============ Tab 3 考试与练习 ============ -->
      <el-tab-pane label="考试与练习" name="exam" lazy>
        <el-card shadow="never" class="sh-card">
          <template #header>
            <div class="sh-card-head">
              <span class="sh-card-title">可参加的考试</span>
              <el-link type="primary" :underline="false" @click="router.push('/student/exams')">全部 →</el-link>
            </div>
          </template>
          <div v-if="sortedExams.length" class="sh-exam-grid">
            <div v-for="e in sortedExams" :key="e.id" class="sh-exam-card" @click="router.push(`/student/exam-room/${e.id}`)">
              <div class="sh-exam-top">
                <el-tag :type="examStatus(e).type" size="small" effect="dark">{{ examStatus(e).text }}</el-tag>
                <span class="sh-exam-duration">{{ e.duration }} 分钟</span>
              </div>
              <div class="sh-exam-name">{{ e.sessionName }}</div>
              <div class="sh-exam-meta">
                <el-icon><Calendar /></el-icon>
                <span>{{ e.startTime?.slice(0, 16) }} ~ {{ e.endTime?.slice(5, 16) }}</span>
              </div>
              <el-button class="sh-exam-btn" size="small" type="primary" plain>进入考试</el-button>
            </div>
          </div>
          <el-empty v-else description="暂无可参加的考试" :image-size="80" />
        </el-card>

        <div class="sh-grid-2">
          <el-card shadow="never" class="sh-card">
            <template #header>
              <div class="sh-card-head">
                <span class="sh-card-title">最近考试记录</span>
                <el-link type="primary" :underline="false" @click="router.push('/student/results')">全部 →</el-link>
              </div>
            </template>
            <div v-if="recentResults.length" class="sh-list">
              <div v-for="row in recentResults" :key="row.id" class="sh-result-row" @click="router.push(`/student/results/${row.id}`)">
                <div class="sh-score-badge" :style="{ background: accuracyColor(row.scorePercentage) + '1a', color: accuracyColor(row.scorePercentage) }">
                  {{ row.totalScore ?? '-' }}
                </div>
                <div class="sh-result-main">
                  <div class="sh-result-name">{{ row.sessionName || '-' }}</div>
                  <div class="sh-result-meta">{{ row.submitTime?.slice(0, 16) || '-' }} · 正确率 {{ row.scorePercentage?.toFixed(0) ?? '-' }}%</div>
                </div>
                <el-icon class="sh-row-arrow"><TrendCharts /></el-icon>
              </div>
            </div>
            <el-empty v-else description="暂无考试记录" :image-size="70" />
          </el-card>

          <el-card shadow="never" class="sh-card">
            <template #header>
              <div class="sh-card-head">
                <span class="sh-card-title">最近练习</span>
                <el-link type="primary" :underline="false" @click="router.push('/student/practice')">去练习 →</el-link>
              </div>
            </template>
            <div v-if="recentPractices.length" class="sh-list">
              <div v-for="p in recentPractices" :key="p.id" class="sh-practice-row">
                <div class="sh-session-dot" :style="{ background: accuracyColor(p.accuracy) }"></div>
                <div class="sh-result-main">
                  <div class="sh-result-name">{{ p.categoryName || '综合练习' }}</div>
                  <div class="sh-result-meta">{{ p.startTime?.slice(0, 16) || '-' }}</div>
                </div>
                <span class="sh-practice-score">
                  {{ p.correctCount }}/{{ p.questionCount }}
                  <span v-if="p.accuracy != null" :style="{ color: accuracyColor(p.accuracy) }">（{{ p.accuracy?.toFixed(0) }}%）</span>
                </span>
              </div>
            </div>
            <el-empty v-else description="暂无练习记录" :image-size="70" />
          </el-card>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped lang="scss">
.student-home { padding: 4px; }

/* ============================================================
   以下为旧版首页样式（2026-10-16 改版后仍保留，供 legacy-home 备查）
   ============================================================ */
.hero {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff; padding: 24px 28px; border-radius: 8px; margin-bottom: 16px;
  display: flex; justify-content: space-between; align-items: center;
  h2 { margin: 0; font-size: 22px; font-weight: 600; }
  .hero-sub { margin: 6px 0 0; opacity: 0.85; font-size: 13px; }
}

.hero-content { flex: 1; }

.hero-checkin {
  display: flex; align-items: center; gap: 12px;
}

.checkin-btn {
  background: #fff; color: #667eea; border-color: #fff;
  &:hover { background: #f0f0f0; color: #667eea; border-color: #f0f0f0; }
}

.checkin-success {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 16px; background: rgba(255,255,255,0.2); border-radius: 20px;
  font-size: 14px;
  .streak-badge {
    background: rgba(255,165,0,0.9); padding: 2px 8px; border-radius: 10px;
    font-size: 12px; font-weight: 600;
  }
}

.stat-row { margin-bottom: 16px; }
.mini-stat {
  background: #fff; border-radius: 8px; padding: 16px; text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06); cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;
  &:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
}
.mini-num { font-size: 24px; font-weight: 600; color: #303133; }
.mini-label { font-size: 12px; color: #909399; margin-top: 4px; }

.card-head { display: flex; align-items: center; justify-content: space-between; }
.card-title-text { font-size: 14px; font-weight: 600; color: #303133; }
.card-actions { display: flex; align-items: center; gap: 10px; }
.mini-chart-card {
  border-radius: 8px;
  :deep(.el-card__body) { padding: 0 12px 12px; }
  :deep(.el-card__header) { padding: 10px 16px; }
}

// Shortcuts
.shortcut-grid { display: flex; flex-direction: column; gap: 6px; }
.shortcut-item {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 6px;
  cursor: pointer; transition: background 0.15s;
  &:hover { background: #f5f7fa; }
}
.sc-icon {
  width: 32px; height: 32px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.sc-title { font-size: 13px; font-weight: 600; color: #303133; }
.sc-desc { font-size: 11px; color: #909399; }

// Practice list
.practice-list { display: flex; flex-direction: column; gap: 6px; }
.practice-row {
  display: flex; align-items: center; gap: 12px; padding: 6px 8px;
  border-radius: 4px; font-size: 13px;
  &:hover { background: #f5f7fa; }
  .pr-name { flex: 1; color: #303133; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pr-stat { color: #606266; }
  .pr-acc { font-weight: 600; min-width: 36px; text-align: right; }
  .pr-time { color: #909399; font-size: 12px; min-width: 72px; text-align: right; }
}

// Mini exam list
.exam-mini-list { display: flex; flex-direction: column; gap: 6px; }
.exam-mini-row {
  display: flex; align-items: center; gap: 10px; padding: 6px 8px;
  border-radius: 4px; cursor: pointer; font-size: 13px;
  &:hover { background: #f5f7fa; }
  .em-name { flex: 1; color: #303133; font-weight: 500; }
  .em-meta { color: #909399; font-size: 12px; }
}

// Learning Progress
.progress-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px;
}
.progress-item {
  padding: 12px 14px; background: #fafafa; border-radius: 6px;
  .pi-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .pi-name { font-size: 14px; font-weight: 500; color: #303133; }
  .pi-level { font-size: 14px; font-weight: 600; }
  .pi-bar { margin-bottom: 6px; }
  .pi-meta { display: flex; justify-content: space-between; font-size: 12px; color: #909399; }
}

/* ============================================================
   新版首页样式（2026-10-16）
   ============================================================ */
.sh-hero {
  display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap;
  padding: 22px 26px; border-radius: 12px; margin-bottom: 16px;
  background: linear-gradient(120deg, #4b6cb7 0%, #5f72bd 45%, #8e54e9 100%);
  box-shadow: 0 6px 20px rgba(75, 108, 183, 0.28);
  color: #fff;
}
.sh-hero-left { display: flex; align-items: center; gap: 16px; min-width: 240px; }
.sh-avatar {
  background: rgba(255, 255, 255, 0.9); color: #4b6cb7;
  font-size: 22px; font-weight: 700; border: 2px solid rgba(255, 255, 255, 0.6); flex-shrink: 0;
}
.sh-hello { margin: 0; font-size: 22px; font-weight: 600; }
.sh-hero-sub {
  display: flex; align-items: center; gap: 6px; margin: 8px 0 0;
  font-size: 12px; opacity: 0.85;
}
.sh-hero-metrics { display: flex; align-items: center; gap: 26px; flex-wrap: wrap; }
.sh-hm {
  text-align: center; cursor: pointer; min-width: 76px;
  transition: transform 0.15s;
  &:hover { transform: translateY(-2px); }
}
.sh-hm-num { font-size: 24px; font-weight: 700; line-height: 1.2; }
.sh-hm-lbl { font-size: 12px; opacity: 0.85; margin-top: 2px; }
.sh-hero-actions { display: flex; gap: 10px; }
.sh-hero-btn { border-radius: 20px; font-weight: 600; border: none; }
.sh-hero-primary {
  background: #fff; color: #4b6cb7;
  &:hover { background: #f2f5ff; color: #4b6cb7; }
}
.sh-hero-ghost {
  background: rgba(255, 255, 255, 0.18); color: #fff;
  &:hover { background: rgba(255, 255, 255, 0.3); color: #fff; }
}

.sh-tabs {
  :deep(.el-tabs__header) { margin-bottom: 14px; }
  :deep(.el-tabs__nav-wrap::after) { height: 1px; background: #ebeef5; }
  :deep(.el-tabs__item) { font-size: 14px; font-weight: 500; }
}

.sh-card {
  border-radius: 10px; margin-bottom: 16px;
  :deep(.el-card__header) { padding: 12px 18px; }
  :deep(.el-card__body) { padding: 16px 18px; }
}
.sh-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.sh-card-title { font-size: 14px; font-weight: 600; color: #303133; }
.sh-card-tip { font-size: 12px; color: #909399; }
.sh-card-actions { display: flex; align-items: center; gap: 10px; }

/* 诊断分析交接条（把分析型内容指向 /student/stats） */
.sh-handoff {
  background: linear-gradient(90deg, #f4f8ff 0%, #ffffff 60%);
  border: 1px dashed #c6d9f7;
  :deep(.el-card__body) { padding: 14px 18px; }
}
.sh-handoff-body { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.sh-handoff-title { font-size: 13px; font-weight: 600; color: #303133; }
.sh-handoff-desc { font-size: 12px; color: #909399; margin-top: 3px; }

/* KPI 卡片 */
.sh-kpi-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 14px; margin-bottom: 16px;
}
.sh-kpi {
  display: flex; align-items: center; gap: 14px;
  background: #fff; border-radius: 10px; padding: 16px 18px; cursor: pointer;
  border-left: 4px solid #dcdfe6;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  transition: transform 0.15s, box-shadow 0.15s;
  &:hover { transform: translateY(-3px); box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1); }
}
.sh-kpi-icon {
  width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.sh-kpi-body { min-width: 0; }
.sh-kpi-num { font-size: 24px; font-weight: 700; line-height: 1.2; color: #303133; }
.sh-kpi-lbl { font-size: 13px; color: #606266; margin: 2px 0 3px; }
.sh-kpi-sub { font-size: 11px; color: #909399; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sh-kpi-blue { border-left-color: #409eff; .sh-kpi-icon { background: #ecf5ff; color: #409eff; } }
.sh-kpi-green { border-left-color: #67c23a; .sh-kpi-icon { background: #f0f9eb; color: #67c23a; } }
.sh-kpi-orange { border-left-color: #e6a23c; .sh-kpi-icon { background: #fdf6ec; color: #e6a23c; } }
.sh-kpi-red { border-left-color: #f56c6c; .sh-kpi-icon { background: #fef0f0; color: #f56c6c; } }

.sh-grid-2 {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px;
}

/* 快捷入口 */
.sh-shortcut-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px;
}
.sh-shortcut {
  display: flex; align-items: center; gap: 12px; padding: 12px 14px;
  border-radius: 8px; background: #fafbfc; cursor: pointer;
  border: 1px solid #f0f2f5;
  transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
  &:hover { background: #f5f7fa; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.07); }
}
.sh-sc-icon {
  width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.sh-sc-title { font-size: 13px; font-weight: 600; color: #303133; }
.sh-sc-desc { font-size: 11px; color: #909399; margin-top: 2px; }

/* 学习数据指标条 */
.sh-metric-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px; margin-bottom: 16px;
}
.sh-metric {
  background: #fff; border-radius: 10px; padding: 14px 16px; text-align: center;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}
.sh-metric-num { font-size: 22px; font-weight: 700; color: #303133; }
.sh-metric-suffix { font-size: 12px; font-weight: 500; color: #909399; margin-left: 3px; }
.sh-metric-lbl { font-size: 12px; color: #909399; margin-top: 4px; }

/* 学习进度 */
.sh-progress-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px;
}
.sh-progress-item {
  padding: 12px 14px; background: #fafbfc; border-radius: 8px; border: 1px solid #f0f2f5;
}
.sh-pi-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
.sh-pi-name { font-size: 13px; font-weight: 600; color: #303133; }
.sh-pi-level { font-size: 13px; font-weight: 700; }
.sh-pi-meta { display: flex; justify-content: space-between; font-size: 11px; color: #909399; margin-top: 6px; }

/* 考试卡片 */
.sh-exam-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px;
}
.sh-exam-card {
  padding: 14px 16px; border-radius: 10px; background: #fafbfc;
  border: 1px solid #f0f2f5; cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
  &:hover { transform: translateY(-3px); box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08); border-color: #d9ecff; }
}
.sh-exam-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.sh-exam-duration { font-size: 12px; color: #909399; }
.sh-exam-name { font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 8px; }
.sh-exam-meta {
  display: flex; align-items: center; gap: 5px; font-size: 11px; color: #909399; margin-bottom: 12px;
}
.sh-exam-btn { width: 100%; }

/* 列表型记录 */
.sh-list { display: flex; flex-direction: column; gap: 8px; }
.sh-result-row, .sh-practice-row {
  display: flex; align-items: center; gap: 12px; padding: 10px 12px;
  border-radius: 8px; cursor: pointer; background: #fafbfc; border: 1px solid #f0f2f5;
  transition: background 0.15s, transform 0.15s;
  &:hover { background: #f5f7fa; transform: translateX(2px); }
}
.sh-score-badge {
  width: 46px; height: 46px; border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 17px; font-weight: 700;
}
.sh-session-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin: 0 8px; }
.sh-result-main { flex: 1; min-width: 0; }
.sh-result-name {
  font-size: 13px; font-weight: 600; color: #303133;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.sh-result-meta { font-size: 11px; color: #909399; margin-top: 3px; }
.sh-row-arrow { color: #c0c4cc; }
.sh-practice-score { font-size: 12px; color: #606266; font-weight: 600; white-space: nowrap; }
</style>
