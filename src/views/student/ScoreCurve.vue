<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getMyScoreTrend } from '@/api/scoreCurve'
import { getStudentMastery } from '@/api/knowledgeMastery'
import { useAuthStore } from '@/stores/auth'
import type { ScoreCurve as SC } from '@/types/scoreCurve'
import type { KnowledgeMastery as KM } from '@/types/knowledgeMastery'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, RadarChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent, RadarComponent, MarkLineComponent, MarkPointComponent } from 'echarts/components'
import { TrendCharts, DataAnalysis, Download } from '@element-plus/icons-vue'

use([CanvasRenderer, LineChart, RadarChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent, RadarComponent, MarkLineComponent, MarkPointComponent])

const authStore = useAuthStore()
const data = ref<SC[]>([])
const masteryData = ref<KM[]>([])
const loading = ref(false)

// ---- 旧 load 函数（保留注释） ----
// const load = async () => {
//   loading.value = true
//   try {
//     const res = await getMyScoreTrend()
//     data.value = res.data ?? []
//     await nextTick()
//     renderChart()
//   } finally { loading.value = false }
// }

// ---- 新 load 函数：同时获取成绩趋势和知识点掌握度 ----
const load = async () => {
  loading.value = true
  try {
    const uid = authStore.userInfo?.id
    const [scoreRes, masteryRes] = await Promise.allSettled([
      getMyScoreTrend(),
      uid ? getStudentMastery(uid) : Promise.reject('no uid'),
    ])
    if (scoreRes.status === 'fulfilled') data.value = scoreRes.value.data ?? []
    if (masteryRes.status === 'fulfilled') masteryData.value = masteryRes.value.data ?? []
  } finally { loading.value = false }
}

// ---- 旧 renderChart 函数（保留注释） ----
// const renderChart = () => {
//   const container = document.getElementById('score-curve-chart')
//   if (!container || data.value.length === 0) return
//   const chart = echarts.init(container)
//   const dates = data.value.map(d => d.examDate)
//   const scores = data.value.map(d => d.scorePercentage ?? 0)
//   const classAvgs = data.value.map(d => d.classAvgScore ?? 0)
//   chart.setOption({
//     tooltip: { trigger: 'axis' },
//     legend: { data: ['我的分数', '班级平均'] },
//     xAxis: { type: 'category', data: dates },
//     yAxis: { type: 'value', name: '百分制分数', min: 0, max: 100 },
//     series: [
//       { name: '我的分数', type: 'line', data: scores, smooth: true, itemStyle: { color: '#409EFF' }, markLine: { data: [{ type: 'average', name: '个人平均' }] } },
//       { name: '班级平均', type: 'line', data: classAvgs, smooth: true, itemStyle: { color: '#E6A23C' }, lineStyle: { type: 'dashed' } },
//     ],
//   })
// }

/** 计算简单移动平均 */
const movingAverage = (arr: number[], window = 3): number[] => {
  return arr.map((_, i) => {
    const start = Math.max(0, i - window + 1)
    const slice = arr.slice(start, i + 1)
    return slice.reduce((s, v) => s + v, 0) / slice.length
  })
}

// ---- 新成绩趋势折线图配置（增强版） ----
const scoreTrendOption = computed(() => {
  if (!data.value.length) return {}
  const dates = data.value.map(d => d.examDate)
  const scores = data.value.map(d => d.scorePercentage ?? 0)
  const classAvgs = data.value.map(d => d.classAvgScore ?? 0)
  const ma = movingAverage(scores, 3)
  return {
    tooltip: {
      trigger: 'axis' as const,
      formatter: (params: any) => {
        const idx = params[0]?.dataIndex ?? 0
        const item = data.value[idx]
        if (!item) return ''
        let html = `<b>${item.examName || item.sessionName || '-'}</b><br/>`
        html += `日期：${item.examDate}<br/>`
        params.forEach((p: any) => {
          html += `${p.marker}${p.seriesName}：${p.value?.toFixed(1) ?? '-'}分<br/>`
        })
        const gap = (item.scorePercentage ?? 0) - (item.classAvgScore ?? 0)
        html += `与班级均分差：${gap >= 0 ? '+' : ''}${gap.toFixed(1)}<br/>`
        if (item.classRank) html += `班级排名：第${item.classRank}名`
        return html
      },
    },
    legend: { data: ['我的分数', '班级平均', '移动均分'], bottom: 0, textStyle: { fontSize: 12 } },
    grid: { left: 50, right: 20, top: 20, bottom: 50 },
    xAxis: { type: 'category' as const, data: dates, axisLabel: { rotate: 30, fontSize: 11 } },
    yAxis: { type: 'value' as const, name: '百分制', min: 0, max: 100, axisLabel: { formatter: '{value}' } },
    series: [
      {
        name: '我的分数', type: 'line', smooth: true, data: scores,
        lineStyle: { color: '#409eff', width: 3 },
        itemStyle: { color: '#409eff' },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(64,158,255,0.3)' }, { offset: 1, color: 'rgba(64,158,255,0.02)' }] } },
        markLine: {
          silent: true,
          data: [
            { type: 'average', name: '个人平均', lineStyle: { color: '#67c23a', type: 'dashed' } },
            { yAxis: 60, name: '及格线', lineStyle: { color: '#f56c6c', type: 'dashed', width: 2 }, label: { formatter: '及格线 60', position: 'insideEndTop', color: '#f56c6c' } },
          ],
        },
        markPoint: {
          data: [
            { type: 'max', name: '最高分', symbolSize: 55, itemStyle: { color: '#67c23a' }, label: { formatter: '最高\n{c}', fontSize: 10 } },
            { type: 'min', name: '最低分', symbolSize: 55, itemStyle: { color: '#f56c6c' }, label: { formatter: '最低\n{c}', fontSize: 10 } },
          ],
        },
      },
      {
        name: '班级平均', type: 'line', smooth: true, data: classAvgs,
        lineStyle: { color: '#e6a23c', width: 2, type: 'dashed' },
        itemStyle: { color: '#e6a23c' },
      },
      {
        name: '移动均分', type: 'line', smooth: true, data: ma,
        lineStyle: { color: '#a855f7', width: 2, type: 'dotted' },
        itemStyle: { color: '#a855f7' },
        symbol: 'circle', symbolSize: 5,
      },
    ],
  }
})

