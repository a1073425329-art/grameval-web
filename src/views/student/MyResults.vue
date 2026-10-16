<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { List, Grid, Cpu } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getMyResults, getMySummary, getResultDetail } from '@/api/student'
import type { ResultSummary, ExamResultItem, ResultDetail } from '@/types/result'
import type { AnswerDetail } from '@/types/exam'
import type { QuestionType, Difficulty } from '@/types/common'
import { useViewMode } from '@/composables/useViewMode'
import { useAuthStore } from '@/stores/auth'
// [2026-10-16 性能修复] 原来是 `import * as echarts from 'echarts'`（全量引入）。
// 项目里另外 8 个用图表的页面都已按需引入（echarts/core + 具体 charts/components），
// 唯独这一处全量，会让 rollup 把**所有**图表类型与组件都打进 echarts chunk
// （实测 1162 KB / gzip 385 KB）。本页只用到折线图与堆叠柱状图，改为按需后其余类型可被摇掉。
import * as echarts from 'echarts/core'
import type { ECharts } from 'echarts/core'
import { LineChart, BarChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([LineChart, BarChart, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer])

const router = useRouter()
const authStore = useAuthStore()
const { viewMode, toggleViewMode } = useViewMode('my_results')

const summary = ref<ResultSummary>({
  totalCount: 0,
  averageScore: 0,
  highestScore: 0,
  lowestScore: 0,
  totalAccuracy: 0,
})
const list = ref<ExamResultItem[]>([])
const total = ref(0)
const loading = ref(false)

const query = reactive({
  keyword: '',
  isPass: undefined as boolean | undefined,
  minScore: undefined as number | undefined,
  maxScore: undefined as number | undefined,
  pageNum: 1,
  pageSize: 50,
})

const load = async () => {
  loading.value = true
  try {
    const [s, l] = await Promise.allSettled([
      getMySummary(),
      getMyResults({
        pageNum: query.pageNum,
        pageSize: query.pageSize,
        keyword: query.keyword || undefined,
        isPass: query.isPass,
        minScore: query.minScore,
        maxScore: query.maxScore,
      }),
    ])
    if (s.status === 'fulfilled') summary.value = s.value.data
    if (l.status === 'fulfilled') {
      list.value = l.value.data.records ?? []
      total.value = l.value.data.total ?? 0
      // 新增：列表加载后渲染趋势迷你图
      await nextTick()
      renderTrendChart()
    }
  } finally {
    loading.value = false
  }
}

const search = () => { query.pageNum = 1; load() }
const reset = () => { query.keyword = ''; query.isPass = undefined; query.minScore = undefined; query.maxScore = undefined; query.pageNum = 1; load() }

/** 用百分制成绩上色 */
const scoreColor = (row: ExamResultItem) => {
  const pct = row.scorePercentage ?? 0
  if (pct >= 80) return '#67c23a'
  if (pct >= 60) return '#e6a23c'
  return '#f56c6c'
}

const durationText = (row: ExamResultItem) =>
  row.durationSeconds ? `${Math.round(row.durationSeconds / 60)} 分钟` : '-'

/* ============================================================ *
 *  新增：题型 / 难度 文案
 * ============================================================ */
const typeLabel = (t?: QuestionType) =>
  ({ SINGLE: '单选', MULTIPLE: '多选', JUDGE: '判断', FILL: '填空', FILL_HINT: '填空', READING: '阅读理解' } as Record<string, string>)[t || ''] || t || '-'

const difficultyLabel = (d?: Difficulty) => {
  if (d === 1) return { text: '简单', color: '#67c23a' }
  if (d === 2) return { text: '中等', color: '#e6a23c' }
  if (d === 3) return { text: '困难', color: '#f56c6c' }
  return { text: '-', color: '#909399' }
}

/* ============================================================ *
 *  新增：成绩趋势迷你图（sparkline）
 * ============================================================ */
const trendChartRef = ref<HTMLElement | null>(null)
let trendChart: ECharts | null = null

const trendData = computed(() =>
  [...list.value].reverse().slice(0, 12).map(r => ({
    name: r.sessionName || '-',
    score: r.scorePercentage ?? 0,
    date: (r.submitTime || '').slice(0, 10),
  }))
)

const renderTrendChart = () => {
  if (!trendChartRef.value) return
  if (!trendChart) trendChart = echarts.init(trendChartRef.value)
  const data = trendData.value
  if (!data.length) {
    trendChart.clear()
    return
  }
  trendChart.setOption({
    tooltip: {
      trigger: 'axis',
      formatter: (p: any) => {
const item = data[p[0].dataIndex]
        if (!item) return ''
        return `${item.date}<br/>${item.name}<br/>得分率：${p[0].value.toFixed(1)}%`
      },
    },
    grid: { left: 36, right: 12, top: 10, bottom: 24 },
    xAxis: {
      type: 'category',
      data: data.map(d => d.date),
      axisLabel: { fontSize: 10, color: '#909399', rotate: 0 },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#ebeef5' } },
    },
    yAxis: {
      type: 'value', min: 0, max: 100,
      axisLabel: { fontSize: 10, color: '#909399', formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#f0f2f5' } },
    },
    series: [{
      type: 'line', smooth: true, data: data.map(d => d.score),
      symbol: 'circle', symbolSize: 5,
      lineStyle: { color: '#409eff', width: 2.5 },
      itemStyle: { color: '#409eff', borderColor: '#fff', borderWidth: 1 },
      areaStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
          { offset: 0, color: 'rgba(64,158,255,0.35)' },
          { offset: 1, color: 'rgba(64,158,255,0.02)' },
        ] },
      },
      markLine: { silent: true, symbol: 'none', data: [{ type: 'average', name: '均分', lineStyle: { color: '#e6a23c', type: 'dashed' } }] },
    }],
  })
}

