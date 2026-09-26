<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getStudentMastery } from '@/api/knowledgeMastery'
import type { KnowledgeMastery as KM } from '@/types/knowledgeMastery'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { RadarChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, RadarComponent } from 'echarts/components'
import { DataAnalysis, Aim } from '@element-plus/icons-vue'

use([CanvasRenderer, RadarChart, TitleComponent, TooltipComponent, LegendComponent, RadarComponent])

const authStore = useAuthStore()
const data = ref<KM[]>([])
const loading = ref(false)

// ---- 旧 load 函数（保留注释） ----
// const load = async () => {
//   loading.value = true
//   try {
//     const uid = authStore.userInfo?.id
//     if (!uid) return
//     const res = await getStudentMastery(uid)
//     data.value = res.data ?? []
//     renderChart()
//   } finally { loading.value = false }
// }

// ---- 新 load 函数（不再需要手动 renderChart） ----
const load = async () => {
  loading.value = true
  try {
    const uid = authStore.userInfo?.id
    if (!uid) return
    const res = await getStudentMastery(uid)
    data.value = res.data ?? []
  } finally { loading.value = false }
}

// [2026-09-26 修复] 页面挂载时加载掌握度数据 —— 原代码定义了 load() 却从未调用，
// 导致「知识点掌握度」页面进入后永远不加载数据（严格模式下 TS6133 暴露该缺陷）。
onMounted(load)

// ---- 旧 renderChart 函数（保留注释） ----
// const renderChart = () => {
//   const container = document.getElementById('mastery-radar-chart')
//   if (!container || data.value.length === 0) return
//   const chart = echarts.init(container)
//   chart.setOption({
//     tooltip: { formatter: (p: any) => `${p.name}: ${p.value?.toFixed(1)}分` },
//     radar: {
//       indicator: data.value.slice(0, 8).map(d => ({ name: (d.tagName ?? '').substring(0, 6), max: 100 })),
//       shape: 'polygon',
//     },
//     series: [{
//       type: 'radar',
//       data: [{ value: data.value.slice(0, 8).map(d => d.proficiencyScore ?? 0), name: '掌握度', areaStyle: { opacity: 0.3 } }],
//     }],
//   })
// }

