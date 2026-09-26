<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { getCategoryTree, listQuestions } from '@/api/student'
// [2026-09-26 修改] 下线「学习模式」（06 清单 §8.4 X 档）
//   论文表 2.4（UC02 英语语法题库查询）明确：「查询结果只含题干、题型和难度等公开字段，
//   绝不返回标准答案」—— 学习模式会返回答案+解析，与该用例冲突，故下线其入口。
//   原 import 保留备查：
// import { getQuestionStudyMode } from '@/api/student'
import type { Category } from '@/types/category'
import type { Question } from '@/types/question'
import type { Difficulty, QuestionType } from '@/types/common'

const query = reactive({
  categoryId: undefined as number | undefined,
  questionType: undefined as QuestionType | undefined,
  difficulty: undefined as Difficulty | undefined,
  keyword: '',
  pageNum: 1,
  pageSize: 50,
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
    // [2026-09-26 修改] 原实现（保留备查）：
    //   // 学习模式含答案 + 解析
    //   const res = await getQuestionStudyMode(row.id)
    //   detail.value = res.data
    // 改为：仅展示列表行已有的公开字段，不再请求含标准答案的接口 —— 对齐论文表 2.4（UC02）。
    detail.value = row
  } finally {
    detailLoading.value = false
  }
}

const answerText = (q: Question | null) => q?.standardAnswer || '-'

onMounted(async () => {
  try {
    const res = await getCategoryTree()
    categories.value = Array.isArray(res.data) ? res.data : []
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
      <div class="question-grid">
        <el-card
          v-for="item in list"
          :key="item.id"
          class="question-card"
          hover
          @click="showDetail(item)"
        >
          <div class="card-header">
            <span class="q-id">#{{ item.id }}</span>
            <el-tag size="small" type="info">{{ item.categoryName }}</el-tag>
            <el-tag size="small" :type="diffTagType(item.difficulty)">{{ diffLabel(item.difficulty) }}</el-tag>
            <el-tag size="small">{{ typeLabel(item.questionType) }}</el-tag>
          </div>
          <div class="card-stem">{{ item.stem }}</div>
          <div class="card-options">
            <div v-for="opt in item.options || []" :key="opt.optionLabel" class="opt-item">
              <span class="opt-label">{{ opt.optionLabel }}.</span>
              <span class="opt-content">{{ opt.optionContent }}</span>
            </div>
            <div v-if="!item.options?.length" class="no-options">
              <el-text type="info" size="small">点击查看详情获取选项</el-text>
            </div>
          </div>
          <div class="card-tags" v-if="item.knowledgePoints?.length">
            <el-tag v-for="tag in item.knowledgePoints" :key="tag" size="small" type="info">{{ tag }}</el-tag>
          </div>
          <div class="card-footer">
            <span class="answer-hint">答案：{{ item.standardAnswer || '点击查看' }}</span>
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
          :page-sizes="[10, 20, 30]"
          @size-change="load"
          @current-change="load"
        />
      </div>
    </el-card>

    <!-- 详情弹窗（学习模式：展示答案 + 解析） -->
    <el-dialog v-model="detailVisible" title="题目详情" width="720px">
      <div v-loading="detailLoading">
        <template v-if="detail">
          <div class="q-title">{{ detail.stem }}</div>
          <div class="q-meta">
            <el-tag size="small">{{ typeLabel(detail.questionType) }}</el-tag>
            <el-tag size="small" :type="diffTagType(detail.difficulty)">{{ diffLabel(detail.difficulty) }}</el-tag>
            <el-tag v-if="detail.categoryName" size="small" type="info">{{ detail.categoryName }}</el-tag>
          </div>
          <div v-if="detail.options?.length" class="q-options">
            <div
              v-for="op in detail.options"
              :key="op.optionLabel"
              class="opt"
              :class="{ correct: op.optionLabel === detail.standardAnswer, wrong: detail.standardAnswer && op.optionLabel !== detail.standardAnswer }"
            >
              <span class="opt-key">{{ op.optionLabel }}.</span>
              <span>{{ op.optionContent }}</span>
              <el-icon v-if="op.optionLabel === detail.standardAnswer" class="opt-icon"><Check /></el-icon>
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

.question-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: 16px;
}

.question-card {
  cursor: pointer;
  transition: all 0.2s;
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.q-id {
  font-size: 12px;
  color: #909399;
  font-family: monospace;
}

.card-stem {
  font-size: 14px;
  line-height: 1.6;
  color: #303133;
  margin-bottom: 12px;
  white-space: pre-wrap;
}

.card-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.opt-item {
  display: flex;
  align-items: flex-start;
  padding: 6px 10px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.5;
}

.opt-label {
  font-weight: 600;
  color: #409eff;
  margin-right: 6px;
  flex-shrink: 0;
}

.opt-content {
  color: #606266;
}

.no-options {
  padding: 8px;
  text-align: center;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}

.answer-hint {
  font-size: 13px;
  color: #67c23a;
  font-weight: 500;
}

.q-title { font-size: 15px; line-height: 1.7; margin-bottom: 12px; color: #303133; }
.q-meta { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.q-options { display: flex; flex-direction: column; gap: 8px; }
.opt {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  background: #f5f7fa;
  border-radius: 6px;
  border-left: 3px solid transparent;
  &.correct {
    background: #f0f9eb;
    border-left-color: #67c23a;
    color: #67c23a;
  }
  &.wrong {
    opacity: 0.6;
  }
}
.opt-key { font-weight: 600; color: #409eff; margin-right: 8px; flex-shrink: 0; }
.opt-icon { margin-left: auto; color: #67c23a; }
.q-answer { color: #67c23a; font-weight: 600; font-size: 15px; }
.q-analysis { color: #606266; line-height: 1.7; white-space: pre-wrap; }
</style>
