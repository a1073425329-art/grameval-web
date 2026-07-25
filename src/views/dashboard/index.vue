<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart, PieChart, RadarChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  RadarComponent,
} from 'echarts/components'
import { getDashboard } from '@/api/admin'
import type { AdminDashboardData } from '@/types/admin'

use([
  CanvasRenderer,
  LineChart, BarChart, PieChart, RadarChart,
  TitleComponent, TooltipComponent, LegendComponent, GridComponent, RadarComponent,
])

const loading = ref(false)
const stats = ref<AdminDashboardData>({
  studentCount: 0, adminCount: 0, questionCount: 0,
  paperCount: 0, sessionCount: 0, examRecordCount: 0, practiceCount: 0,
  recentTrend: [],
})

/* ============================================================ *
 *  Stats Cards - 统计卡片（12个）
 * ============================================================ */
const statsCards = computed(() => {
  const cards: Array<{ title: string; value: number | string; icon: string; color: string }> = [
    // 基础统计
    { title: '学生总数', value: stats.value.studentCount, icon: 'UserFilled', color: '#409eff' },
    { title: '题库总数', value: stats.value.questionCount, icon: 'Notebook', color: '#67c23a' },
    { title: '试卷数', value: stats.value.paperCount, icon: 'Files', color: '#e6a23c' },
    { title: '考试场次', value: stats.value.sessionCount, icon: 'Calendar', color: '#909399' },
    // 今日指标
    { title: '今日活跃', value: stats.value.todayActiveStudents ?? 0, icon: 'Sunny', color: '#e040fb' },
    { title: '今日提交', value: stats.value.todayExamSubmissions ?? 0, icon: 'Send', color: '#79bbff' },
    { title: '总正确率', value: (stats.value.overallAccuracy ?? 0).toFixed(1) + '%', icon: 'Odometer', color: '#00bcd4' },
    { title: '平均分', value: (stats.value.averageScore ?? 0).toFixed(1), icon: 'Scoreboard', color: '#9c27b0' },
    { title: '及格率', value: (stats.value.passRate ?? 0).toFixed(1) + '%', icon: 'CheckCircle', color: '#8bc34a' },
    { title: '阅读文章', value: stats.value.passageCount ?? 0, icon: 'BookOpen', color: '#ff9800' },
    { title: '错题总数', value: stats.value.totalWrongQuestions ?? 0, icon: 'Warning', color: '#f44336' },
    { title: '练习次数', value: stats.value.practiceCount, icon: 'DataAnalysis', color: '#607d8b' },
  ]
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
 *  Chart 3: 近 7 日活跃度趋势
 * ============================================================ */
const activityOption = computed(() => {
  const data = stats.value.activityTrend
  if (!data || !data.length) return {}
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['活跃学生'], bottom: 0 },
    xAxis: { type: 'category', boundaryGap: false, data: data.map(d => d.date) },
    yAxis: { type: 'value', name: '人数', minInterval: 1 },
    series: [{
      name: '活跃学生', type: 'bar',
      data: data.map(d => d.count),
      itemStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: '#e040fb' }, { offset: 1, color: '#e91e63' }] },
        borderRadius: [4, 4, 0, 0],
      },
      barMaxWidth: 40,
    }],
    grid: { left: 50, right: 20, bottom: 40, top: 20 },
  }
})

/* ============================================================ *
 *  Chart 4: 难度分布（饼图）
 * ============================================================ */
