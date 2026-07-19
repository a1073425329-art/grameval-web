<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from 'echarts/components'
import { getDashboard, listCategoryTree, getQuestionAnalytics } from '@/api/admin'
import type { AdminDashboardData } from '@/types/admin'
import type { Category } from '@/types/category'

use([
  CanvasRenderer,
  LineChart, BarChart, PieChart,
  TitleComponent, TooltipComponent, LegendComponent, GridComponent,
])

const loading = ref(false)
const stats = ref<AdminDashboardData>({
  studentCount: 0, adminCount: 0, questionCount: 0,
  paperCount: 0, sessionCount: 0, examRecordCount: 0, practiceCount: 0,
  recentTrend: [],
})

/** 语法分类树（已有接口，用于柱状图） */
const categories = ref<Category[]>([])

/** 题目分析数据（已有接口，用于难度饼图） */
const analytics = ref<{ byDifficulty?: Array<{ difficulty: number; total: number }> } | null>(null)

/* ============================================================ *
 *  Stats Cards
 * ============================================================ */
const statsCards = computed(() => {
  const cards: Array<{ title: string; value: number | string; icon: string; color: string }> = [
    { title: '学生总数', value: stats.value.studentCount, icon: 'UserFilled', color: '#409eff' },
    { title: '题库总数', value: stats.value.questionCount, icon: 'Notebook', color: '#67c23a' },
    { title: '试卷数', value: stats.value.paperCount, icon: 'Files', color: '#e6a23c' },
    { title: '考试场次', value: stats.value.sessionCount, icon: 'Calendar', color: '#909399' },
  ]
  if (stats.value.todayActiveStudents != null) {
    cards.push({ title: '今日活跃', value: stats.value.todayActiveStudents, icon: 'Sunny', color: '#e040fb' })
  }
  cards.push(
    { title: '考试记录', value: stats.value.examRecordCount, icon: 'EditPen', color: '#f56c6c' },
    { title: '练习次数', value: stats.value.practiceCount, icon: 'DataAnalysis', color: '#9c27b0' },
  )
  if (stats.value.overallAccuracy != null) {
    cards.push({ title: '总正确率', value: stats.value.overallAccuracy.toFixed(1) + '%', icon: 'Odometer', color: '#00bcd4' })
  }
  return cards
})

/* ============================================================ *
 *  Chart 1: 近 7 日考试提交趋势
 * ============================================================ */
const trendOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { data: ['提交人次'], bottom: 0 },
  xAxis: { type: 'category', boundaryGap: false, data: stats.value.recentTrend.map(d => d.date) },
  yAxis: { type: 'value', name: '人次', minInterval: 1 },
  series: [{
    name: '提交人次', type: 'line', smooth: true,
    data: stats.value.recentTrend.map(d => d.count),
    areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
      colorStops: [{ offset: 0, color: 'rgba(64,158,255,0.35)' }, { offset: 1, color: 'rgba(64,158,255,0.02)' }] } },
    lineStyle: { color: '#409eff', width: 3 }, itemStyle: { color: '#409eff' },
  }],
  grid: { left: 50, right: 20, bottom: 40, top: 20 },
}))

/* ============================================================ *
 *  Chart 2: 近 7 日平均分趋势
 * ============================================================ */
const avgScoreOption = computed(() => {
  const data = stats.value.avgScoreTrend
  if (!data || !data.length) return {}
  return {
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => v?.toFixed(1) + ' 分' },
    legend: { data: ['平均分'], bottom: 0 },
    xAxis: { type: 'category', boundaryGap: false, data: data.map(d => d.date) },
    yAxis: { type: 'value', name: '分', min: 0, max: 100 },
    series: [{
      name: '平均分', type: 'line', smooth: true,
      data: data.map(d => d.avgScore),
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [{ offset: 0, color: 'rgba(103,194,58,0.3)' }, { offset: 1, color: 'rgba(103,194,58,0.02)' }] } },
      lineStyle: { color: '#67c23a', width: 3 }, itemStyle: { color: '#67c23a' },
    }],
    grid: { left: 50, right: 20, bottom: 40, top: 20 },
  }
})

/* ============================================================ *
 *  Chart 3: 语法分类题目分布（柱状图）
 *  数据来源：GET /api/categories/tree（已有接口）
 * ============================================================ */
const categoryBarOption = computed(() => {
  const cats = stats.value.categoryDistribution
  const fallback = categories.value
    .filter(c => c.questionCount != null && c.questionCount > 0)
    .sort((a, b) => (b.questionCount || 0) - (a.questionCount || 0))
    .slice(0, 10)

  const source: Array<{ categoryName?: string; questionCount?: number }> = (cats && cats.length > 0) ? cats.slice(0, 10) : fallback
  const names = source.map(c => c.categoryName ?? '')
  const values = source.map(c => c.questionCount ?? 0)

  if (!names.length) return {}

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['题目数量'], bottom: 0 },
    xAxis: { type: 'category', data: names, axisLabel: { rotate: 30, fontSize: 11 } },
    yAxis: { type: 'value', name: '题', minInterval: 1 },
    series: [{
      name: '题目数量', type: 'bar',
      data: values,
      itemStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: '#409eff' }, { offset: 1, color: '#79bbff' }] },
        borderRadius: [4, 4, 0, 0],
      },
      barMaxWidth: 40,
    }],
    grid: { left: 50, right: 20, bottom: 60, top: 20 },
  }
})

