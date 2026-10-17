<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getStudentStatistics, getMyResults } from '@/api/student'
import { getMyScoreTrend } from '@/api/scoreCurve'
import { getStudentMastery } from '@/api/knowledgeMastery'
import type { StudentStatistics, CategoryStat, DifficultyStat, TagStat } from '@/types/stats'
import type { ExamResultItem } from '@/types/result'
import type { ScoreCurve as SC } from '@/types/scoreCurve'
import type { KnowledgeMastery as KM } from '@/types/knowledgeMastery'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart, RadarChart, PieChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent, RadarComponent, MarkLineComponent, MarkPointComponent } from 'echarts/components'
import { TrendCharts, DataAnalysis } from '@element-plus/icons-vue'

use([CanvasRenderer, BarChart, LineChart, RadarChart, PieChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent, RadarComponent, MarkLineComponent, MarkPointComponent])

const authStore = useAuthStore()
const userId = computed(() => authStore.userInfo?.id as number)
const loading = ref(false)

const stats = ref<StudentStatistics | null>(null)
const recentResults = ref<ExamResultItem[]>([])
/* [2026-10-17] recentPractices 已随「最近练习记录」卡下线（流水归首页），不再拉取 */

// ===== 新增：雷达图/班级对比/分布图所需数据 =====
const scoreCurveData = ref<SC[]>([])
const masteryData = ref<KM[]>([])

// 维度切换
/* [2026-10-17 职责划分] 原「考试+练习+错题」维度对应的 KPI 四卡与考试/练习流水已移到首页，
   本页该维度只剩摘要数字，故更名为「成绩概览」。 */
const currentModule = ref('all')
const moduleOptions = [
  { label: '全部', value: 'all' },
  { label: '成绩概览', value: 'basic,exam,practice,wrong' },
  { label: '考点弱点', value: 'tag' },
  { label: '语法大类', value: 'category' },
  { label: '难度分布', value: 'difficulty' },
]

const includeMap: Record<string, string | undefined> = {
  all: undefined,
  'basic,exam,practice,wrong': 'basic,exam,practice,wrong',
  tag: 'tag',
  category: 'category',
  difficulty: 'difficulty',
}

// ---- 旧 load 函数（保留注释） ----
// const load = async () => {
//   if (!userId.value) return
//   loading.value = true
//   try {
//     const [s, r, p] = await Promise.allSettled([
//       getStudentStatistics(userId.value, includeMap[currentModule.value]),
//       getMyResults({ pageNum: 1, pageSize: 50 }),
//       listPractices({ pageNum: 1, pageSize: 50 }),
//     ])
//     if (s.status === 'fulfilled') stats.value = s.value.data
//     if (r.status === 'fulfilled') recentResults.value = r.value.data?.records ?? ([] as any)
//     if (p.status === 'fulfilled') recentPractices.value = p.value.data?.records ?? ([] as any)
//   } finally { loading.value = false }
// }

// ---- 新 load 函数：增加知识点掌握度、成绩曲线 ----
const load = async () => {
  if (!userId.value) return
  loading.value = true
  try {
    const [s, r, sc, km] = await Promise.allSettled([
      getStudentStatistics(userId.value, includeMap[currentModule.value]),
      getMyResults({ pageNum: 1, pageSize: 20 }),
      getMyScoreTrend(),
      getStudentMastery(userId.value),
    ])
    if (s.status === 'fulfilled') stats.value = s.value.data
    if (r.status === 'fulfilled') recentResults.value = r.value.data?.records ?? ([] as any)
    if (sc.status === 'fulfilled') scoreCurveData.value = sc.value.data ?? []
    if (km.status === 'fulfilled') masteryData.value = km.value.data ?? []
  } finally { loading.value = false }
}

const switchModule = (val: string) => { currentModule.value = val; load() }

/** [2026-10-17] 只统计已出分记录：未提交/超时的记录 scorePercentage 为 null，
    直接按 0 分处理会把它们画成 0 分并归入「不及格」，趋势和分布都会失真。 */
const scoredResults = computed(() => recentResults.value.filter(r => r.scorePercentage != null))