// ---- 新增：知识点掌握雷达图 ----
const radarChartOption = computed(() => {
  if (!masteryData.value.length) return {}
  const top = masteryData.value.slice(0, 8)
  return {
    tooltip: {
      trigger: 'item' as const,
      formatter: (params: any) => {
        const vals = params.value as number[]
        let html = `<b>${params.name}</b><br/>`
        top.forEach((m, i) => {
          html += `${m.tagName ?? m.categoryName ?? ''}: ${vals[i]?.toFixed(1) ?? 0}分<br/>`
        })
        return html
      },
    },
    radar: {
      indicator: top.map(d => ({ name: (d.tagName ?? d.categoryName ?? '').length > 6 ? (d.tagName ?? '').slice(0, 6) + '…' : (d.tagName ?? d.categoryName ?? ''), max: 100 })),
      shape: 'polygon',
      splitNumber: 5,
      axisName: { color: '#606266', fontSize: 12 },
      splitLine: { lineStyle: { color: ['#f56c6c', '#e6a23c', '#e6a23c', '#67c23a', '#67c23a'] } },
      splitArea: { areaStyle: { color: ['rgba(245,108,108,0.06)', 'rgba(230,162,60,0.06)', 'rgba(230,162,60,0.04)', 'rgba(103,194,58,0.04)', 'rgba(103,194,58,0.06)'] } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: top.map(d => d.proficiencyScore ?? 0),
        name: '掌握度',
        areaStyle: { color: 'rgba(64,158,255,0.25)' },
        lineStyle: { color: '#409eff', width: 2 },
        itemStyle: { color: '#409eff' },
      }],
    }],
  }
})

// ---- 统计摘要 ----
const summary = computed(() => {
  if (!data.value.length) return null
  const scores = data.value.map(d => d.scorePercentage ?? 0)
  const latest = data.value[data.value.length - 1]
  return {
    count: data.value.length,
    latestScore: latest?.scorePercentage ?? 0,
    progress: latest?.progressAmount ?? 0,
    maxScore: Math.max(...scores),
    avgScore: scores.reduce((s, v) => s + v, 0) / scores.length,
  }
})

const exportCSV = () => {
  if (data.value.length === 0) { ElMessage.warning('无数据'); return }
  const csv = ['考试日期,考试名称,得分,满分,百分制,班级排名,进步幅度']
  data.value.forEach(d => csv.push([d.examDate, d.examName, d.score, d.totalScore, d.scorePercentage, d.classRank ?? '-', d.progressAmount ?? 0].join(',')))
  const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = '成绩趋势.csv'; a.click()
  URL.revokeObjectURL(url)
}

onMounted(load)
</script>

