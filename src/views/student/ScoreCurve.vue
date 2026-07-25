<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { getMyScoreTrend } from '@/api/scoreCurve'
import type { ScoreCurve as SC } from '@/types/scoreCurve'
import * as echarts from 'echarts'

const data = ref<SC[]>([])
const loading = ref(false)

const load = async () => {
  loading.value = true
  try {
    const res = await getMyScoreTrend()
    data.value = res.data ?? []
    await nextTick()
    renderChart()
  } finally { loading.value = false }
}

const renderChart = () => {
  const container = document.getElementById('score-curve-chart')
  if (!container || data.value.length === 0) return
  const chart = echarts.init(container)

  const dates = data.value.map(d => d.examDate)
  const scores = data.value.map(d => d.scorePercentage ?? 0)
  const classAvgs = data.value.map(d => d.classAvgScore ?? 0)

  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['我的分数', '班级平均'] },
    xAxis: { type: 'category', data: dates },
    yAxis: { type: 'value', name: '百分制分数', min: 0, max: 100 },
    series: [
      { name: '我的分数', type: 'line', data: scores, smooth: true, itemStyle: { color: '#409EFF' }, markLine: { data: [{ type: 'average', name: '个人平均' }] } },
      { name: '班级平均', type: 'line', data: classAvgs, smooth: true, itemStyle: { color: '#E6A23C' }, lineStyle: { type: 'dashed' } },
    ],
  })
}

const exportCSV = () => {
  if (data.value.length === 0) { ElMessage.warning('无数据'); return }
  const csv = ['考试日期,考试名称,得分,满分,百分制,班级排名,进步幅度']
  data.value.forEach(d => csv.push([d.examDate, d.examName, d.score, d.totalScore, d.scorePercentage, d.classRank ?? '-', d.progressAmount ?? 0].join(',')))
  const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = '成绩趋势.csv'; a.click()
  URL.revokeObjectURL(url)
}

onMounted(load)
</script>

<template>
  <div class="page-container">
    <el-card>
      <template #header>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span>成绩趋势</span>
              <el-tooltip content="折线图展示历次考试百分制分数变化。虚线为班级平均分，可对比自己的排名位置。蓝色实线是个人分数趋势。" placement="bottom" effect="light">
                <el-icon style="cursor:help;color:#909399;margin-left:4px"><QuestionFilled /></el-icon>
              </el-tooltip>
          <el-button size="small" @click="exportCSV">导出CSV</el-button>
        </div>
      </template>
      <div id="score-curve-chart" style="width:100%;height:420px" v-if="data.length > 0" />
      <el-empty v-else description="暂无考试记录" />
    </el-card>

    <!-- 统计汇总 -->
    <el-row :gutter="16" style="margin-top:16px" v-if="data.length > 0">
      <el-col :span="6">
        <el-card shadow="hover"><el-statistic title="考试次数" :value="data.length" /></el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <el-statistic title="最新分数" :value="data[data.length - 1]?.scorePercentage ?? 0" suffix="分">
            <template #suffix>
              <span :style="{ color: (data[data.length - 1]?.progressAmount ?? 0) >= 0 ? '#67C23A' : '#F56C6C', fontSize: '13px', marginLeft: '8px' }">
                {{ (data[data.length - 1]?.progressAmount ?? 0) >= 0 ? '↑' : '↓' }}{{ Math.abs(data[data.length - 1]?.progressAmount ?? 0).toFixed(1) }}
              </span>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <el-statistic title="最高分" :value="Math.max(...data.map(d => d.scorePercentage ?? 0)).toFixed(1)" suffix="分" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <el-statistic title="平均分" :value="(data.reduce((s, d) => s + (d.scorePercentage ?? 0), 0) / data.length).toFixed(1)" suffix="分" />
        </el-card>
      </el-col>
    </el-row>

    <el-card style="margin-top:16px" v-if="data.length > 0">
      <template #header><span>考试记录明细</span></template>
      <el-table :data="[...data].reverse()" stripe border max-height="400">
        <el-table-column prop="examDate" label="日期" width="120" />
        <el-table-column prop="examName" label="考试名称" min-width="150" />
        <el-table-column prop="score" label="得分" width="80" />
        <el-table-column prop="totalScore" label="满分" width="80" />
        <el-table-column prop="scorePercentage" label="百分制" width="80" />
        <el-table-column label="进步幅度" width="100">
          <template #default="{ row }">
            <span :style="{ color: (row.progressAmount ?? 0) >= 0 ? '#67C23A' : '#F56C6C', fontWeight: 'bold' }">
              {{ (row.progressAmount ?? 0) >= 0 ? '+' : '' }}{{ row.progressAmount?.toFixed(1) ?? '-' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="classRank" label="班级排名" width="80" />
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.page-container { padding: 16px; }
</style>