// ---- 新雷达图配置（增强版：色彩分区、多边形面积、详细 tooltip） ----
const radarChartOption = computed(() => {
  if (!data.value.length) return {}
  const top = data.value.slice(0, 8)
  return {
    tooltip: {
      trigger: 'item' as const,
      formatter: (params: any) => {
        const vals = params.value as number[]
        let html = `<b>${params.name}</b><br/>`
        top.forEach((d, i) => {
          const v = vals[i] ?? 0
          const color = v >= 70 ? '#67c23a' : v >= 40 ? '#e6a23c' : '#f56c6c'
          html += `${d.tagName ?? ''}: <span style="color:${color};font-weight:600">${v.toFixed(1)}</span><br/>`
        })
        return html
      },
    },
    legend: { bottom: 0, data: ['掌握度'], textStyle: { fontSize: 12 } },
    radar: {
      indicator: top.map(d => ({
        name: (d.tagName ?? '').length > 6 ? (d.tagName ?? '').substring(0, 6) + '…' : (d.tagName ?? ''),
        max: 100,
      })),
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

// ---- 新增：视觉掌握度网格（按分类分组，带进度条） ----
const masteryGrid = computed(() => {
  if (!data.value.length) return []
  // 按 categoryName 分组，取每组的平均熟练度
  const grouped = new Map<string, KM[]>()
  data.value.forEach(d => {
    const cn = d.categoryName || d.tagName || '未分类'
    if (!grouped.has(cn)) grouped.set(cn, [])
    grouped.get(cn)!.push(d)
  })
  return Array.from(grouped.entries()).map(([categoryName, items]) => {
    const avgScore = items.reduce((s, d) => s + (d.proficiencyScore ?? 0), 0) / items.length
    const avgAccuracy = items.reduce((s, d) => s + (d.accuracy ?? 0), 0) / items.length
    const totalAnswers = items.reduce((s, d) => s + d.totalAnswers, 0)
    const weakCount = items.filter(d => d.masteryLevel <= 2).length
    return {
      categoryName,
      avgScore: Math.round(avgScore * 10) / 10,
      avgAccuracy: Math.round(avgAccuracy * 10) / 10,
      totalAnswers,
      itemCount: items.length,
      weakCount,
      items: items.sort((a, b) => (a.proficiencyScore ?? 0) - (b.proficiencyScore ?? 0)),
    }
  }).sort((a, b) => a.avgScore - b.avgScore)
})

// ---- 新增：薄弱知识点建议 ----
const weakPointRecommendations = computed(() => {
  const weak = data.value.filter(d => d.masteryLevel <= 2).sort((a, b) => (a.proficiencyScore ?? 0) - (b.proficiencyScore ?? 0))
  return weak.slice(0, 5).map(d => {
    let suggestion = ''
    if (d.masteryLevel === 0) {
      suggestion = `尚未开始练习「${d.tagName}」，建议从基础题目入手，每次完成 5-10 题。`
    } else if (d.masteryLevel === 1) {
      suggestion = `「${d.tagName}」正确率较低，建议先复习相关语法规则，再从简单题目开始练习。`
    } else if (d.masteryLevel === 2) {
      suggestion = `「${d.tagName}」掌握处于基础水平，需要增加练习量，重点攻克易错题型。`
    }
    return { ...d, suggestion }
  })
})

const levelColors: Record<number, string> = { 0: '#909399', 1: '#F56C6C', 2: '#E6A23C', 3: '#409EFF', 4: '#67C23A', 5: '#00D100' }
const levelLabels: Record<number, string> = { 0: '未接触', 1: '入门', 2: '基础', 3: '进阶', 4: '熟练', 5: '精通' }

/** 等级判定的详细标准 */
const levelCriteria: Record<number, string> = {
  0: '还未做过该知识点的题目',
  1: '正确率<50%或答题数<5道',
  2: '正确率50%~70%',
  3: '正确率70%~85%',
  4: '正确率85%~95%',
  5: '正确率≥95%且答题≥20道',
}

const formulaTooltip = '综合评分 = 正确率×50% + 连续正确/10×30% + 答题量/50×20%。不只是看正确率，还考虑稳定性和练习量。'

/** 获取掌握度对应的进度条颜色 */
const proficiencyColor = (score: number) => {
  if (score >= 70) return '#67C23A'
  if (score >= 40) return '#E6A23C'
  return '#F56C6C'
}
</script>

<template>
  <div class="page-container" v-loading="loading">
    <!-- 顶部说明卡片 -->
    <el-alert type="info" :closable="false" style="margin-bottom:16px">
      <template #title>
        <span style="font-weight:600">掌握度计算逻辑</span>
        <el-tooltip :content="formulaTooltip" placement="bottom" effect="light">
          <el-icon style="margin-left:4px;cursor:help;color:#909399"><QuestionFilled /></el-icon>
        </el-tooltip>
      </template>
      系统根据你每道题的答题结果，自动计算每个知识点的掌握程度（0-5级）。等级越高说明掌握越扎实。点击下方表格行可查看详情。
    </el-alert>

    <!-- 雷达图 + 薄弱知识点 -->
    <el-row :gutter="16">
      <el-col :span="16">
        <el-card shadow="never" class="section-card">
          <template #header>
            <div style="display:flex;align-items:center;gap:8px">
              <el-icon><DataAnalysis /></el-icon>
              <span>知识点掌握雷达图</span>
              <el-tooltip content="雷达图展示Top 8知识点的掌握度分布。越靠近外圈代表掌握越好（满分100）。多边形越大越均衡。" placement="top" effect="light">
                <el-icon style="cursor:help;color:#909399"><QuestionFilled /></el-icon>
              </el-tooltip>
            </div>
          </template>
          <!-- 旧图表容器（保留注释）：<div id="mastery-radar-chart" style="width:100%;height:400px" v-if="data.length > 0" /> -->
          <VChart v-if="radarChartOption.series" :option="radarChartOption" autoresize style="height:400px" />
          <el-empty v-else description="暂无数据，先去专项练习或考试获取答题数据" />
          <!-- 色彩分区图例 -->
          <div class="radar-legend">
            <span class="rl-item"><i class="rl-dot" style="background:#f56c6c"></i>薄弱 (&lt;40)</span>
            <span class="rl-item"><i class="rl-dot" style="background:#e6a23c"></i>一般 (40-70)</span>
            <span class="rl-item"><i class="rl-dot" style="background:#67c23a"></i>良好 (&gt;70)</span>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never" class="section-card">
          <template #header>
            <div style="display:flex;align-items:center;gap:8px">
              <span>薄弱知识点</span>
              <el-tooltip content="掌握等级<=2（基础以下）的知识点。这些是建议优先复习的内容。点击标签可跳转到对应练习。" placement="top" effect="light">
                <el-icon style="cursor:help;color:#F56C6C"><WarningFilled /></el-icon>
              </el-tooltip>
            </div>
          </template>
          <div v-if="data.filter(d => d.masteryLevel <= 2).length > 0">
            <el-tag
              v-for="d in data.filter(d => d.masteryLevel <= 2).slice(0, 10)" :key="d.id"
              :color="levelColors[d.masteryLevel]" style="margin:4px;color:#fff;cursor:pointer"
              @click="$router.push('/student/practice')"
            >{{ d.tagName }} ({{ d.accuracy?.toFixed(1) }}%)</el-tag>
          </div>
          <el-empty v-else description="掌握良好！所有知识点都在基础以上" :image-size="60" />
        </el-card>
      </el-col>
    </el-row>

    <!-- ====== 新增：视觉掌握度网格（按分类分组，带进度条） ====== -->
    <el-card v-if="masteryGrid.length" shadow="never" class="section-card" style="margin-top:16px">
      <template #header>
        <div style="display:flex;align-items:center;gap:8px">
          <el-icon><Aim /></el-icon>
          <span>语法分类掌握度网格</span>
          <el-tag size="small" type="info">共 {{ masteryGrid.length }} 个分类</el-tag>
        </div>
      </template>
      <div class="mastery-grid">
        <div v-for="g in masteryGrid" :key="g.categoryName" class="mg-card" @click="$router.push('/student/practice')">
          <div class="mg-header">
            <span class="mg-name">{{ g.categoryName }}</span>
            <span class="mg-score" :style="{ color: proficiencyColor(g.avgScore) }">{{ g.avgScore.toFixed(1) }}</span>
          </div>
          <el-progress
            :percentage="Math.min(100, g.avgScore)"
            :stroke-width="14"
            :color="proficiencyColor(g.avgScore)"
            :show-text="false"
          />
          <div class="mg-footer">
            <span class="mg-stat">正确率 {{ g.avgAccuracy.toFixed(1) }}%</span>
            <span class="mg-stat">答题 {{ g.totalAnswers }}</span>
            <span class="mg-stat" v-if="g.weakCount > 0" style="color:#f56c6c">薄弱 {{ g.weakCount }}个</span>
            <span class="mg-stat" v-else style="color:#67c23a">全部达标</span>
          </div>
        </div>
      </div>
    </el-card>

    <!-- ====== 新增：薄弱知识点练习建议 ====== -->
    <el-card v-if="weakPointRecommendations.length" shadow="never" class="section-card" style="margin-top:16px">
      <template #header>
        <div style="display:flex;align-items:center;gap:8px">
          <el-icon><WarningFilled /></el-icon>
          <span>薄弱知识点练习建议</span>
          <el-button type="primary" size="small" link @click="$router.push('/student/practice')">
            去练习 →
          </el-button>
        </div>
      </template>
      <div class="recommendation-list">
        <div v-for="(rec, idx) in weakPointRecommendations" :key="rec.id" class="rec-item">
          <div class="rec-left">
            <div class="rec-rank" :style="{ background: levelColors[rec.masteryLevel] }">{{ idx + 1 }}</div>
            <div class="rec-content">
              <div class="rec-title">
                {{ rec.tagName }}
                <el-tag :color="levelColors[rec.masteryLevel]" effect="dark" size="small" style="margin-left:8px">
                  {{ levelLabels[rec.masteryLevel] }}
                </el-tag>
              </div>
              <div class="rec-suggestion">{{ rec.suggestion }}</div>
              <div class="rec-meta">
                <span>熟练度: <b :style="{ color: proficiencyColor(rec.proficiencyScore ?? 0) }">{{ rec.proficiencyScore?.toFixed(1) }}</b></span>
                <span>正确率: <b>{{ rec.accuracy?.toFixed(1) }}%</b></span>
                <span>答题: <b>{{ rec.totalAnswers }}</b></span>
              </div>
            </div>
          </div>
          <el-button type="primary" size="small" @click="$router.push('/student/practice')">立即练习</el-button>
        </div>
      </div>
    </el-card>

    <!-- 知识点详情表格 -->
    <el-card shadow="never" class="section-card" style="margin-top:16px">
      <template #header>
        <div style="display:flex;align-items:center;gap:8px">
          <span>知识点详情</span>
          <el-tooltip :content="formulaTooltip" placement="top" effect="light">
            <el-icon style="cursor:help;color:#909399"><QuestionFilled /></el-icon>
          </el-tooltip>
        </div>
      </template>
      <el-table :data="data" stripe border max-height="500">
        <el-table-column prop="tagName" label="知识点" width="140" />
        <el-table-column label="掌握等级" width="110">
          <template #default="{ row }">
            <el-tooltip :content="levelCriteria[row.masteryLevel]" placement="top" effect="light">
              <el-tag :color="levelColors[row.masteryLevel]" effect="dark" size="small" style="cursor:help">
                {{ levelLabels[row.masteryLevel] }}
              </el-tag>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="熟练度评分" width="120">
          <template #default="{ row }">
            <el-tooltip content="综合评分(满分100)=正确率x50%+连续正确x30%+练习量x20%" placement="top" effect="light">
              <div style="cursor:help">
                <el-progress
                  :percentage="Math.min(100, row.proficiencyScore ?? 0)"
                  :stroke-width="8"
                  :color="proficiencyColor(row.proficiencyScore ?? 0)"
                />
              </div>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="正确率" width="90">
          <template #default="{ row }">
            <span :style="{ color: (row.accuracy ?? 0) >= 80 ? '#67C23A' : (row.accuracy ?? 0) >= 60 ? '#E6A23C' : '#F56C6C', fontWeight: 600 }">
              {{ row.accuracy?.toFixed(1) ?? '-' }}%
            </span>
          </template>
        </el-table-column>
        <el-table-column label="答题/正确" width="90">
          <template #default="{ row }">{{ row.totalAnswers }} / {{ row.correctCount }}</template>
        </el-table-column>
        <el-table-column label="连续正确" width="90">
          <template #default="{ row }">
            <el-tooltip v-if="row.maxConsecutiveCorrect > 0" :content="`历史最高：连续${row.maxConsecutiveCorrect}次正确`" placement="top" effect="light">
              <span :style="{ color: row.consecutiveCorrect >= 5 ? '#67C23A' : '#606266', fontWeight: 600, cursor: 'help' }">
                {{ row.consecutiveCorrect }}
              </span>
            </el-tooltip>
            <span v-else>{{ row.consecutiveCorrect }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="weakPointCount" label="薄弱标记" width="90">
          <template #default="{ row }">
            <span v-if="row.weakPointCount > 0" style="color:#F56C6C;font-weight:600">{{ row.weakPointCount }}次</span>
            <span v-else style="color:#67C23A">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="lastPracticeTime" label="最近练习" width="150">
          <template #default="{ row }">{{ row.lastPracticeTime?.substring(0, 10) ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row: _row }">
            <el-button size="small" type="primary" link @click="$router.push('/student/practice')">练习</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.page-container { display: flex; flex-direction: column; gap: 14px; padding: 16px; }

.section-card {
  border-radius: 8px;
  :deep(.el-card__header) { padding: 12px 20px; font-weight: 600; font-size: 14px; }
}

// 雷达图图例
.radar-legend {
  display: flex; justify-content: center; gap: 20px; margin-top: 10px;
  .rl-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #606266; }
  .rl-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
}

// 掌握度网格
.mastery-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px;
}
.mg-card {
  background: #fafbfc; border: 1px solid #ebeef5; border-radius: 10px; padding: 14px;
  cursor: pointer; transition: all 0.2s;
  &:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-color: #c0c4cc; }
}
.mg-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;
  .mg-name { font-size: 14px; font-weight: 600; color: #303133; }
  .mg-score { font-size: 20px; font-weight: 700; }
}
.mg-footer {
  display: flex; gap: 12px; margin-top: 8px; flex-wrap: wrap;
  .mg-stat { font-size: 11px; color: #909399; }
}

// 薄弱知识点建议
.recommendation-list { display: flex; flex-direction: column; gap: 12px; }
.rec-item {
  display: flex; align-items: center; justify-content: space-between;
  background: #fff8f8; border: 1px solid #fde2e2; border-radius: 8px; padding: 14px;
  transition: all 0.2s;
  &:hover { box-shadow: 0 2px 8px rgba(245,108,108,0.12); }
}
.rec-left { display: flex; align-items: flex-start; gap: 12px; flex: 1; }
.rec-rank {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 14px; font-weight: 700;
}
.rec-content { flex: 1; }
.rec-title { font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 4px; }
.rec-suggestion { font-size: 13px; color: #606266; line-height: 1.5; margin-bottom: 6px; }
.rec-meta {
  display: flex; gap: 16px; font-size: 12px; color: #909399;
  b { color: #303133; font-size: 13px; }
}
</style>
