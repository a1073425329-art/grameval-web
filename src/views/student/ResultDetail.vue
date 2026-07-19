<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getResultDetail, getDimensionAnalysis } from '@/api/student'
import type { ResultDetail as ResultDetailType } from '@/types/result'
import type { DimensionAnalysis } from '@/types/stats'
import type { QuestionType } from '@/types/common'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'

use([CanvasRenderer, BarChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent])

const route = useRoute()
const router = useRouter()

const resultId = Number(route.params.id)
const detail = ref<ResultDetailType | null>(null)
const dim = ref<DimensionAnalysis | null>(null)
const loading = ref(false)
const dimLoading = ref(false)

const load = async () => {
  loading.value = true
  try {
    const res = await getResultDetail(resultId)
    detail.value = res.data
  } finally {
    loading.value = false
  }
}

const loadDimension = async () => {
  if (!detail.value?.id && !resultId) return
  dimLoading.value = true
  try {
    const res = await getDimensionAnalysis(detail.value?.id || resultId)
    dim.value = res.data
  } catch {
    // 维度分析加载失败不影响主页面
  } finally {
    dimLoading.value = false
  }
}

onMounted(async () => {
  await load()
  loadDimension()
})

const rate = computed(() => {
  const pct = detail.value?.scorePercentage
  if (pct != null) return pct / 100
  const paper = detail.value?.paperTotalScore
  if (paper && detail.value?.totalScore != null) return detail.value.totalScore / paper
  return 0
})
const rateColor = computed(() => rate.value >= 0.8 ? '#67c23a' : rate.value >= 0.6 ? '#e6a23c' : '#f56c6c')
const rateFmt = computed(() =>
  detail.value?.scorePercentage != null
    ? `${detail.value.scorePercentage.toFixed(1)}%`
    : `${(rate.value * 100).toFixed(0)}%`
)

const correctCount = computed(() => detail.value?.correctCount ?? 0)
const wrongCount = computed(() => detail.value?.wrongCount ?? 0)

const typeLabel = (t: QuestionType) =>
  ({ SINGLE: '单选', MULTIPLE: '多选', JUDGE: '判断', FILL_HINT: '填空', READING: '阅读理解' } as Record<QuestionType, string>)[t] || t

const answerText = (a: string | undefined | null) => {
  if (a === undefined || a === null || a === '') return '（未作答）'
  return a
}

const durationText = computed(() =>
  detail.value?.durationSeconds
    ? `${Math.round(detail.value.durationSeconds / 60)} 分钟`
    : '-'
)

// ===== 维度分析图表 =====

const dimTagChartOption = computed(() => {
  const list = dim.value?.byTag ?? []
  if (!list.length) return {}
  const sorted = [...list].sort((a, b) => a.accuracy - b.accuracy)
  return {
    tooltip: {
      trigger: 'axis' as const,
      formatter: (p: any) => {
        const d = p[0]; const item = sorted[d.dataIndex]
        return `${item.tagName}<br/>正确率：${item.accuracy.toFixed(1)}%（${item.correct}/${item.total}）`
      },
    },
    grid: { left: 120, right: 30, top: 10, bottom: 20 },
    xAxis: { type: 'value' as const, max: 100, axisLabel: { formatter: '{value}%' } },
    yAxis: { type: 'category' as const, data: sorted.map(t => t.tagName), axisLabel: { fontSize: 11 } },
    series: [{
      type: 'bar', data: sorted.map(t => t.accuracy),
      itemStyle: { color: (p: any) => (p.value ?? 0) >= 60 ? '#67c23a' : '#f56c6c' },
      barMaxWidth: 24,
    }],
  }
})

const dimCategoryChartOption = computed(() => {
  const list = dim.value?.byCategory ?? []
  if (!list.length) return {}
  const sorted = [...list].sort((a, b) => a.accuracy - b.accuracy)
  return {
    tooltip: {
      trigger: 'axis' as const,
      formatter: (p: any) => {
        const d = p[0]; const item = sorted[d.dataIndex]
        return `${item.categoryName}<br/>正确率：${item.accuracy.toFixed(1)}%（${item.correct}/${item.total}）`
      },
    },
    grid: { left: 100, right: 30, top: 10, bottom: 20 },
    xAxis: { type: 'value' as const, max: 100, axisLabel: { formatter: '{value}%' } },
    yAxis: { type: 'category' as const, data: sorted.map(c => c.categoryName), axisLabel: { fontSize: 12 } },
    series: [{
      type: 'bar', data: sorted.map(c => c.accuracy),
      itemStyle: { color: (p: any) => (p.value ?? 0) >= 60 ? '#67c23a' : '#f56c6c' },
      barMaxWidth: 28,
    }],
  }
})

