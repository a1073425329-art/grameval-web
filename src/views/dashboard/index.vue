<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from 'echarts/components'

use([
  CanvasRenderer,
  BarChart,
  LineChart,
  PieChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
])

// Stats cards
const statsCards = ref([
  { title: '总考试数', value: '--', icon: 'EditPen', color: '#409eff' },
  { title: '总题目数', value: '--', icon: 'Notebook', color: '#67c23a' },
  { title: '参考人数', value: '--', icon: 'User', color: '#e6a23c' },
  { title: '通过率', value: '--', icon: 'TrophyBase', color: '#f56c6c' },
])

// Exam score distribution bar chart
const barOption = ref({
  title: { text: '近期考试成绩分布', left: 'center', textStyle: { fontSize: 16 } },
  tooltip: { trigger: 'axis' },
  xAxis: {
    type: 'category',
    data: ['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19'],
  },
  yAxis: { type: 'value', name: '平均分' },
  series: [
    {
      name: '平均分',
      type: 'bar',
      data: [78, 82, 75, 90, 85, 88, 92],
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: '#409eff' },
            { offset: 1, color: '#79bbff' },
          ],
        },
      },
    },
  ],
  grid: { left: 50, right: 20, bottom: 30, top: 50 },
})

// Pass rate pie chart
const pieOption = ref({
  title: { text: '整体通过率', left: 'center', textStyle: { fontSize: 16 } },
  tooltip: { trigger: 'item', formatter: '{b}: {c}% ({d}%)' },
  series: [
    {
      type: 'pie',
      radius: ['40%', '65%'],
      center: ['50%', '55%'],
      data: [
        { value: 68, name: '通过', itemStyle: { color: '#67c23a' } },
        { value: 32, name: '未通过', itemStyle: { color: '#f56c6c' } },
      ],
      label: {
        formatter: '{b}\n{d}%',
      },
    },
  ],
})

// Recent exam trend line chart
const lineOption = ref({
  title: { text: '参与人数趋势', left: 'center', textStyle: { fontSize: 16 } },
  tooltip: { trigger: 'axis' },
  xAxis: {
    type: 'category',
    data: ['1月', '2月', '3月', '4月', '5月', '6月', '7月'],
  },
  yAxis: { type: 'value', name: '人数' },
  series: [
    {
      name: '参考人数',
      type: 'line',
      smooth: true,
      data: [120, 200, 150, 280, 350, 420, 380],
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(64,158,255,0.3)' },
            { offset: 1, color: 'rgba(64,158,255,0.05)' },
          ],
        },
      },
      lineStyle: { color: '#409eff', width: 3 },
      itemStyle: { color: '#409eff' },
    },
  ],
  grid: { left: 50, right: 20, bottom: 30, top: 50 },
})

// Responsive resize
const chartHeight = ref(320)

const handleResize = () => {
  const w = window.innerWidth
  if (w < 1200) {
    chartHeight.value = 260
  } else {
    chartHeight.value = 320
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
  handleResize()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div class="dashboard">
    <!-- Stats Cards -->
    <el-row :gutter="16" class="stats-row">
      <el-col
        v-for="card in statsCards"
        :key="card.title"
        :xs="12"
        :sm="12"
        :md="6"
      >
        <el-card shadow="hover" class="stats-card">
          <div class="stats-card-inner">
            <div class="stats-info">
              <div class="stats-label">{{ card.title }}</div>
              <div class="stats-value">{{ card.value }}</div>
            </div>
            <div class="stats-icon" :style="{ background: card.color + '15', color: card.color }">
              <el-icon :size="28">
                <component :is="card.icon" />
              </el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Charts -->
    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :md="14">
        <el-card shadow="hover" class="chart-card">
          <v-chart
            :option="barOption"
            :style="{ height: chartHeight + 'px' }"
            autoresize
          />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="10">
        <el-card shadow="hover" class="chart-card">
          <v-chart
            :option="pieOption"
            :style="{ height: chartHeight + 'px' }"
            autoresize
          />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="chart-row">
      <el-col :span="24">
        <el-card shadow="hover" class="chart-card">
          <v-chart
            :option="lineOption"
            :style="{ height: chartHeight + 'px' }"
            autoresize
          />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped lang="scss">
.dashboard {
  .stats-row {
    margin-bottom: 16px;
  }

  .stats-card {
    margin-bottom: 16px;
    border-radius: 8px;
    transition: transform 0.2s;

    &:hover {
      transform: translateY(-2px);
    }
  }

  .stats-card-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .stats-info {
    flex: 1;
  }

  .stats-label {
    font-size: 14px;
    color: #909399;
    margin-bottom: 8px;
  }

  .stats-value {
    font-size: 28px;
    font-weight: 700;
    color: #303133;
  }

  .stats-icon {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .chart-row {
    margin-bottom: 16px;
  }

  .chart-card {
    border-radius: 8px;
    margin-bottom: 16px;
  }
}
</style>