const difficultyPieOption = computed(() => {
  const dist = stats.value.difficultyDistribution
  if (!dist) return {}

  const data = [
    { name: '简单', value: dist.easyCount },
    { name: '中等', value: dist.mediumCount },
    { name: '困难', value: dist.hardCount },
  ].filter(d => d.value > 0)

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
 *  Chart 5: 分数段分布（柱状图）
 * ============================================================ */
const scoreDistributionOption = computed(() => {
  const data = stats.value.scoreDistribution
  if (!data || !data.length) return {}
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (params: Array<{ name: string; value: number; data: { percentage: number } }>) => {
        const p = params[0]
        return `${p.name}分<br/>人数: ${p.value}人 (${p.data.percentage}%)`
      },
    },
    legend: { data: ['人数'], bottom: 0 },
    xAxis: { type: 'category', data: data.map(d => d.range), axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', name: '人', minInterval: 1 },
    series: [{
      name: '人数', type: 'bar',
      data: data.map(d => ({ value: d.count, percentage: d.percentage })),
      itemStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: '#ff6b6b' }, { offset: 1, color: '#ff8e53' }] },
        borderRadius: [4, 4, 0, 0],
      },
      barMaxWidth: 40,
    }],
    grid: { left: 50, right: 20, bottom: 40, top: 20 },
  }
})

/* ============================================================ *
 *  Chart 6: 题型分布（饼图）
 * ============================================================ */
const questionTypeOption = computed(() => {
  const data = stats.value.questionTypeDistribution
  if (!data || !data.length) return {}
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 题 ({d}%)' },
    legend: { orient: 'vertical', right: 10, top: 'center' },
    series: [{
      name: '题型分布', type: 'pie', radius: ['45%', '75%'], center: ['40%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
      data: data.map(d => ({ name: d.questionTypeName, value: d.count })),
      color: ['#409eff', '#67c23a', '#e6a23c', '#909399', '#f56c6c', '#9c27b0'],
    }],
  }
})

/* ============================================================ *
 *  Chart 7: 语法分类题目分布（柱状图）
 * ============================================================ */