/* ============================================================ *
 *  Chart 4: 难度分布（饼图）
 *  数据来源：GET /api/admin/questions/analytics（已有接口）
 *            fallback: dashboard.difficultyDistribution
 * ============================================================ */
const difficultyPieOption = computed(() => {
  const dist = stats.value.difficultyDistribution
  const byDifficulty = analytics.value?.byDifficulty

  let data: Array<{ name: string; value: number }> = []
  if (dist && (dist.easyCount || dist.mediumCount || dist.hardCount)) {
    data = [
      { name: '简单', value: dist.easyCount },
      { name: '中等', value: dist.mediumCount },
      { name: '困难', value: dist.hardCount },
    ]
  } else if (byDifficulty && byDifficulty.length) {
    const labels: Record<number, string> = { 1: '简单', 2: '中等', 3: '困难' }
    data = byDifficulty.map(d => ({ name: labels[d.difficulty] || String(d.difficulty), value: d.total }))
  }

  if (!data.length) return {}

  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 题 ({d}%)' },
    legend: { orient: 'vertical', right: 10, top: 'center' },
    series: [{
      name: '难度分布', type: 'pie', radius: ['45%', '75%'], center: ['40%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } },
      data,
      color: ['#67c23a', '#e6a23c', '#f56c6c'],
    }],
  }
})

/* ============================================================ *
 *  Chart 5: 高频错题语法分类（横向柱状图 Top 5）
 * ============================================================ */
const wrongCategoryOption = computed(() => {
  const list = stats.value.topWrongCategories
  if (!list || !list.length) return {}
  const top5 = list.slice(0, 5).reverse() // 反转让最高的在上面

  return {
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (params: Array<{ name: string; value: number; data: { errorRate: number } }>) => {
        const p = params[0]
        return `${p.name}<br/>错题数: ${p.value}<br/>错误率: ${p.data.errorRate?.toFixed(1)}%`
      },
    },
    legend: { data: ['错题数'], bottom: 0 },
    grid: { left: 100, right: 40, bottom: 30, top: 10 },
    xAxis: { type: 'value', name: '题', minInterval: 1 },
    yAxis: { type: 'category', data: top5.map(d => d.categoryName), axisLabel: { fontSize: 12 } },
    series: [{
      name: '错题数', type: 'bar',
      data: top5.map(d => ({ value: d.wrongCount, errorRate: d.errorRate })),
      itemStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
          colorStops: [{ offset: 0, color: '#f56c6c' }, { offset: 1, color: '#fab6b6' }] },
        borderRadius: [0, 4, 4, 0],
      },
      barMaxWidth: 24,
    }],
  }
})

/* ============================================================ *
 *  Load
 * ============================================================ */
const load = async () => {
  loading.value = true
  try {
    // 并行拉取：dashboard + 分类树 + 题目分析（均可独立失败）
    const [d, c, a] = await Promise.allSettled([
      getDashboard(),
      listCategoryTree(),
      getQuestionAnalytics(),
    ])
    if (d.status === 'fulfilled') stats.value = d.value.data
    if (c.status === 'fulfilled') categories.value = c.value.data ?? []
    if (a.status === 'fulfilled') analytics.value = a.value.data
  } finally { loading.value = false }
}

/* ============================================================ *
 *  Resize
 * ============================================================ */
const chartHeight = ref(320)
const handleResize = () => { chartHeight.value = window.innerWidth < 1200 ? 260 : 320 }
onMounted(() => { window.addEventListener('resize', handleResize); handleResize(); load() })
onUnmounted(() => { window.removeEventListener('resize', handleResize) })

/* ============================================================ *
 *  Helpers
 * ============================================================ */
const statusText = (s?: number) => (s === 0 ? '草稿' : s === 1 ? '进行中' : s === 2 ? '已结束' : '-')
const statusType = (s?: number): 'info' | 'success' | 'warning' => (s === 1 ? 'success' : s === 2 ? 'info' : 'warning')
</script>

