<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, PieChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'
import { DataAnalysis, Histogram, Trophy, Warning, Menu, PieChart as PieIcon } from '@element-plus/icons-vue'
import { getQuestionAnalytics, listCategoryTree } from '@/api/admin'
import type { QuestionAnalytics } from '@/types/admin'
import type { Category } from '@/types/category'
import type { QuestionType } from '@/types/common'

use([CanvasRenderer, BarChart, PieChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent])

const categoryId = ref<number | undefined>(undefined)
const categories = ref<Category[]>([])
const data = ref<QuestionAnalytics | null>(null)
const loading = ref(false)

const load = async () => {
  loading.value = true
  try {
    const res = await getQuestionAnalytics(categoryId.value)
    data.value = res.data
  } catch { /* handled */ } finally { loading.value = false }
}

watch(categoryId, () => load())

onMounted(async () => {
  try {
    const c = await listCategoryTree()
    categories.value = c.data ?? []
  } catch { /* silent */ }
  load()
})

const kpi = computed(() => data.value?.kpi ?? {
  totalQuestions: 0, attemptedQuestions: 0, neverAttempted: 0,
  totalAttempts: 0, totalCorrect: 0, overallAccuracy: 0, categoryCount: 0, typeCount: 0,
})
const pct = (a: number, b: number) => (b > 0 ? ((a / b) * 100).toFixed(1) : '0.0')
const accColor = (a: number) => (a >= 80 ? '#67c23a' : a >= 60 ? '#e6a23c' : '#f56c6c')
const typeLabel = (t: QuestionType | string) =>
  ({ SINGLE: '单选', MULTIPLE: '多选', JUDGE: '判断', FILL_HINT: '填空', READING: '阅读' } as Record<string, string>)[t] || t
const diffLabel = (d: number) => (d === 1 ? '简单' : d === 2 ? '中等' : '困难')
const diffTagType = (d: number) => (d === 1 ? 'success' : d === 2 ? 'warning' : 'danger')

/* ---------------- 图表 ---------------- */
const GRID = { left: 52, right: 24, bottom: 56, top: 46 }
const AXIS_LINE = { lineStyle: { color: '#dcdfe6' } }
const xCat = (labels: string[], label: Record<string, unknown> = {}) => ({
  type: 'category', data: labels, axisLine: AXIS_LINE, axisLabel: { color: '#606266', ...label },
})
const yVal = (name: string) => ({
  type: 'value', name, max: 100, axisLine: AXIS_LINE, axisLabel: { color: '#606266' },
})

const byCategoryOption = computed(() => {
  const rows = data.value?.categoryStats ?? []
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: xCat(rows.map((r) => r.categoryName), { rotate: rows.length > 8 ? 40 : 0, interval: 0, fontSize: 11 }),
    yAxis: yVal('正确率 %'),
    series: [{
      type: 'bar', barMaxWidth: 26,
      data: rows.map((r) => ({ value: Number(r.accuracy.toFixed(1)), itemStyle: { color: accColor(r.accuracy) } })),
      itemStyle: { borderRadius: [5, 5, 0, 0] },
      label: { show: true, position: 'top', fontSize: 10, formatter: '{c}%' },
    }],
    grid: { ...GRID, bottom: rows.length > 8 ? 84 : 56 },
  }
})

const byDifficultyOption = computed(() => {
  const rows = data.value?.difficultyStats ?? []
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: xCat(rows.map((r) => r.label || diffLabel(r.difficulty))),
    yAxis: yVal('正确率 %'),
    series: [{
      type: 'bar', barMaxWidth: 48,
      data: rows.map((r) => ({
        value: Number(r.accuracy.toFixed(1)),
        itemStyle: { color: r.difficulty === 1 ? '#67c23a' : r.difficulty === 2 ? '#e6a23c' : '#f56c6c', borderRadius: [6, 6, 0, 0] },
      })),
      label: { show: true, position: 'top', formatter: '{c}%' },
    }],
    grid: GRID,
  }
})

const byTypeOption = computed(() => {
  const rows = data.value?.typeStats ?? []
  const palette = ['#409eff', '#7c5cff', '#36cfc9', '#e6a23c', '#f56c6c', '#909399']
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: xCat(rows.map((r) => r.label)),
    yAxis: yVal('正确率 %'),
    series: [{
      type: 'bar', barMaxWidth: 44,
      data: rows.map((r, i) => ({ value: Number(r.accuracy.toFixed(1)), itemStyle: { color: palette[i % palette.length], borderRadius: [6, 6, 0, 0] } })),
      label: { show: true, position: 'top', formatter: '{c}%' },
    }],
    grid: GRID,
  }
})