/* ============================================================ *
 *  新增：详细成绩分析（展开行，懒加载 ResultDetail）
 * ============================================================ */
const expandedDetails = ref<Record<number, ResultDetail>>({})
const detailLoadingMap = reactive<Record<number, boolean>>({})
const cardExpanded = reactive<Record<number, boolean>>({})

const loadDetail = async (row: ExamResultItem) => {
  const key = row.examId ?? row.id
  if (expandedDetails.value[key] || detailLoadingMap[key]) return
  detailLoadingMap[key] = true
  try {
    const res = await getResultDetail(key)
    expandedDetails.value = { ...expandedDetails.value, [key]: res.data }
    await nextTick()
    renderDistChart(key, res.data.answers)
  } catch {
    ElMessage.error('明细加载失败')
  } finally {
    detailLoadingMap[key] = false
  }
}

/** 表格展开/收起事件 */
const onExpandChange = (row: ExamResultItem, expanded: ExamResultItem[]) => {
  if (expanded.some(r => (r.examId ?? r.id) === (row.examId ?? row.id))) {
    loadDetail(row)
  }
}

/** 卡片视图展开明细 */
const toggleCardDetail = (row: ExamResultItem) => {
  const key = row.examId ?? row.id
  cardExpanded[key] = !cardExpanded[key]
  if (cardExpanded[key]) loadDetail(row)
}

/* ============================================================ *
 *  新增：得分分布图（按题型 堆叠柱：正确/错误）
 * ============================================================ */
const distCharts = new Map<number, ECharts>()

const renderDistChart = (key: number, answers: AnswerDetail[] = []) => {
  const el = document.getElementById(`dist-chart-${key}`)
  if (!el || !answers.length) return
  let chart = distCharts.get(key)
  if (!chart) {
    chart = echarts.init(el)
    distCharts.set(key, chart)
  }
  // 按题型聚合
  const groups: Record<string, { correct: number; wrong: number; unanswered: number }> = {}
  answers.forEach(a => {
    const t = typeLabel(a.questionType)
    if (!groups[t]) groups[t] = { correct: 0, wrong: 0, unanswered: 0 }
    if (a.isCorrect === 1) groups[t].correct++
    else if (a.isCorrect === 0) groups[t].wrong++
    else groups[t].unanswered++
  })
  const labels = Object.keys(groups)
  chart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['正确', '错误', '未答'], top: 0, textStyle: { fontSize: 11 } },
    grid: { left: 32, right: 16, top: 28, bottom: 24 },
    xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 11 } },
    yAxis: { type: 'value', minInterval: 1, axisLabel: { fontSize: 11 } },
    series: [
      { name: '正确', type: 'bar', stack: 't', data: labels.map(l => groups[l]?.correct ?? 0), itemStyle: { color: '#67c23a' }, barMaxWidth: 36 },
      { name: '错误', type: 'bar', stack: 't', data: labels.map(l => groups[l]?.wrong ?? 0), itemStyle: { color: '#f56c6c' }, barMaxWidth: 36 },
      { name: '未答', type: 'bar', stack: 't', data: labels.map(l => groups[l]?.unanswered ?? 0), itemStyle: { color: '#c0c4cc' }, barMaxWidth: 36 },
    ],
  })
}

