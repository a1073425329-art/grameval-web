<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getStudentStatistics } from '@/api/student'
import type { StudentStatistics, CategoryStat, DifficultyStat, TagStat } from '@/types/stats'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from 'echarts/components'

use([CanvasRenderer, BarChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent])

const authStore = useAuthStore()
const userId = computed(() => authStore.userInfo?.id as number)

const stats = ref<StudentStatistics | null>(null)
const loading = ref(false)

const currentModule = ref('all')
const moduleOptions = [
  { label: '全部', value: 'all' },
  { label: '基本 + 考试 + 练习', value: 'basic,exam,practice' },
  { label: '考点弱点分析', value: 'tag' },
  { label: '分语法大类', value: 'category' },
  { label: '分难度', value: 'difficulty' },
]

const includeMap: Record<string, string | undefined> = {
  all: undefined,
  'basic,exam,practice': 'basic,exam,practice',
  tag: 'tag',
  category: 'category',
  difficulty: 'difficulty',
}

const load = async () => {
  if (!userId.value) return
  loading.value = true
  try {
    const res = await getStudentStatistics(userId.value, includeMap[currentModule.value])
    stats.value = res.data
  } finally {
    loading.value = false
  }
}

const switchModule = (val: string) => {
  currentModule.value = val
  load()
}

onMounted(load)

// ===== 计算属性 =====

const genderText = computed(() => {
  const g = stats.value?.gender
  if (g === 1) return '男'
  if (g === 2) return '女'
  return '未知'
})

// 按分类柱状图 (accuracy from low to high → 薄弱分类在左侧)
const categoryChartOption = computed(() => {
  const list: CategoryStat[] = stats.value?.categoryStats ?? []
  if (!list.length) return {}
  const sorted = [...list].sort((a, b) => a.accuracy - b.accuracy)
  return {
    tooltip: { trigger: 'axis' as const, formatter: (p: any) => {
      const d = p[0]
      const item = sorted[d.dataIndex]
      return `${d.name}<br/>正确率：${item.accuracy.toFixed(1)}%（${item.correct}/${item.total}）`
    }},
    grid: { left: 120, right: 30, top: 10, bottom: 20 },
    xAxis: { type: 'value' as const, max: 100, axisLabel: { formatter: '{value}%' } },
    yAxis: { type: 'category' as const, data: sorted.map(c => c.categoryName), axisLabel: { fontSize: 12 } },
    series: [{
      type: 'bar',
      data: sorted.map(c => c.accuracy),
      itemStyle: {
        color: (p: any) => {
          const v = p.value ?? 0
          if (v >= 80) return '#67c23a'
          if (v >= 60) return '#e6a23c'
          return '#f56c6c'
        },
      },
      barMaxWidth: 32,
    }],
  }
})

// 按难度柱状图
const difficultyChartOption = computed(() => {
  const list: DifficultyStat[] = stats.value?.difficultyStats ?? []
  if (!list.length) return {}
  const sorted = [...list].sort((a, b) => a.difficulty - b.difficulty)
  return {
    tooltip: { trigger: 'axis' as const, formatter: (p: any) => {
      const d = p[0]
      const item = sorted[d.dataIndex]
      return `${item.difficultyLabel}<br/>正确率：${item.accuracy.toFixed(1)}%（${item.correct}/${item.total}）`
    }},
    grid: { left: 60, right: 30, top: 10, bottom: 20 },
    xAxis: { type: 'category' as const, data: sorted.map(d => d.difficultyLabel) },
    yAxis: { type: 'value' as const, max: 100, axisLabel: { formatter: '{value}%' } },
    series: [{
      type: 'bar',
      data: sorted.map(d => d.accuracy),
      itemStyle: {
        color: (p: any) => {
          const v = p.value ?? 0
          if (v >= 80) return '#67c23a'
          if (v >= 60) return '#e6a23c'
          return '#f56c6c'
        },
      },
      barMaxWidth: 48,
    }],
  }
})