const bucketOption = computed(() => {
  const rows = data.value?.accuracyBuckets ?? []
  const palette = ['#f56c6c', '#f5a623', '#e6a23c', '#95d475', '#67c23a']
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 题 ({d}%)' },
    legend: { bottom: 0, icon: 'circle', textStyle: { fontSize: 12 } },
    series: [{
      type: 'pie', radius: ['42%', '68%'], center: ['50%', '46%'], avoidLabelOverlap: true,
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      label: { formatter: '{b}\n{c} 题' },
      data: rows.map((r, i) => ({ name: r.label, value: r.count, itemStyle: { color: palette[i % palette.length] } })),
    }],
  }
})

const bySubtypeOption = computed(() => {
  const rows = data.value?.subtypeStats ?? []
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: xCat(rows.map((r) => r.label), { interval: 0, rotate: rows.length > 8 ? 30 : 0, fontSize: 11 }),
    yAxis: yVal('正确率 %'),
    series: [{
      type: 'bar', barMaxWidth: 30,
      data: rows.map((r) => ({ value: Number(r.accuracy.toFixed(1)), itemStyle: { color: accColor(r.accuracy) } })),
      itemStyle: { borderRadius: [5, 5, 0, 0] },
      label: { show: true, position: 'top', fontSize: 10, formatter: '{c}%' },
    }],
    grid: { ...GRID, bottom: rows.length > 8 ? 74 : 56 },
  }
})

/* ---------------- 难题 / 易题 ---------------- */
const sortedByAcc = computed(() => [...(data.value?.questions ?? [])].sort((a, b) => a.accuracy - b.accuracy))
const worstQuestions = computed(() => sortedByAcc.value.slice(0, 10))
const bestQuestions = computed(() => [...sortedByAcc.value].reverse().slice(0, 10))
</script>

