<script setup lang="ts">
import { onMounted, reactive, ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { List, Grid, Cpu } from '@element-plus/icons-vue'
import { listAdminResults, exportResults } from '@/api/admin'
import { getResultDetail } from '@/api/student'
import type { ExamResultItem, ResultDetail } from '@/types/result'
import type { QuestionType } from '@/types/common'
import { useViewMode } from '@/composables/useViewMode'

const { viewMode, toggleViewMode } = useViewMode('result_manage')

const query = reactive({
  userId: undefined as number | undefined,
  userName: '',
  sessionId: undefined as number | undefined,
  paperId: undefined as number | undefined,
  paperName: '',
  minScore: undefined as number | undefined,
  maxScore: undefined as number | undefined,
  isPass: undefined as boolean | undefined,
  minCorrectRate: undefined as number | undefined,
  maxCorrectRate: undefined as number | undefined,
  pageNum: 1,
  pageSize: 50,
})
const list = ref<ExamResultItem[]>([])
const total = ref(0)
const loading = ref(false)
const exporting = ref(false)

const load = async () => {
  loading.value = true
  try {
    const res = await listAdminResults({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      userId: query.userId,
      userName: query.userName || undefined,
      sessionId: query.sessionId,
      paperId: query.paperId,
      paperName: query.paperName || undefined,
      minScore: query.minScore,
      maxScore: query.maxScore,
      isPass: query.isPass,
      minCorrectRate: query.minCorrectRate,
      maxCorrectRate: query.maxCorrectRate,
    })
    list.value = res.data.records ?? []
    total.value = res.data.total ?? 0
  } finally { loading.value = false }
}
const search = () => { query.pageNum = 1; load() }
const reset = () => {
  query.userId = undefined; query.userName = ''; query.sessionId = undefined; query.paperId = undefined
  query.paperName = ''; query.minScore = undefined; query.maxScore = undefined; query.isPass = undefined
  query.minCorrectRate = undefined; query.maxCorrectRate = undefined; query.pageNum = 1
  load()
}

/* ---------------- 导出 CSV ---------------- */
const doExport = async () => {
  exporting.value = true
  try {
    const res = (await exportResults({
      userId: query.userId,
      sessionId: query.sessionId,
      paperId: query.paperId,
      minScore: query.minScore,
      maxScore: query.maxScore,
    })) as unknown as { data: Blob; headers: Record<string, string> }
    const blob = new Blob([res.data], { type: 'text/csv;charset=UTF-8' })
    let filename = `成绩数据-${new Date().toISOString().slice(0, 10)}.csv`
    const disp = res.headers?.['content-disposition'] || res.headers?.['Content-Disposition']
    if (disp) {
      const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disp)
      const n = decodeURIComponent(m?.[1] || m?.[2] || '')
      if (n) filename = n
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch {
    // handled
  } finally { exporting.value = false }
}

/* ---------------- 详情弹窗 ---------------- */
const detailVisible = ref(false)
const detail = ref<ResultDetail | null>(null)
const detailLoading = ref(false)

const openDetail = async (row: ExamResultItem) => {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    const res = await getResultDetail(row.examId ?? row.id)
    detail.value = res.data
  } finally { detailLoading.value = false }
}

const typeLabel = (t: QuestionType) =>
  ({ SINGLE: '单选', MULTIPLE: '多选', JUDGE: '判断', FILL_HINT: '填空', READING: '阅读理解' } as Record<QuestionType, string>)[t] || t

const answerText = (a: string | undefined | null) => {
  if (a === undefined || a === null || a === '') return '（未作答）'
  return a
}

const scoreColor = (row: ExamResultItem) => {
  const pct = row.scorePercentage ?? 0
  if (pct >= 80) return '#67c23a'
  if (pct >= 60) return '#e6a23c'
  return '#f56c6c'
}

const durationText = (row: ExamResultItem) =>
  row.durationSeconds ? `${Math.round(row.durationSeconds / 60)} 分钟` : '-'

const rankText = (row: ExamResultItem) =>
  row.classRank != null && row.totalCount != null ? `${row.classRank} / ${row.totalCount}` : '-'

const correctRateText = (row: ExamResultItem) => {
  if (row.correctRate != null) return row.correctRate.toFixed(1) + '%'
  if (row.correctCount != null && row.wrongCount != null) {
    const total = row.correctCount + row.wrongCount
    return total > 0 ? ((row.correctCount / total) * 100).toFixed(1) + '%' : '-'
  }
  return '-'
}

/* ---------------- 统计概览 ---------------- */
const stats = computed(() => {
  const total = list.value.length
  const passedCount = list.value.filter(r => r.passed).length
  const failedCount = total - passedCount
  const scores = list.value.filter(r => r.totalScore != null)
  const avgScore = scores.length
    ? scores.reduce((sum, r) => sum + (r.totalScore ?? 0), 0) / scores.length
    : 0
  const maxScore = scores.length ? Math.max(...scores.map(r => r.totalScore ?? 0)) : 0
  const minScore = scores.length ? Math.min(...scores.map(r => r.totalScore ?? 0)) : 0
  const passRate = total > 0 ? (passedCount / total) * 100 : 0
  return { total, passedCount, failedCount, avgScore, maxScore, minScore, passRate }
})

onMounted(load)
</script>

<template>
  <div class="page">
    <!-- 统计概览 -->
    <div class="stats-bar">
      <div class="stat-item">
        <div class="stat-icon" style="background:#ecf5ff;color:#409eff"><el-icon><Document /></el-icon></div>
        <div class="stat-info">
          <div class="stat-num">{{ stats.total }}</div>
          <div class="stat-label">成绩总数</div>
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-icon" style="background:#f0f9eb;color:#67c23a"><el-icon><CircleCheck /></el-icon></div>
        <div class="stat-info">
          <div class="stat-num">{{ stats.passedCount }}</div>
          <div class="stat-label">及格人数</div>
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-icon" style="background:#fef0f0;color:#f56c6c"><el-icon><CircleClose /></el-icon></div>
        <div class="stat-info">
          <div class="stat-num">{{ stats.failedCount }}</div>
          <div class="stat-label">不及格人数</div>
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-icon" style="background:#fdf6ec;color:#e6a23c"><el-icon><Trophy /></el-icon></div>
        <div class="stat-info">
          <div class="stat-num">{{ stats.avgScore.toFixed(1) }}</div>
          <div class="stat-label">平均分</div>
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-icon" style="background:#f4f4f5;color:#909399"><el-icon><TrendCharts /></el-icon></div>
        <div class="stat-info">
          <div class="stat-num">{{ stats.passRate.toFixed(1) }}%</div>
          <div class="stat-label">及格率</div>
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-icon" style="background:#f0f9eb;color:#67c23a"><el-icon><Top /></el-icon></div>
        <div class="stat-info">
          <div class="stat-num">{{ stats.maxScore.toFixed(1) }}</div>
          <div class="stat-label">最高分</div>
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-icon" style="background:#fef0f0;color:#f56c6c"><el-icon><Bottom /></el-icon></div>
        <div class="stat-info">
          <div class="stat-num">{{ stats.minScore.toFixed(1) }}</div>
          <div class="stat-label">最低分</div>
        </div>
      </div>
    </div>

    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="query">
        <el-row :gutter="8">
          <el-form-item label="学生姓名">
            <el-input v-model="query.userName" clearable placeholder="学生姓名" style="width:150px" />
          </el-form-item>
          <el-form-item label="试卷名称">
            <el-input v-model="query.paperName" clearable placeholder="试卷名称" style="width:180px" />
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
        </el-row>
        <el-row :gutter="8" style="margin-top: 8px;">
          <el-form-item label="场次 ID">
            <el-input-number v-model="query.sessionId" placeholder="sessionId" :min="1" controls-position="right" style="width:120px" />
          </el-form-item>
          <el-form-item label="试卷 ID">
            <el-input-number v-model="query.paperId" placeholder="paperId" :min="1" controls-position="right" style="width:120px" />
          </el-form-item>
          <el-form-item label="学生 ID">
            <el-input-number v-model="query.userId" placeholder="userId" :min="1" controls-position="right" style="width:120px" />
          </el-form-item>
          <el-form-item label="正确率">
            <el-input-number v-model="query.minCorrectRate" :min="0" :max="100" placeholder="最低%" controls-position="right" style="width:100px" />
            <span style="margin:0 4px; color:#909399">~</span>
            <el-input-number v-model="query.maxCorrectRate" :min="0" :max="100" placeholder="最高%" controls-position="right" style="width:100px" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="search"><el-icon><Search /></el-icon>查询</el-button>
            <el-button @click="reset"><el-icon><Refresh /></el-icon>重置</el-button>
            <el-button @click="toggleViewMode" :type="viewMode === 'card' ? 'primary' : 'default'" size="small">
              <el-icon><List v-if="viewMode === 'card'" /><Grid v-else /></el-icon>
              {{ viewMode === 'card' ? '表格' : '卡片' }}
            </el-button>
            <el-button type="primary" size="small" @click="$router.push('/admin/ai-compose')">
              <el-icon><Cpu /></el-icon>AI成绩分析
            </el-button>
          </el-form-item>
        </el-row>
      </el-form>
    </el-card>

    <el-card shadow="never" v-loading="loading">
      <div class="toolbar">
        <el-button type="success" :loading="exporting" @click="doExport">
          <el-icon><Download /></el-icon>导出 CSV
        </el-button>
      </div>
      <!-- 表格布局 -->
      <el-table v-if="viewMode === 'table'" :data="list" style="width:100%">
        <el-table-column type="index" label="#" width="60" />
        <el-table-column label="头像" width="80" align="center">
          <template #default="{ row }">
            <el-avatar :size="36" :src="row.avatar || ''">
              <el-icon><User /></el-icon>
            </el-avatar>
          </template>
        </el-table-column>
        <el-table-column label="学生" min-width="140">
          <template #default="{ row }">{{ row.realName || row.username }}</template>
        </el-table-column>
        <el-table-column prop="paperName" label="试卷" min-width="120" show-overflow-tooltip />
        <el-table-column prop="sessionName" label="场次" min-width="120" show-overflow-tooltip />
        <el-table-column label="分数" width="140" align="center">
          <template #default="{ row }">
            <span :style="{ color: scoreColor(row) }">{{ row.totalScore ?? '-' }}</span>
            <span style="color:#c0c4cc">/ {{ row.paperTotalScore ?? '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="正确率" width="100" align="center">
          <template #default="{ row }">{{ row.scorePercentage != null ? row.scorePercentage.toFixed(1) + '%' : '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.passed ? 'success' : 'danger'" size="small">{{ row.passed ? '及格' : '不及格' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="用时" width="100" align="center">
          <template #default="{ row }">{{ durationText(row) }}</template>
        </el-table-column>
        <el-table-column label="正确率" width="100" align="center">
          <template #default="{ row }">
            <span :style="{ color: (row.correctRate ?? (row.correctCount && row.wrongCount ? row.correctCount / (row.correctCount + row.wrongCount) * 100 : 0)) >= 80 ? '#67c23a' : (row.correctRate ?? 0) >= 60 ? '#e6a23c' : '#f56c6c' }">
              {{ correctRateText(row) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="排名" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.classRank != null" :type="row.classRank <= 3 ? 'warning' : 'info'" size="small">
              {{ rankText(row) }}
            </el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="submitTime" label="提交时间" width="180" />
        <el-table-column prop="createTime" label="生成时间" width="180" />
        <el-table-column label="操作" width="120" align="center">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="openDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 卡片网格布局 -->
      <div v-else class="result-grid">
        <el-card
          v-for="item in list"
          :key="item.id"
          class="result-card"
          hover
          @click="openDetail(item)"
        >
          <div class="card-header">
            <span class="result-id">#{{ item.id }}</span>
            <el-tag v-if="item.classRank != null && item.classRank <= 3" type="warning" size="small" effect="dark">
              第{{ item.classRank }}名
            </el-tag>
            <el-tag :type="item.passed ? 'success' : 'danger'" size="small">{{ item.passed ? '及格' : '不及格' }}</el-tag>
          </div>
          <div class="card-title">{{ item.sessionName }}</div>
          <div class="card-student">
            <el-avatar :size="32" :src="item.avatar || ''">
              <el-icon><User /></el-icon>
            </el-avatar>
            <div class="student-info">
              <div class="student-name">{{ item.realName || item.username }}</div>
              <div class="student-meta">@{{ item.username }} <span v-if="item.englishName" style="color:#909399">{{ item.englishName }}</span></div>
            </div>
          </div>
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
              <span class="meta-label">正确率</span>
              <span class="meta-value" :style="{ color: (item.correctRate ?? 0) >= 80 ? '#67c23a' : (item.correctRate ?? 0) >= 60 ? '#e6a23c' : '#f56c6c' }">{{ correctRateText(item) }}</span>
            </span>
            <span class="meta-item">
              <span class="meta-label">排名</span>
              <span class="meta-value">{{ rankText(item) }}</span>
            </span>
            <span class="meta-item">
              <span class="meta-label">提交时间</span>
              <span class="meta-value">{{ item.submitTime || item.createTime || '-' }}</span>
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
          <div class="card-footer">
            <el-button type="primary" size="small">查看详情</el-button>
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

    <!-- 答题详情 -->
    <el-dialog v-model="detailVisible" title="答题详情" width="760px" top="6vh">
      <div v-loading="detailLoading" style="min-height:200px">
        <template v-if="detail">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="考试">{{ detail.sessionName }}</el-descriptions-item>
            <el-descriptions-item label="学生">{{ detail.realName || detail.username }}</el-descriptions-item>
            <el-descriptions-item label="得分">
              <b style="color:#409eff; font-size:16px">{{ detail.totalScore }}</b> / {{ detail.paperTotalScore ?? '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="百分制">{{ detail.scorePercentage != null ? detail.scorePercentage.toFixed(1) + '%' : '-' }}</el-descriptions-item>
            <el-descriptions-item label="用时">
              {{ detail.durationSeconds ? Math.round(detail.durationSeconds / 60) + ' 分钟' : '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="提交时间">{{ detail.submitTime || '-' }}</el-descriptions-item>
            <el-descriptions-item label="答对/答错">
              <span style="color:#67c23a">{{ detail.correctCount }} 题</span> / <span style="color:#f56c6c">{{ detail.wrongCount }} 题</span>
            </el-descriptions-item>
            <el-descriptions-item label="正确率">
              <span v-if="detail.correctCount != null && detail.wrongCount != null">
                {{ ((detail.correctCount / (detail.correctCount + detail.wrongCount)) * 100).toFixed(1) }}%
              </span>
              <span v-else>-</span>
            </el-descriptions-item>
          </el-descriptions>

          <h4 style="margin: 16px 0 8px">逐题明细</h4>
          <div class="answers">
            <div
              v-for="(a, idx) in detail.answers"
              :key="a.questionId"
              class="answer-item"
              :class="{ ok: a.isCorrect === 1, ng: a.isCorrect === 0 }"
            >
              <div class="head">
                <span>
                  <el-icon><CircleCheck v-if="a.isCorrect === 1" /><CircleClose v-else /></el-icon>
                  第 {{ idx + 1 }} 题
                </span>
                <el-tag size="small">{{ typeLabel(a.questionType) }}</el-tag>
                <el-tag size="small" type="info">{{ a.obtainedScore ?? 0 }} 分</el-tag>
              </div>
              <div class="stem">{{ a.stem }}</div>
              <div class="row"><span class="lbl">你的答案：</span><span :class="a.isCorrect === 1 ? 'ok-text' : 'ng-text'">{{ answerText(a.userAnswer) }}</span></div>
              <div class="row"><span class="lbl">正确答案：</span><span class="ok-text">{{ answerText(a.standardAnswer) }}</span></div>
              <div class="row" v-if="a.analysis"><span class="lbl">解析：</span><span>{{ a.analysis }}</span></div>
            </div>
          </div>
        </template>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.page { display: flex; flex-direction: column; gap: 12px; }
.filter-card :deep(.el-card__body) { padding-bottom: 0; }
.toolbar { margin-bottom: 12px; display: flex; justify-content: flex-end; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }

/* 统计概览 */
.stats-bar {
  display: flex;
  gap: 16px;
  padding: 16px 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  flex-wrap: wrap;
}
.stat-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 100px;
}
.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}
.stat-info {
  display: flex;
  flex-direction: column;
}
.stat-num {
  font-size: 20px;
  font-weight: 700;
  color: #303133;
  line-height: 1.2;
}
.stat-label {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

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
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.result-id {
  font-size: 12px;
  color: #909399;
  font-family: monospace;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 10px;
}

.card-student {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.student-info {
  flex: 1;
  min-width: 0;
}

.student-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.student-meta {
  font-size: 12px;
  color: #909399;
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

.card-footer {
  display: flex;
  justify-content: flex-end;
}

.answers { display: flex; flex-direction: column; gap: 10px; }
.answer-item {
  border-left: 3px solid #dcdfe6; padding: 12px 16px;
  background: #fafafa; border-radius: 4px;
}
.answer-item.ok { border-left-color: #67c23a; }
.answer-item.ng { border-left-color: #f56c6c; }
.head { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; font-weight: 600; }
.answer-item.ok .head > span:first-child { color: #67c23a; }
.answer-item.ng .head > span:first-child { color: #f56c6c; }
.stem { color: #303133; line-height: 1.7; margin-bottom: 8px; white-space: pre-wrap; }
.row { padding: 3px 0; font-size: 13px; line-height: 1.6; }
.lbl { color: #909399; margin-right: 4px; }
.ok-text { color: #67c23a; font-weight: 600; }
.ng-text { color: #f56c6c; font-weight: 600; }
</style>