const dimDifficultyChartOption = computed(() => {
  const list = dim.value?.byDifficulty ?? []
  if (!list.length) return {}
  const sorted = [...list].sort((a, b) => a.difficulty - b.difficulty)
  return {
    tooltip: {
      trigger: 'axis' as const,
      formatter: (p: any) => {
        const d = p[0]; const item = sorted[d.dataIndex]
        return `${item.difficultyLabel}<br/>正确率：${item.accuracy.toFixed(1)}%（${item.correct}/${item.total}）`
      },
    },
    grid: { left: 50, right: 30, top: 10, bottom: 20 },
    xAxis: { type: 'category' as const, data: sorted.map(d => d.difficultyLabel) },
    yAxis: { type: 'value' as const, max: 100, axisLabel: { formatter: '{value}%' } },
    series: [{
      type: 'bar', data: sorted.map(d => d.accuracy),
      itemStyle: { color: (p: any) => (p.value ?? 0) >= 60 ? '#67c23a' : '#f56c6c' },
      barMaxWidth: 48,
    }],
  }
})
</script>

<template>
  <div class="page" v-loading="loading">
    <div class="page-header">
      <el-button link @click="router.back()"><el-icon><ArrowLeft /></el-icon>返回</el-button>
      <h3 class="page-title">{{ detail?.sessionName || '成绩详情' }}</h3>
    </div>

    <!-- 汇总 -->
    <div class="summary-card" v-if="detail">
      <div class="score-block" :style="{ color: rateColor }">
        <div class="score-value">{{ detail.totalScore }}</div>
        <div class="score-total">/ {{ detail.paperTotalScore ?? '-' }} 分</div>
      </div>
      <el-divider direction="vertical" style="height: 60px" />
      <div class="stat">
        <div class="stat-label">百分制</div>
        <div class="stat-value" :style="{ color: rateColor }">{{ rateFmt }}</div>
      </div>
      <div class="stat">
        <div class="stat-label">答对 / 答错</div>
        <div class="stat-value">
          <span style="color:#67c23a">{{ correctCount }}</span> /
          <span style="color:#f56c6c">{{ wrongCount }}</span>
        </div>
      </div>
      <div class="stat">
        <div class="stat-label">用时</div>
        <div class="stat-value">{{ durationText }}</div>
      </div>
      <div class="stat">
        <div class="stat-label">提交时间</div>
        <div class="stat-value" style="font-size:14px">{{ detail.submitTime || '-' }}</div>
      </div>
    </div>

    <!-- 逐题明细 -->
    <div class="answers" v-if="detail?.answers?.length">
      <div
        v-for="(a, idx) in detail.answers"
        :key="a.questionId"
        class="answer-card"
        :class="{ ok: a.isCorrect === 1, ng: a.isCorrect === 0 }"
      >
        <div class="q-head">
          <span class="q-idx">
            <el-icon><CircleCheck v-if="a.isCorrect === 1" /><CircleClose v-else /></el-icon>
            第 {{ idx + 1 }} 题
          </span>
          <el-tag size="small">{{ typeLabel(a.questionType) }}</el-tag>
          <el-tag size="small" type="info">{{ a.obtainedScore ?? 0 }} 分</el-tag>
        </div>
        <div class="q-stem">{{ a.stem }}</div>
        <div v-if="a.options?.length" class="opts">
          <div v-for="op in a.options" :key="op.optionLabel" class="opt">
            <span class="opt-key">{{ op.optionLabel }}.</span>{{ op.optionContent }}
          </div>
        </div>
        <div class="row">
          <span class="lbl">你的答案：</span>
          <span :class="a.isCorrect === 1 ? 'ok-text' : 'ng-text'">{{ answerText(a.userAnswer) }}</span>
        </div>
        <div class="row">
          <span class="lbl">正确答案：</span>
          <span class="ok-text">{{ answerText(a.standardAnswer) }}</span>
        </div>
        <div class="row" v-if="a.analysis">
          <span class="lbl">解析：</span>
          <span>{{ a.analysis }}</span>
        </div>
      </div>
    </div>
    <!-- 多维度分析 -->
    <div class="dim-section" v-if="dim && (dim.byTag?.length || dim.byCategory?.length || dim.byDifficulty?.length)" v-loading="dimLoading">
      <h4 class="dim-title">📊 多维度分析</h4>

      <el-row :gutter="16">
        <el-col :span="12" v-if="dim.byCategory?.length">
          <el-card shadow="never" class="dim-card">
            <template #header>按语法大类</template>
            <VChart :option="dimCategoryChartOption" autoresize style="height: 260px" />
          </el-card>
        </el-col>
        <el-col :span="12" v-if="dim.byDifficulty?.length">
          <el-card shadow="never" class="dim-card">
            <template #header>按难度</template>
            <VChart :option="dimDifficultyChartOption" autoresize style="height: 240px" />
          </el-card>
        </el-col>
      </el-row>

      <el-card shadow="never" class="dim-card" v-if="dim.byTag?.length" style="margin-top:14px">
        <template #header>按考点标签</template>
        <VChart :option="dimTagChartOption" autoresize style="height: 300px" />
      </el-card>

      <el-card shadow="never" class="dim-card" v-if="dim.byQuestionType?.length" style="margin-top:14px">
        <template #header>按题型</template>
        <el-table :data="dim.byQuestionType" size="small">
          <el-table-column prop="questionTypeLabel" label="题型" width="140" />
          <el-table-column prop="total" label="总题数" width="100" align="center" />
          <el-table-column prop="correct" label="答对" width="80" align="center">
            <template #default="{ row }"><span style="color:#67c23a;font-weight:600">{{ row.correct }}</span></template>
          </el-table-column>
          <el-table-column prop="wrong" label="答错" width="80" align="center">
            <template #default="{ row }"><span style="color:#f56c6c;font-weight:600">{{ row.wrong }}</span></template>
          </el-table-column>
          <el-table-column label="正确率" min-width="150">
            <template #default="{ row }">
              <el-progress
                :percentage="Math.min(row.accuracy, 100)"
                :color="row.accuracy >= 80 ? '#67c23a' : row.accuracy >= 60 ? '#e6a23c' : '#f56c6c'"
                :stroke-width="14"
              />
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>

    <el-empty v-else-if="!loading" description="暂无答题明细" />
  </div>
