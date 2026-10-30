<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, PieChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'
import { getSessionStatistics } from '@/api/admin'
import type { SessionStatistics } from '@/types/admin'
import { Cpu } from '@element-plus/icons-vue'

use([CanvasRenderer, BarChart, PieChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent])

const route = useRoute()
const router = useRouter()
const sessionId = Number(route.params.sessionId)

const stat = ref<SessionStatistics | null>(null)
const loading = ref(false)

const load = async () => {
  loading.value = true
  try {
    const res = await getSessionStatistics(sessionId)
    stat.value = res.data
  } catch { /* handled */ } finally { loading.value = false }
}

onMounted(load)

/** [2026-10-30] 正确率配色：≥70 绿 / 40-70 橙 / <40 红 */
const accColor = (rate?: number | null) => {
  const v = Number(rate ?? 0)
  if (v >= 70) return '#67C23A'
  if (v >= 40) return '#E6A23C'
  return '#F56C6C'
}

/* ---------------- 图表配置 ---------------- */
const distributionOption = computed(() => ({
  title: { text: '分数区间分布', left: 'center', textStyle: { fontSize: 15 } },
  tooltip: { trigger: 'axis' },
  xAxis: {
    type: 'category',
    data: stat.value?.distribution?.map((d) => d.range) ?? [],
  },
  yAxis: { type: 'value', name: '人数', minInterval: 1 },
  series: [{
    name: '人数',
    type: 'bar',
    data: stat.value?.distribution?.map((d) => d.count) ?? [],
    itemStyle: {
      color: {
        type: 'linear',
        x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [
          { offset: 0, color: '#409eff' },
          { offset: 1, color: '#79bbff' },
        ],
      },
      borderRadius: [4, 4, 0, 0],
    },
    label: { show: true, position: 'top' },
  }],
  grid: { left: 50, right: 20, bottom: 40, top: 60 },
}))

const passRateOption = computed(() => {
  const s = stat.value
  if (!s) return {}
  const failCount = Math.max(0, s.scoredCount - s.passCount)
  return {
    title: { text: '及格率', left: 'center', textStyle: { fontSize: 15 } },
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie',
      radius: ['50%', '70%'],
      center: ['50%', '55%'],
      data: [
        { value: s.passCount, name: '及格', itemStyle: { color: '#67c23a' } },
        { value: failCount, name: '不及格', itemStyle: { color: '#f56c6c' } },
      ],
      label: {
        formatter: (p: { name: string; value: number; percent: number }) => `${p.name}\n${p.value} 人 (${p.percent.toFixed(1)}%)`,
      },
    }],
  }
})
</script>

