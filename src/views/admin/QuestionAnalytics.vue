<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'
import { getQuestionAnalytics, listCategoryTree } from '@/api/admin'
import type { QuestionAnalytics } from '@/types/admin'
import type { Category } from '@/types/category'
import type { QuestionType } from '@/types/common'

use([CanvasRenderer, BarChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent])

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

/* ---------------- 图表 ---------------- */

const byCategoryOption = computed(() => {
  const rows = data.value?.byCategory ?? []
  return {
    title: { text: '各分类正确率', left: 'center', textStyle: { fontSize: 15 } },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: rows.map((r) => r.categoryName),
      axisLabel: { rotate: rows.length > 6 ? 30 : 0, interval: 0 },
    },
    yAxis: { type: 'value', name: '正确率 %', max: 100 },
    series: [{
      type: 'bar',
      data: rows.map((r) => Number(r.accuracy.toFixed(1))),
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: '#67c23a' },
            { offset: 1, color: '#95d475' },
          ],
        },
      },
      label: { show: true, position: 'top', formatter: '{c}%' },
    }],
    grid: { left: 50, right: 20, bottom: 60, top: 60 },
  }
})

const byDifficultyOption = computed(() => {
  const rows = data.value?.byDifficulty ?? []
  const diffLabel = (d: number) => (d === 1 ? '简单' : d === 2 ? '中等' : '困难')
  return {
    title: { text: '各难度正确率', left: 'center', textStyle: { fontSize: 15 } },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: rows.map((r) => diffLabel(r.difficulty)) },
    yAxis: { type: 'value', name: '正确率 %', max: 100 },
    series: [{
      type: 'bar',
      data: rows.map((r) => ({
        value: Number(r.accuracy.toFixed(1)),
        itemStyle: {
          color: r.difficulty === 1 ? '#67c23a' : r.difficulty === 2 ? '#e6a23c' : '#f56c6c',
          borderRadius: [4, 4, 0, 0],
        },
      })),
      label: { show: true, position: 'top', formatter: '{c}%' },
    }],
    grid: { left: 50, right: 20, bottom: 40, top: 60 },
  }
})

const typeLabel = (t: QuestionType | string) =>
  ({ SINGLE: '单选', MULTIPLE: '多选', JUDGE: '判断', FILL_HINT: '填空', READING: '阅读' } as Record<string, string>)[t] || t
const diffLabel = (d: number) => (d === 1 ? '简单' : d === 2 ? '中等' : '困难')
const diffTagType = (d: number) => (d === 1 ? 'success' : d === 2 ? 'warning' : 'danger')

/** 逐题表格倒序按正确率 —— 找出难度最高的题 */
const worstQuestions = computed(() => {
  const list = [...(data.value?.questions ?? [])]
  return list.sort((a, b) => a.accuracy - b.accuracy)
})

const accColor = (a: number) => a >= 80 ? '#67c23a' : a >= 60 ? '#e6a23c' : '#f56c6c'
</script>

<template>
  <div class="page" v-loading="loading">
    <div class="page-header">
      <h3 class="page-title">题目质量分析</h3>
      <el-cascader
        v-model="categoryId"
        :options="categories"
        :props="{ value: 'id', label: 'categoryName', children: 'children', checkStrictly: true, emitPath: false }"
        clearable placeholder="全部分类" style="width:220px"
      />
    </div>

    <el-empty v-if="!loading && !data?.questions?.length" description="暂无答题数据" />

    <template v-else-if="data">
      <!-- 图表 -->
      <el-row :gutter="16">
        <el-col :md="14" :xs="24">
          <el-card shadow="never" class="chart-card">
            <v-chart :option="byCategoryOption" style="height: 340px" autoresize />
          </el-card>
        </el-col>
        <el-col :md="10" :xs="24">
          <el-card shadow="never" class="chart-card">
            <v-chart :option="byDifficultyOption" style="height: 340px" autoresize />
          </el-card>
        </el-col>
      </el-row>

      <!-- 分类聚合表 -->
      <el-card shadow="never">
        <template #header>
          <div style="font-weight:600"><el-icon><Menu /></el-icon> 分类聚合</div>
        </template>
        <el-table :data="data.byCategory" style="width:100%">
          <el-table-column prop="categoryName" label="分类" />
          <el-table-column prop="total" label="作答次数" width="120" align="center" />
          <el-table-column prop="correct" label="答对" width="100" align="center">
            <template #default="{ row }">
              <span style="color:#67c23a">{{ row.correct }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="wrong" label="答错" width="100" align="center">
            <template #default="{ row }">
              <span style="color:#f56c6c">{{ row.wrong }}</span>
            </template>
          </el-table-column>
          <el-table-column label="正确率" min-width="200">
            <template #default="{ row }">
              <el-progress
                :percentage="Number(row.accuracy.toFixed(1))"
                :color="accColor(row.accuracy)"
                :stroke-width="16"
              />
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 最难题目 Top 20 -->
      <el-card shadow="never">
        <template #header>
          <div style="font-weight:600">
            <el-icon><Warning /></el-icon> 最难题目 Top 20（正确率最低）
          </div>
        </template>
        <el-table :data="worstQuestions.slice(0, 20)" style="width:100%">
          <el-table-column type="index" label="#" width="60" />
          <el-table-column prop="stemPreview" label="题干" min-width="360" show-overflow-tooltip />
          <el-table-column prop="categoryName" label="分类" width="120" />
          <el-table-column label="题型" width="90">
            <template #default="{ row }">{{ typeLabel(row.questionType) }}</template>
          </el-table-column>
          <el-table-column label="难度" width="80">
            <template #default="{ row }">
              <el-tag :type="diffTagType(row.difficulty)" size="small">{{ diffLabel(row.difficulty) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="totalCount" label="作答次数" width="100" align="center" />
          <el-table-column label="正确率" width="150" align="center">
            <template #default="{ row }">
              <span :style="{ color: accColor(row.accuracy), fontWeight: 600 }">
                {{ row.accuracy.toFixed(1) }}%
              </span>
              <span style="color:#909399"> ({{ row.correctCount }}/{{ row.totalCount }})</span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </template>
  </div>
</template>

<style scoped lang="scss">
.page { display: flex; flex-direction: column; gap: 12px; }
.page-header {
  display: flex; align-items: center; justify-content: space-between;
  .page-title { margin: 0; font-size: 18px; font-weight: 600; }
}
.chart-card { border-radius: 8px; margin-bottom: 12px; }
</style>