<template>
  <div class="dashboard" v-loading="loading">
    <!-- ==================== Stats Cards ==================== -->
    <el-row :gutter="16" class="stats-row">
      <el-col v-for="card in statsCards" :key="card.title" :xs="12" :sm="8" :md="6" :lg="Math.max(3, Math.floor(24 / statsCards.length))">
        <el-card shadow="hover" class="stats-card">
          <div class="stats-card-inner">
            <div class="stats-info">
              <div class="stats-label">{{ card.title }}</div>
              <div class="stats-value" :style="{ color: card.color }">{{ card.value }}</div>
            </div>
            <div class="stats-icon" :style="{ background: card.color + '15', color: card.color }">
              <el-icon :size="24"><component :is="card.icon" /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- ==================== Row 1: 提交趋势 + 平均分趋势 ==================== -->
    <el-row :gutter="16">
      <el-col :span="12">
        <el-card shadow="hover" class="chart-card">
          <template #header><div class="card-title">近 7 日考试提交趋势</div></template>
          <v-chart v-if="trendOption.series" :option="trendOption" :style="{ height: chartHeight + 'px' }" autoresize />
          <el-empty v-else description="暂无数据" :image-size="80" />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="hover" class="chart-card">
          <template #header><div class="card-title">近 7 日平均分趋势</div></template>
          <v-chart v-if="avgScoreOption.series" :option="avgScoreOption" :style="{ height: chartHeight + 'px' }" autoresize />
          <el-empty v-else description="暂无数据（需后端补 avgScoreTrend）" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>

    <!-- ==================== Row 2: 语法分类柱状图 + 难度饼图 ==================== -->
    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="14">
        <el-card shadow="hover" class="chart-card">
          <template #header><div class="card-title">语法分类题目分布</div></template>
          <v-chart v-if="categoryBarOption.series" :option="categoryBarOption" :style="{ height: chartHeight + 'px' }" autoresize />
          <el-empty v-else description="暂无分类数据" :image-size="80" />
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card shadow="hover" class="chart-card">
          <template #header><div class="card-title">题目难度分布</div></template>
          <v-chart v-if="difficultyPieOption.series" :option="difficultyPieOption" :style="{ height: chartHeight + 'px' }" autoresize />
          <el-empty v-else description="暂无数据（需后端补 difficultyDistribution）" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>

    <!-- ==================== Row 3: 高频错题 + 最近考试 ==================== -->
    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="12">
        <el-card shadow="hover" class="chart-card">
          <template #header><div class="card-title">高频错题语法 Top 5</div></template>
          <v-chart v-if="wrongCategoryOption.series" :option="wrongCategoryOption" :style="{ height: chartHeight + 'px' }" autoresize />
          <el-empty v-else description="暂无数据（需后端补 topWrongCategories）" :image-size="80" />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="hover" class="chart-card">
          <template #header><div class="card-title">最近考试概况</div></template>
          <el-table v-if="stats.recentSessions?.length" :data="stats.recentSessions" size="small">
            <el-table-column prop="sessionName" label="考试名称" min-width="120" show-overflow-tooltip />
            <el-table-column label="状态" width="80">
              <template #default="{ row }"><el-tag :type="statusType(row.status)" size="small">{{ statusText(row.status) }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="attendedCount" label="参加" width="60" align="center" />
            <el-table-column label="平均分" width="80" align="center">
              <template #default="{ row }">{{ row.avgScore?.toFixed(1) }}</template>
            </el-table-column>
            <el-table-column label="及格率" width="80" align="center">
              <template #default="{ row }">{{ row.passRate?.toFixed(1) }}%</template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无数据（需后端补 recentSessions）" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>

    <!-- ==================== Row 4: 优等生 Top 5 ==================== -->
    <el-row :gutter="16" style="margin-top:16px" v-if="stats.topStudents?.length">
      <el-col :span="24">
        <el-card shadow="hover">
          <template #header><div class="card-title">🏆 优等生 Top 5</div></template>
          <el-table :data="stats.topStudents" size="small">
            <el-table-column type="index" label="#" width="50" />
            <el-table-column prop="realName" label="姓名" width="120" />
            <el-table-column prop="examCount" label="考试次数" width="100" align="center" />
            <el-table-column label="平均分" width="100" align="center">
              <template #default="{ row }">
                <span :style="{ color: row.avgScore >= 90 ? '#67c23a' : row.avgScore >= 75 ? '#e6a23c' : '#f56c6c', fontWeight: 600 }">
                  {{ row.avgScore?.toFixed(1) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="正确率" width="100" align="center">
              <template #default="{ row }">{{ row.accuracy?.toFixed(1) }}%</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped lang="scss">
.dashboard {
  .stats-row { margin-bottom: 16px; }
  .stats-card {
    margin-bottom: 16px;
    border-radius: 8px;
    transition: transform 0.2s;
    &:hover { transform: translateY(-2px); }
    :deep(.el-card__body) { padding: 18px 20px; }
  }
  .stats-card-inner { display: flex; align-items: center; justify-content: space-between; }
  .stats-info { flex: 1; min-width: 0; }
  .stats-label { font-size: 12px; color: #909399; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .stats-value { font-size: 24px; font-weight: 700; color: #303133; }
  .stats-icon {
    width: 44px; height: 44px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; margin-left: 12px;
  }
  .chart-card {
    border-radius: 8px; margin-bottom: 0;
    :deep(.el-card__header) { padding: 12px 20px; }
    :deep(.el-card__body) { padding: 8px 16px 16px; }
  }
  .card-title { font-size: 15px; font-weight: 600; color: #303133; }
}
</style>