<template>
  <div class="page-container" v-loading="loading">
    <!-- 页面头部 -->
    <div class="sc-header">
      <div class="sc-header-left">
        <h3 class="sc-title">成绩趋势分析</h3>
        <el-button type="primary" plain @click="$router.push('/student/stats')">
          <el-icon><TrendCharts /></el-icon>查看详细统计
        </el-button>
      </div>
      <el-button @click="exportCSV" :disabled="!data.length">
        <el-icon><Download /></el-icon>导出CSV
      </el-button>
    </div>

    <!-- 成绩趋势折线图（增强版） -->
    <el-card shadow="never" class="section-card">
      <template #header>
        <div style="display:flex;align-items:center;gap:8px">
          <el-icon><TrendCharts /></el-icon>
          <span>成绩变化曲线（含移动均分 / 及格线 / 最值标记 / 班级对比）</span>
        </div>
      </template>
      <!-- 旧图表容器（保留注释）：<div id="score-curve-chart" style="width:100%;height:420px" v-if="data.length > 0" /> -->
      <VChart v-if="scoreTrendOption.series" :option="scoreTrendOption" autoresize style="height:420px" />
      <el-empty v-else description="暂无考试记录" />
    </el-card>

    <!-- 统计摘要卡片 -->
    <el-row :gutter="16" class="stat-row" v-if="summary">
      <el-col :span="6">
        <div class="stat-card stat-count">
          <div class="sc-num">{{ summary.count }}</div>
          <div class="sc-lbl">考试次数</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card stat-latest">
          <div class="sc-num">{{ summary.latestScore.toFixed(1) }}</div>
          <div class="sc-lbl">最新分数</div>
          <div class="sc-sub" :style="{ color: summary.progress >= 0 ? '#67c23a' : '#f56c6c' }">
            {{ summary.progress >= 0 ? '↑ +' : '↓ ' }}{{ Math.abs(summary.progress).toFixed(1) }}
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card stat-max">
          <div class="sc-num">{{ summary.maxScore.toFixed(1) }}</div>
          <div class="sc-lbl">最高分</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card stat-avg">
          <div class="sc-num">{{ summary.avgScore.toFixed(1) }}</div>
          <div class="sc-lbl">平均分</div>
        </div>
      </el-col>
    </el-row>

    <!-- 知识点掌握雷达图 -->
    <el-card v-if="radarChartOption.series" shadow="never" class="section-card" style="margin-top:16px">
      <template #header>
        <div style="display:flex;align-items:center;gap:8px">
          <el-icon><DataAnalysis /></el-icon>
          <span>知识点掌握度雷达图（最弱 8 项）</span>
          <el-button type="primary" link @click="$router.push('/student/knowledge-mastery')">
            查看全部 →
          </el-button>
        </div>
      </template>
      <VChart :option="radarChartOption" autoresize style="height:380px" />
    </el-card>

    <!-- 考试记录明细 -->
    <el-card shadow="never" class="section-card" style="margin-top:16px" v-if="data.length > 0">
      <template #header><span>考试记录明细</span></template>
      <el-table :data="[...data].reverse()" stripe border max-height="400">
        <el-table-column prop="examDate" label="日期" width="120" />
        <el-table-column prop="examName" label="考试名称" min-width="150" />
        <el-table-column prop="score" label="得分" width="80" />
        <el-table-column prop="totalScore" label="满分" width="80" />
        <el-table-column prop="scorePercentage" label="百分制" width="80" />
        <el-table-column label="进步幅度" width="100">
          <template #default="{ row }">
            <span :style="{ color: (row.progressAmount ?? 0) >= 0 ? '#67C23A' : '#F56C6C', fontWeight: 'bold' }">
              {{ (row.progressAmount ?? 0) >= 0 ? '+' : '' }}{{ row.progressAmount?.toFixed(1) ?? '-' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="classRank" label="班级排名" width="80" />
      </el-table>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.page-container { display: flex; flex-direction: column; gap: 14px; padding: 16px; }

.sc-header {
  display: flex; align-items: center; justify-content: space-between;
  .sc-header-left { display: flex; align-items: center; gap: 16px; }
  .sc-title { margin: 0; font-size: 18px; font-weight: 600; color: #303133; }
}

.section-card {
  border-radius: 8px;
  :deep(.el-card__header) { padding: 12px 20px; font-weight: 600; font-size: 14px; }
}

.stat-row { margin: 0 !important; }

.stat-card {
  text-align: center; background: #fff; border-radius: 10px; padding: 20px 12px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.06); transition: transform 0.2s, box-shadow 0.2s;
  &:hover { transform: translateY(-3px); box-shadow: 0 6px 16px rgba(0,0,0,0.1); }
}
.sc-num { font-size: 30px; font-weight: 700; line-height: 1.2; }
.sc-lbl { font-size: 13px; color: #606266; margin: 6px 0 2px; }
.sc-sub { font-size: 13px; font-weight: 600; margin-top: 4px; }

.stat-count { border-top: 3px solid #409eff; .sc-num { color: #409eff; } }
.stat-latest { border-top: 3px solid #67c23a; .sc-num { color: #67c23a; } }
.stat-max { border-top: 3px solid #e6a23c; .sc-num { color: #e6a23c; } }
.stat-avg { border-top: 3px solid #a855f7; .sc-num { color: #a855f7; } }
</style>