// 按考点标签弱点分布 (错误率从高到低 → 最薄弱考点在前)
const tagChartOption = computed(() => {
  const list: TagStat[] = stats.value?.tagStats ?? []
  if (!list.length) return {}
  // 截取 top 15 显示在图表中（已按 errorRate desc 排序）
  const top = [...list].slice(0, 15).reverse() // reverse 为了横向柱状图从下到上
  return {
    tooltip: { trigger: 'axis' as const, formatter: (p: any) => {
      const d = p[0]
      const item = top[d.dataIndex]
      return `${item.tagName}<br/>错误率：${item.errorRate.toFixed(1)}%（${item.wrong}/${item.total}）`
    }},
    grid: { left: 150, right: 30, top: 10, bottom: 20 },
    xAxis: { type: 'value' as const, max: 100, axisLabel: { formatter: '{value}%' } },
    yAxis: {
      type: 'category' as const,
      data: top.map(t => t.tagName.length > 12 ? t.tagName.slice(0, 12) + '…' : t.tagName),
      axisLabel: { fontSize: 11 },
    },
    series: [{
      type: 'bar',
      data: top.map(t => t.errorRate),
      itemStyle: {
        color: (p: any) => {
          const v = p.value ?? 0
          if (v <= 20) return '#67c23a'
          if (v <= 50) return '#e6a23c'
          return '#f56c6c'
        },
      },
      barMaxWidth: 22,
    }],
  }
})

const weekDayNames: Record<number, string> = {
  1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六', 7: '周日',
}
const trainingDaysText = computed(() => {
  const td = stats.value?.trainingSchedule?.trainingDays
  if (!td) return '未设置'
  return td.split(',').map(d => weekDayNames[Number(d.trim())] || d).join('、')
})

const accuracyColor = (v: number | undefined) => {
  if (v == null) return '#909399'
  if (v >= 80) return '#67c23a'
  if (v >= 60) return '#e6a23c'
  return '#f56c6c'
}
</script>

