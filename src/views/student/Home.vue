<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Calendar, Check, Aim, Trophy, Document } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getMySummary, getAvailableExams, getStudentStatistics, getMyResults, listPractices, getMyLearningProgress, getWeakCategories, checkIn, updateMyProfile, getMyProfile } from '@/api/student'
import type { ResultSummary, ExamResultItem } from '@/types/result'
import type { AvailableExam } from '@/types/exam'
import type { StudentStatistics } from '@/types/stats'
import type { PracticeRecord } from '@/types/question'
import type { LearningProgress } from '@/types/progress'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'

use([CanvasRenderer, LineChart, BarChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent])

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
const todayCompleted = ref(0)
const totalQuestionsDone = ref(0)
const totalCorrectCount = ref(0)
const isCheckedIn = ref(false)
const checkInLoading = ref(false)

const shortcuts = [
  { title: '语法题库', desc: '按专题浏览 + 学习模式看解析', path: '/student/question-bank', icon: 'Notebook', color: '#409eff' },
  { title: '专项练习', desc: '选专题刷题即时反馈', path: '/student/practice', icon: 'EditPen', color: '#67c23a' },
  { title: '在线考试', desc: '参加考试并答题', path: '/student/exams', icon: 'Document', color: '#e6a23c' },
  { title: '错题本', desc: '去重错题按考点分类', path: '/student/wrong-book', icon: 'CircleClose', color: '#f56c6c' },
  { title: '学习数据', desc: '多维度分析 + 考点弱点', path: '/student/stats', icon: 'TrendCharts', color: '#409eff' },
  { title: '个人资料', desc: '查看和编辑个人信息', path: '/student/profile', icon: 'User', color: '#9c27b0' },
]

const load = async () => {
  loading.value = true
  try {
    const uid = authStore.userInfo?.id
    const tasks = [
      getMySummary(),
      getAvailableExams(),
      uid ? getStudentStatistics(uid, 'basic,exam,practice,tag') : Promise.resolve(null),
      getMyResults({ pageNum: 1, pageSize: 5 }),
      listPractices({ pageNum: 1, pageSize: 5 }),
      getMyLearningProgress(),
      getWeakCategories(5),
      getMyProfile(),
    ]
    const [s, e, st, r, p, lp, wp, prof] = await Promise.allSettled(tasks)
    if (s.status === 'fulfilled' && s.value) summary.value = (s.value as any).data
    if (e.status === 'fulfilled' && e.value) availableExams.value = (e.value as any).data ?? []
    if (st.status === 'fulfilled' && st.value) stats.value = (st.value as any).data
    if (r.status === 'fulfilled' && r.value) recentResults.value = (r.value as any).data?.records ?? []
    if (p.status === 'fulfilled' && p.value) recentPractices.value = (p.value as any).data?.records ?? []
    if (lp.status === 'fulfilled' && lp.value) learningProgress.value = (lp.value as any).data ?? []
    if (wp.status === 'fulfilled' && wp.value) weakProgress.value = (wp.value as any).data ?? []
    if (prof.status === 'fulfilled' && prof.value) {
      const profile = (prof.value as any).data
      streakDays.value = profile.streakDays || 0
      totalStudyDays.value = profile.totalStudyDays || 0
      dailyTargetCount.value = profile.dailyTargetCount || 10
      totalQuestionsDone.value = profile.totalQuestionsDone || 0
      totalCorrectCount.value = profile.totalCorrectCount || 0
      // 判断今天是否已打卡
      const lastDate = profile.lastStudyDate
      if (lastDate) {
        const today = new Date().toISOString().split('T')[0]
        isCheckedIn.value = lastDate === today
      }
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

const isOngoing = (e: AvailableExam) => {
  const now = Date.now()
  return now >= Date.parse(e.startTime) && now <= Date.parse(e.endTime)
}

const examStatus = (e: AvailableExam) => {
  const now = Date.now()
  if (now < Date.parse(e.startTime)) return { text: '未开始', type: 'info' as const }
  if (now > Date.parse(e.endTime)) return { text: '已结束', type: 'danger' as const }
  return { text: '进行中', type: 'success' as const }
}

const diffLabel = (d?: number) => (d === 1 ? '简单' : d === 2 ? '中等' : d === 3 ? '困难' : '-')
</script>

<template>
  <div class="student-home" v-loading="loading">
    <!-- Hero -->
    <div class="hero">
      <div class="hero-content">
        <h2>你好，{{ authStore.userInfo?.displayName || authStore.userInfo?.username || '同学' }} 👋</h2>
        <p class="hero-sub">坚持每天练习，语法能力会越来越强！</p>
      </div>
      <div class="hero-checkin">
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
      <el-col :span="4">
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
              <el-link type="primary" :underline="false" @click="router.push('/student/question-bank')">去练习 →</el-link>
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
              <span v-if="p.accuracy != null" class="pr-acc" :style="{ color: accuracyColor(p.accuracy) }">{{ p.accuracy.toFixed(0) }}%</span>
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
</template>

<style scoped lang="scss">
.student-home { padding: 4px; }

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
</style>