<template>
  <div class="page" v-loading="loading">
    <div class="page-header">
      <div class="ph-left">
        <div class="ph-icon"><el-icon :size="22"><DataAnalysis /></el-icon></div>
        <div>
          <h2 class="ph-title">题目质量分析</h2>
          <p class="ph-sub">按 分类 / 难度 / 题型 / 阅读子题型 多维统计正确率，定位难题与易题</p>
        </div>
      </div>
      <el-cascader
        v-model="categoryId"
        :options="categories"
        :props="{ value: 'id', label: 'categoryName', children: 'children', checkStrictly: true, emitPath: false }"
        clearable placeholder="全部分类" style="width: 220px"
      />
    </div>

    <el-empty v-if="!loading && !data?.kpi?.totalQuestions" description="暂无答题数据" />

    <template v-else-if="data">
      <!-- KPI -->
      <div class="kpi-grid">
        <div class="kpi-card k-blue">
          <div class="kpi-ico"><el-icon :size="20"><Histogram /></el-icon></div>
          <div class="kpi-label">题目总数</div>
          <div class="kpi-value">{{ kpi.totalQuestions }}</div>
          <div class="kpi-foot">{{ kpi.categoryCount }} 个分类 · {{ kpi.typeCount }} 种题型</div>
        </div>
        <div class="kpi-card k-green">
          <div class="kpi-ico"><el-icon :size="20"><Trophy /></el-icon></div>
          <div class="kpi-label">整体正确率</div>
          <div class="kpi-value">{{ kpi.overallAccuracy }}<span class="unit">%</span></div>
          <div class="kpi-foot">答对 {{ kpi.totalCorrect }} / 作答 {{ kpi.totalAttempts }}</div>
        </div>
        <div class="kpi-card k-cyan">
          <div class="kpi-ico"><el-icon :size="20"><Menu /></el-icon></div>
          <div class="kpi-label">已作答题目</div>
          <div class="kpi-value">{{ kpi.attemptedQuestions }}</div>
          <div class="kpi-foot">占全部 {{ pct(kpi.attemptedQuestions, kpi.totalQuestions) }}%</div>
        </div>
        <div class="kpi-card k-orange">
          <div class="kpi-ico"><el-icon :size="20"><Warning /></el-icon></div>
          <div class="kpi-label">未作答题目</div>
          <div class="kpi-value">{{ kpi.neverAttempted }}</div>
          <div class="kpi-foot">占全部 {{ pct(kpi.neverAttempted, kpi.totalQuestions) }}%</div>
        </div>
      </div>

      <!-- 图表区 -->
      <el-row :gutter="14">
        <el-col :md="14" :xs="24">
          <el-card shadow="never" class="chart-card">
            <template #header><span class="card-title">各分类正确率</span></template>
            <v-chart :option="byCategoryOption" style="height: 320px" autoresize />
          </el-card>
        </el-col>
        <el-col :md="10" :xs="24">
          <el-card shadow="never" class="chart-card">
            <template #header><span class="card-title">各难度正确率</span></template>
            <v-chart :option="byDifficultyOption" style="height: 320px" autoresize />
          </el-card>
        </el-col>
      </el-row>

      <el-row :gutter="14">
        <el-col :md="10" :xs="24">
          <el-card shadow="never" class="chart-card">
            <template #header><span class="card-title">各题型正确率</span></template>
            <v-chart :option="byTypeOption" style="height: 300px" autoresize />
          </el-card>
        </el-col>
        <el-col :md="14" :xs="24">
          <el-card shadow="never" class="chart-card">
            <template #header><span class="card-title">正确率区间分布（有作答的题）</span></template>
            <v-chart :option="bucketOption" style="height: 300px" autoresize />
          </el-card>
        </el-col>
      </el-row>

      <el-card v-if="(data.subtypeStats?.length ?? 0) > 0" shadow="never" class="chart-card">
        <template #header><span class="card-title"><el-icon><PieIcon /></el-icon> 阅读子题型正确率</span></template>
        <v-chart :option="bySubtypeOption" style="height: 300px" autoresize />
      </el-card>

      <!-- 分类聚合 -->
      <el-card shadow="never">
        <template #header><span class="card-title"><el-icon><Menu /></el-icon> 分类聚合</span></template>
        <el-table :data="data.categoryStats" style="width:100%" stripe>
          <el-table-column prop="categoryName" label="分类" min-width="140" />
          <el-table-column prop="questionCount" label="题量" width="90" align="center" />
          <el-table-column prop="totalAttempts" label="作答次数" width="110" align="center" />
          <el-table-column label="答对" width="90" align="center"><template #default="{ row }"><span style="color:#67c23a">{{ row.totalCorrect }}</span></template></el-table-column>
          <el-table-column label="答错" width="90" align="center"><template #default="{ row }"><span style="color:#f56c6c">{{ row.totalAttempts - row.totalCorrect }}</span></template></el-table-column>
          <el-table-column label="正确率" min-width="200">
            <template #default="{ row }"><el-progress :percentage="Number(row.accuracy.toFixed(1))" :color="accColor(row.accuracy)" :stroke-width="16" /></template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 题型聚合 -->
      <el-card shadow="never" v-if="(data.typeStats?.length ?? 0) > 0">
        <template #header><span class="card-title"><el-icon><Histogram /></el-icon> 题型聚合</span></template>
        <el-table :data="data.typeStats" style="width:100%" stripe>
          <el-table-column prop="label" label="题型" min-width="120" />
          <el-table-column prop="questionCount" label="题量" width="90" align="center" />
          <el-table-column prop="totalAttempts" label="作答次数" width="110" align="center" />
          <el-table-column label="答对" width="90" align="center"><template #default="{ row }"><span style="color:#67c23a">{{ row.totalCorrect }}</span></template></el-table-column>
          <el-table-column label="答错" width="90" align="center"><template #default="{ row }"><span style="color:#f56c6c">{{ row.totalAttempts - row.totalCorrect }}</span></template></el-table-column>
          <el-table-column label="正确率" min-width="200">
            <template #default="{ row }"><el-progress :percentage="Number(row.accuracy.toFixed(1))" :color="accColor(row.accuracy)" :stroke-width="16" /></template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 阅读子题型聚合 -->
      <el-card shadow="never" v-if="(data.subtypeStats?.length ?? 0) > 0">
        <template #header><span class="card-title"><el-icon><PieIcon /></el-icon> 阅读子题型聚合</span></template>
        <el-table :data="data.subtypeStats" style="width:100%" stripe>
          <el-table-column prop="label" label="子题型" min-width="120" />
          <el-table-column prop="questionCount" label="题量" width="90" align="center" />
          <el-table-column prop="totalAttempts" label="作答次数" width="110" align="center" />
          <el-table-column label="答对" width="90" align="center"><template #default="{ row }"><span style="color:#67c23a">{{ row.totalCorrect }}</span></template></el-table-column>
          <el-table-column label="正确率" min-width="200">
            <template #default="{ row }"><el-progress :percentage="Number(row.accuracy.toFixed(1))" :color="accColor(row.accuracy)" :stroke-width="16" /></template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 难题 / 易题 -->
      <el-row :gutter="14">
        <el-col :md="12" :xs="24">
          <el-card shadow="never" class="chart-card">
            <template #header><span class="card-title"><el-icon><Warning /></el-icon> 最难题目 Top 10</span></template>
            <el-table :data="worstQuestions" style="width:100%">
              <el-table-column type="index" label="#" width="50" />
              <el-table-column prop="stemPreview" label="题干" min-width="220" show-overflow-tooltip />
              <el-table-column label="题型" width="80" align="center"><template #default="{ row }">{{ typeLabel(row.questionType) }}</template></el-table-column>
              <el-table-column label="难度" width="76" align="center"><template #default="{ row }"><el-tag :type="diffTagType(row.difficulty)" size="small">{{ diffLabel(row.difficulty) }}</el-tag></template></el-table-column>
              <el-table-column label="正确率" width="120" align="center">
                <template #default="{ row }"><span :style="{ color: accColor(row.accuracy), fontWeight: 600 }">{{ row.accuracy.toFixed(1) }}%</span><span style="color:#909399"> ({{ row.correctCount }}/{{ row.attemptCount }})</span></template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
        <el-col :md="12" :xs="24">
          <el-card shadow="never" class="chart-card">
            <template #header><span class="card-title"><el-icon><Trophy /></el-icon> 最易题目 Top 10</span></template>
            <el-table :data="bestQuestions" style="width:100%">
              <el-table-column type="index" label="#" width="50" />
              <el-table-column prop="stemPreview" label="题干" min-width="220" show-overflow-tooltip />
              <el-table-column label="题型" width="80" align="center"><template #default="{ row }">{{ typeLabel(row.questionType) }}</template></el-table-column>
              <el-table-column label="难度" width="76" align="center"><template #default="{ row }"><el-tag :type="diffTagType(row.difficulty)" size="small">{{ diffLabel(row.difficulty) }}</el-tag></template></el-table-column>
              <el-table-column label="正确率" width="120" align="center">
                <template #default="{ row }"><span :style="{ color: accColor(row.accuracy), fontWeight: 600 }">{{ row.accuracy.toFixed(1) }}%</span><span style="color:#909399"> ({{ row.correctCount }}/{{ row.attemptCount }})</span></template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
      </el-row>
    </template>
  </div>