</template>

<style scoped lang="scss">
.page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.page-title { margin: 0; font-size: 18px; font-weight: 600; }

.summary-card {
  background: #fff; border-radius: 8px; padding: 20px 30px;
  display: flex; align-items: center; gap: 30px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.score-block { display: flex; align-items: baseline; gap: 4px; }
.score-value { font-size: 48px; font-weight: 700; line-height: 1; }
.score-total { color: #909399; font-size: 14px; }
.stat { display: flex; flex-direction: column; gap: 4px; }
.stat-label { color: #909399; font-size: 12px; }
.stat-value { font-size: 20px; font-weight: 600; color: #303133; }

.answers { display: flex; flex-direction: column; gap: 12px; }
.answer-card {
  background: #fff; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  border-left: 4px solid #dcdfe6;
}
.answer-card.ok { border-left-color: #67c23a; }
.answer-card.ng { border-left-color: #f56c6c; }
.q-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.answer-card.ok .q-idx { color: #67c23a; }
.answer-card.ng .q-idx { color: #f56c6c; }
.q-idx { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; }
.q-stem { font-size: 15px; line-height: 1.7; color: #303133; margin-bottom: 12px; white-space: pre-wrap; }
.opts { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.opt { padding: 6px 10px; background: #fafafa; border-radius: 4px; color: #606266; font-size: 13px; }
.opt-key { font-weight: 600; color: #409eff; margin-right: 4px; }
.row { padding: 4px 0; font-size: 14px; line-height: 1.7; }
.lbl { color: #909399; margin-right: 4px; }
.ok-text { color: #67c23a; font-weight: 600; }
.ng-text { color: #f56c6c; font-weight: 600; }

.dim-section { margin-top: 20px; }
.dim-title { margin: 0 0 14px; font-size: 16px; font-weight: 600; color: #303133; }
.dim-card {
  border-radius: 8px;
  :deep(.el-card__header) { font-weight: 600; font-size: 14px; padding: 12px 16px; }
  :deep(.el-card__body) { padding: 12px; }
}
</style>