// 成绩趋势数据：取最近 10 次已出分考试
const scoreTrendData = computed(() => {
  return [...scoredResults.value].reverse().slice(0, 10).map(r => ({
    name: (r.sessionName?.length ?? 0) > 8 ? r.sessionName!.slice(0, 8) + '…' : (r.sessionName || '-'),
    score: r.scorePercentage ?? 0,
    date: r.submitTime?.slice(0, 10) || '',
  }))
})

onMounted(load)

// ===== Helpers =====
const accuracyColor = (v?: number) => { if (v == null) return '#909399'; if (v >= 80) return '#67c23a'; if (v >= 60) return '#e6a23c'; return '#f56c6c' }
const weekDayNames: Record<string, string> = { '1': '周一', '2': '周二', '3': '周三', '4': '周四', '5': '周五', '6': '周六', '7': '周日' }
const trainingDaysText = computed(() => {
  const td = stats.value?.trainingSchedule?.trainingDays
  if (!td) return '未设置'
  return td.split(',').map(d => weekDayNames[d.trim()] || d).join('、')
})

// ===== 图表配置 =====

// ---- 旧成绩趋势折线图配置（保留注释） ----
// const scoreTrendOption = computed(() => {
//   const data = scoreTrendData.value
//   if (!data.length) return {}
//   return {
//     tooltip: { trigger: 'axis' as const, formatter: (p: any) => `${p[0].axisValue}<br/>得分：${p[0].value.toFixed(1)}%` },
//     grid: { left: 45, right: 20, top: 10, bottom: 40 },
//     xAxis: { type: 'category' as const, data: data.map(d => d.date), axisLabel: { rotate: 30, fontSize: 11 } },
//     yAxis: { type: 'value' as const, min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
//     series: [{
//       type: 'line', smooth: true, data: data.map(d => d.score),
//       lineStyle: { color: '#409eff', width: 3 },
//       itemStyle: { color: '#409eff' },
//       markLine: { silent: true, data: [{ type: 'average', name: '均分', lineStyle: { color: '#e6a23c', type: 'dashed' } }] },
//       areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(64,158,255,0.3)' }, { offset: 1, color: 'rgba(64,158,255,0.02)' }] } },
//     }],
//   }
// })

// ---- 新成绩趋势折线图：增强版（移动平均、最值标记、及格线、交互 tooltip） ----
/** 计算简单移动平均 */
const movingAverage = (data: number[], window = 3): number[] => {
  return data.map((_, i) => {
    const start = Math.max(0, i - window + 1)
    const slice = data.slice(start, i + 1)
    return slice.reduce((s, v) => s + v, 0) / slice.length
  })
}

