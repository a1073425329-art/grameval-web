<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getStudentMastery } from '@/api/knowledgeMastery'
import type { KnowledgeMastery as KM } from '@/types/knowledgeMastery'
import * as echarts from 'echarts'

const authStore = useAuthStore()
const data = ref<KM[]>([])
const loading = ref(false)

const load = async () => {
  loading.value = true
  try {
    const uid = authStore.userInfo?.id
    if (!uid) return
    const res = await getStudentMastery(uid)
    data.value = res.data ?? []
    renderChart()
  } finally { loading.value = false }
}

const renderChart = () => {
  const container = document.getElementById('mastery-radar-chart')
  if (!container || data.value.length === 0) return
  const chart = echarts.init(container)
  chart.setOption({
    tooltip: { formatter: (p: any) => `${p.name}: ${p.value?.toFixed(1)}分` },
    radar: {
      indicator: data.value.slice(0, 8).map(d => ({ name: (d.tagName ?? '').substring(0, 6), max: 100 })),
      shape: 'polygon',
    },
    series: [{
      type: 'radar',
      data: [{ value: data.value.slice(0, 8).map(d => d.proficiencyScore ?? 0), name: '掌握度', areaStyle: { opacity: 0.3 } }],
    }],
  })
}

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
</script>

<template>
  <div class="page-container">
    <!-- 顶部说明卡片 -->
    <el-alert type="info" :closable="false" style="margin-bottom:16px">
      <template #title>
        <span style="font-weight:600">📐 掌握度计算逻辑</span>
        <el-tooltip :content="formulaTooltip" placement="bottom" effect="light">
          <el-icon style="margin-left:4px;cursor:help;color:#909399"><QuestionFilled /></el-icon>
        </el-tooltip>
      </template>
      系统根据你每道题的答题结果，自动计算每个知识点的掌握程度（0-5级）。等级越高说明掌握越扎实。点击下方表格行可查看详情。
    </el-alert>

    <el-row :gutter="16">
      <el-col :span="16">
        <el-card>
          <template #header>
            <div style="display:flex;align-items:center;gap:8px">
              <span>知识点掌握雷达图</span>
              <el-tooltip content="雷达图展示Top 8知识点的掌握度分布。越靠近外圈代表掌握越好（满分100）。多边形越大越均衡。" placement="top" effect="light">
                <el-icon style="cursor:help;color:#909399"><QuestionFilled /></el-icon>
              </el-tooltip>
            </div>
          </template>
          <div id="mastery-radar-chart" style="width:100%;height:400px" v-if="data.length > 0" />
          <el-empty v-else description="暂无数据，先去专项练习或考试获取答题数据" />
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card>
          <template #header>
            <div style="display:flex;align-items:center;gap:8px">
              <span>薄弱知识点</span>
              <el-tooltip content="掌握等级≤2（基础以下）的知识点。这些是建议优先复习的内容。点击标签可跳转到对应练习。" placement="top" effect="light">
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

    <el-card style="margin-top:16px">
      <template #header>
        <div style="display:flex;align-items:center;gap:8px">
          <span>知识点详情</span>
          <el-tooltip :content="formulaTooltip" placement="top" effect="light">
            <el-icon style="cursor:help;color:#909399"><QuestionFilled /></el-icon>
          </el-tooltip>
        </div>
      </template>
      <el-table :data="data" v-loading="loading" stripe border max-height="500">
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
            <el-tooltip content="综合评分(满分100)=正确率×50%+连续正确×30%+练习量×20%" placement="top" effect="light">
              <div style="cursor:help">
                <el-progress
                  :percentage="Math.min(100, row.proficiencyScore ?? 0)"
                  :stroke-width="8"
                  :color="(row.proficiencyScore ?? 0) >= 70 ? '#67C23A' : (row.proficiencyScore ?? 0) >= 40 ? '#E6A23C' : '#F56C6C'"
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
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="$router.push('/student/practice')">练习</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.page-container { padding: 16px; }
</style>