/* ============================================================ *
 *  新增：错题解析入口 + 单条成绩导出
 * ============================================================ */
const goWrongAnalysis = (_row: ExamResultItem) => {
  // 跳转错题本页面（按考试来源筛选）
  router.push({ path: '/student/wrong-book', query: { source: 'EXAM' } })
}

const exportDetail = async (row: ExamResultItem) => {
  const key = row.examId ?? row.id
  let detail = expandedDetails.value[key]
  if (!detail) {
    try {
      const res = await getResultDetail(key)
      detail = res.data
      expandedDetails.value = { ...expandedDetails.value, [key]: detail }
    } catch {
      ElMessage.error('加载明细失败，无法导出')
      return
    }
  }
  const head = ['题号', '题型', '难度', '题干', '你的答案', '正确答案', '得分', '满分', '对错', '解析']
  const rows = (detail.answers || []).map((a, i) => [
    i + 1,
    typeLabel(a.questionType),
    difficultyLabel(a.difficulty).text,
    (a.stem || '').replace(/\s+/g, ' '),
    a.userAnswer || '（未作答）',
    a.standardAnswer || '-',
    a.obtainedScore ?? '-',
    a.questionScore ?? '-',
    a.isCorrect === 1 ? '正确' : a.isCorrect === 0 ? '错误' : '未阅卷',
    (a.analysis || '').replace(/\s+/g, ' '),
  ])
  const csv = [head, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  // 加 BOM 防止 Excel 中文乱码
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${row.sessionName || '考试'}_成绩明细.csv`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('已导出成绩明细')
}

const answerDisplay = (a?: string) => (a === undefined || a === null || a === '' ? '（未作答）' : a)

onMounted(load)

onBeforeUnmount(() => {
  trendChart?.dispose()
  distCharts.forEach(c => c.dispose())
  distCharts.clear()
})
</script>

<template>
  <div class="page">
    <!-- 汇总卡片 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-label">考试次数</div>
          <div class="stat-value">{{ summary.totalCount }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-label">平均分</div>
          <div class="stat-value">{{ (summary.averageScore ?? 0).toFixed(1) }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-label">最高分</div>
          <div class="stat-value" style="color:#67c23a">{{ summary.highestScore }}</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-label">总正确率</div>
          <div class="stat-value" style="color:#409eff">{{ (summary.totalAccuracy ?? 0).toFixed(1) }}%</div>
        </div>
      </el-col>
    </el-row>

    <!-- 新增：成绩趋势迷你图 + 学生头像 -->
    <el-card shadow="never" class="trend-card">
      <div class="trend-header">
        <div class="th-left">
          <el-avatar :size="36" :src="authStore.userInfo?.avatar || '/avatars/student.jpg'">
            <el-icon><UserFilled /></el-icon>
          </el-avatar>
          <div>
            <div class="th-title">近期成绩趋势</div>
            <div class="th-sub">{{ authStore.userInfo?.displayName || authStore.userInfo?.username || '同学' }} · 最近 {{ trendData.length }} 次考试得分率</div>
          </div>
        </div>
        <div class="th-legend">
          <span><i class="lc lc-blue"></i>我的得分率</span>
          <span><i class="lc lc-orange"></i>平均线</span>
        </div>
      </div>
      <div ref="trendChartRef" class="trend-chart" v-if="trendData.length"></div>
      <el-empty v-else description="暂无考试成绩" :image-size="48" />
    </el-card>

    <!-- 查询 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="query">
        <el-row :gutter="8">
          <el-form-item label="考试名称">
            <el-input v-model="query.keyword" placeholder="搜索考试" clearable style="width:200px" />
          </el-form-item>
          <el-form-item label="及格状态">
            <el-select v-model="query.isPass" clearable placeholder="全部" style="width:120px">
              <el-option label="及格" :value="true" />
              <el-option label="不及格" :value="false" />
            </el-select>
          </el-form-item>
          <el-form-item label="分数区间">
            <el-input-number v-model="query.minScore" :min="0" :max="100" placeholder="最低" controls-position="right" style="width:100px" />
            <span style="margin:0 4px; color:#909399">~</span>
            <el-input-number v-model="query.maxScore" :min="0" :max="100" placeholder="最高" controls-position="right" style="width:100px" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="search"><el-icon><Search /></el-icon>查询</el-button>
            <el-button @click="reset"><el-icon><Refresh /></el-icon>重置</el-button>
            <el-button @click="toggleViewMode" :type="viewMode === 'card' ? 'primary' : 'default'">
              <el-icon><List v-if="viewMode === 'card'" /><Grid v-else /></el-icon>
              {{ viewMode === 'card' ? '表格' : '卡片' }}
            </el-button>
            <el-button type="primary" @click="$router.push('/student/ai-assistant')">
              <el-icon><Cpu /></el-icon>AI成绩分析
            </el-button>
          </el-form-item>
        </el-row>
      </el-form>
    </el-card>

    <!-- 卡片网格布局 -->
    <el-card shadow="never" v-loading="loading">
      <!-- 表格布局（新增：展开明细列 + 错题解析/导出按钮） -->
      <el-table
        v-if="viewMode === 'table'"
        :data="list"
        style="width:100%"
        row-key="id"
        @expand-change="onExpandChange"
      >
        <!-- 新增：展开行（详细成绩分析） -->
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="expand-detail" v-loading="detailLoadingMap[row.examId ?? row.id]">
              <template v-if="expandedDetails[row.examId ?? row.id]">
                <div class="ed-section">
                  <div class="ed-title">
                    <el-icon><PieChart /></el-icon> 题型得分分布
                  </div>
                  <div :id="`dist-chart-${row.examId ?? row.id}`" class="dist-chart"></div>
                </div>
                <div class="ed-section">
                  <div class="ed-title">
                    <el-icon><Document /></el-icon> 逐题明细
                  </div>
                  <el-table :data="expandedDetails[row.examId ?? row.id]?.answers ?? []" size="small" border stripe>
                    <el-table-column type="index" label="#" width="44" />
                    <el-table-column label="题型" width="80">
                      <template #default="{ row: a }">{{ typeLabel(a.questionType) }}</template>
                    </el-table-column>
                    <el-table-column label="难度" width="70">
                      <template #default="{ row: a }">
                        <span :style="{ color: difficultyLabel(a.difficulty).color }">{{ difficultyLabel(a.difficulty).text }}</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="stem" label="题干" min-width="200" show-overflow-tooltip />
                    <el-table-column label="你的答案" width="110">
                      <template #default="{ row: a }">{{ answerDisplay(a.userAnswer) }}</template>
                    </el-table-column>
                    <el-table-column label="正确答案" width="90">
                      <template #default="{ row: a }">{{ a.standardAnswer || '-' }}</template>
                    </el-table-column>
                    <el-table-column label="得分" width="90" align="center">
                      <template #default="{ row: a }">
                        <span :style="{ color: (a.obtainedScore ?? 0) >= (a.questionScore ?? 0) ? '#67c23a' : '#f56c6c' }">
                          {{ a.obtainedScore ?? '-' }} / {{ a.questionScore ?? '-' }}
                        </span>
                      </template>
                    </el-table-column>
                    <el-table-column label="对错" width="70" align="center">
                      <template #default="{ row: a }">
                        <el-icon v-if="a.isCorrect === 1" style="color:#67c23a"><CircleCheck /></el-icon>
                        <el-icon v-else-if="a.isCorrect === 0" style="color:#f56c6c"><CircleClose /></el-icon>
                        <span v-else style="color:#909399">-</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="analysis" label="解析" min-width="160" show-overflow-tooltip />
                  </el-table>
                </div>
              </template>
              <el-empty v-else-if="!detailLoadingMap[row.examId ?? row.id]" description="点击展开加载明细" :image-size="40" />
            </div>
          </template>
        </el-table-column>
        <el-table-column type="index" label="#" width="60" />
        <el-table-column prop="sessionName" label="考试名称" min-width="150" show-overflow-tooltip />
        <el-table-column prop="paperName" label="试卷" min-width="120" show-overflow-tooltip />
        <el-table-column label="分数" width="140" align="center">
          <template #default="{ row }">
            <span :style="{ color: scoreColor(row) }">{{ row.totalScore ?? '-' }}</span>
            <span style="color:#c0c4cc">/ {{ row.paperTotalScore ?? '-' }}</span>
          </template>
        </el-table-column>
        <!-- [2026-10-16 字段对齐] 旧实现该列表头写「正确率」，渲染的却是 scorePercentage（得分率）；
             后端 ExamRecordVO 同时返回 correctRate（答对题数/作答题数），故拆为两列 -->
        <el-table-column label="得分率" width="100" align="center">
          <template #default="{ row }">{{ row.scorePercentage != null ? row.scorePercentage.toFixed(1) + '%' : '-' }}</template>
        </el-table-column>
        <el-table-column label="正确率" width="100" align="center">
          <template #default="{ row }">{{ row.correctRate != null ? Number(row.correctRate).toFixed(1) + '%' : '-' }}</template>
        </el-table-column>
        <el-table-column label="用时" width="100" align="center">
          <template #default="{ row }">{{ durationText(row) }}</template>
        </el-table-column>
        <el-table-column prop="submitTime" label="提交时间" width="180" />
        <el-table-column label="操作" width="230" align="center">
          <template #default="{ row }">
            <!-- 原操作：详情 -->
            <el-button type="primary" size="small" @click="router.push(`/student/results/${row.examId ?? row.id}`)">详情</el-button>
            <!-- 新增：错题解析入口 -->
            <el-button type="warning" size="small" plain @click="goWrongAnalysis(row)">
              <el-icon><CircleClose /></el-icon>错题
            </el-button>
            <!-- 新增：导出明细 -->
            <el-button size="small" @click="exportDetail(row)">
              <el-icon><Download /></el-icon>导出
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 卡片网格布局（新增：展开明细 + 错题/导出按钮） -->
      <div v-else class="result-grid">
        <el-card
          v-for="item in list"
          :key="item.id"
          class="result-card"
          hover
        >
          <div class="card-header">
            <span class="result-id">#{{ item.id }}</span>
            <div class="card-header-actions">
              <el-button type="warning" size="small" plain @click.stop="goWrongAnalysis(item)">
                <el-icon><CircleClose /></el-icon>错题
              </el-button>
              <el-button size="small" @click.stop="exportDetail(item)">
                <el-icon><Download /></el-icon>导出
              </el-button>
            </div>
          </div>
          <div class="card-title" @click="router.push(`/student/results/${item.examId ?? item.id}`)">{{ item.sessionName }}</div>
          <div class="card-meta">
            <span class="meta-item">
              <span class="meta-label">试卷</span>
              <span class="meta-value">{{ item.paperName || '-' }}</span>
            </span>
            <span class="meta-item">
              <span class="meta-label">用时</span>
              <span class="meta-value">{{ durationText(item) }}</span>
            </span>
            <span class="meta-item">
              <span class="meta-label">时间</span>
              <span class="meta-value">{{ item.submitTime || '-' }}</span>
            </span>
          </div>
          <div class="card-score">
            <div class="score-main">
              <span class="score-value" :style="{ color: scoreColor(item) }">{{ item.totalScore ?? '-' }}</span>
              <span class="score-total">/ {{ item.paperTotalScore ?? '-' }}</span>
            </div>
            <div class="score-percent" :style="{ color: scoreColor(item) }">
              {{ item.scorePercentage != null ? item.scorePercentage.toFixed(1) : '-' }}%
            </div>
          </div>
          <!-- 新增：展开/收起明细 -->
          <div class="card-detail-toggle">
            <el-button text size="small" @click="toggleCardDetail(item)">
              {{ cardExpanded[item.examId ?? item.id] ? '收起明细' : '展开明细' }}
              <el-icon><ArrowUp v-if="cardExpanded[item.examId ?? item.id]" /><ArrowDown v-else /></el-icon>
            </el-button>
          </div>
          <transition name="expand">
            <div v-if="cardExpanded[item.examId ?? item.id]" class="card-detail" v-loading="detailLoadingMap[item.examId ?? item.id]">
              <template v-if="expandedDetails[item.examId ?? item.id]">
                <div class="ed-title"><el-icon><PieChart /></el-icon> 题型得分分布</div>
                <div :id="`dist-chart-${item.examId ?? item.id}`" class="dist-chart"></div>
                <div class="ed-title" style="margin-top:10px"><el-icon><Document /></el-icon> 逐题概览</div>
                <div class="qa-list">
                  <div
                    v-for="(a, i) in expandedDetails[item.examId ?? item.id]?.answers ?? []"
                    :key="a.questionId"
                    class="qa-item"
                    :class="{ ok: a.isCorrect === 1, ng: a.isCorrect === 0 }"
                  >
                    <span class="qa-no">{{ i + 1 }}</span>
                    <span class="qa-type">{{ typeLabel(a.questionType) }}</span>
                    <span class="qa-result">
                      <el-icon v-if="a.isCorrect === 1"><CircleCheck /></el-icon>
                      <el-icon v-else-if="a.isCorrect === 0"><CircleClose /></el-icon>
                      <span v-else>-</span>
                    </span>
                    <span class="qa-score">{{ a.obtainedScore ?? '-' }}/{{ a.questionScore ?? '-' }}</span>
                  </div>
                </div>
                <el-button size="small" type="primary" style="margin-top:8px" @click="router.push(`/student/results/${item.examId ?? item.id}`)">
                  查看完整解析
                </el-button>
              </template>
            </div>
          </transition>
          <div class="card-footer">
            <el-button type="primary" size="small" @click="router.push(`/student/results/${item.examId ?? item.id}`)">查看详情</el-button>
          </div>
        </el-card>
      </div>

      <div class="pagination">
        <el-pagination
          v-model:current-page="query.pageNum"
          v-model:page-size="query.pageSize"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          :page-sizes="[20, 50, 100]"
          @size-change="load"
          @current-change="load"
        />
      </div>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.page { display: flex; flex-direction: column; gap: 12px; }
.stat-row { margin: 0 !important; }
.stat-card {
  background: #fff; border-radius: 8px; padding: 20px; text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  transition: all 0.2s;
  &:hover { box-shadow: 0 4px 14px rgba(0,0,0,0.08); transform: translateY(-2px); }
}
.stat-label { color: #909399; font-size: 13px; margin-bottom: 6px; }
.stat-value { font-size: 26px; font-weight: 600; color: #303133; }
.filter-card :deep(.el-card__body) { padding-bottom: 0; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }

/* 新增：趋势迷你图卡片 */
.trend-card {
  :deep(.el-card__body) { padding: 14px 18px; }
}
.trend-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 6px;
}
.th-left { display: flex; align-items: center; gap: 10px; }
.th-title { font-size: 14px; font-weight: 600; color: #303133; }
.th-sub { font-size: 12px; color: #909399; }
.th-legend {
  display: flex; gap: 14px; font-size: 12px; color: #606266;
  span { display: inline-flex; align-items: center; gap: 4px; }
}
.lc { display: inline-block; width: 14px; height: 3px; border-radius: 2px; }
.lc-blue { background: #409eff; }
.lc-orange { background: #e6a23c; }
.trend-chart { width: 100%; height: 130px; }

.result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
}

.result-card {
  cursor: pointer;
  transition: all 0.2s;
  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  }
}

.card-header {
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.card-header-actions { display: flex; gap: 6px; }

.result-id {
  font-size: 12px;
  color: #909399;
  font-family: monospace;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
  cursor: pointer;
  &:hover { color: #409eff; }
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-label {
  font-size: 11px;
  color: #909399;
}

.meta-value {
  font-size: 12px;
  color: #606266;
}

.card-score {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px;
  background: #fafafa;
  border-radius: 6px;
  margin-bottom: 12px;
}

.score-main {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.score-value {
  font-size: 28px;
  font-weight: 700;
}

.score-total {
  font-size: 14px;
  color: #909399;
}

.score-percent {
  font-size: 16px;
  font-weight: 600;
}

.card-detail-toggle {
  display: flex;
  justify-content: center;
  margin-bottom: 4px;
}

.card-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

/* 新增：展开明细区 */
.expand-detail {
  padding: 8px 16px 16px;
}
.ed-section { margin-bottom: 14px; }
.ed-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 600; color: #303133;
  margin-bottom: 8px;
}
.dist-chart { width: 100%; height: 180px; }

.card-detail {
  padding: 10px;
  margin-top: 8px;
  background: #fafafa;
  border-radius: 6px;
}
.qa-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 6px;
}
.qa-item {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 8px; border-radius: 4px;
  background: #fff; border: 1px solid #ebeef5;
  font-size: 11px; color: #606266;
  &.ok { border-color: #b3e19d; background: #f0f9eb; }
  &.ng { border-color: #fab6b6; background: #fef0f0; }
}
.qa-no { font-weight: 700; color: #303133; }
.qa-type { color: #909399; }
.qa-result { display: inline-flex; }
.qa-score { margin-left: auto; color: #409eff; font-weight: 600; }

/* 展开/收起过渡 */
.expand-enter-active, .expand-leave-active { transition: all 0.25s ease; overflow: hidden; }
.expand-enter-from, .expand-leave-to { opacity: 0; max-height: 0; }
.expand-enter-to, .expand-leave-from { opacity: 1; max-height: 600px; }
</style>