const scoreTrendOption = computed(() => {
  const data = scoreTrendData.value
  if (!data.length) return {}
  const scores = data.map(d => d.score)
  const ma = movingAverage(scores, 3)
  return {
    tooltip: {
      trigger: 'axis' as const,
      formatter: (params: any) => {
        const idx = params[0]?.dataIndex ?? 0
        const item = data[idx]
        if (!item) return ''
        let html = `<b>${item.name}</b><br/>`
        html += `日期：${item.date}<br/>`
        html += `${params[0]?.marker ?? ''}得分：${item.score.toFixed(1)}%<br/>`
        if (params[1]) html += `${params[1].marker}移动均分：${params[1].value?.toFixed(1)}%<br/>`
        return html
      },
    },
    legend: { data: ['得分', '移动均分'], bottom: 0, textStyle: { fontSize: 12 } },
    grid: { left: 45, right: 20, top: 20, bottom: 50 },
    xAxis: { type: 'category' as const, data: data.map(d => d.date), axisLabel: { rotate: 30, fontSize: 11 } },
    yAxis: { type: 'value' as const, min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
    series: [
      {
        name: '得分', type: 'line', smooth: true, data: scores,
        lineStyle: { color: '#409eff', width: 3 },
        itemStyle: { color: '#409eff' },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(64,158,255,0.3)' }, { offset: 1, color: 'rgba(64,158,255,0.02)' }] } },
        markLine: {
          silent: true,
          data: [
            { type: 'average', name: '均分', lineStyle: { color: '#e6a23c', type: 'dashed' } },
            { yAxis: 60, name: '及格线', lineStyle: { color: '#f56c6c', type: 'dashed', width: 2 }, label: { formatter: '及格线 60%', position: 'insideEndTop', color: '#f56c6c' } },
          ],
        },
        markPoint: {
          data: [
            { type: 'max', name: '最高分', symbolSize: 55, itemStyle: { color: '#67c23a' }, label: { formatter: '最高\n{c}%', fontSize: 10 } },
            { type: 'min', name: '最低分', symbolSize: 55, itemStyle: { color: '#f56c6c' }, label: { formatter: '最低\n{c}%', fontSize: 10 } },
          ],
        },
      },
      {
        name: '移动均分', type: 'line', smooth: true, data: ma,
        lineStyle: { color: '#e6a23c', width: 2, type: 'dashed' },
        itemStyle: { color: '#e6a23c' },
        symbol: 'circle', symbolSize: 5,
      },
    ],
  }
})

// 语法大类正确率（横向柱状图）
const categoryChartOption = computed(() => {
  const list: CategoryStat[] = stats.value?.categoryStats ?? []
  if (!list.length) return {}
  const sorted = [...list].sort((a, b) => a.accuracy - b.accuracy)
  return {
    tooltip: { trigger: 'axis' as const, formatter: (p: any) => {
      const item = sorted[p[0].dataIndex]
      if (!item) return ''
      return `${item.categoryName}<br/>正确率：${item.accuracy.toFixed(1)}%（${item.correct}/${item.total}）`
    }},
    grid: { left: 110, right: 30, top: 10, bottom: 20 },
    xAxis: { type: 'value' as const, max: 100, axisLabel: { formatter: '{value}%' } },
    yAxis: { type: 'category' as const, data: sorted.map(c => c.categoryName), axisLabel: { fontSize: 12 } },
    series: [{
      type: 'bar', data: sorted.map(c => c.accuracy), barMaxWidth: 28,
      itemStyle: { color: (p: any) => { const v = p.value ?? 0; return v >= 80 ? '#67c23a' : v >= 60 ? '#e6a23c' : '#f56c6c' } },
    }],
  }
})

// 难度正确率
const difficultyChartOption = computed(() => {
  const list: DifficultyStat[] = stats.value?.difficultyStats ?? []
  if (!list.length) return {}
  const sorted = [...list].sort((a, b) => a.difficulty - b.difficulty)
  return {
    tooltip: { trigger: 'axis' as const },
    grid: { left: 55, right: 30, top: 10, bottom: 20 },
    xAxis: { type: 'category' as const, data: sorted.map(d => d.difficultyLabel) },
    yAxis: { type: 'value' as const, max: 100, axisLabel: { formatter: '{value}%' } },
    series: [{
      type: 'bar', data: sorted.map(d => d.accuracy), barMaxWidth: 50,
      itemStyle: { color: (p: any) => { const v = p.value ?? 0; return v >= 80 ? '#67c23a' : v >= 60 ? '#e6a23c' : '#f56c6c' } },
    }],
  }
})

// 考点弱点 Top 15
const tagChartOption = computed(() => {
  const list: TagStat[] = stats.value?.tagStats ?? []
  if (!list.length) return {}
  const top = [...list].slice(0, 15).reverse()
  return {
    tooltip: { trigger: 'axis' as const, formatter: (p: any) => {
      const item = top[p[0].dataIndex]
      if (!item) return ''
      return `${item.tagName}<br/>错误率：${item.errorRate.toFixed(1)}%（${item.wrong}/${item.total}）`
    }},
    grid: { left: 140, right: 30, top: 10, bottom: 20 },
    xAxis: { type: 'value' as const, max: 100, axisLabel: { formatter: '{value}%' } },
    yAxis: { type: 'category' as const, data: top.map(t => t.tagName.length > 14 ? t.tagName.slice(0, 14) + '…' : t.tagName), axisLabel: { fontSize: 11 } },
    series: [{
      type: 'bar', data: top.map(t => t.errorRate), barMaxWidth: 20,
      itemStyle: { color: (p: any) => { const v = p.value ?? 0; return v <= 20 ? '#67c23a' : v <= 50 ? '#e6a23c' : '#f56c6c' } },
    }],
  }
})

// ===== 新增：知识点掌握程度雷达图 =====
/** 从 categoryStats 或 knowledgeMastery 数据中提取分类掌握度 */
const radarCategories = computed<CategoryStat[]>(() => {
  const cats = stats.value?.categoryStats ?? []
  if (cats.length) return cats
  // 若无 categoryStats，从 knowledgeMastery 按 categoryName 分组取均值
  const grouped = new Map<string, { sum: number; count: number }>()
  masteryData.value.forEach(m => {
    const cn = m.categoryName || m.tagName || '未知'
    if (!grouped.has(cn)) grouped.set(cn, { sum: 0, count: 0 })
    const g = grouped.get(cn)!
    g.sum += m.proficiencyScore ?? 0
    g.count++
  })
  return Array.from(grouped.entries()).map(([name, g], i) => ({
    categoryId: i,
    categoryName: name,
    total: 0, correct: 0, wrong: 0,
    accuracy: g.count > 0 ? g.sum / g.count : 0,
  }))
})

/** 班级平均正确率（取自成绩曲线中各次考试的班级平均分，不依赖已禁用的排行榜） */
const classAvgAccuracy = computed(() => {
  const data = scoreCurveData.value
  if (!data.length) return 0
  const sum = data.reduce((s, i) => s + (i.classAvgScore || 0), 0)
  return Math.round(sum / data.length * 10) / 10
})

const radarChartOption = computed(() => {
  const cats = radarCategories.value
  if (!cats.length) return {}
  const studentValues = cats.map(c => Math.round(c.accuracy * 10) / 10)
  const classAvg = classAvgAccuracy.value

  // 班级平均线仅在拿到成绩曲线数据时绘制，避免出现 0 值假线
  const seriesData: any[] = [
    {
      value: studentValues, name: '我的掌握度',
      areaStyle: { color: 'rgba(64,158,255,0.25)' },
      lineStyle: { color: '#409eff', width: 2 },
      itemStyle: { color: '#409eff' },
    },
  ]
  if (classAvg > 0) {
    seriesData.push({
      value: cats.map(() => classAvg), name: '班级平均',
      areaStyle: { color: 'rgba(230,162,60,0.1)' },
      lineStyle: { color: '#e6a23c', width: 2, type: 'dashed' },
      itemStyle: { color: '#e6a23c' },
    })
  }

  return {
    tooltip: {
      trigger: 'item' as const,
      formatter: (params: any) => {
        const cats2 = radarCategories.value
        const values = params.value as number[]
        let html = `<b>${params.name}</b><br/>`
        values.forEach((v, i) => {
          html += `${cats2[i]?.categoryName ?? ''}: ${v.toFixed(1)}%<br/>`
        })
        return html
      },
    },
    legend: { data: classAvg > 0 ? ['我的掌握度', '班级平均'] : ['我的掌握度'], bottom: 0, textStyle: { fontSize: 12 } },
    radar: {
      indicator: cats.map(c => ({ name: c.categoryName.length > 6 ? c.categoryName.slice(0, 6) + '…' : c.categoryName, max: 100 })),
      shape: 'polygon',
      splitNumber: 5,
      center: ['50%', '52%'],
      radius: '65%',
      axisName: { color: '#606266', fontSize: 12 },
      splitLine: { lineStyle: { color: ['#f56c6c', '#e6a23c', '#e6a23c', '#67c23a', '#67c23a'] } },
      splitArea: {
        areaStyle: {
          color: ['rgba(245,108,108,0.06)', 'rgba(230,162,60,0.06)', 'rgba(230,162,60,0.04)', 'rgba(103,194,58,0.04)', 'rgba(103,194,58,0.06)'],
        },
      },
      axisLine: { lineStyle: { color: '#dcdfe6' } },
    },
    series: [{ type: 'radar', data: seriesData }],
  }
})

// ===== 新增：与班级平均水平对比柱状图 =====
const classComparisonOption = computed(() => {
  const data = scoreCurveData.value
  if (!data.length) return {}
  return {
    tooltip: {
      trigger: 'axis' as const,
      formatter: (params: any) => {
        const idx = params[0]?.dataIndex ?? 0
        const item = data[idx]
        if (!item) return ''
        let html = `<b>${item.examName || item.sessionName || '-'}</b><br/>`
        html += `日期：${item.examDate}<br/>`
        params.forEach((p: any) => {
          html += `${p.marker}${p.seriesName}：${p.value?.toFixed(1) ?? '-'}%<br/>`
        })
        const gap = (item.scorePercentage ?? 0) - (item.classAvgScore ?? 0)
        html += `差距：${gap >= 0 ? '+' : ''}${gap.toFixed(1)}%<br/>`
        if (item.classRank) html += `班级排名：${item.classRank}`
        return html
      },
    },
    legend: { data: ['我的分数', '班级平均'], bottom: 0, textStyle: { fontSize: 12 } },
    grid: { left: 45, right: 20, top: 20, bottom: 50 },
    xAxis: {
      type: 'category' as const,
      data: data.map(d => d.examDate),
      axisLabel: { rotate: 30, fontSize: 11 },
    },
    yAxis: { type: 'value' as const, min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
    series: [
      {
        name: '我的分数', type: 'bar', barMaxWidth: 30,
        data: data.map(d => d.scorePercentage ?? 0),
        itemStyle: {
          color: (p: any) => {
            const v = p.value ?? 0
            return v >= 80 ? '#67c23a' : v >= 60 ? '#409eff' : '#f56c6c'
          },
          borderRadius: [4, 4, 0, 0],
        },
      },
      {
        name: '班级平均', type: 'bar', barMaxWidth: 30,
        data: data.map(d => d.classAvgScore ?? 0),
        itemStyle: { color: '#e6a23c', borderRadius: [4, 4, 0, 0] },
      },
    ],
  }
})

/** 班级对比表格数据 */
const comparisonTableData = computed(() => {
  const data = scoreCurveData.value
  if (!data.length) return []
  return data.map(d => ({
    examName: d.examName || d.sessionName || '-',
    examDate: d.examDate,
    myScore: d.scorePercentage ?? 0,
    classAvg: d.classAvgScore ?? 0,
    gap: Math.round(((d.scorePercentage ?? 0) - (d.classAvgScore ?? 0)) * 10) / 10,
    rank: d.classRank ?? null,
  })).reverse()
})

// ===== 新增：得分分布环形图 =====
const scoreDistributionOption = computed(() => {
  const results = scoredResults.value
  if (!results.length) return {}
  let excellent = 0, good = 0, pass = 0, fail = 0
  results.forEach(r => {
    const s = r.scorePercentage ?? 0
    if (s >= 90) excellent++
    else if (s >= 80) good++
    else if (s >= 60) pass++
    else fail++
  })
  return {
    tooltip: {
      trigger: 'item' as const,
      formatter: (p: any) => `${p.name}<br/>次数：${p.value} 次<br/>占比：${p.percent}%`,
    },
    legend: { bottom: 0, left: 'center', textStyle: { fontSize: 12 } },
    series: [{
      type: 'pie',
      radius: ['42%', '70%'],
      center: ['50%', '45%'],
      avoidLabelOverlap: true,
      data: [
        { value: excellent, name: `优秀 (90-100)`, itemStyle: { color: '#67c23a' } },
        { value: good, name: `良好 (80-89)`, itemStyle: { color: '#409eff' } },
        { value: pass, name: `及格 (60-79)`, itemStyle: { color: '#e6a23c' } },
        { value: fail, name: `不及格 (<60)`, itemStyle: { color: '#f56c6c' } },
      ],
      label: {
        formatter: (p: any) => `${p.name}\n${p.value}次 (${p.percent}%)`,
        fontSize: 11, lineHeight: 16,
      },
      emphasis: {
        itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.3)' },
        label: { fontSize: 13, fontWeight: 'bold' },
      },
    }],
  }
})

/** 得分分布统计摘要 */
const scoreDistributionSummary = computed(() => {
  const results = scoredResults.value
  if (!results.length) return null
  let excellent = 0, good = 0, pass = 0, fail = 0
  results.forEach(r => {
    const s = r.scorePercentage ?? 0
    if (s >= 90) excellent++
    else if (s >= 80) good++
    else if (s >= 60) pass++
    else fail++
  })
  const total = results.length
  return { excellent, good, pass, fail, total }
})
</script>

<template>
  <div class="page" v-loading="loading">
    <div class="page-header">
      <div class="page-title-wrap">
        <h3 class="page-title">📈 学习分析</h3>
        <span class="page-subtitle">成绩趋势 · 知识点雷达 · 班级对比 · 考点弱点诊断（活动流水请看首页）</span>
      </div>
      <div class="page-header-actions">
        <el-radio-group v-model="currentModule" @change="switchModule" size="small">
          <el-radio-button v-for="m in moduleOptions" :key="m.value" :value="m.value">{{ m.label }}</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <template v-if="stats">
      <!-- ====== 一句话摘要（取代原用户信息条 + KPI 四卡：身份归首页 Hero，KPI 归首页概览） ====== -->
      <!-- 切到「考点弱点/语法大类/难度分布」维度时后端不返回 exam/practice 计数，
           此处用 '—' 占位，避免把"未返回"误显示成 0。 -->
      <div class="analysis-brief">
        <span>共 <b>{{ stats.examCount ?? '—' }}</b> 场考试、<b>{{ stats.practiceCount ?? '—' }}</b> 次练习</span>
        <span class="ab-sep">·</span>
        <span>考试正确率 <b :style="{ color: accuracyColor(stats.examAccuracy) }">{{ stats.examAccuracy != null ? stats.examAccuracy.toFixed(1) + '%' : '—' }}</b></span>
        <span class="ab-sep">·</span>
        <span>去重错题 <b style="color:#f56c6c">{{ stats.distinctWrongCount ?? '—' }}</b></span>
        <span class="ab-sep" v-if="stats.tagStats?.length">·</span>
        <span v-if="stats.tagStats?.length">最弱考点 <b style="color:#e6a23c">{{ stats.tagStats[0]?.tagName }}</b></span>
      </div>

      <!-- ====== 成绩趋势图（增强版：移动平均、最值标记、及格线） ====== -->
      <el-card v-if="scoreTrendData.length >= 2" shadow="never" class="section-card">
        <template #header>
          <div style="display:flex;align-items:center;gap:8px">
            <el-icon><TrendCharts /></el-icon>
            <span>成绩趋势（最近 {{ scoreTrendData.length }} 场 · 含移动均分/及格线/最值标记）</span>
          </div>
        </template>
        <VChart :option="scoreTrendOption" autoresize style="height:320px" />
      </el-card>

      <!-- ====== 新增：知识点掌握雷达图 + 得分分布环形图 ====== -->
      <el-row :gutter="16">
        <el-col v-if="radarChartOption.series" :span="14">
          <el-card shadow="never" class="section-card">
            <template #header>
              <div style="display:flex;align-items:center;gap:8px">
                <el-icon><DataAnalysis /></el-icon>
                <span>知识点掌握程度雷达图</span>
                <el-tag size="small" type="info">班级平均正确率 {{ classAvgAccuracy }}%</el-tag>
              </div>
            </template>
            <VChart :option="radarChartOption" autoresize style="height:360px" />
            <!-- 色彩分区图例 -->
            <div class="radar-legend">
              <span class="rl-item"><i class="rl-dot" style="background:#f56c6c"></i>薄弱 (&lt;40%)</span>
              <span class="rl-item"><i class="rl-dot" style="background:#e6a23c"></i>一般 (40-70%)</span>
              <span class="rl-item"><i class="rl-dot" style="background:#67c23a"></i>良好 (&gt;70%)</span>
            </div>
          </el-card>
        </el-col>
        <el-col v-if="scoreDistributionOption.series" :span="10">
          <el-card shadow="never" class="section-card">
            <template #header>得分分布图（共 {{ scoreDistributionSummary?.total ?? 0 }} 场考试）</template>
            <VChart :option="scoreDistributionOption" autoresize style="height:360px" />
            <div class="dist-summary" v-if="scoreDistributionSummary">
              <div class="ds-item ds-excellent">
                <div class="ds-num">{{ scoreDistributionSummary.excellent }}</div>
                <div class="ds-lbl">优秀</div>
              </div>
              <div class="ds-item ds-good">
                <div class="ds-num">{{ scoreDistributionSummary.good }}</div>
                <div class="ds-lbl">良好</div>
              </div>
              <div class="ds-item ds-pass">
                <div class="ds-num">{{ scoreDistributionSummary.pass }}</div>
                <div class="ds-lbl">及格</div>
              </div>
              <div class="ds-item ds-fail">
                <div class="ds-num">{{ scoreDistributionSummary.fail }}</div>
                <div class="ds-lbl">不及格</div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- ====== 新增：与班级平均水平对比 ====== -->
      <el-card v-if="classComparisonOption.series" shadow="never" class="section-card">
        <template #header>
          <div style="display:flex;align-items:center;gap:8px">
            <el-icon><TrendCharts /></el-icon>
            <span>与班级平均水平对比</span>
          </div>
        </template>
        <VChart :option="classComparisonOption" autoresize style="height:300px" />
        <!-- 对比明细表格 -->
        <el-table :data="comparisonTableData" size="small" style="margin-top:14px" stripe>
          <el-table-column prop="examName" label="考试名称" min-width="150" show-overflow-tooltip />
          <el-table-column prop="examDate" label="日期" width="110" />
          <el-table-column label="我的分数" width="100" align="center">
            <template #default="{ row }">
              <span :style="{ color: accuracyColor(row.myScore), fontWeight: 600 }">{{ row.myScore.toFixed(1) }}%</span>
            </template>
          </el-table-column>
          <el-table-column label="班级平均" width="100" align="center">
            <template #default="{ row }">{{ row.classAvg.toFixed(1) }}%</template>
          </el-table-column>
          <el-table-column label="差距" width="100" align="center">
            <template #default="{ row }">
              <span :style="{ color: row.gap >= 0 ? '#67c23a' : '#f56c6c', fontWeight: 600 }">
                {{ row.gap >= 0 ? '+' : '' }}{{ row.gap.toFixed(1) }}%
              </span>
            </template>
          </el-table-column>
          <el-table-column label="班级排名" width="90" align="center">
            <template #default="{ row }">
              <span v-if="row.rank" :style="{ color: row.rank <= 3 ? '#e6a23c' : '#606266', fontWeight: 600 }">第{{ row.rank }}名</span>
              <span v-else style="color:#c0c4cc">-</span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- ====== 图表区 ====== -->
      <el-row :gutter="16">
        <el-col v-if="categoryChartOption.series" :span="12">
          <el-card shadow="never" class="section-card">
            <template #header>📊 各语法大类正确率</template>
            <VChart :option="categoryChartOption" autoresize style="height:300px" />
          </el-card>
        </el-col>
        <el-col v-if="difficultyChartOption.series" :span="12">
          <el-card shadow="never" class="section-card">
            <template #header>🎯 按难度正确率</template>
            <VChart :option="difficultyChartOption" autoresize style="height:300px" />
          </el-card>
        </el-col>
      </el-row>

      <!-- ====== 考点弱点 + 训练计划 ====== -->
      <el-row :gutter="16">
        <el-col v-if="tagChartOption.series" :span="14">
          <el-card shadow="never" class="section-card">
            <template #header>⚠️ 考点弱点排行（Top {{ Math.min(stats.tagStats?.length ?? 0, 15) }}）</template>
            <VChart :option="tagChartOption" autoresize style="height:340px" />
          </el-card>
        </el-col>
        <el-col :span="tagChartOption.series ? 10 : 24">
          <el-card v-if="stats.trainingSchedule || stats.trainedDays != null" shadow="never" class="section-card">
            <template #header>📅 训练计划</template>
            <div class="training-grid">
              <div class="tg-item"><div class="tg-label">训练日</div><div class="tg-value">{{ trainingDaysText }}</div></div>
              <div class="tg-item" v-if="stats.trainingSchedule?.trainingTimeFrom"><div class="tg-label">每日时段</div><div class="tg-value">{{ stats.trainingSchedule.trainingTimeFrom }} ~ {{ stats.trainingSchedule.trainingTimeTo }}</div></div>
              <div class="tg-item" v-if="stats.trainingSchedule?.trainingTargetHours"><div class="tg-label">目标时长</div><div class="tg-value">{{ stats.trainingSchedule.trainingTargetHours }} 小时</div></div>
              <div class="tg-item"><div class="tg-label">已训练</div><div class="tg-value">{{ stats.trainedDays ?? 0 }} 天</div></div>
              <div class="tg-item"><div class="tg-label">剩余</div><div class="tg-value" style="color:#e6a23c">{{ stats.daysRemaining ?? '-' }} 天</div></div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- [2026-10-17 职责划分] 「最近练习记录」「最近考试记录」已移出本页 ——
           活动流水属于首页「考试与练习」Tab，本页只做诊断分析，不重复摆流水。 -->

      <!-- ====== 考点弱点明细表 ====== -->
      <el-card shadow="never" class="section-card" v-if="stats.tagStats?.length">
        <template #header>📋 考点弱点明细（共 {{ stats.tagStats.length }} 个考点）</template>
        <el-table :data="stats.tagStats" size="small">
          <el-table-column type="index" label="#" width="50" />
          <el-table-column prop="tagName" label="考点名称" min-width="150" />
          <el-table-column prop="total" label="总题数" width="80" align="center" />
          <el-table-column prop="wrong" label="错题数" width="80" align="center">
            <template #default="{ row }"><span style="color:#f56c6c;font-weight:600">{{ row.wrong }}</span></template>
          </el-table-column>
          <el-table-column label="错误率" width="160" align="center">
            <template #default="{ row }">
              <el-progress :percentage="Math.min(row.errorRate, 100)" :stroke-width="14" :color="row.errorRate <= 20 ? '#67c23a' : row.errorRate <= 50 ? '#e6a23c' : '#f56c6c'" />
            </template>
          </el-table-column>
          <el-table-column prop="errorRate" label="错误率" width="80" align="center">
            <template #default="{ row }"><span :style="{ color: accuracyColor(100 - row.errorRate), fontWeight: 600 }">{{ row.errorRate.toFixed(1) }}%</span></template>
          </el-table-column>
        </el-table>
      </el-card>
    </template>

    <el-empty v-else-if="!loading" description="暂无统计数据" :image-size="100" />
  </div>
</template>

<style scoped lang="scss">
.page { display: flex; flex-direction: column; gap: 14px; padding: 4px; }
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; gap: 16px; flex-wrap: wrap; }
.page-title-wrap { display: flex; flex-direction: column; gap: 3px; }
.page-title { margin: 0; font-size: 18px; font-weight: 600; color: #303133; }
.page-subtitle { font-size: 12px; color: #909399; }

.section-card {
  border-radius: 8px;
  :deep(.el-card__header) { padding: 12px 20px; font-weight: 600; font-size: 14px; }
}

/* 一句话摘要（取代原用户信息条 + KPI 四卡） */
.analysis-brief {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  background: #f7f9fc; border: 1px solid #ebeef5; border-radius: 8px;
  padding: 10px 16px; font-size: 13px; color: #606266;
  b { font-weight: 600; color: #303133; }
  .ab-sep { color: #dcdfe6; }
}

.page-header-actions { display: flex; align-items: center; gap: 16px; }

// Training
.training-grid { display: flex; gap: 28px; flex-wrap: wrap; }
.tg-item { text-align: center; }
.tg-label { font-size: 12px; color: #909399; margin-bottom: 4px; }
.tg-value { font-size: 15px; font-weight: 600; color: #303133; }

// ===== 新增：雷达图图例 =====
.radar-legend {
  display: flex; justify-content: center; gap: 20px; margin-top: 10px;
  .rl-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #606266; }
  .rl-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
}

// ===== 新增：得分分布摘要 =====
.dist-summary {
  display: flex; justify-content: space-around; margin-top: 14px; padding: 10px 0;
  border-top: 1px solid #ebeef5;
  .ds-item { text-align: center; }
  .ds-num { font-size: 22px; font-weight: 700; line-height: 1.3; }
  .ds-lbl { font-size: 12px; color: #909399; margin-top: 2px; }
  .ds-excellent .ds-num { color: #67c23a; }
  .ds-good .ds-num { color: #409eff; }
  .ds-pass .ds-num { color: #e6a23c; }
  .ds-fail .ds-num { color: #f56c6c; }
}
</style>
