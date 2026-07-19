<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getMyResults, getMySummary } from '@/api/student'
import type { ResultSummary, ExamResultItem } from '@/types/result'

const router = useRouter()

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
      }),
    ])
    if (s.status === 'fulfilled') summary.value = s.value.data
    if (l.status === 'fulfilled') {
      list.value = l.value.data.records ?? []
      total.value = l.value.data.total ?? 0
    }
  } finally {
    loading.value = false
  }
}

const search = () => { query.pageNum = 1; load() }
const reset = () => { query.keyword = ''; query.pageNum = 1; load() }

/** 用百分制成绩上色 */
const scoreColor = (row: ExamResultItem) => {
  const pct = row.scorePercentage ?? 0
  if (pct >= 80) return '#67c23a'
  if (pct >= 60) return '#e6a23c'
  return '#f56c6c'
}

const durationText = (row: ExamResultItem) =>
  row.durationSeconds ? `${Math.round(row.durationSeconds / 60)} 分钟` : '-'

onMounted(load)
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

    <!-- 查询 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="query">
        <el-form-item label="考试名称">
          <el-input v-model="query.keyword" placeholder="搜索考试" clearable style="width:220px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="search"><el-icon><Search /></el-icon>查询</el-button>
          <el-button @click="reset"><el-icon><Refresh /></el-icon>重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 列表 -->
    <el-card shadow="never" v-loading="loading">
      <el-table :data="list" style="width: 100%">
        <el-table-column type="index" label="#" width="60" />
        <el-table-column prop="sessionName" label="考试名称" min-width="200" show-overflow-tooltip />
        <el-table-column prop="paperName" label="试卷" min-width="140" show-overflow-tooltip />
        <el-table-column prop="submitTime" label="提交时间" width="180" />
        <el-table-column label="用时" width="100">
          <template #default="{ row }">{{ durationText(row) }}</template>
        </el-table-column>
        <el-table-column label="得分" width="150" align="center">
          <template #default="{ row }">
            <span :style="{ color: scoreColor(row), fontWeight: 600, fontSize: '16px' }">
              {{ row.totalScore ?? '-' }}
            </span>
            <span style="color:#909399"> / {{ row.paperTotalScore ?? '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="百分制" width="100" align="center">
          <template #default="{ row }">
            <span :style="{ color: scoreColor(row) }">
              {{ row.scorePercentage != null ? row.scorePercentage.toFixed(1) : '-' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center">
          <template #default="{ row }">
            <el-button size="small" type="primary" link @click="router.push(`/student/results/${row.examId ?? row.id}`)">
              查看详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

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
}
.stat-label { color: #909399; font-size: 13px; margin-bottom: 6px; }
.stat-value { font-size: 26px; font-weight: 600; color: #303133; }
.filter-card :deep(.el-card__body) { padding-bottom: 0; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