</template>

<style scoped lang="scss">
.page { display: flex; flex-direction: column; gap: 14px; }

.page-header {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 16px 20px; border-radius: 12px;
  background: linear-gradient(120deg, #eef4ff 0%, #f5f0ff 100%);
  border: 1px solid #e4ebf7;
}
.ph-left { display: flex; align-items: center; gap: 14px; }
.ph-icon {
  width: 46px; height: 46px; border-radius: 12px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; color: #fff;
  background: linear-gradient(135deg, #409eff, #7c5cff);
  box-shadow: 0 6px 14px rgba(64, 158, 255, 0.28);
}
.ph-title { margin: 0; font-size: 19px; font-weight: 700; color: #1f2d3d; letter-spacing: 0.5px; }
.ph-sub { margin: 4px 0 0; font-size: 13px; color: #7a8699; }

/* KPI */
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; }
.kpi-card {
  position: relative; padding: 16px 18px; border-radius: 12px; color: #fff; overflow: hidden;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}
.kpi-card .kpi-ico { position: absolute; right: 14px; top: 14px; opacity: 0.55; }
.kpi-label { font-size: 13px; opacity: 0.92; }
.kpi-value { font-size: 30px; font-weight: 800; line-height: 1.2; margin-top: 2px; letter-spacing: 0.5px; }
.kpi-value .unit { font-size: 16px; font-weight: 600; margin-left: 2px; }
.kpi-foot { margin-top: 6px; font-size: 12px; opacity: 0.9; }
.k-blue { background: linear-gradient(135deg, #3b82f6, #6366f1); }
.k-green { background: linear-gradient(135deg, #10b981, #34d399); }
.k-cyan { background: linear-gradient(135deg, #06b6d4, #22d3ee); }
.k-orange { background: linear-gradient(135deg, #f59e0b, #fbbf24); }

.chart-card { border-radius: 10px; }
.card-title { font-weight: 600; font-size: 14px; color: #1f2d3d; display: inline-flex; align-items: center; gap: 6px; }
</style>
