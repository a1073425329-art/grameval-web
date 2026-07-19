<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { getCategoryTree, listQuestions, getQuestionStudyMode } from '@/api/student'
import type { Category } from '@/types/category'
import type { Question } from '@/types/question'
import type { Difficulty, QuestionType } from '@/types/common'

const query = reactive({
  categoryId: undefined as number | undefined,
  questionType: undefined as QuestionType | undefined,
  difficulty: undefined as Difficulty | undefined,
  keyword: '',
  pageNum: 1,
  pageSize: 10,
})

const categories = ref<Category[]>([])
const list = ref<Question[]>([])
const total = ref(0)
const loading = ref(false)

const detailVisible = ref(false)
const detail = ref<Question | null>(null)
const detailLoading = ref(false)

const typeOptions: { label: string; value: QuestionType }[] = [
  { label: '单选题', value: 'SINGLE' },
  { label: '多选题', value: 'MULTIPLE' },
  { label: '判断题', value: 'JUDGE' },
  { label: '填空题', value: 'FILL_HINT' },
  { label: '阅读理解', value: 'READING' },
]

const difficultyOptions: { label: string; value: Difficulty }[] = [
  { label: '简单', value: 1 },
  { label: '中等', value: 2 },
  { label: '困难', value: 3 },
]

const typeLabel = (t?: QuestionType) => typeOptions.find((o) => o.value === t)?.label ?? t
const diffLabel = (d?: Difficulty) => difficultyOptions.find((o) => o.value === d)?.label ?? String(d)
const diffTagType = (d?: Difficulty) => (d === 1 ? 'success' : d === 2 ? 'warning' : 'danger')

const load = async () => {
  loading.value = true
  try {
    const res = await listQuestions({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      categoryId: query.categoryId,
      questionType: query.questionType,
      difficulty: query.difficulty,
      keyword: query.keyword || undefined,
    })
    list.value = res.data.records ?? []
    total.value = res.data.total ?? 0
  } finally {
    loading.value = false
  }
}

const search = () => { query.pageNum = 1; load() }
const reset = () => {
  query.categoryId = undefined
  query.questionType = undefined
  query.difficulty = undefined
  query.keyword = ''
  query.pageNum = 1
  load()
}

const showDetail = async (row: Question) => {
  detailVisible.value = true
  detailLoading.value = true
  try {
    // 学习模式含答案 + 解析
    const res = await getQuestionStudyMode(row.id)
    detail.value = res.data
  } finally {
    detailLoading.value = false
  }
}

const answerText = (q: Question | null) => q?.standardAnswer || '-'

onMounted(async () => {
  try {
    const res = await getCategoryTree()
    categories.value = res.data ?? []
  } catch { /* silent */ }
  load()
})
</script>

<template>
  <div class="page">
    <!-- 顶部筛选 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="query">
        <el-form-item label="语法专题">
          <el-cascader
            v-model="query.categoryId"
            :options="categories"
            :props="{
              value: 'id',
              label: 'categoryName',
              children: 'children',
              checkStrictly: true,
              emitPath: false,
            }"
            clearable
            placeholder="选择专题"
            style="width: 220px"
          />
        </el-form-item>
        <el-form-item label="题型">
          <el-select v-model="query.questionType" clearable placeholder="全部题型" style="width: 140px">
            <el-option v-for="op in typeOptions" :key="op.value" :label="op.label" :value="op.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="难度">
          <el-select v-model="query.difficulty" clearable placeholder="全部难度" style="width: 140px">
            <el-option v-for="op in difficultyOptions" :key="op.value" :label="op.label" :value="op.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="query.keyword" clearable placeholder="题干关键词" style="width: 180px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="search"><el-icon><Search /></el-icon>查询</el-button>
          <el-button @click="reset"><el-icon><Refresh /></el-icon>重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 题目列表 -->
    <el-card shadow="never" v-loading="loading">
      <el-table :data="list" style="width: 100%">
        <el-table-column type="index" label="#" width="60" />
        <el-table-column prop="stem" label="题干" min-width="360" show-overflow-tooltip />
        <el-table-column prop="categoryName" label="专题" width="140" />
        <el-table-column label="题型" width="100">
          <template #default="{ row }">{{ typeLabel(row.questionType) }}</template>
        </el-table-column>
        <el-table-column label="难度" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="diffTagType(row.difficulty)">{{ diffLabel(row.difficulty) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110" align="center">
          <template #default="{ row }">
            <el-button type="primary" size="small" link @click="showDetail(row)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="query.pageNum"
          v-model:page-size="query.pageSize"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          :page-sizes="[10, 20, 50]"
          @size-change="load"
          @current-change="load"
        />
      </div>
    </el-card>

    <!-- 详情弹窗（学习模式：展示答案 + 解析） -->
    <el-dialog v-model="detailVisible" title="题目详情" width="640px">
      <div v-loading="detailLoading">
        <template v-if="detail">
          <div class="q-title">{{ detail.stem }}</div>
          <div class="q-meta">
            <el-tag size="small">{{ typeLabel(detail.questionType) }}</el-tag>
            <el-tag size="small" :type="diffTagType(detail.difficulty)">{{ diffLabel(detail.difficulty) }}</el-tag>
            <el-tag v-if="detail.categoryName" size="small" type="info">{{ detail.categoryName }}</el-tag>
          </div>
          <div v-if="detail.options?.length" class="q-options">
            <div v-for="op in detail.options" :key="op.optionLabel" class="opt">
              <span class="opt-key">{{ op.optionLabel }}.</span>
              <span>{{ op.optionContent }}</span>
            </div>
          </div>
          <el-divider content-position="left">参考答案</el-divider>
          <div class="q-answer">{{ answerText(detail) }}</div>
          <el-divider content-position="left">解析</el-divider>
          <div class="q-analysis">{{ detail.analysis || '暂无解析' }}</div>
        </template>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.page { display: flex; flex-direction: column; gap: 12px; }
.filter-card :deep(.el-card__body) { padding-bottom: 0; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }

.q-title { font-size: 15px; line-height: 1.7; margin-bottom: 12px; color: #303133; }
.q-meta { display: flex; gap: 8px; margin-bottom: 12px; }
.q-options { display: flex; flex-direction: column; gap: 8px; }
.opt { padding: 8px 12px; background: #f5f7fa; border-radius: 4px; }
.opt-key { font-weight: 600; color: #409eff; margin-right: 6px; }
.q-answer { color: #67c23a; font-weight: 600; font-size: 15px; }
.q-analysis { color: #606266; line-height: 1.7; white-space: pre-wrap; }
</style>