<template>
  <div class="page" v-loading="loading">
    <!-- 顶部切换 -->
    <div class="page-header">
      <h3 class="page-title">📊 学习数据</h3>
      <el-radio-group v-model="currentModule" @change="switchModule" size="small">
        <el-radio-button v-for="m in moduleOptions" :key="m.value" :value="m.value">
          {{ m.label }}
        </el-radio-button>
      </el-radio-group>
    </div>

    <template v-if="stats">
      <!-- ========== 基本信息卡片 ========== -->
      <el-card shadow="never" class="section-card" v-if="stats.realName">
        <div class="basic-info">
          <div class="basic-left">
            <el-avatar :size="56" :src="stats.avatar" style="background:#409eff;font-size:22px">
              {{ (stats.realName || stats.username)[0]?.toUpperCase() }}
            </el-avatar>
            <div class="basic-text">
              <div class="basic-name">{{ stats.realName || stats.username }}</div>
              <div class="basic-meta">
                <span>{{ genderText }}</span>
                <span v-if="stats.email">· {{ stats.email }}</span>
                <span v-if="stats.phone">· {{ stats.phone }}</span>
                <span>· 注册于 {{ stats.createTime?.slice(0, 10) }}</span>
              </div>
            </div>
          </div>
          <div class="basic-extra" v-if="stats.lastLoginTime">
            上次登录：{{ stats.lastLoginTime?.slice(0, 16) }}
          </div>
        </div>
      </el-card>

      <!-- ========== 考试 + 练习 + 错题 总览卡片 ========== -->
      <el-row :gutter="16" class="stat-row" v-if="stats.examCount != null || stats.practiceCount != null">
        <!-- 考试 -->
        <el-col :span="8">
          <el-card shadow="never" class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-icon">📝</span>
              <span class="kpi-label">考试</span>
            </div>
            <el-divider style="margin:12px 0" />
            <div class="kpi-grid">
              <div class="kpi-item">
                <div class="kpi-value">{{ stats.examCount ?? '-' }}</div>
                <div class="kpi-desc">参加次数</div>
              </div>
              <div class="kpi-item">
                <div class="kpi-value" :style="{ color: accuracyColor(stats.examAccuracy) }">
                  {{ stats.examAccuracy != null ? stats.examAccuracy.toFixed(1) + '%' : '-' }}
                </div>
                <div class="kpi-desc">正确率</div>
              </div>
              <div class="kpi-item">
                <div class="kpi-value">{{ stats.examAverageScore != null ? stats.examAverageScore.toFixed(1) : '-' }}</div>
                <div class="kpi-desc">平均分</div>
              </div>
              <div class="kpi-item">
                <div class="kpi-value" style="color:#67c23a">{{ stats.examHighestScore ?? '-' }}</div>
                <div class="kpi-desc">最高</div>
              </div>
              <div class="kpi-item">
                <div class="kpi-value" style="color:#f56c6c">{{ stats.examLowestScore ?? '-' }}</div>
                <div class="kpi-desc">最低</div>
              </div>
              <div class="kpi-item">
                <div class="kpi-value">{{ stats.examCorrectCount ?? 0 }}<span style="font-size:12px;color:#909399">/{{ stats.examWrongCount ?? 0 }}</span></div>
                <div class="kpi-desc">对/错题数</div>
              </div>
            </div>
          </el-card>
        </el-col>

        <!-- 练习 -->
        <el-col :span="8">
          <el-card shadow="never" class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-icon">🎯</span>
              <span class="kpi-label">专项练习</span>
            </div>
            <el-divider style="margin:12px 0" />
            <div class="kpi-grid">
              <div class="kpi-item">
                <div class="kpi-value">{{ stats.practiceCount ?? '-' }}</div>
                <div class="kpi-desc">练习次数</div>
              </div>
              <div class="kpi-item">
                <div class="kpi-value" :style="{ color: accuracyColor(stats.practiceAccuracy) }">
                  {{ stats.practiceAccuracy != null ? stats.practiceAccuracy.toFixed(1) + '%' : '-' }}
                </div>
                <div class="kpi-desc">正确率</div>
              </div>
              <div class="kpi-item">
                <div class="kpi-value">{{ stats.practiceQuestionCount ?? '-' }}</div>
                <div class="kpi-desc">累计题数</div>
              </div>
              <div class="kpi-item">
                <div class="kpi-value" style="color:#67c23a">{{ stats.practiceCorrectCount ?? 0 }}</div>
                <div class="kpi-desc">答对</div>
              </div>
              <div class="kpi-item">
                <div class="kpi-value" style="color:#f56c6c">{{ stats.practiceWrongCount ?? 0 }}</div>
                <div class="kpi-desc">答错</div>
              </div>
            </div>
          </el-card>
        </el-col>

        <!-- 错题总览 -->
        <el-col :span="8">
          <el-card shadow="never" class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-icon">📋</span>
              <span class="kpi-label">错题总览</span>
            </div>
            <el-divider style="margin:12px 0" />
            <div class="center-stat">
              <div class="big-num" style="color:#f56c6c">{{ stats.distinctWrongCount ?? '-' }}</div>
              <div class="big-desc">去重错题总数</div>
            </div>
            <div class="center-stat" style="margin-top:8px" v-if="stats.tagStats?.length">
              <div class="weak-tag">
                最薄弱考点：
                <el-tag type="danger" size="small" effect="dark">{{ stats.tagStats[0]?.tagName }}</el-tag>
              </div>
              <div style="font-size:12px;color:#909399">
                错误率 {{ stats.tagStats[0]?.errorRate?.toFixed(0) }}%
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- ========== 训练信息 ========== -->
      <el-row :gutter="16" v-if="stats.trainingSchedule || stats.trainedDays != null">
        <el-col :span="24">
          <el-card shadow="never" class="section-card">
            <template #header>📅 训练计划</template>
            <div class="training-row">
              <div class="training-item">
                <div class="training-label">训练日</div>
                <div class="training-value">{{ trainingDaysText }}</div>
              </div>
              <div class="training-item" v-if="stats.trainingSchedule?.timeSlot">
                <div class="training-label">每日时段</div>
                <div class="training-value">{{ stats.trainingSchedule.timeSlot }}</div>
              </div>
              <div class="training-item" v-if="stats.trainingSchedule?.dailyQuestionCount">
                <div class="training-label">每日题数</div>
                <div class="training-value">{{ stats.trainingSchedule.dailyQuestionCount }} 题</div>
              </div>
              <div class="training-item">
                <div class="training-label">已训练</div>
                <div class="training-value">{{ stats.trainedDays ?? 0 }} 天</div>
              </div>
              <div class="training-item">
                <div class="training-label">剩余</div>
                <div class="training-value" style="color:#e6a23c">{{ stats.daysRemaining ?? '-' }} 天</div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- ========== 图表区域 ========== -->

      <!-- 按语法大类 --><el-row :gutter="16" v-if="stats.categoryStats?.length">
        <el-col :span="24">
          <el-card shadow="never" class="section-card">
            <template #header>📈 各语法大类正确率</template>
            <VChart :option="categoryChartOption" autoresize style="height: 300px" />
          </el-card>
        </el-col>
      </el-row>

      <!-- 按难度 + 按考点标签弱点 --><el-row :gutter="16">
        <el-col :span="12" v-if="stats.difficultyStats?.length">
          <el-card shadow="never" class="section-card">
            <template #header>🎯 按难度正确率</template>
            <VChart :option="difficultyChartOption" autoresize style="height: 240px" />
          </el-card>
        </el-col>
        <el-col :span="stats.difficultyStats?.length ? 12 : 24" v-if="stats.tagStats?.length">
          <el-card shadow="never" class="section-card">
            <template #header>⚠️ 考点弱点排行（Top {{ Math.min(stats.tagStats.length, 15) }}）</template>
            <VChart :option="tagChartOption" autoresize style="height: 360px" />
          </el-card>
        </el-col>
      </el-row>

      <!-- 考点标签详细表格 --><el-card shadow="never" class="section-card" v-if="stats.tagStats?.length">
        <template #header>📋 考点弱点明细</template>
        <el-table :data="stats.tagStats" size="default">
          <el-table-column type="index" label="#" width="50" />
          <el-table-column prop="tagName" label="考点名称" min-width="150" />
          <el-table-column prop="total" label="总题数" width="90" align="center" />
          <el-table-column prop="wrong" label="错题数" width="90" align="center">
            <template #default="{ row }">
              <span style="color:#f56c6c;font-weight:600">{{ row.wrong }}</span>
            </template>
          </el-table-column>
          <el-table-column label="错误率" width="120" align="center">
            <template #default="{ row }">
              <el-progress
                :percentage="Math.min(row.errorRate, 100)"
                :color="row.errorRate <= 20 ? '#67c23a' : row.errorRate <= 50 ? '#e6a23c' : '#f56c6c'"
                :stroke-width="16"
              />
            </template>
          </el-table-column>
          <el-table-column prop="errorRate" label="错误率" width="90" align="center">
            <template #default="{ row }">
              <span :style="{ color: accuracyColor(100 - row.errorRate), fontWeight: 600 }">
                {{ row.errorRate.toFixed(1) }}%
              </span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </template>

    <el-empty v-else-if="!loading" description="暂无统计数据" />
  </div>