const categoryBarOption = computed(() => {
  const data = stats.value.categoryDistribution
  if (!data || !data.length) return {}
  const top10 = data.slice(0, 10)

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (params: Array<{ name: string; value: number; data: { accuracy: number } }>) => {
        const p = params[0]
        return `${p.name}<br/>题目数: ${p.value}<br/>正确率: ${p.data.accuracy}%`
      },
    },
    legend: { data: ['题目数量'], bottom: 0 },
    xAxis: { type: 'category', data: top10.map(d => d.categoryName), axisLabel: { rotate: 30, fontSize: 11 } },
    yAxis: { type: 'value', name: '题', minInterval: 1 },
    series: [{
      name: '题目数量', type: 'bar',
      data: top10.map(d => ({ value: d.questionCount, accuracy: d.accuracy })),
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
 *  Chart 8: 高频错题语法分类（横向柱状图）
 * ============================================================ */
const wrongCategoryOption = computed(() => {
  const list = stats.value.topWrongCategories
  if (!list || !list.length) return {}
  const top5 = list.slice(0, 5).reverse()

  return {
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (params: Array<{ name: string; value: number; data: { errorRate: number } }>) => {
        const p = params[0]
        return `${p.name}<br/>错题数: ${p.value}<br/>错误率: ${p.data.errorRate}%`
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
 *  Chart 9: 错题掌握情况（饼图）
 * ============================================================ */
const wrongMasteryOption = computed(() => {
  const data = stats.value.wrongMasteryStat
  if (!data) return {}

  const items = [
    { name: '未复习', value: data.notReviewed, color: '#f56c6c' },
    { name: '待复习', value: data.pendingReview, color: '#e6a23c' },
    { name: '已复习', value: data.reviewed, color: '#409eff' },
    { name: '已掌握', value: data.mastered, color: '#67c23a' },
  ].filter(d => d.value > 0)

  if (!items.length) return {}

  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 题 ({d}%)' },
    legend: { orient: 'vertical', right: 10, top: 'center' },
    series: [{
      name: '错题掌握', type: 'pie', radius: ['45%', '75%'], center: ['40%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
      data: items.map(d => ({ name: d.name, value: d.value, itemStyle: { color: d.color } })),
    }],
  }
})

/* ============================================================ *
 *  Chart 10: 学习进度概览（雷达图）
 * ============================================================ */
const learningProgressOption = computed(() => {
  const data = stats.value.learningProgressOverview
  if (!data || !data.length) return {}
  const top8 = data.slice(0, 8)

  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    radar: {
      indicator: top8.map(d => ({ name: d.categoryName, max: 100 })),
      shape: 'polygon',
      splitNumber: 5,
      axisName: { fontSize: 11 },
    },
    series: [{
      name: '掌握率', type: 'radar',
      data: [{
        value: top8.map(d => d.masteryRate),
        name: '掌握率',
        areaStyle: { color: 'rgba(64,158,255,0.2)' },
        lineStyle: { color: '#409eff', width: 2 },
        itemStyle: { color: '#409eff' },
      }],
    }],
  }
})

/* ============================================================ *
 *  Load
 * ============================================================ */
const load = async () => {
  loading.value = true
  try {
    const res = await getDashboard()
    stats.value = res.data
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
    <!-- ==================== Stats Cards (12个) ==================== -->
    <el-row :gutter="16" class="stats-row">
      <el-col v-for="card in statsCards" :key="card.title" :xs="12" :sm="8" :md="6" :lg="4">
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

    <!-- ==================== Row 1: 考试趋势 + 平均分趋势 + 活跃度趋势 ==================== -->
    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="8">
        <el-card shadow="hover" class="chart-card">
          <template #header><div class="card-title">近 7 日考试提交趋势</div></template>
          <v-chart v-if="trendOption.series" :option="trendOption" :style="{ height: chartHeight + 'px' }" autoresize />
          <el-empty v-else description="暂无数据" :image-size="80" />
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover" class="chart-card">
          <template #header><div class="card-title">近 7 日平均分趋势</div></template>
          <v-chart v-if="avgScoreOption.series" :option="avgScoreOption" :style="{ height: chartHeight + 'px' }" autoresize />
          <el-empty v-else description="暂无数据" :image-size="80" />
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover" class="chart-card">
          <template #header><div class="card-title">近 7 日活跃度趋势</div></template>
          <v-chart v-if="activityOption.series" :option="activityOption" :style="{ height: chartHeight + 'px' }" autoresize />
          <el-empty v-else description="暂无数据" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>

    <!-- ==================== Row 2: 分数段分布 + 难度分布 + 题型分布 ==================== -->
    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="10">
        <el-card shadow="hover" class="chart-card">
          <template #header><div class="card-title">分数段分布</div></template>
          <v-chart v-if="scoreDistributionOption.series" :option="scoreDistributionOption" :style="{ height: chartHeight + 'px' }" autoresize />
          <el-empty v-else description="暂无数据" :image-size="80" />
        </el-card>
      </el-col>
      <el-col :span="7">
        <el-card shadow="hover" class="chart-card">
          <template #header><div class="card-title">题目难度分布</div></template>
          <v-chart v-if="difficultyPieOption.series" :option="difficultyPieOption" :style="{ height: chartHeight + 'px' }" autoresize />
          <el-empty v-else description="暂无数据" :image-size="80" />
        </el-card>
      </el-col>
      <el-col :span="7">
        <el-card shadow="hover" class="chart-card">
          <template #header><div class="card-title">题型分布</div></template>
          <v-chart v-if="questionTypeOption.series" :option="questionTypeOption" :style="{ height: chartHeight + 'px' }" autoresize />
          <el-empty v-else description="暂无数据" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>

    <!-- ==================== Row 3: 语法分类 + 高频错题 + 学习进度雷达 ==================== -->
    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="10">
        <el-card shadow="hover" class="chart-card">
          <template #header><div class="card-title">语法分类题目分布</div></template>
          <v-chart v-if="categoryBarOption.series" :option="categoryBarOption" :style="{ height: chartHeight + 'px' }" autoresize />
          <el-empty v-else description="暂无数据" :image-size="80" />
        </el-card>
      </el-col>
      <el-col :span="7">
        <el-card shadow="hover" class="chart-card">
          <template #header><div class="card-title">高频错题语法 Top 5</div></template>
          <v-chart v-if="wrongCategoryOption.series" :option="wrongCategoryOption" :style="{ height: chartHeight + 'px' }" autoresize />
          <el-empty v-else description="暂无数据" :image-size="80" />
        </el-card>
      </el-col>
      <el-col :span="7">
        <el-card shadow="hover" class="chart-card">
          <template #header><div class="card-title">学习进度雷达</div></template>
          <v-chart v-if="learningProgressOption.series" :option="learningProgressOption" :style="{ height: chartHeight + 'px' }" autoresize />
          <el-empty v-else description="暂无数据" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>

    <!-- ==================== Row 4: 错题掌握 + 优等生 + 待进步学生 ==================== -->
    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="8">
        <el-card shadow="hover" class="chart-card">
          <template #header><div class="card-title">错题掌握情况</div></template>
          <v-chart v-if="wrongMasteryOption.series" :option="wrongMasteryOption" :style="{ height: chartHeight + 'px' }" autoresize />
          <el-empty v-else description="暂无数据" :image-size="80" />
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header><div class="card-title">🏆 优等生 Top 5</div></template>
          <el-table v-if="stats.topStudents?.length" :data="stats.topStudents" size="small">
            <el-table-column type="index" label="#" width="50" />
            <el-table-column prop="realName" label="姓名" width="80" />
            <el-table-column prop="englishName" label="英文名" width="80" />
            <el-table-column label="平均分" width="80" align="center">
              <template #default="{ row }">
                <span :style="{ color: row.avgScore >= 90 ? '#67c23a' : row.avgScore >= 75 ? '#e6a23c' : '#f56c6c', fontWeight: 600 }">
                  {{ row.avgScore }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="正确率" width="80" align="center">
              <template #default="{ row }">{{ row.accuracy }}%</template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无数据" :image-size="80" />
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header><div class="card-title">📈 待进步学生 Top 5</div></template>
          <el-table v-if="stats.bottomStudents?.length" :data="stats.bottomStudents" size="small">
            <el-table-column type="index" label="#" width="50" />
            <el-table-column prop="realName" label="姓名" width="80" />
            <el-table-column prop="englishName" label="英文名" width="80" />
            <el-table-column label="平均分" width="80" align="center">
              <template #default="{ row }">
                <span :style="{ color: row.avgScore >= 90 ? '#67c23a' : row.avgScore >= 75 ? '#e6a23c' : '#f56c6c', fontWeight: 600 }">
                  {{ row.avgScore }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="错题数" width="80" align="center">
              <template #default="{ row }"><span style="color:#f56c6c">{{ row.wrongCount }}</span></template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无数据" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>

    <!-- ==================== Row 5: 最近考试 + 最近提交记录 ==================== -->
    <el-row :gutter="16" style="margin-top:16px">
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
          <el-empty v-else description="暂无数据" :image-size="80" />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="hover" class="chart-card">
          <template #header><div class="card-title">最近考试提交记录</div></template>
          <el-table v-if="stats.recentExams?.length" :data="stats.recentExams" size="small">
            <el-table-column prop="studentName" label="学生" width="80" />
            <el-table-column prop="sessionName" label="考试" min-width="100" show-overflow-tooltip />
            <el-table-column label="分数" width="80" align="center">
              <template #default="{ row }">
                <span :style="{ color: row.score >= 60 ? '#67c23a' : '#f56c6c', fontWeight: 600 }">{{ row.score }}</span>
              </template>
            </el-table-column>
            <el-table-column label="正确率" width="80" align="center">
              <template #default="{ row }">{{ row.accuracy }}%</template>
            </el-table-column>
            <el-table-column prop="submitTime" label="提交时间" width="120" />
          </el-table>
          <el-empty v-else description="暂无数据" :image-size="80" />
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