<template>
  <div class="page" v-loading="loading">
    <div class="page-header">
      <el-button link @click="router.push('/admin/exams')">
        <el-icon><ArrowLeft /></el-icon>返回考试列表
      </el-button>
      <h3 class="page-title">场次统计 · {{ stat?.sessionName || '' }}</h3>
      <div class="page-header-actions">
        <el-button
         
          type="primary"
          @click="router.push(`/admin/exams/${sessionId}/monitor`)"
        >
          <el-icon><View /></el-icon>实时监控
        </el-button>
        <el-button type="primary" @click="$router.push('/admin/ai-compose')">
          <el-icon><Cpu /></el-icon>AI考试分析
        </el-button>
      </div>
    </div>

    <template v-if="stat">
      <!-- 核心指标 -->
      <el-row :gutter="16">
        <el-col :span="4">
          <div class="stat-card">
            <div class="lbl">试卷满分</div>
            <div class="val">{{ stat.paperTotalScore }}</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="stat-card">
            <div class="lbl">及格分</div>
            <div class="val">{{ stat.paperPassScore ?? '-' }}</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="stat-card">
            <div class="lbl">已批阅人数</div>
            <div class="val" style="color:#409eff">{{ stat.scoredCount }}</div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="stat-card">
            <div class="lbl">平均分</div>
            <div class="val" :style="{ color: stat.averageScore >= 60 ? '#67c23a' : '#f56c6c' }">
              {{ stat.averageScore.toFixed(1) }}
            </div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="stat-card">
            <div class="lbl">最高 / 最低</div>
            <div class="val">
              <span style="color:#67c23a">{{ stat.highestScore }}</span> /
              <span style="color:#f56c6c">{{ stat.lowestScore }}</span>
            </div>
          </div>
        </el-col>
        <el-col :span="4">
          <div class="stat-card">
            <div class="lbl">总体正确率</div>
            <div class="val" style="color:#e6a23c">{{ stat.overallAccuracy.toFixed(1) }}%</div>
          </div>
        </el-col>
      </el-row>

      <!-- 图表 -->
      <el-row :gutter="16" class="chart-row">
        <el-col :md="16" :xs="24">
          <el-card shadow="never" class="chart-card">
            <v-chart :option="distributionOption" style="height: 340px" autoresize />
          </el-card>
        </el-col>
        <el-col :md="8" :xs="24">
          <el-card shadow="never" class="chart-card">
            <v-chart :option="passRateOption" style="height: 340px" autoresize />
          </el-card>
        </el-col>
      </el-row>

      <!-- 按题型 / 按语法分类正确率（实时聚合 answer_record + question，不落库） -->
      <el-row :gutter="16" class="dim-row">
        <el-col :md="12" :xs="24">
          <el-card shadow="never" class="dim-card">
            <template #header>
              <div class="dim-head">
                <span>按题型正确率</span>
                <span class="dim-sub">实时聚合</span>
              </div>
            </template>
            <el-empty v-if="!stat.typeAccuracies?.length" description="暂无作答数据" :image-size="48" />
            <div v-for="r in stat.typeAccuracies" :key="r.name" class="dim-line">
              <span class="dim-name">{{ r.name }}</span>
              <el-progress
                :percentage="Number(Number(r.accuracy).toFixed(1))"
                :color="accColor(r.accuracy)"
                :stroke-width="14"
                :show-text="false"
                class="dim-bar"
              />
              <span class="dim-val" :style="{ color: accColor(r.accuracy) }">
                {{ Number(r.accuracy).toFixed(1) }}%
              </span>
              <span class="dim-cnt">{{ r.correctCount }}/{{ r.totalAttempts }}</span>
            </div>
          </el-card>
        </el-col>
        <el-col :md="12" :xs="24">
          <el-card shadow="never" class="dim-card">
            <template #header>
              <div class="dim-head">
                <span>按语法分类正确率</span>
                <span class="dim-sub">作答量前 10</span>
              </div>
            </template>
            <el-empty v-if="!stat.categoryAccuracies?.length" description="暂无作答数据" :image-size="48" />
            <div
              v-for="r in (stat.categoryAccuracies ?? []).slice(0, 10)"
              :key="r.id ?? r.name"
              class="dim-line"
            >
              <span class="dim-name" :title="r.name">{{ r.name }}</span>
              <el-progress
                :percentage="Number(Number(r.accuracy).toFixed(1))"
                :color="accColor(r.accuracy)"
                :stroke-width="14"
                :show-text="false"
                class="dim-bar"
              />
              <span class="dim-val" :style="{ color: accColor(r.accuracy) }">
                {{ Number(r.accuracy).toFixed(1) }}%
              </span>
              <span class="dim-cnt">{{ r.correctCount }}/{{ r.totalAttempts }}</span>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 及格率进度条 -->
      <el-card shadow="never">
        <div class="pass-row">
          <div class="pass-info">
            <div class="pass-title">及格率</div>
            <div class="pass-detail">
              <b style="color:#67c23a">{{ stat.passCount }}</b> / {{ stat.scoredCount }} 人及格
            </div>
          </div>
          <div class="pass-bar">
            <el-progress
              :percentage="stat.passRate"
              :stroke-width="18"
              :color="stat.passRate >= 60 ? '#67c23a' : '#e6a23c'"
              :format="(p: number) => `${p.toFixed(1)}%`"
            />
          </div>
        </div>
      </el-card>
    </template>
  </div>
</template>

<style scoped lang="scss">
.page { display: flex; flex-direction: column; gap: 12px; }
.page-header {
  display: flex; align-items: center; gap: 12px;
  .page-title { margin: 0; font-size: 18px; font-weight: 600; flex: 1; }
}
.page-header-actions { display: flex; align-items: center; gap: 10px; }

.stat-card {
  background: #fff; border-radius: 8px; padding: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  text-align: center;
  height: 100%;
}
.stat-card .lbl { color: #909399; font-size: 12px; margin-bottom: 6px; }
.stat-card .val { font-size: 22px; font-weight: 700; color: #303133; }

.chart-row { margin-top: 4px; }
.chart-card { border-radius: 8px; }

.pass-row {
  display: flex; align-items: center; gap: 20px;
}
.pass-info { flex-shrink: 0; }
.pass-title { font-size: 14px; color: #606266; margin-bottom: 4px; }
.pass-detail { font-size: 18px; }
.pass-bar { flex: 1; }

/* ---------- 按题型 / 按语法正确率 ---------- */
.dim-row { margin-top: 16px; }

.dim-card {
  height: 100%;
  :deep(.el-card__header) { padding: 10px 16px; }
}

.dim-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.dim-sub {
  font-size: 11px;
  font-weight: 400;
  color: #7c4dff;
  background: rgba(124, 77, 255, 0.1);
  padding: 1px 6px;
  border-radius: 4px;
}

.dim-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 7px;
  font-size: 12px;
}

.dim-name {
  width: 110px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #606266;
}

.dim-bar { flex: 1; min-width: 50px; }

.dim-val {
  width: 48px;
  text-align: right;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.dim-cnt {
  width: 64px;
  text-align: right;
  color: #909399;
  font-size: 11px;
}
</style>
