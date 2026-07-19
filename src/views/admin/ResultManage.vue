<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { listAdminResults, exportResults } from '@/api/admin'
import { getResultDetail } from '@/api/student'
import type { ExamResultItem, ResultDetail } from '@/types/result'
import type { QuestionType } from '@/types/common'

const query = reactive({
  userId: undefined as number | undefined,
  sessionId: undefined as number | undefined,
  paperId: undefined as number | undefined,
  minScore: undefined as number | undefined,
  maxScore: undefined as number | undefined,
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
      sessionId: query.sessionId,
      paperId: query.paperId,
      minScore: query.minScore,
      maxScore: query.maxScore,
    })
    list.value = res.data.records ?? []
    total.value = res.data.total ?? 0
  } finally { loading.value = false }
}
const search = () => { query.pageNum = 1; load() }
const reset = () => {
  query.userId = undefined; query.sessionId = undefined; query.paperId = undefined
  query.minScore = undefined; query.maxScore = undefined; query.pageNum = 1
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

onMounted(load)
</script>

<template>
  <div class="page">
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="query">
        <el-form-item label="场次 ID">
          <el-input-number v-model="query.sessionId" placeholder="sessionId" :min="1" controls-position="right" style="width:150px" />
        </el-form-item>
        <el-form-item label="试卷 ID">
          <el-input-number v-model="query.paperId" placeholder="paperId" :min="1" controls-position="right" style="width:150px" />
        </el-form-item>
        <el-form-item label="学生 ID">
          <el-input-number v-model="query.userId" placeholder="userId" :min="1" controls-position="right" style="width:150px" />
        </el-form-item>
        <el-form-item label="分数区间">
          <el-input-number v-model="query.minScore" :min="0" :max="100" placeholder="最低" controls-position="right" style="width:110px" />
          <span style="margin:0 4px; color:#909399">→</span>
          <el-input-number v-model="query.maxScore" :min="0" :max="100" placeholder="最高" controls-position="right" style="width:110px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="search"><el-icon><Search /></el-icon>查询</el-button>
          <el-button @click="reset"><el-icon><Refresh /></el-icon>重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" v-loading="loading">
      <div class="toolbar">
        <el-button type="success" :loading="exporting" @click="doExport">
          <el-icon><Download /></el-icon>导出 CSV
        </el-button>
      </div>
      <el-table :data="list" style="width:100%">
        <el-table-column type="index" label="#" width="60" />
        <el-table-column prop="sessionName" label="考试名称" min-width="160" show-overflow-tooltip />
        <el-table-column label="学生" width="180">
          <template #default="{ row }">
            <span>{{ row.realName || row.username }}</span>
            <span v-if="row.realName && row.username" style="color:#909399; margin-left:4px">({{ row.username }})</span>
          </template>
        </el-table-column>
        <el-table-column prop="paperName" label="试卷" min-width="140" show-overflow-tooltip />
        <el-table-column prop="createTime" label="生成时间" width="180" />
        <el-table-column label="用时" width="90">
          <template #default="{ row }">{{ durationText(row) }}</template>
        </el-table-column>
        <el-table-column label="得分" width="130" align="center">
          <template #default="{ row }">
            <span :style="{ color: scoreColor(row), fontWeight: 600 }">{{ row.totalScore ?? '-' }}</span>
            <span style="color:#909399"> / {{ row.paperTotalScore ?? '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="百分制" width="90" align="center">
          <template #default="{ row }">
            <span :style="{ color: scoreColor(row) }">
              {{ row.scorePercentage != null ? row.scorePercentage.toFixed(1) : '-' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="是否及格" width="90" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.passed" type="success" size="small">及格</el-tag>
            <el-tag v-else type="danger" size="small">不及格</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openDetail(row)">详情</el-button>
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