</template>

<style scoped lang="scss">
.page { display: flex; flex-direction: column; gap: 14px; }

.page-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 2px;
}
.page-title { margin: 0; font-size: 18px; font-weight: 600; color: #303133; }

.section-card {
  border-radius: 8px;
  :deep(.el-card__header) { font-weight: 600; font-size: 14px; }
}

// basic info
.basic-info {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 12px;
}
.basic-left { display: flex; align-items: center; gap: 16px; }
.basic-name { font-size: 18px; font-weight: 600; color: #303133; }
.basic-meta { font-size: 13px; color: #909399; margin-top: 4px; }
.basic-extra { font-size: 12px; color: #909399; }

// KPI cards
.stat-row { margin: 0 !important; }
.kpi-card {
  border-radius: 8px; height: 100%;
  :deep(.el-card__body) { padding: 16px 20px 20px; }
}
.kpi-header { display: flex; align-items: center; gap: 8px; }
.kpi-icon { font-size: 18px; }
.kpi-label { font-size: 14px; font-weight: 600; color: #606266; }
.kpi-grid {
  display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px 8px;
}
.kpi-item { text-align: center; }
.kpi-value {
  font-size: 20px; font-weight: 600; color: #303133; line-height: 1.2;
}
.kpi-desc { font-size: 11px; color: #909399; margin-top: 2px; }

.center-stat { text-align: center; }
.big-num { font-size: 42px; font-weight: 700; line-height: 1; }
.big-desc { font-size: 13px; color: #909399; margin-top: 4px; }
.weak-tag { font-size: 13px; color: #606266; margin-top: 8px; }

// training
.training-row { display: flex; gap: 32px; flex-wrap: wrap; }
.training-item { text-align: center; }
.training-label { font-size: 12px; color: #909399; margin-bottom: 4px; }
.training-value { font-size: 15px; font-weight: 600; color: #303133; }
</style>
