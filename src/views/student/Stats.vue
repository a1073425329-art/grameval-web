<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getStudentStatistics, getMyResults, listPractices, getDimensionAnalysis } from '@/api/student'
import type { StudentStatistics, CategoryStat, DifficultyStat, TagStat } from '@/types/stats'
import type { ExamResultItem } from '@/types/result'
import type { PracticeRecord } from '@/types/question'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'
import { Cpu } from '@element-plus/icons-vue'

use([CanvasRenderer, BarChart, LineChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent])

const authStore = useAuthStore()
const userId = computed(() => authStore.userInfo?.id as number)
const loading = ref(false)

const stats = ref<StudentStatistics | null>(null)
const recentResults = ref<ExamResultItem[]>([])
const recentPractices = ref<PracticeRecord[]>([])

// 维度切换
const currentModule = ref('all')
const moduleOptions = [
  { label: '全部', value: 'all' },
  { label: '考试+练习+错题', value: 'basic,exam,practice,wrong' },
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

const load = async () => {
  if (!userId.value) return
  loading.value = true
  try {
    const [s, r, p] = await Promise.allSettled([
      getStudentStatistics(userId.value, includeMap[currentModule.value]),
      getMyResults({ pageNum: 1, pageSize: 20 }),
      listPractices({ pageNum: 1, pageSize: 10 }),
    ])
    if (s.status === 'fulfilled') stats.value = s.value.data
    if (r.status === 'fulfilled') recentResults.value = r.value.data?.records ?? ([] as any)
    if (p.status === 'fulfilled') recentPractices.value = p.value.data?.records ?? ([] as any)
  } finally { loading.value = false }
}

const switchModule = (val: string) => { currentModule.value = val; load() }

// 成绩趋势数据：取最近 10 次考试
const scoreTrendData = computed(() => {
  return [...recentResults.value].reverse().slice(0, 10).map(r => ({
    name: (r.sessionName?.length ?? 0) > 8 ? r.sessionName!.slice(0, 8) + '…' : (r.sessionName || '-'),
    score: r.scorePercentage ?? 0,
    date: r.submitTime?.slice(0, 10) || '',
  }))
})

onMounted(load)

// ===== Helpers =====
const genderText = computed(() => { const g = stats.value?.gender; if (g === 1) return '男'; if (g === 2) return '女'; return '未知' })
const accuracyColor = (v?: number) => { if (v == null) return '#909399'; if (v >= 80) return '#67c23a'; if (v >= 60) return '#e6a23c'; return '#f56c6c' }
const weekDayNames: Record<string, string> = { '1': '周一', '2': '周二', '3': '周三', '4': '周四', '5': '周五', '6': '周六', '7': '周日' }
const trainingDaysText = computed(() => {
  const td = stats.value?.trainingSchedule?.trainingDays
  if (!td) return '未设置'
  return td.split(',').map(d => weekDayNames[d.trim()] || d).join('、')
})

// ===== 图表配置 =====

// 成绩趋势折线图
const scoreTrendOption = computed(() => {
  const data = scoreTrendData.value
  if (!data.length) return {}
  return {
    tooltip: { trigger: 'axis' as const, formatter: (p: any) => `${p[0].axisValue}<br/>得分：${p[0].value.toFixed(1)}%` },
    grid: { left: 45, right: 20, top: 10, bottom: 40 },
    xAxis: { type: 'category' as const, data: data.map(d => d.date), axisLabel: { rotate: 30, fontSize: 11 } },
    yAxis: { type: 'value' as const, min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
    series: [{
      type: 'line', smooth: true, data: data.map(d => d.score),
      lineStyle: { color: '#409eff', width: 3 },
      itemStyle: { color: '#409eff' },
      markLine: { silent: true, data: [{ type: 'average', name: '均分', lineStyle: { color: '#e6a23c', type: 'dashed' } }] },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(64,158,255,0.3)' }, { offset: 1, color: 'rgba(64,158,255,0.02)' }] } },
    }],
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
</script>

<template>
  <div class="page" v-loading="loading">
    <div class="page-header">
      <h3 class="page-title">📊 学习数据</h3>
      <div class="page-header-actions">
        <el-radio-group v-model="currentModule" @change="switchModule" size="small">
          <el-radio-button v-for="m in moduleOptions" :key="m.value" :value="m.value">{{ m.label }}</el-radio-button>
        </el-radio-group>
        <el-button type="primary" size="small" @click="$router.push('/student/ai-assistant')">
          <el-icon><Cpu /></el-icon>AI数据分析
        </el-button>
      </div>
    </div>

    <template v-if="stats">
      <!-- ====== 用户信息条 ====== -->
      <el-card shadow="never" class="section-card" v-if="stats.realName">
        <div class="basic-info">
          <div class="basic-left">
            <el-avatar :size="48" :src="stats.avatar" style="background:#409eff;font-size:20px">{{ (stats.realName || stats.username)[0]?.toUpperCase() }}</el-avatar>
            <div class="basic-text">
              <div class="basic-name">{{ stats.realName || stats.username }}</div>
              <div class="basic-meta">{{ genderText }} · 注册于 {{ stats.createTime?.slice(0, 10) }} · 上次登录 {{ stats.lastLoginTime?.slice(0, 16) || '-' }}</div>
            </div>
          </div>
        </div>
      </el-card>

      <!-- ====== KPI 总览 ====== -->
      <el-row :gutter="16" class="stat-row">
        <el-col :span="6">
          <div class="kpi kpi-exam" @click="$router.push('/student/results')">
            <div class="kpi-num">{{ stats.examCount ?? '-' }}</div><div class="kpi-lbl">考试次数</div>
            <div class="kpi-sub">均分 {{ stats.examAverageScore?.toFixed(1) ?? '-' }} · 最高 {{ stats.examHighestScore ?? '-' }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="kpi kpi-practice" @click="$router.push('/student/practice')">
            <div class="kpi-num">{{ stats.practiceCount ?? '-' }}</div><div class="kpi-lbl">练习次数</div>
            <div class="kpi-sub">{{ stats.practiceQuestionCount ?? 0 }} 题 · 正确率 {{ stats.practiceAccuracy?.toFixed(1) ?? '-' }}%</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="kpi kpi-accuracy">
            <div class="kpi-num" :style="{ color: accuracyColor(stats.examAccuracy) }">{{ stats.examAccuracy?.toFixed(1) ?? '-' }}%</div><div class="kpi-lbl">考试正确率</div>
            <div class="kpi-sub">对 {{ stats.examCorrectCount ?? 0 }} / 错 {{ stats.examWrongCount ?? 0 }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="kpi kpi-wrong" @click="$router.push('/student/wrong-book')">
            <div class="kpi-num" style="color:#f56c6c">{{ stats.distinctWrongCount ?? '-' }}</div><div class="kpi-lbl">去重错题</div>
            <div class="kpi-sub" v-if="stats.tagStats?.length">最弱：{{ stats.tagStats[0]?.tagName }}</div>
          </div>
        </el-col>
      </el-row>

      <!-- ====== 成绩趋势图 ====== -->
      <el-card v-if="scoreTrendData.length >= 2" shadow="never" class="section-card">
        <template #header>📈 成绩趋势（最近 {{ scoreTrendData.length }} 场）</template>
        <VChart :option="scoreTrendOption" autoresize style="height:280px" />
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

          <!-- 最近练习 -->
          <el-card shadow="never" class="section-card" style="margin-top:14px" v-if="recentPractices.length">
            <template #header>🎯 最近练习记录</template>
            <el-table :data="recentPractices.slice(0, 5)" size="small">
              <el-table-column prop="categoryName" label="专题" min-width="100" />
              <el-table-column label="对/错" width="80" align="center">
                <template #default="{ row }">{{ row.correctCount }}/{{ row.wrongCount }}</template>
              </el-table-column>
              <el-table-column label="正确率" width="80" align="center">
                <template #default="{ row }"><span :style="{ color: accuracyColor(row.accuracy) }">{{ row.accuracy?.toFixed(0) ?? '-' }}%</span></template>
              </el-table-column>
              <el-table-column prop="startTime" label="时间" width="140">
                <template #default="{ row }">{{ row.startTime?.slice(0, 16) }}</template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
      </el-row>

      <!-- ====== 最近考试记录 ====== -->
      <el-card shadow="never" class="section-card" v-if="recentResults.length">
        <template #header>📝 最近考试记录</template>
        <el-table :data="recentResults.slice(0, 10)" size="small">
          <el-table-column prop="sessionName" label="考试名称" min-width="150" show-overflow-tooltip />
          <el-table-column label="提交时间" width="160">
            <template #default="{ row }">{{ row.submitTime?.slice(0, 16) || '-' }}</template>
          </el-table-column>
          <el-table-column label="得分" width="100" align="center">
            <template #default="{ row }">
              <span :style="{ color: accuracyColor(row.scorePercentage), fontWeight: 600 }">{{ row.totalScore ?? '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="正确率" width="90" align="center">
            <template #default="{ row }">{{ row.scorePercentage?.toFixed(1) ?? '-' }}%</template>
          </el-table-column>
          <el-table-column label="对/错" width="80" align="center">
            <template #default="{ row }">{{ row.correctCount ?? '-' }}/{{ row.wrongCount ?? '-' }}</template>
          </el-table-column>
        </el-table>
      </el-card>

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
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
.page-title { margin: 0; font-size: 18px; font-weight: 600; color: #303133; }

.section-card {
  border-radius: 8px;
  :deep(.el-card__header) { padding: 12px 20px; font-weight: 600; font-size: 14px; }
}

// Basic info
.basic-info { display: flex; align-items: center; justify-content: space-between; }
.basic-left { display: flex; align-items: center; gap: 14px; }
.basic-name { font-size: 16px; font-weight: 600; color: #303133; }
.basic-meta { font-size: 12px; color: #909399; margin-top: 2px; }

// KPI row
.stat-row { margin: 0 !important; }
.page-header-actions { display: flex; align-items: center; gap: 16px; }
.kpi {
  text-align: center; background: #fff; border-radius: 8px; padding: 18px 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06); cursor: pointer; transition: transform 0.15s;
  &:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
}
.kpi-num { font-size: 28px; font-weight: 700; color: #303133; line-height: 1.2; }
.kpi-lbl { font-size: 13px; color: #606266; margin: 4px 0; }
.kpi-sub { font-size: 11px; color: #909399; }
.kpi-exam { border-top: 3px solid #409eff; }
.kpi-practice { border-top: 3px solid #67c23a; }
.kpi-accuracy { border-top: 3px solid #e6a23c; }
.kpi-wrong { border-top: 3px solid #f56c6c; }

// Training
.training-grid { display: flex; gap: 28px; flex-wrap: wrap; }
.tg-item { text-align: center; }
.tg-label { font-size: 12px; color: #909399; margin-bottom: 4px; }
.tg-value { font-size: 15px; font-weight: 600; color: #303133; }
</style>
