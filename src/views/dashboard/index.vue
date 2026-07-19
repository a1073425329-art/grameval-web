<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from 'echarts/components'
import { getDashboard } from '@/api/admin'
import type { AdminDashboardData } from '@/types/admin'

use([
  CanvasRenderer,
  LineChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
])

const loading = ref(false)
const stats = ref<AdminDashboardData>({
  studentCount: 0,
  adminCount: 0,
  questionCount: 0,
  categoryCount: 0,
  paperCount: 0,
  sessionCount: 0,
  examRecordCount: 0,
  practiceCount: 0,
  recentTrend: [],
})

const statsCards = computed(() => [
  { title: '学生总数', value: stats.value.studentCount, icon: 'UserFilled', color: '#409eff' },
  { title: '题库总数', value: stats.value.questionCount, icon: 'Notebook', color: '#67c23a' },
  { title: '试卷数', value: stats.value.paperCount, icon: 'Files', color: '#e6a23c' },
  { title: '考试场次', value: stats.value.sessionCount, icon: 'Calendar', color: '#909399' },
  { title: '考试记录数', value: stats.value.examRecordCount, icon: 'EditPen', color: '#f56c6c' },
  { title: '练习次数', value: stats.value.practiceCount, icon: 'DataAnalysis', color: '#9c27b0' },
])

const trendOption = computed(() => ({
  title: { text: '近 7 日考试提交趋势', left: 'center', textStyle: { fontSize: 16 } },
  tooltip: { trigger: 'axis' },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: stats.value.recentTrend.map((d) => d.date),
  },
  yAxis: { type: 'value', name: '人次', minInterval: 1 },
  series: [
    {
      name: '提交人次',
      type: 'line',
      smooth: true,
      data: stats.value.recentTrend.map((d) => d.count),
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(64,158,255,0.35)' },
            { offset: 1, color: 'rgba(64,158,255,0.02)' },
          ],
        },
      },
      lineStyle: { color: '#409eff', width: 3 },
      itemStyle: { color: '#409eff' },
    },
  ],
  grid: { left: 50, right: 20, bottom: 30, top: 60 },
}))

const load = async () => {
  loading.value = true
  try {
    const res = await getDashboard()
    stats.value = res.data
  } catch { /* silent */ } finally { loading.value = false }
}

const chartHeight = ref(360)
const handleResize = () => { chartHeight.value = window.innerWidth < 1200 ? 280 : 360 }

onMounted(() => {
  window.addEventListener('resize', handleResize)
  handleResize()
  load()
})
onUnmounted(() => { window.removeEventListener('resize', handleResize) })
</script>

<template>
  <div class="dashboard" v-loading="loading">
    <el-row :gutter="16" class="stats-row">
      <el-col v-for="card in statsCards" :key="card.title" :xs="12" :sm="8" :md="4">
        <el-card shadow="hover" class="stats-card">
          <div class="stats-card-inner">
            <div class="stats-info">
              <div class="stats-label">{{ card.title }}</div>
              <div class="stats-value">{{ card.value }}</div>
            </div>
            <div class="stats-icon" :style="{ background: card.color + '15', color: card.color }">
              <el-icon :size="24">
                <component :is="card.icon" />
              </el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="chart-row">
      <el-col :span="24">
        <el-card shadow="hover" class="chart-card">
          <v-chart :option="trendOption" :style="{ height: chartHeight + 'px' }" autoresize />
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
  }
  .stats-card-inner {
    display: flex; align-items: center; justify-content: space-between;
  }
  .stats-info { flex: 1; }
  .stats-label { font-size: 13px; color: #909399; margin-bottom: 6px; }
  .stats-value { font-size: 24px; font-weight: 700; color: #303133; }

  .stats-icon {
    width: 44px; height: 44px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  .chart-card { border-radius: 8px; margin-bottom: 16px; }
}
</style>
